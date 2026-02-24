-- 003_cleanup_and_optimize.sql

-- 1. Drop the orphaned foreign key and `client_id` column from `sessions`.
-- The `billing_profiles` table is the new source of truth for client data.
alter table public.sessions
drop column if exists client_id cascade;

-- 2. Drop the unused `clients` table entirely.
drop table if exists public.clients cascade;

-- 3. Add an index to `student_name` on `sessions` to optimize the 
-- Zapier AI entity-matching workflow lookups and joins.
create index if not exists idx_sessions_student_name on public.sessions(student_name);

-- 4. Ensure an index exists on `billing_profiles(student_name)`
-- Note: The audit report noted a UNIQUE constraint, which automatically 
-- creates an index, but we ensure it here for completeness if needed.
-- create unique index if not exists idx_billing_profiles_student_name on public.billing_profiles(student_name);
