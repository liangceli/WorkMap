# Virtual Office Skill

## Confirmed Product Behavior

The `/virtual-office` route renders a full-screen canvas virtual office. It currently uses:

- A validated virtual-office map manifest, currently pointing at the Tiled TMX map `/maps/workmap2.tmx`.
- Office tileset images under `public/modern-office`.
- Local player state initialized from the active manifest safe/default spawn unless a valid saved backend position restores first.
- Layered avatar assets from the avatar customization system.
- Room zones, destinations, and remote players from validated virtual-office read APIs when safe, with `components/office/mockOfficeData.ts` fallback.
- Keyboard movement and click/double-click map interactions.
- Contact drawer behavior when close to or clicking mock remote players.
- Chair interaction with `E` to sit/stand.
- Status changes from room zones and chair state.

## Backend Support

Backend has virtual-office endpoints for map, navigation destinations, and latest positions. Prisma has persistent office map, room, and position models.

Frontend support added in commit `abe673c`:

- `useVirtualOfficeData.ts` attempts map, navigation, and position reads once on mount.
- Valid API rooms can replace mock rooms.
- Valid API navigation can replace mock destinations.
- Valid API positions can replace mock remote players.
- Invalid or missing API parts remain mock-backed.

Development verification support added in commit `2a4a269`:

- Before read API calls, the frontend attempts to obtain a development Bearer token through the existing `POST /auth/dev-token` endpoint.
- The token is used only in browser development builds.
- If auth is unavailable, the virtual office continues with unauthenticated reads and mock fallback.
- Console logging reports whether API auth was available and whether data came from API or mock fallback.

Local API-backed verification completed in commit `d7152dd`:

- Backend health on `localhost:3001` was verified.
- `POST /auth/dev-token` returned a Bearer token for the seeded demo identity.
- Authenticated map, navigation, and positions reads returned real backend data.
- Browser `/virtual-office` with backend running rendered API-backed state.
- Browser `/virtual-office` after backend stopped still rendered mock fallback.

Current-user latest-position persistence added in commit `1a0a19f`:

- On load, the frontend can restore the local player from the authenticated user's saved backend position.
- The current user's API position is filtered out of remote players to avoid duplicate rendering.
- Local movement, chair/status changes, direction changes, and room changes can trigger latest-position saves.
- Saves use a throttled/debounced cadence and require `officeMapId` plus authenticated API options.
- Backend-off/auth-off paths continue to render with mock fallback and local movement.
- Restore happens once per mount and does not overwrite local movement after the player has been touched.

Basic polling presence added in commit `effb188`:

- Remote positions refresh through repeated `GET /virtual-office/map/:officeMapId/positions`.
- Visible tabs poll about every 4 seconds.
- Hidden tabs poll about every 15 seconds.
- Current user is filtered out and remains locally controlled.
- Other users update as remote players on polling cycles.
- Stale remote users map to `idle` or `offline` using `updatedAt` freshness.
- Failed polling keeps the last good state or initial mock fallback.

5-person People/Presence MVP added in commit `b68dd49`:

- People panel shows a current-user `You` card separately from remote teammates.
- People panel summarizes active, idle, and offline counts.
- Remote teammate cards show role, readable room/area, freshness label, last-seen detail, and actions.
- People filters and search have friendly empty states.
- Command palette People search rows show the same freshness and room context.
- Mock/fallback mode is labeled as demo team mode; API-connected empty remote state is shown as healthy empty state.
- Room labels are resolved from destinations or shown as `Office area`; raw UUIDs are not displayed.
- Polling remote presence no longer visibly reloads/flashes the TMX canvas loop.

Virtual-office interaction clarity added in commit `5db7e8d`:

- `VirtualOfficeTopBar` shows a compact sync/status pill using existing `presenceSource`, realtime connection state, and visible remote teammate count.
- The sync/status pill explains demo presence, API-connected, partial API, realtime connected, reconnecting, and polling fallback modes without changing data fetching, polling cadence, or WebSocket reconnect behavior.
- People panel actions are intentionally honest: `Details` opens the existing contact drawer, `Wave` is local feedback only, and Teams/Outlook/3CX actions show not-connected placeholder feedback.
- Contact drawer guidance changes for focus, busy, offline, and available teammates.
- Contact drawer external actions use toast feedback and do not create fake email, Teams, Outlook, or 3CX integrations.
- Bottom dock status/local notes/contact placeholders use honest labels and local feedback.
- Chair prompts now distinguish `press E to sit` and `press E to stand`.
- Room context card clarifies occupancy, focus-room cue behavior, and copy-link feedback.
- No backend/realtime reaction event delivery was added. Wave/reaction remains local UI feedback only.
- No map art, TMX, movement, collision, pathfinding, chair mechanics, contact drawer API, or realtime protocol behavior changed.

Pilot auth/privacy boundary added in commit `14fb706`:

- `/virtual-office` uses unified API auth and prefers stored pilot Bearer session over development dev-token fallback.
- Current-user filtering continues to use the authenticated user id.
- Position save/restore and polling presence continue under pilot Bearer auth when signed in.
- People panel explains that teammates can see avatar location, workspace status, and last-seen freshness.
- People panel also states that screen recording, keystrokes, hidden camera/mic, and message content are not shown there.

Backend-backed profile/avatar behavior added in commit `815df2c`:

- API positions include backend `displayName` and `avatarId`.
- `OfficeMap` decodes valid `layered:v2:` avatar references for current and remote API players.
- Remote avatar assets are keyed by stable `userId:avatarId` signature so normal polling does not reload avatars every 4 seconds.
- Authenticated API users without a valid backend avatar are routed to avatar setup instead of using local-only avatar cache as completion.
- Mock/fallback mode can still use local avatar cache when API data is unavailable.

Realtime movement added in commit `1d2836c`:

- `/virtual-office` can connect to `/virtual-office/realtime` when `officeMapId` and token-backed API auth options are available.
- Local movement snapshots are sent through `useVirtualOfficeRealtime.ts`.
- Remote users in the same company/map room receive smooth movement updates through `player:state`.
- Remote avatar positions interpolate on the canvas instead of jumping only on polling cycles.
- Large jumps or stale realtime state snap safely rather than easing through impossible paths.
- Polling positions remains active as fallback and reconciliation for People panel/profile/freshness stability.
- Realtime movement does not persist every frame. Latest-position durability still uses the existing HTTP save loop.

Safe map manifest architecture added in commit `4e09788`:

- `WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST` in shared types centralizes current TMX path, map/canvas dimensions, tile size, default spawn, safe fallback spawn, collision layer names, render layer order, rooms, and navigation destinations.
- Existing `OfficeMap.mapData` is now used as the manifest storage layer for new owner workspaces.
- No Prisma schema migration was added.
- Frontend `virtualOfficeMapAdapter.ts` validates API map, room, navigation, and position data before use.
- Invalid or missing API map config falls back to the shared default manifest.
- Mock/fallback rooms and navigation are derived from the default manifest rather than separate hardcoded coordinate lists.
- Backend tenant onboarding creates default owner workspace map, rooms, and spawn from the manifest.
- Backend `/virtual-office/navigation` is generated from the resolved manifest.
- People panel and command palette can map backend room UUIDs and manifest destination ids to readable area names.
- Current-user saved positions outside active manifest bounds are ignored or rejected; blocked/out-of-bounds local players relocate to the nearest walkable point around safe spawn.
- If there is no saved backend position and the user has not moved locally, `OfficeMap` realigns the local player to the active manifest safe/default spawn after office data loads.

## Current Boundary

The API integration now includes current-user latest-position restore/save, backend-backed avatar/display-name profile data, polling presence, native WebSocket realtime movement, and validated manifest-driven map configuration. It still does not add a visual map editor, backend map rendering, arbitrary user mutation, historical trails, map-versioned saved positions, or shared pub/sub for multi-instance realtime deployment.

The current default manifest still points at `/maps/workmap2.tmx`. Future map changes should update validated manifests in `OfficeMap.mapData`; do not scatter new hardcoded map dimensions, rooms, or spawn coordinates across frontend/backend files.

Known coordinate caveat: backend room coordinates currently do not perfectly match the TMX/mock room zones. The same local player coordinate can show API-backed `Sales Zone` while fallback shows generic `Office`.

## Product Rules to Preserve

- Do not copy SkyOffice implementation directly.
- Keep privacy/compliance context visible as WorkMap is a compliant work visibility product, not only a game map.
- Preserve clear distinction between simulated presence and actual employee monitoring data.
- Collaboration controls must clearly distinguish implemented local UI feedback from future integrations such as Teams, Outlook, 3CX, or backend-delivered reactions.
