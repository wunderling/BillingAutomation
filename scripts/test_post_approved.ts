import { createClient } from "@supabase/supabase-js";
import { QBOClient } from "../lib/qbo";
import { calculateSessionLineItems, parseStudentName, BillingProfile } from "../lib/billing-logic";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const qbo = new QBOClient();

    const { data: tokens } = await supabase.from('qbo_tokens').select('*').single();
    const accessToken = tokens.access_token;
    const realmId = tokens.realm_id;

    const { data: settings } = await supabase.from('settings').select('*').single();
    const defaultTherapyItemId = settings?.qbo_item_id_50 || '1';
    const defaultTravelItemId = settings?.qbo_item_id_90 || '2';

    const itemsQuery = `select * from Item maxresults 1000`;
    const itemsResult = await qbo.makeApiCall(accessToken, realmId, `query?query=${encodeURIComponent(itemsQuery)}`);
    const qboItems = itemsResult.QueryResponse?.Item || [];

    const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'approved')
        .is('qbo_delayed_charge_id', null)
        .order('start_time', { ascending: true });

    if (!sessions || sessions.length === 0) {
        console.log("No approved sessions to post");
        return;
    }

    const { data: profilesData } = await supabase.from('billing_profiles').select('*');
    const profileMap = new Map<string, BillingProfile>();
    if (profilesData) {
        for (const p of profilesData) {
            profileMap.set(p.student_name.toLowerCase(), p);
        }
    }

    const groups: Record<string, { profile: BillingProfile | undefined, sessions: any[] }> = {};
    for (const session of sessions) {
        const studentName = session.student_name || parseStudentName(session.title_raw);
        const profile = profileMap.get(studentName.toLowerCase());
        const customerId = profile?.qbo_customer_id || session.qbo_customer_id;

        if (!groups[customerId]) groups[customerId] = { profile, sessions: [] };
        groups[customerId].sessions.push(session);
    }

    for (const [customerId, group] of Object.entries(groups)) {
        try {
            const qboLines = [];
            for (const session of group.sessions) {
                const lines = calculateSessionLineItems(session, group.profile!);
                for (const line of lines) {
                    let itemId = line.serviceCode === 'TRAVEL' ? defaultTravelItemId : defaultTherapyItemId;
                    if (line.serviceCode === 'THERAPY') {
                        const targetName = `Educational Therapy ${line.amount}`;
                        const matchedItem = qboItems.find((i: any) => i.Name === targetName);
                        if (matchedItem) itemId = matchedItem.Id;
                    } else if (line.serviceCode === 'TRAVEL') {
                        const targetName = `Travel ${line.amount}`;
                        const matchedItem = qboItems.find((i: any) => i.Name === targetName);
                        if (matchedItem) itemId = matchedItem.Id;
                    }
                    console.log('Line Item Match:', line.amount, itemId);
                    qboLines.push({
                        "Description": line.description,
                        "Amount": line.amount * line.quantity,
                        "DetailType": "SalesItemLineDetail",
                        "SalesItemLineDetail": {
                            "ItemRef": { "value": itemId },
                            "Qty": line.quantity,
                            "UnitPrice": line.amount
                        }
                    });
                }
            }
            const invoicePayload = {
                "CustomerRef": { "value": customerId },
                "BillEmail": { "Address": group.profile?.billing_emails?.[0] || "" },
                "TxnDate": new Date().toISOString().split('T')[0],
                "Line": qboLines
            };
            const qboRes = await qbo.makeApiCall(accessToken, realmId, 'invoice', 'POST', invoicePayload);
            if (qboRes.Fault) {
                console.error("QBO FAULT:", JSON.stringify(qboRes.Fault, null, 2));
                throw new Error(JSON.stringify(qboRes.Fault));
            }
            console.log("SUCCESS INVOICE:", qboRes.Invoice.Id);
        } catch (e: any) {
            console.error("ERROR POSTING:", e.message);
        }
    }
}
run();
