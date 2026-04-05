import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createRun(type: 'ingest' | 'post-approved', message: string) {
    // Using any internally to handle dynamic table typing issues in this version
    const { data, error } = await (supabase.from('runs') as any)
        .insert({
            type,
            status: 'running',
            message,
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to create log entry:", error);
        return null;
    }
    return (data as any)?.id as string;
}

export async function updateRun(id: string, status: 'ok' | 'error' | 'running', message: string, details?: any) {
    const { error } = await (supabase.from('runs') as any)
        .update({
            status,
            message,
            details,
            ended_at: status !== 'running' ? new Date().toISOString() : null,
        })
        .eq('id', id);

    if (error) {
        console.error("Failed to update log entry:", error);
    }
}
