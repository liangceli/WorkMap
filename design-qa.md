# Design QA

- Source visual truth: user-confirmed pixel walker candidate generated from existing Virtual Office layered avatar assets: `Body_1`, `Eyes_Blue`, `Outfit_Braces_Brown`, and `Hairstyle_Short_Brown_Dark`.
- Implementation screenshot: unavailable.
- Intended viewport: shared WorkMap full-page and section loading states.
- State: route/page loading state using `WorkMapLoader`.
- Full-view comparison evidence: blocked because the local Web app cannot build while `workmap/apps/web/lib/api/authApi.ts` contains NUL/invalid characters.
- Focused region comparison evidence: blocked for the same reason. Source-level checks verified the asset paths and animation frame coordinates, but no rendered browser screenshot was captured.

## Findings

- No scoped source-level P0/P1/P2 issue found in the loader implementation.
- Visual fidelity remains unverified in browser for final perceived scale, pixel sharpness, timing, and loader placement across full-page vs section loading states.

## Patches Made

- Replaced the rotating `WM` loader mark with a four-layer pixel avatar walker.
- Added CSS animation using the confirmed six down-walk frames from the layered avatar spritesheets.
- Added reduced-motion handling that disables walking animation.
- Added source regression tests for loader markup, selected assets, animation timing, frame coordinates, and old logo removal.

## Final Result

final result: blocked

Blocker: rendered implementation capture is unavailable until the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption is restored and the Web app can build/run locally.
