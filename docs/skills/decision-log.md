# Decision Log

## 2026-06-02 - First-Time Documentation Intake

Decision: Establish `docs/skills` as the project context and documentation layer for WorkMap.

Reason: The repository had useful docs and reference material, but the requested project-intake skill structure was missing.

Trade-off: This intake documents current behavior without changing application code. Any code issues or missing features are recorded as risks/tasks rather than fixed.

## 2026-06-02 - Virtual Office Read API Integration

Decision: Wire `/virtual-office` to existing virtual-office read endpoints with conservative mock fallback, while keeping TMX as the canvas source.

Reason: This lets the frontend safely consume backend map, navigation, and position data when available without breaking the current demo experience when the API is unavailable, unauthorized, invalid, or partial.

Trade-off: The integration remains read-only and one-time-on-mount. It intentionally does not add position persistence, polling, websocket realtime presence, backend map rendering, or auth/session changes.

## 2026-06-02 - Development API Auth Bridge

Decision: Add a frontend-only development auth bridge that requests existing backend dev tokens for local `/virtual-office` API verification.

Reason: The read API integration needed a safe way to verify real backend-backed map, navigation, and positions data in local development without implementing production auth.

Trade-off: The bridge stores a dev token in browser `localStorage` and depends on seeded demo users, so it is explicitly disabled outside development and must not be treated as production session handling.

## 2026-06-02 - Reliable Local API Startup

Decision: Change API `dev` to a reliable build-then-run command and add a local startup helper for env loading and compiled workspace alias resolution.

Reason: In this workspace layout, the previous watch-based local API startup compiled but did not produce a listening server on `localhost:3001`, blocking local virtual-office API verification.

Trade-off: `pnpm --filter @workmap/api dev` no longer provides hot reload. `load-local-env.ts` is imported by the API entry, so deployment/startup expectations must remain explicit even though existing env vars are preserved.

## 2026-06-03 - Current-User Position Persistence

Decision: Add a guarded current-user latest-position save route and frontend restore/save loop for `/virtual-office`.

Reason: Local virtual-office verification needed a complete loop where the authenticated current user can return to a saved backend position and persist meaningful local movement changes.

Trade-off: This is latest-position-only and scoped to the current request context. It intentionally avoids polling, websocket realtime presence, historical position trails, arbitrary user mutation, production auth changes, and TMX/movement behavior changes.

## Existing Project Decisions Confirmed From Code

- Use `pnpm` + Turborepo monorepo.
- Use Next.js for web frontend.
- Use NestJS for backend API.
- Use Prisma with PostgreSQL as the data model layer.
- Treat SkyOffice as reference-only material.
- Use frontend-only localStorage workflow state for current demo onboarding/login, not production auth.
