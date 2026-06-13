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

## 2026-06-03 - Basic Polling Presence

Decision: Add basic polling presence through repeated reads of the existing virtual-office positions endpoint.

Reason: The 5-person pilot needs other users to appear/update without requiring websocket/SSE infrastructure.

Trade-off: Polling is simple and adequate for the pilot but adds recurring API requests: about every 4 seconds when visible and 15 seconds when hidden. It reuses existing statuses for freshness instead of adding new UI labels.

## 2026-06-03 - 5-Person People/Presence MVP

Decision: Build the first small-team People/Presence UX around the existing polling presence model.

Reason: The 5-person pilot needs readable team status, current-user clarity, last-seen context, empty/fallback states, and command-palette people context without adding realtime infrastructure.

Trade-off: The UI reuses polling and existing statuses rather than adding websocket/SSE or a separate live monitoring model. Freshness labels update when polling/renders occur, not from a separate minute ticker.

## 2026-06-04 - Pilot Auth And Compliance Boundary

Decision: Add pilot-ready email/password auth backed by JWTs, browser-scoped pilot session storage, unified API auth resolution, and compliance transparency/acknowledgement flows.

Reason: The 5-person pilot needed to move beyond frontend-only demo state while still avoiding full enterprise auth scope.

Trade-off: This is controlled pilot auth, not production SSO/OAuth/MFA/password-reset/tenant-admin credential lifecycle. Compliance acknowledgement readback uses a browser marker after successful backend acknowledgement because the policy endpoint does not yet return acknowledgement status.

## 2026-06-04 - Pilot Readiness Dashboard And Reports Boundary

Decision: Use existing health, auth, virtual-office positions, compliance policy, and current-user usage-summary APIs to make Dashboard and Reports pilot-readiness surfaces, while labeling sample/aggregate sections as pilot examples.

Reason: The pilot needed a deployable, verifiable readiness view without expanding backend scope during the QA pass.

Trade-off: This avoids adding a new team aggregate reports backend contract. Dashboard and Reports can show mixed API-backed and example states, so labels and sparse-data copy are part of the product boundary.

## 2026-06-06 - STAGE 2 Cognito Deployment Baseline

Decision: Add Cognito Hosted UI / JWT verification as the first deployment auth baseline while preserving pilot auth and development-only dev-token fallback.

Reason: STAGE 2 needs a deployable path for Vercel, Render, Supabase, and Cognito without jumping straight to full enterprise account lifecycle or tenant provisioning.

Trade-off: Cognito users are temporarily mapped by verified email to existing WorkMap users, optionally scoped by `WORKMAP_COGNITO_COMPANY_SLUG`. Stable Cognito `sub` mapping, tenant membership, invite flows, MFA/password reset UX, and full route guards remain future work.

## 2026-06-06 - Shared Root Local Env Loading

Decision: Load root `workmap/.env` from `apps/web/next.config.ts` for local web dev/build without overriding existing environment variables.

Reason: Local STAGE 2 testing should use one root `.env` for API and Web, so `/login` can see `NEXT_PUBLIC_COGNITO_*` without requiring `apps/web/.env.local`.

Trade-off: The small loader intentionally handles simple `.env` lines only and requires a Next dev-server restart after env changes. Platform env values remain authoritative for deployment.

## 2026-06-07 - Minimal Tenant Onboarding And Invite Bridge

Decision: Implement tenant onboarding and invitations using the existing `Company` tenant model, company-scoped `User`, `User.cognitoSub`, and an `Invitation` table with hashed tokens.

Reason: STAGE 2 Round 2 needed a working owner signup/workspace creation and employee invite acceptance flow without a broad migration across all company/user-scoped models.

Trade-off: This enables the local product foundation now, but one Cognito account maps to one WorkMap company user. Global identity/account tables, `CompanyMembership` or `TenantMembership`, multi-company membership, real email delivery, and a strict multi-tenant/RBAC audit remain future work.

## 2026-06-07 - Core RBAC And Backend Profile Bridge

Decision: Add a central capability matrix and enforce core tenant/RBAC checks in backend services while reusing `User.avatarId` for compact backend-backed layered avatar references.

Reason: Round 3 needed strict-enough tenant isolation, role boundaries, and cross-session avatar/profile consistency without schema changes or the full identity/membership migration.

Trade-off: Backend service checks now protect key data/actions, but department/team-level RBAC remains coarse and frontend route hiding is only advisory. `User.avatarId` can carry `layered:v2:` profile data for the MVP, but a richer profile/avatar table may be needed later.

## 2026-06-07 - Native WebSocket Realtime Movement

Decision: Add virtual-office realtime movement through a narrow native WebSocket gateway at `/virtual-office/realtime`, while preserving polling reconciliation and HTTP latest-position persistence.

Reason: Round 4 needed smooth same-workspace avatar movement without adding broad realtime infrastructure, package dependencies, per-frame database writes, or movement/pathfinding rewrites.

Trade-off: The gateway is in-memory per API process and needs shared pub/sub before horizontal scaling. Browser auth passes the Bearer token in the WebSocket URL query because native WebSocket cannot set `Authorization` headers, so deployed use should be WSS with careful log handling.

## 2026-06-08 - Independent Platform Admin Boundary

Decision: Add Platform Admin as an independent Cognito allowlist-based platform context, separate from tenant `User`, tenant OWNER role, and tenant `/auth/me`.

Reason: Platform operations need a safe cross-tenant metadata/health/audit surface, but reusing tenant OWNER would collapse customer tenant RBAC into platform support access.

Trade-off: This creates a clean boundary and privacy-safe read-only platform surface now, but bootstrap uses backend env allowlists rather than a persisted platform identity lifecycle/admin console. `PlatformAuditLog` is intentionally separate from tenant `AuditLog` and does not foreign-key to `Company`, so historical deleted-tenant audit references may resolve to `targetCompany: null`.

## 2026-06-09 - Manifest-Driven Virtual Office Map Architecture

Decision: Use validated virtual-office map manifests stored in existing `OfficeMap.mapData`, with a shared default manifest as runtime fallback, instead of adding a schema migration or replacing the current TMX art.

Reason: Future map expansion/replacement needs one source of truth for TMX path, canvas size, collision/render layers, spawns, rooms, navigation, and bounds so avatar restore, pathfinding, People labels, realtime, polling, and tenant onboarding do not break when map data changes.

Trade-off: This keeps Round 6 safe and migration-free, but saved positions still do not store `mapVersion`. Runtime bounds checks and safe-spawn relocation mitigate stale/invalid positions now; strict stale-position invalidation needs future position version metadata and manifest-vs-TMX validation tooling.

## 2026-06-11 - Transparent Activity Ingestion Loop

Decision: Add guarded app/domain activity ingestion, tenant/user-bound devices, summary aggregation, role-scoped reports, and transparent compliance copy while keeping desktop-agent and browser-extension clients as honest scaffolds.

Reason: WorkMap needs an end-to-end activity loop for app usage, browser domain usage, dashboard readiness, reports, and compliance boundaries without crossing into hidden surveillance.

Trade-off: The backend loop and UI reporting are now real enough for pilot validation, but the desktop agent is not production active-window tracking and the browser extension is not packaged/store-ready. Offline queues, retry/backoff, secure pairing/token lifecycle, revocation, extension-specific origin/pairing hardening, and production distribution remain future work.

## 2026-06-11 - Alpha Origin Allowlist And Readiness Gate

Decision: Centralize HTTP CORS and WebSocket origin checks in a shared allowlist helper, prefer `WORKMAP_ALLOWED_ORIGINS` for exact deployed browser origins, and add `/health/readiness` as a separate database readiness endpoint.

Reason: Controlled alpha deployment needs explicit browser-origin security for Vercel/Render, consistent WSS origin behavior, and a safe way to distinguish API liveness from database readiness before owner/invite/activity smoke.

Trade-off: Production browser HTTP and WSS traffic now depends on exact external env configuration; a misconfigured or missing allowlist blocks browser origins. Missing `Origin` remains allowed for server-to-server/health-style requests, and deployed alpha readiness still requires manual Vercel, Render, Supabase, Cognito, migration, and smoke verification.

## 2026-06-13 - Non-Secret External Alpha Smoke Helper

Decision: Add `pnpm smoke:alpha` backed by `scripts/real-alpha-smoke.mjs`, commit `workmap/pnpm-lock.yaml` for deterministic Vercel installs, and document deployed alpha smoke evidence without storing real deployment URLs, secrets, tokens, or platform admin identities.

Reason: Round 9 needed a repeatable way to verify public deployed API/frontend readiness across Render, Vercel, CORS, and WSS path derivation while keeping authenticated Cognito, invite, activity, and platform admin checks in manual human smoke where real credentials stay outside chat and docs.

Trade-off: The helper can catch public liveness/readiness/CORS/route regressions, but it intentionally does not automate authenticated flows or negative security hardening. WorkMap can be treated as an Alpha Ready Candidate after the human-reported deployed smoke pass, but full production readiness still requires production tracking clients, durable queues/retries, token lifecycle, multi-instance realtime pub/sub, and broader automated negative tests.

## Existing Project Decisions Confirmed From Code

- Use `pnpm` + Turborepo monorepo.
- Use Next.js for web frontend.
- Use NestJS for backend API.
- Use Prisma with PostgreSQL as the data model layer.
- Treat SkyOffice as reference-only material.
- Use frontend-only localStorage workflow state for current demo onboarding/login, not production auth.
