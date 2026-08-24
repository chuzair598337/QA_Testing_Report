# Manage Access — full CRUD module design

**Status:** Approved (design). Date: 2026-08-24.

## Context

The current "Manage access" modal (`ReportView.vue`) is a bare member list:
raw `user_id` UUIDs, a role `<select>`, delete icon, and an invite-by-email
form. This spec turns it into a real module: identity resolution, pending
invites with resend/revoke, self-action guards, ownership transfer, role
tooltips, and search/sort/filter — scoped down from a larger research list
(link-sharing and live presence were explicitly cut: link-sharing changes
the security model without being asked for, presence is novelty for a
small-team internal tool).

## Locked scope

Included: identity resolution (name/email/avatar), pending invites
(resend/revoke), self-action guards + ownership transfer, role tooltips +
search/sort/filter, lightweight audit trail (role/membership changes only).

Cut: link-sharing ("anyone with the link"), real-time presence.

## 1. Data model

### `public.profiles`
```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);
```
- Populated by a new `on_auth_user_created_profile` trigger (same shape as
  the existing `attach_invited_membership` trigger), plus a one-time
  backfill `insert into profiles select id, email, ... from auth.users
  where not exists (select 1 from profiles where profiles.id = auth.users.id)`.
- A second trigger keeps `profiles.email` in sync on `auth.users` email
  change.
- **RLS is the load-bearing part**: readable by yourself always, or by
  anyone who shares a `report_id` with you via `report_members` — *not*
  open to every authenticated user (that would let any signed-in user
  enumerate every other user's email by querying the table directly).
  ```sql
  create policy profiles_select_self on public.profiles
    for select using (id = auth.uid());
  create policy profiles_select_shared_report on public.profiles
    for select using (
      exists (
        select 1 from public.report_members rm1
        join public.report_members rm2 on rm1.report_id = rm2.report_id
        where rm1.user_id = auth.uid() and rm2.user_id = profiles.id
      )
    );
  ```

### `public.report_invites`
```sql
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
```
RLS: owner-only read/write, same predicate style as existing owner-gated
policies on `report_members`.

### `public.access_audit_log`
```sql
create table public.access_audit_log (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  target_user_id  uuid references auth.users(id),
  target_email    text,
  action          text not null check (action in (
                    'invited', 'invite_resent', 'invite_revoked',
                    'role_changed', 'removed', 'ownership_transferred'
                  )),
  detail          jsonb,
  created_at      timestamptz not null default now()
);
```
Written exclusively by DB triggers on `report_members` (insert/update/
delete) and `report_invites` (insert/update) — never by app code, so it
can't be spoofed or skipped by a client bug. RLS: owner-only read.

### Extend `attach_invited_membership`
When it auto-attaches a newly-signed-up invited user, it now:
1. Skips the insert entirely if the matching `report_invites` row
   (`report_id` + email, via `new.email`) has `status = 'revoked'`.
2. On successful attach, flips that `report_invites` row to `accepted`.

## 2. Backend

### Extend `invite-member` Edge Function
Same owner-check → rate-limit → service-role pattern it already has,
branched on a new `action` field:
- `action: 'invite'` (default/current behavior) — additionally inserts the
  `report_invites` pending row when the target has no account yet.
- `action: 'resend'` — re-calls `admin.inviteUserByEmail` for an existing
  pending row, bumps `resent_at`.
- `action: 'revoke'` — flips the row to `revoked`.

One function branched by action, not three, to avoid tripling the
auth/rate-limit boilerplate.

### New RPC `transfer_report_ownership`
```sql
create or replace function public.transfer_report_ownership(
  p_report_id uuid,
  p_new_owner_member_id uuid,
  p_old_owner_new_role text default 'editor'
) returns void
language plpgsql
security invoker
as $$
begin
  perform set_config('app.in_ownership_transfer', 'true', true);
  update public.report_members set role = p_old_owner_new_role
    where report_id = p_report_id and user_id = auth.uid() and role = 'owner';
  update public.report_members set role = 'owner'
    where id = p_new_owner_member_id and report_id = p_report_id;
  perform set_config('app.in_ownership_transfer', 'false', true);
end;
$$;
```
`security invoker` — runs under the caller's own RLS, so it only succeeds
if the caller is already the report's owner. Both updates happen inside
one function call (one transaction), so there's no window with zero or
two owners.

### New trigger `prevent_owner_self_demote_or_remove`
`before update or delete on report_members` — raises if the affected row
is the caller's own `owner` row, *unless*
`current_setting('app.in_ownership_transfer', true) = 'true'` (set by the
RPC above). Exception message is user-facing: "You can't remove or demote
yourself — transfer ownership first." This is the actual enforcement;
disabling the button in the UI is the convenience layer on top.

## 3. Frontend

```
ManageAccessModal.vue        ← modal shell: header, +Add, search/sort/filter row, list
├── MemberCard.vue           ← one row (active member OR pending invite)
└── (Add-member panel)       ← inline expand/collapse under "+Add", not a nested modal
```

New **`useReportMembers.js`** composable (split out of `useReports.js`,
which stays focused on report CRUD): `fetchMembers(reportId)` merges three
parallel queries (`report_members`, pending `report_invites`, `profiles`
for the resolved ids) into one unified list of
`{ kind: 'member' | 'invite', ... }` rows; plus `resendInvite`,
`revokeInvite` (call the extended Edge Function), `transferOwnership`
(call the RPC), and the existing `updateMemberRole`/`removeMember`.

Layout:
```
Manage access                          [+ Add]
[ Search…      ] [Sort ▾] [Filter ▾]
┌─────────────────────────────────────────┐
│ 🟢 Jane Doe (you)          OWNER          │
│    jane@example.com          [ ⋮ ]        │
├─────────────────────────────────────────┤
│ ⚪ sam@example.com  PENDING               │
│    Invited 2d ago      [Resend] [Revoke]  │
└─────────────────────────────────────────┘
```
- Active member row: avatar-initials circle, name (or email if no
  `full_name`), email as secondary line, role badge with a tooltip
  ("Owner: full access / Editor: can run tests & edit notes / Viewer:
  read-only"), right-aligned `⋮` opening role-change (picking "Owner" on
  someone else triggers the transfer-ownership confirm, reusing the
  confirm-modal a11y pattern already fixed this session) + Remove — both
  disabled with an explanatory tooltip on your own owner row.
- Pending-invite row: email + PENDING badge + relative "Invited Nd ago",
  right side is `[Resend] [Revoke]` instead of role/trash.
- Search: client-side substring match on name/email (list is small — no
  server round-trip). Sort: Name / Role / Recently added. Filter: chips
  (All / Owner / Editor / Viewer / Pending), matching the existing
  `StatTiles` filter-chip pattern rather than a dropdown, so the active
  filter stays visible.
- Empty state: "No members match" on empty search/filter result. Loading:
  skeleton rows, not a blocking spinner.

## 4. Error handling

- Duplicate pending invite → unique-index `23505` caught, shown inline as
  "Already invited."
- Rate limit → existing 429 behavior, unchanged.
- Resend/revoke race (already accepted/revoked when acted on) → no-op,
  toast "Already up to date," refresh list.
- Self-guard trigger fires → its `RAISE EXCEPTION` message surfaces via
  `error.message` as-is, no special-casing needed.
- Transfer-ownership edge cases (target already owner, transfer-to-self) →
  validated both in the UI (button hidden/disabled) and in the RPC
  (defense in depth).
- Missing profile row (pre-backfill edge case) → falls back to the raw
  email already present on `report_members`, never blocks the row.
- List load failure → same `loadError` + "Try again" pattern already used
  in `DashboardView.vue`.
- Role/remove/transfer are **not optimistic** — request, wait, refresh.
  Low-frequency admin action; correctness (esp. the single-owner
  invariant) matters more than perceived speed.

## 5. Testing

No test framework in this repo today (no Vitest/Jest — manual + ESLint
only). Staying consistent with that rather than introducing one for this
feature (explicit user decision — can add later when needed). Verification
is manual: RLS cross-report isolation, self-guard (UI *and* direct API
call), transfer-ownership atomicity, duplicate-invite handling,
revoked-invite-then-signup no-op, search/sort/filter/empty-states,
disabled-state tooltips — using real click/keyboard browser testing
(lesson from this session: DOM-property inspection alone gave a false
positive earlier; actual `.focus()`/click/key tests are the standard).
