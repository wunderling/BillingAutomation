
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { parseExcelRow } from '../lib/profile-parser'; // Assuming relative import works with tsx

// Load env vars from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function runImport() {
    console.log("Loading environment from", envPath);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const filePath = path.join(process.cwd(), 'Student Names + Client Billing Account Information Data Table.xlsx');
    console.log("Reading Excel from", filePath);

    if (!fs.existsSync(filePath)) {
        console.error("File not found");
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${rows.length} rows. Parsing...`);

    const profiles = rows
        .map(row => parseExcelRow(row))
        .filter(p => p !== null && p.studentName.length > 0);

    console.log(`Parsed ${profiles.length} valid profiles.`);

    let inserted = 0;
    let errors = 0;

    for (const p of profiles) {
        if (!p) continue;
        const { error } = await supabase
            .from('billing_profiles')
            .upsert({
                student_name: p.studentName,
                billing_emails: p.billingEmails,
                base_rate_cents: p.baseRateCents,
                travel_fee_cents: p.travelFeeCents,
                original_excel_row: p.rawRow
            }, { onConflict: 'student_name' });

        if (error) {
            console.error(`Error upserting ${p.studentName}:`, error.message);
            errors++;
        } else {
            inserted++;
        }
    }

    console.log(`Done. Inserted/Updated: ${inserted}, Errors: ${errors}`);
}

runImport().catch(console.error);
