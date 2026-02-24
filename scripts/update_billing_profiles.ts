import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
    const fileContent = fs.readFileSync('/Users/ruthiewunderlingbabyblue2026/Downloads/Student_Parent Static Database 02_23_26 - Sheet1.csv', 'utf-8')

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    console.log(`Found ${records.length} records in CSV.`)

    for (const record of records) {
        const studentName = record['Student']?.trim()
        const qboCustomerId = record['Customer ID']?.trim()
        const qboCustomerName = record['Customer Name/Names']?.trim()

        if (!studentName || !qboCustomerId) continue;

        console.log(`Processing student: ${studentName}`)

        // Check if student exists in billing_profiles
        const { data: profiles, error: fetchError } = await supabase
            .from('billing_profiles')
            .select('*')
            .ilike('student_name', `%${studentName}%`)

        if (fetchError) {
            console.error(`Error fetching profile for ${studentName}:`, fetchError)
            continue;
        }

        if (!profiles || profiles.length === 0) {
            console.warn(`[WARNING] Student not found in billing_profiles: ${studentName}`)
            continue;
        }

        // if multiple, take the first one or exact match
        let profile = profiles.find(p => p.student_name.toLowerCase() === studentName.toLowerCase()) || profiles[0];

        // Update the profile
        const { error: updateError } = await supabase
            .from('billing_profiles')
            .update({
                qbo_customer_id: qboCustomerId,
                qbo_customer_name: qboCustomerName,
            })
            .eq('id', profile.id)

        if (updateError) {
            console.error(`Error updating profile for ${studentName}:`, updateError)
        } else {
            console.log(`[SUCCESS] Updated QBO Info for ${profile.student_name} -> ID: ${qboCustomerId}`)
        }
    }

    console.log('Finished updating billing profiles.')
}

run().catch(console.error)
