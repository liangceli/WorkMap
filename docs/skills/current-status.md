# Current Status

Last updated: 2026-06-02.

## Latest Accepted Work

- Commit `2a4a269` (`Add development API auth bridge for virtual office`) added a frontend-only development auth bridge so `/virtual-office` can request a dev Bearer token from the existing backend `POST /auth/dev-token` endpoint for local API-data verification.
- The bridge is browser-only, development-only, stores cached token data in `localStorage` under `workmap.devApiAuth`, chooses seeded demo identities from the current frontend demo workflow role, and supports `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL` / `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG` overrides.
- `/virtual-office` now asks for development API auth before its read-only map/navigation/positions API calls and passes `{ token }` when available. If token creation or API reads fail, existing mock fallback remains active.
- Commit `abe673c` (`Wire virtual office to read APIs with mock fallback`) connected `/virtual-office` to existing virtual-office read APIs in a conservative read-only way.
- The frontend now attempts `GET /virtual-office/map`, `GET /virtual-office/navigation`, and then `GET /virtual-office/map/:officeMapId/positions` after a valid map id is available.
- `useVirtualOfficeData.ts` starts from mock data, validates API response shapes, adapts safe rooms/navigation/remote player fields, and keeps mock fallback for unavailable, unauthorized, invalid, empty, or partial API responses.
- Canvas rendering still uses `/maps/workmap2.tmx`; backend `OfficeMap.mapData` is not used as the frontend canvas source.
- No backend changes, Prisma changes, polling, websocket, realtime presence, or position persistence were added.

## Confirmed Current State

- Monorepo scaffold is active with Next.js web, NestJS API, Prisma/Postgres schema, and shared packages.
- Web app includes routes for login, onboarding, dashboard, employees, reports, compliance, integrations, settings, avatar debug, and `/virtual-office`.
- `/virtual-office` renders a canvas-based `OfficeMap` using `/maps/workmap2.tmx`, office tilesets, layered avatar assets, local movement, collision detection, click/double-click navigation, chair interaction, and remote office data that can come from validated read APIs or mock fallback.
- Backend exposes guarded endpoints for auth, users, companies, devices, reports, virtual office, integrations, and compliance.
- Prisma schema contains company, department, users, devices, activity events, usage summaries, office maps, rooms, virtual office positions, monitoring policies, policy acknowledgements, integrations, and audit logs.
- Seed data creates a demo company, users, default office map/rooms, policy, device rows, virtual office positions, usage summaries, integrations, and an audit event.

## Known Issues / Risks

- Authenticated API success path is still not fully verified because the backend was not listening on `localhost:3001` during QA. Fallback behavior was verified when backend/API was unavailable.
- Production auth/session remains unimplemented; the dev auth bridge is explicitly local-development verification only.
- The dev auth bridge assumes seeded demo users from `prisma/seed.ts` exist locally, unless public dev env overrides are supplied.
- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must match the current TMX pixel coordinate system to be accepted safely.
- API-derived remote players use fallback role text (`Team member`) and may route profiles by raw user id.
- Local player position updates are not currently persisted through an exposed API endpoint; `VirtualOfficeService.persistLatestPosition` exists but no controller route calls it.
- Presence remains read-only/client-side for the virtual office; no websocket, polling loop, or real-time backend sync was added.
- Web onboarding/login flow uses frontend-only localStorage workflow state and is not real authentication.
- `docs/references/` remains untracked reference material and should not be committed accidentally.

## Recommended Next Tasks

- Start/fix the backend so it listens on `http://localhost:3001`, then visually verify dev-token success and API-backed virtual office data in a browser.
- Decide the production auth/session model separately from the development auth bridge.
- Add or decide against an API route for persisting current player position.
- Define real-time presence strategy: polling, websocket, or another transport.
- Replace frontend-only demo workflow state with real auth/session wiring when ready.
- Add tests for pathfinding, API contracts, auth guard behavior, and key UI routing workflows.
