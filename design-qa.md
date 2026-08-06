# Design QA

## 2026-08-06 Home Product Tabs With Real WorkMap Screens

- Source visual truth: user-provided home product-tab captures at `C:/Users/liangceli/AppData/Local/Temp/codex-clipboard-f11356f2-9a3e-4cce-bab4-bc1ea2ece51f.png` (Work visibility, 1212 x 641) and `C:/Users/liangceli/AppData/Local/Temp/codex-clipboard-2d550ed6-b043-47a3-91e6-d678142ad49e.png` (Reports, 1215 x 544), plus the approved real project route captures under `docs/designs/workmap-product-pages-v1/dashboard.png` and `reports.png`.
- Rendered implementation: `C:/Users/liangceli/WorkMap/.codex_previews/home-product-screenshots/visibility-desktop-final.jpg` and `reports-desktop-correct2.jpg` at a 1600 x 900 CSS viewport (captured as 1585 x 892), plus `visibility-mobile.png` and `reports-mobile.png` at a 390 x 844 CSS viewport (captured as 375 x 812).
- Normalized full-view comparisons: `comparison-visibility-desktop-final.png` (2424 x 641) and `comparison-reports-desktop-correct2.png` (2430 x 544). The implementation crops were normalized to the source aspect and pixel size before horizontal source/implementation composition.
- State: public homepage at `/#product`; Work visibility and Reports selected independently. The Report comparison retains the visible keyboard-focus outline created by the automated tab selection; this is an expected accessible interaction state, not a persistent resting-state border.

### Findings And Fidelity Review

- No actionable P0/P1/P2 mismatch remains. The left copy, tab structure, typography, spacing system, Ink/Jade/Paper palette, and service-panel proportions remain consistent with the supplied source.
- Image fidelity: both abstract right-hand illustrations are replaced by 1600 x 1000 repository project-page captures. Images render at their intrinsic aspect ratio with no stretching, use the real WorkMap shell/components/pixel avatars, and contain only explicitly fictional `Demo workspace` identities such as Mia Manager, Ethan Engineer, and Sofia Sales.
- Responsive layout: desktop retains the existing text/image split. At 390 px the existing tab rail remains intentionally horizontally scrollable, text and features stack above a full-width screenshot, the screenshot stays inside its bordered surface, and no page-level horizontal overflow or clipped CTA was observed.
- Typography and copy: existing font family, optical weights, line heights, headings, service copy, and CTA copy are unchanged. Only image alternative text was added.
- Colors and tokens: no new brand token or gradient was introduced. The screenshot frame uses the existing Ink, border, radius, and elevation language.
- Focused-region comparison was not required because the screenshot panels occupy the majority of the right column in the normalized full-view evidence and their borders, crop, labels, and fictional identities remain readable there.
- Primary interactions tested: Work visibility and Reports tab switching on desktop and mobile. Browser console errors: none. Development-only Next image LCP priority warnings can appear when opening directly at `#product`; they do not affect rendering or production build output.
- Comparison history: the first evidence capture included an inconsistent scroll crop; it was recaptured at the same product-section alignment before comparison. No product P0/P1/P2 fix iteration was required after normalized comparison.

### Final Result

final result: passed

## 2026-07-09 Virtual Office Mobile Chrome Cleanup

- Source visual truth: user-provided `/virtual-office` mobile screenshot showing the top chrome stacked awkwardly, bottom dock wrapping into multiple rows, duplicate controls, and the current-user/status block taking too much vertical space.
- Target behavior: mobile `/virtual-office` should keep the map as the primary surface, hide or collapse secondary desktop chrome, and keep controls tidy.
- Implementation screenshot: unavailable.
- Intended viewport: phone-width `/virtual-office` viewport similar to the supplied screenshot.
- State: virtual office loaded, map visible, top workspace/area/status controls visible, bottom dock visible.
- Full-view comparison evidence: blocked because the local Web app cannot build while `workmap/apps/web/lib/api/authApi.ts` contains NUL/invalid characters.
- Focused region comparison evidence: blocked for the same reason. Source-level checks verified the mobile rules that hide left rail, mini map, sync pill, dock identity block, duplicate dock search, Outlook, and disabled 3CX while constraining panels and keeping a compact five-action dock.

### Findings

- No scoped source-level P0/P1/P2 issue found in the mobile chrome cleanup implementation.
- Visual fidelity remains unverified in browser for exact spacing, safe-area behavior, and real touch hit areas.
- Product tradeoff: realtime/sync diagnostic text is hidden on mobile to reduce clutter.

### Patches Made

- Added mobile responsive overrides to stack top controls into clean full-width cards.
- Hid mobile-only secondary chrome: sync pill, left rail, mini map, dock identity block, duplicate dock search, Outlook, and disabled 3CX.
- Converted the mobile bottom dock into a compact single-row five-action bar.
- Bounded side panels, room cards, interaction drawers, command palette, toast, and zoom controls for phone-sized layouts.
- Added source regression coverage for the responsive rules.

### Final Result

final result: blocked

Blocker: rendered implementation capture is unavailable until the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption is restored and the Web app can build/run locally.

---

## 2026-07-11 WorkMap Product Pages Visual System

- Source visual truth: the approved 17-route desktop visual boards under `docs/designs/workmap-product-pages-v1/` and the approved Ink Navy, Signal Jade, Civic Amber system.
- Implementation scope: authenticated app shell, login/callback, invitation/onboarding flows, Dashboard, Employees, Employee Detail, Reports, Compliance, Integrations, Settings, Platform Admin, Virtual Office chrome, and Avatar Debug.
- Intended comparison viewports: 1440x1000 desktop plus 1024px, 768px, 390px, and 360px responsive states.
- Implementation compilation: passed in an isolated QA copy using the valid tracked `authApi.ts`; 19 routes generated.
- Implementation screenshot: unavailable. The in-app Browser security policy rejected the local QA target and prohibited switching to a workaround browser path.

### Source-Level Findings

- No scoped P0/P1/P2 logic or contract regression found. TSX diffs only add styling hooks and one presentation-only grouping wrapper.
- Responsive rules explicitly cover desktop sidebar, tablet navigation, phone horizontal navigation, single-column data/settings/onboarding layouts, scrollable tables, Virtual Office bottom sheets, and reduced motion.
- The new product stylesheet contains no gradients, uses the real Virtual Office panorama asset, and keeps new panel radii at 8px or less.
- Full typecheck, lint, 38/38 tests, and final production build pass in the isolated QA copy.

### Final Result

final result: blocked

Blocker: browser-rendered desktop/mobile comparison could not be captured because the Browser security policy rejected the local target. The source worktree also retains the pre-existing 410-NUL `workmap/apps/web/lib/api/authApi.ts`, which was intentionally not overwritten in this visual-only round.

---

## 2026-07-09 Home Mobile Hero Proof Horizontal Layout

- Source visual truth: user-provided small-screen home-page screenshot showing the hero proof items `Support your team`, `Privacy by design`, and `Clear boundaries` stacked vertically.
- Target behavior: those three proof items should be horizontally arranged on the small-screen home page.
- Implementation screenshot: unavailable.
- Intended viewport: small-screen / mobile home page hero section.
- State: landing page, menu closed, hero proof area visible below the primary/secondary CTAs.
- Full-view comparison evidence: blocked because the local Web app cannot build while `workmap/apps/web/lib/api/authApi.ts` contains NUL/invalid characters.
- Focused region comparison evidence: blocked for the same reason. Source-level checks verified the mobile `.heroProof` override uses a three-column grid and no longer regresses to `grid-template-columns: 1fr`.

## Findings

- No scoped source-level P0/P1/P2 issue found in the hero proof horizontal-layout implementation.
- Visual fidelity remains unverified in browser for exact spacing, text wrapping, and fit at very narrow widths.

## Patches Made

- Changed the mobile `.heroProof` override from one column to three horizontal columns.
- Kept each proof item internally aligned as icon plus text.
- Added regression coverage confirming the small-screen proof items remain horizontal and do not revert to a vertical stack.

## Final Result

final result: blocked

Blocker: rendered implementation capture is unavailable until the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption is restored and the Web app can build/run locally.
