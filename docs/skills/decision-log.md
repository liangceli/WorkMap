# Decision Log

## 2026-06-02 - First-Time Documentation Intake

Decision: Establish `docs/skills` as the project context and documentation layer for WorkMap.

Reason: The repository had useful docs and reference material, but the requested project-intake skill structure was missing.

Trade-off: This intake documents current behavior without changing application code. Any code issues or missing features are recorded as risks/tasks rather than fixed.

## 2026-06-02 - Virtual Office Read API Integration

Decision: Wire `/virtual-office` to existing virtual-office read endpoints with conservative mock fallback, while keeping TMX as the canvas source.

Reason: This lets the frontend safely consume backend map, navigation, and position data when available without breaking the current demo experience when the API is unavailable, unauthorized, invalid, or partial.

Trade-off: The integration remains read-only and one-time-on-mount. It intentionally does not add position persistence, polling, websocket realtime presence, backend map rendering, or auth/session changes.

## Existing Project Decisions Confirmed From Code

- Use `pnpm` + Turborepo monorepo.
- Use Next.js for web frontend.
- Use NestJS for backend API.
- Use Prisma with PostgreSQL as the data model layer.
- Treat SkyOffice as reference-only material.
- Use frontend-only localStorage workflow state for current demo onboarding/login, not production auth.
