# Project Summary

WorkMap is a 2D virtual office and compliant work visibility platform for hybrid teams.

The repository is a `pnpm` + Turborepo monorepo under `workmap/`. The primary apps are:

- `apps/web`: Next.js frontend.
- `apps/api`: NestJS API.
- `apps/desktop-agent`: placeholder scaffold.
- `apps/browser-extension`: placeholder scaffold.
- `apps/worker`: placeholder scaffold.

Shared packages include:

- `packages/shared-types`: shared frontend/backend TypeScript domain types.
- `packages/auth`: shared auth context and JWT payload types.
- `packages/config`, `packages/domain-utils`, `packages/ui`: small shared package scaffolds.

The project already contains a virtual-office data model in Prisma, a NestJS backend with guarded endpoints, and a Next.js frontend with a canvas-based virtual office experience. `/virtual-office` now attempts virtual-office API loading with mock fallback, restores/saves the authenticated current user's latest position in development/API-backed mode, supports simple polling-based multi-user presence for a 5-person pilot, and includes a small-team People panel with current-user separation, team summary, freshness/last-seen labels, empty/fallback states, command-palette presence context, UUID-free room labels, and stable polling canvas behavior. The app now also has a pilot auth path with backend-issued JWT sessions and compliance transparency/acknowledgement flows. Canvas rendering remains based on `/maps/workmap2.tmx` rather than backend `OfficeMap.mapData`. Local API-backed verification works through the API build-then-run startup path and frontend pilot/development auth bridge. Production enterprise auth is still not implemented.

Reference material exists under `docs/references/SkyOffice` and `workmap/docs/references`. It is reference-only and should not be copied directly into WorkMap.
