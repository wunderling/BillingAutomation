-- Add billing_units to sessions to store prorated units (e.g., 90m => 1.8)
alter table public.sessions
  add column if not exists billing_units numeric;

-- Backfill from raw minutes if needed
update public.sessions
set billing_units = round(duration_minutes_raw / 50.0, 4)
where billing_units is null;
