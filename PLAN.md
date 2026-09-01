# Autonomous Bot Team — What Got Built

Implements `autonomous-bot-team-setup-guide.md`, Parts 2–3 and 5–10. Branch
protection (Part 4) is explicitly yours to configure in the GitHub UI —
nothing here touches it.

## Investigation findings (Step 1)

- **Test framework**: none existed. Added — see "Playwright bootstrap" below.
- **Branches**: `development` ✅, `staging` ✅. **No `production` branch** —
  this repo has `main` instead. No workflow or role prompt in this guide
  references "production" by name, so nothing had to change; flagging it in
  case you intended `main` to be the eventual production target once you
  wire up branch protection.
- **Existing CI**: `.github/workflows/ci.yml`, job `build-lint-audit`,
  triggers on PR+push to `[staging, main]` (not `development`). No overlap
  with the new `qa-tests` job — different branch, different check, nothing
  deduped or removed.
- **App layout**: real app lives in `app/` (Vue 3 + Vite + Supabase), not
  repo root. Every workflow below uses `working-directory: app` for npm/
  playwright commands, same convention as `ci.yml`. Styling/components:
  `app/src/styles/*.css`, `app/src/components/`, `app/src/views/` — used to
  scope the UI Agent's `Edit`/`Write` tool access.

## Playwright bootstrap (your call: scaffold it now)

- Added `@playwright/test` as a devDependency in `app/package.json` (ran
  `npm install` so `package-lock.json` is in sync — `npm ci` in CI needs
  this or it fails).
- `app/playwright.config.ts` — builds + serves the app locally
  (`localhost:4173`) via a `webServer` block, so `qa.yml` is self-contained.
- `app/playwright.staging.config.ts` — same base config, points `baseURL`
  at `process.env.STAGING_URL` instead, no `webServer` (tests a real
  deployment, doesn't build one).
- `app/e2e/smoke.spec.ts` — two tests: home page loads, and `/dashboard`
  redirects to `/login` when unauthenticated (matches the router's actual
  auth guard). Enough to prove the pipeline end-to-end; expand from here as
  real coverage grows.
- Verified locally: `npx playwright test --list` finds both tests and the
  config parses. Could **not** run them for real on this machine — this
  Mac is on macOS 13, which current Playwright Chromium builds don't
  support. All actual Playwright execution happens in CI (`ubuntu-latest`);
  verify by pushing and reading the Actions log for the `QA Agent` run.

## Pipeline (Step 2)

| File | Trigger | Claude? | Does |
|---|---|---|---|
| `.github/workflows/qa.yml` (`qa-tests`) | PR → `development`, every 6h | No | `npx playwright test`. Failure → upload trace artifact + open issue (`bug`, `agent-generated`) |
| `.github/workflows/staging-smoke.yml` (`staging-smoke-test`) | push → `staging` | No | Same, against `STAGING_URL`. Failure → issue (`bug`, `agent-generated`, `caught-in-staging`). No fix pipeline runs here. |
| `.github/workflows/bug-detector.yml` | issue labeled `bug` | Yes — `Read,Grep,Glob` only, `--max-turns 6` | Comments root cause + repro, relabels `needs-fix`/`needs-ui`. Workflow (not Claude) also mirrors the comment into `agent-memory/bug-reports/` and pushes straight to `development` — keeps the agent itself read-only. |
| `.github/workflows/bug-fixer.yml` | issue labeled `needs-fix` | Yes — `Read,Edit,Write,Bash(npm run lint/build, npx playwright test, git)`, `--max-turns 25` | Branches `fix/issue-<n>` off `development`, patches, adds a Playwright regression test, verifies lint+build+test pass, writes `agent-memory/fixes/`, opens PR → `development` labeled `needs-approval`. If it stops instead of committing (per its own "don't commit a guess" instruction), no PR is opened — the workflow checks for a commit before pushing. |
| `.github/workflows/ui-agent.yml` | issue labeled `needs-ui` | Yes — tools additionally scoped to `src/styles/**`, `src/components/**`, `src/views/**`, `--max-turns 25` | Same shape as Bug Fixer, branch `ui/issue-<n>`, `agent-memory/ui-fixes/`. |
| `.github/workflows/wiki-report.yml` | daily 9am UTC + manual | Yes — `Read,Edit,Write,Bash(git)` scoped by `cwd` to a wiki clone, `--max-turns 10` | Gathers closed issues + merged PRs via `gh`, updates `wiki/Bug-Resolution-History.md`, posts a Slack summary. |

Every `claude -p` call uses `CLAUDE_CODE_OAUTH_TOKEN`, never
`ANTHROPIC_API_KEY` (not set anywhere in these workflows — confirmed via
`gh secret list`, only `CLAUDE_CODE_OAUTH_TOKEN` exists in this repo).
Every call sets `--max-turns` and a role-scoped `--allowedTools`. Nothing
uses Agent Teams, subagents, or `--resume`. Model is left at default.

## Gaps the guide didn't cover — filled in, flagging as assumptions

- **`STAGING_URL` secret** — required by `staging-smoke.yml` and
  `playwright.staging.config.ts`; the guide's smoke-test snippet never
  says where the staging base URL comes from. **Not set** — add it as a
  repo secret (e.g. your Vercel staging deployment URL) before this
  workflow can run for real.
- **`SLACK_WEBHOOK_URL` secret** — also **not currently set**
  (`gh secret list` only shows `CLAUDE_CODE_OAUTH_TOKEN`). `wiki-report.yml`
  checks for it and skips the Slack post with a log notice if absent,
  rather than failing the job — the wiki still gets updated either way.
- **Wiki write-up wasn't actually wired in the guide's Part 10 skeleton**
  even though the Part 5 role prompt promises it ("update the wiki page").
  Closed that gap: the workflow clones `<repo>.wiki.git`, runs Claude with
  `cwd` inside that clone, and Claude commits+pushes there itself. Requires
  the repo wiki to be enabled and initialized with at least one page
  (Settings → Features → Wikis) or the clone step fails.
- **Regression tests need a real test framework** to mean anything — Bug
  Fixer's role prompt says "add a regression test," which now means a
  Playwright spec under `app/e2e/`, since that's the only test framework in
  the repo (see Playwright bootstrap above).
- **`agent-memory/` wasn't referenced by any Part 5 role prompt** even
  though Part 2 scaffolds it as "your shared memory." Wired it in: Bug
  Fixer and UI Agent each write a short summary there as part of their
  normal commit (their tool access already includes `Write`, so no extra
  cost); Bug Detector's write is done by the workflow itself, not Claude,
  since that agent is intentionally `Read,Grep,Glob`-only.
- **Node version**: guide's snippets pin `node-version: 20`; used `24.x`
  instead, matching what `ci.yml` already runs, for consistency rather than
  running two Node majors across the same repo's CI.
- **Concurrency groups** added per-workflow (not in the guide) so a rapid
  double-label or double-push doesn't spin up overlapping runs for the same
  issue/branch — cheap insurance, no behavior change to the pipeline logic.
- **Known race, left as-is**: Bug Detector pushes its memory-file commit
  straight to `development`. Two issues labeled `bug` at the exact same
  moment could race on that push. Solo-maintainer, low-volume repo — not
  worth adding retry/lock logic for now; flagging so it's a known, not a
  surprise.

## Labels (Part 3)

All six already exist on the repo (created in the prior session, verified
still present): `bug`, `needs-fix`, `needs-ui`, `needs-approval`,
`agent-generated`, `caught-in-staging`. No action needed.

## Not done (by design)

- Branch protection rules, environment protection on `production`/`main`,
  and "Restrict who can push" on `staging` — Part 4 of the guide, and you
  said that's yours to do in the UI.
- No workflow targets `staging` or `production`/`main` except the read-only
  smoke test's trigger (`push: [staging]`) — nothing pushes there.
