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
