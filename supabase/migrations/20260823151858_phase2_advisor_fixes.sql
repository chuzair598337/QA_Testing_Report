-- Fixes from get_advisors after phase2_schema_rls_storage:
-- 1. merge report_members' two permissive INSERT policies into one
-- 2. wrap bare auth.uid() in (select auth.uid()) for per-statement eval
-- 3. add missing FK-covering indexes

drop policy report_members_insert_owner on public.report_members;
drop policy report_members_insert_bootstrap on public.report_members;

create policy report_members_insert on public.report_members
  for insert with check (
    private.report_role(report_id) = 'owner'
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.reports r
        where r.id = report_id and r.created_by = (select auth.uid())
      )
    )
  );

drop policy reports_select on public.reports;
create policy reports_select on public.reports
  for select using (private.is_report_member(id) or created_by = (select auth.uid()));

drop policy reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (created_by = (select auth.uid()));

create index idx_reports_created_by on public.reports(created_by);
create index idx_tests_updated_by on public.tests(updated_by);
create index idx_report_uploads_uploaded_by on public.report_uploads(uploaded_by);
