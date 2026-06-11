# Director Update

## 1. Completed Task

STAGE 2 Round 8 Alpha Production Readiness + Deployment + Security Hardening was completed and accepted in commit `8719f5d` (`chore: harden alpha deployment readiness`).

## 2. Accepted Changes

- Added shared HTTP CORS and WebSocket origin allowlist behavior through `apps/api/src/config/allowed-origins.ts`.
- Preferred deployed origin env is now `WORKMAP_ALLOWED_ORIGINS`; `WORKMAP_ALLOWED_ORIGIN` remains a backward-compatible fallback.
- Production browser origins are rejected when no allowed origins are configured, while missing `Origin` remains allowed for non-browser/server-to-server requests.
- Added `GET /health/readiness` for safe Prisma database readiness checks; `GET /health` remains lightweight liveness.
- Updated `.env.example` with `WORKMAP_APP_URL`, preferred `WORKMAP_ALLOWED_ORIGINS`, and clearer deployment CORS/invite env guidance.
- Added `docs/ai-handoff/alpha-production-readiness.md` covering Vercel, Render, Supabase, Cognito, migration order, WSS, activity hardening, alpha smoke, and release blockers.
- Updated deployment/current-status docs to make external setup and deployed smoke explicit Manual Action Required items.

## 3. Verification Summary

- API and web typecheck, lint, and build passed.
- Desktop-agent and browser-extension typecheck, lint, and build passed.
- `pnpm prisma:generate` passed after local Node processes locking Prisma files were stopped.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` found no high-confidence matches.
- QA review confirmed CORS/WSS allowlist behavior, readiness response safety, deployment documentation, and alpha blocker checklist.

## 4. Remaining Risks

- Deployed alpha readiness is not proven yet; Vercel, Render, Supabase, Cognito, env values, migrations, and deployed smoke remain manual.
- `WORKMAP_ALLOWED_ORIGINS` must exactly match deployed frontend origin(s), or browser HTTP/WSS requests will fail.
- Desktop-agent remains a harness/scaffold, not production active-window tracking.
- Browser extension remains a local MV3 scaffold, not packaged/store-ready production tracking.
- Offline queueing, retry/backoff, token revocation, production pairing UX, and multi-instance realtime pub/sub are not implemented.
- Realtime gateway is still single-instance/in-memory.
- `docs/references/` remains unrelated untracked reference material.

## 5. Updated Docs

- `docs/skills/current-status.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/backend-skill.md`
- `docs/skills/api-contract-skill.md`
- `docs/skills/realtime-presence-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/project-summary.md`
- `docs/skills/decision-log.md`
- `docs/ai-handoff/director-update.md`

## 6. Recommended Next Tasks

- Configure Supabase `DATABASE_URL`, Render backend env, Vercel frontend env, Cognito Hosted UI callback/logout/scopes, `WORKMAP_APP_URL`, and exact `WORKMAP_ALLOWED_ORIGINS`.
- Apply required Prisma migrations in order: `20260529043117_v1`, `20260606000000_stage2_onboarding_invites`, `20260607000000_platform_audit_log`, and `20260609000000_stage2_activity_source`.
- Verify deployed `/health` and `/health/readiness`.
- Run the full alpha smoke checklist in `docs/ai-handoff/alpha-production-readiness.md`.
- Run live activity hardening checks and final secret scan before declaring alpha ready.
