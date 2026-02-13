export interface ParsedProfile {
    studentName: string;
    parentNames: string;
    baseRateCents: number;
    travelFeeCents: number;
    billingEmails: string[];
    rawRow: any;
}

export function parseRateString(rateStr: string): { baseRateCents: number; travelFeeCents: number } {
    let baseRateCents = 0;
    let travelFeeCents = 0;

    if (!rateStr) return { baseRateCents, travelFeeCents };

    // Clean string
    const cleanStr = rateStr.toLowerCase().replace(/\$/g, '');

    // 1. Extract Base Rate
    // Look for the first number. Usually "200 ..." or "180"
    // Regex: Start of string or space, followed by digits
    const baseMatch = cleanStr.match(/^(\d+)|^\D*(\d+)/);
    if (baseMatch) {
        const val = parseInt(baseMatch[1] || baseMatch[2], 10);
        // Sanity check: rate is likely between 50 and 500 dollars
        if (val > 0 && val < 1000) {
            baseRateCents = val * 100;
        }
    }

    // 2. Extract Travel Fee
    // Look for "travel fee" followed by a number
    if (cleanStr.includes('travel fee')) {
        const feeMatch = cleanStr.match(/travel fee.*?(\d+)/);
        if (feeMatch) {
            const val = parseInt(feeMatch[1], 10);
            if (val > 0 && val < 500) {
                travelFeeCents = val * 100;
            }
        }
    }

    return { baseRateCents, travelFeeCents };
}

export function parseEmails(emailStr: string): string[] {
    if (!emailStr) return [];
    // Match simple email pattern
    const matches = emailStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
    return matches ? Array.from(new Set(matches)) : []; // Dedupe
}

export function parseExcelRow(row: any): ParsedProfile | null {
    const studentName = row['Student']?.trim();
    if (!studentName) return null;

    const rateStr = String(row['Rate of 50 min ses'] || '');
    const { baseRateCents, travelFeeCents } = parseRateString(rateStr);

    const emailStr = String(row['Invoice Email'] || '');
    const billingEmails = parseEmails(emailStr);

    return {
        studentName,
        parentNames: row['Parent/Payor']?.trim() || '',
        baseRateCents,
        travelFeeCents,
        billingEmails,
        rawRow: row
    };
}
