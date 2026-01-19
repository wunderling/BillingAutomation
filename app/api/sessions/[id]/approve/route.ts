import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Use Service Role for robust admin updates
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
