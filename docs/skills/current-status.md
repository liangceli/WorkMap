# Current Status

Last updated: 2026-06-06.

## Latest Accepted Work

- Commit `c2c7d76` (`feat: add stage 2 cognito deployment baseline`) completed the STAGE 2 Cognito/deployment baseline and root `.env` local loading follow-up.
- Web local dev/build now loads the workspace root `workmap/.env` from `apps/web/next.config.ts` without overwriting existing platform/shell env values, so `apps/web/.env.local` is no longer required for local STAGE 2 Cognito public config.
- `.env.example` now separates frontend public env, backend/server env, Cognito backend verification env, pilot fallback env, and local port defaults.
- `docs/ai-handoff/stage2-deployment-readiness.md` now documents Vercel frontend, Render backend, Supabase Postgres, Cognito Hosted UI, Cognito email-to-WorkMap-user mapping, and smoke checks.
- Backend now includes Cognito JWT verification through JWKS/RS256, issuer and audience/client-id checks, expiry/nbf validation, verified-email enforcement, and temporary email-to-existing-user mapping.
- `RequestContextGuard` auth priority is Cognito Bearer first, WorkMap JWT second, and development headers only outside production.
- Frontend now supports Cognito Hosted UI PKCE sign-in, `/login/callback` token exchange, `workmap.cognitoSession` storage, Cognito logout URL generation, and backend `/auth/me` mapping before entering WorkMap.
- Frontend API auth now prefers a mapped Cognito session, then pilot session, then development dev-token/dev-cache.
- Pilot auth fallback, backend `email_verified` enforcement, and development-only dev-token behavior were preserved.
- Commit `79ac906` (`feat: add pilot readiness dashboard and reports QA`) completed the Pilot Deployment + Dashboard/Reports/Compliance QA pass.
- `.env.example` now documents the minimum pilot startup variables and local port convention: web on `http://localhost:3000`, API on `http://localhost:3001`.
- `docs/ai-handoff/pilot-release-checklist.md` now captures install, Prisma generate/migrate/seed, startup, health/page checks, and 5-user virtual-office regression checks.
- AppShell now gives clearer missing-session behavior, derives role from the stored pilot session when available, limits fallback navigation before session setup, and links back to `/login`.
- `/dashboard` now acts as a pilot readiness surface by loading API health, auth context, virtual-office presence, compliance policy, and reports usage summary with explicit fallback/error states.
- `/reports` now loads authenticated `/reports/usage-summary`, displays current-user app/domain rows when present, explains sparse pilot data, and keeps department rows labeled as pilot examples until a team aggregate API exists.
- Compliance was rechecked during this pass and kept on the existing backend policy/acknowledgement path and privacy boundary copy.
- `/virtual-office` implementation files were intentionally left unchanged; clean-restart QA confirmed no 500 after stale dev processes were cleared.
- Commit `14fb706` (`feat: add pilot auth and compliance boundary`) implemented the Pilot Auth + Privacy/Compliance Boundary MVP.
- Backend now exposes `POST /auth/pilot-login`, using email/password/company slug, PBKDF2 password verification, timing-safe comparison, and backend-issued JWT responses aligned with the dev-token response shape.
- Frontend stores pilot sessions in `localStorage` under `workmap.pilotSession`, clears expired sessions, maps roles into existing workflow state, and exposes logout/session clear behavior.
- API auth now uses a unified resolver: stored pilot session first, development dev-token/dev-cache fallback second.
- `/virtual-office` now prefers the pilot Bearer session for API calls while preserving current-user filtering, save/restore, polling presence, and backend-off fallback behavior.
- `/login` is now a pilot sign-in surface with seeded pilot users, password/company slug fields, pilot session display, open-office action, logout/session clear, and clearly labeled frontend fallback.
- `/compliance` now loads backend policy with current API auth, posts acknowledgement through existing backend endpoints, and shows pilot transparency copy for what WorkMap shows and does not monitor.
- People panel and compliance copy now explain privacy boundaries: presence/avatar location/status/freshness are visible; screen recording, keystrokes, hidden camera/mic, private message/email content, passwords, and invisible spying are not shown.
- Commit `b68dd49` (`feat(virtual-office): improve team presence experience`) completed the 5-person presence/team UX MVP around the existing polling sync.
- People panel now separates the current user (`You`) from remote teammates, shows active/idle/offline summary counts, readable freshness/last-seen text, status filters, search/empty states, and backend/fallback/empty source notes.
- Command palette People results now show freshness/last-seen context and friendly empty search rows.
- Presence freshness logic is centralized in `presence.ts` through `statusFromFreshness` and `presenceFreshnessLabel`.
- Room labels in People panel and command palette resolve through known destinations and fall back to `Office area`; raw room UUIDs are not shown.
- Current-user position saves now omit frontend/mock non-UUID `roomId` values; backend DTO and service validation reject invalid optional `roomId` before Prisma.
- Polling-driven remote updates no longer restart/reload the TMX canvas animation loop; `OfficeMap` reads latest remote people and selected remote id from refs.
- Commit `effb188` (`feat(virtual-office): add polling presence sync`) added basic polling presence for the 5-person `/virtual-office` pilot.
- `useVirtualOfficeData.ts` now periodically refreshes `GET /virtual-office/map/:officeMapId/positions` when `officeMapId`, authenticated API options, and `currentUserId` are available.
- Visible tabs poll about every `4000ms`; hidden tabs poll about every `15000ms`, with prompt refresh when returning to visible.
- Polling updates remote players and current-user position data while preserving local player control in `OfficeMap.tsx`.
- Current user remains filtered out of remote players, API-valid empty remote results show no mock people, and failed polls keep the last good mounted state or initial fallback.
- Remote freshness maps `updatedAt` to existing statuses: under 30 seconds keeps backend status, 30 seconds to 5 minutes becomes `idle` unless already `offline`, and older than 5 minutes becomes `offline`.
- Commit `1a0a19f` (`feat(virtual-office): persist current player position`) closed the current-user latest-position loop for `/virtual-office`.
- Backend now exposes guarded `PUT /virtual-office/map/:officeMapId/positions/me`. It uses request context for `companyId`/`userId`, validates the body, and calls the existing latest-position upsert service path.
- Frontend now restores the local player once from the current user's saved API position when available, filters the current user out of remote players, and saves meaningful local player changes through throttled/debounced PUT requests.
- A restore/save guard prevents stale default local coordinates from being immediately saved over a restored backend position.
- Backend-off/auth-off mock fallback and local movement remain supported. No websocket, SSE, complex realtime infrastructure, historical trail, or broad user-position mutation was added.
- Commit `d7152dd` (`Fix local API startup for virtual office verification`) completed the local API-backed virtual office verification loop.
- `pnpm --filter @workmap/api dev` now runs `nest build && node dist/apps/api/src/main.js`, giving a reliable local API on `http://localhost:3001` for verification. This trades away API hot reload/watch behavior.
- `.env.example` now documents `WORKMAP_JWT_SECRET`, required for local dev-token signing.
- API startup imports `load-local-env.js`, which loads the nearest `.env` without overwriting existing env vars and registers compiled workspace aliases for `@workmap/auth` and `@workmap/shared-types`.
- `AuthModule` is now global so auth providers resolve consistently for guards used across feature modules.
- Local verification confirmed health, dev-token, authenticated virtual-office map/navigation/positions reads, browser API-backed state, and backend-stopped mock fallback.
- Commit `2a4a269` (`Add development API auth bridge for virtual office`) added a frontend-only development auth bridge so `/virtual-office` can request a dev Bearer token from the existing backend `POST /auth/dev-token` endpoint for local API-data verification.
- The bridge is browser-only, development-only, stores cached token data in `localStorage` under `workmap.devApiAuth`, chooses seeded demo identities from the current frontend demo workflow role, and supports `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL` / `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG` overrides.
- `/virtual-office` now asks for development API auth before its read-only map/navigation/positions API calls and passes `{ token }` when available. If token creation or API reads fail, existing mock fallback remains active.
- Commit `abe673c` (`Wire virtual office to read APIs with mock fallback`) connected `/virtual-office` to existing virtual-office read APIs in a conservative read-only way.
- The frontend now attempts `GET /virtual-office/map`, `GET /virtual-office/navigation`, and then `GET /virtual-office/map/:officeMapId/positions` after a valid map id is available.
- `useVirtualOfficeData.ts` starts from mock data, validates API response shapes, adapts safe rooms/navigation/remote player fields, and keeps mock fallback for unavailable, unauthorized, invalid, empty, or partial API responses.
- Canvas rendering still uses `/maps/workmap2.tmx`; backend `OfficeMap.mapData` is not used as the frontend canvas source.
- No backend business logic outside current-user latest-position persistence, Prisma changes, websocket, or SSE realtime infrastructure were added.

## Confirmed Current State

- Monorepo scaffold is active with Next.js web, NestJS API, Prisma/Postgres schema, and shared packages.
- Web app includes routes for login, onboarding, dashboard, employees, reports, compliance, integrations, settings, avatar debug, and `/virtual-office`.
- `/login` now supports Cognito Hosted UI sign-in when `NEXT_PUBLIC_COGNITO_*` config is available, while preserving pilot fallback.
- `/login/callback` completes Cognito code exchange, validates backend WorkMap mapping through `/auth/me`, and routes mapped users into `/virtual-office`.
- `/virtual-office` renders a canvas-based `OfficeMap` using `/maps/workmap2.tmx`, office tilesets, layered avatar assets, local movement, collision detection, click/double-click navigation, chair interaction, and remote office data that can come from validated read APIs or mock fallback.
- `/dashboard` can now show pilot readiness across API health, auth/session, remote presence, compliance policy, and reports usage.
- `/reports` can now show authenticated current-user app/domain usage summaries from the API, with sparse-data and pilot-example labels where backend aggregate data is not available.
- Backend exposes guarded endpoints for auth, users, companies, devices, reports, virtual office, integrations, and compliance.
- Backend request context can now resolve Cognito users from verified Cognito JWTs before falling back to WorkMap pilot/dev JWTs.
- Prisma schema contains company, department, users, devices, activity events, usage summaries, office maps, rooms, virtual office positions, monitoring policies, policy acknowledgements, integrations, and audit logs.
- Seed data creates a demo company, users, default office map/rooms, policy, device rows, virtual office positions, usage summaries, integrations, and an audit event.

## Known Issues / Risks

- Real external deployment smoke for Vercel/Render/Cognito is still pending after commit/push; the readiness doc is a checklist, not proof of deployed production success.
- Root `.env` changes require restarting the Next dev server before `/login` reflects updated `NEXT_PUBLIC_COGNITO_*` values.
- Local browser smoke should use `http://localhost:3000`; using `http://127.0.0.1:3000` can fail CORS when `WORKMAP_ALLOWED_ORIGIN` is `http://localhost:3000`.
- Cognito mapping is temporary STAGE 2 email mapping. Future schema-backed Cognito `sub`/identity mapping and tenant provisioning remain undecided.
- If a Cognito session exists but backend mapping fails, frontend API auth returns unavailable and does not silently fall back to pilot auth until Cognito session is cleared.
- Cognito Hosted UI sign-in requires verified email and an existing WorkMap user record with matching email; unmapped, unverified, or ambiguous users are rejected.
- Dashboard can show a mixed state of live API checks and pilot example/sample sections; labels must remain explicit.
- Reports are currently current-user usage summaries only. Team/department aggregate reporting remains a future backend contract.
- Compliance acknowledgement readback is still not returned by `GET /compliance/policy`; frontend readability relies on a browser marker after successful acknowledgement.
- AppShell improves session clarity but is not full production route protection.
- A stale running Next dev process produced a false `/virtual-office` 500 during automated smoke; clean restart of API/frontend resolved it and should be part of future release smoke.
- Backend API room coordinates do not perfectly match the current TMX mock zones. API-backed state can show a different current workspace than fallback at the same player coordinates.
- Browser-level save/restore closed-loop QA still needs manual confirmation; implementation verified API closed loop through shell, but browser automation was unavailable.
- Polling presence manual QA passed, but future regression should keep checking cadence, hidden-tab behavior, current-user filtering, empty API remote list behavior, and backend failure last-good fallback.
- Browser/manual QA passed for the People/Presence UI follow-up fixes, including UUID-free room labels, filter style overlay fix, contact drawer, remote update after API change, backend-off fallback, and no visible map refresh during polling.
- Full final regression for movement/collision/auto-walk/chair interaction and full desktop/narrow layout sweep remains recommended.
- Failed identical save snapshots may not retry until another meaningful player position/status/direction/room change happens.
- The implementation test updated local dev DB position for `engineer@workmap.demo` to `x=333`, `y=444`, `direction=right`.
- API `dev` script is now build-then-run, not watch/hot reload.
- `load-local-env.ts` is imported unconditionally by the API entry. It preserves existing env vars, but deployment expectations should stay explicit.
- Enterprise production auth/session is partially started through STAGE 2 Cognito baseline, but account lifecycle, MFA policy, password reset flows, tenant admin management, stable Cognito identity mapping, and full route guards remain unimplemented.
- Pilot auth is pilot-ready but not enterprise production auth: no SSO/OAuth, MFA, password reset, tenant credential lifecycle, or full route permission overhaul.
- Production pilot login requires explicit `WORKMAP_PILOT_PASSWORD_HASH`; without it, pilot login is disabled in production.
- Compliance acknowledgement readback is not exposed by the backend policy endpoint; frontend stores a browser marker only after successful backend acknowledgement.
- The dev auth bridge assumes seeded demo users from `prisma/seed.ts` exist locally, unless public dev env overrides are supplied.
- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must match the current TMX pixel coordinate system to be accepted safely.
- API-derived remote players use fallback role text (`Team member`) and may route profiles by raw user id.
- Current user's latest local position can now be restored from and saved to the backend in development/API-backed mode.
- Basic polling presence is implemented for remote players; no websocket/SSE realtime infrastructure was added.
- Web onboarding/login flow uses frontend-only localStorage workflow state and is not real authentication.
- `docs/references/` remains untracked reference material and should not be committed accidentally.

## Recommended Next Tasks

- Execute deployed smoke on real Vercel/Render/Cognito URLs after confirming environment variables and callback/logout URLs.
- Decide the stable Cognito identity model: `cognitoSub` field vs identity table, tenant membership, invite/onboarding, and migration from pilot users.
- Consider clearer manual recovery for Cognito mapping failure, including sign-out/clear-session guidance before using pilot fallback.
- Add automated tests for Cognito token verification, email_verified enforcement, mapping ambiguity, auth priority, `/login/callback`, and root `.env` loading behavior.
- Add a backend team/department aggregate reports endpoint so dashboard/reports can remove pilot-example aggregate rows.
- Add compliance acknowledgement status to `GET /compliance/policy`.
- Add production-grade route guards/session enforcement when moving beyond pilot readiness.
- Use `docs/ai-handoff/pilot-release-checklist.md` as the repeatable pre-release smoke checklist, including a clean restart before `/virtual-office` checks.
- Decide whether a separate API hot-reload command is needed alongside the reliable build-then-run `dev` command.
- Align backend office room coordinate data with the current TMX map zones, or document the mismatch as accepted MVP behavior.
- Manually verify browser save-after-move and refresh-restore behavior, including no immediate stale PUT after restore.
- Decide whether `break` needs a dedicated People filter or should remain visible only in all/search.
- Consider explicit last-seen UI refresh cadence if labels need to update independently of polling.
- Decide the production auth/session model separately from the development auth bridge.
- Decide the production auth roadmap: SSO/OAuth, MFA, password reset, tenant admin credential lifecycle, and route guards.
- Decide whether backend compliance policy responses should include acknowledgement status instead of relying on browser marker readability.
- Decide whether polling is sufficient for MVP or whether websocket/SSE realtime presence is needed later.
- Replace frontend-only demo workflow state with real auth/session wiring when ready.
- Add tests for pathfinding, API contracts, auth guard behavior, and key UI routing workflows.
