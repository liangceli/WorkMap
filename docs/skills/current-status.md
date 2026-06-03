# Current Status

Last updated: 2026-06-03.

## Latest Accepted Work

- Commit `1a0a19f` (`feat(virtual-office): persist current player position`) closed the current-user latest-position loop for `/virtual-office`.
- Backend now exposes guarded `PUT /virtual-office/map/:officeMapId/positions/me`. It uses request context for `companyId`/`userId`, validates the body, and calls the existing latest-position upsert service path.
- Frontend now restores the local player once from the current user's saved API position when available, filters the current user out of remote players, and saves meaningful local player changes through throttled/debounced PUT requests.
- A restore/save guard prevents stale default local coordinates from being immediately saved over a restored backend position.
- Backend-off/auth-off mock fallback and local movement remain supported. No polling, websocket, realtime presence, historical trail, or broad user-position mutation was added.
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
- No backend business logic outside current-user latest-position persistence, Prisma changes, polling, websocket, or realtime presence were added.

## Confirmed Current State

- Monorepo scaffold is active with Next.js web, NestJS API, Prisma/Postgres schema, and shared packages.
- Web app includes routes for login, onboarding, dashboard, employees, reports, compliance, integrations, settings, avatar debug, and `/virtual-office`.
- `/virtual-office` renders a canvas-based `OfficeMap` using `/maps/workmap2.tmx`, office tilesets, layered avatar assets, local movement, collision detection, click/double-click navigation, chair interaction, and remote office data that can come from validated read APIs or mock fallback.
- Backend exposes guarded endpoints for auth, users, companies, devices, reports, virtual office, integrations, and compliance.
- Prisma schema contains company, department, users, devices, activity events, usage summaries, office maps, rooms, virtual office positions, monitoring policies, policy acknowledgements, integrations, and audit logs.
- Seed data creates a demo company, users, default office map/rooms, policy, device rows, virtual office positions, usage summaries, integrations, and an audit event.

## Known Issues / Risks

- Backend API room coordinates do not perfectly match the current TMX mock zones. API-backed state can show a different current workspace than fallback at the same player coordinates.
- Browser-level save/restore closed-loop QA still needs manual confirmation; implementation verified API closed loop through shell, but browser automation was unavailable.
- Failed identical save snapshots may not retry until another meaningful player position/status/direction/room change happens.
- The implementation test updated local dev DB position for `engineer@workmap.demo` to `x=333`, `y=444`, `direction=right`.
- API `dev` script is now build-then-run, not watch/hot reload.
- `load-local-env.ts` is imported unconditionally by the API entry. It preserves existing env vars, but deployment expectations should stay explicit.
- Production auth/session remains unimplemented; the dev auth bridge is explicitly local-development verification only.
- The dev auth bridge assumes seeded demo users from `prisma/seed.ts` exist locally, unless public dev env overrides are supplied.
- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must match the current TMX pixel coordinate system to be accepted safely.
- API-derived remote players use fallback role text (`Team member`) and may route profiles by raw user id.
- Current user's latest local position can now be restored from and saved to the backend in development/API-backed mode.
- Presence remains non-realtime; no websocket, polling loop, or real-time backend sync was added.
- Web onboarding/login flow uses frontend-only localStorage workflow state and is not real authentication.
- `docs/references/` remains untracked reference material and should not be committed accidentally.

## Recommended Next Tasks

- Decide whether a separate API hot-reload command is needed alongside the reliable build-then-run `dev` command.
- Align backend office room coordinate data with the current TMX map zones, or document the mismatch as accepted MVP behavior.
- Manually verify browser save-after-move and refresh-restore behavior, including no immediate stale PUT after restore.
- Decide the production auth/session model separately from the development auth bridge.
- Define real-time presence strategy: polling, websocket, or another transport.
- Replace frontend-only demo workflow state with real auth/session wiring when ready.
- Add tests for pathfinding, API contracts, auth guard behavior, and key UI routing workflows.
