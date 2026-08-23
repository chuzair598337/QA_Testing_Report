-- Backing table for the invite-member Edge Function's rate limit.
-- Public schema (not `private`) because the function's service-role
-- client talks over PostgREST via .from(), and `private` is intentionally
-- not an exposed schema. RLS is enabled with zero policies, so only
-- service_role (which bypasses RLS) can ever touch it — anon/authenticated
-- get no grant at all, same convention as every other table here.
create table public.invite_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_invite_attempts_user_created on public.invite_attempts(user_id, created_at);

alter table public.invite_attempts enable row level security;

grant select, insert on public.invite_attempts to service_role;
