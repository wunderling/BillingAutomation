import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { QBOClient } from "@/lib/qbo";
import { Database } from "@/types/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") === "true";

    // Auth Check: Admin only or Cron secret (optional)
    // For MVP, assuming Admin session.

    // Use Service Role for access to Tokens and robust updates
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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

    // 4. Processing - Group by Client
    const results = [];
    const groups: Record<string, { customerName: string, sessions: typeof sessions }> = {};

    for (const session of sessions) {
        let customerId = session.qbo_customer_id;
        let customerName = session.qbo_customer_name;

        if (!customerId) {
            // Check aliases
            const { data: alias } = await supabase
                .from('customer_aliases')
                .select('*')
                .eq('alias', session.student_name || session.title_raw)
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
        }

        if (!customerId) {
            if (!dryRun) {
                await supabase.from('sessions').update({ status: 'unmatched_client' }).eq('id', session.id);
            }
            results.push({
                sessionId: session.id,
                client: "Unresolved",
                title: session.title_raw,
                duration: session.duration_minutes_normalized,
                success: false,
                message: "Customer not found",
            });
            continue;
        }

        if (!groups[customerId]) {
            groups[customerId] = { customerName: customerName!, sessions: [] };
        }
        groups[customerId].sessions.push(session);
    }

    // 5. Create Batched Delayed Charges
    for (const [customerId, group] of Object.entries(groups)) {
        try {
            if (dryRun) {
                results.push({
                    client: group.customerName,
                    success: true,
                    message: `Would post batch of ${group.sessions.length} sessions to ${group.customerName}`,
                    duration: group.sessions.reduce((acc, s) => acc + (s.duration_minutes_normalized || 0), 0)
                });
            } else {
                // Create multi-line payload
                const payload = {
                    "CustomerRef": { "value": customerId },
                    "TxnDate": new Date().toISOString().split('T')[0],
                    "Line": group.sessions.map(s => ({
                        "Description": `${s.title_raw} (${new Date(s.start_time).toLocaleDateString()})`,
                        "Amount": 0,
                        "DetailType": "SalesItemLineDetail",
                        "SalesItemLineDetail": {
                            "ItemRef": { "value": s.qbo_item_id },
                            "Qty": 1
                        }
                    }))
                };

                const qboRes = await qbo.makeApiCall(accessToken, tokens.realm_id!, 'delayedcharge', 'POST', payload);

                if (qboRes.Fault) {
                    throw new Error(JSON.stringify(qboRes.Fault));
                }

                const newId = qboRes.DelayedCharge.Id;

                // Update all sessions in group
                const sessionIds = group.sessions.map(s => s.id);
                await supabase.from('sessions').update({
                    status: 'posted_to_qbo',
                    qbo_customer_id: customerId,
                    qbo_customer_name: group.customerName,
                    qbo_delayed_charge_id: newId,
                    updated_at: new Date().toISOString()
                }).in('id', sessionIds);

                results.push({
                    client: group.customerName,
                    success: true,
                    message: `Posted batch of ${group.sessions.length} sessions (ID: ${newId})`,
                    duration: group.sessions.reduce((acc, s) => acc + (s.duration_minutes_normalized || 0), 0)
                });
            }
        } catch (e: any) {
            results.push({
                client: group.customerName,
                success: false,
                message: e.message,
                duration: group.sessions.reduce((acc, s) => acc + (s.duration_minutes_normalized || 0), 0)
            });
        }
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
