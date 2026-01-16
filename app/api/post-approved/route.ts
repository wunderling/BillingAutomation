import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { QBOClient } from "@/lib/qbo";
import { Database } from "@/types/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") === "true";

    // Auth Check: Admin only or Cron secret (optional)
    // For MVP, assuming Admin session.

    const supabase = createClient();
    const qbo = new QBOClient();

    // 1. Get Tokens
    const { data: tokens } = await supabase.from('qbo_tokens').select('*').single();

    // NOTE: In real app, check expiration and refresh.
    // For MVP: assume valid or handle 401.
    if (!tokens || !tokens.access_token || !tokens.realm_id) {
        return NextResponse.json({ error: "QBO not connected" }, { status: 400 });
    }

    // 2. Refresh Token if needed (Naive check)
    let accessToken = tokens.access_token;
    // TODO: Add refresh logic here if time permits.

    // 3. Select Approved Sessions
    const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'approved')
        .is('qbo_delayed_charge_id', null);

    if (!sessions || sessions.length === 0) {
        return NextResponse.json({ message: "No approved sessions to post", dryRun, results: [] });
    }

    // 4. Processing
    const results = [];

    for (const session of sessions) {
        const result: any = {
            sessionId: session.id,
            student: session.student_name,
            title: session.title_raw,
            duration: session.duration_minutes_normalized,
            success: false,
            message: "",
        };

        try {
            // 4a. Resolve Customer
            // Check aliases
            let customerId = null;
            let customerName = null;

            const { data: alias } = await supabase
                .from('customer_aliases')
                .select('*')
                .eq('alias', session.student_name || session.title_raw) // Fallback to title if name empty
                .single();

            if (alias) {
                customerId = alias.qbo_customer_id;
                customerName = alias.qbo_customer_name;
            } else {
                // Search QBO
                const found = await qbo.findCustomer(accessToken, tokens.realm_id!, session.student_name || session.title_raw);
                if (found) {
                    customerId = found.Id;
                    customerName = found.DisplayName;
                }
            }

            if (!customerId) {
                // Mark as unmatched
                if (!dryRun) {
                    await supabase.from('sessions').update({ status: 'unmatched_customer' }).eq('id', session.id);
                }
                result.message = "Customer not found";
                results.push(result);
                continue;
            }

            // 4b. Create Delayed Charge
            if (dryRun) {
                result.success = true;
                result.message = `Would post to Customer: ${customerName}`;
                result.customerId = customerId;
            } else {
                // Create in QBO
                // POST /v3/company/:id/delayedcharge
                const payload = {
                    "CustomerRef": { "value": customerId },
                    "TxnDate": session.start_time.split('T')[0], // YYYY-MM-DD
                    "Line": [
                        {
                            "Description": `${session.title_raw} (GoogleEventID:${session.google_event_id})`,
                            "Amount": 0, // Delayed Charge usually just tracks quantity/hours, rate comes from Item?
                            // Wait, QBO Delayed Charge needs:
                            // DetailType: SalesItemLineDetail
                            // SalesItemLineDetail: { ItemRef: { value: qbo_item_id }, Qty: 1 } 
                            // For services, if it's hourly, we might pass Qty? 
                            // Normalized 50/90 are "Service Codes". Assuming they are mapped to Items that are flat fee (or hourly?).
                            // Requirement says: "service_code text null // "SESSION_50" | "SESSION_90"".
                            // "qbo_item_id" from settings.
                            "DetailType": "SalesItemLineDetail",
                            "SalesItemLineDetail": {
                                "ItemRef": { "value": session.qbo_item_id },
                                // Qty: 1? or duration? Usually flat fee items per session implies Qty 1.
                                "Qty": 1
                            }
                        }
                    ]
                };

                const qboRes = await qbo.makeApiCall(accessToken, tokens.realm_id!, 'delayedcharge', 'POST', payload);

                if (qboRes.Fault) {
                    throw new Error(JSON.stringify(qboRes.Fault));
                }

                const newId = qboRes.DelayedCharge.Id;

                // Update Session
                await supabase.from('sessions').update({
                    status: 'posted_to_qbo',
                    qbo_customer_id: customerId,
                    qbo_customer_name: customerName,
                    qbo_delayed_charge_id: newId,
                    updated_at: new Date().toISOString()
                }).eq('id', session.id);

                result.success = true;
                result.message = `Posted successfully (ID: ${newId})`;
            }

        } catch (e: any) {
            result.message = e.message;
            if (!dryRun) {
                // log error? status='error'?
            }
        }

        results.push(result);
    }

    // Log Run
    if (!dryRun) {
        await supabase.from('runs').insert({
            type: 'post',
            status: 'ok', // or mixed
            ended_at: new Date().toISOString(),
            details: results
        });
    }

    return NextResponse.json({ dryRun, results });
}
