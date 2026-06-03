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

## Not Confirmed

- No websocket or server-sent events implementation was found.
- No frontend polling of backend virtual-office positions was added.
- No realtime broadcast/sharing of position updates was added.
- No historical position trail was added.

## Recommended Presence Direction

Decide whether MVP presence should use periodic polling or websocket updates. Document the choice in `decision-log.md` before implementation.
