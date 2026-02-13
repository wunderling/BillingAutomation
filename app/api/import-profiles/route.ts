import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from 'xlsx';
import { parseExcelRow } from "@/lib/profile-parser";
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // In a real app we might allow file upload, but here we read the known file on disk
        // as the user mentioned it's a valuable resource.
        const filePath = path.join(process.cwd(), 'Student Names + Client Billing Account Information Data Table.xlsx');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: "Source Excel file not found on server" }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const profiles = rows
            .map(row => parseExcelRow(row))
            .filter(p => p !== null && p.studentName.length > 0);

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const results = {
            processed: 0,
            inserted: 0,
            errors: [] as string[]
        };

        for (const p of profiles) {
            if (!p) continue;
            results.processed++;

            // Upsert based on student_name
            const { error } = await supabase
                .from('billing_profiles')
                .upsert({
                    student_name: p.studentName,
                    billing_emails: p.billingEmails,
                    base_rate_cents: p.baseRateCents,
                    travel_fee_cents: p.travelFeeCents,
                    original_excel_row: p.rawRow
                    // We don't overwrite QBO IDs if they already exist, but for initial load
                    // we might not have them.
                    // Actually, 'upsert' overwrites everything unless we specify.
                    // For now, full overwrite is safer to ensure source-of-truth sync.
                }, { onConflict: 'student_name' });

            if (error) {
                results.errors.push(`Failed to upsert ${p.studentName}: ${error.message}`);
                console.error(error);
            } else {
                results.inserted++;
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
