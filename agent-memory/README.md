# agent-memory

Shared memory for the bug-fix agent pipeline. Plain files, committed to
`development`, so every agent's output is versioned and diffable with zero
extra infrastructure — no database, no external store.

## Layout

```
agent-memory/
  bug-reports/   issue-<n>.md   — Bug Detector's root-cause comment, mirrored here
  fixes/         issue-<n>.md   — Bug Fixer's one-paragraph summary of a code fix
  ui-fixes/      issue-<n>.md   — UI Agent's one-paragraph summary of a layout/style fix
```

`<n>` is the GitHub issue number the entry belongs to.

## Who writes what

| Agent | Writes to | How |
|---|---|---|
| QA / Staging Smoke | — | Files the originating issue (`bug` + `agent-generated`, `+caught-in-staging` from staging) |
| Bug Detector | `bug-reports/` | Posts an issue comment (Claude, read-only); the workflow itself (not Claude — Bug Detector has no Write tool) mirrors that comment into `agent-memory/` and commits it straight to `development` |
| Bug Fixer | `fixes/` | Written by Claude as part of its normal commit on its fix branch, merges in with its PR |
| UI Agent | `ui-fixes/` | Same as Bug Fixer, on its ui branch |
| Wiki & Report | *(reads issues/PRs directly, not this directory)* | Publishes a daily rollup to the repo wiki + Slack — doesn't read or write here |

## Rules

- Agents only ever write here and to `app/` on `development` (or a branch off
  it). They never touch `staging` or `production` branches, deploys, or files.
- Bug Detector's memory write is done by the workflow, not by Claude — it
  keeps that agent's tool access strictly `Read,Grep,Glob` (see
  `.claude/roles/bug-detector.md`) while still leaving a durable record.
- Bug Fixer and UI Agent always go through a PR labeled `needs-approval` —
  a human merges it. Neither commits straight to `development`.
- A bug caught by the staging smoke test still gets fixed by branching off
  `development`, same as one caught pre-merge. Staging is an earlier
  detection point, not a second fix pipeline — see `caught-in-staging`.
