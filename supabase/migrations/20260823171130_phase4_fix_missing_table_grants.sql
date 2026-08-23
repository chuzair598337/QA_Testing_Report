-- Root cause of "permission denied for table reports" (and identical
-- errors on every other table): the Phase 2 migration created these
-- tables and their RLS policies, but never explicitly GRANTed table-level
-- SELECT/INSERT/UPDATE/DELETE to `authenticated` — confirmed via
-- information_schema.role_table_grants, which showed only
-- REFERENCES/TRIGGER/TRUNCATE. Postgres denies at the grant layer before
-- RLS ever gets a chance to evaluate, hence the flat permission-denied
-- rather than an RLS-style empty result/rejection.
--
-- Not granting to `anon`: every table in this app requires an
-- authenticated session per the role model (owner/editor/viewer are all
-- rows keyed to auth.uid()) — there is no legitimate anonymous-access
-- path, so anon is left with no grant at all rather than a grant that
-- RLS would filter to nothing anyway.
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.report_members to authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.sub_modules to authenticated;
grant select, insert, update, delete on public.tests to authenticated;
grant select, insert, update, delete on public.report_uploads to authenticated;
grant select on public.report_stats to authenticated;
