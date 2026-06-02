# Map System Skill

## Confirmed Map Assets

- Main frontend map path: `workmap/apps/web/public/maps/workmap2.tmx`.
- Additional root-level TMX files exist: `workmap2.tmx`, `workmap_office_mvp.tmx`.
- Tilesets/images exist under `workmap/apps/web/public/modern-office` and `workmap/apps/web/public/maps/tilesets`.

## Rendering

`OfficeMap.tsx` parses TMX XML in the browser and renders tile layers onto an HTML canvas. The map is polled every 1500 ms in development so map changes can refresh without a hard reload.

Known layer draw order:

- `Floor`
- `Carpet`
- `plants`
- `WallsPaper`
- `corner`
- `Walls`
- `Tools`
- `furniture`
- `Shadows`
- `chairs`
- `some ons on table`

## Collision

Collision grid is built from non-empty tiles in these layers:

- `WallsPaper`
- `corner`
- `Walls`
- `Tools`
- `furniture`
- `chairs`
- `plants`
- `some ons on table`

## Map Gaps

- Database `OfficeMap.mapData` is not the source for current canvas rendering.
- TMX parsing/rendering is implemented locally in the component; no dedicated map engine/library was confirmed.
