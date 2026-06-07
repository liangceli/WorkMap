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

The project already contains a virtual-office data model in Prisma, a NestJS backend with guarded endpoints, and a Next.js frontend with a canvas-based virtual office experience. `/virtual-office` now attempts virtual-office API loading with mock fallback, restores/saves the authenticated current user's latest position in development/API-backed mode, supports simple polling-based multi-user presence for a 5-person pilot, decodes backend-backed layered avatars from `User.avatarId`, and includes a small-team People panel with current-user separation, team summary, freshness/last-seen labels, empty/fallback states, command-palette presence context, UUID-free room labels, and stable polling canvas behavior. The app now also has a pilot auth path with backend-issued JWT sessions, a STAGE 2 Cognito Hosted UI/JWT verification baseline, minimal tenant onboarding with `User.cognitoSub`, Owner-created invite links with hashed token storage, employee invite acceptance into the correct company, backend-backed display name/avatar profile completion, core RBAC/capability enforcement, compliance transparency/acknowledgement flows, a dashboard pilot-readiness surface, and API-backed current-user reports with sparse-data and pilot-example labeling. Canvas rendering remains based on `/maps/workmap2.tmx` rather than backend `OfficeMap.mapData`. Local API-backed verification works through the API build-then-run startup path, shared root `workmap/.env` local loading, frontend Cognito/pilot/development auth paths, and the pilot release checklist. Full production enterprise auth lifecycle, global identity/membership tables, real invite email delivery, deployed Vercel/Render/Cognito smoke, realtime walking presence, mature department/team-level RBAC, and team aggregate reporting are still not implemented.

Reference material exists under `docs/references/SkyOffice` and `workmap/docs/references`. It is reference-only and should not be copied directly into WorkMap.
