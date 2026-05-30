# Game Movement System Skill - WorkMap

## Goal

The 2D office should feel alive and game-like, but still professional.

It should not feel like a full game. It should feel like a useful virtual workspace with light RPG-style movement.

The virtual office is not decoration. It is the main visual workspace for:

- employee presence
- avatar movement
- quick contact actions
- room-based status
- lightweight team interaction
- Teams / Outlook / 3CX contact entry points

---

## Movement model

### MVP movement

The MVP movement system should support:

- keyboard movement with WASD / arrow keys
- grid-aware movement
- collision detection
- smooth interpolation
- walking animation
- idle animation
- direction-based sprite
- local player movement
- mock or realtime remote players
- status indicator above or below avatar

### Later movement features

Later versions can support:

- click-to-move
- pathfinding
- room-based auto status
- sit-at-desk action
- wave action
- quick emotes
- avatar customization
- desk assignment
- calendar-based auto movement/status
- meeting room join animation

---

## Technical choice

Use Phaser.js inside the Next.js frontend.

Current MVP note:

- The current `/virtual-office` implementation still uses Canvas, not Phaser.
- Do not switch the Canvas MVP to Phaser unless the task explicitly asks for it and dependency install is approved.
- Keep Canvas changes small and preserve movement, collision, room zones, proximity contact menu, and chair sit/stand behavior.
- Current office rendering reads `apps/web/public/maps/workmap2.tmx`.
- Current Tiled tilesets live under `apps/web/public/maps/tilesets/`.
- In development, the Canvas MVP polls the TMX file and reloads map data when the XML changes.
- If Tiled shows red X tiles for `workmap2.tmx`, inspect external `.tsx` tileset references and image paths before changing movement or collision code.

Recommended frontend structure:

```txt
apps/web/components/office/OfficeGame.tsx
apps/web/components/office/PhaserGame.ts
apps/web/components/office/scenes/OfficeScene.ts
apps/web/components/office/entities/Player.ts
apps/web/components/office/entities/RemotePlayer.ts
apps/web/components/office/systems/InputSystem.ts
apps/web/components/office/systems/CollisionSystem.ts
apps/web/components/office/systems/ProximitySystem.ts
apps/web/components/office/systems/RoomSystem.ts
apps/web/components/office/systems/SocketSyncSystem.ts
apps/web/components/office/types.ts
Realtime sync

Realtime sync should work like this:

local player movement runs immediately on the client
client sends position updates to Socket.IO
server validates the user and company
server broadcasts movement only to the same company room
remote players use interpolation to avoid jitter
private activity tracking data must not be sent through the game socket
Movement data

Each player state should follow this shape:

type PlayerState = {
  userId: string
  displayName: string
  avatarId: string
  x: number
  y: number
  direction: 'up' | 'down' | 'left' | 'right'
  isMoving: boolean
  status:
    | 'available'
    | 'busy'
    | 'focus'
    | 'idle'
    | 'break'
    | 'offline'
    | 'on_call'
  roomId?: string
  updatedAt: string
}

Do not add private monitoring data to PlayerState.

Do not include:

app usage
website usage
idle duration detail
employee productivity data
activity tracking events

Those belong to dashboard/report APIs, not realtime office movement.

Socket events
Client to server
socket.emit('office:join', {
  companyId,
  userId
})

socket.emit('avatar:move', {
  x,
  y,
  direction,
  isMoving,
  roomId
})

socket.emit('avatar:stop', {
  x,
  y,
  direction,
  roomId
})

socket.emit('status:update', {
  status: 'available' | 'busy' | 'focus' | 'idle' | 'break' | 'offline' | 'on_call'
})

socket.emit('room:enter', {
  roomId
})

socket.emit('room:leave', {
  roomId
})

socket.emit('proximity:trigger', {
  targetUserId
})
Server to client
socket.on('office:userJoined', {
  userId,
  playerState
})

socket.on('office:userLeft', {
  userId
})

socket.on('avatar:moved', {
  userId,
  x,
  y,
  direction,
  isMoving,
  roomId,
  updatedAt
})

socket.on('avatar:stopped', {
  userId,
  x,
  y,
  direction,
  roomId,
  updatedAt
})

socket.on('status:changed', {
  userId,
  status,
  updatedAt
})

socket.on('room:userEntered', {
  userId,
  roomId
})

socket.on('room:userLeft', {
  userId,
  roomId
})
Game feel requirements

The avatar movement should feel smooth, lightweight, and professional.

Avatar should have:

4-direction walking animation
idle animation
layered avatar rendering for the local player in the current Canvas MVP
deterministic randomized layered avatars for mock remote players
small oval foot shadow
compact dark name/status bubble above avatar
status ring or status dot
smooth start and stop
no sliding through walls
no teleporting unless loading/reconnect
remote avatar interpolation
hover or click highlight
subtle proximity highlight

The visual style should feel like:

professional SaaS virtual office
+
light office RPG movement

It should not feel like:

combat game
childish mini game
dark surveillance dashboard
copied Gather-style clone
Collision

The map should define:

walkable tiles
blocked tiles
interactive zones
room boundaries
foreground objects

Players must not walk through:

walls
desks
chairs
meeting tables
plants
cabinets
reception desk
large equipment
closed doors

Recommended map layers:

floor
wall
furniture
collision
interaction
foreground

Use Tiled Map Editor format if possible.

The collision layer should be invisible to users but readable by Phaser.

Rooms

The office should include room zones.

Example rooms:

open office
sales zone
IT zone
finance zone
manager office
meeting room
focus room
break room
reception
remote team zone

Room zones can affect user status.

Examples:

focus room    => status becomes focus
break room    => status becomes break
meeting room  => status becomes busy or in meeting
open office   => status becomes available

Room-based status should be optional and configurable later.

For MVP, it can be implemented as a frontend + socket event behavior.

Proximity logic

When two avatars are close enough, the UI should allow quick interaction.

Distance threshold:

within 80 px
or within 2 tiles

When proximity condition is met:

show subtle highlight
show small interaction hint
allow user to click or press a key to open contact menu
do not auto-open the menu
do not interrupt movement

Contact menu actions:

quick message
open Teams chat
send Outlook email
call via 3CX
schedule meeting
leave note
view profile

Normal employees should only see contact/profile information.

Managers may see extra summary data depending on RBAC.

Contact menu rules

The contact menu should be lightweight and fast.

Minimum MVP actions:

Teams Chat
Outlook Email
3CX Call
Schedule Meeting
View Profile

The contact menu must not show private monitoring information to normal employees.

Normal employee view can show:

name
role
department
status
local time
contact buttons

Manager view may additionally show:

today's active time
today's idle time
top apps summary
top domains summary
tracking health

Only show manager data when the backend confirms the current user has permission.

Status display

Avatar status should be visible but not distracting.

Recommended status mapping:

available  => green
busy       => red
focus      => blue
idle       => yellow
break      => orange
offline    => grey
on_call    => purple

Status can be shown using:

small dot inside the name/status bubble
ring below avatar
subtle outline around avatar

Do not make status indicators too large or aggressive.

Layered avatar MVP

The current avatar system is layered for the onboarding and virtual office MVP.

Current files:

```txt
apps/web/app/onboarding/avatar/page.tsx
apps/web/components/avatar/AvatarPreview.tsx
apps/web/components/avatar/LayeredAvatarPreview.tsx
apps/web/lib/avatar/avatarAssets.ts
apps/web/lib/avatar/avatarLayerAssets.ts
apps/web/lib/avatar/avatarStorage.ts
apps/web/lib/avatar/avatarFrameMaps.ts
apps/web/components/office/OfficeMap.tsx
```

Current rules:

- Use layered sprite sheets from `apps/web/public/assets/avatars/layers/`.
- The current layered categories are body, eyes, hairstyle, outfit, and accessory.
- Store the MVP selected avatar in `localStorage` under `workmap.avatarConfig`.
- Use `LayeredAvatarConfig` with `version: 2`, `bodyId`, optional `eyesId`, optional `hairstyleId`, optional `outfitId`, and optional `accessoryIds`.
- If no valid avatar is selected, guide the user to `/onboarding/avatar`.
- If layer loading fails, keep the existing placeholder player fallback.
- Mock remote players should not reuse the local user's avatar; give them deterministic randomized layered configs.
- Keep local avatar customization client-side until Director approves a backend profile API.
- Keep frame mapping configurable in `avatarFrameMaps.ts`.
- If exact frame indexes are unknown, use safe defaults and mark them for later calibration.
- The layered sheets are 56 columns x 22 rows with 32px frame indexing.
- The current Canvas renderer uses 32x48 source crops with a -16px y offset to avoid clipping the top of the head.
- Current walk frames use row 5 after visual calibration for clearer leg motion.
- Left/right frame mappings may need further calibration whenever art changes.

Current Canvas MVP behavior:

- Local player uses the selected layered avatar.
- Mock remote players use deterministic randomized layered avatars.
- Name/status UI is a compact dark bubble above the avatar with a small status dot.
- Chair interaction is keyboard-driven: near a chair, press `E` to sit; press `E` again or move to stand.
- `/virtual-office` uses a full-screen map-first UI with a lightweight top bar, floating room/chair status pill, movement hint, bottom interaction drawer, and mini map.
- The old right-side debug panel is removed.
- The mini map is an overlay Canvas that draws the full TMX office and the local player dot. It must not affect movement, collision, or camera math.
- Main Canvas display must preserve the 1120x680 aspect ratio; do not stretch the map to fit the browser viewport.
- The current Canvas camera keeps the local player centered on screen while the map moves underneath; do not clamp the camera to map edges unless explicitly requested.
- Local movement treats mock remote players as lightweight blockers so avatars do not overlap.
- The mini map currently shows the full office and local player dot only; the blue viewport range box was intentionally removed.
- No realtime socket sync is implemented yet.
- Frontend-only workflow now routes first-time employees through compliance acknowledgement, avatar creation, device setup, and then `/virtual-office`. This workflow state is stored under `workmap.userSetupState` and is not real auth/RBAC.

Map interaction zones

The office map can contain interaction zones.

Example zones:

focus_room_zone
break_room_zone
meeting_room_zone
reception_zone
department_zone_sales
department_zone_it
department_zone_finance

When player enters a zone:

detect zone overlap in Phaser
update local room state
send room:enter
optionally send status:update
show small UI hint

When player leaves a zone:

detect zone exit
send room:leave
restore previous status when appropriate
remove UI hint
Performance rules

Do not emit socket movement events every animation frame.

Recommended behavior:

local movement runs at normal Phaser frame rate
socket movement update every 50–100ms while moving
send final avatar:stop event when movement stops
remote avatars should interpolate between received positions
avoid sending duplicate position events
avoid sending private tracking data through realtime socket
only sync users inside the same company workspace
clean up listeners when leaving the page

Recommended movement sync rule:

Local rendering: every frame
Socket emit: every 50–100ms
Final stop event: immediately when movement stops
Remote interpolation: every frame
Security rules

Socket position data is not trusted.

Backend must:

verify authentication token
derive userId from token, not from client input
verify company membership
isolate company rooms
reject cross-company movement broadcasts
validate roomId belongs to the same company
reject impossible teleport distances if needed
rate limit movement events if needed
never broadcast private activity data through office sockets

Frontend must not assume socket data is trusted.

Do not expose:

website usage
app usage
monitoring data
employee reports
private dashboard data

through movement socket events.

Anti-abuse rules

The movement system does not need heavy anti-cheat logic, but it must avoid obvious abuse.

Backend can optionally reject:

movement updates from unauthenticated users
movement updates from users outside the company
movement updates with invalid coordinates
movement updates into blocked rooms
movement updates with impossible jump distance
excessive movement event frequency

The virtual office is not a competitive game, so anti-cheat should stay lightweight.

Testing requirements

The movement system should be tested for:

avatar onboarding route
layered avatar selection
avatar config saved to localStorage
virtual office redirect when avatar config is missing
WASD movement
arrow key movement
collision with walls
collision with furniture
avatar direction change
walking animation
idle animation
selected local avatar sprite rendering
placeholder fallback when avatar image fails
randomized remote avatar rendering
remote avatar interpolation
status ring update
room enter/leave
proximity detection
contact menu trigger
bottom interaction drawer open/close
mini map player dot and viewport update while moving
full-screen virtual office layout without map distortion
chair sit/stand behavior with avatar selected
company room isolation
socket disconnect/reconnect
no private data in socket payload
MVP acceptance criteria

The MVP movement system is acceptable when:

one local player can move smoothly in the office
one local player can build a layered avatar before entering the office
the selected local avatar renders from the layered sprite sheets
the player cannot walk through blocked objects
player direction updates correctly
idle/walking animation switches correctly
player name and status are visible
clicking another avatar opens contact menu
proximity highlight works
room zone detection works at basic level
socket event names follow this document
private monitoring data is not included in movement payloads
Notes for Frontend Engineer

Frontend engineer owns:

Phaser setup
player movement
animation state
collision system
proximity detection
contact menu UI trigger
room zone detection
socket client integration

Frontend engineer must not:

expose private monitoring data through socket payloads
rely only on frontend checks for permissions
invent new socket event names without Director approval
hardcode sensitive manager-only data into normal employee views
Notes for Backend Engineer

Backend engineer owns:

Socket.IO gateway
company room isolation
authenticated socket connection
movement event validation
status broadcast
room enter/leave broadcast
latest position persistence

Backend engineer must not:

trust client-provided userId
broadcast movement across companies
include private monitoring data in socket events
allow unauthenticated socket movement
allow unrestricted room access without validation
Notes for Test Engineer

Test engineer should verify:

local movement feels smooth
collision works
socket payloads do not contain private data
users from different companies cannot see each other
contact menu appears only when expected
manager-only data is not shown to normal employees
room status changes work
disconnect/reconnect does not duplicate avatars
Notes for Security Engineer

Security engineer should review:

socket authentication
company room isolation
movement event validation
roomId validation
rate limiting
private data leakage through realtime events
spoofed userId attempts
cross-company visibility attempts
Notes for Art Generator

Art generator should produce assets that support:

4-direction walking
idle states
small avatar scale
readable name/status labels
transparent background
consistent light direction
office RPG style
professional SaaS feeling

Required avatar sprite directions:

down
up
left
right

Recommended frames:

4 walking frames per direction
1–2 idle frames per direction

Required visual extras:

small oval foot shadow
status ring or status dot
clean outline
business casual clothing
