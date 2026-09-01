# agent-memory

Shared memory for the QA/bug-fix agent pipeline. Plain files, committed to
`development`, so every agent's output is versioned and diffable with zero
extra infrastructure — no database, no external store.

## Layout

```
agent-memory/
  bug-reports/   issue-<n>.md   — Bug Detector's root-cause analysis + classification
  fixes/         issue-<n>.md   — Bug Fixer's summary of a code fix + why it's correct
  ui-fixes/      issue-<n>.md   — UI Agent's summary of a layout/style fix
```

`<n>` is the GitHub issue number the entry belongs to, so any file here maps
1:1 back to an issue and (once one exists) the PR that closed it.

## Who writes what

| Agent | Writes to | Also does |
|---|---|---|
| QA (`qa.yml`) | — | Files the originating issue (`bug`, `agent-generated`, + `caught-in-staging` if from staging) |
| Bug Detector (`bug-detector.yml`) | `bug-reports/` | Relabels issue `bug` → `needs-fix` or `needs-ui` |
| Bug Fixer (`bug-fixer.yml`) | `fixes/` | Opens PR into `development`, labels it `needs-approval` |
| UI Agent (`ui-agent.yml`) | `ui-fixes/` | Opens PR into `development`, labels it `needs-approval` |
| Wiki Report (`wiki-report.yml`) | *(reads all of the above)* | Publishes a rollup to the repo wiki — never writes here |

## Rules

- Agents only ever write here and to `app/` on `development`. They never
  touch `staging` or `production` branches, deploys, or files.
- Bug Detector and Wiki Report commit directly (docs-only, low risk). Bug
  Fixer and UI Agent always go through a PR labeled `needs-approval` — a
  human merges it.
- A bug caught by the staging smoke test still gets fixed by branching off
  `development`, same as one caught pre-merge. Staging is an earlier
  detection point, not a second fix pipeline — see `caught-in-staging`.
