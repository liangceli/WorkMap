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

Backend exposes latest positions through `GET /virtual-office/map/:officeMapId/positions`. The frontend virtual office now attempts this endpoint once on mount through the read-only loader and adapts valid positions into remote players.

## Not Confirmed

- No websocket or server-sent events implementation was found.
- No frontend polling of backend virtual-office positions was added.
- No API route was found for frontend position updates, though service support exists internally.

## Recommended Presence Direction

Decide whether MVP presence should use periodic polling or websocket updates. Document the choice in `decision-log.md` before implementation.
