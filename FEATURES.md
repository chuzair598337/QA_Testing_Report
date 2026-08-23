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

**Coming Soon Features** (last section, below) is the backlog — proposed
features not built yet. When one gets implemented: move its bullet out of
Coming Soon and into the section above it belongs to (rewritten as shipped
behavior, not a proposal), and delete it from Coming Soon. Nothing lives in
both places at once.

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
  expanded again until unlocked.
- **Jump navigation** — dropdowns to jump straight to a module or
  sub-module, auto-expanding it and scrolling it into view.

## Filtering

- **KPI cards as filters** — the Total/Passed/Failed/Pending stat cards in
  the header are clickable; clicking one filters the list to that status
  (Total clears the filter). The active card is highlighted.
- **Filtered-out empty state** — a filter that matches nothing shows its
  own message with a "Show all cases" reset, instead of a blank list.
- Modules/sub-modules with no matching case under the active filter are
  hidden entirely; matching ones auto-expand while a filter is active and
  restore their saved collapsed state once cleared.

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
  (icon-only actions collapse into a dropdown panel) below the `900px`/
  `480px` breakpoints; touch-friendly controls throughout.
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

- **Search box** — type to filter test cases by matching text across the
  whole suite, not just jump to a module/sub-module by picking from a
  dropdown.
- **Bulk actions** — mark every test in a module/sub-module (or a
  multi-selection) Pass/Fail/Pending in one action, instead of one row at a
  time.
- **Keyboard shortcuts** — advance to the next pending test and mark it
  Pass/Fail without leaving the keyboard, for faster work on large suites.
- **Modal focus return** — closing the confirm or report modal returns
  keyboard focus to whatever button opened it, instead of dropping it.
- **Tab-title progress indicator** — the browser tab title reflects live
  pass/fail counts (e.g. `3 failed · QA Testing Report`), so progress is
  visible from a background tab without switching back.
- **Native print stylesheet** — a `@media print` fallback for Download PDF
  that doesn't depend on `html2pdf.js` loading successfully from its CDN.
- **Per-test attachments** — attach or link an image/screenshot to a test's
  note, not just free text.
- **Changed-since-last-import diff** — when a revised suite is imported over
  an existing one, highlight which modules/sub-modules/tests are new or
  changed instead of a silent full replace.
- **Per-test/module owner field** — an optional assignee so a suite split
  across multiple QA testers can show who owns what.
- **Mobile stacking fix for the import-replace modal's action row** — the
  Export dropdown + "Discard Changes" button need a stacked, full-width
  layout below ~480px instead of squeezing side by side.
- **Extra responsive breakpoint (~600–760px)** — a middle tier between the
  current `900px`/`480px` breakpoints so small tablets and split-screen
  views don't inherit the full mobile layout untuned.
- **Collapsible sticky header on scroll** — the KPI/progress/jump-nav block
  hides on scroll-down and reappears on scroll-up, to give small-height
  (landscape mobile) screens more room for the actual test list.
- **Stronger locked-state indicator** — a more visible cue than the current
  badge + reduced opacity, so a locked test/module isn't easy to miss in a
  long list at a glance.
