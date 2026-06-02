# Current Status

Last updated: 2026-06-02.

## Latest Accepted Work

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

- Real API data usage was not visually confirmed in-browser during the implementation run, though user manual acceptance was reported as passed.
- Current frontend auth/session flow does not yet provide a confirmed Bearer token path to the virtual-office API client, so unauthorized API responses may still fall back to mock data.
- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must match the current TMX pixel coordinate system to be accepted safely.
- API-derived remote players use fallback role text (`Team member`) and may route profiles by raw user id.
- Local player position updates are not currently persisted through an exposed API endpoint; `VirtualOfficeService.persistLatestPosition` exists but no controller route calls it.
- Presence remains read-only/client-side for the virtual office; no websocket, polling loop, or real-time backend sync was added.
- Web onboarding/login flow uses frontend-only localStorage workflow state and is not real authentication.
- `docs/references/` remains untracked reference material and should not be committed accidentally.

## Recommended Next Tasks

- Confirm real API-backed virtual office data visually in a browser with backend/auth configured.
- Add or decide against an API route for persisting current player position.
- Define real-time presence strategy: polling, websocket, or another transport.
- Replace frontend-only demo workflow state with real auth/session wiring when ready.
- Add tests for pathfinding, API contracts, auth guard behavior, and key UI routing workflows.
