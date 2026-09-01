-- Phase 10 (2/4): report_invites — pending-invite tracking, and closing
-- the loop with attach_invited_membership (revoke must actually block the
-- eventual signup-triggered auto-attach; accept must be recorded).

create table public.report_invites (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('editor', 'viewer')),
  invited_by uuid not null references auth.users(id),
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  resent_at  timestamptz
);

create unique index report_invites_pending_unique
  on public.report_invites (report_id, email) where status = 'pending';
create index idx_report_invites_report_id on public.report_invites(report_id);

alter table public.report_invites enable row level security;

create policy report_invites_select on public.report_invites
  for select using (private.report_role(report_id) = 'owner');
create policy report_invites_insert on public.report_invites
  for insert with check (private.report_role(report_id) = 'owner');
create policy report_invites_update on public.report_invites
  for update
  using (private.report_role(report_id) = 'owner')
  with check (private.report_role(report_id) = 'owner');

-- ---------------------------------------------------------------------
-- Extend attach_invited_membership (originally from
-- 20260823165149_phase4_invite_attach_trigger.sql): skip the attach if the
-- matching invite was revoked; flip it to 'accepted' on a successful
-- attach. Picks the MOST RECENT invite row for that report+email, so a
-- re-invite after a revoke (a fresh pending row, since the unique index
-- only covers status='pending') is the one that governs.
-- ---------------------------------------------------------------------
create or replace function private.attach_invited_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_role text;
  v_invite_status text;
begin
  if new.invited_at is null then
    return new;
  end if;

  v_report_id := nullif(new.raw_user_meta_data ->> 'invited_report_id', '')::uuid;
  v_role := new.raw_user_meta_data ->> 'invited_role';

  if v_report_id is null or v_role not in ('editor', 'viewer') then
    return new;
  end if;

  select status into v_invite_status
  from public.report_invites
  where report_id = v_report_id and email = new.email
  order by created_at desc
  limit 1;

  if v_invite_status = 'revoked' then
    return new;
  end if;

  insert into public.report_members (report_id, user_id, role)
  values (v_report_id, new.id, v_role)
  on conflict (report_id, user_id) do nothing;

  if v_invite_status = 'pending' then
    update public.report_invites
    set status = 'accepted'
    where report_id = v_report_id and email = new.email and status = 'pending';
  end if;

  return new;
end;
$$;
