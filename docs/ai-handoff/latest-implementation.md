# Latest Implementation Handoff

## 1. Original Task Brief

Replace the current WorkMap virtual-office map with `C:\Users\lilia\WorkMap\workmap2_big_outdoor.tmx`.

Requirements from the user:

- Treat `workmap2_big_outdoor.tmx` as the full current map and replace the project's virtual map.
- Characters only need to move inside the office; the outdoor area does not need to be reachable.
- The TMX `outside` layer is the roof/overlay and should not normally display because it can cover the office.
- Test the map integration after replacement.

Follow-up performance request:

- After the big map replacement, player movement felt visibly laggy.
- Implement the one-step static-map-cache solution so the canvas no longer redraws every static TMX tile on every animation frame.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/apps/web/public/maps/workmap2.tmx` | Replaced the old `50 x 30` virtual-office TMX with the new `100 x 80` big outdoor map and normalized tileset source paths to project-local `tilesets/...` paths. |
| `workmap/apps/web/public/maps/tilesets/modern_exteriors_complete_tileset_32x32.png` | Added the large exterior tileset image required by the new map. |
| `workmap/apps/web/public/maps/tilesets/modern_exteriors_complete_tileset_32x32.tsx` | Added the matching Tiled tileset metadata for the exterior tileset. |
| `workmap/apps/web/public/maps/tilesets/city_builder_32x32.png` | Added the city-builder tileset image referenced by the new map. |
| `workmap/apps/web/public/maps/tilesets/city_builder_32x32.tsx` | Added the matching Tiled tileset metadata for the city-builder tileset. |
| `workmap/packages/shared-types/src/index.ts` | Updated the default virtual-office map manifest to the new `3200 x 2560` map, shifted spawn/rooms/navigation into the office area, added render layers for the new map, and added optional `collision.walkableBounds` validation. |
| `workmap/apps/web/components/office/mockOfficeData.ts` | Registered the new map tileset firstGids/images so the canvas renderer can draw the new outdoor/building tiles. |
| `workmap/apps/web/components/office/OfficeMap.tsx` | Added renderable-layer handling so hidden/non-manifest layers such as `outside` are not drawn, added manifest-driven walkable bounds to block movement outside the office rectangle, and added a static map canvas cache so player movement frames reuse a pre-rendered background instead of redrawing every tile/layer. |
| `workmap/apps/web/lib/office/virtualOfficeMapAdapter.ts` | Added stale default-manifest detection for existing API-backed workspaces and filtered player positions against `walkableBounds`. |
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | When an existing API workspace still returns the old default manifest, the frontend now uses current default rooms/navigation instead of mixing old DB coordinates with the new TMX. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA. |

Pre-existing workspace notes:

- `all sets.tsx`, `artresource.tiled-session`, and root `workmap2_big_outdoor.tmx` were already modified before/while this task started and were not reverted.
- `docs/references/` remains unrelated untracked content and was not modified.
- `workmap/apps/web/tsconfig.tsbuildinfo` was modified by Next build and restored.
- No `.env` content was read or changed.

## 3. Implementation Summary

- Replaced the public virtual-office map at `/maps/workmap2.tmx` with the user's `workmap2_big_outdoor.tmx`.
- Preserved the existing app-facing path `/maps/workmap2.tmx` so current code and DB manifests that point at that path still load a map file.
- Added missing tileset assets for the new exterior/city-builder map content.
- Updated the default map manifest:
  - new map size: `3200 x 2560`
  - tile size: `32`
  - new map version: `2026-06-big-outdoor-v1`
  - safe/default spawn: `x=960`, `y=1345`, `direction=down`
  - office walkable area: `x=800`, `y=800`, `width=1600`, `height=960`
- Shifted existing room and navigation coordinates by the new office placement offset.
- Kept characters constrained to the office via `collision.walkableBounds`.
- Kept normal obstacle collision from existing wall/furniture/chair/plant/table layers.
- Prevented the `outside` layer from rendering by making TMX layers render only when they are visible and listed in manifest `render.layerOrder`.
- Added compatibility for existing DB-backed office maps that still contain the old default manifest version.
- Added static map rendering cache:
  - static TMX layers are drawn once into an offscreen canvas after tileset images load
  - each animation frame crops the current camera viewport from that cache
  - dynamic elements such as local player, remote players, chair hints, destination marker, and labels still draw every frame

## 4. User-Visible Changes

- `/virtual-office` now uses the larger outdoor office map asset.
- The office appears within the larger full map, but player movement is constrained to the office area.
- The `outside` roof layer is not rendered in normal canvas rendering, so it should not cover the office.
- Player movement on the larger map should be much smoother because the canvas no longer redraws the full static map on every frame.
- New owner workspaces created after this change should spawn at `x=960`, `y=1345` inside the office.
- Existing API-backed workspaces with the old default manifest should be coerced to the current default manifest on the frontend to avoid old coordinates being mixed with the new TMX.

## 5. Technical Notes

- The renderer still uses `officeTilesets` rather than parsing TSX files at runtime, so new firstGids had to be registered manually.
- The TMX still contains the hidden `outside` layer (`visible="0"`), but `OfficeMap` now tracks `renderable` per layer and draws only manifest-approved visible layers.
- `collision.walkableBounds` is optional for backward compatibility. Old custom manifests without it remain valid.
- `isPlayerPositionValidForMap()` now rejects positions outside `walkableBounds` when the manifest defines a walkable region. This prevents old saved positions outside the new office area from being restored.
- For existing API maps whose `mapKey` matches the default but whose `mapVersion` is stale, `resolveVirtualOfficeMapConfig()` returns the current default manifest and warning text.
- When a stale default manifest is detected, API rooms/navigation are not used for rendering; current default rooms/navigation are used instead.
- Backend tenant onboarding uses the shared default manifest, so new workspaces should receive the new map size/spawn/rooms. No Prisma schema or migration was added.
- The static map cache is an in-browser `HTMLCanvasElement` sized to the TMX pixel dimensions. For the current `3200 x 2560` map this is acceptable, but very large future maps may need chunked caching.
- The per-frame drawing path now uses `drawStaticMapBackground()` to copy only the visible camera rectangle from the cached map background before drawing avatars and interaction overlays.

## 6. Verification Results

Commands run from `workmap/` unless noted:

- `pnpm --filter @workmap/web typecheck`
  - Passed.
- `pnpm --filter @workmap/api typecheck`
  - Passed.
- `pnpm --filter @workmap/web lint`
  - Passed.
- `pnpm --filter @workmap/api lint`
  - Passed.
- `pnpm --filter @workmap/web build`
  - Passed after the map replacement and again after the static-map-cache follow-up. Next emitted the existing ESLint plugin warning only.
- `pnpm --filter @workmap/api build`
  - Passed.
- `pnpm exec tsx -e "...validateVirtualOfficeMapManifest(...)..."`
  - Passed. Manifest validation returned `ok: true`, no warnings, dimensions `3200 x 2560`, spawn `x=960`, `y=1345`, and walkable bounds `x=800`, `y=800`, `width=1600`, `height=960`.
- `git diff --check`
  - Passed. Git emitted only LF-to-CRLF working-copy warnings for existing files.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/`
  - Passed. No matches found in the changed implementation files or this handoff.
- Local web dev HTTP smoke on port `3000`
  - `GET /virtual-office`: 200
  - `GET /maps/workmap2.tmx`: 200
  - `GET /maps/tilesets/modern_exteriors_complete_tileset_32x32.png`: 200
  - `GET /maps/tilesets/city_builder_32x32.png`: 200
  - The temporary dev server was stopped and port `3000` was released afterward.

Not run:

- Full browser canvas screenshot/pixel QA and FPS profiling were not run because no in-app browser tool was exposed in this session and Playwright was not installed/importable locally.
- API database migration was not run because no schema/migration changed.

## 7. Manual QA Suggestions

- Start web/API locally and open `/virtual-office`.
- Confirm the new big outdoor map renders rather than the old `50 x 30` office map.
- Confirm the office is visible and not covered by the `outside` layer.
- Confirm the player spawns around `x=960`, `y=1345` in the office.
- Confirm WASD/arrow movement works inside the office.
- Confirm movement feels smooth on the new big map and does not stutter while holding a movement key.
- Try walking toward the outdoor area and confirm the player cannot leave the office rectangle.
- Confirm walls, desks, chairs, furniture, plants, and table objects still block movement.
- Confirm double-click auto-walk stays inside reachable office space.
- Confirm chair sit/stand with `E` still works.
- Confirm People panel/contact drawer still render.
- Confirm an existing workspace with old saved position does not restore the player into the old top-left map area.
- Confirm a newly created workspace gets the new default map dimensions and owner spawn.
- Confirm API-backed map/nav/positions plus mock fallback still render.

## 8. Risks / Notes

- Existing database rows still store old `OfficeMap.mapData`; the frontend now handles stale default manifests, but a future DB cleanup/migration may be desirable if all deployed workspaces should persist the new manifest server-side.
- The new TMX has duplicate `firstgid=121424` tilesets (`city_builder` and `complete_tileset`). The renderer maps this range to the complete tileset because that is the last equivalent source in the normalized TMX and matches Tiled's "highest/last firstgid" behavior for this ambiguous case.
- The new exterior tileset image is large, about 10 MB. This increases repository/static asset size.
- The `outside` layer remains in the TMX for Tiled editing but is intentionally not drawn by the runtime renderer.
- Full visual QA is still needed to confirm every outdoor/new tileset tile appears exactly as intended.
- Static map caching should remove the main per-frame tile redraw bottleneck, but QA should still manually check movement smoothness on the target browser/hardware.
- Root Tiled working files remain dirty and should be reviewed separately before commit.

## 9. Docs Update Suggestions

- Update `docs/skills/virtual-office-skill.md` after QA accepts this change to record the new default map size, spawn, and walkable bounds.
- Update `docs/skills/current-status.md` after QA accepts this change to mention the big outdoor virtual-office map replacement.
- Add future map validation tooling that checks TMX dimensions, expected layers, hidden roof/outside layer behavior, firstGid ambiguity, and manifest walkable bounds.

## 10. Input for Next Chat

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
