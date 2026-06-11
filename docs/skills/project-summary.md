# Project Summary

WorkMap is a 2D virtual office and compliant work visibility platform for hybrid teams.

The repository is a `pnpm` + Turborepo monorepo under `workmap/`. The primary apps are:

- `apps/web`: Next.js frontend.
- `apps/api`: NestJS API.
- `apps/desktop-agent`: Node/TypeScript activity ingestion harness scaffold.
- `apps/browser-extension`: Manifest V3 browser domain tracking scaffold.
- `apps/worker`: placeholder scaffold.

Shared packages include:

- `packages/shared-types`: shared frontend/backend TypeScript domain types.
- `packages/auth`: shared auth context and JWT payload types.
- `packages/config`, `packages/domain-utils`, `packages/ui`: small shared package scaffolds.

The project already contains a virtual-office data model in Prisma, a NestJS backend with guarded endpoints, and a Next.js frontend with a canvas-based virtual office experience. `/virtual-office` now attempts virtual-office API loading with mock fallback, restores/saves the authenticated current user's latest position in development/API-backed mode, supports native WebSocket realtime movement for same-company/same-map users, keeps polling as reconciliation/fallback, validates a manifest-driven map configuration stored in `OfficeMap.mapData`, decodes backend-backed layered avatars from `User.avatarId`, and includes a small-team People panel with current-user separation, team summary, freshness/last-seen labels, empty/fallback states, command-palette presence context, UUID-free room labels, and stable canvas behavior. The app now also has a pilot auth path with backend-issued JWT sessions, a STAGE 2 Cognito Hosted UI/JWT verification baseline, minimal tenant onboarding with `User.cognitoSub`, Owner-created invite links with hashed token storage, employee invite acceptance into the correct company, backend-backed display name/avatar profile completion, core RBAC/capability enforcement, independent Cognito allowlist-based Platform Admin access with privacy-safe `/platform-admin` metadata/health/audit views, a guarded activity ingestion loop for app usage, browser hostname/domain usage, device registration/heartbeat, RBAC-scoped reports, compliance transparency/acknowledgement flows, a dashboard pilot-readiness surface, API-backed reports with device coverage metadata, shared HTTP CORS/WebSocket origin allowlist hardening through `WORKMAP_ALLOWED_ORIGINS`, and separate `/health` liveness plus `/health/readiness` database readiness checks. Canvas rendering currently uses the default manifest pointing at `/maps/workmap2.tmx`; future map replacement should write validated manifests rather than scattering hardcoded coordinates. Local API-backed verification works through the API build-then-run startup path, shared root `workmap/.env` local loading, frontend Cognito/pilot/development/platform auth paths, the pilot release checklist, and `docs/ai-handoff/alpha-production-readiness.md`. Full production enterprise auth lifecycle, production desktop active-window tracking, production browser extension packaging/pairing/offline queueing, global identity/membership tables, persisted platform identity lifecycle, map-versioned saved-position invalidation, real invite email delivery, deployed Vercel/Render/Supabase/Cognito/WSS/platform-admin/activity smoke, shared pub/sub for multi-instance realtime, mature department/team-level RBAC, and background aggregation workers are still not implemented.

Reference material exists under `docs/references/SkyOffice` and `workmap/docs/references`. It is reference-only and should not be copied directly into WorkMap.
