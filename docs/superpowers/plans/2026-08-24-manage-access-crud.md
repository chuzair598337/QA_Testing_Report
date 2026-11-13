# Manage Access CRUD Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bare "Manage access" modal into a full module: resolved
identity (name/email/avatar), pending invites with resend/revoke,
self-action guards + ownership transfer, role tooltips, search/sort/filter,
and a trigger-written audit trail.

**Architecture:** 4 sequential Postgres migrations (profiles →
report_invites → access_audit_log → self-guard trigger + transfer RPC),
one extended Edge Function (branched `action`), one new frontend
composable (`useReportMembers.js`) replacing three functions pulled out of
`useReports.js`, and two new Vue components (`MemberCard.vue`,
`ManageAccessModal.vue`) that replace the inline modal block in
`ReportView.vue`.

**Tech Stack:** Supabase (Postgres + RLS + Edge Functions/Deno), Vue 3
`<script setup>`, existing project composable pattern (no state library).

**Spec:** [docs/superpowers/specs/2026-08-24-manage-access-crud-design.md](../specs/2026-08-24-manage-access-crud-design.md)

## Global Constraints

- Every RLS policy wraps `auth.uid()` as `(select auth.uid())` for
  per-statement evaluation — matches the existing advisor-fixed convention
  in `20260823151858_phase2_advisor_fixes.sql`.
- Reuse `private.report_role(report_id)` / `private.is_report_member(report_id)`
  helper functions already defined in `20260823151752_phase2_schema_rls_storage.sql`
  — do not redefine equivalents.
- Every new privileged function is `private` schema, `security definer`,
  `set search_path = public, pg_temp` — matches `attach_invited_membership`.
- No test framework exists in `app/` (no Vitest/Jest) — user decision,
  2026-08-24: don't add one for this feature. Verification is `npm run
  lint` (must stay clean) + manual/MCP-driven checks per task.
- Apply migrations via the Supabase MCP's `apply_migration` tool (or
  `supabase db push` if working from a local CLI session), never by
  editing a previously-applied migration file.

---

### Task 1: Migration — `profiles` table (identity resolution)

**Files:**
- Create: `supabase/migrations/20260824000000_phase10_profiles.sql`

**Interfaces:**
- Produces: `public.profiles(id uuid PK, email text, full_name text,
  avatar_url text, created_at timestamptz)`, readable by self or by anyone
  sharing a `report_id` via `report_members`.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP: `apply_migration` with `name: "phase10_profiles"` and
the SQL above. (Or `supabase db push` if driving from the CLI.)

- [ ] **Step 3: Verify**

Run via the Supabase MCP's `execute_sql` (or `psql`):
```sql
select count(*) from public.profiles;
```
Expected: count matches `select count(*) from auth.users;` (backfill
covered every existing user). Then:
```sql
select polname from pg_policies where tablename = 'profiles';
```
Expected: `profiles_select_self`, `profiles_select_shared_report`, and
nothing else (no insert/update/delete policy rows).

Then run `get_advisors` (Supabase MCP, type `security`) and confirm no new
findings against `public.profiles`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260824000000_phase10_profiles.sql
git commit -m "feat(db): add profiles table for member identity resolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration — `report_invites` + extend `attach_invited_membership`

**Files:**
- Create: `supabase/migrations/20260824000100_phase10_report_invites.sql`

**Interfaces:**
- Consumes: `private.report_role(report_id)` (Task 1's global constraint,
  already exists from phase2).
- Produces: `public.report_invites(id, report_id, email, role, invited_by,
  status, created_at, resent_at)`; `status in ('pending','accepted','revoked')`;
  partial unique index on `(report_id, email) where status='pending'`.
  Extends `private.attach_invited_membership()` to skip attach on
  `status='revoked'` and flip `status` to `'accepted'` on successful
  attach.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Supabase MCP `apply_migration`, name `"phase10_report_invites"`.

- [ ] **Step 3: Verify**

```sql
insert into public.report_invites (report_id, email, role, invited_by)
values ('<any existing report id>', 'plan-test@example.com', 'viewer', '<any existing user id>');
-- Expect: succeeds once.
insert into public.report_invites (report_id, email, role, invited_by)
values ('<same report id>', 'plan-test@example.com', 'viewer', '<any existing user id>');
-- Expect: fails with a unique-violation on report_invites_pending_unique.
delete from public.report_invites where email = 'plan-test@example.com';
```
Run `get_advisors` (security) — confirm no new findings on
`public.report_invites`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260824000100_phase10_report_invites.sql
git commit -m "feat(db): add report_invites, extend attach_invited_membership

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Migration — `access_audit_log` + audit triggers

**Files:**
- Create: `supabase/migrations/20260824000200_phase10_access_audit_log.sql`

**Interfaces:**
- Consumes: `public.report_members`, `public.report_invites` (Task 2).
- Produces: `public.access_audit_log(id, report_id, actor_id,
  target_user_id, target_email, action, detail jsonb, created_at)`,
  `action in ('invited','invite_resent','invite_revoked','role_changed',
  'removed','ownership_transferred')`, owner-only read, written only by
  triggers (no app-writable insert policy).

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Supabase MCP `apply_migration`, name `"phase10_access_audit_log"`.

- [ ] **Step 3: Verify**

```sql
-- Using a report/member you own for testing:
update public.report_members set role = 'editor'
where id = '<a non-owner member row id>' and role = 'viewer';
select * from public.access_audit_log where target_user_id = '<that member's user_id>' order by created_at desc limit 1;
-- Expect: one row, action='role_changed', detail={"from_role":"viewer","to_role":"editor"}.
-- Revert:
update public.report_members set role = 'viewer' where id = '<same row id>';
```
Run `get_advisors` (security) — confirm no new findings on
`public.access_audit_log`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260824000200_phase10_access_audit_log.sql
git commit -m "feat(db): add trigger-written access_audit_log

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Migration — self-guard trigger + `transfer_report_ownership` RPC

**Files:**
- Create: `supabase/migrations/20260824000300_phase10_ownership_transfer.sql`

**Interfaces:**
- Produces: `public.transfer_report_ownership(p_report_id uuid,
  p_new_owner_member_id uuid, p_old_owner_new_role text default 'editor')
  returns void`, callable via `supabase.rpc('transfer_report_ownership',
  {...})`. Trigger `on_report_members_prevent_self_demote` blocks an
  owner updating/deleting their own row unless called from inside that
  RPC.

**Critical ordering detail:** `report_members_update`'s RLS policy
re-evaluates `private.report_role(report_id) = 'owner'` fresh on *every*
statement. The RPC must promote the new owner **before** demoting the
caller — demoting first would make the caller read as non-owner for the
second statement's RLS check, silently updating zero rows.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 10 (4/4): ownership-transfer RPC + the trigger that's the real
-- enforcement behind self-action guards (not just a disabled UI button).

create or replace function private.prevent_owner_self_demote_or_remove()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner'
     and old.user_id = (select auth.uid())
     and coalesce(current_setting('app.in_ownership_transfer', true), 'false') <> 'true'
  then
    raise exception 'You can''t remove or demote yourself — transfer ownership first.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists on_report_members_prevent_self_demote on public.report_members;
create trigger on_report_members_prevent_self_demote
before update or delete on public.report_members
for each row execute function private.prevent_owner_self_demote_or_remove();

create or replace function public.transfer_report_ownership(
  p_report_id uuid,
  p_new_owner_member_id uuid,
  p_old_owner_new_role text default 'editor'
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_old_owner_new_role not in ('editor', 'viewer') then
    raise exception 'old_owner_new_role must be editor or viewer';
  end if;

  if private.report_role(p_report_id) <> 'owner' then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if not exists (
    select 1 from public.report_members
    where id = p_new_owner_member_id and report_id = p_report_id and role <> 'owner'
  ) then
    raise exception 'Target member not found, or already the owner.';
  end if;

  perform set_config('app.in_ownership_transfer', 'true', true);

  -- Promote the target FIRST — see the plan's ordering note above.
  update public.report_members
  set role = 'owner'
  where id = p_new_owner_member_id and report_id = p_report_id;

  update public.report_members
  set role = p_old_owner_new_role
  where report_id = p_report_id and user_id = (select auth.uid()) and role = 'owner';

  perform set_config('app.in_ownership_transfer', 'false', true);
end;
$$;

grant execute on function public.transfer_report_ownership(uuid, uuid, text) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Supabase MCP `apply_migration`, name `"phase10_ownership_transfer"`.

- [ ] **Step 3: Verify**

```sql
-- As the owner of a test report with at least one other member:
update public.report_members set role = 'viewer'
where report_id = '<report id>' and user_id = (select auth.uid());
-- Expect: FAILS with "You can't remove or demote yourself — transfer ownership first."

select public.transfer_report_ownership('<report id>', '<other member row id>');
-- Expect: succeeds, no error.
select user_id, role from public.report_members where report_id = '<report id>';
-- Expect: exactly one row with role='owner' (the new owner), your row now 'editor'.

-- Transfer it back for repeatable testing:
select public.transfer_report_ownership('<report id>', '<your own member row id>');
```
Run `get_advisors` (security) — confirm no new findings.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260824000300_phase10_ownership_transfer.sql
git commit -m "feat(db): add self-guard trigger + transfer_report_ownership RPC

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Edge Function — extend `invite-member` (invite/resend/revoke)

**Files:**
- Modify: `supabase/functions/invite-member/index.ts` (full rewrite of the
  `Deno.serve` handler body)

**Interfaces:**
- Consumes: `public.report_invites` (Task 2), `public.invite_attempts`
  (existing, phase9).
- Produces: same Edge Function name (`invite-member`), now accepting
  `{ action?: 'invite'|'resend'|'revoke', report_id, email?, role?,
  invite_id? }`. Response shape unchanged for `action:'invite'`
  (`{status,message}` or `{error}`); `resend`/`revoke` return
  `{status:'resent'|'revoked'|'noop', message}` or `{error}`.

- [ ] **Step 1: Write the new function**

Replace the entire file with:

```ts
// Invite a member to a report by email — and manage the pending-invite
// lifecycle (resend/revoke). Branches on `action` in the request body;
// `action` defaults to 'invite' so existing callers keep working
// unchanged.
//
// This exists as an Edge Function (not client code) because its real
// operations require the service-role key, which must never reach the
// browser: looking up whether an account with an email already exists,
// admin.inviteUserByEmail() for accounts that don't exist yet, and
// resending that invite email.
//
// Authorization is done with the CALLER's own JWT (forwarded from the
// browser) against RLS, BEFORE any service-role client is touched — so
// this function can only ever act on behalf of a report's actual owner,
// never anyone else, regardless of what's in the request body.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000

async function checkRateLimit(adminClient: ReturnType<typeof createClient>, userId: string) {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error } = await adminClient
    .from('invite_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  if (error) throw new Error(error.message)
  if ((count ?? 0) >= RATE_LIMIT) {
    throw new Error(`Too many invites sent recently. Try again in a bit (limit: ${RATE_LIMIT}/hour).`)
  }
  await adminClient.from('invite_attempts').insert({ user_id: userId })
}

async function handleInvite(
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
  reportId: string,
  email: string,
  role: string,
  req: Request,
) {
  try {
    await checkRateLimit(adminClient, callerId)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 429)
  }

  // No guaranteed direct "get user by email" admin call across
  // supabase-js versions — list + filter client-side. Fine for this
  // app's scale; revisit with pagination if the user base grows large.
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) {
    return json({ error: 'Could not look up existing users: ' + listError.message }, 500)
  }

  const normalizedEmail = email.toLowerCase()
  const existing = listData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)

  if (existing) {
    const { error: insertError } = await adminClient
      .from('report_members')
      .insert({ report_id: reportId, user_id: existing.id, role })
    if (insertError) {
      return json({ error: insertError.message }, 500)
    }
    return json(
      { status: 'added', message: `${email} already has an account and was added directly.` },
      200,
    )
  }

  // report_invites row first — if this fails (e.g. duplicate pending
  // invite), no email gets sent for a row that doesn't exist.
  const { error: inviteRowError } = await adminClient
    .from('report_invites')
    .insert({ report_id: reportId, email, role, invited_by: callerId })
  if (inviteRowError) {
    if (inviteRowError.code === '23505') {
      return json({ error: `${email} already has a pending invite.` }, 409)
    }
    return json({ error: inviteRowError.message }, 500)
  }

  const origin = req.headers.get('origin') || ''
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
    data: { invited_report_id: reportId, invited_role: role },
  })
  if (inviteError) {
    // Roll back the report_invites row so a failed email send doesn't
    // leave a phantom pending invite blocking a retry.
    await adminClient
      .from('report_invites')
      .delete()
      .eq('report_id', reportId)
      .eq('email', email)
      .eq('status', 'pending')
    return json({ error: inviteError.message }, 500)
  }

  return json({ status: 'invited', message: `Invite email sent to ${email}.` }, 200)
}

async function handleResend(
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
  reportId: string,
  inviteId: string | undefined,
  req: Request,
) {
  if (!inviteId) return json({ error: 'invite_id is required' }, 400)

  const { data: invite, error: fetchError } = await adminClient
    .from('report_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('report_id', reportId)
    .maybeSingle()
  if (fetchError) return json({ error: fetchError.message }, 500)
  if (!invite) return json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') {
    return json({ status: 'noop', message: 'This invite is no longer pending.' }, 200)
  }

  try {
    await checkRateLimit(adminClient, callerId)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 429)
  }

  const origin = req.headers.get('origin') || ''
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: `${origin}/auth/callback`,
    data: { invited_report_id: reportId, invited_role: invite.role },
  })
  if (inviteError) return json({ error: inviteError.message }, 500)

  await adminClient
    .from('report_invites')
    .update({ resent_at: new Date().toISOString() })
    .eq('id', inviteId)
  return json({ status: 'resent', message: `Invite email re-sent to ${invite.email}.` }, 200)
}

async function handleRevoke(
  adminClient: ReturnType<typeof createClient>,
  reportId: string,
  inviteId: string | undefined,
) {
  if (!inviteId) return json({ error: 'invite_id is required' }, 400)

  const { data: invite, error: fetchError } = await adminClient
    .from('report_invites')
    .select('status')
    .eq('id', inviteId)
    .eq('report_id', reportId)
    .maybeSingle()
  if (fetchError) return json({ error: fetchError.message }, 500)
  if (!invite) return json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') {
    return json({ status: 'noop', message: 'This invite is already handled.' }, 200)
  }

  const { error: updateError } = await adminClient
    .from('report_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (updateError) return json({ error: updateError.message }, 500)

  return json({ status: 'revoked', message: 'Invite revoked.' }, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const body = await req.json()
    const action = body.action || 'invite'
    const reportId = body.report_id

    if (!reportId) {
      return json({ error: 'report_id is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Caller-scoped client (respects RLS) — used ONLY to establish who is
    // calling and whether they actually own this report. No privileged
    // action happens through this client.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData?.user) {
      return json({ error: 'Not authenticated' }, 401)
    }

    const { data: memberRow, error: memberError } = await callerClient
      .from('report_members')
      .select('role')
      .eq('report_id', reportId)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (memberError) {
      return json({ error: memberError.message }, 500)
    }
    if (memberRow?.role !== 'owner') {
      return json({ error: 'Only the report owner can manage members' }, 403)
    }

    // Service-role client — only reachable past the authorization check
    // above, and never exposed to the browser (this code runs on
    // Supabase's infra, not the client).
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    if (action === 'revoke') {
      return await handleRevoke(adminClient, reportId, body.invite_id)
    }
    if (action === 'resend') {
      return await handleResend(adminClient, userData.user.id, reportId, body.invite_id, req)
    }

    const { email, role } = body
    if (typeof email !== 'string' || !email.trim() || !['editor', 'viewer'].includes(role)) {
      return json({ error: 'email and role (editor|viewer) are required' }, 400)
    }
    return await handleInvite(adminClient, userData.user.id, reportId, email.trim(), role, req)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
```

- [ ] **Step 2: Deploy**

Use the Supabase MCP's `deploy_edge_function` tool for `invite-member`
with the file content above (or `supabase functions deploy invite-member`
from the CLI).

- [ ] **Step 3: Verify**

From the deployed report's Manage Access UI is not built yet (Task 9), so
verify via a direct `curl`/`fetch` using a real owner's access token:
```bash
curl -i -X POST 'https://<project-ref>.functions.supabase.co/invite-member' \
  -H "Authorization: Bearer <owner's access token>" \
  -H "Content-Type: application/json" \
  -d '{"report_id":"<report id>","action":"invite","email":"plan-test-2@example.com","role":"viewer"}'
```
Expected: `200 {"status":"invited","message":"Invite email sent to plan-test-2@example.com."}`.
```sql
select id, status from public.report_invites where email = 'plan-test-2@example.com';
```
Then resend/revoke against that `id` via the same curl pattern with
`"action":"resend"` / `"action":"revoke"` and `invite_id` — confirm
`resent_at` updates and `status` flips to `'revoked'` respectively.
Clean up: `delete from public.report_invites where email = 'plan-test-2@example.com';`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/invite-member/index.ts
git commit -m "feat(edge-fn): extend invite-member with resend/revoke actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — `useReportMembers.js` composable

**Files:**
- Create: `app/src/composables/useReportMembers.js`
- Modify: `app/src/stores/useReports.js` — remove `inviteMember`,
  `updateMemberRole`, `removeMember` (lines 304–339 and their entry in the
  returned object at lines 362–364), now owned by the new composable.

**Interfaces:**
- Produces: `useReportMembers()` returning `{ fetchMembers, inviteMember,
  resendInvite, revokeInvite, updateMemberRole, removeMember,
  transferOwnership }`.
  - `fetchMembers(reportId) => { data: Row[] | null, error: string | null }`
    where `Row = { kind: 'member'|'invite', id, user_id: string|null,
    email: string|null, full_name: string|null, avatar_url: string|null,
    role: 'owner'|'editor'|'viewer', status: 'active'|'pending',
    created_at: string, resent_at?: string }`.
  - `inviteMember(reportId, email, role) => { data, error }`
  - `resendInvite(reportId, inviteId) => { data, error }`
  - `revokeInvite(reportId, inviteId) => { data, error }`
  - `updateMemberRole(memberId, role) => { data: true|null, error }`
  - `removeMember(memberId) => { data: true|null, error }`
  - `transferOwnership(reportId, newOwnerMemberId, oldOwnerNewRole='editor') => { data: true|null, error }`
- Consumed by: Task 8/9 (`ManageAccessModal.vue`).

- [ ] **Step 1: Remove the three functions from `useReports.js`**

Delete lines 304–339 (the `inviteMember`, `updateMemberRole`,
`removeMember` functions and the comment block above them) and remove
`inviteMember,`, `updateMemberRole,`, `removeMember,` from the returned
object in `export function useReports()`.

- [ ] **Step 2: Write the new composable**

```js
// Manage Access data layer — split out of useReports.js (which stays
// focused on report-level CRUD; this owns everything the Manage Access
// module needs). Merges report_members + pending report_invites +
// profiles into one unified list, and wraps the invite-member Edge
// Function's resend/revoke actions and the transfer_report_ownership RPC.
import { supabase } from '../lib/supabaseClient'

// One row per member/invite — see this file's header for the full shape.
async function fetchMembers(reportId) {
  const [membersRes, invitesRes] = await Promise.all([
    supabase.from('report_members').select('*').eq('report_id', reportId),
    supabase.from('report_invites').select('*').eq('report_id', reportId).eq('status', 'pending'),
  ])

  if (membersRes.error) return { data: null, error: membersRes.error.message }
  if (invitesRes.error) return { data: null, error: invitesRes.error.message }

  const userIds = membersRes.data.map((m) => m.user_id)
  let profilesById = {}
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)
    if (profilesError) return { data: null, error: profilesError.message }
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  }

  const memberRows = membersRes.data.map((m) => {
    const profile = profilesById[m.user_id]
    return {
      kind: 'member',
      id: m.id,
      user_id: m.user_id,
      email: profile?.email || null,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      role: m.role,
      status: 'active',
      created_at: m.created_at,
    }
  })

  const inviteRows = invitesRes.data.map((inv) => ({
    kind: 'invite',
    id: inv.id,
    user_id: null,
    email: inv.email,
    full_name: null,
    avatar_url: null,
    role: inv.role,
    status: 'pending',
    created_at: inv.created_at,
    resent_at: inv.resent_at,
  }))

  return { data: [...memberRows, ...inviteRows], error: null }
}

async function invokeMemberAction(body) {
  const { data, error } = await supabase.functions.invoke('invite-member', { body })
  if (error) {
    // supabase-js surfaces non-2xx Edge Function responses as a generic
    // FunctionsHttpError — the function's own { error } body carries the
    // real message, so pull it out for a useful inline message.
    const detail = await error.context?.json?.().catch(() => null)
    return { data: null, error: detail?.error || error.message }
  }
  if (data?.error) return { data: null, error: data.error }
  return { data, error: null }
}

async function inviteMember(reportId, email, role) {
  const value = (email || '').trim()
  if (!value) return { data: null, error: 'Enter an email address.' }
  if (!['editor', 'viewer'].includes(role)) return { data: null, error: 'Role must be editor or viewer.' }
  return invokeMemberAction({ action: 'invite', report_id: reportId, email: value, role })
}

async function resendInvite(reportId, inviteId) {
  return invokeMemberAction({ action: 'resend', report_id: reportId, invite_id: inviteId })
}

async function revokeInvite(reportId, inviteId) {
  return invokeMemberAction({ action: 'revoke', report_id: reportId, invite_id: inviteId })
}

async function updateMemberRole(memberId, role) {
  const { error } = await supabase.from('report_members').update({ role }).eq('id', memberId)
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

async function removeMember(memberId) {
  const { error } = await supabase.from('report_members').delete().eq('id', memberId)
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

async function transferOwnership(reportId, newOwnerMemberId, oldOwnerNewRole = 'editor') {
  const { error } = await supabase.rpc('transfer_report_ownership', {
    p_report_id: reportId,
    p_new_owner_member_id: newOwnerMemberId,
    p_old_owner_new_role: oldOwnerNewRole,
  })
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export function useReportMembers() {
  return {
    fetchMembers,
    inviteMember,
    resendInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
    transferOwnership,
  }
}
```

- [ ] **Step 3: Verify**

```bash
cd app && npx eslint src/composables/useReportMembers.js src/stores/useReports.js
```
Expected: no output (clean). Then grep the codebase to confirm nothing
still imports the removed functions from `useReports`:
```bash
grep -rn "inviteMember\|updateMemberRole\|removeMember" src/ --include="*.vue" --include="*.js"
```
Expected at this point in the plan: only `ReportView.vue`'s still-inline
usages (fixed in Task 9) and this new file.

- [ ] **Step 4: Commit**

```bash
git add app/src/composables/useReportMembers.js app/src/stores/useReports.js
git commit -m "refactor: extract useReportMembers.js from useReports.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — `MemberCard.vue` + shared Manage Access styles

**Files:**
- Create: `app/src/components/MemberCard.vue`
- Modify: `app/src/styles/base.css` — add new rules (below), remove now-dead
  `.member-row`, `.member-row-id`, `.mono-id`, `.member-row-actions`,
  `.your-id-chip` rules (only used by the inline markup Task 9 replaces —
  grep first to confirm no other usage before deleting).

**Interfaces:**
- Consumes: a `Row` object shaped exactly as `useReportMembers.fetchMembers`
  produces (Task 6).
- Produces: `MemberCard` component. Props: `row: Object (required)`,
  `isSelf: Boolean`, `roleChangeBusy: Boolean`. Emits: `role-change(memberId,
  newRole)`, `remove(memberId)`, `resend(inviteId)`, `revoke(inviteId)`.
  Reuses existing classes `.role-select`, `.icon-btn`, `.btn`, `.btn.danger`,
  `.role-badge` (+ new `.role-badge.pending` variant) — does not redefine
  them.

- [ ] **Step 1: Grep-confirm the dead CSS selectors are only used by the
  block Task 9 will replace**

```bash
cd app && grep -rn "member-row\b\|member-row-id\|mono-id\|member-row-actions\|your-id-chip" src/
```
Expected: only hits inside `src/views/ReportView.vue`'s Manage Access
modal block (lines ~774–818) and `src/styles/base.css`. If anything else
matches, stop and re-scope this step — do not delete a selector still in
use elsewhere.

- [ ] **Step 2: Remove the dead CSS, add the new CSS**

In `app/src/styles/base.css`, delete the `.member-row`, `.member-row-id`,
`.mono-id`, `.member-row-actions`, `.your-id-chip` rule blocks (found via
Step 1's grep — they sit together, right after `.field-hint`). Add the
role-badge pending variant next to the existing owner/editor/viewer
variants:

```css
.role-badge.pending{ background:var(--pending-bg); color:var(--ink-soft); }
```

Then append this new block (anywhere after the `.role-select` rules is
fine — CSS files in this project don't enforce a strict ordering beyond
"related rules stay together"):

```css
/* Manage Access module (2026-08-24 design spec) */
.modal-box--members{
  max-width:560px;
  width:100%;
  max-height:min(88vh, 720px);
  display:flex;
  flex-direction:column;
  overflow:hidden;
  text-align:left;
}
.manage-access-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
}
.manage-access-header h2{ margin:0; }
.manage-access-add-panel{
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:14px;
  margin-bottom:14px;
  background:var(--surface-alt);
}
.manage-access-toolbar{
  display:flex;
  gap:8px;
  margin-bottom:8px;
}
.manage-access-sort{
  flex-shrink:0;
  width:auto;
}
.manage-access-filters{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  margin-bottom:12px;
}
.filter-chip{
  appearance:none;
  border:1px solid var(--border-strong);
  background:var(--surface);
  color:var(--ink-soft);
  font-family:var(--sans);
  font-size:12px;
  font-weight:600;
  padding:5px 12px;
  border-radius:999px;
  cursor:pointer;
  transition:background .15s ease, color .15s ease, border-color .15s ease;
}
.filter-chip:hover{ background:var(--hover-bg); }
.filter-chip.active{
  background:var(--primary);
  border-color:var(--primary);
  color:#fff;
}
.manage-access-list{
  overflow-y:auto;
  flex:1 1 auto;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding-right:2px;
}
.member-card{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 12px;
  border:1px solid var(--border);
  border-radius:var(--radius);
  flex-wrap:wrap;
}
.member-card.pending{ background:var(--surface-alt); }
.member-card-identity{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  flex:1 1 auto;
}
.member-avatar{
  flex-shrink:0;
  width:34px;
  height:34px;
  border-radius:50%;
  background:var(--primary-soft);
  color:var(--primary);
  font-family:var(--mono);
  font-size:12px;
  font-weight:700;
  display:flex;
  align-items:center;
  justify-content:center;
}
.member-card-text{ min-width:0; }
.member-card-name{
  font-size:13.5px;
  font-weight:600;
  color:var(--ink);
  display:flex;
  align-items:center;
  gap:6px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.member-you-tag{
  font-family:var(--mono);
  font-size:10.5px;
  font-weight:600;
  color:var(--ink-faint);
}
.member-card-email{
  font-family:var(--mono);
  font-size:11.5px;
  color:var(--ink-soft);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.member-invite-meta{
  font-size:11px;
  color:var(--ink-faint);
  margin-top:2px;
}
.member-card-actions{
  display:flex;
  align-items:center;
  gap:8px;
  flex-shrink:0;
}
```

- [ ] **Step 3: Write `MemberCard.vue`**

```vue
<script setup>
// One row in the Manage Access member list — either an active member or a
// pending invite (Task 7 of the 2026-08-24 design spec). `row` is exactly
// the shape useReportMembers.fetchMembers() produces.
import { computed } from 'vue'
import Icon from './icons/Icon.vue'

const props = defineProps({
  row: { type: Object, required: true },
  isSelf: { type: Boolean, default: false },
  roleChangeBusy: { type: Boolean, default: false },
})
const emit = defineEmits(['role-change', 'remove', 'resend', 'revoke'])

const ROLE_TOOLTIP =
  'Owner: full access, including managing members. Editor: can run tests and edit notes. Viewer: read-only.'

const displayName = computed(() => props.row.full_name || props.row.email || 'Unknown member')
const initials = computed(() => {
  const source = props.row.full_name || props.row.email || '?'
  return source
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
})

const selfLocked = computed(() => props.isSelf && props.row.role === 'owner')

function onRoleChange(event) {
  const newRole = event.target.value
  if (newRole === props.row.role) return
  emit('role-change', props.row.id, newRole)
}

function relativeInviteAge(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
</script>

<template>
  <div class="member-card" :class="{ pending: row.status === 'pending' }">
    <div class="member-card-identity">
      <div class="member-avatar" aria-hidden="true">{{ initials }}</div>
      <div class="member-card-text">
        <div class="member-card-name">
          {{ displayName }}
          <span v-if="isSelf" class="member-you-tag">(you)</span>
        </div>
        <div class="member-card-email">{{ row.email }}</div>
        <div v-if="row.status === 'pending'" class="member-invite-meta">
          Invited {{ relativeInviteAge(row.created_at) }}
        </div>
      </div>
    </div>

    <div class="member-card-actions">
      <template v-if="row.status === 'pending'">
        <span class="role-badge pending">Pending</span>
        <button type="button" class="btn" @click="emit('resend', row.id)">
          <Icon name="rotateCcw" cls="icon-sm" />
          <span>Resend</span>
        </button>
        <button type="button" class="btn danger" @click="emit('revoke', row.id)">
          <Icon name="x" cls="icon-sm" />
          <span>Revoke</span>
        </button>
      </template>
      <template v-else>
        <select
          class="role-select"
          :value="row.role"
          :disabled="selfLocked || roleChangeBusy"
          :title="selfLocked ? 'Transfer ownership to change your own role' : ROLE_TOOLTIP"
          @change="onRoleChange"
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          type="button"
          class="icon-btn"
          :disabled="selfLocked"
          :aria-label="selfLocked ? 'Remove member (disabled — transfer ownership first)' : 'Remove member'"
          :title="selfLocked ? 'Transfer ownership before removing yourself' : 'Remove member'"
          @click="emit('remove', row.id)"
        >
          <Icon name="trash2" cls="icon-sm" />
        </button>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Verify**

```bash
cd app && npx eslint src/components/MemberCard.vue src/styles/base.css 2>&1
```
`eslint` doesn't lint `.css`, so this only checks the `.vue` file — expect
no output. Then visually confirm no other file broke: `npm run build`
(catches any stray reference to a removed CSS class breaking Vue template
compilation — it won't, since CSS classes aren't compile-checked, but this
also catches any syntax error in the new files). Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MemberCard.vue app/src/styles/base.css
git commit -m "feat(ui): add MemberCard.vue + Manage Access styles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — `ManageAccessModal.vue`

**Files:**
- Create: `app/src/components/ManageAccessModal.vue`

**Interfaces:**
- Consumes: `useReportMembers()` (Task 6), `MemberCard.vue` (Task 7),
  `useModalFocus` (existing, from this session's a11y fixes — signature:
  `useModalFocus(isOpenRefOrGetter, containerRef)`).
- Produces: `ManageAccessModal` component. Props: `open: Boolean
  (required)`, `reportId: String (required)`, `currentUserId: String
  (required)`. Emits: `close`, `membership-changed` (fired after a
  successful ownership transfer, since the current user's own role may
  have changed — the parent must refresh its `myRole`/`isOwner`).

- [ ] **Step 1: Write the component**

```vue
<script setup>
// Manage Access — full CRUD module (2026-08-24 design spec, Task 8).
// Self-contained: owns its own fetch/mutate lifecycle. Only tells its
// parent something changed via `membership-changed`, since an ownership
// transfer can change the CURRENT user's own role — something only the
// parent (which computed myRole/isOwner from its own report load) can
// refresh.
import { ref, computed, watch } from 'vue'
import { useReportMembers } from '../composables/useReportMembers'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from './icons/Icon.vue'
import MemberCard from './MemberCard.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  reportId: { type: String, required: true },
  currentUserId: { type: String, required: true },
})
const emit = defineEmits(['close', 'membership-changed'])

const {
  fetchMembers,
  inviteMember,
  resendInvite,
  revokeInvite,
  updateMemberRole,
  removeMember,
  transferOwnership,
} = useReportMembers()

const modalBox = ref(null)
useModalFocus(
  () => props.open,
  modalBox,
)

const loading = ref(true)
const loadError = ref('')
const rows = ref([])

async function load() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await fetchMembers(props.reportId)
  loading.value = false
  if (error) {
    loadError.value = error
    return
  }
  rows.value = data
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    viewStep.value = 'list'
    addOpen.value = false
    load()
  },
)

function close() {
  emit('close')
}
function onModalKeydown(e) {
  if (e.key === 'Escape') close()
}

// ---------------------------------------------------------------------
// Search / sort / filter
// ---------------------------------------------------------------------
const search = ref('')
const sort = ref('name')
const filter = ref('all')

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'pending', label: 'Pending' },
]

const visibleRows = computed(() => {
  let list = rows.value

  if (filter.value === 'pending') {
    list = list.filter((r) => r.status === 'pending')
  } else if (filter.value !== 'all') {
    list = list.filter((r) => r.status === 'active' && r.role === filter.value)
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (r) => (r.full_name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q),
    )
  }

  const sorted = [...list]
  if (sort.value === 'name') {
    sorted.sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''))
  } else if (sort.value === 'role') {
    const order = { owner: 0, editor: 1, viewer: 2 }
    sorted.sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3))
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  return sorted
})

// ---------------------------------------------------------------------
// Add member (inline expand/collapse under +Add, not a nested modal)
// ---------------------------------------------------------------------
const addOpen = ref(false)
const newEmail = ref('')
const newRole = ref('viewer')
const addBusy = ref(false)
const addError = ref('')

function toggleAdd() {
  addOpen.value = !addOpen.value
  addError.value = ''
}

async function submitAdd() {
  addError.value = ''
  addBusy.value = true
  const { error } = await inviteMember(props.reportId, newEmail.value, newRole.value)
  addBusy.value = false
  if (error) {
    addError.value = error
    return
  }
  newEmail.value = ''
  addOpen.value = false
  await load()
}

// ---------------------------------------------------------------------
// Per-row actions
// ---------------------------------------------------------------------
const roleChangeBusy = ref({})

const viewStep = ref('list') // 'list' | 'transfer-confirm'
const pendingTransfer = ref(null) // { memberId, name }

function onRoleChange(memberId, newRoleValue) {
  if (newRoleValue === 'owner') {
    const row = rows.value.find((r) => r.id === memberId)
    pendingTransfer.value = { memberId, name: row?.full_name || row?.email || 'this member' }
    viewStep.value = 'transfer-confirm'
    return
  }
  applyRoleChange(memberId, newRoleValue)
}

async function applyRoleChange(memberId, newRoleValue) {
  roleChangeBusy.value = { ...roleChangeBusy.value, [memberId]: true }
  const { error } = await updateMemberRole(memberId, newRoleValue)
  roleChangeBusy.value = { ...roleChangeBusy.value, [memberId]: false }
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function confirmTransfer() {
  if (!pendingTransfer.value) return
  const { memberId } = pendingTransfer.value
  const { error } = await transferOwnership(props.reportId, memberId)
  viewStep.value = 'list'
  pendingTransfer.value = null
  if (error) {
    loadError.value = error
    return
  }
  await load()
  emit('membership-changed')
}

function cancelTransfer() {
  viewStep.value = 'list'
  pendingTransfer.value = null
}

async function onRemove(memberId) {
  const { error } = await removeMember(memberId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function onResend(inviteId) {
  const { error } = await resendInvite(props.reportId, inviteId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}

async function onRevoke(inviteId) {
  const { error } = await revokeInvite(props.reportId, inviteId)
  if (error) {
    loadError.value = error
    return
  }
  await load()
}
</script>

<template>
  <div class="modal-overlay" :class="{ open }" :inert="!open" @click.self="close" @keydown="onModalKeydown">
    <div ref="modalBox" class="modal-box modal-box--members" role="dialog" aria-modal="true">
      <template v-if="viewStep === 'list'">
        <div class="manage-access-header">
          <h2>Manage access</h2>
          <button type="button" class="btn primary" @click="toggleAdd">
            <Icon name="plus" cls="icon-sm" />
            <span>Add</span>
          </button>
        </div>

        <div v-if="addOpen" class="manage-access-add-panel">
          <div class="auth-field">
            <label class="auth-label" for="manage-access-email">Invite by email</label>
            <input
              id="manage-access-email"
              v-model="newEmail"
              type="email"
              class="auth-input"
              :disabled="addBusy"
              placeholder="teammate@example.com"
            />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="manage-access-role">Role</label>
            <select id="manage-access-role" v-model="newRole" class="auth-input" :disabled="addBusy">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <p v-if="addError" class="auth-error">{{ addError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn" :disabled="addBusy" @click="addOpen = false">Cancel</button>
            <button type="button" class="btn primary" :disabled="addBusy" @click="submitAdd">
              {{ addBusy ? 'Sending…' : 'Send invite' }}
            </button>
          </div>
        </div>

        <div class="manage-access-toolbar">
          <div class="search-wrap">
            <Icon name="search" cls="icon search-icon" />
            <input
              v-model="search"
              type="search"
              class="search-input"
              placeholder="Search members…"
              aria-label="Search members"
              autocomplete="off"
            />
          </div>
          <select v-model="sort" class="auth-input manage-access-sort" aria-label="Sort members">
            <option value="name">Sort: Name</option>
            <option value="role">Sort: Role</option>
            <option value="recent">Sort: Recently added</option>
          </select>
        </div>
        <div class="manage-access-filters">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            class="filter-chip"
            :class="{ active: filter === f.value }"
            @click="filter = f.value"
          >
            {{ f.label }}
          </button>
        </div>

        <p v-if="loadError" class="auth-error">{{ loadError }}</p>

        <div class="manage-access-list">
          <p v-if="loading" class="empty-hint">Loading members…</p>
          <p v-else-if="visibleRows.length === 0" class="empty-hint">No members match.</p>
          <MemberCard
            v-for="row in visibleRows"
            :key="`${row.kind}-${row.id}`"
            :row="row"
            :is-self="row.user_id === currentUserId"
            :role-change-busy="!!roleChangeBusy[row.id]"
            @role-change="onRoleChange"
            @remove="onRemove"
            @resend="onResend"
            @revoke="onRevoke"
          />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" @click="close">Close</button>
        </div>
      </template>

      <template v-else>
        <h2>Transfer ownership?</h2>
        <p>
          {{ pendingTransfer?.name }} becomes the owner. You'll be moved to Editor. This can't be undone from
          here — the new owner would need to transfer it back.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn" @click="cancelTransfer">Cancel</button>
          <button type="button" class="btn danger" @click="confirmTransfer">Transfer ownership</button>
        </div>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
cd app && npx eslint src/components/ManageAccessModal.vue && npm run build
```
Expected: both clean/succeed. (Full interaction testing happens in Task 9,
once it's actually wired into a page — this step only confirms the
component compiles and lints on its own.)

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ManageAccessModal.vue
git commit -m "feat(ui): add ManageAccessModal.vue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend — wire `ManageAccessModal.vue` into `ReportView.vue`

**Files:**
- Modify: `app/src/views/ReportView.vue`

**Interfaces:**
- Consumes: `ManageAccessModal.vue` (Task 8), existing `report`, `user`,
  `load()`, `manageOpen`, `onDocumentKeydown` (all already in this file).

- [ ] **Step 1: Import the new component**

Add near the other component imports (after `import ProgressBar from
'../components/ProgressBar.vue'`):
```js
import ManageAccessModal from '../components/ManageAccessModal.vue'
```

- [ ] **Step 2: Remove the now-owned-by-the-modal script state**

Delete (they now live inside `ManageAccessModal.vue`/`useReportMembers.js`):
- `manageModalBox` and its `useModalFocus(manageOpen, manageModalBox)` call
  (lines 346–347)
- `inviteValue`, `inviteRole`, `inviteBusy`, `inviteError`, `inviteSuccess`,
  `submitInvite` (lines 348–372)
- `roleChangeBusy`, `handleRoleChange`, `handleRemoveMember` (lines 375–408)

Keep `manageOpen` itself — still needed for the trigger button and the
PDF-capture snapshot logic in `handleDownloadPdf`.

- [ ] **Step 3: Remove the now-redundant ESC branch**

In `onDocumentKeydown`, remove the block that closes `manageOpen`
(`ManageAccessModal` now owns its own ESC handling internally):
```js
  // AA audit: Manage Access previously had no ESC route out at all.
  if (manageOpen.value) {
    manageOpen.value = false
    return
  }
```
(Leave the `confirmModal`/`reportModalOpen` branches above it untouched —
those still belong to this file.)

- [ ] **Step 4: Add the membership-changed handler**

Near `handleDeleteReport`, add:
```js
// After a successful ownership transfer inside ManageAccessModal, the
// current user's own role may have changed — re-load so isOwner/myRole
// (both derived from `members`) reflect it.
async function onMembershipChanged() {
  await load()
}
```

- [ ] **Step 5: Replace the inline modal markup**

Replace the entire block from `<!-- Manage Access modal (owner-only) -->`
through its closing `</div>` (the block starting `<div class="modal-overlay"
:class="{ open: manageOpen }" ...>` and ending after `</div>` for that
modal — everything currently at lines ~749–818) with:
```html
  <!-- Manage Access modal (owner-only) -->
  <ManageAccessModal
    :open="manageOpen"
    :report-id="reportId"
    :current-user-id="user?.id"
    @close="manageOpen = false"
    @membership-changed="onMembershipChanged"
  />
```

- [ ] **Step 6: Verify — lint, build, then full manual browser pass**

```bash
cd app && npx eslint src/views/ReportView.vue && npm run build
```
Expected: both clean.

Then, with the dev server running and logged in as the owner of a test
report (reuse the credential-handoff flow from earlier this session — you
type the login, hand back control):
1. Open the report → Manage Access. Confirm the card list renders with
   real names/emails (not raw UUIDs) for existing members.
2. Click **+ Add**, invite a new email as Viewer. Confirm it appears in
   the list with a **Pending** badge and **Resend**/**Revoke** buttons.
3. Click **Revoke** on it. Confirm it disappears from the list (filtered
   out — status is no longer `pending`).
4. Search, then each filter chip, then each sort option — confirm the
   list updates correctly for each.
5. On your own (owner) row: confirm the role `<select>` and the trash
   icon-button are both disabled, with a tooltip on hover explaining why
   (real hover check, not just DOM inspection — this session already hit
   one false-positive finding from skipping that step).
6. On another member's row, change the role dropdown to **Owner**.
   Confirm the "Transfer ownership?" panel replaces the list, showing
   their name. Click **Transfer ownership**. Confirm: the modal returns to
   the list, that member now shows role Owner, your own row now shows
   Editor, and (leave Manage Access open or reopen it) your own row's
   role select and trash button are no longer disabled — `isOwner` on the
   page's own header controls (Delete report, etc.) should also now be
   gone, confirming `onMembershipChanged` actually refreshed `ReportView`'s
   state.
7. Press **Escape** and separately click the backdrop — confirm both close
   the modal (same real-keyboard/real-click verification pattern used
   earlier this session, not just checking DOM properties).

- [ ] **Step 7: Commit**

```bash
git add app/src/views/ReportView.vue
git commit -m "feat(ui): wire ManageAccessModal.vue into ReportView.vue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan spec coverage check

- Identity resolution (name/email/avatar, not UUID) → Tasks 1, 6, 7.
- Pending invites list (resend/revoke) → Tasks 2, 5, 6, 7, 8.
- Self-action guards + ownership transfer → Tasks 4, 8.
- Role tooltips + search/sort/filter → Tasks 7, 8.
- Lightweight audit trail (role/membership changes) → Task 3.
- Link-sharing, presence → explicitly out of scope (spec §"Locked scope").
