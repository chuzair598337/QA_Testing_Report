# QA Testing Report

In-app manual QA test report tool — a single self-contained HTML page (no
build step, no backend). Open `index.html` directly, or visit the published
GitHub Pages link, to get an interactive checklist: per-test Pass/Fail/Pending
status, notes, live progress stats, module/sub-module collapse, pin/lock,
filters, jump nav, dark mode, and PDF export.

## Use

- Open `index.html` in any browser — that's the whole app.
- Or publish via GitHub Pages and share the link.

## Structure

- `index.html` — the report template. Edit the `DATA` array near the bottom
  of the `<script>` block to add modules / sub-modules / test cases; the rest
  of the file is the runtime (state, rendering, stats, PDF export) and should
  not need touching per report.

Originally maintained as a living template inside `siloss_mobile_rn`
(`DOCS/Testing/reports/template/qa-testing-report-template.html`); this repo
is a standalone copy for publishing and general reuse.
