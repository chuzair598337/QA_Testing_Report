-- Phase 2: schema, RLS, storage for QA_Testing_Report Supabase migration
-- Written as one atomic migration so no table ever exists without RLS enabled.

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Tables (creation order respects FK dependencies)
-- ---------------------------------------------------------------------

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  created_by  uuid not null references auth.users(id),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.report_members (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  name        text not null,
  order_index integer not null,
  created_at  timestamptz not null default now()
);

create table public.sub_modules (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete cascade,
  report_id   uuid not null references public.reports(id) on delete cascade,
  name        text not null,
  order_index integer not null,
  created_at  timestamptz not null default now()
);

create table public.tests (
  id            uuid primary key default gen_random_uuid(),
  sub_module_id uuid not null references public.sub_modules(id) on delete cascade,
  report_id     uuid not null references public.reports(id) on delete cascade,
  name          text not null,
  status        text not null default 'pending' check (status in ('pass', 'fail', 'pending')),
  note          text,
  order_index   integer not null,
  updated_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table public.report_uploads (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes on FK columns (performance)
-- ---------------------------------------------------------------------

create index idx_report_members_report_id on public.report_members(report_id);
create index idx_report_members_user_id on public.report_members(user_id);
create index idx_modules_report_id on public.modules(report_id);
create index idx_sub_modules_module_id on public.sub_modules(module_id);
create index idx_sub_modules_report_id on public.sub_modules(report_id);
create index idx_tests_sub_module_id on public.tests(sub_module_id);
create index idx_tests_report_id on public.tests(report_id);
create index idx_report_uploads_report_id on public.report_uploads(report_id);

-- ---------------------------------------------------------------------
-- Enable RLS on every table (same transaction as creation — no exposure window)
-- ---------------------------------------------------------------------

alter table public.reports enable row level security;
alter table public.report_members enable row level security;
alter table public.modules enable row level security;
alter table public.sub_modules enable row level security;
alter table public.tests enable row level security;
alter table public.report_uploads enable row level security;

-- ---------------------------------------------------------------------
-- Helper functions (private schema — never exposed via PostgREST)
-- SECURITY DEFINER + fixed search_path avoids RLS recursion and search_path hijack.
-- ---------------------------------------------------------------------

create or replace function private.is_report_member(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.report_members m
    where m.report_id = p_report_id and m.user_id = auth.uid()
  );
$$;

create or replace function private.report_role(p_report_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.report_members
  where report_id = p_report_id and user_id = auth.uid()
  limit 1;
$$;

grant execute on function private.is_report_member(uuid) to authenticated, anon;
grant execute on function private.report_role(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- tests: BEFORE UPDATE trigger enforcing the editor content-only restriction
-- and auto-stamping updated_by/updated_at.
-- ---------------------------------------------------------------------

create or replace function private.enforce_tests_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := private.report_role(new.report_id);

  if v_role = 'owner' then
    -- full access, nothing to restrict
  elsif v_role = 'editor' then
    if new.sub_module_id is distinct from old.sub_module_id
       or new.report_id is distinct from old.report_id
       or new.name is distinct from old.name
       or new.order_index is distinct from old.order_index then
      raise exception 'editors may only update status and note on tests';
    end if;
  else
    raise exception 'insufficient role to update tests';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger tests_update_scope
before update on public.tests
for each row execute function private.enforce_tests_update();

-- ---------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------

-- reports
create policy reports_select on public.reports
  for select using (private.is_report_member(id) or created_by = auth.uid());

create policy reports_insert on public.reports
  for insert with check (created_by = auth.uid());

create policy reports_update on public.reports
  for update
  using (private.report_role(id) = 'owner')
  with check (private.report_role(id) = 'owner');

-- A delete policy now exists: reports_delete_archived_owner, added in
-- phase11_reports_hard_delete_bin, scoped to archived reports and
-- owner-only (permanent delete from the Bin). Soft delete (archived_at via
-- reports_update above) remains the only path for a live report.

-- report_members
create policy report_members_select on public.report_members
  for select using (private.is_report_member(report_id));

create policy report_members_insert_owner on public.report_members
  for insert with check (private.report_role(report_id) = 'owner');

create policy report_members_insert_bootstrap on public.report_members
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.reports r
      where r.id = report_id and r.created_by = auth.uid()
    )
  );

create policy report_members_update on public.report_members
  for update
  using (private.report_role(report_id) = 'owner')
  with check (private.report_role(report_id) = 'owner');

create policy report_members_delete on public.report_members
  for delete using (private.report_role(report_id) = 'owner');

-- modules (owner-only writes, member-only reads)
create policy modules_select on public.modules
  for select using (private.is_report_member(report_id));

create policy modules_insert on public.modules
  for insert with check (private.report_role(report_id) = 'owner');

create policy modules_update on public.modules
  for update
  using (private.report_role(report_id) = 'owner')
  with check (private.report_role(report_id) = 'owner');

create policy modules_delete on public.modules
  for delete using (private.report_role(report_id) = 'owner');

-- sub_modules (owner-only writes, member-only reads)
create policy sub_modules_select on public.sub_modules
  for select using (private.is_report_member(report_id));

create policy sub_modules_insert on public.sub_modules
  for insert with check (private.report_role(report_id) = 'owner');

create policy sub_modules_update on public.sub_modules
  for update
  using (private.report_role(report_id) = 'owner')
  with check (private.report_role(report_id) = 'owner');

create policy sub_modules_delete on public.sub_modules
  for delete using (private.report_role(report_id) = 'owner');

-- tests (member-only reads; owner-only insert/delete; owner+editor update,
-- column-restricted to status/note for editor via the trigger above)
create policy tests_select on public.tests
  for select using (private.is_report_member(report_id));

create policy tests_insert on public.tests
  for insert with check (private.report_role(report_id) = 'owner');

create policy tests_update on public.tests
  for update
  using (private.report_role(report_id) in ('owner', 'editor'))
  with check (private.report_role(report_id) in ('owner', 'editor'));

create policy tests_delete on public.tests
  for delete using (private.report_role(report_id) = 'owner');

-- report_uploads (append-only: select by any member, insert by owner, no update/delete)
create policy report_uploads_select on public.report_uploads
  for select using (private.is_report_member(report_id));

create policy report_uploads_insert on public.report_uploads
  for insert with check (private.report_role(report_id) = 'owner');

-- ---------------------------------------------------------------------
-- report_stats view — security_invoker so RLS applies to the querying
-- user, not the view owner (Postgres 15+ / this project is on 17).
-- ---------------------------------------------------------------------

create view public.report_stats
with (security_invoker = true) as
select
  r.id as report_id,
  count(t.id) as total_tests,
  count(t.id) filter (where t.status = 'pass') as pass_count,
  count(t.id) filter (where t.status = 'fail') as fail_count,
  count(t.id) filter (where t.status = 'pending') as pending_count,
  case
    when count(t.id) = 0 then 0
    else round(100.0 * count(t.id) filter (where t.status = 'pass') / count(t.id), 1)
  end as pass_percent
from public.reports r
left join public.tests t on t.report_id = r.id
group by r.id;

-- ---------------------------------------------------------------------
-- Storage: private bucket + policies mirroring report_uploads access.
-- Convention: object path is "<report_id>/<filename>".
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('report-uploads', 'report-uploads', false)
on conflict (id) do nothing;

create policy report_uploads_storage_select on storage.objects
  for select using (
    bucket_id = 'report-uploads'
    and private.is_report_member((storage.foldername(name))[1]::uuid)
  );

create policy report_uploads_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'report-uploads'
    and private.report_role((storage.foldername(name))[1]::uuid) = 'owner'
  );
