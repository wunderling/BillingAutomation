# Tutoring Billing Automation

Private MVP application to automate billing from Google Calendar to QuickBooks Online.

## Features
- **Ingest**: Webhook listener for Google Calendar events via Zapier.
- **Normalize**: Prorates duration from the raw meeting length (no rounding).
- **Review**: Admin dashboard to approve/reject sessions.
- **Sync**: Posts approved sessions to QuickBooks Online as Delayed Charges.
- **Secure**: Single-tenant admin access via Supabase Magic Link + Middleware.

## Setup Instructions

### 1. Environment Variables
Copy `.env.local` and fill in the values:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

ADMIN_EMAIL=your-email@example.com
INGEST_SECRET=generate-random-secret-here

# QBO Keys (See Intuit Developer Portal)
QBO_CLIENT_ID=...
QBO_CLIENT_SECRET=...
QBO_REDIRECT_URI=...
QBO_ENVIRONMENT=sandbox # or production
```

### 2. Database Setup
Run the SQL in `supabase/migrations/001_init.sql` in your Supabase SQL Editor.
Run `supabase/seed.sql` to initialize settings.

### 3. Zapier Setup (Crucial - v7 Workflow)
This automation relies on a 3-step Zapier workflow featuring an AI extraction step.

1. **Trigger**: Google Calendar - "Event Ends"
   - Connect your calendar account.
   - Choose the Calendar ID you use for tutoring.
2. **Step 2 (AI Processing)**: AI by Zapier - "Analyze and Return Data"
   - **Model**: Gemini 2.0 Flash
   - **Prompt**: Provide a strict system prompt containing your student-parent mapping logic.
   - **Input Fields**: Map `user_message` to "Summary" and `event_description` to "Description" from Step 1.
   - **Outputs**: Tell the AI to output exactly 3 JSON fields: `student_name` (string | null), `service_category` (string enum), and `confidence` (string enum).
3. **Action**: Webhooks by Zapier - POST
   - **URL**: `https://<your-deployed-domain>/api/ingest`
   - **Payload Type**: JSON
   - **Data**:
     - `google_event_id`: `{{Event ID}}`
     - `google_calendar_id`: `{{Calendar ID}}`
     - `title`: `{{Summary}}`
     - `description`: `{{Description}}`
     - `start_time`: `{{Event Begins}}` (ISO format)
     - `end_time`: `{{Event Ends}}` (ISO format)
     - `duration_minutes`: `{{Duration Minutes}}`
     - `source_url`: `{{Html Link}}`
     - `zap_student_name`: `{{Student Name}}` (from AI output)
     - `service_category`: `{{Service Category}}` (from AI output)
     - `confidence`: `{{Confidence}}` (from AI output)
   - **Headers**:
     - `x-ingest-secret`: `<YOUR_INGEST_SECRET>`

### 4. QuickBooks Setup
1. Create an App in Intuit Developer Portal.
2. Get Client ID/Secret.
3. Add Redirect URI: `https://<your-domain>/api/auth/callback` (Not fully implemented in MVP, simpler to just get tokens via OAuth Playground and insert into `qbo_tokens` table for v1).
4. Get your Item IDs (Service IDs) from QBO for the 50m and 90m services.
5. Enter these Item IDs in the `/settings` page of the app.

## Running Locally
```bash
npm install
npm run dev
```

## Go-Live Pre-Flight Checklist (Critical Manual Steps)
Before turning your Zapier v7 workflow ON for production sessions, you **must complete these manual data steps** to ensure the backend can communicate with QuickBooks Online:

- [ ] **Generate QBO Tokens**: Run the Intuit Developer OAuth flow and manually insert your `access_token` and `refresh_token` into the `qbo_tokens` table.
- [ ] **Update Application Settings**: Retrieve your actual QuickBooks Online Service Item IDs for your sessions and paste them into the `qbo_item_id_50` and `qbo_item_id_90` fields in the `settings` table (replacing `PLACEHOLDER_50`/`90`).
- [ ] **Link Billing Profiles**: Map your active `billing_profiles` to their correct QBO Customer IDs. (Currently, the system uses AI to map calendar names to profiles, but needs the `qbo_customer_id` stored on the profile to invoice them).
- [ ] Run all migrations on Production (`001_init.sql`, `002_add_zap_v7_fields.sql`, `003_cleanup_and_optimize.sql`).
- [ ] Deploy Application to Vercel.
- [ ] Configure Zapier Webhook URL to point to the Prod domain `/api/ingest`.
- [ ] Test one end-to-end flow with a fake calendar event.
