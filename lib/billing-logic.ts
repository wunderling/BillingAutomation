import { Database } from "@/types/supabase";

export type BillingProfile = {
    id: string;
    student_name: string;
    qbo_customer_id: string | null;
    qbo_customer_name: string | null;
    base_rate_cents: number;
    travel_fee_cents: number;
    billing_emails: string[] | null;
};

export type InvoiceLineItem = {
    description: string;
    amount: number; // Unit price (rate)
    quantity: number;
    serviceCode: 'THERAPY' | 'TRAVEL'; // Internal code
    qboItemId?: string; // To be filled if known, otherwise default
};

/**
 * Calculates the line items for a given session based on the billing profile.
 * Logic:
 *  - Educational Therapy: Quantity = session_minutes / 50. Rate = profile.base_rate.
 *  - Travel Fee: Flat fee if profile.travel_fee_cents > 0.
 */
export function calculateSessionLineItems(
    session: { duration_minutes_raw: number; start_time: string; title_raw: string },
    profile: BillingProfile
): InvoiceLineItem[] {
    const lines: InvoiceLineItem[] = [];

    // 1. Educational Therapy Line
    // Duration is normalized to units of 50 minutes.
    // e.g. 50 mins -> 1.0
    // e.g. 70 mins -> 1.4
    const quantity = parseFloat((session.duration_minutes_raw / 50.0).toFixed(2));
    const baseRate = profile.base_rate_cents / 100.0;

    const dateStr = new Date(session.start_time).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

    const isConsult = session.title_raw.toLowerCase().includes('consult');
    const serviceLabel = isConsult ? 'Consult' : 'Educational Therapy';

    lines.push({
        description: `${serviceLabel}: ${session.title_raw} (${dateStr})`, // e.g. "Consult: Jeffrey Wong (10/12)"
        amount: baseRate,
        quantity: quantity,
        serviceCode: 'THERAPY'
    });

    // 2. Travel Fee Line (if applicable)
    if (profile.travel_fee_cents > 0) {
        lines.push({
            description: `Travel Fee - ${session.title_raw} (${dateStr})`,
            amount: profile.travel_fee_cents / 100.0,
            quantity: 1,
            serviceCode: 'TRAVEL'
        });
    }

    return lines;
}

export function parseStudentName(title: string): string {
    // Attempt to extract the core name.
    // Heuristic: Take everything before a " - " or ":" if present, otherwise whole string.
    // This expects tiles like "Jeffrey Wong" or "Jeffrey Wong - Math".

    let name = title;
    // Split by common separators and take the first part
    const separators = [' - ', ':'];
    for (const sep of separators) {
        if (name.includes(sep)) {
            name = name.split(sep)[0];
            break;
        }
    }

    // Also remove any trailing parentheticals e.g. "Jeffrey Wong (Online)"
    name = name.replace(/\s*\(.*?\)\s*/g, '');

    return name.trim();
}

export function normalizeDuration(
    durationMinutes: number,
    settings: { qbo_item_id_50: string; qbo_item_id_90: string }
): { normalized: number; serviceCode: 'SESSION_50' | 'SESSION_90'; qboItemId: string } {
    // Current logic: everything is prorated based on 50 mins.
    // We use SESSION_50 as the base item for therapy.
    const normalized = parseFloat((durationMinutes / 50.0).toFixed(2));

    return {
        normalized,
        serviceCode: 'SESSION_50', // We use this as the primary service code
        qboItemId: settings.qbo_item_id_50
    };
}
