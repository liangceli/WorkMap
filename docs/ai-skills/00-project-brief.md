# WorkMap Project Brief

## Product

WorkMap is a 2D virtual office and compliant work visibility platform for hybrid teams.

A company signs up, creates a virtual 2D office, invites employees, and installs a desktop agent + browser extension on company devices.

Employees appear as avatars in a 2D office. Managers can view presence, active time, app usage, and website domain usage. Employees can contact each other through Teams, Outlook, 3CX, or internal quick messages.

## Core modules

1. Web App
   - Next.js frontend
   - 2D virtual office using Canvas in the current MVP; Phaser remains a later target after dependency approval
   - employee dashboard
   - manager dashboard
   - admin/compliance settings

2. Backend API
   - NestJS
   - PostgreSQL
   - Prisma
   - Redis
   - BullMQ
   - Socket.IO Gateway

3. Desktop Agent
   - Electron MVP
   - app usage detection
   - idle detection
   - local cache
   - heartbeat
   - browser extension bridge

4. Browser Extension
   - Chrome/Edge Manifest V3
   - active tab domain tracking
   - no full URL by default
   - sends domain event to Desktop Agent

5. Worker
   - aggregates raw events into daily summaries
   - app usage summary
   - website usage summary

6. Integrations
   - Teams deep link
   - Outlook mailto or compose link
   - 3CX web client / click-to-call

## Privacy principles

WorkMap must be transparent, compliant, and minimal.

Default collection:

- app name
- browser domain
- active/idle state
- device heartbeat
- work session timestamps

Do not collect:

- keystrokes
- screen images
- microphone
- camera
- Teams message content
- email content
- full URLs by default
- form inputs
- passwords

## MVP target

MVP should support:

- company registration
- employee login
- 2D office
- avatar movement
- realtime presence
- desktop agent app tracking
- Chrome/Edge domain tracking
- manager dashboard
- employee self dashboard
- contact actions: Teams / Outlook / 3CX
- monitoring policy acknowledgement

## Current implementation status - 2026-05-30

Frontend MVP currently has:

- `/login` as a frontend mock sign-in placeholder.
- `/` as a WorkMap product/demo entry page with frontend-only role selection and resume behavior.
- `/login` as a frontend mock sign-in placeholder with demo role selection for Employee, Manager, Owner, and IT Admin.
- Frontend-only workflow state helper exists under `apps/web/lib/workflow/workflowState.ts`, using localStorage key `workmap.userSetupState`.
- `/onboarding/company` exists as a lightweight Owner workspace setup step.
- `/onboarding/device-setup` exists as a lightweight Desktop Agent / Browser Extension transparency step.
- `/virtual-office` using a Canvas renderer for the current Tiled TMX office map.
- `/virtual-office` is now a full-screen map-first office UI with a lightweight top bar, floating current-area pill, movement hint, bottom coworker interaction drawer, and a right-bottom mini map showing the full office and player position.
- The current `/virtual-office` camera keeps the local player centered while the map moves underneath.
- Local movement treats mock remote players as blockers so avatars do not overlap.
- The mini map now shows the full office and local player dot without a blue viewport range box.
- `/onboarding/avatar` as a layered avatar builder using local sprite sheet assets.
- `/dashboard` as a manager overview mock UI with privacy-forward app/domain summaries.
- `/employees` as a frontend mock employee directory with search, filters, manager summary view, and employee contact-only view.
- `/employees/[id]` as a frontend mock employee detail page with manager summary mode and employee contact-only mode.
- `/integrations` as a frontend mock integrations page for Teams, Outlook, calendar, and 3CX link-based launchers.
- `/compliance` as a frontend mock policy transparency and acknowledgement preview page.
- `/settings` as a frontend mock admin settings entry point.
- `/reports` as a frontend mock aggregated department summary page.
- Layered avatar rendering in the virtual office for the local player and deterministic randomized mock remote players.
- WASD / arrow-key movement, basic collision, room zone detection, proximity contact menu, and chair sit/stand interaction.
- Compact dark name/status bubbles above avatars.
- Local avatar config stored in `localStorage` under `workmap.avatarConfig`.
- The old right-side debug/test panel has been removed from `/virtual-office`; interaction state is now surfaced through the bottom drawer and small floating hints.
- SaaS pages now use a shared `AppShell` navigation component for dashboard, employees, employee detail, reports, compliance, integrations, and settings. `/virtual-office` keeps its dedicated map-first UI.
- Demo role flow is frontend-only and must not be treated as real authentication or RBAC.

Backend MVP currently has:

- NestJS bootstrap, health endpoint, Prisma service/module, module boundaries, internal services for virtual office and compliance, and initial protected controllers.
- Protected endpoints now accept Bearer JWTs signed with `WORKMAP_JWT_SECRET`. The guard verifies HS256 tokens, reads `sub` and `companyId`, confirms the user belongs to the company, and derives the trusted role from the database.
- `POST /auth/dev-token` exists for non-production demo/local development only. It accepts a seed/demo user email and optional company slug, then issues an 8-hour Bearer token.
- For local development only, the same guard falls back to `x-workmap-company-id`, `x-workmap-user-id`, and `x-workmap-role` headers when no Bearer token is present. Production requires Bearer JWT.
- Initial company-scoped APIs exist for current auth context, company profile, users directory/current user/user detail, device health, virtual office map/positions, compliance policy/acknowledgement, link-based integrations/contact links, and report usage summaries.
- UUID route parameters and optional `userId` report query now have Nest pipe validation.
- Manager-sensitive user detail and report reads write audit logs.
- API dependencies currently include Nest core/platform-express, Prisma client, reflect-metadata, rxjs, `@workmap/auth`, and `@workmap/shared-types`; JWT verification and non-production demo token issuance are implemented with Node `crypto` for HS256 without adding a package. Socket.IO, Redis, BullMQ, production login/SSO, and validation libraries are not wired yet.
- A backend-focused chat should start by reading this file plus `/docs/ai-skills/02-backend-engineer.md`, then inspect `apps/api/src` before coding.

Map asset status:

- `workmap2.tmx` uses external `.tsx` tilesets.
- The main web map now references tilesets under `apps/web/public/maps/tilesets/`.
- The tileset image paths have been normalized so Tiled and the web renderer can use the same stable assets.
- `apps/web/tsconfig.json` excludes `public/**/*.tsx` because Tiled tileset files use the `.tsx` extension but are XML, not React source.
- Current project map path loaded by the app is `apps/web/public/maps/workmap2.tmx`.
- During development, `/virtual-office` polls `workmap2.tmx` and reloads the Canvas map when the TMX XML changes.
- Current Canvas tileset manifest supports firstgid ranges `1`, `225`, `449`, `1297`, `2145`, `2993`, and `3217`, including `Modern_Office_Shadowless_32x32.png`.

Current frontend/backend handoff:

- Frontend and design chat owns `/virtual-office`, map rendering/UI, avatar builder, frontend mock pages, and visual polish.
- Backend/API chat owns NestJS API framework, Auth/JWT, request context, RBAC, business controllers, DTO validation, audit hooks, activity ingestion, reports, and later Socket.IO.
- Backend/API chat should not assume frontend mock data is authoritative. Treat current frontend mock people, reports, integrations, and local avatar config as UI scaffolding until API contracts are approved.
- Do not persist avatar layer config, map metadata, or activity/report data to new schema fields without Director approval.
- Current frontend workflow routes are demo-only: Employee first-time flow is login -> compliance -> avatar -> device setup -> virtual office; Owner first-time flow is login -> company onboarding -> compliance -> dashboard after setup; Manager and IT Admin returning flows land on dashboard.

## Initial architecture

Monorepo:

- apps/web
- apps/api
- apps/desktop-agent
- apps/browser-extension
- apps/worker
- packages/shared-types
- packages/ui
- packages/domain-utils
- prisma
- docs

## Director control

The Director chat owns:

- architecture
- database schema
- API contract
- privacy rules
- security model
- module boundaries
- integration strategy

Other AI workers must not change these without approval.
