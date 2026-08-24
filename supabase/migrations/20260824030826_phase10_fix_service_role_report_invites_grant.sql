-- Finding #1 (CRITICAL): service_role has zero DML grants on
-- public.report_invites. Every Edge Function path touching this table
-- (invite-member's insert/rollback-delete, resend's select/update,
-- revoke's select/update) runs through the service-role client and
-- currently fails 42501 permission denied. Mirrors the precedent in
-- 20260823180658_phase4_fix_service_role_grants.sql. DELETE is required
-- for the rollback-on-failed-email-send path.
grant select, insert, update, delete on public.report_invites to service_role;

-- Finding #3 (IMPORTANT): invite-lifecycle audit rows captured
-- (select auth.uid()) for actor_id, but these inserts happen via the
-- Edge Function's service-role client, where auth.uid() is always NULL.
-- Use coalesce with new.invited_by (present on report_invites) as the
-- fallback actor for all three branches (invited / invite_revoked /
-- invite_resent). Everything else in the function body is unchanged.
create or replace function private.log_report_invites_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.access_audit_log (report_id, actor_id, target_email, action, detail)
    values (new.report_id, coalesce((select auth.uid()), new.invited_by), new.email, 'invited', jsonb_build_object('role', new.role));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'revoked' then
    insert into public.access_audit_log (report_id, actor_id, target_email, action)
    values (new.report_id, coalesce((select auth.uid()), new.invited_by), new.email, 'invite_revoked');
  elsif tg_op = 'UPDATE' and old.resent_at is distinct from new.resent_at then
    insert into public.access_audit_log (report_id, actor_id, target_email, action)
    values (new.report_id, coalesce((select auth.uid()), new.invited_by), new.email, 'invite_resent');
  end if;
  return new;
end;
$function$;
