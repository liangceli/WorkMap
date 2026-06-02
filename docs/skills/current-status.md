# Current Status

Last intake: 2026-06-02.

## Confirmed Current State

- Monorepo scaffold is active with Next.js web, NestJS API, Prisma/Postgres schema, and shared packages.
- Web app includes routes for login, onboarding, dashboard, employees, reports, compliance, integrations, settings, avatar debug, and `/virtual-office`.
- `/virtual-office` renders a canvas-based `OfficeMap` using `/maps/workmap2.tmx`, office tilesets, layered avatar assets, room zones, local movement, collision detection, click/double-click navigation, chair interaction, and mock remote players.
- Backend exposes guarded endpoints for auth, users, companies, devices, reports, virtual office, integrations, and compliance.
- Prisma schema contains company, department, users, devices, activity events, usage summaries, office maps, rooms, virtual office positions, monitoring policies, policy acknowledgements, integrations, and audit logs.
- Seed data creates a demo company, users, default office map/rooms, policy, device rows, virtual office positions, usage summaries, integrations, and an audit event.

## Known Issues / Risks

- Frontend virtual office currently uses `mockOfficeData.ts` for rooms, remote players, and tileset metadata rather than consuming backend virtual-office endpoints.
- Local player position updates are not currently persisted through an exposed API endpoint; `VirtualOfficeService.persistLatestPosition` exists but no controller route calls it.
- Presence is simulated from local player state, room zones, chair state, and mock remote players; no websocket, polling loop, or real-time backend sync was confirmed.
- Web onboarding/login flow uses frontend-only localStorage workflow state and is not real authentication.
- `docs/skills` was missing before this intake.
- Git worktree contains pre-existing modified files outside this docs intake; do not revert them without explicit instruction.

## Recommended Next Tasks

- Connect `/virtual-office` to backend `GET /virtual-office/map`, `GET /virtual-office/navigation`, and `GET /virtual-office/map/:officeMapId/positions`.
- Add or decide against an API route for persisting current player position.
- Define real-time presence strategy: polling, websocket, or another transport.
- Replace frontend-only demo workflow state with real auth/session wiring when ready.
- Add tests for pathfinding, API contracts, auth guard behavior, and key UI routing workflows.
