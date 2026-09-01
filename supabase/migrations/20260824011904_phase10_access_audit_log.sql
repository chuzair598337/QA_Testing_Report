-- Phase 10 (3/4): access_audit_log — trigger-written, owner-readable
-- audit trail. Never written by app code directly, so it can't be
-- spoofed or skipped by a client bug.

create table public.access_audit_log (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports(id) on delete cascade,
  actor_id       uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  target_email   text,
  action         text not null check (action in (
                   'invited', 'invite_resent', 'invite_revoked',
                   'role_changed', 'removed', 'ownership_transferred'
                 )),
  detail         jsonb,
  created_at     timestamptz not null default now()
);

create index idx_access_audit_log_report_id on public.access_audit_log(report_id);

alter table public.access_audit_log enable row level security;

create policy access_audit_log_select on public.access_audit_log
  for select using (private.report_role(report_id) = 'owner');

grant select on public.access_audit_log to authenticated;

-- No insert/update/delete policies — only the SECURITY DEFINER triggers
-- below write to this table.

create or replace function private.log_report_members_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- role='owner' on INSERT is always the report-creation bootstrap row
    -- (a real ownership change always goes through the UPDATE branch
    -- below, via transfer_report_ownership) — don't log "owner invited
    -- themselves".
    if new.role <> 'owner' then
      insert into public.access_audit_log (report_id, actor_id, target_user_id, action, detail)
      values (new.report_id, (select auth.uid()), new.user_id, 'invited', jsonb_build_object('role', new.role));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.access_audit_log (report_id, actor_id, target_user_id, action)
    values (old.report_id, (select auth.uid()), old.user_id, 'removed');
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

drop trigger if exists on_report_members_change_audit on public.report_members;
create trigger on_report_members_change_audit
after insert or update or delete on public.report_members
for each row execute function private.log_report_members_change();

create or replace function private.log_report_invites_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.access_audit_log (report_id, actor_id, target_email, action, detail)
    values (new.report_id, (select auth.uid()), new.email, 'invited', jsonb_build_object('role', new.role));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'revoked' then
    insert into public.access_audit_log (report_id, actor_id, target_email, action)
    values (new.report_id, (select auth.uid()), new.email, 'invite_revoked');
  elsif tg_op = 'UPDATE' and old.resent_at is distinct from new.resent_at then
    insert into public.access_audit_log (report_id, actor_id, target_email, action)
    values (new.report_id, (select auth.uid()), new.email, 'invite_resent');
  end if;
  return new;
end;
$$;

drop trigger if exists on_report_invites_change_audit on public.report_invites;
create trigger on_report_invites_change_audit
after insert or update on public.report_invites
for each row execute function private.log_report_invites_change();
