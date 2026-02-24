import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function revertOrly() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update billing_profiles
    const { error: profileError } = await supabase
        .from('billing_profiles')
        .update({ qbo_customer_id: '422' })
        .ilike('student_name', '%Orly%');

    if (profileError) {
        console.error('Error updating billing_profiles:', profileError);
    } else {
        console.log('Successfully reverted Orly in billing_profiles back to ID 422.');
    }

    // Update any sessions associated with Orly so they also reflect 422 for future processing
    const { error: sessionError } = await supabase
        .from('sessions')
        .update({ qbo_customer_id: '422' })
        .ilike('student_name', '%Orly%');

    if (sessionError) {
        console.error('Error updating sessions:', sessionError);
    } else {
        console.log('Successfully reverted Orly sessions back to ID 422.');
    }
}

revertOrly().catch(console.error);
