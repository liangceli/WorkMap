# AI Worker Rules for WorkMap

You are working on WorkMap, a 2D virtual office and compliant work visibility platform.

## Core product direction

WorkMap is not a spying tool. It is a virtual office + work visibility + communication launcher.

The system combines:

1. 2D virtual office
2. Employee presence
3. Desktop app usage tracking
4. Chrome/Edge domain usage tracking
5. Teams / Outlook / 3CX quick contact actions
6. Compliance-first monitoring policy

## Non-negotiable privacy rules

Never implement:

- keystroke logging
- screen recording
- screenshots
- microphone recording
- camera recording
- email body collection
- Teams message collection
- full URL tracking by default
- password or form input collection
- hidden or invisible monitoring

Default tracking must only collect:

- active app name
- website domain
- active/idle status
- device heartbeat
- session time
- user/device/company IDs
- aggregated usage summaries

## Engineering rules

Before coding:

1. Read `/docs/ai-skills/00-project-brief.md`
2. Read your role-specific skill file
3. Inspect the existing file structure
4. Reuse existing components, types, services, and patterns
5. Do not create duplicate systems
6. Do not change database schema without Director approval
7. Do not change API contracts without Director approval
8. Make the smallest working change
9. Prefer modular files over large files
10. Keep TypeScript strict and typed

## Current project state - 2026-05-30

Frontend:

- `/` is a frontend-only product/demo entry with role selection and resume behavior.
- `/login` is a frontend mock sign-in placeholder with demo role selection only.
- Frontend workflow state is stored in `localStorage` under `workmap.userSetupState`.
- `/onboarding/company` and `/onboarding/device-setup` are frontend-only onboarding steps.
- `/onboarding/avatar` is a layered avatar builder.
- `/virtual-office` is a Canvas MVP, not Phaser.
- `/virtual-office` is now a full-screen map-first UI with no fixed right-side debug panel.
- `/virtual-office` includes floating workspace/current-area/status pills, a bottom action dock, bottom coworker interaction drawer, map controls, and a bottom-left mini map.
- `/virtual-office` close controls should be icon-only using the shared office close icon, with no visible bordered square and no text `x`/`Esc` placeholders.
- `/virtual-office` includes a WorkMap office shell with `VirtualOfficeTopBar`, `OfficeLeftRail`, `OfficeSidePanel`, `OfficeCommandPalette`, `RoomContextCard`, `OfficeBottomDock`, `OfficeIcons`, `InteractionDrawer`, and `VirtualOfficeShell`.
- `/virtual-office` currently follows the Stitch state-board reference under `docs/designs/`; do not treat that screenshot as a default state with all overlays visible.
- `/virtual-office` supports frontend-only People, Search, Chat, Calendar, Notices, and Settings panels. These are mock/link-only collaboration surfaces, not backend-backed messaging, calendar sync, or employee monitoring.
- `/virtual-office` supports drag/pan, wheel zoom, recenter, double-click click-to-move, room context selection, and Go to person/room actions through frontend-only Canvas/pathfinding helpers.
- The main Canvas must preserve its 1120x680 aspect ratio and must not be stretched to fit the browser.
- The local player should remain centered during normal keyboard movement and auto-walk; temporary manual pan/zoom is allowed, and recenter must restore the user-centered camera.
- The local player must not overlap mock remote players.
- The mini map should not show the previous blue viewport range box.
- `/dashboard` is a frontend mock manager overview.
- `/employees` is a frontend mock employee directory.
- `/employees/[id]` is a frontend mock employee profile route.
- `/integrations` is a frontend mock link-based integrations page.
- `/compliance` is a frontend mock policy acknowledgement preview page.
- `/settings` is a frontend mock admin settings navigation page.
- `/reports` is a frontend mock aggregate reports page.
- SaaS pages use `AppShell` for role-aware demo navigation. Do not apply this shell to `/virtual-office`.
- Avatar config is stored in `localStorage` under `workmap.avatarConfig`.
- Mock remote players use deterministic randomized layered avatars.

Backend/database:

- Do not change backend APIs, Prisma schema, tracking, or Socket.IO for avatar/dashboard/map UI tasks unless the Director explicitly approves.
- A backend-focused chat should read `00-project-brief.md`, `02-backend-engineer.md`, `03-database-engineer.md`, `06-security-engineer.md`, and `09-game-movement-system.md` before building API framework pieces.
- Current backend has module boundaries, Prisma service/module, health endpoint, internal virtual-office and compliance services, HS256 Bearer JWT verification, non-production `POST /auth/dev-token`, non-production header fallback, RBAC helper guard/decorator, initial protected business controllers, UUID param/query pipe validation, and summary-report scaffolding.
- Current backend also has `GET /virtual-office/navigation`, a safe computed room destination endpoint from existing map/room/position data, and contact link provider objects while preserving old flat URL fields.
- Current backend still has no production token issuance/login flow, DTO validation library, activity ingestion endpoint, Socket.IO gateway, Redis/BullMQ queue, or production-ready auth rollout.
- Virtual Office workspace shell API proposal lives at `/docs/api/virtual-office-workspace-contract.md`.
- Current backend endpoint map lives at `/docs/api/current-backend-endpoint-map.md`; validation plan at `/docs/api/backend-validation-plan.md`; activity ingestion contract at `/docs/api/activity-ingestion-contract.md`; production auth readiness at `/docs/api/auth-production-readiness.md`.
- Workspace shell backend support is currently limited to existing People, company/departments, map/rooms, latest positions, compliance, reports, and link-based contact endpoints. Chat, Calendar, Notices, emoji/wave, Microsoft Graph, Socket.IO, and persistence for those surfaces are not implemented.
- After every completed code/config/API modification, update the relevant `docs/ai-skills/*.md` files in the same turn so the project handoff stays current.
- Frontend mock data is not a backend contract. Convert mock surfaces into APIs only after the relevant auth/RBAC/schema/API decisions are clear.
- Dashboard and employee-directory mock data must stay clearly named and must not be mistaken for real tracking data.
- Frontend mock data now has labelled exports under `apps/web/lib/mock/`. Treat these files as demo/fallback data only, not backend API contracts or real monitoring records.
- A typed, fallback-safe frontend API client foundation now exists under `apps/web/lib/api/`. It may use `NEXT_PUBLIC_WORKMAP_API_URL` and optional Bearer tokens, but pages must keep mock fallback behavior until auth/RBAC/API contracts are safe to rely on.
- Do not auto-call `/auth/dev-token` from frontend runtime flows unless a future Director-approved dev-only design explicitly asks for it.
- SaaS pages can use the shared inline-style theme tokens in `apps/web/lib/theme/workmapTheme.ts` and the small UI primitives under `apps/web/components/ui/`.
- Integration mock data must stay link-based until backend/API/security decisions are approved.
- Compliance acknowledgement has API scaffolding, but frontend use should remain mock/local until token issuance/login and final API contracts are approved.
- Login and frontend reports must remain mock-only until Auth/JWT, final RBAC, report contracts, and audit logging flows are approved.
- Workspace Chat, Calendar, Notices, emoji/wave, and schedule-meeting experiences must remain frontend mock/link-only until Director approves backend contracts and privacy scope.
- Go to person, Go to room, command palette search, click-to-move, room cards, drag/zoom, and recenter are frontend-only office navigation affordances until realtime/API contracts are approved.
- Demo role visibility in frontend navigation is not security. Do not expose real manager-only data until backend RBAC enforces it.

Map assets:

- `workmap2.tmx` currently depends on external `.tsx` tilesets.
- Current Tiled tilesets live under `apps/web/public/maps/tilesets/`.
- `apps/web/tsconfig.json` excludes `public/**/*.tsx` because Tiled tilesets are XML files with a `.tsx` extension.
- During development, `/virtual-office` auto-reloads the Canvas map when the project TMX file changes; this only works when Tiled saves to `apps/web/public/maps/workmap2.tmx`.
- If Tiled shows red X tiles again, inspect tileset paths before changing map artwork or renderer logic.
- Current Canvas tilesets include duplicate firstgid ranges from Tiled edits, including the `shadowlessthings.tsx` / `Modern_Office_Shadowless_32x32.png` resource path.

Chat ownership rule:

- This chat is currently responsible for frontend, map UI, avatar UI, and design implementation.
- A new backend/API chat should own backend framework/API work and should use the skills as handoff context.
- If a task affects both frontend and backend contracts, ask for Director/API contract confirmation before making schema or privacy-sensitive changes.

## Token-saving rules

To reduce Codex usage:

1. Do not explain basic concepts unless asked.
2. Do not rewrite full files unless necessary.
3. Prefer patches/diffs or changed sections.
4. Before editing, list the exact files that need changes.
5. After editing, provide a short handoff summary.
6. Avoid broad refactors.
7. Do not search the entire repo repeatedly if file paths are already known.
8. Use existing shared types from `packages/shared-types`.
9. Use existing UI components from `packages/ui` or `apps/web/components`.
10. Ask the Director only when the decision affects architecture, schema, privacy, or security.

## Handoff summary format

After every task, output:

### Completed
- ...

### Files changed
- ...

### How to test
- ...

### Risks / notes
- ...

### Need Director decision?
- Yes / No

Final response rule:

- After completing modifications and syncing the relevant skill docs, end the response with `[已完成修改并同步更新skills]`.
