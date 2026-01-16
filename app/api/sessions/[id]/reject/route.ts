import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = createClient();

    const { error } = await supabase
        .from('sessions')
        .update({ status: 'rejected' })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
