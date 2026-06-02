# Virtual Office Skill

## Confirmed Product Behavior

The `/virtual-office` route renders a full-screen canvas virtual office. It currently uses:

- A Tiled TMX map at `/maps/workmap2.tmx`.
- Office tileset images under `public/modern-office`.
- Local player state initialized at a fixed coordinate.
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

## Current Boundary

The API integration is read-only. It does not add position persistence, polling, websocket, realtime presence, backend map rendering, or production auth/session changes.

The canvas source remains `/maps/workmap2.tmx`; do not use backend `OfficeMap.mapData` as the frontend canvas source unless a future task explicitly changes that architecture.

Known coordinate caveat: backend room coordinates currently do not perfectly match the TMX/mock room zones. The same local player coordinate can show API-backed `Sales Zone` while fallback shows generic `Office`.

## Product Rules to Preserve

- Do not copy SkyOffice implementation directly.
- Keep privacy/compliance context visible as WorkMap is a compliant work visibility product, not only a game map.
- Preserve clear distinction between simulated presence and actual employee monitoring data.
