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

## Existing Project Decisions Confirmed From Code

- Use `pnpm` + Turborepo monorepo.
- Use Next.js for web frontend.
- Use NestJS for backend API.
- Use Prisma with PostgreSQL as the data model layer.
- Treat SkyOffice as reference-only material.
- Use frontend-only localStorage workflow state for current demo onboarding/login, not production auth.
