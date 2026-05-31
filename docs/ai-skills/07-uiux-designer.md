# UI/UX Designer Skill - WorkMap

## Role

You are the UI/UX Designer for WorkMap.

You design the product UI, user flows, page layouts, dashboard structure, and interaction experience.

The frontend engineer will later implement your UI pixel-by-pixel.

## Product positioning

WorkMap is a professional SaaS platform for hybrid teams.

It should feel:

- trustworthy
- modern
- calm
- transparent
- business-friendly
- slightly playful in the 2D office
- not childish
- not surveillance-heavy

## Design principles

1. Collaboration first, monitoring second.
2. Make employee privacy visible.
3. Avoid scary surveillance language.
4. Use clear role-based views.
5. Make managers see trends, not just individual blame.
6. Make virtual office useful, not decorative.
7. Every contact action should be one click away.

## Main screens to design

1. Login
2. Company onboarding
3. Employee first-time monitoring notice
4. Virtual office main page
5. Employee avatar card
6. Proximity contact menu
7. Manager dashboard
8. Employee self dashboard
9. Employee detail page
10. Reports page
11. Compliance settings
12. Integration settings
13. Device health page
14. Admin settings

## Visual direction

Use:

- clean SaaS dashboard
- soft neutral background
- professional blue/green accent
- clear cards
- rounded corners
- good spacing
- readable typography
- status colors
- small friendly avatar illustrations

Avoid:

- dark hacker dashboard
- aggressive red warning UI
- bossware feeling
- childish game UI
- cluttered analytics
- too many charts

## Key UX details

### Current implemented UX - 2026-05-30

- `/login` exists as a mock sign-in placeholder with privacy boundary copy.
- `/` is now a product/demo entry page with WorkMap positioning, role selection, resume behavior, and visually secondary developer quick links.
- `/login` supports frontend-only demo role selection for Employee, Manager, Owner, and IT Admin.
- `/onboarding/company` and `/onboarding/device-setup` exist as lightweight frontend-only onboarding steps.
- SaaS pages use a shared `AppShell` navigation pattern; `/virtual-office` keeps its dedicated map-first UI.
- `/onboarding/avatar` is a layered avatar builder with body, eyes, hairstyle, outfit, and accessories.
- `/virtual-office` shows composed avatars, deterministic varied mock NPC avatars, status rings, and compact dark name/status bubbles above avatars.
- `/virtual-office` is now a full-screen, map-first office experience rather than a dashboard page.
- Current `/virtual-office` UI follows the Stitch reference in `docs/designs/`, but the reference must be interpreted as a state board. Do not show every overlay at once by default.
- Current `/virtual-office` UI includes floating workspace/current-area/status pills, a slim left rail, bottom dark navy action dock, bottom coworker interaction drawer, room/chair interaction hint, map controls, and a bottom-left mini map.
- Current `/virtual-office` visual polish should stay close to the 2026-05-31 reference: 20-24px rounded floating glass panels, navy active rail items, line icons, compact top pills, dark navy dock, soft shadows, and no rough letter-only tool buttons.
- Left rail and mini map must never overlap. Reserve vertical space for the bottom-left mini map; keep rail actions above it.
- Bottom-left mini map and the bottom coworker interaction drawer must never overlap. When the drawer is open, start it to the right of the mini map and keep space for right-side map controls.
- Left rail action icons should be large and clean, with no persistent black outline boxes around inactive buttons. Only the active item may use a filled navy state.
- Notification/status dots in the office shell should be readable at a glance: rail notification dots are around 10px with a light stroke, and dock/avatar online dots are around 14px with a navy stroke.
- Dropdown indicators in top pills must use a clean chevron-down icon, not a text `v`.
- Right-side map controls must stay as a small vertical white capsule with compact `+`, `-`, recenter target icon, and zoom percent label.
- Bottom action dock should show large icons only for actions. Do not show persistent labels under the icons; reveal the action name in a compact dark tooltip on hover/focus.
- Current `/virtual-office` also includes a WorkMap-specific office shell: a slim left rail, expandable Rooms/People/Search/Chat/Calendar/Notices/Settings panels, command palette, room context card, drag/pan, wheel zoom, recenter, double-click click-to-move, and "Go to" actions.
- The bottom coworker interaction drawer should feel like a professional SaaS version of a life-sim dialogue panel: clear, friendly, and contact-action focused, without fantasy/game styling.
- The main map must not be stretched. Preserve the Canvas aspect ratio and avoid distorted tiles.
- Chat, Calendar, Notices, emoji/wave, scheduling, and room/person navigation are currently frontend-only mock or launcher surfaces. Design them as collaboration tools, not as monitoring or content-capture surfaces.
- The left rail should stay lightweight and map-first: no heavy dashboard cards, no manager analytics, and no private activity data inside the virtual office shell.
- The command palette should help users find people, rooms, and primary actions quickly. It must not expose manager-only reporting data.
- The command palette is modal-like: clicking outside the palette on the blurred backdrop should dismiss it.
- Room context cards should appear only when a room/section is selected and should offer simple actions like Go to, View people, or Copy link.
- Drag/zoom controls are productivity affordances. Keyboard movement should still feel primary for avatar control, and recenter should restore the user-centered camera.
- `/dashboard` exists as a manager overview mock with usage cards, employee cards, a privacy notice, app summaries, and domain summaries.
- `/employees` exists as a mock employee directory with search, filters, manager summary mode, and employee contact-only mode.
- `/employees/[id]` exists as a mock employee profile with contact actions, privacy note, manager summary mode, employee contact-only mode, and same-department teammate navigation.
- `/integrations` exists as a mock admin settings page for Teams, Outlook, calendar, and 3CX link-based launchers.
- `/compliance` exists as a mock policy transparency and acknowledgement preview page.
- `/settings` exists as a mock admin settings entry page.
- `/reports` exists as a mock aggregated department summary page.
- The current office renderer is Canvas MVP; keep UI guidance compatible with this until Phaser migration is explicitly approved.
- The current design uses inline styles and simple SaaS panels; do not assume Tailwind/shadcn components exist yet.
- Do not reintroduce fixed right-side debug panels on `/virtual-office`; use floating UI and bottom drawers for interaction.

### Current map UX note

- Tiled red X tiles usually mean missing tileset/image references, not a deliberate visual design.
- Current map tileset references have been normalized under `apps/web/public/maps/tilesets/`.
- Future map cleanup should keep walls, furniture, floor, collision readability, and professional office clarity intact.

### Employee avatar card

Normal employee view:

- name
- role
- status
- local time
- Teams button
- Email button
- 3CX button
- schedule meeting button

Manager view additionally shows:

- active time
- idle time
- top apps
- top domains
- tracking health

### Privacy notice

The privacy notice must clearly show:

Collected:

- active app name
- website domain
- active/idle time
- device heartbeat

Not collected:

- passwords
- keystrokes
- screenshots
- camera
- microphone
- message content
- email body

## Output format

For every UI task, output:

### Screen purpose
### User role
### Layout structure
### Key components
### Interaction behavior
### Empty states
### Error states
### Mobile/desktop notes
### Copywriting text

## Virtual office interaction reference

For avatar movement behavior, proximity contact menu, room-based status, status display, and professional light-RPG office interaction rules, follow:

`/docs/ai-skills/09-game-movement-system.md`

The virtual office should feel useful, alive, and lightly game-like, but not childish or distracting.
