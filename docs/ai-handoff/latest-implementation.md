# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 8: Alpha Production Readiness + Deployment + Security Hardening.

Prepare WorkMap for real alpha deployment and 5-person pilot readiness across Vercel frontend, Render backend, Supabase Postgres, AWS Cognito, security hardening for the activity loop, full alpha smoke coverage, production-safe environment documentation, and release blocker checklist.

Do not redesign UI, add major product features, implement production desktop active-window tracking, package the browser extension for stores, add billing, rewrite realtime/map systems, or commit real secrets.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/apps/api/src/config/allowed-origins.ts` | New shared origin allowlist helper for HTTP CORS and WebSocket upgrade checks. |
| `workmap/apps/api/src/main.ts` | Uses explicit CORS allowlist callback and warns in production if no browser origins are configured. |
| `workmap/apps/api/src/modules/virtual-office/virtual-office-realtime.gateway.ts` | Reuses the shared origin allowlist for realtime WebSocket origin checks. |
| `workmap/apps/api/src/modules/health/health.controller.ts` | Added `/health/readiness` database readiness check without exposing secrets. |
| `workmap/.env.example` | Added `WORKMAP_APP_URL`, preferred `WORKMAP_ALLOWED_ORIGINS`, and clarified CORS/invite env usage. |
| `docs/ai-handoff/alpha-production-readiness.md` | New alpha readiness guide covering envs, migration sequence, WSS, activity hardening, smoke checklist, and release blocker statuses. |
| `docs/skills/deployment-skill.md` | Updated deployment instructions for Round 8 CORS/readiness/migration/smoke guidance. |
| `docs/skills/current-status.md` | Added current Round 8 in-progress status and manual setup/deployed smoke notes. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified.

## 3. Implementation Summary

Implemented alpha readiness hardening and documentation without adding new product features.

Code changes:

- HTTP CORS now uses an explicit allowlist helper.
- WebSocket origin checks now share the same allowlist helper.
- Preferred production env is `WORKMAP_ALLOWED_ORIGINS`, with `WORKMAP_ALLOWED_ORIGIN` as backward-compatible fallback.
- In production, if no allowed origins are configured, browser origins are rejected and the API logs a warning.
- `/health` remains lightweight liveness.
- `/health/readiness` checks database connectivity through Prisma and returns safe readiness status only.

Documentation changes:

- Added `docs/ai-handoff/alpha-production-readiness.md`.
- Documented Vercel, Render, Supabase, and Cognito setup.
- Documented public vs secret env variables.
- Documented migration order and command sequence.
- Documented activity hardening checks.
- Documented full alpha smoke checklist.
- Documented release blocker checklist with statuses.
- Documented desktop-agent/browser-extension alpha limitations.

## 4. Deployment Readiness Changes

Frontend / Vercel:

- Env requirements documented for `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKMAP_API_URL`, and `NEXT_PUBLIC_COGNITO_*`.
- Build command documented: `pnpm --filter @workmap/web build`.
- Callback URL documented as `/login/callback`; logout URL documented as `/login`.

Backend / Render:

- Env requirements documented for `DATABASE_URL`, Cognito backend config, JWT/pilot fallback config, CORS origins, app URL, and platform admin allowlists.
- Build command documented: `pnpm install && pnpm --filter @workmap/api build`.
- Start command documented: `pnpm --filter @workmap/api start`.
- Health path: `/health`.
- Readiness path: `/health/readiness`.
- Production CORS must use exact origin allowlist; wildcard origin is not recommended or documented.

Supabase:

- Prisma migration sequence documented in order.
- `pnpm prisma:generate` and `pnpm prisma:migrate` documented.
- Seed guidance documented: local demo seed only unless production sample data is intentionally desired.

Cognito:

- Hosted UI domain, PKCE browser app client, verified email, callback/logout URLs, and scopes documented.
- Platform Admin remains independent and requires explicit backend env allowlist.

Realtime / WSS:

- Frontend derives `wss://` from HTTPS API base URL.
- Deployed frontend origin must be included in `WORKMAP_ALLOWED_ORIGINS`.
- Native WebSocket query-token limitation documented.
- Current realtime gateway remains single-instance/in-memory.

## 5. Activity Hardening Notes

Existing Round 7 backend validation remains in place and is now documented as alpha hardening criteria:

- malformed `deviceId`: controlled 400
- cross-user/cross-tenant `deviceId`: controlled 403
- heartbeat spoofing another user's device: controlled 403
- bad timestamp: controlled 400
- future timestamp beyond 5 minutes: controlled 400
- too-old timestamp beyond 31 days: controlled 400
- zero/negative duration: controlled 400
- duration over 12 hours: controlled 400
- empty/malformed app name: controlled 400
- malformed domain: controlled 400
- full URL path/query/fragment: reduced to hostname only
- batch size over 50: controlled 400
- client-supplied tenant/user/role fields: ignored
- employee `scope=company`: controlled 403
- owner company report: same-tenant aggregate only
- Platform Admin: no employee-level activity details by default

No new schema migration was added in Round 8.

## 6. Health / Observability

Endpoints:

- `GET /health`
  - returns liveness only
  - does not touch DB
  - does not leak env/secrets
- `GET /health/readiness`
  - runs `SELECT 1` through Prisma
  - returns `status: ready` and `database: ok` on success
  - returns 503 with `database: unavailable` on failure
  - does not return connection strings or secret values

## 7. Manual Action Required

External setup is still required before claiming deployed alpha readiness:

1. Configure Supabase Postgres and set `DATABASE_URL` securely.
2. Apply all Prisma migrations in order.
3. Configure AWS Cognito Hosted UI callback/logout URLs.
4. Configure Render backend env values.
5. Configure Vercel frontend public env values.
6. Set `WORKMAP_ALLOWED_ORIGINS` to exact Vercel origin(s).
7. Set `WORKMAP_APP_URL` to the deployed frontend URL.
8. Configure platform admin allowlist env values in backend platform settings only.
9. Run deployed `/health` and `/health/readiness`.
10. Run the full alpha smoke checklist in `docs/ai-handoff/alpha-production-readiness.md`.

No real deployed Vercel/Render/Supabase/Cognito smoke was run in this chat.

## 8. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
pnpm --filter @workmap/desktop-agent typecheck
pnpm --filter @workmap/browser-extension typecheck
pnpm --filter @workmap/desktop-agent lint
pnpm --filter @workmap/browser-extension lint
pnpm --filter @workmap/desktop-agent build
pnpm --filter @workmap/browser-extension build
pnpm prisma:generate
git diff --check
```

Results:

- API typecheck passed.
- Web typecheck passed.
- API lint passed.
- Web lint passed.
- API build passed.
- Web build passed.
- Desktop-agent typecheck passed.
- Browser-extension typecheck passed.
- Desktop-agent lint passed.
- Browser-extension lint passed.
- Desktop-agent build passed after rerunning outside the sandbox because Windows/sandbox returned EPERM writing generated `dist/index.js`.
- Browser-extension build passed.
- `pnpm prisma:generate` passed after stopping local WorkMap API/Web node processes that were locking the Prisma Client DLL.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` found no high-confidence matches.
- Web build still prints the existing Next.js ESLint plugin warning.

Not run:

- No real deployed Vercel/Render/Supabase/Cognito smoke.
- No live browser alpha smoke.
- No live invalid-input activity hardening requests in this chat.

## 9. Manual QA Suggestions

Use `docs/ai-handoff/alpha-production-readiness.md`.

Minimum local pre-deploy smoke:

1. Apply migrations.
2. Start API and Web.
3. Check `/health`.
4. Check `/health/readiness`.
5. Owner Cognito login and workspace creation.
6. Owner invite.
7. Employee invite acceptance and onboarding.
8. Owner/Employee virtual office realtime and polling fallback.
9. People panel and contact drawer.
10. Employee device registration.
11. App/domain ingestion.
12. Employee own reports.
13. Owner aggregate reports.
14. Employee blocked from `scope=company`.
15. Platform Admin privacy boundary.
16. Compliance page/modal copy.
17. Dashboard/Reports/Employees/Settings smoke.
18. Invalid activity input hardening checks.
19. Cross-user/cross-tenant device id checks.
20. Secret scan before commit/deploy.

## 10. Risks / Notes

- STAGE 2 can proceed toward controlled alpha deployment preparation, but is still blocked on external service setup and deployed smoke.
- Desktop-agent is still a harness/scaffold, not production active-window tracking.
- Browser extension is still a local Manifest V3 scaffold, not packaged/store-ready.
- No durable offline queue/retry/backoff/token revocation was added.
- Realtime gateway is still in-memory and single-instance.
- `WORKMAP_ALLOWED_ORIGINS` must be configured for deployed browser/WSS access.
- Dev WorkMap API/Web node processes were stopped to unlock Prisma generation and were not restarted automatically.
- `docs/references/` remains unrelated untracked content and should not be staged.

## 11. Docs Update Suggestions

- `docs/skills/deployment-skill.md`: already updated with Round 8 CORS/readiness/deployment guidance.
- `docs/skills/current-status.md`: already updated with Round 8 current status.
- Future docs should add a production desktop-agent pairing/token lifecycle plan before real rollout.
- Future docs should add browser extension CORS/origin and store packaging guidance before external distribution.

## 12. Next Chat Input

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
