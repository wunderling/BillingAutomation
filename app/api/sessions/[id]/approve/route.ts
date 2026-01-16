import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // NOTE: In production, verify Admin Auth here.
    // Middleware should handle it generally, but good to be aware.

    const { id } = await params;
    const supabase = createClient();

    // Check current status
    const { data: session } = await supabase.from('sessions').select('status').eq('id', id).single();
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.status === 'posted_to_qbo') {
        return NextResponse.json({ error: 'Cannot approve posted session' }, { status: 400 });
    }

    const { error } = await supabase
        .from('sessions')
        .update({ status: 'approved' })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
