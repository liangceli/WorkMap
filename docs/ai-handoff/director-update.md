# Director Update

## 1. Completed Task

STAGE 2 Round 9 Real Alpha Deployment & External Smoke was completed and accepted in commit `20feb27` (`chore: add real alpha deployment smoke`).

## 2. Accepted Changes

- Added non-secret external smoke helper `workmap/scripts/real-alpha-smoke.mjs`.
- Added `pnpm smoke:alpha` to check deployed public API/frontend smoke from shell env inputs.
- Added `docs/ai-handoff/real-alpha-deployment-smoke.md` as the Round 9 external deployment smoke runbook.
- Updated `docs/ai-handoff/alpha-production-readiness.md` to point to the Round 9 smoke helper/runbook.
- Added blank/public `WORKMAP_SMOKE_*` placeholders to `.env.example`.
- Stopped ignoring `workmap/pnpm-lock.yaml` and committed the lockfile path for deterministic Vercel installs.
- No backend controllers/services, frontend product flows, Prisma schema/migrations, auth logic, realtime logic, desktop-agent behavior, or browser-extension behavior changed.

## 3. Verification Summary

- `node --check scripts/real-alpha-smoke.mjs` passed.
- `pnpm smoke:alpha` without deployed env returned Manual Action Required as expected.
- API, web, desktop-agent, and browser-extension typecheck/lint/build commands passed.
- `pnpm prisma:generate` passed after sandbox-blocked Prisma access was rerun outside the sandbox.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan found no high-confidence committed secrets.
- Human-reported deployed smoke passed on 2026-06-13 for Supabase migrations, Render `/health` and `/health/readiness`, Vercel frontend, Cognito callback/logout, approved-origin CORS, two-user WSS/virtual-office, Owner onboarding/invite, Employee invite acceptance/onboarding, Platform Admin privacy, device registration, app/domain sample activity, Employee own report, Owner company aggregate report, and Employee company-scope report block.

## 4. Remaining Risks

- Current status is Alpha Ready Candidate for a controlled 5-person pilot, not full production readiness.
- Desktop-agent remains a harness/scaffold, not production active-window tracking.
- Browser extension remains a local MV3 scaffold, not packaged/store-ready production tracking.
- Realtime gateway remains single-instance/in-memory.
- No durable offline queue, retry/backoff, token revocation, secure production pairing UX, or multi-instance realtime pub/sub was added.
- Automated negative hardening remains future work for cross-user/cross-tenant device ids, malformed/future timestamps, overlong durations, malformed domains, URL minimization, batch-size limits, and unapproved-origin CORS.
- Keep provider secrets, bearer tokens, database URLs, and platform admin identities out of docs/chat and only in secure provider/local secret stores.

## 5. Updated Docs

- `docs/skills/current-status.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/project-summary.md`
- `docs/skills/decision-log.md`
- `docs/ai-handoff/director-update.md`

## 6. Recommended Next Tasks

- Re-run `pnpm smoke:alpha` immediately before inviting pilot users.
- Reconfirm Render, Vercel, Supabase, and Cognito env/callback/origin settings before pilot start.
- Watch Render logs for WebSocket query-token exposure and avoid retaining full socket query strings.
- Add automated negative security tests for activity validation, report scope, CORS origin rejection, and tenant isolation.
- Plan production-grade desktop/browser tracking clients, token lifecycle, offline queueing, retry/backoff, and multi-instance realtime pub/sub before broader rollout.
