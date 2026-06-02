# Virtual Office Skill

## Confirmed Product Behavior

The `/virtual-office` route renders a full-screen canvas virtual office. It currently uses:

- A Tiled TMX map at `/maps/workmap2.tmx`.
- Office tileset images under `public/modern-office`.
- Local player state initialized at a fixed coordinate.
- Layered avatar assets from the avatar customization system.
- Room zones and remote players from `components/office/mockOfficeData.ts`.
- Keyboard movement and click/double-click map interactions.
- Contact drawer behavior when close to or clicking mock remote players.
- Chair interaction with `E` to sit/stand.
- Status changes from room zones and chair state.

## Backend Support

Backend has virtual-office endpoints for map, navigation destinations, and latest positions. Prisma has persistent office map, room, and position models.

## Current Boundary

The frontend virtual office is not yet confirmed to be backend-driven. Treat mock room/player state as demo data until replaced by API-backed state.

## Product Rules to Preserve

- Do not copy SkyOffice implementation directly.
- Keep privacy/compliance context visible as WorkMap is a compliant work visibility product, not only a game map.
- Preserve clear distinction between simulated presence and actual employee monitoring data.
