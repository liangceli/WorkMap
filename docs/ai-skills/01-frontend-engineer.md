# Frontend Engineer Skill - WorkMap

## Role

You are the Frontend Engineer for WorkMap.

You own:

- Next.js web app
- React components
- Tailwind / shadcn UI
- 2D virtual office integration
- manager dashboard UI
- employee dashboard UI
- admin settings UI
- contact menu UI
- frontend API client
- frontend socket client

## Tech stack

Use:

- Next.js App Router
- React
- TypeScript
- Inline styles in the current MVP codebase unless/until Tailwind/shadcn are introduced project-wide
- Phaser.js later for 2D office after dependency install approval
- Socket.IO client
- Recharts only if charts are needed
- Zustand or React context only if needed

## Main pages

Implement these pages:

- `/login`
- `/dashboard`
- `/virtual-office`
- `/onboarding/avatar`
- `/employees`
- `/employees/[id]`
- `/reports`
- `/compliance`
- `/integrations`
- `/settings`

## Core UI components

Create reusable components:

- `EmployeeAvatar`
- `AvatarPreview`
- `LayeredAvatarPreview`
- `EmployeeCard`
- `ContactMenu`
- `PresenceBadge`
- `UsageSummaryCard`
- `AppUsageTable`
- `WebsiteUsageTable`
- `OfficeMap`
- `PrivacyNoticeCard`
- `PolicyAcknowledgementModal`
- `IntegrationButton`
- `ManagerOverviewPanel`

## 2D virtual office requirements

The virtual office must support:

- map rendering
- avatar rendering
- keyboard movement
- click-to-move later
- collision boundaries
- department zones
- focus room
- break room
- meeting room
- realtime position updates
- clicking another avatar to show contact menu
- proximity trigger when close to another avatar

## Movement feel

The avatar movement should feel like a light office RPG:

- smooth walking animation
- idle animation
- directional movement
- foot shadow
- small name label above avatar
- compact dark name/status bubble above avatar in the current Canvas MVP
- status color ring
- no aggressive game style
- professional but friendly

## Frontend privacy rules

Never display private employee details to normal employees.

Normal employee can see:

- other employee name
- role
- status
- local time
- contact buttons

Manager can see:

- active time
- idle time
- app summary
- domain summary

Do not display full URLs unless the API explicitly provides them and user role allows it.

## Development rules

Before coding:

1. Check existing components.
2. Reuse shared types.
3. Do not hardcode API schemas.
4. Do not invent backend fields.
5. Use mock data only if backend is not ready.
6. Keep mock data in a clearly named file.
7. Keep UI responsive for desktop first.
8. Do not implement security-sensitive logic only on frontend.

## Handoff output

After each task, output:

### Completed
### Files changed
### How to test
### UI notes
### Backend/API assumptions

## Game movement reference

For all virtual office movement, avatar animation, collision, room zone detection, proximity menu, Phaser implementation, and realtime player sync, follow:

`/docs/ai-skills/09-game-movement-system.md`

Do not invent new movement rules, socket event names, or avatar state shapes without Director approval.

## Current progress - 2026-05-30

Completed in current MVP:

- `/login` page exists as a frontend mock sign-in placeholder.
- `/` is a product/demo entry page with WorkMap positioning, demo role selection, resume behavior, and secondary developer quick links.
- Frontend-only workflow helper exists in `apps/web/lib/workflow/workflowState.ts` with localStorage key `workmap.userSetupState`.
- `/login` supports demo role selection for Employee, Manager, Owner, and IT Admin, then redirects through `getNextRouteForUser`.
- `/onboarding/company` exists for frontend-only Owner workspace setup.
- `/onboarding/device-setup` exists for frontend-only Desktop Agent / Browser Extension transparency setup.
- `/virtual-office` page exists.
- `/onboarding/avatar` page exists as a layered avatar builder.
- `/dashboard` page exists with manager overview mock data.
- `/employees` page exists with a frontend mock employee directory.
- `/employees/[id]` pages exist for frontend mock employee profiles generated from current mock people data.
- `/integrations` page exists with frontend mock link-based integration cards for Teams, Outlook, calendar, and 3CX.
- `/compliance` page exists with frontend mock monitoring policy copy and acknowledgement preview.
- `/settings` page exists with frontend mock admin settings entry points.
- `/reports` page exists with frontend mock aggregated department summaries.
- Shared SaaS navigation exists in `apps/web/components/layout/AppShell.tsx` and wraps dashboard, employees, employee detail, reports, compliance, integrations, and settings.
- `AppShell` role visibility is frontend-only workflow visibility. Real RBAC must still be enforced by backend APIs before real data is exposed.
- `workmap2.tmx` is loaded from `apps/web/public/maps/workmap2.tmx`.
- Office map renders with Canvas using current Tiled TMX layers and copied tileset images.
- `/virtual-office` uses a full-screen map-first layout: lightweight top bar, full-viewport Canvas, floating current-area pill, movement hint, bottom interaction drawer, and a right-bottom mini map.
- `/virtual-office` now includes a WorkMap office shell:
  - floating workspace/current-area/status pills in `VirtualOfficeTopBar.tsx`
  - left vertical rail in `OfficeLeftRail.tsx`
  - expandable office panel in `OfficeSidePanel.tsx`
  - search/command palette in `OfficeCommandPalette.tsx`
  - room/section context card in `RoomContextCard.tsx`
  - persistent bottom action dock in `OfficeBottomDock.tsx`
  - bottom coworker drawer in `InteractionDrawer.tsx`
  - lightweight inline SVG icon set in `OfficeIcons.tsx`
  - wrapper shell in `VirtualOfficeShell.tsx`
- The current `/virtual-office` visual direction follows the Stitch state-board reference in `docs/designs/`: treat the design as separate interactive states, not as an always-visible static composition.
- Current `/virtual-office` styling has been pixel-polished closer to the 2026-05-31 reference: larger rounded floating pills, SVG rail/action icons, navy bottom dock, bottom-left mini map, and right-side stacked map controls.
- Keep the left rail clear of the bottom-left mini map; do not let the settings button or rail background overlap the mini map.
- Keep `InteractionDrawer` clear of the bottom-left mini map and right-side map controls; position the drawer between those utilities instead of centering it over them.
- `OfficeLeftRail` should use large clean icons and no persistent outline box around inactive action buttons; keep only a filled navy active state.
- Office shell notification/status dots should stay visible: rail badge dots around 10px, dock/avatar online dots around 14px.
- Top pill dropdown indicators use the `chevronDown` icon from `OfficeIcons.tsx`; avoid text `v` placeholders.
- Map controls use a compact right-side vertical capsule with `+`, `-`, `target`, and zoom percent.
- `OfficeBottomDock` action buttons should render icon-only controls with accessible `aria-label`s and hover/focus tooltips; avoid always-visible text labels under dock icons.
- `OfficeCommandPalette` should close when users click the blurred backdrop outside the palette form, while clicks inside the palette must not close it.
- The previous right-side debug/test panel has been removed. Do not bring it back unless explicitly asked.
- The mini map is implemented as a small bottom-left overlay Canvas in `OfficeMiniMap.tsx`; it reuses the parsed TMX map data and tileset images, draws the whole office, and marks the local player position. It hides when the left side panel would overlap it.
- Main Canvas display must preserve the original 1120x680 aspect ratio. Do not stretch the map to fit the browser viewport.
- Main Canvas pixel rendering should keep `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`, and a backing store synchronized to the displayed viewport size/device pixel ratio so map clarity stays stable while the player/camera moves.
- Avoid tile destination overlap on floor tiles; it can create repeated edge pixels and visible grid lines not present in the authored map.
- The local player should remain centered on screen while the map moves underneath. The camera is intentionally not clamped to the map edges.
- The local player cannot overlap mock remote players; remote player positions act as lightweight movement blockers.
- The mini map shows the full office and local player dot only. Do not draw the previous blue viewport range box.
- Canvas interaction now supports drag-to-pan, wheel zoom, recenter, double-click click-to-move, and Go to person/room.
- Click-to-move uses frontend-only grid pathfinding in `apps/web/lib/office/pathfinding.ts`; room/section anchors live in `apps/web/lib/office/officeNavigationConfig.ts`.
- Chat, Calendar, Notices, and quick message actions are local frontend mock UI only. Do not persist messages/meetings/notices or connect to Teams/Outlook content in this frontend task.
- `workmap2.tmx` tileset references are normalized under `apps/web/public/maps/tilesets/`, and `public/**/*.tsx` is excluded from TypeScript compilation because Tiled tilesets are XML files.
- In development, `/virtual-office` polls `workmap2.tmx` and reloads the Canvas map when the TMX XML changes, so Tiled saves can appear without restarting the dev server.
- Local player supports WASD / arrow-key movement.
- Basic collision exists for walls, tools, furniture, chairs, and plants.
- Room zone detection updates local presence status.
- Remote placeholder players render on the map with deterministic randomized layered avatars.
- Proximity detection supports opening a contact menu.
- `ContactMenu` and `PresenceBadge` reusable components exist.
- The proximity/contact UI is visually presented through `InteractionDrawer` in `/virtual-office`; `ContactMenu` remains available but is no longer the primary virtual-office surface.
- `AvatarPreview` reusable component exists.
- `LayeredAvatarPreview` reusable component exists.
- `EmployeeAvatar`, `EmployeeCard`, `UsageSummaryCard`, `AppUsageTable`, `WebsiteUsageTable`, `PrivacyNoticeCard`, `PolicyAcknowledgementModal`, `IntegrationButton`, and `ManagerOverviewPanel` reusable components exist.
- Avatar preset manifest exists in `apps/web/lib/avatar/avatarAssets.ts`.
- Layered avatar manifest exists in `apps/web/lib/avatar/avatarLayerAssets.ts`.
- Avatar config helper exists in `apps/web/lib/avatar/avatarStorage.ts` using localStorage key `workmap.avatarConfig`.
- Avatar frame maps exist in `apps/web/lib/avatar/avatarFrameMaps.ts`.
- Uploaded preset sheets are registered from `apps/web/public/assets/avatars/presets/`.
- Layered assets are registered from `apps/web/public/assets/avatars/layers/`.
- Layered avatar builder supports body, eyes, hairstyle, outfit, and accessories.
- Layered avatar config is saved to localStorage as version 2 under `workmap.avatarConfig`.
- `/virtual-office` redirects users without a valid local avatar config to `/onboarding/avatar`.
- `/virtual-office` loads the selected layered avatar and renders the local player from the selected layers.
- `/virtual-office` gives each mock remote player a deterministic randomized layered avatar.
- If avatar layer images fail to load, `/virtual-office` falls back to the existing placeholder player visual.
- Basic layered avatar animation frame cycling exists for moving, idle, and seated fallback states.
- Layered avatar rendering uses 32x48 source crops for full head visibility while keeping 32px frame indexing.
- Player labels use a compact dark name/status bubble above the avatar.
- `PlayerState`, presence status, player direction, room zone, and contact target types are exported from `@workmap/shared-types`.
- Chair interaction exists: approach a chair, press `E` to sit; press `E` or move to stand.
- No private monitoring data is exposed through the virtual office UI.
- The manager dashboard uses clearly named frontend mock data and shows only app names, website domains, active/idle summaries, presence, local time, and contact actions.
- The employee directory supports search, department filtering, status filtering, manager summary view, and employee contact-only view using mock data.
- Employee detail pages support contact actions, same-department teammate navigation, manager summary view, and employee contact-only view using mock data.
- The integrations page uses clearly named mock data and link-based launchers only; no Microsoft Graph permissions or call/email content access exists.
- The compliance page previews collected/not-collected policy copy and a mock local acknowledgement modal; no backend audit log is written yet.
- The compliance page now also supports onboarding context: if `hasAcknowledgedPolicy` is false, it shows an "I understand and agree" CTA and routes to the next workflow step.
- The settings page links to compliance, integrations, avatar onboarding, and virtual office MVP settings surfaces.
- The settings page includes a secondary "Reset demo workflow" action that clears `workmap.userSetupState` and optionally clears `workmap.avatarConfig`.
- The reports page uses mock aggregated department data and shows app names/domains only, with no private content or full URLs.
- The login page is a placeholder and does not authenticate, create sessions, or grant permissions.
- The avatar builder still stores the avatar config under `workmap.avatarConfig`, and now marks `hasAvatar = true` in frontend workflow state before routing to the next step.
- `apps/web/lib/theme/workmapTheme.ts` is now the shared frontend theme token foundation for the inline-style MVP. It includes base colors plus status, privacy, compliance, spacing, radius, shadow, border, z-index, typography, and component-size tokens.
- Shared UI primitives now live in `apps/web/components/ui/`: `WorkMapButton`, `WorkMapCard`, `WorkMapBadge`, `WorkMapStatusDot`, `WorkMapPageHeader`, `WorkMapPrivacyNotice`, and `WorkMapEmptyState`.
- `/employees`, `/reports`, `/integrations`, `/settings`, and `/compliance` now use shared page header/button/privacy primitives where practical. `/settings` also uses shared card and badge primitives. `/employees` uses the shared empty state.
- Frontend mock data has labelled boundary exports under `apps/web/lib/mock/mockPeople.ts`, `mockReports.ts`, `mockIntegrations.ts`, and `mockOffice.ts`. These exports are frontend demo/fallback data only.
- A typed frontend API client foundation exists under `apps/web/lib/api/`: `apiClient.ts`, `apiTypes.ts`, `authApi.ts`, `usersApi.ts`, `virtualOfficeApi.ts`, `integrationsApi.ts`, `complianceApi.ts`, and `reportsApi.ts`. It uses `NEXT_PUBLIC_WORKMAP_API_URL` with a development localhost default, supports optional Bearer tokens, returns graceful fallback results, and does not auto-call `/auth/dev-token`.
- Current API integration remains optional/fallback-safe. Existing SaaS pages still use mock data until auth/RBAC/API contracts are final enough to wire real data safely.
- `/virtual-office` overlay z-index values now use shared theme layer tokens. No new Gather-like feature areas, Phaser migration, Canvas rewrite, backend changes, Socket.IO, Microsoft Graph, chat persistence, calendar sync, or notices persistence were added.

Current frontend-only workflow routes:

- Not logged in -> `/login`
- Logged in without company -> `/onboarding/company`
- Company exists without policy acknowledgement -> `/compliance`
- Policy acknowledged without avatar -> `/onboarding/avatar`
- Avatar exists without device setup -> `/onboarding/device-setup`
- Employee setup complete -> `/virtual-office`
- Manager, Owner, and IT Admin setup complete -> `/dashboard`

Known remaining frontend work:

- Replace Canvas MVP with Phaser.js when dependency install is approved.
- Continue calibrating layered avatar frame indexes for idle, walk, run, and sit states.
- Replace mock randomized remote avatars with backend-provided avatar configs when realtime identity/avatar data exists.
- Add true authored sitting and optional running animations after frame mapping is confirmed.
- Add Socket.IO client integration after backend gateway exists.
- Move avatar config from localStorage to backend profile API after Director approves the API contract.
- Replace mock office player and room data with backend APIs.
- Replace `InteractionDrawer` placeholder action handlers with backend-provided contact/integration links after API contracts exist.
- Replace mini map static overlay with a richer map/navigation layer only if needed; do not rewrite the Canvas renderer for this.
- Extract shared mock people/report data into clearer feature-neutral files before API wiring.
- Add responsive polish for dashboard, employees, reports, compliance, integrations, and settings.
- Add future real settings/API wiring after backend contracts are approved.
