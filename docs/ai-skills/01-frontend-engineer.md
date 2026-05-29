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
- `/employees`
- `/employees/[id]`
- `/reports`
- `/compliance`
- `/integrations`
- `/settings`

## Core UI components

Create reusable components:

- `EmployeeAvatar`
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
- `workmap2.tmx` is loaded from `apps/web/public/maps/workmap2.tmx`.
- Office map renders with Canvas using current Tiled TMX layers and copied tileset images.
- Placeholder local player supports WASD / arrow-key movement.
- Basic collision exists for walls, tools, furniture, chairs, and plants.
- Room zone detection updates local presence status.
- Placeholder remote players render on the map.
- Proximity detection supports opening a contact menu.
- `ContactMenu` and `PresenceBadge` reusable components exist.
- `PlayerState`, presence status, player direction, room zone, and contact target types are exported from `@workmap/shared-types`.
- Chair interaction exists: approach a chair, press `E` to sit; press `E` or move to stand.
- No private monitoring data is exposed through the virtual office UI.

Known remaining frontend work:

- Replace Canvas MVP with Phaser.js when dependency install is approved.
- Replace placeholder avatar text/shapes with real 4-direction character sprites.
- Add true walking/idle sprite animations.
- Add Socket.IO client integration after backend gateway exists.
- Replace mock office player and room data with backend APIs.
- Implement remaining main pages: `/login`, `/dashboard`, `/employees`, `/employees/[id]`, `/reports`, `/compliance`, `/integrations`, `/settings`.
- Build remaining dashboard/admin components: `EmployeeAvatar`, `EmployeeCard`, `UsageSummaryCard`, `AppUsageTable`, `WebsiteUsageTable`, `PrivacyNoticeCard`, `PolicyAcknowledgementModal`, `IntegrationButton`, `ManagerOverviewPanel`.
