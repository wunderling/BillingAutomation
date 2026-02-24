import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await req.json();
    const { student_name, notes, status } = body;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: session } = await supabase.from('sessions').select('status').eq('id', id).single();
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.status === 'posted_to_qbo') {
        return NextResponse.json({ error: 'Cannot update posted session' }, { status: 400 });
    }

    const updates: any = {};
    if (student_name !== undefined) updates.student_name = student_name;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
        if (status === 'posted_to_qbo') return NextResponse.json({ error: 'Cannot manually set to posted' }, { status: 400 });
        updates.status = status;
    }

    const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
