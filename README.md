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

### 3. Zapier Setup (Crucial)
1. **Trigger**: Google Calendar - "Event Ends"
   - Connect your calendar account.
   - Choose the Calendar ID you use for tutoring.
2. **Filter**: Only continue if...
   - `Summary` contains "Tutoring" OR `Description` contains "Tutoring" (or your keywords).
3. **Formatter** (Optional but recommended): Numbers -> Spreadsheet Formula
   - Calculate duration in minutes if not provided directly. Usually `(End - Start) * 1440` if strictly needed, but `duration_minutes` might just be passed as difference.
   - *Better*: Just pass Start and End time to the API, and calculate duration in the API? The API expects `duration_minutes` in the payload. Zapier can subtract dates.
   - *Formula*: `(Date(End) - Date(Start)) * 24 * 60`
4. **Action**: Webhooks by Zapier - POST
   - **URL**: `https://<your-deployed-domain>/api/ingest`
   - **Payload Type**: JSON
   - **Data**:
     - `google_event_id`: `{{Event ID}}`
     - `google_calendar_id`: `{{Calendar ID}}`
     - `title`: `{{Summary}}`
     - `description`: `{{Description}}`
     - `start_time`: `{{Event Begins}}` (ISO format)
     - `end_time`: `{{Event Ends}}` (ISO format)
     - `duration_minutes`: `{{Duration Minutes}}` (If available, or formatted value)
     - `source_url`: `{{Html Link}}`
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

## Go-Live Checklist
- [ ] Deploy to Vercel.
- [ ] Set Environment Variables in Vercel.
- [ ] Run Migration on Prod Supabase.
- [ ] Configure Zapier Webhook URL to Prod.
- [ ] Test one flow end-to-end.
