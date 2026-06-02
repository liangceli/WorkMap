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

The project already contains a virtual-office data model in Prisma, a NestJS backend with guarded endpoints, and a Next.js frontend with a canvas-based virtual office experience. Some frontend surfaces still use mock or localStorage state, so production readiness should be evaluated per feature.

Reference material exists under `docs/references/SkyOffice` and `workmap/docs/references`. It is reference-only and should not be copied directly into WorkMap.
