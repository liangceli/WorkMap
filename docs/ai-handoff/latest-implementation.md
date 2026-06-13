# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 9: Real Alpha Deployment & External Smoke.

Move WorkMap from local alpha-readiness to real external alpha deployment smoke across Vercel frontend, Render backend, Supabase Postgres, AWS Cognito Hosted UI, production/staging env variables, production CORS/WSS allowlist, Prisma migrations, Cognito callback/logout URLs, platform admin allowlist, full alpha smoke checklist, activity hardening checks, and secret/client-bundle safety.

This round is not for new product features. Do not guess real external values or commit secrets. If required values are unavailable, clearly mark Manual Action Required.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/scripts/real-alpha-smoke.mjs` | New non-secret external smoke helper that reads deployed public API/app origins from shell env, checks health/readiness/CORS/key frontend routes, and prints the derived realtime endpoint. |
| `workmap/package.json` | Added `pnpm smoke:alpha` script for the Round 9 smoke helper. |
| `docs/ai-handoff/real-alpha-deployment-smoke.md` | New Round 9 runbook for external deployment setup, Manual Action Required values, smoke checklist, activity hardening checks, and release blocker status. |
| `docs/ai-handoff/alpha-production-readiness.md` | Updated status from Round 8 readiness to Round 9 deployment preparation and linked the new smoke helper/runbook. |
| `docs/skills/deployment-skill.md` | Documented `pnpm smoke:alpha`, `WORKMAP_SMOKE_*` inputs, and external smoke boundaries. |
| `docs/skills/current-status.md` | Added Round 9 current status and confirmed external alpha remains Manual Action Required. |
| `workmap/.env.example` | Added blank, public-only `WORKMAP_SMOKE_*` helper placeholders. No real deployment values or secrets were added. |
| `workmap/.gitignore` | Stopped ignoring `pnpm-lock.yaml` so Vercel can install with `--frozen-lockfile` from the GitHub checkout. |
| `workmap/pnpm-lock.yaml` | Should be committed for deterministic Vercel installs; it already existed locally but was previously ignored. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified.

## 3. Implementation Summary

Implemented Round 9 deployment-smoke preparation without changing application product behavior.

Added:

- `pnpm smoke:alpha`
- `scripts/real-alpha-smoke.mjs`
- `docs/ai-handoff/real-alpha-deployment-smoke.md`

The smoke helper:

- reads only process environment variables, not `.env`
- requires `WORKMAP_SMOKE_API_URL` and `WORKMAP_SMOKE_APP_URL`
- optionally accepts `WORKMAP_SMOKE_ORIGIN`
- rejects localhost by default so a real alpha smoke cannot accidentally pass against local services
- checks `GET /health`
- checks `GET /health/readiness`
- checks CORS allowlist response for the configured frontend origin
- checks frontend `/`, `/login`, `/virtual-office`, and `/platform-admin` route availability
- prints the derived `/virtual-office/realtime` WSS endpoint path
- intentionally does not automate authenticated Cognito, invite, tenant, activity, reports, or Platform Admin flows because those require real users/tokens and must stay out of chat

No backend controllers/services, frontend product flows, Prisma schema, migrations, auth logic, realtime logic, desktop-agent behavior, or browser-extension behavior were changed.

## 4. External Env Availability / Deployed Smoke Update

Codex checked only the current process environment for required variable names and did not read or print `workmap/.env`.

Result:

- No deployed Vercel frontend URL was available in the current process environment.
- No deployed Render API URL was available in the current process environment.
- No Cognito Hosted UI config was available in the current process environment.
- No Supabase/Render backend DB env was available in the current process environment.
- No platform admin allowlist env was available in the current process environment.

Initial implementation chat did not have external env values, so real external smoke was not run then.

Follow-up update on 2026-06-13:

- Supabase schema was updated through Prisma migration baseline/deploy.
- Render API deployed successfully after setting Node 22 and using a build command that runs `pnpm prisma:generate` before API build.
- Vercel frontend deployed successfully after committing `workmap/pnpm-lock.yaml` and using the app package root/build settings.
- AWS Cognito Hosted UI callback/logout URLs were configured for the deployed Vercel production domain.
- `pnpm smoke:alpha` passed against deployed public URLs.
- Human manual smoke passed for Owner onboarding, Employee invite acceptance/onboarding, virtual-office realtime, People/contact surfaces, Platform Admin privacy boundary, device registration, app/domain activity submission, Employee own reports, Owner company aggregate reports, and Employee company-scope report block.

## 5. Manual Action Required

External setup remains required before WorkMap can be called alpha-ready:

1. Configure Supabase Postgres.
2. Set `DATABASE_URL` securely in Render.
3. Apply Prisma migrations in order:
   - `20260529043117_v1`
   - `20260606000000_stage2_onboarding_invites`
   - `20260607000000_platform_audit_log`
   - `20260609000000_stage2_activity_source`
4. Configure Render backend env values:
   - `WORKMAP_JWT_SECRET`
   - `WORKMAP_ALLOWED_ORIGINS`
   - `WORKMAP_APP_URL`
   - `WORKMAP_COGNITO_*`
   - platform admin allowlist env
   - optional pilot fallback hash only if intentionally enabled
5. Configure Vercel frontend env values:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_WORKMAP_API_URL`
   - `NEXT_PUBLIC_COGNITO_*`
6. Configure AWS Cognito Hosted UI:
   - callback URL `https://<vercel-app>/login/callback`
   - logout URL `https://<vercel-app>/login`
   - scopes `openid email profile`
   - verified email requirement
7. Run `pnpm smoke:alpha` with deployed public URLs.
8. Run the full authenticated alpha smoke checklist manually with real users/tokens handled outside chat.

Do not paste real secrets, bearer tokens, database URLs, platform admin emails/subs, or Cognito secrets into chat.

## 6. Deployment Setup Status

Overall status: Alpha Ready Candidate for a controlled 5-person pilot.

- Supabase DB: configured and migrated.
- Prisma deployed migrations: applied.
- Render backend: deployed and `/health` / `/health/readiness` passed.
- Vercel frontend: deployed and public route smoke passed.
- Cognito Hosted UI: configured and login/callback passed.
- Production CORS/WSS allowlist: approved-origin CORS and WSS smoke passed.
- Platform Admin allowlist: configured and privacy boundary passed.
- Alpha smoke helper: passed against deployed public URLs.

## 7. Health / Readiness / CORS / WSS Status

Local/code status:

- `/health` and `/health/readiness` implementation was unchanged from accepted Round 8.
- HTTP CORS and WSS origin allowlist implementation was unchanged from accepted Round 8.
- The smoke helper can check deployed `/health`, `/health/readiness`, and CORS once real public URLs are provided.
- The smoke helper derives the realtime endpoint as `wss://<api>/virtual-office/realtime` for HTTPS API origins.

External status:

- Deployed `/health`: passed.
- Deployed `/health/readiness`: passed.
- Deployed CORS allowlist: passed for approved Vercel origin.
- Deployed WSS with two authenticated users: passed.

## 8. Activity Hardening Check Status

The Round 9 runbook lists live checks for:

- cross-user device id rejection
- cross-tenant device id rejection
- malformed device id
- future timestamp
- zero/negative duration
- too-long duration
- malformed domain
- full URL path/query hostname reduction
- batch size limit
- employee blocked from company report scope
- owner same-tenant aggregate scope only

Current status: alpha smoke passed manually.

Confirmed deployed alpha smoke:

- Employee registered a device.
- Employee submitted sample app usage.
- Employee submitted sample domain usage.
- Employee own report returned sample app/domain rows.
- Owner company aggregate report returned the same sample app/domain rows.
- Employee company report scope was manually checked as blocked during full smoke.

Remaining future hardening:

- Add automated negative tests for cross-user/cross-tenant device ids, malformed/future timestamps, overlong duration, malformed domains, URL path/query minimization, and batch size limits.

## 9. Secret / Client Bundle Safety

Changes made:

- Added only blank/public smoke env placeholders in `.env.example`.
- Added no real Vercel, Render, Supabase, Cognito, platform admin, JWT, invite, database, bearer, desktop-agent, or extension secrets.
- Smoke helper reads shell env only and does not ask for or print tokens.

Secret scan result:

- High-confidence token/private-key scan found no matches.
- Public placeholder scan only found documented placeholder examples like `https://<api>.onrender.com` and `https://<app>.vercel.app`.

## 10. Verification Results

Commands run from `workmap/` unless noted:

```powershell
node --check scripts/real-alpha-smoke.mjs
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/desktop-agent typecheck
pnpm --filter @workmap/browser-extension typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/desktop-agent lint
pnpm --filter @workmap/browser-extension lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
pnpm --filter @workmap/desktop-agent build
pnpm --filter @workmap/browser-extension build
pnpm prisma:generate
pnpm smoke:alpha
git diff --check
secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/`
```

Results:

- Smoke helper syntax check passed.
- API typecheck passed.
- Web typecheck passed.
- Desktop-agent typecheck passed.
- Browser-extension typecheck passed.
- API lint passed.
- Web lint passed.
- Desktop-agent lint passed.
- Browser-extension lint passed.
- API build passed.
- Web build passed; existing Next.js ESLint plugin warning remains.
- Browser-extension build passed.
- Desktop-agent build initially failed inside the sandbox with Windows `EPERM` writing `apps/desktop-agent/dist/index.js`; rerun outside the sandbox passed.
- `pnpm prisma:generate` initially failed inside the sandbox due Prisma binary checksum access being redirected to `127.0.0.1:9`; rerun outside the sandbox passed. Prisma printed that env vars were loaded from `.env`, but no env values were output.
- `pnpm smoke:alpha` with no deployed env returned Manual Action Required as expected and did not pretend smoke passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan found no high-confidence secrets.
- `workmap/apps/web/tsconfig.tsbuildinfo` was modified by Web build and restored.
- Vercel install follow-up: `git check-ignore -v workmap/pnpm-lock.yaml` now returns no ignore rule after removing the lockfile ignore entry.

Initially not run during implementation:

- Real deployed Vercel/Render/Supabase/Cognito smoke.
- Authenticated owner/invite/employee/platform-admin browser smoke.
- Deployed WSS two-user smoke.
- Deployed activity hardening live requests.

Follow-up deployed smoke result:

- Human-reported deployed smoke passed on 2026-06-13.
- `pnpm smoke:alpha` passed against deployed public URLs.
- Full authenticated manual smoke passed per human tester.

## 11. Manual QA Suggestions

After external setup:

1. Run `pnpm smoke:alpha` with deployed public URLs.
2. Verify Render `/health`.
3. Verify Render `/health/readiness`.
4. Open deployed Vercel frontend.
5. Complete Cognito Owner login.
6. Create Owner workspace.
7. Create employee invite.
8. Complete Employee Cognito sign-up/login and invite acceptance.
9. Confirm employee onboarding/avatar/device setup.
10. Open `/virtual-office` as Owner and Employee in two browsers.
11. Confirm realtime movement both directions and polling fallback after refresh/socket disruption.
12. Confirm People panel and contact drawer.
13. Confirm Platform Admin login with independent configured platform identity.
14. Confirm tenant OWNER and EMPLOYEE are blocked from `/platform-admin`.
15. Register device and submit sample app/domain usage.
16. Confirm employee own reports and owner company aggregate reports.
17. Confirm employee `scope=company` is blocked.
18. Run activity hardening invalid-input checks listed in `docs/ai-handoff/real-alpha-deployment-smoke.md`.
19. Confirm Compliance, Dashboard, Reports, Employees, Settings, and invite routes.
20. Run final secret/client-bundle safety scan before declaring alpha-ready.

## 12. Risks / Notes

- WorkMap is now an Alpha Ready Candidate for a controlled 5-person pilot based on human-reported deployed smoke.
- This is not full production readiness.
- Keep platform secrets in provider env settings only; do not paste them into chat or commit them.
- Vercel install with `pnpm install --frozen-lockfile` requires `workmap/pnpm-lock.yaml` to be committed.
- Desktop-agent remains a harness/scaffold, not a production active-window app.
- Browser extension remains a local MV3 scaffold, not store-ready.
- Realtime gateway remains single-instance/in-memory.
- No durable offline queue, retry/backoff, token revocation, secure production pairing UX, or multi-instance realtime pub/sub was added.
- `docs/references/` remains unrelated untracked content and should not be staged.

## 13. Docs Update Suggestions

- `docs/skills/deployment-skill.md`: updated with `pnpm smoke:alpha` and Round 9 smoke flow.
- `docs/skills/current-status.md`: updated with Round 9 current status.
- `docs/ai-handoff/alpha-production-readiness.md`: updated to point to the Round 9 smoke helper and runbook.
- Future docs should record actual deployed smoke results after Vercel/Render/Supabase/Cognito are configured.

## 14. Next Chat Input

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
