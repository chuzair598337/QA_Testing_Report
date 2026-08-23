---
name: security-audit
description: Use when the user asks to audit, harden, or check production-readiness of this repo (QA_Testing_Report) — git/branch state, secrets, env config, Supabase RLS/storage/advisors, Vercel config, dependency vulnerabilities, and upload-validation. Trigger phrases like "audit this project", "production readiness check", "security audit", "is this safe to deploy".
---

# QA_Testing_Report — Production Readiness Audit

Repeatable procedure for auditing this repo's security and deployment posture. Read-only unless the user explicitly asks for fixes — report findings first, then ask before changing anything (RLS, migrations, branch protection, CI).

## Environment map (keep this current — update if it drifts)

```
development  →  staging  →  main
(local/dev)     (preview)    (production)
```

- `main` = Vercel Production Branch. Supabase project **`pmrsojsxqjbzeikjgewe`** ("QA_Testing_Report", ap-northeast-2) is Production — it holds real seeded data, never point preview/dev builds at it.
- `staging` = promoted from `development`, gets a stable Vercel branch-alias domain (`qa-testing-report-git-staging-...vercel.app`).
- `development` = primary dev branch; feature/task branches fork from it and PR back in.
- Vercel project: `qa-testing-report` (id `prj_7yCtvIasOCypmWcubY4VCaRDAPCw`, team `chuzair598337-9124's projects`).

## Checklist

**1. Git/branch state**
`git status`, `git log --oneline -20`, `git branch -a` — confirm no branch is stale relative to the others, no uncommitted secrets in the diff.

**2. Secrets scan**
```
grep -rInE "(SUPABASE_SERVICE_ROLE|service_role|sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{20,}|password\s*[:=]\s*['\"])" app/src supabase vercel.json app/vite.config.js | grep -v node_modules
```
Also confirm `app/.env.local` stays untracked: `git ls-files | grep -i env` should only show `app/.env.example`.

**3. Supabase RLS + storage + advisors** (via Supabase MCP tools against `pmrsojsxqjbzeikjgewe`)
- `list_tables` (verbose) on `public` — every table should show `rls_enabled: true`.
- `get_advisors` (`type: security`) — triage any WARN/ERROR. Known-accepted baseline: none currently (the `rls_auto_enable` PUBLIC-execute warning and leaked-password-protection warning were fixed/flagged in Phase 9 — see `supabase/migrations/20260823214759_phase9_security_hardening.sql` and its follow-up).
- Storage: confirm `report-uploads` bucket is `public: false` and has `file_size_limit`/`allowed_mime_types` set (query `storage.buckets`).
- `list_migrations` vs local `supabase/migrations/*.sql` — must match 1:1, no drift.

**4. Vercel config**
- `vercel.json` — SPA rewrite (`/(.*) → /index.html`) and build command (`cd app && npm install && npm run build` → `app/dist`) present.
- Vercel MCP `get_project` — Production Branch is `main`; branch-alias domains exist for `staging`/`main`.
- `get_project_deployment_protection` — Vercel Authentication (SSO protection) should stay on for preview deployments.

**5. Dependencies**
`cd app && npm audit` — flag anything high/critical. CI (`.github/workflows/ci.yml`) already runs this on PRs into `staging`/`main`, plus `npm run lint` (ESLint, `flat/essential` ruleset — correctness only, no stylistic noise on this codebase).

**6. Upload validation**
Confirm `validateImportShape()` in `app/src/stores/useReports.js` still gates JSON import before any Storage upload, and that the client-side `accept=".json,application/json"` on the upload input (`DashboardView.vue`) still matches the bucket's `allowed_mime_types`.

## Not automatable via MCP — check the Supabase dashboard directly
- Auth **Site URL / Additional Redirect URLs** allow-list (must cover prod domain, staging alias, and a Vercel preview wildcard).
- **Leaked password protection** toggle (Auth → Providers → Email).
- CORS, if ever customized beyond Supabase defaults.

## Related
See the full Phase 9 audit + action plan this skill was distilled from: `/Users/master/.claude/plans/system-directive-production-readiness-kind-blanket.md` (local to the session that wrote it, not part of this repo).
