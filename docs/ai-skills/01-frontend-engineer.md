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
- Tailwind CSS
- shadcn/ui
- Phaser.js for 2D office
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

## Current progress - 2026-05-29

Completed in current MVP:

- `/virtual-office` page exists.
- `/onboarding/avatar` page exists as a layered avatar builder.
- `workmap2.tmx` is loaded from `apps/web/public/maps/workmap2.tmx`.
- Office map renders with Canvas using current Tiled TMX layers and copied tileset images.
- Local player supports WASD / arrow-key movement.
- Basic collision exists for walls, tools, furniture, chairs, and plants.
- Room zone detection updates local presence status.
- Remote placeholder players render on the map with deterministic randomized layered avatars.
- Proximity detection supports opening a contact menu.
- `ContactMenu` and `PresenceBadge` reusable components exist.
- `AvatarPreview` reusable component exists.
- `LayeredAvatarPreview` reusable component exists.
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

Known remaining frontend work:

- Replace Canvas MVP with Phaser.js when dependency install is approved.
- Continue calibrating layered avatar frame indexes for idle, walk, run, and sit states.
- Replace mock randomized remote avatars with backend-provided avatar configs when realtime identity/avatar data exists.
- Add true authored sitting and optional running animations after frame mapping is confirmed.
- Add Socket.IO client integration after backend gateway exists.
- Move avatar config from localStorage to backend profile API after Director approves the API contract.
- Replace mock office player and room data with backend APIs.
- Implement remaining main pages: `/login`, `/dashboard`, `/employees`, `/employees/[id]`, `/reports`, `/compliance`, `/integrations`, `/settings`.
- Build remaining dashboard/admin components: `EmployeeAvatar`, `EmployeeCard`, `UsageSummaryCard`, `AppUsageTable`, `WebsiteUsageTable`, `PrivacyNoticeCard`, `PolicyAcknowledgementModal`, `IntegrationButton`, `ManagerOverviewPanel`.
