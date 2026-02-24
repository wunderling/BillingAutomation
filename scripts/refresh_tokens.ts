import { createClient } from "@supabase/supabase-js";
import { QBOClient } from "../lib/qbo";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function refresh() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const qbo = new QBOClient();

    const { data: tokens } = await supabase.from('qbo_tokens').select('*').single();
    if (!tokens) throw new Error("No tokens");

    console.log("Refreshing token...");
    try {
        const result = await qbo.refreshTokens(tokens.refresh_token);

        await supabase.from('qbo_tokens').update({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            access_token_expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(),
            refresh_token_expires_at: new Date(Date.now() + result.x_refresh_token_expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
        }).eq('realm_id', tokens.realm_id);

        console.log("Token refreshed successfully.");
    } catch (e: any) {
        console.error("Refresh failed:", e.message);
    }
}
refresh();
