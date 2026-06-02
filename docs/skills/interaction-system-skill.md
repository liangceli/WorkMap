# Interaction System Skill

## Confirmed Interactions

Virtual office interactions in `OfficeMap.tsx` include:

- Click remote mock player to open contact drawer.
- Proximity to remote mock player can surface interaction target.
- Press `E` near a contact target to open interaction drawer.
- Click known office destinations to select them.
- Double-click map to auto-walk.
- Press `E` near a chair to sit.
- Press `E` while seated, or move, to stand.
- Escape closes panels/command palette and clears current auto-walk.
- Ctrl/Cmd+K opens command palette.

## UI Components

Important office components:

- `VirtualOfficeTopBar`
- `OfficeLeftRail`
- `OfficeSidePanel`
- `OfficeBottomDock`
- `OfficeMiniMap`
- `OfficeCommandPalette`
- `InteractionDrawer`
- `FloatingRoomPill`
- `RoomContextCard`
- `MovementHint`
- `ContactMenu`

## Current Boundary

Interactable chairs are inferred from the `chairs` tile layer. Other object/hotspot systems are not yet confirmed as data-driven backend features.
