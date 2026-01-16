import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { normalizeDuration, parseStudentName, shouldIngestEvent } from "@/lib/billing-logic";
import { Database } from "@/types/supabase";

// Force dynamic to prevent caching of the webhook endpoint
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-ingest-secret");
    if (secret !== process.env.INGEST_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
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

    if (!google_event_id || !title || !start_time || !end_time) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient();

    // 1. Load Settings
    const { data: settings, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .single();

    if (settingsError || !settings) {
        console.error("Settings error:", settingsError);
        return NextResponse.json({ error: "Settings not found" }, { status: 500 });
    }

    // 2. Keyword Filter
    const keywords = [settings.keyword_1, settings.keyword_2].filter(Boolean) as string[];
    if (!shouldIngestEvent(title, description, keywords)) {
        return NextResponse.json({ ignored: true, reason: "No matching keywords" });
    }

    // 3. Normalize Duration
    const { normalized, serviceCode, qboItemId } = normalizeDuration(
        Number(duration_minutes),
        {
            qbo_item_id_50: settings.qbo_item_id_50,
            qbo_item_id_90: settings.qbo_item_id_90,
        }
    );

    let status: Database['public']['Tables']['sessions']['Row']['status'] = 'pending_review';
    if (!normalized) {
        status = 'needs_review_duration';
    }

    // 4. Parse Student Name
    const studentName = parseStudentName(title, keywords);

    // 5. Upsert
    // Check if exists
    const { data: existing } = await supabase
        .from("sessions")
        .select("*")
        .eq("google_event_id", google_event_id)
        .single();

    if (existing?.status === "posted_to_qbo") {
        return NextResponse.json({
            ok: true,
            updated: false,
            reason: "Already posted to QBO",
        });
    }

    const payload: any = {
        google_event_id,
        google_calendar_id,
        title_raw: title,
        description_raw: description,
        student_name: studentName,
        start_time,
        end_time,
        duration_minutes_raw: Number(duration_minutes),
        duration_minutes_normalized: normalized,
        service_code: serviceCode,
        qbo_item_id: qboItemId,
        status: existing ? existing.status : status, // keep existing status if valid? OR reset? User asked to "update fields but DO NOT overwrite if status already posted_to_qbo"
        // logic: "if exists: update fields". Usually we might want to re-eval status if duration changed?
        // Let's adopt a safe approach: update critical fields. If it was 'needs_review_duration' and now valid, good.
        // If it was 'approved', maybe we shouldn't revert to 'pending_review' unless substantial change?
        // For MVp, let's just reset status if it hasn't been posted.
        updated_at: new Date().toISOString(),
        source: 'zapier'
    };

    // If we are updating, and the existing status is NOT pending/error/needs_review, we should probably be careful. 
    // But requirement says: "if exists: update fields but DO NOT overwrite if status already posted_to_qbo"
    // It doesn't explicitly say "preserve approval". Safest is to reset to computed status to ensure correctness of billing.
    if (existing) {
        if (existing.status !== 'posted_to_qbo') {
            payload.status = status; // Reset status based on new data
        } else {
            // Should not happen due to check above, but for types sake
            delete payload.status;
        }
    } else {
        payload.status = status;
    }

    const { error: upsertError } = await supabase
        .from("sessions")
        .upsert(payload, { onConflict: 'google_event_id' });

    if (upsertError) {
        console.error("Upsert error:", upsertError);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: !existing, status });
}
