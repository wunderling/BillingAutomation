import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { normalizeDuration, parseStudentName, shouldIngestEvent } from "@/lib/billing-logic";
import { Database } from "@/types/supabase";

// Force dynamic to prevent caching of the webhook endpoint
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-ingest-secret");
    if (secret !== process.env.INGEST_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
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
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient();

    // 1. Load Settings
    const { data: settings, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .single();

    if (settingsError || !settings) {
        console.error("Settings error:", settingsError);
        return NextResponse.json({ success: false, error: "Settings not found" }, { status: 500 });
    }

    // 2. Keyword Filter
    const keywords = [settings.keyword_1, settings.keyword_2].filter(Boolean) as string[];
    // Return 200 with success=true even if ignored? User req says "200 OK with success message".
    // I'll return success=true but note it was ignored.
    if (!shouldIngestEvent(title, description, keywords)) {
        return NextResponse.json({ success: true, message: "Ignored: No matching keywords", ignored: true });
    }

    // 3. Logic: Dates & Duration
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

    // 4. Normalize
    const { normalized, serviceCode, qboItemId } = normalizeDuration(
        duration,
        {
            qbo_item_id_50: settings.qbo_item_id_50,
            qbo_item_id_90: settings.qbo_item_id_90,
        }
    );

    let status: Database['public']['Tables']['sessions']['Row']['status'] = 'pending_review';
    if (!normalized) {
        status = 'needs_review_duration';
    }

    // 5. Parse Student Name
    const studentName = parseStudentName(title, keywords);

    // 6. Upsert
    const { data: existing } = await supabase
        .from("sessions")
        .select("*")
        .eq("google_event_id", google_event_id)
        .single();

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
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes_raw: duration,
        duration_minutes_normalized: normalized,
        service_code: serviceCode,
        qbo_item_id: qboItemId,
        updated_at: new Date().toISOString(),
        source: 'zapier'
    };

    if (source_url) {
        payload.notes = payload.notes ? `${payload.notes}\n${source_url}` : source_url;
    }

    if (existing) {
        if (existing.status !== 'posted_to_qbo') {
            payload.status = status;
        } else {
            delete payload.status;
        }
    } else {
        payload.status = status;
    }

    const { data: upserted, error: upsertError } = await supabase
        .from("sessions")
        .upsert(payload, { onConflict: 'google_event_id' })
        .select()
        .single();

    if (upsertError) {
        console.error("Upsert error:", upsertError);
        return NextResponse.json({ success: false, error: "Database error: " + upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: existing ? "Session updated" : "Session ingested successfully",
        session_id: upserted.id
    });
}
