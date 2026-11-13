-- Phase 11: allow owners to permanently delete an already-archived report
-- from the Bin. Scoped tightly: only rows with archived_at set (never a
-- live report) and only by the report's owner (matches reports_update's
-- existing private.report_role(id) = 'owner' check).
create policy reports_delete_archived_owner on public.reports
  for delete using (
    archived_at is not null
    and private.report_role(id) = 'owner'
  );
