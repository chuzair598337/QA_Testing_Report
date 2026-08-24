-- Phase 10 (fix): guard access_audit_log insert against cascading report deletion
-- When DELETE FROM reports cascades to report_members, the audit trigger's DELETE
-- branch tries to insert an access_audit_log row referencing the now-deleted report_id,
-- causing a FK constraint violation (23503). Guard the insert to skip when the parent
-- report is already gone, indicating this DELETE is itself a cascade.

create or replace function private.log_report_members_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'owner' then
      insert into public.access_audit_log (report_id, actor_id, target_user_id, action, detail)
      values (new.report_id, (select auth.uid()), new.user_id, 'invited', jsonb_build_object('role', new.role));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.reports where id = old.report_id) then
      insert into public.access_audit_log (report_id, actor_id, target_user_id, action)
      values (old.report_id, (select auth.uid()), old.user_id, 'removed');
    end if;
    return old;
  elsif tg_op = 'UPDATE' and old.role is distinct from new.role then
    insert into public.access_audit_log (report_id, actor_id, target_user_id, action, detail)
    values (
      new.report_id, (select auth.uid()), new.user_id,
      case when new.role = 'owner' then 'ownership_transferred' else 'role_changed' end,
      jsonb_build_object('from_role', old.role, 'to_role', new.role)
    );
  end if;
  return new;
end;
$$;
