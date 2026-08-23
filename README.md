# QA Testing Report

A multi-user QA test-run app: a Vue 3 + Vite front end (in `app/`), Supabase
for Auth + Postgres + Storage + one Edge Function, hosted on Vercel with
automatic Git-based deploys. Testers sign in, create reports from a JSON
test-case file, and work through a checklist together — status/note edits
persist immediately, and access is shared per report via Owner/Editor/Viewer
roles.

See [FEATURES.md](FEATURES.md) for the full, maintained catalog of what the
app does — update it whenever a feature is added or changed.

This supersedes an earlier zero-build, single-sitting, GitHub-Pages-hosted
version of this app (the legacy `index.html`/`js/`/`css/` at the repo root).
The core JSON schema and most of the interactive-checklist behavior carried
over unchanged; what's new is persistence, multi-user accounts, and RBAC.

## What this is

A dev writes a set of test cases as a JSON file (same schema as before — see
[JSON schema](#json-schema)) and sends it to QA. A QA owner signs in, creates
a report, and imports that file: it's parsed client-side, archived as a raw
backup in Supabase Storage, and normalized into `modules`/`sub_modules`/
`tests` rows in Postgres. The owner then invites teammates by email as
Editors (can update test status/notes) or Viewers (read-only). Everyone
works through the same live checklist — status changes save immediately,
notes autosave a moment after you stop typing — and the owner can export a
JSON/PDF snapshot or generate a Markdown report of passed/failed cases at
any point.

Unlike the legacy static app, work is **persisted, not per-sitting** —
closing the tab or coming back tomorrow doesn't lose anything. What
carried over unchanged: the same JSON schema for authoring test cases, the
same interactive-checklist UI (filters, jump-nav, pin/lock, collapse,
PDF/JSON export, Generate report), the same visual design tokens.

## Workflow

1. **Dev** writes the test cases as a JSON file matching the schema below
   (see [Authoring test cases](#authoring-test-cases)) — unchanged from the
   legacy app.
2. **Owner** signs up/logs in (email+password, magic link, or Google), then
   creates a report: a title, plus that JSON file. The app validates the
   shape, archives the raw file to a private Storage bucket, and writes the
   parsed modules/sub-modules/tests to Postgres.
3. **Owner** invites teammates by email as Editor or Viewer, from the
   report's Manage Access panel. An existing account is added immediately;
   a brand-new email gets an invite email and is attached automatically the
   moment they finish signing up.
4. **Editors/Owner** work through every test case: set each to Pass/Fail,
   add notes, use filters/jump-nav/pin/lock/collapse to navigate a large
   suite. **Viewers** see the same checklist read-only.
5. Anyone with access can **Export → Download JSON** (same schema, every
   `status`/`note` filled in) to send a results snapshot back to dev, or
   **Export → Download PDF** for a printable snapshot, or **Export →
   Generate report** for a Markdown/rich-text summary of passed/failed
   cases with Copy and Download actions.
6. **Owner** can archive a report (soft delete, restorable) once it's done.

## Tech stack & architecture

- **Frontend**: Vue 3 + Vite, in `app/` (not the repo root — see
  [File structure](#file-structure) for why). `vue-router` with
  `createWebHistory()` (clean paths, no `#`).
- **Backend**: Supabase — Postgres (schema + RLS), Auth (email/password,
  magic link, Google OAuth, password reset), Storage (private
  `report-uploads` bucket), and one Edge Function (`invite-member`, for the
  one operation that needs the service-role key — see
  [Invites](#invites-rbac) below).
- **Hosting**: Vercel. Builds and deploys automatically on every push
  (Production on the connected branch, Preview on every other branch/PR) —
  see [Deployment](#deployment).
- **RLS is the real enforcement boundary.** Every role check in the UI
  (disabled buttons, hidden panels) is a convenience, not the security
  mechanism — Postgres Row Level Security policies are what actually decide
  what a request can read or write, regardless of what the client sends.

### Invites & RBAC

Three roles per report: `owner`, `editor`, `viewer`. Owners manage
membership and structure (modules/sub-modules, re-import, archive/delete);
editors can update a test's `status`/`note` only — enforced by a Postgres
trigger, not just the UI; viewers are read-only.

Inviting by email needs a small server-side piece: resolving an email to an
account (or creating one) requires Supabase's admin API, which needs the
service-role key — that key must never reach the browser, so this one
operation lives in the `invite-member` Edge Function
(`supabase/functions/invite-member/`) instead of client code. The function
verifies the caller actually owns the report (via the caller's own JWT
against RLS) *before* touching anything privileged. An existing account is
added directly; a new account gets an invite email, and a Postgres trigger
(`on_auth_user_created_attach_invite`, gated on `auth.users.invited_at` so a
regular signup can't forge the same metadata to grant itself access) attaches
their membership the moment they finish signing up.

**Known v1 limitation:** confirmation, magic-link, invite, and
password-reset emails currently use Supabase's default templates, which rely
on a PKCE code-exchange that only works if the link is opened in the same
browser/device that requested it (Supabase's own documented limitation).
Customizing the templates to sidestep this needs either a paid Supabase plan
or a custom email-sending hook — deferred for v1. Tell testers to open these
links on the same device they signed up / requested from.

**Also currently off:** Supabase's leaked-password-protection (HaveIBeenPwned
check) is a Pro-plan-and-above feature — this project is on the Free plan, so
it's disabled. No migration impact; flip it on anytime after upgrading.

## Deployment

Branch flow: `development → staging → main`. `development` is where
feature/task branches fork from and PR back into; `staging` is promoted from
`development` for preview/UAT; `main` is production. Both `staging` and
`main` require a passing CI check (`.github/workflows/ci.yml` — lint, build,
`npm audit`) before merge.

Vercel builds and deploys automatically on every push — no manual build step:

- **Production**: `main`, at the project's default domain plus
  `qa-testing-report-git-main-<team>.vercel.app`.
- **Staging**: `staging`, at its own stable branch alias,
  `qa-testing-report-git-staging-<team>.vercel.app` — Vercel assigns this
  automatically per branch, no manual domain config needed.
- **Preview**: every other branch/PR (including `development`) gets its own
  Preview URL (`qa-testing-report-<hash>-<team>.vercel.app`, or the same
  `git-<branch>-<team>` pattern for `development`).
- Build command (`vercel.json`, repo root): `cd app && npm install && npm run
  build`, output `app/dist` — the Vue app lives in a subdirectory (see below),
  so the root `vercel.json` points the build there rather than needing a
  Vercel "Root Directory" project-setting change.
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are
  set in Vercel Project Settings, scoped to Production/Preview/Development —
  never committed to the repo. `app/.env.local` (gitignored) holds real
  values for local dev only; `app/.env.example` documents the shape.
- **Two Supabase projects, one per environment tier**:
  - `pmrsojsxqjbzeikjgewe` ("QA_Testing_Report") — **Production only**. Holds
    real user data; never point Preview/Development builds at it.
  - A second project ("QA_Testing_Report-staging-dev") backs **Staging and
    Development** — same schema (all migrations under `supabase/migrations/`
    applied to both), same `invite-member` Edge Function, isolated data.
  - Vercel's Production env vars point at the first; Preview + Development
    env vars point at the second.

## File structure

| Path | Responsibility |
| --- | --- |
| `app/` | The Vue 3 + Vite app — everything below is relative to here. |
| `app/src/main.js`, `app/src/App.vue` | App entry point and root component. |
| `app/src/router/index.js` | Routes (`createWebHistory()`) + the auth guard (`beforeEach`, redirects unauthenticated access to `/login`). |
| `app/src/lib/supabaseClient.js` | The shared `supabase-js` client (PKCE flow), reading `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. |
| `app/src/lib/database.types.ts` | Generated TypeScript types from the live Postgres schema (`generate_typescript_types`) — regenerate after any schema change. |
| `app/src/stores/useAuth.js` | Session/user state + all auth actions (sign in/up/out, magic link, OAuth, password reset). |
| `app/src/stores/useReports.js` | Dashboard/report data access: fetch, create (with rollback), archive/unarchive, invite, membership, test status/note writes. |
| `app/src/stores/useReportRunner.js` | Loads one report's full tree, computes client-side-only display numbering (`1`, `1.1`, `1.1.1`) and stats. |
| `app/src/composables/useTheme.js` | Light/dark theme toggle, session-only, ported from the legacy app unchanged. |
| `app/src/composables/useTreeUiState.js` | Client-only pin/lock/collapse/menu state — never persisted. |
| `app/src/composables/useImportExport.js` | `downloadJson`, `downloadPdf` (`html2pdf.js`), and the Generate-report builders. |
| `app/src/views/` | `LoginView`, `SignupView`, `ResetPasswordView`, `AuthCallbackView`, `InviteView`, `DashboardView`, `ReportView`, plus the Phase 1 placeholder `HomeView` at `/`. |
| `app/src/components/` | `ModuleCard`, `SubModuleCard`, `TestRow`, `StatTiles`, `ProgressBar`, `SocialAuthButtons`, `icons/Icon.vue` (inline SVG lookup, ported from legacy `ICON_PATHS`). |
| `app/src/styles/` | `tokens.css` (design tokens), `base.css`, `responsive.css` — ported from the legacy `css/` unchanged where the design didn't need to change. |
| `supabase/migrations/` | Every schema/RLS/grant change applied to the live project, in order — the actual source of truth for the database is Supabase itself; these are the version-controlled record of how it got that way. |
| `supabase/functions/invite-member/` | Source for the deployed Edge Function (see [Invites & RBAC](#invites--rbac)). |
| `vercel.json` (repo root) | SPA rewrite rule + the `cd app &&` build command (see [Deployment](#deployment)). |
| `Makefile` (repo root) | `make dev`/`build`/`preview`/`install`/`clean`/`status` — wraps `cd app && npm run <x>` so you don't have to. |
| `vue-migration-test-suite.json` | A living regression-test suite (same schema as below) covering this migration's own phases — import it into the app to track its own QA. |
| `sample.json` | Demo test-case data, same schema, used by the create-report flow's own tests. |

No GitHub Actions workflow — Vercel's native Git integration handles builds
(see [Deployment](#deployment)); the legacy `.github/workflows/pages.yml`
was deleted, not replaced.

## JSON schema

The same shape is used for the file dev sends (imported when creating a
report) and the file exported back out via **Download JSON** — unchanged
from the legacy app.

```json
{
  "docTitle": "Onboarding Test Suite — Q3 Release",
  "modules": [
    {
      "title": "Onboarding — Freelancer",
      "subModules": [
        {
          "title": "00–01 · Account Creation & Email Verification",
          "tests": [
            {
              "text": "Sign-up form validates required fields and email format",
              "status": "pending",
              "note": ""
            }
          ]
        }
      ]
    }
  ]
}
```

- **`docTitle`** (string, optional) — not currently used by the report
  schema (the report's title comes from the title field typed at creation
  time); accepted but ignored on import.
- **`modules`** (array, required) — one entry per top-level module/feature
  area.
  - **`title`** (string, required) — stored as `modules.name`.
  - **`subModules`** (array, required) — one entry per screen/flow/variant
    within the module.
    - **`title`** (string, required) — stored as `sub_modules.name`.
    - **`tests`** (array, required) — the individual test cases.
      - **`text`** (string, required) — stored as `tests.name`. The
        observable, in-app assertion being tested. One clear sentence, e.g.
        *"Duplicate email shows correct error state"*.
      - **`status`** (string, optional on import) — `"pending"`, `"pass"`,
        or `"fail"`. Defaults to `"pending"` if omitted or invalid.
      - **`note`** (string, optional on import) — defaults to empty if
        omitted.

`order_index` for every module/sub-module/test is derived from array
position at import time and stored as an integer — the `1`/`1.1`/`1.1.1`
display numbers are always recomputed client-side from `order_index`, never
persisted as strings.

On import, malformed JSON or a payload missing `modules`/`title`/`subModules`
/`tests`/`text` is rejected with an inline error; nothing already loaded is
touched (the whole create-report pipeline rolls back on any failure —
storage upload, tests parse, anything — leaving no half-imported report
behind).

### Authoring test cases

The `modules` → `subModules` → `tests` array is what dev edits/generates when
preparing a handoff file — write one JSON file per QA request, matching the
schema above, and send it to the report owner to import. `status`/`note`
can be omitted entirely in that file (they default to `"pending"`/empty).

## Design/engineering rules

For anyone — human or AI — editing this repo going forward:

- **RLS is the enforcement boundary, not the UI.** Any new write path needs
  a corresponding RLS policy (and a migration file in
  `supabase/migrations/`) before it needs a UI — client-side role checks are
  a convenience layer only.
- **The service-role key never touches the client.** It's only ever read
  inside an Edge Function's own runtime (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`),
  never in `app/src/**`, never in a `VITE_`-prefixed env var.
- **`createWebHistory()`, never hash mode.** Vercel's rewrite handles SPA
  routing; a `#` in any URL breaks the PKCE redirect flows.
- **Redirects built from `window.location.origin` at call time**, never a
  hardcoded domain — this is what makes both Production and every Preview
  deployment work without per-deployment config.
- **No `alert()`.** Inline error/toast state only, throughout.
- **Icons are inline SVG** (Lucide paths, in `Icon.vue`'s `ICON_PATHS`
  lookup) — ported from the legacy app's own `ICON_PATHS`, extended the same
  way. No icon font, no external icon CDN.
- **Theming via CSS custom properties** on `:root` and
  `[data-theme="dark"]`. Any new UI must use the existing tokens (`--bg`,
  `--ink`, `--primary`, `--pass`, `--fail`, etc.), never hardcoded colors.
- **Preserve existing behavior, extend additively.** The legacy app's
  module/sub-module/test-row rendering, filters, jump nav, pinned bar,
  pin/lock, collapse-by-default, PDF export, and dark mode are all
  intentionally-preserved behavior — build on top of them rather than
  restructuring.
- **Any schema change gets a migration file** in `supabase/migrations/`
  (named `<timestamp>_<description>.sql`, matching what's actually applied
  to the live project) and, if it changes generated types, a re-run of
  `generate_typescript_types` into `app/src/lib/database.types.ts`.
- **`sample.json` and `vue-migration-test-suite.json` stay in the JSON
  schema above** if either changes.
