# QA Testing Report

Static site publishing manual, in-app UI QA reports for SILOSS Mobile.
No build step, no backend — every page is a self-contained HTML file.

- **`index.html`** — gallery/index page. Lists every published report, read
  from `reports.json`. This is the link you share.
- **`reports/template/qa-testing-report-template.html`** — canonical,
  editable report template. Each report is a filled copy of this: per-test
  Pass/Fail/Pending status, notes, live progress stats, module/sub-module
  collapse, pin/lock, filters, jump nav, dark mode, PDF export.
- **`reports/testcases/`** — finished, filled reports live here, one HTML
  file per report.
- **`reports.json`** — manifest the index page reads: `[{ title, path, date,
  scope }, …]`, one entry per published report.
- **`docs/generate-report.md`** — step-by-step: how to fill the template,
  where to save it, how to register it in the manifest.

## Use

- Open `index.html` in any browser to browse published reports, or open a
  report file under `reports/testcases/` directly.
- Publish via GitHub Pages and share the repo's Pages URL — that's the link
  users open.

## Adding a report

See [`docs/generate-report.md`](docs/generate-report.md).

## Origin

The template started as a living file inside `siloss_mobile_rn`
(`DOCS/Testing/reports/template/qa-testing-report-template.html`), generated
via that project's `generate-qa-test-report` Claude Code skill. This repo is
a standalone copy for publishing reports as shareable links; the two
templates are kept in sync manually (see `docs/generate-report.md`).
