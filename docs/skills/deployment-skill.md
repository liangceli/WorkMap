# Deployment Skill

## Runtime / Tooling

Root project: `workmap/`.

Package manager: `pnpm@9.15.0`.

Monorepo tooling: Turborepo.

Primary commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`
- `pnpm smoke:alpha`

App-specific commands:

- Web: `pnpm --filter @workmap/web dev`, `build`, `lint`, `typecheck`.
- API: `pnpm --filter @workmap/api dev`, `build`, `lint`, `typecheck`.
- Desktop agent harness: `pnpm --filter @workmap/desktop-agent build`, `lint`, `typecheck`.
- Browser extension scaffold: `pnpm --filter @workmap/browser-extension build`, `lint`, `typecheck`.

API local development note:

- As of commit `d7152dd`, `pnpm --filter @workmap/api dev` runs `nest build && node dist/apps/api/src/main.js`.
- This is a reliable build-then-run local startup path for `http://localhost:3001`.
- It is not a watch/hot-reload process.
- The compiled API entry imports `load-local-env.js` before `AppModule` so local `.env` values and compiled workspace package aliases are available.
- The pilot release checklist treats this API dev command as a long-running server command, not a command that should complete during verification.

Web local development note:

- As of commit `c2c7d76`, `apps/web/next.config.ts` loads the workspace root `workmap/.env` before exporting Next config.
- The loader walks upward until it finds `pnpm-workspace.yaml`, reads `.env` from that workspace root, skips comments/blank lines, supports simple quoted values, and does not override existing `process.env` keys.
- This lets `pnpm --filter @workmap/web dev` and `pnpm --filter @workmap/web build` see root `NEXT_PUBLIC_*` values.
- Restart the web dev server after changing `workmap/.env`; already-running Next processes will not pick up changed env values.

## Environment Variables

From `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WORKMAP_API_URL`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `NEXT_PUBLIC_COGNITO_SCOPE`
- `API_PORT`
- `WORKMAP_APP_URL`
- `WORKMAP_ALLOWED_ORIGINS`
- `WORKMAP_ALLOWED_ORIGIN`
- `WORKMAP_JWT_SECRET`
- `WORKMAP_PILOT_PASSWORD_HASH`
- `WORKMAP_COGNITO_ISSUER`
- `WORKMAP_COGNITO_REGION`
- `WORKMAP_COGNITO_USER_POOL_ID`
- `WORKMAP_COGNITO_APP_CLIENT_ID`
- `WORKMAP_COGNITO_COMPANY_SLUG`
- `WORKMAP_PLATFORM_ADMIN_EMAILS`
- `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS`
- `WORKMAP_AGENT_TOKEN`
- `WORKMAP_AGENT_DEVICE_ID`
- `WORKMAP_API_BASE_URL`
- `WORKMAP_SMOKE_API_URL`
- `WORKMAP_SMOKE_APP_URL`
- `WORKMAP_SMOKE_ORIGIN`
- `WORKMAP_SMOKE_TIMEOUT_MS`
- `WORKMAP_SMOKE_ALLOW_LOCAL`
- `WORKMAP_APP_URL` is used by invite-link generation when configured; otherwise the API falls back to `NEXT_PUBLIC_APP_URL` or `http://localhost:3000`.
- `WORKMAP_ALLOWED_ORIGINS` is the preferred comma-separated production CORS/WebSocket origin allowlist. Do not use `*`.
- `WORKMAP_ALLOWED_ORIGIN` remains a backward-compatible single-origin fallback.
- The `WORKMAP_SMOKE_*` values are optional shell-only inputs for `pnpm smoke:alpha`. Use public deployed URLs/settings only; do not store tokens or secrets there.

Pilot local startup convention:

- `NEXT_PUBLIC_APP_URL="http://localhost:3000"`
- `NEXT_PUBLIC_WORKMAP_API_URL="http://localhost:3001"`
- `API_PORT="3001"`
- `WORKMAP_ALLOWED_ORIGIN="http://localhost:3000"`
- `WORKMAP_ALLOWED_ORIGINS="http://localhost:3000"`
- `WORKMAP_APP_URL="http://localhost:3000"`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI="http://localhost:3000/login/callback"`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI="http://localhost:3000/login"`

Development-only virtual-office API verification can also use:

- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL`
- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`

These override the seeded demo identity used by the frontend development auth bridge for `POST /auth/dev-token`.

Pilot auth local defaults:

- Seeded/demo password: `workmap-pilot`.
- Example user: `engineer@workmap.demo`.
- Company slug: `workmap-demo-company`.
- Production requires an explicit `WORKMAP_PILOT_PASSWORD_HASH`; without it, pilot login is disabled.

Platform admin env:

- `WORKMAP_PLATFORM_ADMIN_EMAILS` is a comma-separated backend-only allowlist of verified Cognito emails.
- `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` is a comma-separated backend-only allowlist of Cognito subjects.
- `.env.example` keeps these blank. Do not commit real platform admin identities.
- Restart the API after changing platform admin env values.

Activity tracking harness env:

- Desktop-agent harness reads `WORKMAP_API_BASE_URL`, `WORKMAP_AGENT_TOKEN`, and optional `WORKMAP_AGENT_DEVICE_ID`.
- Browser extension local storage keys are `workmapApiBaseUrl`, `workmapAuthToken`, `workmapDeviceId`, and `workmapBrowserName`.
- Do not commit or paste real WorkMap bearer/agent/extension tokens.

## Local API Verification Loop

1. Ensure local `.env` contains `DATABASE_URL`, `API_PORT="3001"`, `NEXT_PUBLIC_APP_URL="http://localhost:3000"`, `NEXT_PUBLIC_WORKMAP_API_URL="http://localhost:3001"`, and `WORKMAP_JWT_SECRET`.
2. Run setup from `workmap/`: `pnpm install`, `pnpm prisma:generate`, `pnpm prisma:migrate`, and `pnpm prisma:seed` when the local DB needs initialization.
3. For STAGE 2 Round 2, ensure migration `20260606000000_stage2_onboarding_invites` has been applied before testing tenant onboarding/invites.
4. For STAGE 2 Round 5, ensure migration `20260607000000_platform_audit_log` has been applied before testing `/platform-admin`.
5. For STAGE 2 Round 7, ensure migration `20260609000000_stage2_activity_source` has been applied before testing activity ingestion.
6. Start API from `workmap/`: `pnpm --filter @workmap/api dev`.
7. Confirm `GET http://localhost:3001/health` returns 200.
8. Confirm `GET http://localhost:3001/health/readiness` returns 200 with `database: ok` after migrations and DB connectivity are ready.
9. Start web from `workmap/`: `pnpm --filter @workmap/web dev`.
10. Open `http://localhost:3000/login`, sign in with the seeded pilot user, and confirm the AppShell session state is clear after refresh.
11. For Cognito owner onboarding, sign in with a new verified Cognito user and confirm `/onboarding/company` can create a backend workspace.
12. For invites, create an Owner invite at `/onboarding/invite`, open `/invite/:token` in a clean/incognito browser, sign in with the invited verified email, and accept into the workspace.
13. For platform admin, configure a real allowlisted Cognito email/sub locally without committing it, restart API, sign in with that Cognito identity, and confirm `/platform-admin` loads without tenant onboarding.
14. For activity tracking, register a device, ingest one app usage event, ingest one domain usage event, and confirm `/reports`, `/dashboard`, and `/compliance` reflect the new tracking loop and privacy boundaries.
15. Open `http://localhost:3000/dashboard` and confirm API health, auth context, remote presence, compliance, reports readiness, and tracking coverage sections show live/fallback states clearly.
16. Open `http://localhost:3000/reports` and confirm API-backed own/company usage rows or sparse-data explanation, with RBAC-appropriate scope.
17. Open `http://localhost:3000/compliance`, confirm policy loading, acknowledgement behavior, collected data, and non-collected data copy.
18. Open `http://localhost:3000/virtual-office` and confirm development auth and virtual-office read requests target backend port 3001.
19. For position persistence QA, confirm `PUT /virtual-office/map/:officeMapId/positions/me` targets backend port 3001 and uses Bearer authorization.
20. For polling presence QA, confirm `GET /virtual-office/map/:officeMapId/positions` repeats about every 4 seconds while visible and about every 15 seconds while hidden.
21. For realtime movement QA, open two authenticated browsers in the same company/map and confirm `/virtual-office/realtime` connects, movement is smooth in both directions, and polling still reconciles after refresh.
22. For People/Presence MVP QA, verify People panel, command palette, and backend-off fallback in the browser at `http://localhost:3000/virtual-office` while API runs on `http://localhost:3001`.
23. If `/virtual-office` shows an unexpected 500 while build checks pass, clean-restart API and web dev servers before treating it as a product regression.

Detailed release smoke steps live in `docs/ai-handoff/pilot-release-checklist.md`.

## STAGE 2 Deployment Readiness

Read `docs/ai-handoff/alpha-production-readiness.md` before external deployment work. For the Round 9 external smoke runbook, read `docs/ai-handoff/real-alpha-deployment-smoke.md`.

Target platform direction:

- Frontend: Vercel.
- Backend: Render.
- Database: Supabase Postgres.
- Auth: AWS Cognito Hosted UI with browser PKCE.

Vercel frontend:

- Root directory: `workmap`.
- Install command: `pnpm install`.
- Build command: `pnpm --filter @workmap/web build`.
- `workmap/pnpm-lock.yaml` should be committed so Vercel can install deterministically with the lockfile from GitHub.
- Required public env includes `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKMAP_API_URL`, and `NEXT_PUBLIC_COGNITO_*`.
- Cognito callback should point to `https://<vercel-domain>/login/callback`.
- Cognito logout should point to `https://<vercel-domain>/login`.

Render backend:

- Root directory: `workmap`.
- Build command: `pnpm install && pnpm --filter @workmap/api build`.
- Start command: `pnpm --filter @workmap/api start`.
- Health check path: `/health`.
- Required server env includes `DATABASE_URL`, `WORKMAP_ALLOWED_ORIGINS`, `WORKMAP_JWT_SECRET`, `WORKMAP_PILOT_PASSWORD_HASH`, and `WORKMAP_COGNITO_*`.
- For `/platform-admin`, set `WORKMAP_PLATFORM_ADMIN_EMAILS` and/or `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` in Render environment settings only.
- Set `WORKMAP_APP_URL` to the deployed Vercel app URL so generated invite links are not localhost links.
- `WORKMAP_ALLOWED_ORIGINS` must match the Vercel frontend origin(s). `WORKMAP_ALLOWED_ORIGIN` is a single-origin fallback.
- Production API CORS rejects browser origins when no allowed origins are configured.
- Readiness check path is `/health/readiness` and verifies DB connectivity without exposing secrets.
- `/virtual-office/realtime` uses WebSocket upgrade on the same API origin. Ensure the platform/proxy supports WebSocket upgrades.
- Single-instance API deployment is acceptable for the current in-memory realtime gateway. Multi-instance deployment needs shared pub/sub first.

Supabase:

- Use the Supabase Postgres connection string as `DATABASE_URL`.
- Run Prisma generate/migrate/seed against the intended database.
- Include migration `20260606000000_stage2_onboarding_invites` before Round 2 deployed smoke.
- Include migration `20260607000000_platform_audit_log` before Round 5 platform-admin deployed smoke.
- Include migration `20260609000000_stage2_activity_source` before Round 7 activity tracking deployed smoke.
- Alpha Round 8 does not add a migration, but it documents the required migration order in `docs/ai-handoff/alpha-production-readiness.md`.
- No Supabase RLS or multi-tenant schema work is included in STAGE 2.

Desktop agent / browser extension:

- Round 7 desktop-agent is a Node/TypeScript harness, not production active-window tracking.
- Round 7 browser extension is a local Manifest V3 scaffold, not packaged/store-ready production tracking.
- Deployed browser extension testing requires explicit CORS/origin review and secure pairing/token setup before pointing the extension at a deployed API.
- Add offline queueing, retry/backoff, token revocation, packaging, permissions review, and distribution workflow before production rollout.

Cognito:

- Configure Hosted UI domain, browser PKCE app client, callback/logout URLs, and `openid email profile` scopes.
- Backend maps verified Cognito users through `User.cognitoSub` when available and can bind one safe exact legacy email match.
- Full global identity/account and tenant-membership architecture remains future work.

Realtime WebSocket deployment:

- The frontend derives `ws://` or `wss://` from `NEXT_PUBLIC_WORKMAP_API_URL`; deployed HTTPS API URLs should become WSS automatically.
- `WORKMAP_ALLOWED_ORIGINS` should include the exact deployed frontend origin(s) so HTTP CORS and WebSocket origin checks pass. `WORKMAP_ALLOWED_ORIGIN` remains a single-origin fallback.
- Browser socket auth sends the Bearer token as query `token`; use WSS and avoid retaining full socket query strings in logs.
- Run deployed smoke with two authenticated users in one company/map before considering realtime movement production-ready.

External smoke helper:

- Set `WORKMAP_SMOKE_API_URL` to the deployed Render API origin.
- Set `WORKMAP_SMOKE_APP_URL` to the deployed Vercel app origin.
- Set `WORKMAP_SMOKE_ORIGIN` to the browser origin to test; usually the same Vercel origin.
- Run `pnpm smoke:alpha` from `workmap/`.
- The helper checks `/health`, `/health/readiness`, CORS allowlist behavior, key frontend route availability, and derived WSS path. It does not test authenticated Cognito/tenant/invite/activity flows.
- Round 9 reports `pnpm smoke:alpha` and full authenticated human smoke passed on 2026-06-13, making WorkMap an Alpha Ready Candidate for a controlled 5-person pilot.

## Deployment Caution

`load-local-env.ts` is imported by the API main entry and registers compiled workspace aliases when the compiled local paths exist. It does not overwrite existing environment variables. Production/deployed startup should provide required env vars explicitly and should be reviewed if deployment uses the same compiled entry path.

The web root `.env` loader is for local monorepo ergonomics. Vercel/Render production values should be set in platform environment settings; do not rely on a committed `.env` for real deployment secrets.

## Deployment Unknowns

- Redis is listed in env example but no confirmed runtime usage was found during intake.
- The accepted realtime gateway is in-memory and does not currently use Redis/pub-sub.
- Desktop agent and browser extension are now local scaffolds/harnesses for activity ingestion, but not production-ready tracking clients.
- Round 9 deployed Vercel/Render/Supabase/Cognito alpha smoke passed as human-reported evidence on 2026-06-13, but repeat smoke is still required after provider env, callback/logout, origin, migration, or deployment changes.
