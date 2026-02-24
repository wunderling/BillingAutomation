-- Add new fields for v7 Zap AI extraction
alter table public.sessions
add column service_category text,
add column confidence text;
