# QA Testing Report

A single-page, static, in-browser QA test-run shell. No backend, no build
step, no database — a static single-page app (`index.html` plus `css/` and
`js/`), hosted on GitHub Pages, that a tester opens in a browser tab.

See [FEATURES.md](FEATURES.md) for the full, maintained catalog of what the
app does — update it whenever a feature is added or changed.

## What this is

A dev writes a set of test cases as a JSON file and sends it to QA. QA opens
the app's link, clicks **Import**, picks that file, and gets an interactive
checklist: every test case laid out by module → sub-module, each with a
Pending / Pass / Fail status and an optional note. QA works through the
checklist, then clicks **Export**, which downloads a JSON file containing
the same structure plus every result — and sends that file back to dev.

Everything happens **in the browser tab, in memory, for that one sitting**.
There is no server, no database, no `localStorage`, and GitHub Pages does
not store the imported or exported JSON anywhere — closing the tab or
reloading the page without exporting first loses the in-progress work by
design. Import → work → Export, one sitting, then send the file back.

## Workflow

1. **Dev** writes the test cases as a JSON file matching the schema below
   (see [Authoring test cases](#authoring-test-cases)).
2. **Dev** sends that file to QA (however — email, Slack, shared drive; this
   app has no transport layer of its own).
3. **QA** opens the app's GitHub Pages link, clicks **Import**, selects the
   file.
4. **QA** works through every test case: sets each to Pass/Fail, adds notes
   as needed, uses filters/jump-nav/pin/lock/collapse to navigate a large
   suite.
5. **QA** clicks **Export**, then **Download JSON**, which downloads a
   results JSON file (same schema, now carrying every `status`/`note`).
6. **QA** sends that downloaded file back to dev.

Optionally, at any point, **Export → Download PDF** produces a printable
snapshot of the current state (all modules/sub-modules expanded, filters
cleared) — a static PDF, not the JSON handoff artifact. **Export → Download
JSON** is the results handoff file. **Export → Generate report** opens a
modal of all passed and failed cases (with notes, in suite order) with
Copy and Download actions.

## File structure

| File | Responsibility |
| --- | --- |
| `index.html` | Page shell — header, empty main mount, confirm modal. Links stylesheets and scripts; no inline CSS/JS. |
| `css/base.css` | Design tokens, layout, and component styles (header, stats, modules, test rows, modal). |
| `css/responsive.css` | Breakpoints (`720px` / `480px`): sticky chrome, icon-only actions, compact stats/toolbar, touch-friendly list controls. |
| `js/theme.js` | Light/dark theme toggle for the session (respects `prefers-color-scheme` on first load). |
| `js/app.js` | Runtime: import/export, render modules/tests, filters, jump nav, pin/lock, stats, PDF export, confirm modal. |
| `sample.json` | Demo test-case data, in the exact import schema, so the app has something to show without a real handoff file. Only offered when `config.json`'s `showSample` is `true`. |
| `config.json` | `{ "showSample": boolean }`. Toggles whether the empty state offers a "Load sample data" option. Read defensively — if this file is missing or invalid, the app just behaves as `showSample: false`. |
| `.github/workflows/pages.yml` | Deploys the repo root to GitHub Pages on every push to `main` (via `actions/upload-pages-artifact` + `actions/deploy-pages` — no build step). |
| `FEATURES.md` | Maintained catalog of every feature the app has — update it alongside any feature change. |

No build step: GitHub Pages serves these static files as-is. The only external script is `html2pdf.js` from cdnjs (used by **Export → Download PDF**).

## JSON schema

The same shape is used for the file dev sends (Import) and the file QA sends
back (Export) — and for `sample.json`.

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

- **`docTitle`** (string, optional) — shown as the page's `<h1>`. If omitted
  on import, the current title is kept.
- **`modules`** (array, required) — one entry per top-level module/feature
  area.
  - **`title`** (string, required)
  - **`subModules`** (array, required) — one entry per screen/flow/variant
    within the module.
    - **`title`** (string, required)
    - **`tests`** (array, required) — the individual test cases.
      - **`text`** (string, required) — the observable, in-app assertion
        being tested. One clear sentence, e.g. *"Duplicate email shows
        correct error state"*.
      - **`status`** (string, optional on import) — `"pending"`, `"pass"`,
        or `"fail"`. Defaults to `"pending"` if omitted or invalid — so dev's
        outgoing file can omit this entirely. Always present on export.
      - **`note`** (string, optional on import) — defaults to `""` if
        omitted. Always present on export.

On import, malformed JSON or a payload missing `modules`/`title`/`subModules`
/`tests`/`text` is rejected with an alert; nothing already loaded is
touched.

### Authoring test cases

The `modules` → `subModules` → `tests` array is what dev edits/generates when
preparing a handoff file — write one JSON file per QA request, matching the
schema above, and send it to QA to Import. `status`/`note` can be omitted
entirely in that file (they default to `"pending"`/`""`); QA's Export always
fills them in.

## Design/engineering rules

For anyone — human or AI — editing this repo going forward:

- **Single self-contained `index.html`.** No build step, no framework, no
  bundler. Keep it that way.
- **No persistence layer of any kind.** No `localStorage`, no backend, no
  writes to disk except the user-triggered Export download. State lives in
  memory only, for the current tab, by design — that's the whole point of
  Import → work → Export.
- **Icons are inline SVG** (Lucide paths, in the `ICON_PATHS` object). No
  icon font, no external icon CDN.
- **Theming via CSS custom properties** on `:root` and
  `html[data-theme="dark"]`. Any new UI must use the existing tokens
  (`--bg`, `--ink`, `--primary`, `--pass`, `--fail`, etc.), never hardcoded
  colors.
- **Buttons use the existing `.btn` class.** Confirmation prompts reuse the
  `modal-overlay` / `modal-box` markup via the shared `confirmModalOpen()` /
  `confirmModalClose()` helpers (used by Reset and by the Import-overwrite
  guard) — don't add a second modal pattern.
- **Preserve existing behavior, extend additively.** Module/sub-module/
  test-row rendering, filters, jump nav, pinned bar, pin/lock,
  collapse-by-default, PDF export, and dark mode are the established
  behavior of this app — build on top of them rather than restructuring.
- **`sample.json` and `config.json` are plain static files** fetched at
  runtime via `fetch()`. Keep them valid JSON and in sync with the schema
  above if either changes.
