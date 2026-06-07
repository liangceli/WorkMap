# Realtime Presence Skill

## Confirmed Presence State

Shared presence statuses:

- `available`
- `busy`
- `focus`
- `idle`
- `break`
- `offline`
- `on_call`

Frontend virtual office derives local status from:

- Current room zone `status`.
- Seated chair state, which sets local status to `busy`.
- Mock remote player data.

Backend stores:

- `User.status`
- `VirtualOfficePosition.status`
- `VirtualOfficePosition.updatedAt`

Backend exposes latest positions through `GET /virtual-office/map/:officeMapId/positions`. The frontend virtual office now attempts this endpoint once on mount through the loader and adapts valid positions into remote players. In browser development, this read can use the development Bearer token bridge when available.

Current-user latest position can now be saved through `PUT /virtual-office/map/:officeMapId/positions/me`. This is a latest-position persistence loop for the authenticated current user only.

Dashboard pilot readiness now also reads virtual-office positions as a status snapshot. This should remain a lightweight readiness/read path and should not replace the polling model used by `/virtual-office`.

Realtime movement is now available through `/virtual-office/realtime` when token-backed API auth and `officeMapId` are available. Polling remains the fallback/reconciliation path and latest-position durability path.

## Basic Polling Presence

Commit `effb188` added basic polling presence for the 5-person pilot.

- Poll endpoint: `GET /virtual-office/map/:officeMapId/positions`.
- Polling starts when `officeMapId`, authenticated API options, and `currentUserId` are available.
- Visible tab interval: about `4000ms`.
- Hidden tab interval: about `15000ms`.
- Returning to a visible tab triggers a prompt refresh.
- `inFlight` prevents overlapping requests.
- Request counters prevent older responses from replacing newer applied data.
- Failed polls keep the last good mounted remote-player state; initial API failure keeps normal mock fallback.
- API-valid empty remote results are treated as a valid empty remote list, not a reason to show mock people.

Freshness mapping for remote users:

- Updated within 30 seconds: keep backend status.
- Updated between 30 seconds and 5 minutes: show `idle`, unless already `offline`.
- Older than 5 minutes: show `offline`.

## People Presence UX

Commit `b68dd49` added the 5-person People/Presence MVP UI.

- Shared helpers live in `components/office/presence.ts`.
- `statusFromFreshness(status, updatedAt)` centralizes freshness-based status mapping.
- `presenceFreshnessLabel(updatedAt, status)` provides readable labels/details such as active now, idle / away, offline, updated just now, and last seen relative times.
- People panel separates current user from remote teammates.
- People panel shows active / idle / offline summary counts.
- Remote cards show role, readable room/area, freshness label, last-seen detail, and actions.
- People filters include `available`, `focus`, `busy`, `idle`, and `offline`; `break` users remain visible in all/search.
- Command palette People results use the same freshness and room/area context.
- Backend/mock/fallback/empty states are described in UI copy.

## Realtime Movement

Commit `1d2836c` added native WebSocket movement for same-company, same-office-map users.

- Socket endpoint: `/virtual-office/realtime`.
- Auth: same request-context resolver as guarded HTTP APIs; browser clients pass token query param.
- Join scope: server validates `officeMapId` ownership and computes room key as `companyId:officeMapId`.
- Movement event: `player:move` with `x`, `y`, `direction`, `isMoving`, `status`, and optional `roomId`.
- Broadcast event: `player:state` to other sockets in the same company/map room.
- Presence event: `office:presence` is emitted by the gateway, but the frontend primarily renders `player:state` plus polling reconciliation.
- Server accepts movement snapshots at a minimum interval around 50ms.
- Frontend sends visible movement around 110ms, hidden-tab movement around 1000ms, and important stop/room/status changes promptly.
- Realtime movement does not write each frame to the database.
- Remote avatar rendering interpolates toward latest realtime targets and snaps for large jumps or stale state.

## Not Confirmed

- No server-sent events implementation was found.
- No shared pub/sub adapter for multi-instance WebSocket broadcast was added.
- No historical position trail was added.
- Realtime manual QA passed locally for two browsers in one workspace, but deployed WSS smoke is still pending.
- Backend-backed `layered:v2:` avatar references can now render real layered avatars for current and remote API users when `User.avatarId` is present.
- Users without valid backend `avatarId` can still fall back to `WM` marker until they complete avatar/profile setup.

## Recommended Presence Direction

Use WebSocket `player:state` for live movement, keep polling for reconciliation/fallback, and keep HTTP latest-position saves for durability. Add shared pub/sub before horizontal API scaling, then add automated tenant-isolation and reconnect/fallback regression tests.
