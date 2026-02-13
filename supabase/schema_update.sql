-- Create billing_profiles table
create table if not exists public.billing_profiles (
  id uuid default gen_random_uuid() primary key,
  student_name text not null, -- Normalized student name from Google Calendar/Session
  qbo_customer_id text,
  qbo_customer_name text,
  base_rate_cents integer default 0,
  travel_fee_cents integer default 0,
  billing_emails text[],
  original_excel_row jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_name)
);

-- Enable RLS
alter table public.billing_profiles enable row level security;

-- Create policy for full access to authenticated users (assuming internal tool)
create policy "Enable all for authenticated users" on public.billing_profiles
    for all using (auth.role() = 'authenticated');

-- Also allow service role full access (default, but good to be explicit if needed)
-- (Service role bypasses RLS usually, but just in case)
