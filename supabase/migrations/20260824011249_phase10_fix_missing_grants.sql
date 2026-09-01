-- RLS restricts what a GRANT already allows — it does not substitute for one.
-- public.profiles (20260824005511_phase10_profiles.sql) and
-- public.report_invites (20260824010423_phase10_report_invites.sql) both shipped with
-- row-level security policies but NO GRANTs to the `authenticated` role. Postgres
-- evaluates GRANT before RLS, so every query from the app (as `authenticated`) failed
-- with "permission denied" despite correct RLS policies.
--
-- profiles gets SELECT only — the table is deliberately write-only-via-trigger:
-- insert/update/delete are prevented by the brief spec ("No insert/update/delete
-- policies for anon/authenticated — profiles rows are only ever written by the
-- SECURITY DEFINER triggers").
--
-- report_invites gets SELECT/INSERT/UPDATE, matching its three RLS policies
-- (report_invites_select, report_invites_insert, report_invites_update).
-- No delete policy exists, so no delete grant.
--
-- Same bug class this repo hit in phase4:
-- see 20260823171130_phase4_fix_missing_table_grants.sql

grant select on public.profiles to authenticated;
grant select, insert, update on public.report_invites to authenticated;
