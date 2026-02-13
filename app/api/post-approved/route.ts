import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { QBOClient } from "@/lib/qbo";
import { calculateSessionLineItems, parseStudentName, BillingProfile } from "@/lib/billing-logic";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") === "true";

    // Service Role Client
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const qbo = new QBOClient();

    // 1. Get QBO Tokens
    const { data: tokens } = await supabase.from('qbo_tokens').select('*').single();
    if (!tokens || !tokens.access_token || !tokens.realm_id) {
        return NextResponse.json({ error: "QBO not connected" }, { status: 400 });
    }
    const accessToken = tokens.access_token;
    const realmId = tokens.realm_id;

    // 2. Load Settings (for Default Item IDs)
    const { data: settings } = await supabase.from('settings').select('*').single();
    const defaultTherapyItemId = settings?.qbo_item_id_50 || '1'; // Fallback to '1' (usually Hours/Services)
    const defaultTravelItemId = settings?.qbo_item_id_90 || '2'; // Using '90' field as Travel placeholder for now

    // 3. Load Approved Sessions
    const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'approved')
        .is('qbo_delayed_charge_id', null) // We still use this col to track "posted" status even if it's an Invoice ID now
        .order('start_time', { ascending: true });

    if (!sessions || sessions.length === 0) {
        return NextResponse.json({ message: "No approved sessions to post", dryRun, results: [] });
    }

    // 4. Load Billing Profiles
    const { data: profilesData } = await supabase
        .from('billing_profiles')
        .select('*');

    // Map Student Name -> Profile
    const profileMap = new Map<string, BillingProfile>();
    if (profilesData) {
        for (const p of profilesData) {
            // Store by lower case for looser matching
            profileMap.set(p.student_name.toLowerCase(), p);
        }
    }

    // 5. Group Sessions by Billing Entity (QBO Customer)
    const results = [];
    const groups: Record<string, {
        customerName: string,
        profile: BillingProfile,
        sessions: typeof sessions
    }> = {};

    const unmatchedSessions = [];

    for (const session of sessions) {
        // Resolve Profile
        const studentName = session.student_name || parseStudentName(session.title_raw);
        const profile = profileMap.get(studentName.toLowerCase());

        if (!profile) {
            unmatchedSessions.push({ ...session, reason: 'No Billing Profile found' });
            if (!dryRun) {
                await supabase.from('sessions').update({ status: 'unmatched_client' }).eq('id', session.id);
            }
            results.push({
                sessionId: session.id,
                client: studentName,
                success: false,
                message: "No Billing Profile found in database. Import profiles first."
            });
            continue;
        }

        // We need a QBO Customer ID to invoice.
        // If the profile doesn't have one, we can't invoice yet.
        const customerId = profile.qbo_customer_id || session.qbo_customer_id; // Fallback to session if manually matched previously

        if (!customerId) {
            unmatchedSessions.push({ ...session, reason: 'Profile validation', profile });
            results.push({
                sessionId: session.id,
                client: studentName,
                success: false,
                message: `Billing Profile exists but missing QBO Customer ID. Please link '${studentName}' to a QBO Customer.`
            });
            continue;
        }

        if (!groups[customerId]) {
            groups[customerId] = {
                customerName: profile.qbo_customer_name || 'Unknown',
                profile,
                sessions: []
            };
        }
        groups[customerId].sessions.push(session);
    }

    // 6. Generate Invoices
    for (const [customerId, group] of Object.entries(groups)) {
        try {
            // Calculate Lines
            const qboLines = [];
            let totalAmount = 0;

            for (const session of group.sessions) {
                const lines = calculateSessionLineItems(session, group.profile);

                for (const line of lines) {
                    const itemId = line.serviceCode === 'TRAVEL' ? defaultTravelItemId : defaultTherapyItemId;

                    qboLines.push({
                        "Description": line.description,
                        "Amount": line.amount * line.quantity, // QBO API: Line Amount is Total (Rate * Qty)
                        "DetailType": "SalesItemLineDetail",
                        "SalesItemLineDetail": {
                            "ItemRef": { "value": itemId },
                            "Qty": line.quantity,
                            "UnitPrice": line.amount
                        }
                    });
                    totalAmount += (line.amount * line.quantity);
                }
            }

            if (dryRun) {
                results.push({
                    client: group.profile.student_name,
                    success: true,
                    message: `Would create Invoice for $${totalAmount.toFixed(2)} (${group.sessions.length} sessions). Emailed to: ${group.profile.billing_emails?.join(', ')}`
                });
            } else {
                // Construct QBO Invoice
                const invoicePayload = {
                    "CustomerRef": { "value": customerId },
                    "BillEmail": { "Address": group.profile.billing_emails?.[0] || "" }, // Primary email
                    // "BillEmailCc": ... QBO API might handle CC differently or in specific fields
                    "TxnDate": new Date().toISOString().split('T')[0],
                    "Line": qboLines
                };

                const qboRes = await qbo.makeApiCall(accessToken, realmId, 'invoice', 'POST', invoicePayload);
                if (qboRes.Fault) {
                    throw new Error(JSON.stringify(qboRes.Fault));
                }

                const invoiceId = qboRes.Invoice.Id;

                // Update Sessions
                const sessionIds = group.sessions.map(s => s.id);
                await supabase.from('sessions').update({
                    status: 'posted_to_qbo',
                    qbo_customer_id: customerId,
                    qbo_customer_name: group.profile.qbo_customer_name,
                    qbo_delayed_charge_id: invoiceId, // Storing Invoice ID here for now
                    updated_at: new Date().toISOString()
                }).in('id', sessionIds);

                results.push({
                    client: group.profile.student_name,
                    success: true,
                    message: `Created Invoice #${qboRes.Invoice.DocNumber || invoiceId} for $${totalAmount.toFixed(2)}`
                });
            }

        } catch (e: any) {
            console.error(e);
            results.push({
                client: group.profile.student_name,
                success: false,
                message: `Invoice Error: ${e.message}`
            });
        }
    }

    return NextResponse.json({ dryRun, results });
}
