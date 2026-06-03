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

## Not Confirmed

- No websocket or server-sent events implementation was found.
- No realtime broadcast/sharing of position updates was added.
- No historical position trail was added.

## Recommended Presence Direction

Polling is the current MVP/pilot presence strategy. Revisit websocket/SSE only if pilot scale or latency requirements justify it.
