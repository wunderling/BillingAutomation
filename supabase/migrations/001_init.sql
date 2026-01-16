-- Enable pgcrypto for UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Sessions Table
-- -----------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  google_event_id text unique not null,
  google_calendar_id text,
  title_raw text not null,
  description_raw text,
  student_name text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes_raw int not null,
  duration_minutes_normalized int,
  service_code text, -- "SESSION_50" | "SESSION_90"
  status text not null default 'pending_review', 
  -- Allowed statuses: 'pending_review', 'approved', 'rejected', 'needs_review_duration', 'unmatched_customer', 'posted_to_qbo', 'error'
  qbo_customer_id text,
  qbo_customer_name text,
  qbo_item_id text,
  qbo_delayed_charge_id text,
  source text not null default 'zapier',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_sessions_status on public.sessions(status);
create index idx_sessions_start_time on public.sessions(start_time);

-- -----------------------------------------------------------------------------
-- 2. Customer Aliases Table
-- -----------------------------------------------------------------------------
create table public.customer_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text unique not null,
  qbo_customer_id text not null,
  qbo_customer_name text not null,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 3. Settings Table (Singleton)
-- -----------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1), -- Force single row
  keyword_1 text default 'Tutoring',
  keyword_2 text default 'Session',
  qbo_item_id_50 text not null,
  qbo_item_id_90 text not null,
  timezone text default 'America/Los_Angeles',
  weekly_post_day int default 1, -- Monday
  weekly_post_hour int default 6,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 4. Runs Table (Logs)
-- -----------------------------------------------------------------------------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  type text, -- 'ingest' | 'post'
  status text, -- 'ok' | 'error'
  started_at timestamptz default now(),
  ended_at timestamptz,
  message text,
  details jsonb
);

-- -----------------------------------------------------------------------------
-- 5. QBO Tokens Table (MVP Security)
-- -----------------------------------------------------------------------------
create table public.qbo_tokens (
  id int primary key default 1 check (id = 1),
  realm_id text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  updated_at timestamptz default now()
);

-- Row Level Security (RLS)
-- We'll enable RLS to ensure these tables are only accessible via server-side service key OR specific policies if we add client-side logic.
-- For this MVP using Next.js Server Actions, we will primarily use the SERVICE_ROLE_KEY or authenticated user checks.

alter table public.sessions enable row level security;
alter table public.customer_aliases enable row level security;
alter table public.settings enable row level security;
alter table public.runs enable row level security;
alter table public.qbo_tokens enable row level security;

-- Policy: Admin only access (Assumes Supabase Auth is set up and we check emails)
-- For MVP with server-side logic, we might just bypass RLS with service role, 
-- but let's add a basic "allow all for authenticated" policy for the dashboard 
-- if we rely on the `authenticated` role.
-- Ideally, we'd check `auth.email() = 'admin@example.com'`.

create policy "Allow full access to admin" on public.sessions
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Allow full access to admin" on public.customer_aliases
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Allow full access to admin" on public.settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Allow full access to admin" on public.runs
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- QBO Tokens: HIGHLY SENSITIVE. Only allow server (service role) or specific admin.
create policy "Allow full access to admin" on public.qbo_tokens
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
