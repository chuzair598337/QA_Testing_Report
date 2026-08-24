-- Phase 10 (1/4): Manage Access module — profiles table (identity
-- resolution). See docs/superpowers/specs/2026-08-24-manage-access-crud-design.md.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable by yourself, or by anyone who shares a report with you via
-- report_members. NOT open to every authenticated user — that would let
-- any signed-in user enumerate every other user's email.
create policy profiles_select_self on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_select_shared_report on public.profiles
  for select using (
    exists (
      select 1 from public.report_members rm1
      join public.report_members rm2 on rm1.report_id = rm2.report_id
      where rm1.user_id = (select auth.uid()) and rm2.user_id = profiles.id
    )
  );

-- No insert/update/delete policies for anon/authenticated — profiles rows
-- are only ever written by the SECURITY DEFINER triggers below, which
-- bypass RLS regardless of policy.

-- ---------------------------------------------------------------------
-- Populate profiles on signup (same shape as attach_invited_membership).
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_user_profile();

-- Keep profiles.email in sync if auth.users.email changes.
create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function private.sync_profile_email();

-- One-time backfill for users that already existed before this migration.
insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;
