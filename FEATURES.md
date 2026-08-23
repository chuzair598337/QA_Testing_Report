# Features

A catalog of every feature currently in the app. Update this file whenever a
feature is added, changed, or removed — this is the source of truth for
"what does the app do," kept separate from [README.md](README.md) (setup,
workflow, JSON schema, design rules) so it can be edited on its own without
touching the more stable docs.

**How to maintain this file:** one bullet per feature, grouped under the
section it belongs to (add a new section if none fit). Keep each bullet to
one or two lines — a short *what it does*, not implementation detail. If a
change alters existing behavior, edit the bullet in place rather than
appending a changelog entry; this file describes current behavior, not
history (git log is the history).

**Coming Soon Features** (second-to-last section) is the backlog — proposed
features not built yet. When one gets implemented: move its bullet out of
Coming Soon and into the section above it belongs to (rewritten as shipped
behavior, not a proposal), and delete it from Coming Soon. Nothing lives in
both places at once.

**Not Required** (last section) is for features considered and explicitly
declined — kept for reference so they don't get re-proposed, not expected to
graduate the way Coming Soon bullets are.

## Accounts & access

- **Sign up / log in** — email + password, magic link, or Google OAuth.
  Password reset via emailed link. Sessions persist via `supabase-js`'s
  default `localStorage`-backed session — the one deliberate reversal of
  the legacy app's "no `localStorage`" rule.
- **Known limitation:** confirmation/magic-link/invite/reset-password
  emails currently use Supabase's default templates, which only work
  reliably when opened on the same browser/device that requested them
  (see README's [Invites & RBAC](README.md#invites--rbac) section).
- **Dashboard** — every report you're a member of, newest first, each with
  its own stat tiles (Total/Pass/Fail/Pass %), a mini progress bar, and
  your role badge. Owner-only quick actions (Manage access, Delete) are
  hidden for editors/viewers.
- **Create report** — a title plus a JSON test-case file (same schema as
  always — see README). Validated client-side, then: the report row is
  created, the raw file is archived to a private Storage bucket, and the
  parsed modules/sub-modules/tests are written to Postgres — all rolled
  back together if any step fails, so a bad import never leaves a
  half-created report behind.
- **Invite by email** — an owner invites a teammate as Editor or Viewer.
  An existing account is added immediately; a brand-new email gets an
  invite email and is attached automatically once they finish signing up.
- **Owner / Editor / Viewer roles**, enforced server-side (RLS is the real
  boundary, not the UI): owners manage membership, structure, and
  archive/delete; editors can update a test's status/note only; viewers are
  read-only. A sole owner can't accidentally demote or remove themselves
  out of their own report.
- **Manage Access panel** — member list with role dropdowns and a remove
  action, reached from the report view.
- **Archive / restore** — "Delete" is a soft delete (`archived_at`), hidden
  from the Dashboard by default behind a "Show deleted reports" toggle,
  with an owner-only Restore action. No hard delete exists.

## Core workflow

- **Import** (at report-creation time) — loads a test-case JSON file
  (schema in README) into the new report. Malformed JSON or a payload
  missing a required field is rejected inline; nothing is written until
  the whole file validates.
- **Pass / Fail / Pending status** per test case, plus an optional free-text
  note, editable inline. Status saves immediately; notes autosave ~500ms
  after you stop typing. Both persist across reload and across devices —
  everyone with access sees the same live state.
- **Export → Download JSON** — downloads the current suite (same schema,
  every test's `status`/`note` filled in) to send back to dev.
- **Export → Download PDF** — a printable snapshot of the current state
  (everything expanded, filters cleared) via `html2pdf.js`.

## Organization & navigation

- **Module → sub-module → test case** hierarchy, auto-numbered (`1`,
  `1.1`, `1.1.1`) from JSON array order.
- **Collapse / expand** modules and sub-modules (collapsed by default);
  each header shows a mini pass/fail progress bar and `done/total` count.
- **Pin / unpin** a module or sub-module to a pinned bar under the header
  for quick access; click a pinned chip to jump to it. A pinned module/
  sub-module also carries its own pin icon next to its title (alongside
  the lock icon when both apply), matching how locked ones are marked.
- **Lock / unlock** a module or sub-module — locked cases can't have their
  status or note edited, and a locked card auto-collapses and can't be
  expanded again until unlocked. Since locked content only actually renders
  expanded during PDF export (the live UI keeps it collapsed), each locked
  test row also carries its own lock icon there, not just a border/opacity
  dim, so it stays unambiguous in a printed/exported report.
- **Pin/lock icons are bold and red** (`--fail`, theme-aware — same in
  light and dark mode) and drawn larger than the default icon size, so
  they actually read at a glance next to a title instead of blending in;
  pin and lock share the same color now, told apart by icon shape (pin vs.
  padlock) rather than color.
- **Jump navigation** — dropdowns to jump straight to a module or
  sub-module, auto-expanding it and scrolling it into view.
- **Bulk actions** — "Mark all Pass" / "Mark all Fail" / "Mark all Pending"
  in the same Pin/Lock "more options" menu, at both module (every test
  across all its sub-modules) and sub-module scope. Prompts for
  confirmation only when it would overwrite existing Pass/Fail results
  (naming how many); marking still-Pending tests, or re-marking tests
  already at the target status, applies immediately. Disabled when the
  module/sub-module is locked (or its parent module is, for a sub-module)
  or has nothing to mark.

## Filtering

- **Search box** — live, as-you-type text search across test case text, on
  the same row as the jump-nav dropdowns (stacks full-width below it on
  mobile). Independent of the KPI status filter — both apply together, a
  case has to match whichever of the two are active. Has its own clear
  button; clears automatically on a fresh import or when jump nav is used
  (either could otherwise hide the thing being jumped to).
- **KPI cards as filters** — the Total/Passed/Failed/Pending stat cards in
  the header are clickable; clicking one filters the list to that status
  (Total clears the filter). The active card is highlighted.
- **Filtered-out empty state** — search and/or the status filter matching
  nothing shows its own message (worded for whichever combination is
  active) with a "Show all cases" reset, instead of a blank list.
- Modules/sub-modules with no matching case under an active filter (status
  and/or search) are hidden entirely; matching ones auto-expand while a
  filter is active and restore their saved collapsed state once cleared.

## Reporting (Export → Generate report)

- **Report preview modal** — every Passed/Failed case (Pending omitted), in
  suite order, with notes.
- **Report settings (cog button)** — filters which cases the report
  includes: **All**, **Passed**, **Passed with note**, **Failed only**. All
  and the three specific filters are mutually exclusive as a group;
  checking more than one specific filter unions them (e.g. Passed-with-note
  + Failed-only shows both). Preview, Copy, and Download all respect it.
- **Copy to clipboard** — writes a rich `text/html` payload that renders as
  actual formatted text (headings, bold, paragraphs) when pasted into
  Microsoft Teams, Word, Outlook, or Slack, alongside a clean `text/plain`
  fallback (no markdown syntax) for paste targets that don't accept rich
  HTML.
- **Download** — saves the report as a real `.md` file using Microsoft
  Teams' typed-markdown subset (`#`/`##`/`###` headings, `**bold**`, `>`
  blockquote notes) — meant for markdown-aware tools, not for pasting.
- **Empty-report toast** — clicking Generate report with no passed/failed
  cases at all (regardless of the report-setting filter) shows a toast
  instead of opening an empty modal.

## UI / UX

- **Light / dark theme toggle**, defaulting to the OS/browser's
  `prefers-color-scheme` on first load; kept for the session.
- **Responsive layout** — sticky header chrome; a mobile hamburger menu
  (icon-only actions collapse into a dropdown panel) below the `900px`
  breakpoint, with a further density tier at `680px` and the most
  aggressive shrink at `480px`; touch-friendly controls throughout. The
  import-replace confirm dialog's Export/Discard action row stacks
  full-width below `480px` instead of squeezing side by side. The sticky
  header (`.head-chrome`) is a top-level element, not nested inside a
  tightly-fit wrapper — CSS sticky positioning is bounded by its
  containing block's own extent, so nesting it inside a short wrapper
  would let it detach and scroll away once that wrapper's box (shrunk
  further by the KPI block collapsing on scroll) had fully scrolled past.
- **Collapsible KPI/progress/jump-nav on scroll** — that block hides while
  scrolling down through the test list and reappears on scroll-up or near
  the top, giving short/landscape screens their vertical space back without
  losing the sticky title/actions row above it.
- **Toast notifications** for transient feedback (e.g. empty-report
  gate, Reset-all Undo) that auto-dismiss. Appears from the top, positioned
  dynamically just below whatever header chrome is actually visible right
  now (title/actions row, plus the KPI/search/jump block when it's still
  in view) so it never covers real controls — not a fixed pixel offset.
  Full-width (minor horizontal margin) below the `480px` breakpoint instead
  of a centered pill.
- **Disabled buttons show a "not-allowed" cursor**, not a loading spinner —
  Export (and any other disabled `.btn`) previously used
  `cursor:progress`, which reads as "something is loading" when the
  control is simply unavailable (e.g. no suite loaded yet).
- **Empty states** for: a report you're not a member of / doesn't exist (a
  friendly access-denied message, still a real page — not a 404), a JSON
  file with no test cases, and a filter with no matches (Show all cases).
- Suite-wide chrome (KPI cards, filters, jump nav, pinned bar) stays hidden
  until a report finishes loading, then shows even if it has zero tests.

## Safety

- **HTML-escaping** on every test title/test-text/note is inherent to how
  Vue renders text (template interpolation escapes by default) — a
  `<`/`>` in test data can't break rendering or inject markup.
- **Row Level Security (RLS) is the real access-control boundary** — every
  role check the UI does (disabled controls, hidden panels) is a
  convenience; Postgres policies are what actually accept or reject a
  request, checked server-side regardless of what the client sends.
- **The service-role key never reaches the browser** — the one operation
  that needs it (email-based invites) runs in a Supabase Edge Function,
  not client code.
- **`html2pdf.js` is a regular npm dependency**, code-split into its own
  chunk so it only loads when Download PDF is actually used — no CDN
  script tag.

## Coming Soon Features

Proposed, not yet built. See the note at the top of this file for how a
bullet graduates out of this section once it ships.

- **Cross-device confirmation/invite/reset links** — customize Supabase's
  email templates to use a `token_hash`-based link instead of the default
  PKCE code-exchange one, so these links work regardless of what
  browser/device opens them. Needs either a Supabase Pro-plan upgrade or a
  custom Send Email hook (both were deferred for v1) — see README's
  [Invites & RBAC](README.md#invites--rbac) section.
- **Leaked-password protection** — Supabase's HaveIBeenPwned check, a
  Pro-plan-and-above feature. Free plan for v1; flip on anytime after
  upgrading, no migration needed.
- **Separate Supabase project for Preview deployments** — Preview and
  Production currently share one project/database. Worth doing if isolated
  preview data ever actually matters; not needed for v1.
- **Re-import over an existing report** — replacing an already-created
  report's test data with a revised JSON file, in place, rather than only
  at creation time. The RLS policies already allow owner-only structural
  writes that this would use; the UI flow itself isn't built yet.
- **Member display names in Manage Access** — members are currently shown
  by raw User ID (no `profiles` table exists yet to resolve one to an
  email/display name).
- **Reset all** — the legacy app's "set every test back to Pending, clear
  all notes" action (with a one-level Undo) wasn't carried over in this
  migration; re-add if the workflow needs it.
- **Drag-and-drop file picker** for the create-report JSON upload — the
  legacy app's drag-anywhere-on-the-page import wasn't carried over; report
  creation currently uses a plain file input.
- **Ad-hoc multi-select bulk actions** — a checkbox-based selection across
  arbitrary test rows (not just a whole module/sub-module) with its own
  bulk-mark toolbar. Deferred v2 of the module/sub-module-level bulk
  actions already shipped (see Organization & navigation) — needs a
  checkbox column, a floating toolbar, and select-all, for a rarer use case
  than "this whole section trivially passes."
- **Keyboard shortcuts** — advance to the next pending test and mark it
  Pass/Fail without leaving the keyboard, for faster work on large suites.
- **Modal focus return** — closing the confirm or report modal returns
  keyboard focus to whatever button opened it, instead of dropping it.
- **Tab-title progress indicator** — the browser tab title reflects live
  pass/fail counts (e.g. `3 failed · QA Testing Report`), so progress is
  visible from a background tab without switching back.
- **Duplicate-file / merge-progress path** — a second Import mode that loads
  a base/revised suite and merges in status/notes from a previously
  exported results file, matched by module+sub-module+test-text (not
  position, since array order can change) rather than replacing everything.
- **Changed-since-last-import diff** — when a revised suite is imported over
  an existing one, highlight which modules/sub-modules/tests are new or
  changed instead of a silent full replace.
- **Per-test/module owner field** — an optional assignee so a suite split
  across multiple QA testers can show who owns what.

## Not Required

Considered and explicitly declined, kept here so they don't get
re-proposed. Unlike Coming Soon, nothing here is expected to graduate —
move a bullet out only if a real need for it actually shows up later.

- **Per-test screenshot/attachment** — attaching or linking an
  image/screenshot to a test's note, beyond the existing free-text note
  field. Decided not needed.
- **Native print stylesheet independent of `html2pdf.js`** — a `@media
  print` fallback for Download PDF that doesn't depend on `html2pdf.js`
  loading from its CDN. Printing isn't a required capability for this app.
