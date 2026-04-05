-- 004_drop_client_mapping_tables.sql
-- We are moving to a live QBO-only architecture.
-- Drop all local tables meant to store or map QuickBooks clients.

drop table if exists public.billing_profiles cascade;
drop table if exists public.customer_aliases cascade;
