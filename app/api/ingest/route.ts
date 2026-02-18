import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDuration, parseStudentName } from "@/lib/billing-logic";
import { Database } from "@/types/supabase";

// Force dynamic to prevent caching of the webhook endpoint
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

        const {
            google_event_id,
            google_calendar_id,
            title,
            description,
            start_time,
            end_time,
            duration_minutes,
            source_url,
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

        if (settingsError) {
            console.error("Settings query error:", settingsError);
            return NextResponse.json({ success: false, error: "Database error loading settings" }, { status: 500 });
        }

        if (!settingsData) {
            console.error("Settings table is empty - cannot process ingest");
            return NextResponse.json({ success: false, error: "Settings not found. Please configure settings in the dashboard." }, { status: 500 });
        }

        const settings = settingsData as Database['public']['Tables']['settings']['Row'];

        // 2. Logic: Dates & Duration
        const start = new Date(start_time);
        const end = new Date(end_time);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error("Invalid dates:", start_time, end_time);
            return NextResponse.json({ success: false, error: "Invalid date format" }, { status: 400 });
        }

        let duration = Number(duration_minutes);
        if (!duration || isNaN(duration) || duration === 0) {
            const diffMs = end.getTime() - start.getTime();
            duration = Math.round(diffMs / 1000 / 60);
        }

        // 3. Normalize
        const { normalized, serviceCode, qboItemId } = normalizeDuration(
            duration,
            {
                qbo_item_id_50: settings.qbo_item_id_50,
                qbo_item_id_90: settings.qbo_item_id_90,
            }
        );

        // 4. Parse Student Name (Event Title is Student Name)
        const studentName = parseStudentName(title);

        // 5. Lookup Billing Profile (New Source of Truth)
        const { data: profile } = await supabase
            .from("billing_profiles")
            .select("*")
            .eq("student_name", studentName)
            .maybeSingle();

        let status: Database['public']['Tables']['sessions']['Row']['status'] = 'pending_review';
        let qboCustomerId: string | null = null;
        let qboCustomerName: string | null = null;

        if (profile) {
            qboCustomerId = (profile as any).qbo_customer_id;
            qboCustomerName = (profile as any).qbo_customer_name;

            // Note: normalized status check is still valid if we want to flag unusual durations
            if (!normalized) {
                status = 'needs_review_duration';
            }
        } else {
            status = 'unmatched_client';
        }

        // 6. Upsert
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
            student_name: studentName,
            qbo_customer_id: qboCustomerId,
            qbo_customer_name: qboCustomerName,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_minutes_raw: duration,
            billing_units: normalized,
            service_code: serviceCode,
            qbo_item_id: qboItemId,
            updated_at: new Date().toISOString(),
            source: 'zapier'
        };

        if (source_url) {
            payload.notes = payload.notes ? `${payload.notes}\n${source_url}` : source_url;
        }

        // Preserve existing status if not posted and logic dictates a change, 
        // BUT we want to update if it was previously unmatched and now matched, or vice versa.
        // For simplicity, we overwrite status unless it was manually approved/posted.
        if (existing) {
            if ((existing.status as string) !== 'posted_to_qbo' && (existing.status as string) !== 'approved') {
                payload.status = status;
            } else {
                // If approved/posted, don't revert status, but DO update other fields? 
                // Usually if approved, we stop touching it. 
                // Use safe approach: only update status if it's currently in a flexible state.
                delete payload.status;
            }

            // If we found a match now, enforce it
            if (profile && existing.status === 'unmatched_client') {
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

        const upserted = upsertedData as Database['public']['Tables']['sessions']['Row'] | null;

        if (upsertError || !upserted) {
            console.error("Upsert error:", upsertError);
            return NextResponse.json({ success: false, error: "Database error: " + (upsertError?.message || "Unknown") }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: existing ? "Session updated" : "Session ingested successfully",
            session_id: upserted.id,
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
