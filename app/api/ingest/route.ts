import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDuration } from "@/lib/billing-logic";
import { Database } from "@/types/supabase";
import { QBOClient } from "@/lib/qbo";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const secret = req.headers.get("x-ingest-secret");
        if (secret !== process.env.INGEST_SECRET) {
            console.error("Unauthorized: Invalid secret");
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
        }

        // Zapier now only sends raw event data
        const {
            google_event_id,
            google_calendar_id,
            title,
            description,
            start_time,
            end_time,
            duration_minutes,
            source_url,
            attendee_emails,
        } = body;

        // Validate Required
        if (!google_event_id || !title || !start_time || !end_time) {
            console.error("Missing required fields:", body);
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const supabase = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Load Settings
        const { data: settingsData, error: settingsError } = await supabase
            .from("settings")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (settingsError || !settingsData) {
            return NextResponse.json({ success: false, error: "Database error loading settings" }, { status: 500 });
        }
        const settings = settingsData as Database['public']['Tables']['settings']['Row'];

        // 2. Fetch Live QBO Customers
        // First get the most recent tokens
        const { data: tokenData, error: tokenError } = await supabase
            .from("qbo_tokens")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (tokenError || !tokenData || !tokenData.access_token) {
            console.error("QBO Tokens not found or invalid");
            return NextResponse.json({ success: false, error: "QBO not connected" }, { status: 500 });
        }

        let accessToken = tokenData.access_token;
        const realmId = tokenData.realm_id;
        const qboClient = new QBOClient();

        let customers: any[] = [];
        try {
            customers = await qboClient.queryAllActiveCustomers(accessToken, realmId!);
        } catch (error: any) {
            if (error.message === 'Unauthorized') {
                // Token expired, refresh it
                try {
                    const newTokens = await qboClient.refreshTokens(tokenData.refresh_token!);
                    accessToken = newTokens.access_token;
                    
                    // Save new tokens
                    await supabase.from("qbo_tokens").update({
                        access_token: newTokens.access_token,
                        refresh_token: newTokens.refresh_token,
                        // @ts-ignore - access_token_expires_at structure exists
                        updated_at: new Date().toISOString()
                    }).eq("id", 1);
                    
                    // Retry QBO query
                    customers = await qboClient.queryAllActiveCustomers(accessToken, realmId!);
                } catch (refreshErr) {
                    console.error("Failed to refresh QBO tokens", refreshErr);
                    return NextResponse.json({ success: false, error: "QBO Token Refresh Failed" }, { status: 500 });
                }
            } else {
                throw error;
            }
        }

        // Format mapping for the LLM
        const customerMappingList = customers.map(c => 
            `- QBO ID: ${c.Id} | Parent Name: ${c.DisplayName} | Primary Email: ${c.PrimaryEmailAddr?.Address || 'None'} | Students/Notes: ${c.Notes || 'None'}`
        ).join('\n');

        // 3. Process Event with Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
You are an intelligent billing categorization agent. 
Analyze the provided Google Calendar tutoring event and match it to exactly ONE active QuickBooks Customer.

QBO ACTIVE CUSTOMERS MAPPING (Source of Truth):
${customerMappingList}

EVENT TO CATEGORIZE:
Title: ${title}
Description: ${description || "None provided"}
Attendee Emails: ${attendee_emails || "None provided"}

MATCHING RULES:
1. **Match to QBO ID**: 
   - Look for the student's name in the "Students/Notes" field of the QBO customers.
   - **Parent Match**: If the title mentions a parent (e.g., "Meeting with Sarah Wallis"), match it to the QBO Customer where "Parent Name" is "Sarah Wallis".
   - **Email Match**: If "Attendee Emails" matches the "Primary Email" of a QBO customer, that is a High confidence match.
   - **First Name**: If only a first name is provided (e.g., "Jeffrey"), find the best match in the Students/Notes field.

2. **Determine Service Category**:
   - "Consultation": Use for: "Consultation", "Consult", "IEP", "Meeting with [Parent]", "Parent Meeting", "Evaluation", "Testing".
   - "Educational Therapy": Use for standard tutoring sessions or titles with just a name.
   - "Other": Use only if completely unrelated.

3. **Extract Student Name**: 
   - Extract the core student name from the title (e.g., "Educational Therapy with Johnny" -> "Johnny").

EXAMPLES:
- Title: "Meeting with Elizabeth Fox" | Match: Look for QBO Customer "Elizabeth Fox" | Category: "Consultation"
- Title: "Jeffrey Wong" | Match: Look for "Jeffrey Wong" in Students/Notes | Category: "Educational Therapy"
- Title: "IEP Meeting for Tyler" | Match: Look for "Tyler" in Students/Notes | Category: "Consultation"

If you absolutely cannot find any customer that matches, set qbo_customer_id to "UNMATCHED".
        `;

        const responseSchema: any = {
            type: "object",
            properties: {
                qbo_customer_id: { type: "string" },
                service_category: { type: "string" },
                confidence: { type: "string" },
                extracted_student_name: { type: "string" },
            },
            required: ["qbo_customer_id", "service_category", "confidence", "extracted_student_name"]
        };

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const aiResponse = JSON.parse(result.response.text());
        const matchedQboId = aiResponse.qbo_customer_id === "UNMATCHED" ? null : aiResponse.qbo_customer_id;
        const serviceCat = aiResponse.service_category;
        const conf = aiResponse.confidence;
        const extractedName = aiResponse.extracted_student_name;

        // Lookup the matched customer name for saving
        const matchedCustomer = customers.find(c => c.Id === matchedQboId);
        const qboCustomerName = matchedCustomer ? matchedCustomer.DisplayName : null;

        // 4. Logic: Dates & Duration
        const start = new Date(start_time);
        const end = new Date(end_time);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return NextResponse.json({ success: false, error: "Invalid date format" }, { status: 400 });
        }

        let duration = Number(duration_minutes);
        if (!duration || isNaN(duration) || duration === 0) {
            const diffMs = end.getTime() - start.getTime();
            duration = Math.round(diffMs / 1000 / 60);
        }

        // 5. Normalize Duration
        const { normalized, serviceCode, qboItemId } = normalizeDuration(
            duration,
            {
                qbo_item_id_50: settings.qbo_item_id_50,
                qbo_item_id_90: settings.qbo_item_id_90,
            }
        );

        // Determine save status
        let status: Database['public']['Tables']['sessions']['Row']['status'] = 'pending_review';
        if (!matchedQboId) {
            status = 'unmatched_client';
        } else if (!normalized) {
            status = 'needs_review_duration';
        } else if (conf === "Low") {
            status = 'needs_review_duration'; // or create a needs_review_match status if desired
        }

        // 6. Upsert Session
        const { data: existingData } = await supabase
            .from("sessions")
            .select("*")
            .eq("google_event_id", google_event_id)
            .maybeSingle();

        const existing = existingData as Database['public']['Tables']['sessions']['Row'] | null;

        if (existing?.status === "posted_to_qbo") {
            return NextResponse.json({
                success: true,
                message: "Session already posted to QBO. Skipped update.",
                session_id: existing.id
            });
        }

        const payload: any = {
            google_event_id,
            google_calendar_id,
            title_raw: title,
            description_raw: description,
            student_name: extractedName || title, // Improved: we use the AI-extracted name piece
            service_category: serviceCat,
            confidence: conf,
            qbo_customer_id: matchedQboId,
            qbo_customer_name: qboCustomerName,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_minutes_raw: duration,
            billing_units: normalized,
            service_code: serviceCode,
            qbo_item_id: qboItemId,
            updated_at: new Date().toISOString(),
            source: 'zapier_with_backend_ai'
        };

        if (source_url) {
            payload.notes = payload.notes ? `${payload.notes}\n${source_url}` : source_url;
        }

        if (existing) {
            if ((existing.status as string) !== 'posted_to_qbo' && (existing.status as string) !== 'approved') {
                payload.status = status;
            } else {
                delete payload.status;
            }
            if (matchedQboId && existing.status === 'unmatched_client') {
                payload.status = status;
            }
        } else {
            payload.status = status;
        }

        const { data: upsertedData, error: upsertError } = await supabase
            .from("sessions")
            .upsert(payload, { onConflict: 'google_event_id' })
            .select()
            .single();

        if (upsertError || !upsertedData) {
            console.error("Upsert error:", upsertError);
            return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: existing ? "Session updated" : "Session ingested successfully",
            session_id: upsertedData.id,
            status: payload.status || existing?.status
        });

    } catch (err: any) {
        console.error("Unhandled API Error:", err);
        return NextResponse.json({
            success: false,
            error: "Internal Server Error",
            details: err.message
        }, { status: 500 });
    }
}
