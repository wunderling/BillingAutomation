export type DurationResult =
    | { normalized: 50; serviceCode: 'SESSION_50'; qboItemId: string }
    | { normalized: 90; serviceCode: 'SESSION_90'; qboItemId: string }
    | { normalized: null; serviceCode: null; qboItemId: null };

export function normalizeDuration(
    durationMinutes: number,
    settings: { qbo_item_id_50: string; qbo_item_id_90: string }
): DurationResult {
    if (durationMinutes >= 45 && durationMinutes <= 55) {
        return {
            normalized: 50,
            serviceCode: 'SESSION_50',
            qboItemId: settings.qbo_item_id_50,
        };
    }
    if (durationMinutes >= 85 && durationMinutes <= 95) {
        return {
            normalized: 90,
            serviceCode: 'SESSION_90',
            qboItemId: settings.qbo_item_id_90,
        };
    }
    return { normalized: null, serviceCode: null, qboItemId: null };
}

export function shouldIngestEvent(
    title: string,
    description: string | null,
    keywords: string[]
): boolean {
    const textToCheck = ((title || "") + " " + (description || "")).toLowerCase();
    return keywords.some((kw) => textToCheck.includes(kw.toLowerCase()));
}

export function parseStudentName(title: string, keywords: string[]): string {
    let name = title;

    // Remove keywords (case insensitive)
    keywords.forEach(kw => {
        const regex = new RegExp(kw, 'gi');
        name = name.replace(regex, '');
    });

    // Remove separators like "-" or ":"
    name = name.replace(/[-:]/g, ' ');

    // Trim whitespace
    return name.replace(/\s+/g, ' ').trim();
}
