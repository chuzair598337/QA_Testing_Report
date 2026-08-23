-- Same class of bug as phase4_fix_missing_table_grants, one role deeper:
-- `service_role` had zero SELECT/INSERT/UPDATE/DELETE grants either
-- (confirmed via information_schema.role_table_grants — only
-- REFERENCES/TRIGGER/TRUNCATE, matching what anon/authenticated had before
-- the earlier fix). service_role's BYPASSRLS attribute skips RLS policy
-- evaluation, but it does NOT skip ordinary object-privilege checks — it
-- still needs an explicit GRANT to touch these tables at all. This is what
-- the invite-member Edge Function's admin client was hitting on its
-- report_members insert ("permission denied for table report_members").
grant select, insert, update, delete on public.reports to service_role;
grant select, insert, update, delete on public.report_members to service_role;
grant select, insert, update, delete on public.modules to service_role;
grant select, insert, update, delete on public.sub_modules to service_role;
grant select, insert, update, delete on public.tests to service_role;
grant select, insert, update, delete on public.report_uploads to service_role;
grant select on public.report_stats to service_role;
