# Movement System Skill

## Manual Movement

Local player movement is handled in `OfficeMap.tsx`.

Controls:

- Arrow keys or WASD move the player.
- Movement updates direction and `isMoving`.
- Movement is clamped to map bounds and blocked by collision grid checks.

Constants confirmed:

- Player radius: `14`.
- Player speed: `180`.
- Auto-walk speed: `PLAYER_SPEED * 1.5`.

## Auto-Walk

Double-clicking the canvas starts auto-walk. Pathfinding is implemented in `lib/office/pathfinding.ts` using a grid-based A* style search with Manhattan heuristic and four-direction neighbors.

Auto-walk:

- Finds nearest walkable start/end nodes.
- Can constrain destination to optional end bounds.
- Clears on manual movement or Escape.
- Shows `No clear path` toast when no path is found.

## Movement Gaps

- Local movement is client-side only in confirmed frontend code.
- No authoritative server movement validation or websocket movement sync was confirmed.
- No tests were found for pathfinding during intake.
