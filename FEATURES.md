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

## Core workflow

- **Import** — loads a test-case JSON file (schema in README) into an
  interactive checklist. Malformed JSON or a payload missing a required
  field is rejected with an alert; nothing already loaded is touched.
- **Drag-and-drop import** — dropping a `.json` file anywhere on the page
  imports it the same way as the Import button, with a full-page dropzone
  overlay while dragging.
- **Pass / Fail / Pending status** per test case, plus an optional free-text
  note, editable inline.
- **Export → Download JSON** — downloads the current suite (same schema,
  every test's `status`/`note` filled in) to send back to dev.
- **Export → Download PDF** — a printable snapshot of the current state
  (everything expanded, filters cleared) via `html2pdf.js`.
- **Reset all** — sets every test back to Pending and clears all notes,
  behind a confirmation prompt.
- **In-memory only, no persistence** — no `localStorage`, no backend.
  Closing or reloading the tab without exporting first loses in-progress
  work by design. A `beforeunload` prompt warns before that happens while a
  suite is loaded.
- **Import-overwrite guard** — replacing an already-loaded suite asks for
  confirmation, with inline "export current work first" buttons (PDF/JSON/
  Report) so nothing is lost by accident.
- **Sample data** — an optional "Load sample data" action on the empty
  state, loading `sample.json`; only shown when `config.json`'s
  `showSample` is `true`.

## Organization & navigation

- **Module → sub-module → test case** hierarchy, auto-numbered (`1`,
  `1.1`, `1.1.1`) from JSON array order.
- **Collapse / expand** modules and sub-modules (collapsed by default);
  each header shows a mini pass/fail progress bar and `done/total` count.
- **Pin / unpin** a module or sub-module to a pinned bar under the header
  for quick access; click a pinned chip to jump to it.
- **Lock / unlock** a module or sub-module — locked cases can't have their
  status or note edited, and a locked card auto-collapses and can't be
  expanded again until unlocked. Since locked content only actually renders
  expanded during PDF export (the live UI keeps it collapsed), each locked
  test row also carries its own lock icon there, not just a border/opacity
  dim, so it stays unambiguous in a printed/exported report.
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
  full-width below `480px` instead of squeezing side by side.
- **Collapsible KPI/progress/jump-nav on scroll** — that block hides while
  scrolling down through the test list and reappears on scroll-up or near
  the top, giving short/landscape screens their vertical space back without
  losing the sticky title/actions row above it.
- **Toast notifications** for transient feedback (e.g. empty-report
  gate) that auto-dismiss.
- **Empty states** for: nothing imported yet, a JSON file with no test
  cases, and a filter with no matches — each with a relevant action to
  recover (Import, Load sample data, Show all cases).
- Suite-wide chrome (KPI cards, filters, jump nav, pinned bar) stays hidden
  until a suite is loaded, then shows even if that suite has zero tests.

## Safety

- **HTML-escaping** on every imported title/test-text/note before it's
  inserted into the page, so characters like `<`/`>` in test data can't
  break rendering or inject markup.
- **No external dependency** beyond `html2pdf.js` (loaded from cdnjs, used
  only by Download PDF) — everything else is this repo's own HTML/CSS/JS.

## Coming Soon Features

Proposed, not yet built. See the note at the top of this file for how a
bullet graduates out of this section once it ships.

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
- **Undo for Reset all** — single-level undo (one Reset back) via a toast
  with an Undo action, not a full undo/redo stack.
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
