
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    const { data, error } = await supabase
        .from('sessions')
        .select('id, student_name, start_time, status')
        .limit(5);

    if (error) {
        console.error('Error fetching sessions:', error);
    } else {
        console.log('Successfully fetched sessions:');
        console.log(JSON.stringify(data, null, 2));

        const { count, error: countError } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            console.log(`Total sessions in database: ${count}`);
        }
    }
}

testConnection();
