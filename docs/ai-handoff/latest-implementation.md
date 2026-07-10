# Latest Implementation Handoff

## 2026-07-10 Employee Privacy Two-Panel Layout

### Original Task Brief

- Remove the centre privacy-filter box from the Employee Privacy section and rebalance the remaining content into a coordinated layout.

### Changed Files

- `workmap/apps/web/app/page.tsx`
- `workmap/apps/web/app/home.module.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Removed the centre filter illustration and its unused `Check` icon import.
- Rebuilt the privacy comparison as two equal-width, equal-height panels for collected and not-collected signals.
- Added restrained Jade and Coral surface tints while preserving the established Ink Navy section background.
- Kept the employee-control strip aligned below both panels; mobile collapses directly to a single column without an empty intermediary block.

### Verification

- Homepage-scoped TypeScript check: pass.
- Direct homepage ESLint: pass.
- Homepage mobile-menu source tests: pass (`3/3`).
- `git diff --check`: pass.

### Intentionally Not Changed

- Copy, employee-control behaviour, page routing, auth, API, backend, tracking, reports, compliance, and Virtual Office logic.

## 2026-07-10 Homepage Contrast And Spacing Refinement

### Original Task Brief

- Visually separate the final CTA strip from the Footer.
- Increase Hero heading contrast using colours from the approved WorkMap palette.
- Make the Employee Privacy section bottom padding equal its top padding.
- Present real repository pixel-asset candidates for the privacy filter centre, but do not replace it until the user selects one.

### Changed Files

- `workmap/apps/web/app/home.module.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Set the Hero heading to white with the second line in `--jade-light` for explicit, accessible hierarchy on Ink Navy.
- Changed Employee Privacy spacing from `82px 0 34px` to `82px 0`; mobile now uses `68px 0`.
- Added Amber space below the CTA strip and changed it to a complete four-corner surface, so it no longer merges visually with the Ink Navy Footer.
- Extracted four temporary candidate previews directly from `Modern_Office_32x32.png`: server pair, terminal hub, operator desk, and monitor pod. These previews stay outside the repository and no candidate is used in runtime pending user selection.

### Verification

- Homepage mobile-menu source tests: pass (`3/3`).
- `git diff --check`: pass; line-ending warning only.
- Dev server remains available at `http://localhost:3010`.

### Manual QA

- Source and supplied screenshot comparison completed.
- Browser screenshot QA remains unavailable under the current in-app localhost navigation policy.

### Intentionally Not Changed

- Privacy centre artwork, page content, component behaviour, routing, auth, API, backend, tracking, reports, and compliance logic.

### Remaining Risk

- The final privacy centre composition and its responsive sizing remain pending the user's asset selection.

## 2026-07-10 Approved Homepage V4 Frontend Implementation

### Original Task Brief

- Implement the approved V4 homepage design at pixel-level fidelity.
- Use the real full Virtual Office panorama and only repository-derived DIY avatars.
- Keep authentication, routing, API, tracking, reporting, compliance, tenant, and backend behaviour unchanged.

### Changed Files

- `workmap/apps/web/app/page.tsx`
- `workmap/apps/web/app/home.module.css`
- `workmap/apps/web/public/marketing/workmap-virtual-office-panorama.png`
- `workmap/apps/web/public/marketing/avatars/avatar-01.png` through `avatar-08.png`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Rebuilt the public homepage around the approved Ink Navy, Signal Jade, and Civic Amber system.
- Added the split Hero with the exact `1904 x 949` real Virtual Office panorama, preserved sign-in/create-account destinations, and retained single-page anchor navigation.
- Added real interactive service tabs for Work visibility, Reports, and Virtual Office without fabricated metrics or dashboard data.
- Added the Web/pairing/Desktop Agent/Browser Extension/recovery/reports flow, using eight avatars assembled from existing DIY layer sheets.
- Added employee-facing collected/not-collected boundaries, visible-control statements, sticky/scrollable desktop FAQ, mobile accordion, consent CTA, footer, section reveal motion, hover/press/focus states, and reduced-motion support.
- Restored the existing mobile-menu DOM contract (`home-mobile-navigation`, `Login`, `Get started`) after its source tests identified a compatibility regression.

### Role And Access Behaviour

- Existing `/login?mode=signin`, `/login?mode=signup`, `/reports`, `/virtual-office`, and `/compliance` destinations are unchanged.
- No authentication, RBAC, tenant, data-fetching, report calculation, compliance calculation, realtime, API, schema, or tracking logic changed.

### Verification

- Homepage-scoped TypeScript check: pass.
- Direct ESLint check for `app/page.tsx`: pass.
- Mobile-menu homepage source tests: pass (`3/3`).
- Full Web test run before the compatibility fix: `31/35` passed; all three homepage source failures were then fixed and passed in the targeted rerun. The remaining unrelated test transform failure is caused by the pre-existing NUL-filled `workmap/apps/web/lib/api/authApi.ts`.
- Full Web typecheck/lint/build: blocked by the same pre-existing `authApi.ts` invalid-character corruption; this file was not modified because it is outside the approved visual scope.
- Marketing assets: panorama `1904 x 949`; eight avatar files `64 x 96`; all non-empty.
- `git diff --check`: pass; line-ending warnings only.
- Scoped secret and machine-path scan: pass.
- Dev server: ready at `http://localhost:3010` in 7.5 seconds.

### Manual QA

- Browser visual/responsive QA was not completed because the in-app browser policy rejected local URL navigation. No alternate browser or raw-navigation workaround was attempted.

### Intentionally Not Changed

- Backend, auth implementation, API contracts, schemas, routing behaviour, tracking, reports, compliance, Virtual Office behaviour, and authenticated application styling.

### Remaining Risks

- Desktop/mobile browser rendering still needs visual inspection once local browser navigation is permitted.
- Repository-wide Web verification cannot pass until the existing `authApi.ts` NUL corruption is resolved under a separate, explicitly approved code-recovery action.

### Suggested Next Step

- Resolve the corrupted `authApi.ts` working-tree file without overwriting intentional user work, then rerun full Web typecheck/lint/test/build and consolidated visual QA.

## 2026-07-10 Homepage Hero Panorama V4

### Original Task Brief

- Keep the approved V3 homepage unchanged except for the Hero Virtual Office media.
- Replace the cropped/incorrect Hero screenshot with the supplied real full panorama, preserving its labels, UI positions, characters, and complete map view.

### Changed Files

- `docs/designs/workmap-virtual-office-panorama.png`
- `docs/designs/workmap-home-services-privacy-desktop-v4.png`
- `docs/designs/workmap-home-services-privacy-mobile-v4.png`
- `docs/designs/workmap-home-services-privacy-v4-spec.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Copied the supplied `1904 x 949` real Virtual Office panorama into the repository without reconstruction.
- Replaced only the desktop Hero media area; all non-Hero pixels remain inherited from V3.
- Increased only the mobile Hero height, inserted the full panorama at its original aspect ratio, and shifted every later section down unchanged.
- V4 forbids cropping, stretching, relabelling, UI rearrangement, or AI-redrawing of the Hero bitmap.
- No application runtime, routing, authentication, API, schema, tracking, or component code changed.

### Verification

- Source panorama: `1904x949`, non-empty.
- Desktop V4 PNG: `785x2003`, non-empty and visually inspected.
- Mobile V4 PNG: `749x2262`, non-empty and visually inspected.
- Exact source bitmap used for Hero media; internal screenshot text and controls were not regenerated.
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.

### Remaining Risks

- Full-panorama text is naturally smaller on mobile. V4 preserves geometry and source pixels rather than inventing a mobile rearrangement of the product UI.

### Suggested Next Step

- Review only the V4 Hero media placement; all other V3 sections are intentionally unchanged.

## 2026-07-10 Services Homepage Visual V3 Corrections

### Original Task Brief

- Move FAQ before Consent/CTA, equalize FAQ typography, and make the question pane scroll while the left panel stays fixed.
- Replace the repeated generated character with varied avatars assembled from the repository's real DIY layers.
- Clarify the Web/pairing/two-Agent/recovery/report flow and remove misplaced avatars.
- Turn the four Work Visibility benefits into a `2 x 2` layout to remove empty space.

### Changed Files

- `docs/designs/workmap-home-services-privacy-desktop-v3.png`
- `docs/designs/workmap-home-services-privacy-mobile-v3.png`
- `docs/designs/workmap-home-services-privacy-v3-spec.md`
- `docs/designs/workmap-avatar-combinations-reference.png`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Reordered the page to Employee Privacy, FAQ, Consent/CTA, then Footer.
- Defined a desktop FAQ with equal `22px` primary typography, sticky left content, a scrollable right accordion, and normal scroll chaining after the final question. Mobile uses a single column without an inner scroll pane.
- Built an exact reference sheet of eight distinct avatars from repository DIY body, eyes, outfit, and hairstyle layers; V3 assigns different avatars to meaningful roles without placing them on connector lines.
- Reworked the flow into one directed path with only Desktop Agent and Browser Extension as a parallel branch.
- Rebalanced Work Visibility into a `2 x 2` feature grid aligned with the signal ledger.
- No application runtime, routing, auth, API, schema, tracking, or component code changed.

### Verification

- Desktop V3 PNG: `785x2003`, non-empty.
- Mobile V3 PNG: `749x2100`, non-empty.
- DIY avatar reference: `912x176`, non-empty and visually inspected.
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.
- Browser implementation QA was not run because this remains a visual-design round.

### Remaining Risks

- Generated microcopy may be visually distorted; the V3 specification is authoritative. The final desktop revision also reduces the left FAQ primary line and enlarges right questions so both use the same visual scale.
- Reports and additional Virtual Office interaction screenshots still require capture from the real authenticated product.

### Suggested Next Step

- Obtain user approval or marked-up revisions on V3 before frontend implementation.

## 2026-07-10 Services and Employee Privacy Homepage Visual V2

### Original Task Brief

- Redesign the homepage around a split Hero with the real Virtual Office, a three-tab services theatre, WorkMap Web/Desktop Agent/Browser Extension flow, employee-facing privacy boundaries, consent, sticky FAQ, and footer.
- Keep copy short, use only repository pixel assets, avoid fictional product UI, and provide desktop/mobile compositions for later pixel-accurate implementation.

### Changed Files

- `docs/designs/workmap-home-services-privacy-desktop-v2.png`
- `docs/designs/workmap-home-services-privacy-mobile-v2.png`
- `docs/designs/workmap-home-services-privacy-v2-spec.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Produced complete desktop and mobile visual references using the approved Ink Navy, Signal Jade, and Civic Amber direction.
- Added exact copy, real asset paths, tab states, FAQ answers, sticky-scroll behaviour, section motion, hover/press/focus feedback, reduced-motion rules, and responsive acceptance criteria.
- Reports and additional Virtual Office interaction screenshots remain subject to a real-capture requirement; no fictional report data or extra product screenshots were introduced.
- No application runtime, routing, auth, API, schema, tracking, or component code changed.

### Product Truth Note

- Current code records policy acknowledgement but does not enforce acknowledgement as a gate before pairing or ingestion. The V2 specification uses `The monitoring policy can be reviewed and acknowledged` until a separately approved functional change exists.

### Manual QA

- Desktop and mobile artifacts were inspected for complete-page hierarchy and content order.
- Implemented browser/responsive QA was not run because this remains a design-only round.

### Verification

- Desktop PNG: `748x2103`, non-empty.
- Mobile composition PNG: `756x2081`, non-empty.
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.

### Remaining Risks

- Generated microcopy and FAQ indexes may contain visual distortion. The V2 specification is authoritative.
- Real authenticated Reports and wave/busy/avatar-builder screenshots are not available in the repository and must be captured from the running product before use.

### Suggested Next Step

- Obtain user approval or marked-up revisions on V2, then implement the approved presentation without changing product logic.

## 2026-07-10 Desktop Agent 0.5.7 Windows File-Lock Recovery

### Original Task Brief

- Implement Desktop Agent 0.5.7 after the employee PC showed `EPERM: operation not permitted, rename ...status.json.tmp -> status.json` on the morning after restart.
- Prioritize functional continuity: status-file failures must not stop app sampling, heartbeats, queued uploads, or restart recovery.
- Package a Windows installer suitable for a GitHub Release.

### Changed Files

- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/src/pairing.ts`
- `workmap/apps/desktop-agent/src/fileStore.ts`
- `workmap/apps/desktop-agent/src/runtime.ts`
- `workmap/apps/desktop-agent/src/electron/main.ts`
- `workmap/apps/desktop-agent/test/file-store.test.ts`
- `workmap/apps/desktop-agent/test/queue-api.test.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- Generated release artifact: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.7.exe`

### Implementation Summary

- Bumped the package and device-reported agent version to `0.5.7` / `desktop-agent-windows/0.5.7`.
- Replaced the shared fixed `status.json.tmp` path with a unique process/time/UUID temporary file for every atomic JSON write. This removes collisions when sampling and heartbeat paths update local JSON concurrently.
- Added bounded retries for transient Windows file errors (`EPERM`, `EACCES`, `EBUSY`, `ENOENT`) and best-effort temporary-file cleanup.
- Made `status.json` diagnostic writes non-fatal. Even if Windows keeps the local UI status file locked, the runtime continues foreground sampling, heartbeat submission, session recovery, and queue uploads.
- On packaged-app startup, removes the old current-user Run-key entry and stops narrowly matched legacy Node/script agent processes so an upgraded install does not leave the old harness competing for local files or sending duplicate activity.
- The cleanup PowerShell process excludes both the Electron PID and its own PowerShell PID, and has a five-second timeout.

### Role And Access Behavior

- No auth, RBAC, API, schema, tenant-isolation, credential, or ownership behavior changed.
- Existing device-scoped credential behavior remains in force: the installed agent continues to submit only for its paired WorkMap employee/device identity.

### Verification And Manual QA

- `pnpm.CMD --filter @workmap/desktop-agent typecheck` — pass.
- `pnpm.CMD --filter @workmap/desktop-agent test` — pass, 28/28 tests.
- `pnpm.CMD --filter @workmap/desktop-agent build` — pass.
- `npm.cmd run release:windows` — pass; NSIS x64 installer generated.
- Installer size: 91,939,576 bytes.
- Installer SHA-256: `587C90996C124015AAF51BCF706ABD10FCA9879E2E9ED96F48899C6A6418D9C3`.
- Manual install/reboot QA on a second Windows employee PC was not run in this coding environment.

### Intentionally Not Changed

- No owner web-page display, API endpoint, report aggregation, browser extension, deployment, or database changes.
- No change to app/domain privacy collection boundaries.
- No claim that an automated test substitutes for a real overnight Windows shutdown/sign-in test.

### Remaining Risks And Suggested Next Step

- Before broad rollout, install 0.5.7 over 0.5.6 on the affected employee PC and perform a real shutdown/sign-in test. Confirm one WorkMap tray entry, a fresh `/devices.lastSeenAt`, and new app usage in the owner report.
- The generated installer is not confirmed to carry a trusted public code-signing certificate; Windows may still show publisher/SmartScreen warnings.
- Next round can proceed to employee-PC acceptance testing and GitHub Release publication.

## 2026-07-09 Virtual Office Mobile Chrome Cleanup

- Original task: user reported that `/virtual-office` on mobile is visually messy and requested a clean responsive layout where secondary controls collapse or hide when appropriate.
- Changed files:
  - `workmap/apps/web/components/office/VirtualOfficeTopBar.tsx`
  - `workmap/apps/web/components/office/OfficeBottomDock.tsx`
  - `workmap/apps/web/test/virtual-office-mobile-chrome-source.test.ts`
  - `design-qa.md`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Implementation summary:
  - Added mobile-only chrome overrides at `max-width: 640px` for the virtual office shell.
  - Top mobile layout now stacks the workspace pill, area selector, and status/search strip into compact full-width cards.
  - The brand caption, realtime/sync pill, left rail, and mini map are hidden on mobile to keep the map area clean.
  - Search text and the status divider collapse on mobile while keeping the search button, current virtual-map status, and current-user avatar accessible.
  - The map zoom controls shrink and move above the mobile dock.
  - Side panel, room card, interaction drawer, command palette, and toast receive bounded mobile sizing so they behave like bottom sheets or contained overlays instead of spilling across the viewport.
  - Bottom dock now becomes a single compact 5-action row on mobile. It hides the large identity/status block, divider, duplicate dock search, Outlook, and disabled 3CX entry while retaining Status, Wave, Emote, Notes/People, and Schedule.
  - Added source-level regression tests for the mobile chrome hiding/stacking rules, compact dock rules, and bounded mobile panel sizing.
- Role/access behavior:
  - No Owner / Employee / Platform Admin access behavior changed.
  - No auth, API, schema, reports, agent, browser extension, tenant isolation, or virtual-office data logic changed.
  - Existing role-aware `/virtual-office` menu item filtering remains unchanged.
- Verification commands and results:
  - `..\..\node_modules\.bin\tsx.CMD --test test\virtual-office-mobile-chrome-source.test.ts` from `workmap/apps/web`: passed 3/3.
  - `..\..\node_modules\.bin\eslint.CMD components\office\VirtualOfficeTopBar.tsx components\office\OfficeBottomDock.tsx test\virtual-office-mobile-chrome-source.test.ts` from `workmap/apps/web`: passed.
  - `..\..\node_modules\.bin\tsc.CMD --noEmit` from `workmap/apps/web`: blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption.
  - `..\..\node_modules\.bin\eslint.CMD .` from `workmap/apps/web`: blocked by the same pre-existing `authApi.ts` parse failure.
  - `.\node_modules\.bin\next.CMD build` from `workmap/apps/web`: blocked by the same pre-existing `authApi.ts` parse failure.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no matches found.
  - Attempted `pnpm.cmd --filter @workmap/web ...` was blocked because the runtime tried to run `pnpm install` and fetch registry metadata under restricted network; local `tsx/tsc/eslint/next` binaries were used instead.
- Manual QA results:
  - Not run in a browser. Rendered mobile QA is blocked until the pre-existing corrupted `authApi.ts` file is restored and the Web app can build/run locally.
- Intentionally not changed:
  - No map canvas rendering, movement, realtime presence, room/person data, auth, route access, backend, Desktop Agent, Browser Extension, or homepage code was changed in this round.
  - Existing uncommitted homepage mobile-menu and hero-proof changes from earlier rounds were preserved.
- Remaining risks:
  - Source-level tests verify the intended responsive rules, but exact mobile pixel fit still needs browser visual QA at the screenshot-sized viewport after the Web build blocker is fixed.
  - Hiding sync/realtime text on mobile reduces visible diagnostic information; this is intentional for cleanliness but should be validated against product needs.
- Suggested next steps:
  - Restore `workmap/apps/web/lib/api/authApi.ts`, rerun full Web typecheck/lint/build, then open `/virtual-office` on a phone-width viewport and verify the top chrome, bottom dock, zoom controls, and overlays against the supplied screenshot.

---

## 2026-07-09 Home Mobile Hero Proof Horizontal Layout

- Original task: user reported that on the home page small-screen view, the three hero proof items `Support your team`, `Privacy by design`, and `Clear boundaries` are stacked vertically and requested these three lines/items to be displayed horizontally.
- Changed files:
  - `workmap/apps/web/app/home.module.css`
  - `workmap/apps/web/test/home-mobile-menu-source.test.ts`
  - `design-qa.md`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Implementation summary:
  - Changed the mobile `@media (max-width: 820px)` `.heroProof` override from a single-column stack to `repeat(3, minmax(0, 1fr))`.
  - Kept each proof item internally aligned as icon + text through `grid-template-columns: 22px minmax(0, 1fr)`.
  - Reduced the mobile proof row gap to keep all three items fitting horizontally in the small-screen hero area.
  - Added source/CSS regression coverage so the mobile override does not regress back to `grid-template-columns: 1fr`.
- Role/access behavior:
  - No Owner / Employee / Platform Admin behavior changed.
  - No auth, backend, API, schema, reports, virtual office, Desktop Agent, Browser Extension, deployment, or tenant isolation behavior changed.
- Verification commands and results:
  - `..\..\node_modules\.bin\tsx.CMD --test test\home-mobile-menu-source.test.ts` from `workmap/apps/web`: passed 3/3.
  - `..\..\node_modules\.bin\eslint.CMD app\page.tsx test\home-mobile-menu-source.test.ts` from `workmap/apps/web`: passed.
  - `npm.cmd run typecheck` from `workmap/apps/web`: blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption.
  - `npm.cmd run build` from `workmap/apps/web`: blocked by the same pre-existing `authApi.ts` parse failure.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no new secret found; matches were existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`.
- Manual QA results:
  - Not run in a browser. Rendered visual QA is blocked until the pre-existing `authApi.ts` corruption is restored and the Web app can build/run locally.
- Intentionally not changed:
  - No hero copy, buttons, landing-page desktop layout, mobile menu behavior, backend/API, auth, RBAC, schema, or tracking code changed.
  - Existing uncommitted homepage mobile-menu changes from the previous round were preserved.
- Remaining risks:
  - Source/CSS verifies horizontal layout intent, but real pixel fit at very narrow widths still needs browser visual QA after `authApi.ts` is repaired.
- Suggested next steps:
  - Restore `workmap/apps/web/lib/api/authApi.ts`, rerun full Web checks, then inspect the home page at the screenshot-sized mobile viewport to confirm the three proof items sit in one horizontal row.

---

## 2026-07-09 Home Mobile Menu Redesign

- Original task: user reported the small-screen opened home-page menu layout is poor and requested a Gather-style mobile menu like the provided reference screenshot: brand at top left, compact close button at top right, left-aligned vertical navigation items, and Login / Get started actions near the bottom of the menu card.
- Changed files:
  - `workmap/apps/web/app/page.tsx`
  - `workmap/apps/web/app/home.module.css`
  - `workmap/apps/web/test/home-mobile-menu-source.test.ts`
  - `design-qa.md`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Implementation summary:
  - Added an explicit open-state class to the home header so the card-style mobile treatment applies only while the menu is open.
  - Added `aria-controls` and a stable `home-mobile-navigation` id for the mobile navigation toggle relationship.
  - Kept the existing Product / Privacy / How it works / Company destinations, but changed the mobile-open layout from a centered/narrow stack with dividers to a full-width, left-aligned vertical list inside the top card.
  - Added mobile-only `Login` and `Get started` actions inside the opened menu, matching the reference structure while preserving the existing desktop header actions.
  - Styled the open mobile card with a white background, thin border, rounded corners, compact close button, left-aligned grey menu items, and a blue primary CTA.
  - Added a source-level regression test so the mobile menu keeps the open-state class, navigation id, account actions, left-aligned/stretch layout, and primary CTA hook.
- Role/access behavior:
  - No Owner / Employee / Platform Admin access behavior changed.
  - No auth, route guard, backend, schema, API, tenant isolation, Desktop Agent, or Browser Extension behavior changed.
- Verification commands and results:
  - `..\..\node_modules\.bin\tsx.CMD --test test\home-mobile-menu-source.test.ts` from `workmap/apps/web`: passed 2/2.
  - `..\..\node_modules\.bin\eslint.CMD app\page.tsx test\home-mobile-menu-source.test.ts` from `workmap/apps/web`: passed.
  - `node --check workmap/apps/web/app/page.tsx`: not applicable because Node cannot parse `.tsx` directly (`ERR_UNKNOWN_FILE_EXTENSION`).
  - `npm.cmd run typecheck` from `workmap/apps/web`: blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption.
  - `npm.cmd run build` from `workmap/apps/web`: blocked by the same pre-existing `authApi.ts` parse failure.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no new secret found; matches were existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`.
- Manual QA results:
  - Not run in a browser. Rendered Product Design visual QA is blocked until the pre-existing `authApi.ts` corruption is restored and the Web app can build/run locally.
- Intentionally not changed:
  - No Desktop Agent, Browser Extension, API, reports, employees, dashboard, virtual-office, auth, schema, RBAC, deployment, or company/employee isolation code changed.
  - The desktop navigation layout and existing desktop Login / Get started actions were preserved.
- Remaining risks:
  - The source and CSS structure are verified, but final pixel spacing still needs a real small-screen browser check after the existing Web build blocker is fixed.
  - If the desired reference should replace the whole mobile header even while the menu is closed, that would be a separate visual decision; this round scopes the redesign to the opened menu state shown in the screenshot.
- Suggested next steps:
  - Restore `workmap/apps/web/lib/api/authApi.ts`, rerun full Web typecheck/lint/build, then open the home page at a small viewport and visually verify the opened menu against the provided reference.

---

## 2026-07-09 Browser Extension 0.4.2 Pairing Feedback Fix

- Original task: user reported that Edge Browser Extension `Pair extension` click had no visible feedback; DevTools showed no `/device-client/pair` network request after clicking.
- Changed files:
  - `workmap/apps/browser-extension/package.json`
  - `workmap/apps/browser-extension/manifest.json`
  - `workmap/apps/browser-extension/options.css`
  - `workmap/apps/browser-extension/src/options.ts`
  - `workmap/apps/browser-extension/src/contentRegistration.ts`
  - `workmap/apps/browser-extension/src/extensionApi.ts`
  - `workmap/apps/browser-extension/test/service-worker.test.ts`
  - `workmap/apps/browser-extension/alpha-unpacked/manifest.json`
  - `workmap/apps/browser-extension/alpha-unpacked/options.css`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Generated artifact:
  - `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.4.2.zip`
  - Size: `14,498` bytes.
  - SHA-256: `80190D61C900DC3A26D2DE5BB78F00BF72F6E5C6B88980B2909AC79F63CD1F61`.
- Implementation summary:
  - Bumped Browser Extension identity to `0.4.2` in package, manifest, pairing heartbeat, and generated unpacked manifest.
  - Options page now immediately changes the button label and visible status/message after click: requesting Edge permission, registering the WorkMap tracker, then pairing with the WorkMap API.
  - Added timeout handling around the Edge website permission request so a stuck/hidden browser permission prompt becomes a visible actionable error instead of appearing as a dead button.
  - Added timeout handling around content-script permission checks, content-script registration/update, tab listing, and existing-tab injection. Existing-tab injection failures/timeouts are settled instead of hanging pairing forever.
  - API pairing/heartbeat errors now include a short sanitized response-body detail, so expired/wrong pairing-code responses are visible to the employee instead of only `returned 4xx`.
- Role/access behavior:
  - No Owner/Employee/Platform Admin permission behavior changed.
  - Browser Extension pairing still binds to the employee account that generated the one-time Browser Extension code through existing backend device-client pairing.
  - Domain tracking privacy boundaries remain unchanged: hostnames/timing/activity occurrence only, no full URLs, content, titles, input values, screenshots, clipboard, camera, microphone, or private messages.
- Verification commands and results:
  - `npm.cmd run typecheck` from `workmap/apps/browser-extension`: passed.
  - `npm.cmd test` from `workmap/apps/browser-extension`: passed 15/15.
  - `npm.cmd run lint` from `workmap/apps/browser-extension`: passed.
  - `npm.cmd run build` from `workmap/apps/browser-extension`: passed and regenerated `alpha-unpacked`.
  - `Compress-Archive ... WorkMap-Browser-Extension-0.4.2.zip`: passed.
  - `Get-FileHash artifacts\browser-extension\WorkMap-Browser-Extension-0.4.2.zip -Algorithm SHA256`: passed, hash listed above.
  - `git diff --check`: passed with existing LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference paths found only existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`; no new secret was introduced.
- Manual QA results: not run in the real employee Edge browser after packaging. The user-provided screenshot/DevTools evidence was used to reproduce the likely pre-API hang path from source.
- Intentionally not changed:
  - No Desktop Agent, API service, Web reports/employees/dashboard pages, Prisma schema/migration, Cognito/auth, RBAC, or tenant isolation code changed.
  - No domain timing algorithm, event payload, or browser permission scope expansion changed.
  - No Edge/Chrome store packaging was added; this remains a load-unpacked ZIP workflow.
- Remaining risks:
  - Real Edge acceptance still requires loading `0.4.2`, generating a fresh Browser Extension code from the correct employee account, confirming the Options page progresses past permission/registration/API pairing, and confirming `/devices` shows `browser-extension-mv3/0.4.2` with a fresh `lastSeenAt`.
  - If Edge itself suppresses or blocks the optional host-permission prompt, `0.4.2` should now surface a timeout/error, but the employee may still need to enable site access in `edge://extensions`.
- Suggested next steps: upload `WorkMap-Browser-Extension-0.4.2.zip` to a GitHub Release, update `NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL` in Vercel to that asset URL, redeploy Web, then install/pair on the employee Edge profile and verify Owner `/devices` plus Reports domain usage.

---

## 2026-07-09 Desktop Agent 0.5.6 Release Installer Packaging

- Original task: package Desktop Agent `0.5.6` so the user can upload the installer to GitHub Releases.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`. The installer artifact was generated under `workmap/artifacts/desktop-agent/` and is ignored by git.
- Generated artifact:
  - `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.6.exe`
  - Size: `91,938,656` bytes.
  - SHA-256: `8295AC37ED777C18AF84F83251A76064EA4AEB8193C49CE037D1899ED1CA2766`.
  - Authenticode status: `NotSigned`.
  - Blockmap also generated: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.6.exe.blockmap`.
- Implementation summary: ran the Desktop Agent `release:windows` script for the already-implemented `0.5.6` code. The command regenerated the app icon, ran TypeScript compilation, packaged the Electron app for Windows x64, and built the NSIS one-click current-user installer.
- Verification commands and results:
  - `npm.cmd run release:windows` from `workmap/apps/desktop-agent`: first attempt reached packaging but failed when electron-builder needed network access from the sandbox.
  - `npm.cmd run release:windows` rerun with approved network escalation: passed and produced `WorkMap-Desktop-Agent-Setup-0.5.6.exe`.
  - `Get-FileHash artifacts\desktop-agent\WorkMap-Desktop-Agent-Setup-0.5.6.exe -Algorithm SHA256`: passed, hash listed above.
  - `Get-AuthenticodeSignature artifacts\desktop-agent\WorkMap-Desktop-Agent-Setup-0.5.6.exe`: passed, status `NotSigned`.
- Manual QA results: installer was not installed on the employee Windows computer in this round.
- Intentionally not changed: no source code logic, API, Web, Browser Extension, schema, RBAC, deployment config, or git-tracked release metadata changed during packaging.
- Remaining risks: the installer is unsigned, so Windows SmartScreen/security prompts may appear. Real acceptance still requires installing this exact `0.5.6` file under the employee's actual Windows account and confirming reboot/sleep/network recovery.
- Suggested next steps: upload `WorkMap-Desktop-Agent-Setup-0.5.6.exe` to the GitHub Release, then install it on the employee PC and run the manual acceptance matrix from the previous handoff.

---

## 2026-07-09 Desktop Agent 0.5.6 Functional Reliability Fix

- Original task: implement and review the concrete Desktop Agent `0.5.6` fixes only. Do not include Owner-page readability/status-display work. The required behavior is functional: after an employee computer is shut down overnight and restarted, the Desktop Agent must wake, heartbeat, track foreground app usage, upload usage for the bound employee only, and preserve employee/company data isolation for multiple employees and future companies.
- Changed files:
  - `workmap/apps/desktop-agent/package.json`
  - `workmap/apps/desktop-agent/src/apiClient.ts`
  - `workmap/apps/desktop-agent/src/runtime.ts`
  - `workmap/apps/desktop-agent/src/pairing.ts`
  - `workmap/apps/desktop-agent/test/gui-release.test.ts`
  - `workmap/apps/desktop-agent/test/queue-api.test.ts`
  - `workmap/apps/api/test/device-pairing.test.ts`
  - `workmap/apps/api/test/tracking-reports-verification.test.ts`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Implementation summary:
  - Bumped Desktop Agent identity to `0.5.6` (`package.json` version and `desktop-agent-windows/0.5.6` pairing/heartbeat agent version).
  - Decoupled the runtime heartbeat/upload path from foreground sampling. If the Windows foreground sampler fails after reboot/wake, the loop now still sends heartbeat and flushes queued events instead of skipping all API communication for that iteration.
  - Added stale/inactive agent-session recovery. If heartbeat receives backend `403` with `Agent session is not active for this device.`, the Agent clears the old `sessionId`, starts a new session, and retries heartbeat once without requiring re-pairing.
  - Added limited retries for runtime API calls (`session/start`, `heartbeat`, `app-usage`, `session/stop`) on network failures or 5xx responses. Pairing-code exchange intentionally does not use those runtime retries, because pairing codes are one-time credentials and retrying a timed-out successful exchange could consume the code without recovering the credential.
  - API error handling now reads sanitized response-body messages, so the runtime can distinguish recoverable stale-session `403` from real credential/device authorization failures.
  - Added backend regression coverage that `device-client` uploads are bound to the credential's `companyId`, `userId`, `deviceId`, and `clientType`; a client-supplied/spoofed `deviceId` is overwritten before activity ingestion.
  - Strengthened activity/report regression setup by seeding an existing other-company device before asserting same employee context cannot upload usage to it.
- Functional behavior by scenario:
  - Employee PC reboot after a night offline: the installed per-user Agent starts at Windows login through existing Electron `openAtLogin`, starts a fresh session if needed, heartbeats even before/while sampler recovery is unstable, and uploads any durable queued events when the API is reachable.
  - Sampler failure after wake: Owner-side `/devices.lastSeenAt` can still refresh because heartbeat is no longer blocked by `WindowsForegroundAdapter.sample()` throwing.
  - Stale server session after restart/wake: Agent no longer stops as `auth_required`; it creates a new backend AgentSession and continues.
  - Multiple employees on different computers: app usage sent through `/device-client/app-usage` is stored under the employee and company resolved from the device credential, not from client-provided user/company/device fields.
  - Future multiple companies: credential resolution and activity ingestion still require the credential device to match the same `companyId` and `userId`; cross-company device ids are rejected.
- Role/access behavior:
  - No Owner/Employee/Platform Admin frontend role surface changed.
  - No report permission, RBAC, auth, schema, Prisma migration, or tenant-membership model changed.
  - The existing backend credential context remains authoritative for Desktop Agent uploads.
- Verification commands and results:
  - `.\node_modules\.bin\prisma.CMD generate`: passed after escalation because the local Prisma Client was missing and the Prisma engine checksum download needed network access.
  - `.\node_modules\.bin\tsc.CMD --noEmit -p apps\desktop-agent\tsconfig.json`: passed.
  - `.\node_modules\.bin\tsc.CMD --noEmit -p apps\api\tsconfig.json`: passed after Prisma Client generation.
  - `..\..\node_modules\.bin\eslint.CMD .` from `workmap/apps/desktop-agent`: passed.
  - `..\..\node_modules\.bin\eslint.CMD .` from `workmap/apps/api`: passed.
  - `npm.cmd test` from `workmap/apps/desktop-agent`: passed 25/25.
  - `npm.cmd test` from `workmap/apps/api`: passed 10/10.
  - `npm.cmd run build` from `workmap/apps/desktop-agent`: passed.
  - `npm.cmd run build` from `workmap/apps/api`: passed.
  - `git diff --check`: passed with CRLF working-copy warnings only.
  - High-confidence secret scan excluding env, generated, node_modules, dist, tsbuildinfo, and reference directories: no matches.
  - Initial `pnpm.cmd --filter ...` verification attempts were blocked by the known pnpm non-interactive modules purge plus registry fetch issue; equivalent local package commands above were run instead.
- Manual QA results: not run on the separate employee Windows computer. Required release acceptance remains: install the packaged `0.5.6` on the employee Windows account, reboot after shutdown, confirm `/devices` lastSeen refreshes shortly after login, confirm Owner reports receive fresh foreground app usage, then repeat after sleep/wake and network disconnect/reconnect.
- Intentionally not changed:
  - No Owner website status-display/readability work was included.
  - No Browser Extension code changed.
  - No screenshots, window titles, full URLs, keystrokes, clipboard, camera, microphone, file content, or message-content collection added.
  - No backend schema/migration or frontend page behavior changed.
  - Existing unrelated Web loader files already dirty in the worktree were preserved and not included in this implementation scope.
- Remaining risks:
  - The real employee-machine defect is not fully accepted until the new `0.5.6` binary is packaged, installed for the correct Windows user, and tested through a real reboot/sleep-wake cycle against the deployed Render API.
  - If Windows blocks the foreground sampler permanently, `0.5.6` will still heartbeat and upload queued events, but new foreground-app usage cannot be created until the sampler succeeds again.
  - Existing per-user Windows autostart is preserved; if the Agent was installed/paired under a different Windows profile, that separate operational issue still requires pairing/installing under the employee's actual Windows login.
- Suggested next steps: package the Desktop Agent `0.5.6` installer, install it on the employee PC under the paired employee Windows profile, and run the reboot/sleep/network acceptance matrix before declaring the production monitoring issue resolved.

---

## 2026-07-09 Desktop Agent 0.5.6 Scope Proposal

- Original task: carefully define what Desktop Agent `0.5.6` should do, using short concrete scenarios rather than abstract claims, so the next release can satisfy the Owner need without repeated rework.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No Desktop Agent/API/Web product code was changed in this planning round.
- Scope conclusion: `0.5.6` should be a reliability and diagnostics release. Its job is not to add new monitoring types. Its job is to make the existing Desktop Agent reliably answer four practical questions: is the employee computer heartbeating, is app tracking working, is usage queued/uploaded, and if not, what exact action is required.
- Recommended must-have behavior:
  - Heartbeat must run even if foreground app sampling fails. Scenario: PowerShell sampling breaks after wake; Owner still sees the device online, while employee/diagnostics show tracking degraded.
  - Stale/inactive agent sessions must self-recover. Scenario: backend says the old session is not active; Agent clears `sessionId`, starts a new session, and continues without re-pairing.
  - Runtime startup should warm/check API before declaring failure. Scenario: employee opens the laptop after Render/API cold start; Agent waits long enough to wake the API instead of failing the first 10-second heartbeat and looking dead.
  - Usage queue must remain durable and visibly drain. Scenario: employee works offline, then reconnects; queued app usage uploads and the queue count falls to zero.
  - Employee window needs concrete diagnostics. Scenario: employee says "it's open"; Owner asks for Copy diagnostics and sees version, API, device id prefix, last heartbeat, last upload, queue count, sampler state, and last sanitized error.
  - Wrong Windows profile / DPAPI failure must be explicit. Scenario: the installer was run under a different Windows user; Agent says this Windows account is not paired instead of silently showing stale state.
  - Owner-side status should distinguish online-but-not-tracking from disconnected. Scenario: device heartbeat is fresh but app sampler is failing; `/employees` or `/devices` should show "Device online / Tracking error", not "Disconnected".
- Behavior boundaries: no screenshots, window titles, full URLs, keystrokes, clipboard, camera, microphone, file contents, or message contents should be added. Browser domain monitoring remains Browser Extension scope, not Desktop Agent scope.
- Product fit: this scope satisfies the Owner need only if combined with minimal API/Web status display work. A new `.exe` alone can improve heartbeat/recovery/local diagnostics, but Owner-side pages cannot explain sampler/session errors unless the API/Web surface exposes those diagnostics.
- Acceptance checks proposed: install `0.5.6`, reboot Windows, confirm `/devices.lastSeenAt` refreshes within about 30 seconds after login; sleep/wake and confirm refresh; simulate sampler failure and confirm heartbeat continues but tracking shows degraded; simulate stale session and confirm auto-recovery; disconnect/reconnect network and confirm queue drains; revoke device and confirm the Agent clearly shows Pair again.
- Verification commands and results: read-only source review of Desktop Agent runtime, API client, Windows sampler, Electron startup, local credential/status storage, backend device/session/report services, frontend device/report types, and Employees aggregation. No tests were run because no product code changed.
- Manual QA results: not run on the employee Windows computer.
- Intentionally not changed: no Desktop Agent implementation, API contract, schema, Web UI, release package, or deployment was changed.
- Remaining risks: exact implementation effort depends on whether Owner-side diagnostics are included in `0.5.6` or deferred. Agent-only `0.5.6` will not fully solve "why is this employee disconnected" from the Owner website.
- Suggested next steps: confirm this scope, then implement `0.5.6` as a coordinated Desktop Agent + small API/Web diagnostics release rather than only repackaging the `.exe`.

---

## 2026-07-09 Desktop Agent Still Disconnected Diagnostic

- Original task: explain why, after another day, the employee Desktop Agent still appears disconnected and Owner-side WorkMap still cannot get fresh device info or usage duration even though the latest `0.5.5` Desktop Agent was published.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No product code was changed in this diagnostic round.
- Diagnostic summary: the previous `0.5.5` fix was scoped to local truthfulness: it stopped the Agent window from showing stale local `Connected` when there was no fresh server-confirmed heartbeat. It did not prove or guarantee that the underlying heartbeat/upload path would recover after restart, sleep/wake, or a new day.
- Root cause hypothesis from code review: `DesktopAgentRuntime.runLoop()` samples the foreground app before it sends heartbeat. If `WindowsForegroundAdapter.sample()` fails after reboot/wake, PowerShell script failure, timeout, policy/AV interference, or packaged resource issue, the loop jumps to the catch block and never calls `heartbeat()` for that iteration. Persistent sampling failure therefore leaves the tray/app process present while `/devices.lastSeenAt`, report live status, and usage summaries remain stale.
- Secondary risk found: any `401/403` from heartbeat or upload is mapped to `auth_required`. Backend heartbeat can return `403` when the supplied `sessionId` is no longer active. That is potentially recoverable by starting a new session, but the current Agent treats it like an invalid/revoked credential and stops.
- Evidence: `workmap/apps/desktop-agent/src/runtime.ts` lines 51-68 place sampling, tracking, heartbeat, and queue flush in one try block; lines 105-118 only update `lastHeartbeatAt` after successful API heartbeat; lines 147-150 map all heartbeat 401/403 failures to `auth_required`. `workmap/apps/api/src/modules/devices/devices.service.ts` line 137 can throw `ForbiddenException("Agent session is not active for this device.")` for stale session IDs.
- Expected employee-machine evidence: `%LOCALAPPDATA%\WorkMap\DesktopAgent\status.json` should show one of `error`, `offline`, or `auth_required`, plus a sanitized `error` field. If it still shows `connected`, the release installed/running on that Windows user is not the expected `0.5.5` behavior or the UI is reading a fresh-but-not-owner-visible signal for a different bound user/device.
- Role/access behavior: no Owner/Employee RBAC, tenant isolation, backend report permission, pairing ownership, or deployment behavior was changed.
- Verification commands and results: read-only source review of Desktop Agent runtime/API client/Electron startup, device client controller, device service, and previous handoff records. No tests were run because no source code changed.
- Manual QA results: not run on the separate employee Windows computer. Required check: open the employee machine and inspect `%LOCALAPPDATA%\WorkMap\DesktopAgent\status.json`, `config.json` metadata, Agent window status/error line, and `/devices` for the same device id.
- Intentionally not changed: no code fix was implemented yet; existing uncommitted Web loader changes were preserved.
- Remaining risks: until the employee-machine `status.json` is inspected, the exact live branch remains unconfirmed: sampler failure, invalid/revoked credential, stale agent session, network/API timeout, wrong Windows user profile, or not actually running the newly installed build.
- Suggested next steps: implement a Desktop Agent robustness fix that decouples heartbeat from foreground sampling, adds persistent diagnostics/logging, includes API error body text, and recovers stale session IDs by clearing `sessionId` and starting a new session before requiring re-pair.

---

## 2026-07-09 WorkMap Loading Pixel Walker

- Original task: replace the current rotating WorkMap logo loading page with a walking pixel character chosen from the existing Virtual Office avatar assets.
- Changed files: `workmap/apps/web/components/ui/WorkMapLoader.tsx`, `workmap/apps/web/app/globals.css`, `workmap/apps/web/test/workmap-loader-source.test.ts`, `design-qa.md`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Implementation summary: the shared `WorkMapLoader` now renders a layered pixel walker instead of the old `WM` rotating mark. The loader uses the confirmed default avatar layers: `Body_1`, `Eyes_Blue`, `Outfit_Braces_Brown`, and `Hairstyle_Short_Brown_Dark`. CSS animates the existing layered spritesheets through the six calibrated down-walk frames with `steps(6)`.
- Accessibility and motion behavior: the existing `role="status"`, `aria-live`, and `aria-label` behavior remains unchanged. `prefers-reduced-motion: reduce` disables the walking animation and leaves the first frame visible.
- Role/access behavior: no auth, RBAC, tenant isolation, route permission, Virtual Office data loading, Desktop Agent, Browser Extension, report aggregation, or backend behavior changed.
- Verification commands and results: `tsx --test apps/web/test/workmap-loader-source.test.ts` passed 3/3; targeted ESLint on `WorkMapLoader.tsx` and the new source test passed; four referenced sprite assets were confirmed present under `apps/web/public/assets/avatars/layers`; `git diff --check` passed with LF-to-CRLF warnings; scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm.cmd --filter @workmap/web typecheck`, `lint`, and `build` all still fail on the pre-existing NUL/invalid-character corruption in `workmap/apps/web/lib/api/authApi.ts`. This blocker is unrelated to the loader change.
- Manual QA results: browser visual QA was not run because the same `authApi.ts` corruption prevents a local Web build. Product Design `design-qa.md` was updated as blocked for rendered screenshot comparison.
- Intentionally not changed: no new image assets were generated, no sprite sheets were edited, no loading gate timing changed, and no page-specific loader logic was added.
- Remaining risks: the loader animation is source-tested but not visually browser-verified in this checkout. Full deployment confidence requires restoring `authApi.ts`, running full Web checks, and cold-loading pages that use `WorkMapLoader`.
- Suggested next steps: restore `workmap/apps/web/lib/api/authApi.ts`, rerun full Web typecheck/lint/build, then visually confirm `/virtual-office` and a normal route-level loading state show the walking pixel character cleanly.

---

## 2026-07-08 Virtual Office Complete-Render Loading Gate

- Original task: prevent `/virtual-office` from exposing its empty chrome/canvas while the map is still loading; show the same full-page rotating WorkMap logo loader used by other pages until the complete Virtual Office is ready.
- Changed files: `workmap/apps/web/components/office/OfficeMap.tsx`, `workmap/apps/web/components/office/OfficeMiniMap.tsx`, `workmap/apps/web/components/office/useVirtualOfficeData.ts`, `workmap/apps/web/lib/office/virtualOfficeReadiness.ts`, `workmap/apps/web/test/virtual-office-readiness.test.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`. Existing uncommitted role-aware navigation files from the preceding round were preserved.
- Root cause: after route authentication completed, `OfficeMap` rendered the full top bar, rails, controls, empty main canvas, and blank mini map immediately. TMX parsing, tileset images, avatar sprites, and both canvas draws completed asynchronously with no shared initial-render readiness signal.
- Implementation summary: the existing full-page `WorkMapLoader` now covers the mounted Virtual Office until initial API loading is complete, the TMX map is loaded, tileset/avatar assets finish loading, the main canvas draws its first complete scene, and the mini map draws its first complete frame. Cached office data remains available for initialization but no longer marks the fresh API request complete by itself.
- Error behavior: a TMX load failure no longer leaves the loader spinning forever; it shows the existing controlled Virtual Office error card instead of revealing an empty map shell.
- Role/access behavior: no auth, role visibility, RBAC, tenant isolation, or route permission behavior changed in this round.
- Verification: targeted readiness/navigation/reports tests passed 8/8. Targeted ESLint passed for the combined changed Web source/test files. `git diff --check` passed with LF-to-CRLF warnings.
- Verification blocked/limited: full Web typecheck/lint/build remain blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL-byte corruption; the required pnpm command also remains subject to the existing non-interactive modules purge failure.
- Manual QA: not run because the existing `authApi.ts` corruption prevents a local Web build. Required browser check after repair/deploy: enter `/virtual-office` on a cold load and confirm only the rotating Logo loader is visible until the main map, avatars, mini map, and controls appear together.
- Intentionally not changed: no map art, TMX content, movement, collision, realtime, polling cadence, API contract, loading animation styling, or backend behavior changed.
- Remaining risks: a slow or hanging initial API request can keep the loader visible because the current API client has no new timeout in this scoped change. Browser cold-cache QA is still required.
- Suggested next step: restore `authApi.ts`, run full Web checks, then test `/virtual-office` with browser cache disabled and with normal cached assets.

---

## 2026-07-08 Virtual Office Role-Aware Workspace Menu

- Original task: make the `/virtual-office` workspace dropdown show only pages available to the currently signed-in account, matching the role-aware tabs used by the main AppShell; specifically, Employee users must not see Reports.
- Changed files: `workmap/apps/web/lib/navigation/workspaceNavigation.ts`, `workmap/apps/web/components/layout/AppShell.tsx`, `workmap/apps/web/components/office/VirtualOfficeTopBar.tsx`, `workmap/apps/web/components/office/OfficeMap.tsx`, `workmap/apps/web/app/virtual-office/page.tsx`, `workmap/apps/web/test/reports-api.test.ts`, `workmap/apps/web/test/workspace-navigation.test.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Root cause: `VirtualOfficeTopBar.tsx` contained a separate hardcoded list of Dashboard, Reports, Employees, and Compliance routes. It did not read the signed-in user's role and could diverge from AppShell navigation visibility.
- Implementation summary: extracted workspace navigation labels, descriptions, routes, role visibility, and backend-role normalization into `workspaceNavigation.ts`. AppShell and the Virtual Office dropdown now consume the same role matrix. The Virtual Office auth gate passes the backend-confirmed role through `OfficeMap` to the top bar; the cached onboarding role is used only during the existing early-render path until API auth resolves.
- Role/access behavior: Employee sees Employees and Compliance in the Virtual Office dropdown; Manager sees Employees, Dashboard, Reports, and Compliance; Owner additionally sees Invites, Integrations, and Settings; IT Admin sees Employees, Reports, Compliance, Integrations, and Settings. The current `/virtual-office` page is omitted from its own dropdown. This remains frontend navigation visibility; backend RBAC is unchanged and remains authoritative.
- Verification: targeted workspace/reports tests passed 7/7. Targeted ESLint passed for all changed source and test files. `git diff --check` passed with LF-to-CRLF warnings.
- Verification blocked/limited: the required pnpm Web typecheck did not reach the package script because pnpm attempted a workspace install and aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Direct full Web TypeScript parsing, full Web test suite, full ESLint, and Next production build remain blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` file containing only NUL bytes; the full tests reached and passed the navigation assertions before another test imported the corrupted file.
- Manual QA: not run in a browser because the existing `authApi.ts` corruption prevents a local Web build. Required check after repair/deploy: sign in as Employee and confirm the dropdown contains Employees and Compliance but not Dashboard/Reports/admin pages; repeat as Owner/Manager/IT Admin and compare with AppShell tabs.
- Intentionally not changed: no backend authorization, route guards, auth session format, tenant isolation, API, schema, map behavior, or visual styling changed.
- Remaining risks: the local app still cannot complete full Web typecheck/lint/build until `authApi.ts` is restored. Role-aware menu behavior has automated coverage but still needs authenticated browser QA.
- Suggested next step: restore `authApi.ts`, run full Web typecheck/lint/build, then perform Employee and Owner dropdown smoke tests.

---

## 2026-07-08 Virtual Office Offline Movement Animation Fix

- Original task: explain why Sunny can show as `Offline` after leaving the virtual map but still appear to be running, and fix that behavior.
- Changed files: `workmap/apps/web/components/office/presence.ts`, `workmap/apps/web/components/office/useVirtualOfficeData.ts`, `workmap/apps/web/components/office/OfficeMap.tsx`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Root cause: virtual-office freshness logic could convert an old REST position to `offline`, but the same player object still preserved the last persisted `isMoving=true`. Canvas rendering uses `player.isMoving` for bobbing/walking frames, so stale/offline players could keep animating.
- Implementation summary: added `canAnimatePresenceMovement()` so `idle` and `offline` statuses cannot drive movement animation. REST-derived remote players now suppress `isMoving` after freshness normalization, and realtime players are also normalized during render-list merge.
- Behavior change: a remote teammate whose virtual-map status is `Idle` or `Offline` can still show at their last known position, but their avatar no longer uses walking/running animation frames.
- Role/access behavior: no auth, RBAC, tenant isolation, backend API, Desktop Agent, Browser Extension, report aggregation, or persisted position schema changed.
- Verification: targeted ESLint passed for `presence.ts`, `useVirtualOfficeData.ts`, and `OfficeMap.tsx`. TypeScript `transpileModule` syntax check passed for the same three files. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm --filter @workmap/web typecheck` did not reach the package script because pnpm attempted a workspace install and aborted in non-interactive mode with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Direct Web `tsc --noEmit --incremental false`, full `npm run lint`, and `npm run build` are blocked by the pre-existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character parse error.
- Manual QA: not run in browser. Required check: open `/virtual-office` with another user leaving the map or with an aged position; confirm the status bubble can become `Offline` while the avatar stands still instead of running.
- Intentionally not changed: offline users are not removed from the map; this round only stops stale/offline movement animation. No leave-room persistence or backend freshness calculation was changed.
- Remaining risks: full Web build remains blocked until `authApi.ts` is restored. A browser smoke test is still needed to confirm the animation frame visibly stops in the deployed UI.
- Suggested next step: restore `authApi.ts`, rerun full Web typecheck/lint/build, then browser-test `/virtual-office` with a second account leaving and rejoining the map.

---

## 2026-07-08 Employees Split Status Filters

- Original task: update the `/employees` page toolbar filters to match the new two-status model shown in each employee row: Virtual map status and Device status.
- Changed files: `workmap/apps/web/components/employees/EmployeeDirectory.tsx`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Implementation summary: replaced the single `Status` filter with two independent dropdowns: `Virtual map` filters `employee.status`, while `Device status` filters `employee.deviceStatus` with `no_report` fallback. Both filters combine with existing Search, Department, and Manager/Employee role filters.
- UI behavior: virtual-map dropdown labels use the same presence labels as the virtual office (`Available`, `Busy`, `Focus`, `Idle`, `Offline`, etc.). Device dropdown labels reuse the shared report/device labels (`Focus active`, `Focused idle`, `Open/runtime`, `Signal delayed`, `Device offline`, `No report signal`).
- Summary behavior: the count text now clarifies that online/recently-active count is based on the virtual-map status, and active virtual/device filters are echoed in the summary bar.
- Role/access behavior: no API, auth, RBAC, tenant, report, Desktop Agent, or Browser Extension behavior changed. This is frontend filtering/presentation only.
- Verification: targeted ESLint on `components/employees/EmployeeDirectory.tsx` passed. TypeScript `transpileModule` syntax check for `EmployeeDirectory.tsx` passed. `pnpm --filter @workmap/web typecheck` was attempted but did not reach the package script because pnpm attempted a workspace install and aborted in non-interactive mode with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Direct Web `tsc --noEmit --incremental false` was attempted and is still blocked by the existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character parse error. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Manual QA: not run in a browser. Required check: open `/employees`, verify `Virtual map` and `Device status` dropdowns appear, and confirm each dropdown independently filters the visible Manager/Employee list according to the two badges in the Status column.
- Intentionally not changed: no Dashboard filter was added, no status derivation logic changed, no report metrics changed, and no backend/device/session behavior changed.
- Remaining risks: full Web typecheck/build remains blocked until `workmap/apps/web/lib/api/authApi.ts` is restored from corruption.
- Suggested next step: repair/restore `authApi.ts`, rerun full Web typecheck/lint/build, then browser-test `/employees` filters against real device/report rows.

---

## 2026-07-08 Employees And Dashboard Split Presence/Device Status

- Original task: update `/employees` Manager and Employee directory rows, plus `/dashboard` "People in the office" cards, so every person shows two separate statuses: the Virtual Office/virtual map presence status, and the Desktop Agent/Reports-derived device activity status (`Focus active`, `Focused idle`, `Open/runtime`, etc.).
- Changed files: `workmap/apps/web/app/employees/page.tsx`, `workmap/apps/web/components/employees/EmployeeDirectory.tsx`, `workmap/apps/web/components/dashboard/EmployeeCard.tsx`, `workmap/apps/web/components/dashboard/EmployeeStatusStack.tsx`, `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx`, `workmap/apps/web/components/dashboard/mockDashboardData.ts`, `workmap/apps/web/lib/people/peopleStatus.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Implementation summary: added a shared people-status aggregation helper and a reusable `EmployeeStatusStack` UI component. The first badge now renders `Virtual map` from virtual-office presence freshness; the second badge renders `Device` from reports/device signals.
- `/employees` behavior: directory rows now load virtual-office positions in addition to `/users`, `/devices`, today's company usage summary, and company live agent status. Row `status` is driven by the virtual-office position when available, preserving the existing Status filter as a virtual-map status filter. Device status is derived from report/live activity and device/browser-extension coverage.
- `/dashboard` behavior: "People in the office" cards now use the same split status stack. Virtual-map status is calculated with the same freshness logic as the virtual office map, and device activity status is derived from company reports/live status plus visible device signals where the signed-in role can access company reporting.
- Device activity status behavior: report activity maps to `Focus active` when active seconds exist, `Focused idle` when idle seconds exist, `Open/runtime` when a device/runtime signal is online but no active/idle report has arrived, `Signal delayed` for delayed device signals, `Device offline` for offline signals, and `No report signal` when dashboard data has no device/report row for that person.
- Role/access behavior: no backend endpoint, auth, RBAC, tenant isolation, schema, report permission, Desktop Agent, or Browser Extension behavior changed. The frontend only consumes existing authorized `/users`, `/devices`, virtual-office, and reports APIs.
- Verification: targeted ESLint on the changed web files passed. TypeScript `transpileModule` syntax check for the seven changed source files passed. Direct Web `tsc --noEmit --incremental false` was attempted and is blocked by the existing `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character parse error. Full Web ESLint was attempted and is blocked by the same existing file. Direct Next production build was attempted and is blocked by the same existing file. `pnpm --filter @workmap/web typecheck` was attempted but did not reach the package script because pnpm tried a workspace install and aborted in non-interactive mode with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Manual QA: not run in a browser. Required check: deploy or run locally after fixing the existing `authApi.ts` corruption, open `/employees` as Owner/Manager, toggle Manager/Employee filters, and confirm each row shows separate `Virtual map` and `Device` badges. Then open `/dashboard` and confirm every "People in the office" card shows the same two-status model.
- Intentionally not changed: no `/reports` metric definitions, report aggregation SQL/API, Desktop Agent heartbeat/session logic, Browser Extension domain tracking, Employee detail page, Teams/Email/3CX actions, or visual redesign beyond the status badge stack.
- Remaining risks: the current local Web build is not runnable until `workmap/apps/web/lib/api/authApi.ts` is restored from corruption. Dashboard device status can only show company report-derived device activity for roles with existing company report access; otherwise rows may fall back to `No report signal`.
- Suggested next step: repair/restore `authApi.ts`, rerun `pnpm --filter @workmap/web typecheck`, `lint`, and `build`, then perform browser QA against real employee device/report data.

---

## 2026-07-08 Desktop Agent Stale Connected Status Fix

- Original task: determine why the `mia admin test` Windows Desktop Agent, installed as `desktop-agent-windows/0.5.4`, still showed Connected locally while Owner-side WorkMap data only showed a 2026-07-07 signal and the report stayed disconnected.
- Changed files: `workmap/apps/desktop-agent/src/runtime.ts`, `workmap/apps/desktop-agent/src/electron/main.ts`, `workmap/apps/desktop-agent/renderer/app.js`, `workmap/apps/desktop-agent/renderer/index.html`, `workmap/apps/desktop-agent/test/gui-release.test.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Root cause found: the backend data was not ambiguous. `/devices` showed `mia admin test` device `DESKTOP-ND7S198` last signal at `2026-07-07T08:16:39.551Z`, which matches the Agent window's `05:46:37 PM` display in Adelaide local time. The local Agent UI was misleading because it displayed stale local status as Connected.
- Implementation summary: Desktop Agent runtime no longer starts optimistically as `connected`; it starts as `offline` until a fresh server-confirmed heartbeat is written. Electron startup no longer swallows runtime crashes silently; it writes an `error` status with a sanitized message so stale `status.json` cannot keep presenting an old Connected state.
- Renderer behavior: the Agent window now derives health from heartbeat freshness. A connected state without a recent heartbeat becomes `Signal stale` or `Not connected`, and the UI displays a visible diagnostic line with the last server-confirmed heartbeat. Old heartbeat timestamps now include the date instead of showing only a time-of-day that can look current the next day.
- Role/access behavior: no auth, RBAC, tenant, API, pairing, backend report, or Owner visibility rule changed. This is a Desktop Agent local truthfulness/diagnostics fix only.
- Verification: direct Desktop Agent `tsc --noEmit` passed. `tsx --test test/gui-release.test.ts` passed 3/3. `tsx --test test/queue-api.test.ts` passed 5/5. `git diff --check` passed with existing LF-to-CRLF working-copy warnings. Scoped secret scan found no matches.
- Manual QA: not run on the separate Employee Windows computer. Required acceptance: build/release/install the next Desktop Agent version on the Employee computer, leave it running across restart/day boundary, and confirm the Agent window no longer shows Connected unless `/devices.lastSeenAt` is fresh.
- Intentionally not changed: no backend heartbeat/session threshold, `/devices` endpoint, report aggregation, pairing ownership, Windows auto-start registration, installer publishing, or deployed `0.5.4` binary was changed in this round.
- Remaining risks: this fix does not make the already-installed `0.5.4` binary start heartbeating. It makes the next build stop lying locally. If the next build still cannot heartbeat, the visible error/stale state should expose the real next cause: API/network/auth/runtime failure, stale credential, or auto-start/runtime startup issue.
- Suggested next step: bump/package a new Desktop Agent release, install it on the `mia admin test` employee computer, then compare the local Agent diagnostic line with `https://workmap-api.onrender.com/devices` for the same device id/user.

---

## 2026-07-08 Employees Device Heartbeat Aggregation Fix

- Original task: user could not access `/devices` directly because it returned 404, and `/employees` still showed an employee device as offline while the Employee computer's Desktop Agent UI showed connected.
- Changed files: `workmap/apps/web/app/employees/page.tsx`, `workmap/apps/web/lib/api/apiTypes.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Clarification: `/devices` is a backend API endpoint, not a frontend route. Visiting `https://work-map-teal.vercel.app/devices` will 404 because no Next.js page exists there. The frontend must call the configured API base, for example `https://workmap-api.onrender.com/devices`, with an authenticated Bearer token.
- Implementation summary: `/employees` now calls the existing authenticated `listDevices()` API alongside `/users` and reports. The directory aggregates Desktop Agent device `lastSeenAt` by `device.user.id`, skips revoked devices and Browser Extension devices in that Desktop Agent pass, and merges this signal with Browser Extension coverage plus live/report activity.
- Device health behavior: if a user has live/report activity, the row remains `Device online`. Otherwise Desktop Agent `lastSeenAt <= 30s` is `online`, `<= 120s` is `delayed`, and older/missing signals are `offline`. Browser Extension connected/signal-lost coverage still contributes online/delayed as before. The best signal wins per user.
- API type behavior: `WorkMapApiDevice` now includes the optional `user` object that the backend already returns from `/devices` for visible devices.
- Role/access behavior: no backend permission change. `/devices` remains protected by existing auth and device-health visibility; employees see their own visible devices, and authorized owner/manager roles can see company-visible devices per existing backend policy.
- Verification: `git diff --check` passed with LF-to-CRLF working-copy warnings. Scoped secret scan found only existing docs/env-name references and no new committed secret.
- Verification not run: full Web typecheck/lint/build were not rerun because the local pnpm/Prisma environment was already known to be blocked in the previous round.
- Manual QA: not run in browser. Required check: open `/employees` as Owner/Manager after deployment, confirm the summary mentions `/devices`, and verify an employee with a fresh Desktop Agent heartbeat no longer shows `Device offline` unless `/devices` fails or the device is bound to a different user.
- Intentionally not changed: no public `/devices` page was added, no auth/RBAC/backend endpoint behavior changed, no Desktop Agent runtime changed, and no heartbeat thresholds in backend reports were changed.
- Remaining risks: this fixes directory device-health presentation, but Owner Reports' `Desktop Agent now` card still depends on `agentSession.lastHeartbeatAt` within 30 seconds. A device heartbeat alone does not prove a live session if session start/heartbeat is failing.
- Suggested next step: add a small Owner-facing diagnostics view or row showing each visible Desktop Agent device, bound employee, lastSeenAt, and agentVersion so support can confirm binding without using raw API calls.

---

## 2026-07-08 Desktop Agent Connected Locally But Owner Report Interrupted Investigation

- Original task: investigate why the Employee Windows Desktop Agent shows `Connected`, while the Owner-side WorkMap report still shows Desktop Agent disconnected/interrupted.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`. Runtime code was not changed in this investigation round.
- Investigation summary: Desktop Agent local UI and Owner report use different truth sources. The Agent window reads local `status.json` under `%LOCALAPPDATA%\WorkMap\DesktopAgent`; Owner reports read backend `agentSession.lastHeartbeatAt` through `/reports/usage-summary` and `/reports/agent-status`.
- Key finding: pairing is user-bound. `DevicePairingService.exchangePairingCode` creates `Device.userId = pairing.userId`, so the paired Windows computer belongs to the WorkMap user who generated the one-time code. The Agent UI does not prove it is paired to the employee currently selected in Owner reports.
- Key finding: report online state is strict. `ReportsService.getAgentStatus` returns `online` only when the latest non-ended `agentSession.lastHeartbeatAt` is no more than 30 seconds old. Otherwise it becomes `interrupted` unless the session ended gracefully.
- Key finding: the screenshot's `Pending uploads: 6` means app usage events are queued locally and not fully acknowledged. That does not by itself prove heartbeat failure, but it is a strong signal that API upload/authorization/network/environment mismatch should be checked.
- Deployment/environment finding: packaged Desktop Agent defaults to `https://workmap-api.onrender.com`; `Open WorkMap` opens `https://work-map-teal.vercel.app`. If the user is viewing a different frontend/API deployment or a different report user, local Agent `Connected` can diverge from Owner report status.
- Suggested immediate verification: in Owner account, call or inspect `/devices` and compare the Agent window device prefix with the returned device `id`, `user.displayName`, `agentVersion`, and `lastSeenAt`. The expected owner-visible employee report must use the same `user.id` as that device.
- Role/access behavior: no permission behavior changed. Existing backend tenant/user binding and Owner/Manager device visibility remain the source of truth.
- Verification: code review only. Reviewed Desktop Agent runtime/API client/pairing/UI, backend device pairing/heartbeat/session/report status, and report panel live status rendering.
- Manual QA: not run on the Employee computer. Required checks: confirm the WorkMap account used to generate the Desktop Agent pairing code; compare `/devices` device owner against the report-selected employee; confirm the frontend is using the same API base URL as the Agent.
- Intentionally not changed: no heartbeat threshold, session logic, device pairing, auth/RBAC, deployment URL, Desktop Agent UI, or report UI was changed.
- Remaining risks: current UI does not clearly show which WorkMap user the Agent is bound to, the exact API endpoint it is posting to, or the server-confirmed last heartbeat. A small diagnostics improvement would reduce this class of confusion.
- Suggested next step: add a Desktop Agent diagnostics row showing API base URL, device id prefix, queued upload error, and server-confirmed heartbeat; optionally add Owner `/devices` diagnostics linking a device to the report user.

---

## 2026-07-08 Employees Dynamic Aggregation Page

- Original task: make `/employees` a truly dynamic aggregation page instead of showing hardcoded Today/device placeholders.
- Changed files: `workmap/apps/web/app/employees/page.tsx`, `workmap/apps/web/components/employees/EmployeeDirectory.tsx`, `workmap/apps/web/lib/api/apiTypes.ts`, `workmap/apps/api/src/modules/reports/reports.service.ts`, `workmap/apps/api/test/tracking-reports-verification.test.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`. This round builds on the existing uncommitted Employees filter and Virtual Office z-index changes.
- Implementation summary: `/employees` now loads same-workspace users from `/users` and, for roles allowed to view team reports (`OWNER`, `MANAGER`, `TEAM_LEAD`, `HR_ADMIN`), also requests today's UTC company `/reports/usage-summary` and `/reports/agent-status`. The page merges directory profile data, historical same-day summary data, live foreground agent data, and browser-extension coverage into each employee row.
- Backend API behavior: company `employeeUsage` now includes optional per-user `topApp` and `topDomain` from same-day app/domain summaries. Company live status now includes each live employee's current `topApp`; `topDomain` remains `null` for live-only rows because live browser foreground-domain status is not currently exposed by the API.
- Frontend behavior: Today `Active`, `Idle`, `Top app`, `Top domain`, `Device online/delayed/offline`, row status, and row subtitle are now derived from actual report/coverage data when reports load. If report aggregation is unavailable, the row says `Report unavailable`; if reports loaded but a user has no activity, it says `0m`/`No app data`/`No domain data` rather than using fake values.
- Filter behavior preserved: search, Department, Status, and Manager/Employee role filters continue to combine into one filtered row list. Summary counts reflect the filtered rows and now also display the aggregation source/status.
- Role/access behavior: no backend permission expansion. The frontend attempts company report aggregation only for roles that already have team-report visibility, and the backend remains authoritative for RBAC, tenant scoping, audit logging, and report visibility.
- Verification: `git diff --check` passed with existing LF-to-CRLF working-copy warnings. Targeted direct `tsc` review found and fixed two new implicit-any/type-narrowing issues in the new reports helper.
- Verification blocked/limited: standard `pnpm.cmd --filter @workmap/api typecheck`, `@workmap/web typecheck`, and `@workmap/api test` did not reach package scripts because pnpm attempted a workspace install first and failed on non-interactive module purge / ignored-build policy / bin creation issues. Direct API `tsc --noEmit` is still blocked by the existing missing/generated Prisma client state (`@prisma/client` exports and PrismaService delegates unavailable). Direct Web `tsc --noEmit` is blocked by an existing `lib/api/authApi.ts` invalid-character parse error. Direct API test is blocked by missing `.prisma/client/default`.
- Manual QA: not run in a browser. Required check: open `/employees` as Owner/Manager with real activity data, confirm rows show real Active/Idle/Top app/Top domain/device state, and verify Department/Status/Manager/Employee filters still change the displayed list.
- Intentionally not changed: no schema migration, auth/RBAC/capability changes, tenant boundary changes, Desktop Agent behavior, Browser Extension behavior, Teams/Email/3CX integrations, or real-time browser top-domain endpoint was added.
- Remaining risks: `topDomain` cannot be live-only until the API exposes current per-user browser foreground/domain status; current top domain comes from same-day summary data. Verification remains constrained until Prisma client generation and pnpm ignored-build policy are fixed locally.
- Suggested next step: restore/generate the local Prisma client and approve/build dependencies, then rerun `pnpm --filter @workmap/api typecheck/test` and `pnpm --filter @workmap/web typecheck/lint/build`; after that, do browser QA on `/employees` with a paired employee machine producing activity.

---

## 2026-07-08 Employees Directory Filter Behavior Fix

- Original task: enable `/employees` Department and Status filters and make the Manager/Employee segmented control actually change the employee list.
- Changed files: `workmap/apps/web/app/employees/page.tsx`, `workmap/apps/web/components/employees/EmployeeDirectory.tsx`, `workmap/apps/web/components/dashboard/mockDashboardData.ts`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`. This round also preserves the prior uncommitted Virtual Office navigation layer fix.
- Implementation: added an explicit `roleGroup` to API-mapped directory rows (`EMPLOYEE` -> employee, all other backend roles -> manager). The Employee Directory now combines search, department, status, and Manager/Employee role filtering into one `filteredEmployees` list.
- Behavior change: the Manager/Employee segmented control is now an employee-type filter instead of only toggling the Today/contact presentation. For users with manager access, Today summary columns remain visible while the segment changes which rows are shown. Summary counts now reflect the filtered rows, not the full unfiltered dataset.
- Department/status behavior: existing department/status selectors now participate in the same combined filter with role and search. Empty results continue to show the existing no-match empty state.
- Role/access behavior: backend RBAC and `/users` authorization are unchanged. This is frontend filtering/presentation only and does not expose new employee data.
- Verification: `git diff --check` passed with existing LF-to-CRLF warnings. Scoped secret scan found only existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`; no new secret was introduced.
- Verification blocked: `pnpm.cmd --filter @workmap/web typecheck` and `lint` were attempted with non-interactive settings, but the current pnpm wrapper still attempted a workspace install before running checks and failed on node_modules/bin/lockfile permissions or ignored-build policy before TypeScript/ESLint started.
- Manual QA: not run in a browser. Required visual/function check: open `/employees`, select Manager and Employee and confirm row lists change; select Department/Status combinations and confirm rows filter and summary counts update.
- Intentionally not changed: no API, schema, device status aggregation, report metrics, Teams/Email/3CX actions, or real device/report data integration was added.
- Remaining risks: the page still uses placeholder Today metrics (`API scoped`, `Contact view`, `Not shown`) and inferred device labels; making those dynamic needs a separate aggregation/data-source round.
- Suggested next step: perform browser QA on deployed/local `/employees`; then wire real device/report status if the directory should show live monitoring data.

---

## 2026-07-08 Virtual Office Navigation Menu Layer Fix

- Original task: fix `/virtual-office` where the expanded Virtual Office navigation card was visually covered by the left rail.
- Changed files: `workmap/apps/web/components/office/VirtualOfficeTopBar.tsx`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Implementation: raised the Virtual Office top brand trigger and its expanded navigation menu from z-index 20/30 to z-index 50. This puts the expanded workspace navigation above the left tool rail (`officePanel` z-index 35) while keeping the command palette/modal layer (`officeModal` z-index 60) higher.
- Role/access behavior: unchanged. No auth, RBAC, tenant, API, Desktop Agent, Browser Extension, tracking, or reporting behavior changed.
- Verification: `git diff --check` passed with the existing LF-to-CRLF working-copy warning for the touched TSX file. Scoped secret scan found only an existing documentation example value `WORKMAP_JWT_SECRET=qa-local-secret`; no new secret was introduced.
- Verification blocked: `pnpm.cmd --config.offline=true --filter @workmap/web typecheck` and `lint` did not reach TypeScript/ESLint because the current pnpm wrapper attempted an install first and aborted in non-interactive mode with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- Manual QA: not run in a browser in this environment. Required visual check: open `/virtual-office`, click the Virtual Office card, and confirm the expanded menu is above the left rail at the screenshot viewport.
- Intentionally not changed: no layout positions, rail behavior, side panel behavior, command palette layering, map rendering, movement, realtime, or data loading changed.
- Remaining risks: visual/browser confirmation is still needed across narrow breakpoints to ensure the raised menu does not unintentionally cover another control.
- Suggested next step: run a quick browser smoke on `/virtual-office` and confirm the menu is clickable/visible over the left rail.

---

## 2026-07-07 Browser Extension Alpha ZIP Release Preparation

- Original task: guide the selected manual Browser Extension path through ZIP preparation, release URL configuration, and Web redeployment.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`. A generated ignored artifact was created at `workmap/artifacts/WorkMap-Browser-Extension-0.4.0.zip`; no runtime source changed in this round.
- Build/package result: rebuilt `@workmap/browser-extension` 0.4.0 and compressed the contents of `apps/browser-extension/alpha-unpacked` rather than its parent directory. The ZIP root directly contains `manifest.json`, `options.html`, `options.css`, and `dist/*`, which is required for Load unpacked after extraction.
- Artifact: `C:\Users\lilia\WorkMap\workmap\artifacts\WorkMap-Browser-Extension-0.4.0.zip`.
- SHA-256: `AD85B9E8B3FB6839D3DF2BB8AC4F745CCE8E0CF50C7176865C8BA37FCB7D628F`.
- External publication status: not published. This environment has neither GitHub CLI nor Vercel CLI available, and creating a public Release/production deployment requires authenticated external action.
- Recommended GitHub release: tag `browser-extension-v0.4.0`, title `WorkMap Browser Extension 0.4.0 Alpha`, and upload the generated ZIP. For the current origin, the expected public asset URL is `https://github.com/liangceli/WorkMap/releases/download/browser-extension-v0.4.0/WorkMap-Browser-Extension-0.4.0.zip` after successful publication.
- Privacy/release note: label the release Alpha/manual Developer mode testing; do not describe it as store-approved, managed, or production-ready.
- Deployment sequence: publish and verify the ZIP URL; set Vercel `NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL` for the intended environments; ensure the Device Setup source changes are committed/pushed to the deployment branch; trigger a new Web build because `NEXT_PUBLIC_*` is embedded at build time; verify Employee download/extract/Load unpacked/pairing and Owner coverage.
- Runtime, role, access, auth, schema, API, domain timing, and reporting behavior: unchanged.
- Verification: Browser Extension build passed; ZIP entry listing and SHA-256 were inspected; `git diff --check` and scoped secret scan passed.
- Manual QA: ZIP was not uploaded or installed in Chrome/Edge, and Web was not redeployed.
- Remaining risk: a private GitHub repository/release URL will not be anonymously downloadable by Employees; if the repository is private, use an authenticated WorkMap download endpoint or suitable public artifact host instead of the expected GitHub URL.
- Suggested next step: Owner uploads the prepared artifact to the named GitHub Release and confirms the asset opens without GitHub authentication; then configure Vercel and redeploy.

---

## 2026-07-07 Manual Browser Extension Employee Setup Implementation

- Original task: choose the first non-store distribution option now: Employee manual ZIP download, Developer mode Load unpacked installation, and WorkMap pairing.
- Changed files: `workmap/apps/web/app/onboarding/device-setup/page.tsx`, `workmap/.env.example`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.
- Implementation: Device Setup now presents separate Desktop Agent and Browser Extension Alpha panels instead of combining their actions. The extension panel contains the controlled-test boundary, Chrome/Edge Developer mode instructions, permanent-folder warning, permission/pairing steps, and manual update/Reload warning.
- Download configuration: added `NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL`. When configured, Employees see `Download extension ZIP`; when absent, the page honestly shows that the ZIP release configuration is pending. No URL was hardcoded and no generated archive was committed.
- Pairing/status: the existing `BROWSER_EXTENSION` one-time-code flow remains unchanged. Device Setup now detects an existing non-revoked `browser-extension-mv3/*` device and shows a distinct paired state; a newly completed Browser Extension pairing updates that state immediately.
- Onboarding boundary: Desktop Agent remains required to continue to the virtual office. Browser Extension remains optional for navigation but explicitly must be paired before domain monitoring begins.
- Runtime boundary: domain timing, heartbeat, coverage thresholds, API, auth, schema, roles, tenant isolation, and reporting calculations were not changed.
- Verification: `corepack pnpm --filter @workmap/web typecheck`, `lint`, and `build` passed; Browser Extension tests passed 13/13 and its build passed. The initial sandboxed commands could not read the installed TypeScript executable (`EPERM`), so the same checks were rerun successfully with approved sandbox escalation.
- Manual QA: not run in a real Chrome/Edge Employee profile because no deployed ZIP URL/local authenticated Web session was supplied.
- Remaining deployment action: package the built `apps/browser-extension/alpha-unpacked` contents as a ZIP whose root contains `manifest.json`, publish it at a stable HTTPS download URL, set `NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL` in the deployed Web environment, and redeploy Web.
- Remaining risk: manual Alpha installs can be disabled/removed and do not auto-update; Employees must preserve the extracted directory and manually replace/reload future versions.
- Suggested next step: publish the 0.4.0 Alpha ZIP and perform end-to-end Employee Chrome and Edge install/pair/restart/update/remove QA, then confirm Owner connected/signal-lost recovery behavior.

---

## 2026-07-07 Non-Store Browser Extension User And Owner Workflow Review

- Original task: describe the Employee first-setup/daily-use workflow and Owner visibility when WorkMap does not publish the Browser Extension through Chrome Web Store or Microsoft Edge Add-ons.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No runtime behavior changed.
- Supported paths: (1) manual unpacked installation for a small pilot/development group, or (2) organization-managed external installation through browser enterprise policy. A normal WorkMap webpage cannot silently install a non-store Chrome extension on unmanaged Windows/macOS devices.
- Manual-pilot first setup: Employee downloads the approved WorkMap extension ZIP, extracts it to a permanent folder, opens `chrome://extensions` or `edge://extensions`, enables Developer mode, selects Load unpacked, grants the requested site access, creates a Browser Extension pairing code in WorkMap Device Setup, and enters it in the extension options page. WorkMap then shows the pairing as connected after the extension exchanges the code and starts heartbeats.
- Manual-pilot daily use: opening the browser starts the paired MV3 extension; permitted domain timing is queued/uploaded and heartbeat freshness drives coverage. The Employee can inspect, disable, reload, or remove it. Moving/deleting the unpacked folder, browser cleanup, profile changes, or developer-mode controls can break coverage.
- Manual-pilot updates: WorkMap must distribute a new package; the Employee/IT must replace the files in the same controlled location and reload/reinstall the extension. The current local Alpha package has no managed self-update delivery workflow, so version drift is a material operational risk.
- Enterprise-managed first setup: customer IT hosts/packages the approved extension and update metadata where supported, configures Chrome/Edge enterprise installation policies (for example through Group Policy/Intune/browser management), and assigns it to employee browsers. Installation can be automatic; the Employee then reviews the WorkMap disclosure and completes the existing one-time pairing step unless IT provisioning is separately designed.
- Enterprise-managed daily use: browser policy maintains installation and can prevent disable/removal when force-installed; managed update policy can roll out signed versions. This produces the cleanest non-public-store experience but requires customer IT administration and a dedicated signing, stable-ID, hosting, update, rollback, and support process that WorkMap does not currently provide.
- Owner view for both paths: unchanged. Owner/allowed Manager sees extension coverage based on heartbeat freshness and domain summaries after upload. After the final successful signal, an open report normally changes to `signal_lost` after the existing 90-second freshness threshold plus up to the report polling interval. Recovery changes it back to connected.
- Owner limitation: heartbeat loss cannot identify whether the Employee disabled/removed the extension, closed the entire browser, shut down/slept, lost network, changed profile, or encountered a runtime failure. Closing only a browser window may leave a background browser process and heartbeat running. Manual installation also cannot guarantee compliance or current version.
- Recommendation: use unpacked loading only for the present controlled pilot. For production without public store listing, choose enterprise-managed deployment and accept the customer-IT prerequisite; for ordinary unmanaged employee computers, store distribution remains the reliable self-service route.
- Role/access/privacy behavior: unchanged. Existing Employee pairing, tenant isolation, Owner/Manager boundaries, hostname-only collection, and reporting calculations were not modified.
- Verification: reviewed current pairing/options/heartbeat implementation and official Chrome distribution plus Edge sideload/external-distribution documentation. No automated tests were run because no runtime code changed.
- Manual QA: not run; unpacked install/update/remove and managed policy deployment were not exercised on a real employee device.
- Remaining risks: current Alpha package/version delivery is not a production updater; extension identity, signing, policy templates, hosted updates, rollback, and fleet version visibility require a separate implementation round.
- Suggested next step: continue local unpacked testing now, while deciding whether target customers can supply managed browsers. That decision determines enterprise deployment versus store self-service.

---

## 2026-07-07 Browser Extension Store Publication Effort Review

- Original task: assess whether publishing the WorkMap Browser Extension to the Chrome Web Store and Microsoft Edge Add-ons is difficult.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No extension, Web, API, auth, schema, deployment, or reporting behavior changed.
- Assessment: moderate one-time release work rather than a rebuild. The current extension is already Manifest V3 and the Chromium implementation can largely be reused for Chrome and Edge, but each store requires its own developer account, listing, submission, and review.
- Current readiness gap: the local package is still named `WorkMap Domain Tracking Alpha` at version `0.4.0` and is not yet a store-ready product listing. Store icons/screenshots/promotional assets, final listing copy, public privacy-policy/support links, test instructions, release packaging, and stable store IDs/URLs still need to be completed.
- Highest review risk: the extension uses `tabs`, `idle`, `scripting`, and optional broad HTTP/HTTPS host access for domain timing. Each permission must be demonstrably necessary, minimally scoped, and clearly justified; hostname/timing collection and employee-monitoring behavior must match the store disclosures and public privacy policy exactly.
- Recommended release sequence: prepare and privately/tester-publish Chrome first, resolve review findings, then reuse the validated Chromium package and disclosures for a separate Edge Add-ons submission. After stable listing URLs/IDs exist, implement the Employee Device Setup store buttons and pairing handoff.
- Effort estimate: if WorkMap's final privacy policy and brand assets are available, allow roughly 1-3 focused engineering/content days for the first store-ready submission and cross-browser checks; external review and any reviewer questions are additional, store-controlled calendar time. Edge should require less incremental implementation effort but still has an independent certification cycle.
- Role/access/privacy behavior: unchanged. Owner/Manager reporting, Employee controls, tenant isolation, and the existing hostname-only privacy boundary were not modified.
- Verification: reviewed the current manifest and official Chrome Web Store account, publishing, privacy, listing, and distribution requirements plus official Microsoft Edge Add-ons submission requirements. Runtime tests were not run because no runtime code changed.
- Manual QA: not run; real store upload, reviewer test credentials, install/update/remove, and production pairing remain untested.
- Remaining risk: store approval is not guaranteed, especially if permission explanations, public privacy language, or observed behavior diverge. Review duration cannot be controlled by WorkMap.
- Suggested next step: create the company-owned Chrome/Edge publisher accounts and approve the final privacy policy/brand assets, then perform a dedicated store-readiness implementation round.

---

## 2026-07-07 Browser Extension Employee Control And Owner Coverage Review

- Original task: confirm whether Employees can view/disable the extension and whether Owner status updates when the Employee closes the browser.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No runtime behavior changed.
- Employee control: a normal Chrome Web Store or Edge Add-ons self-service installation lets the Employee view extension details, requested permissions, version, site-access settings, enable/disable toggle, and Remove action through the browser extension manager. Enterprise-managed force installation can restrict disable/remove through administrator policy.
- Current heartbeat behavior: WorkMap targets a ten-second heartbeat interval, uses a 30-second MV3 alarm/checkpoint fallback, and persists state so normal service-worker suspension does not itself imply coverage loss.
- Owner state: the API treats a Browser Extension as `connected` while its last signal is no more than 90 seconds old; after that it returns `signal_lost`. Reports polls live status every ten seconds and replaces the displayed extension coverage from that response, so an open Owner report normally changes within roughly 90–100 seconds after the final heartbeat, excluding network/API delay.
- Browser-close boundary: closing one browser window is not proof that the browser process stopped. Other windows, profiles, or allowed background browser execution may keep the extension heartbeat alive. Only loss of the extension execution/network signal results in `signal_lost`.
- Cause boundary: disable, uninstall, full browser exit, computer shutdown/sleep, browser/profile crash, permission/runtime failure, and network loss all stop or delay heartbeats. The extension cannot execute after disable/remove to report an exact final action, so Owner sees an honest signal-loss state rather than a claimed exact cause.
- Recovery: browser/extension startup initializes the tracker and forces reconciliation/heartbeat. Reports then returns to Connected on its next poll. If the signal gap exceeded 90 seconds, the backend records a coverage-loss interval from `lastSignal + 90 seconds` through the recovery heartbeat.
- Short interruption: if the browser/extension resumes within 90 seconds, Owner may never see Signal lost; this is intentional thresholding rather than instant browser-window telemetry.
- Verification: source review of MV3 startup/alarm/heartbeat, API 90-second coverage computation, live Reports ten-second polling/coverage merge, automated coverage-loss tests, and official Chrome/Edge extension-management documentation. No automated test rerun because code did not change.
- Role/access/privacy behavior: unchanged. Owner/Manager coverage visibility remains RBAC/tenant-scoped; no new browsing content or exact employee action is collected.
- Manual QA: real disable/remove/full-exit/background-process/re-enable timing was not run.
- Recommended next step: keep self-service installations user-controllable and label Owner status `Connected` / `Signal lost or browser unavailable`; separately offer enterprise force-install for customers that require disable prevention.

---

## 2026-07-07 Employee Self-Service Extension Setup Feasibility

- Original task: determine whether Browser Extension installation/configuration can be employee self-service inside WorkMap, similar to Desktop Agent setup.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No runtime implementation was requested or changed.
- Feasibility: yes for a WorkMap-guided self-service flow, but not for silent installation from the website. Chrome/Edge retain the native install and permission confirmation boundary.
- Recommended Employee flow: WorkMap Device Setup detects Chrome/Edge; shows the matching official store button; employee confirms Add extension and requested site access in the browser; WorkMap generates a short-lived pairing code; the installed extension exchanges that code for its device credential; Device Setup polls the existing pairing status and shows Connected.
- Current reusable pieces: Employee-authenticated pairing-code creation, device-scoped credential exchange, optional host permission prompt, browser selection, paired status, heartbeat, revocation, and Owner coverage reporting already exist.
- Missing implementation: Chrome Web Store and Microsoft Edge Add-ons listings/stable extension IDs, Web environment/config for store URLs, Employee install buttons/instructions, installed-state handshake, and final install/update/remove QA.
- Optional later improvement: a narrowly allowlisted `externally_connectable` manifest entry can let the deployed WorkMap origin send the one-time pairing code to the installed extension. Current manifest does not expose this. It must accept only approved WorkMap HTTPS origins and must never accept/reveal persistent device credentials.
- Distribution boundary: Chrome documents that unpacked extensions are for development; direct user installation requires Chrome Web Store hosting/signing. Windows/macOS self-hosting is available only in managed enterprise environments. Edge recommends Microsoft Edge Add-ons for normal users and enterprise policy for managed deployment.
- Alternative enterprise flow: company IT force-installs the extension through Chrome/Edge management policy; employee then only signs into WorkMap, reviews transparency/permissions, and pairs/activates the assigned browser client.
- Role/access/privacy behavior: unchanged. Employee pairing remains device-scoped and tenant-bound; Owner/Manager visibility and existing privacy payload restrictions remain unchanged.
- Verification: repository/source review plus current official Chrome distribution, Chrome external messaging, and Microsoft Edge extension distribution documentation. No tests were run because runtime code did not change.
- Manual QA: not run.
- Recommended next step: choose public/private store self-service versus enterprise managed installation. For normal Employee self-service, implement the store-first Device Setup flow after the extension listings and stable IDs exist.

---

## 2026-07-07 Employee Browser Extension Installation Review

- Original task: explain how an Employee account currently installs the WorkMap Browser Extension.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No runtime code changed.
- Current Employee UI: `/onboarding/device-setup` explains the Browser Extension and provides `Pair Browser Extension`, which creates a short-lived one-time pairing code and reports paired/expired status.
- Current distribution gap: the Employee page has no extension download, Chrome Web Store link, Edge Add-ons link, packaged CRX/MSIX, or managed-install action. The extension exists only as the local MV3 `workmap/apps/browser-extension/alpha-unpacked` directory.
- Current Alpha installation: an administrator/developer must deliver the unpacked directory to the Employee; the Employee enables Developer mode at `chrome://extensions` or `edge://extensions`, selects Load unpacked, and chooses that directory. The folder must remain on disk.
- Pairing after installation: Employee opens Extension details/options, confirms the API URL and browser type, enters the code generated from WorkMap Device Setup, approves HTTP/HTTPS site access, and waits for `Paired | connected` status.
- Update behavior: this unpacked build has no browser-store auto-update. A new build must be redistributed and the extension reloaded/replaced manually.
- Privacy/permission behavior: pairing requests optional HTTP/HTTPS site access required for page interaction timing. Protected browser pages remain unavailable.
- Role/access behavior: the pairing code is Employee-authenticated and API-scoped; Owner/Manager report permissions and tenant boundaries are unchanged.
- Verification: source review of Device Setup, options/pairing code, manifest permissions, and distribution search. No automated test rerun because runtime code was unchanged.
- Manual QA: no Employee installation was run.
- Intentionally unchanged: no Web install UI, manifest, store listing, packaging, pairing, API, Reports, auth/RBAC, deployment, or tracking behavior changed.
- Remaining risk/next step: the current path is suitable only for controlled Alpha testers. A normal Employee experience requires publishing to Chrome Web Store and Edge Add-ons (or enterprise managed deployment), adding official install links/instructions to Device Setup, and then validating install/update/remove flows.

---

## 2026-07-07 Reports Default And Persistent Filters

### Original Task Brief

Make Work summaries open by default on the current local calendar day, with Report view set to Company aggregate and Department set to All departments. Preserve changed filter values across page navigation and browser reload, and apply the same filters to both App usage time and Domain usage time.

### Changed Files

- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/components/reports/reportFilters.ts`
- `workmap/apps/web/test/reports-filter-persistence.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Replaced the old 30-day default range with `from = local today` and `to = local today`. Local calendar components are used rather than UTC `toISOString()` so Australian/other non-UTC users do not open on the previous/next UTC date.
- Owner, Manager, Team Lead, and HR Admin continue to default to Company aggregate; its default department is the existing empty value representing All departments. Roles without company-report permission safely default to My activity.
- Added a user-scoped local-storage preference (`workmap.reportFilters.<userId>`) containing Report view, Department, From, and To. Draft changes persist after each filter update, and Apply filters persists immediately as well.
- Initialization now resolves the authenticated role and allowed employee/department directory first, restores that user's saved filter when valid, and uses the restored filter for the initial summary request. Navigation away/back and full reload therefore restore both the controls and the applied report.
- Stored company/employee selections that the current role or current directory no longer permits fall back to the role-appropriate default. Removed departments fall back to All departments; corrupt, future, or reversed date ranges fall back to today's default.
- Storage failure is non-fatal; Reports remains usable with in-memory filters.
- Apps and Domains still come from the same `getUsageSummary` response and the same live-status request, both parameterized by one `appliedFilters` object. Scope, department, employee, From, and To therefore apply identically to App usage and Domain usage.

### Role And Access Behavior

- Existing report capabilities are unchanged. Company aggregate remains available only to existing authorized roles; Employee direct Reports access and backend RBAC/tenant enforcement are unchanged.
- Preferences are isolated by authenticated WorkMap user ID so two users sharing one browser do not inherit each other's report scope.

### Verification And Manual QA

- Web tests passed 25/25. New tests cover local-day/default-company/all-departments initialization, persistence across remount/reload, per-user isolation, and role-safe fallback.
- Existing reports API tests still confirm scope, department, employee, From, and To query parameters.
- Web typecheck, lint, and production build passed; 19 routes generated.
- Manual browser navigation/reload QA was not run in this environment.

### Intentionally Not Changed

- No Reports API contract, app/domain calculation, live polling cadence, export format, database/schema, RBAC, tenant isolation, authentication, Desktop Agent, Browser Extension, or report-card design changed.
- Existing unrelated handoff changes and `docs/references/` were preserved.

### Remaining Risks And Suggested Next Step

- Local storage is browser/profile-specific and intentionally does not sync filter preferences across different computers or browsers.
- Final manual QA should set a non-default employee/department/date range, apply it, navigate to Dashboard and back, reload Reports, and confirm both Apps and Domains retain exactly the same range/scope.
- The scoped implementation and automated checks pass; the project can proceed to that Reports persistence acceptance test.

---

## 2026-07-07 Browser Extension 0.4.0 Manual Test Guide Review

- Original task: explain the current Browser Extension maturity, what can be used now, and how to test it.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only. No extension, API, Reports, or deployment code changed.
- Current result: the local MV3 Alpha is ready for Chrome and Edge load-unpacked testing from `workmap/apps/browser-extension/alpha-unpacked`.
- Usable flow: optional HTTP/HTTPS site permission; Employee one-time pairing; encrypted device credential; exact-hostname tracking; trusted keyboard/pointer/wheel/touch activity; immediate focus-owner transfer; 30-second Focused idle boundary; first-tab-to-final-tab Open/runtime; same-hostname tab de-duplication; persisted offline queue/retry; API ingestion; Owner/Manager domain cards; and 90-second extension signal-loss detection/recovery display.
- Report presentation: Focus active is the primary collapsed metric; Focused idle and Open/runtime are shown after expansion. Same-hostname overlap is unioned rather than multiplied, including Chrome/Edge overlap in report aggregation.
- Privacy boundary: the extension sends hostname and timing/state boundaries only. It does not collect key values, typed text, pointer coordinates, target elements, titles, full URLs, paths/queries/fragments, page/form/password content, screenshots, clipboard, camera, microphone, email bodies, or private messages.
- Verification: Browser Extension tests passed 13/13; typecheck, lint, and Alpha build passed. Rebuild left no source-equivalent extension diff.
- Manual QA: not run in real Chrome or Edge in this round. Online API/Web deployment parity was not verified.
- Intentionally unchanged: no manifest permission, tracking logic, API/schema, Reports, auth/RBAC, tenant boundary, Desktop Agent, deployment, or store package changed.
- Remaining risks: protected browser pages, denied/revoked host permission, Incognito, inaccessible frames, browser/profile crash, offline final-tab closure, and exact disable/remove cause remain documented limitations. The extension is not published through Chrome Web Store or Edge Add-ons.
- Recommended test: load the unpacked build separately in Chrome and Edge, pair through Employee Device Setup, run the timed focus/idle/runtime/de-duplication/disable matrix, and compare the same employee in Owner Reports. The project can proceed to this manual Alpha acceptance round.

---

## 2026-07-07 Desktop Agent Shutdown And Windows Sign-In Lifecycle Review

### Original Task Brief

Confirm what the current Desktop Agent does when an employee shuts down the computer and whether it starts automatically the next working day.

### Changed Files

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Current Behavior

- Closing the Electron window does not quit a paired Agent. The close event is prevented and the window hides to the system tray, so tracking continues.
- Choosing `Quit Agent` from the tray calls `runtime.shutdown()`, finalizes the current focus/runtime segments, persists/flushes the queue, attempts to stop the backend Agent session, then quits Electron.
- A Windows shutdown/logoff terminates the Agent process. The current Electron main process does not register Windows `query-session-end`/`session-end` handling that explicitly waits for `runtime.shutdown()`. Therefore an OS shutdown must not be described as a guaranteed graceful final upload.
- Runtime durability mitigates an unclean stop: tracking state is checkpointed about every five seconds, queued events are persisted, and the next Agent start recovers the saved segment with bounded timing rather than silently losing the whole work period.
- After a packaged Agent is successfully paired, it calls Electron `app.setLoginItemSettings({ openAtLogin: true, ... args: ["--background"] })`. On the next Windows user sign-in, the installed Agent starts automatically in background/tray mode and resumes tracking.
- Auto-start begins after that Windows account signs in, not at machine boot before login. It does not activate before pairing, and Windows Startup Apps being manually disabled, uninstall, missing credentials, or installation failure can prevent it.
- The legacy Alpha PowerShell installer also creates a current-user `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry. The current GUI Agent removes that legacy entry and uses Electron's packaged login-item mechanism after pairing.

### Role And Access Behavior

- This lifecycle is device/user-session behavior for a paired Employee Agent. Owner/Manager report permissions, tenant isolation, credentials, and API authorization are unchanged.

### Verification And Manual QA

- Desktop Agent tests passed 22/22, including graceful tracking shutdown, persisted-segment recovery after an unclean stop, persistent queue behavior, and Windows Alpha install-script auto-start coverage.
- Desktop Agent typecheck and lint passed.
- Source review confirmed tray-close, tray-quit, runtime finalization, five-second checkpointing, packaged login-item configuration, background argument handling, and legacy Run-key migration.
- A real Employee-computer Windows shutdown/reboot/sign-in cycle was not run in this round. The packaged GUI auto-start and OS-shutdown delivery timing remain manual acceptance items.

### Intentionally Not Changed

- No Desktop Agent runtime, Electron lifecycle, installer, startup setting, tracking calculation, API, report, credential, auth, RBAC, or deployment code changed.
- Existing unrelated working-tree state and `docs/references/` were untouched.

### Remaining Risks And Suggested Next Step

- The main gap is explicit OS shutdown handling: abrupt shutdown can leave the final few seconds represented only by the latest checkpoint and recovered on next start, rather than a confirmed shutdown upload/session-stop event.
- On a paired Employee Windows computer, verify: close-window continues in tray; tray Quit stops; shutdown while an app is focused; boot/sign-in auto-starts hidden; Reports recover the final pre-shutdown interval without duplication; and Windows Startup Apps shows WorkMap enabled.
- The current code is suitable for that lifecycle QA, but automatic start and final shutdown accuracy should not be called production-verified until the real reboot test passes.

---

## 2026-07-07 Hard Redirect For Missing Cognito Session

### Original Task Brief

When WorkMap is not logged in, protected project routes must not remain visible with “Sign in needed” or other fallback content. They must replace the current route with `/`, where the user can choose to sign in again.

### Changed Files

- `workmap/apps/web/lib/auth/cognitoRedirect.ts`
- `workmap/apps/web/lib/api/apiClient.ts`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/app/virtual-office/page.tsx`
- `workmap/apps/web/app/onboarding/avatar/page.tsx`
- `workmap/apps/web/app/onboarding/company/page.tsx`
- `workmap/apps/web/app/onboarding/device-setup/page.tsx`
- `workmap/apps/web/test/cognito-protected-redirect.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added one client-side missing-session redirect helper. It checks the refreshed stored Cognito session and uses `window.location.replace("/")`, so the protected route is removed from browser history rather than left behind the login landing page.
- `/`, `/login`, `/login/callback`, and `/invite/:token` remain public and never enter this redirect path.
- AppShell now keeps protected children completely unrendered behind the full-page access loader until authentication resolves. If restoration confirms there is no session, it clears stale shell/workflow state and replaces the route with `/` instead of ending loading and showing the project shell.
- Logout now clears Cognito/workflow/shell state and immediately replaces the protected page with `/`.
- The shared Cognito API client redirects when a previously authenticated page can no longer obtain a token after refresh, covering final refresh-token expiry while a page is already open.
- Standalone protected routes outside AppShell—Virtual Office, Owner company onboarding, Avatar onboarding, and Device Setup—use the same rule and do not render their protected content before authentication resolves.
- A valid Cognito session with a backend mapping/access error is not falsely treated as logged out. Virtual Office retains a distinct “Workspace access unavailable” state for that authenticated-but-blocked case.

### Role And Access Behavior

- The redirect applies equally to Owner, Manager, Employee, IT Admin, and Platform Admin when no Cognito session exists.
- No role capability, tenant scope, Reports permission, invitation authorization, Platform Admin authorization, or backend guard changed.

### Verification And Manual QA

- Web tests passed 22/22, including protected-route root replacement and public-route non-redirect cases.
- Web typecheck passed.
- Web lint passed after fixing the new test's unused parameter.
- Web production build passed with 19 routes.
- Manual signed-out navigation QA was not run because no browser instance was available in this environment.

### Intentionally Not Changed

- No Cognito lifetime/refresh policy, login UI, root landing page, invite acceptance flow, backend authentication, API schema, RBAC, tenant isolation, Desktop Agent, Browser Extension, tracking, or Reports calculation changed.
- Existing unrelated working-tree changes and `docs/references/` were preserved.

### Remaining Risks And Suggested Next Step

- Final deployed QA should sign out from Dashboard, directly open each protected URL while signed out, and let a signed-in session reach final refresh-token failure to confirm all paths land on `/` without protected-content flash.
- The scoped implementation and automated checks pass; the project can proceed to that deployed authentication-boundary QA.

---

## 2026-07-07 Compliance Card-Gap Background Integration

- Original task: remove the white background visible in the gaps between adjacent Compliance cards so the spacing blends naturally into the page.
- Changed files: `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx`, `workmap/apps/web/app/workspace-redesign.css`, and handoff documentation.
- Implementation: added one scoped class to the two layout-only Compliance grids and overrode the broad editorial card treatment on those containers to transparent background, zero border/radius, and no shadow. The five actual content cards keep their existing background, border, radius, spacing, and shadow.
- Product Design/UI styling impact: the supplied screenshot was treated as a scoped annotation; no redesign, new component, asset, typography, color, or interaction was introduced.
- Verification: Web typecheck, lint, and production build passed; 19 routes generated. `git diff --check` and the scoped secret scan passed at final closeout.
- Manual QA: in-app browser discovery returned no available browser instance, so authenticated screenshot verification was not run.
- Intentionally unchanged: card content, grid gap size, responsive columns, Compliance behavior, acknowledgement flow, auth, API, RBAC, schema, and other pages.
- Remaining risk: final visual confirmation should refresh `/compliance` at desktop and mobile widths. The scoped implementation is ready for that visual check and the next round can proceed.

---

## 2026-07-07 Browser Extension 0.4.0 Test-Readiness Review

- Original task: confirm whether the Browser Extension is developed enough to begin testing.
- Changed files: handoff documentation only; no extension runtime code changed. The existing generated Alpha output was rebuilt and remained source-equivalent.
- Result: yes, local Chrome/Edge manual testing can begin using `workmap/apps/browser-extension/alpha-unpacked`.
- Current implementation: MV3 `0.4.0`, optional HTTP/HTTPS site access, trusted keyboard/pointer/wheel/touch activity timestamps, single-domain focus ownership, exact 30-second Focused idle transition, same-domain tab de-duplication, Open/runtime lifecycle, encrypted device credential, offline queue/retry, and API/Reports integration.
- Verification: extension tests passed 13/13; typecheck, lint, and Alpha build passed.
- Manual QA: not yet run in real Chrome/Edge or against a paired Employee/Owner deployed environment.
- Intentionally unchanged: no extension logic, API, schema, Reports, auth, RBAC, Desktop Agent, deployment, or browser-store publication changed.
- Remaining risk: protected/internal pages, denied site access, Incognito, iframe/browser-version differences, offline/crash timing, and extension disable/remove detection still need real-browser acceptance. This is a load-unpacked Alpha, not a Chrome Web Store/Edge Add-ons release.
- Next step: load the unpacked folder separately in Chrome and Edge, pair it, then run the agreed timed domain matrix and compare Owner Reports. The project can proceed to that manual test round.

---

## 2026-07-07 Cognito Idle Session Renewal

### Original Task Brief

Find why Owner/Manager accounts left open for a while show an expired Cognito session on return, and make normal signed-in sessions remain usable instead of requiring a new login after the short-lived token expires.

### Changed Files

- `workmap/apps/web/lib/auth/cognitoSession.ts`
- `workmap/apps/web/lib/auth/cognitoUserPoolAuth.ts`
- `workmap/apps/web/lib/api/apiTypes.ts`
- `workmap/apps/web/lib/api/apiClient.ts`
- `workmap/apps/web/lib/api/apiAuth.ts`
- `workmap/apps/web/lib/api/platformAuth.ts`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/office/useVirtualOfficeRealtime.ts`
- `workmap/apps/web/app/onboarding/company/page.tsx`
- `workmap/apps/web/test/cognito-session-refresh.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Root cause: WorkMap persisted only the short-lived Cognito ID/access tokens in its own session record. `getCognitoSession()` deleted that record close to token expiry, while normal page/API flows never asked Amplify to restore/refresh the session. Hosted UI token exchange also discarded its returned refresh token. Components that stayed mounted retained the original token indefinitely.
- Hosted UI sessions now retain the refresh token and renew ID/access tokens through Cognito's `refresh_token` grant before an expired token is used. A refresh response must remain `Bearer` and match the stored Cognito subject.
- Direct User Pool username/password sessions now restore through Amplify `fetchAuthSession`, which uses Amplify's persisted refresh session. Refresh work is single-flight so concurrent page requests do not create a refresh storm.
- Cognito API options carry an internal auth-source marker. The shared API client resolves the current token for each request and performs at most one forced refresh/retry after a 401, including long-mounted Reports, Dashboard, Employee, Platform Admin, and Virtual Office API consumers.
- Virtual Office WebSocket connect/reconnect obtains the current Cognito token instead of reusing the token captured when the page first mounted.
- AppShell updates its local Cognito state after restoration. Owner company onboarding also restores before loading profile data or submitting workspace creation.
- Explicit logout still clears the WorkMap session and Amplify session. Renewal lasts only while Cognito's configured refresh token remains valid and has not been revoked; this change does not create an unlimited or security-bypassing session.

### Role And Access Behavior

- Owner, Manager, Employee, and Platform Admin authentication lifecycle uses the same renewal path where Cognito API auth is used.
- No role capability, Reports scope, tenant isolation, invitation authorization, or Platform Admin boundary changed.

### Verification And Manual QA

- `corepack pnpm --filter @workmap/web test`: passed, 20/20 tests. The new regression test starts with an expired stored ID token and a stale cached API option, confirms one Cognito refresh request, confirms the API receives the renewed ID token, and confirms the retained refresh token is not discarded.
- `corepack pnpm --filter @workmap/web typecheck`: passed.
- `corepack pnpm --filter @workmap/web lint`: passed; existing Next.js ESLint-plugin detection warning remains informational.
- `corepack pnpm --filter @workmap/web build`: passed; 19 routes generated.
- Real deployed Cognito idle/wake testing was not run because this environment has no authorised production account/session. Automated local session/token behavior passed.

### Intentionally Not Changed

- No Cognito User Pool/App Client policy, refresh-token validity period, MFA, password policy, hosted domain, environment value, backend authentication verifier, RBAC, schema, API contract, Desktop Agent, Browser Extension, Reports calculation, or UI design changed.
- Concurrent unrelated typography/navigation work and untracked `docs/references/` were not modified by this task.

### Remaining Risks And Suggested Next Step

- A user must sign in again after the Cognito refresh token expires, is revoked, the account is disabled, or Cognito rejects renewal. “Keep logged in” cannot safely mean bypassing that final Cognito boundary.
- Deploy the Web change, sign in as one Owner and one Manager, leave each tab beyond the configured ID-token lifetime, then return and verify Dashboard, Reports, and Virtual Office reconnect without an expired-session notice. Also verify explicit Logout still requires a new login.
- The scoped implementation and automated QA pass; the project can proceed to deployed idle/wake acceptance.

---

## 2026-07-07 Virtual Office Workspace Routing Menu

### Original Task Brief

Make the currently inactive Virtual Office brand control in the upper-left corner open a routing menu for Dashboard, Reports, and other existing workspace pages. Change frontend routing only and do not alter anything else.

### Changed Files

- `workmap/apps/web/components/office/VirtualOfficeTopBar.tsx`
- `workmap/apps/web/app/globals.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Converted the static Virtual Office brand surface into an accessible menu button.
- Added Next.js links to Dashboard, Reports, Employees, and Compliance.
- Added open/close chevron feedback, outside-click dismissal, Escape-key dismissal, hover/focus treatment, and mobile menu positioning.

### Role And Access Behavior

No authentication, role, RBAC, tenant, or route-guard behavior changed. Destination pages continue to enforce their existing access behavior.

### Verification

- `corepack pnpm --filter @workmap/web typecheck`: passed.
- `corepack pnpm --filter @workmap/web lint`: passed with the existing Next.js ESLint-plugin warning.
- `corepack pnpm --filter @workmap/web build`: passed; 19 routes generated.
- `git diff --check`: required at closeout.

### Manual QA

Not run. Verify the menu in an authenticated Virtual Office session and follow each destination link.

### Intentionally Not Changed

- No map, movement, presence, realtime, polling, search, people panel, backend, API, auth, data model, or other Virtual Office behavior changed.

### Remaining Risks And Suggested Next Step

- Dashboard remains subject to its existing role access behavior; the routing menu does not bypass route permissions.
- Manually verify desktop/mobile menu placement and each route in the authenticated browser.

---

## 2026-07-07 Manager Reports Access Review

- Original task: confirm whether the current `MANAGER` role can view Reports.
- Changed files: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md` only.
- Result: yes. `MANAGER` has `viewOwnReports`, `viewTeamReports`, and `viewEmployeeActivity` in `packages/auth`.
- Frontend behavior: AppShell exposes `/reports` to Manager; Reports does not redirect Manager; the report panel defaults Manager to company scope, loads the same-tenant employee directory, and allows company, department-filtered, own, or selected-employee views.
- Backend behavior: company summaries/live status require `canViewTeamReports()`, and selected-employee reports require `canViewEmployeeActivity()`. Manager satisfies both. Same-tenant lookup and report audit logging remain enforced.
- Important current boundary: Manager is not automatically restricted to an assigned department/team. With no department filter, Manager can request the whole tenant/company aggregate and can select any same-company employee. Department filtering is optional UI/API filtering, not a Manager scope restriction.
- Employee behavior is separate: the current frontend hides/redirects Employee Reports even though the auth capability table still contains `viewOwnReports` for Employee.
- Verification: source review of role capabilities, AppShell navigation/normalization, Reports access gate/default scope, and ReportsService authorization checks. No runtime test was rerun because no code changed.
- Manual QA: not run.
- Intentionally unchanged: no RBAC, auth, Reports, API, UI, schema, tenant, or Platform Admin behavior changed; `docs/references/` was not touched.
- Next step: no change is required if full-company Manager reporting is intended. If Managers should see only assigned departments/direct reports, that needs a separate explicit RBAC/data-scope implementation round.

---

## 2026-07-07 Global Typography Width And Weight Correction

- Original task: replace the overly thin, condensed typography with the wider, heavier modern sans-serif style shown in the supplied navigation and hero references.
- Changed files: `workmap/apps/web/app/globals.css` and this handoff.
- Implementation: removed the Arial Narrow/Aptos Narrow/Roboto Condensed stack and condensed font stretching; restored a normal-width Inter/Segoe UI/Helvetica system stack and strengthened heading weight.
- Behavior: typography only. Layout logic, navigation behavior, loading, auth, API, RBAC, and backend were not changed.
- Verification: frontend production build and `git diff --check` are required for closeout.
- Manual QA: not run yet.
- Remaining risk: exact glyph shape varies slightly by operating-system font availability; Windows will normally render Segoe UI when Inter is not installed.

---

## 2026-07-07 Top Navigation Square-Corner Follow-up

- Original task: remove the rounded outer corners from the fixed application menu shown in the supplied screenshot.
- Changed files: `workmap/apps/web/app/workspace-redesign.css` and this handoff.
- Implementation: changed the later-loaded editorial navigation override from an 18px radius to zero. Internal navigation items, role pill, logout button, layout, behavior, auth, API, and backend were not changed.
- Verification: CSS diff review and `git diff --check`; no runtime behavior changed.
- Manual QA: not run. Refresh an editorial route such as Employees and confirm the dark bar is square at both outer edges.
- Remaining risk: browser cache may briefly retain the old stylesheet until a hard refresh.

---

## 2026-07-07 Desktop Agent 0.5.3 Download Diagnosis

### Original Task Brief

Determine why an Employee account opened through an invite link downloads Desktop Agent `0.5.3` instead of the locally current `0.5.4`.

### Changed Files

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Finding

- The invite flow does not choose an installer version. All authenticated Employee users reach the same `app/onboarding/device-setup/page.tsx` download button.
- That button reads `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL`, which is embedded into the Web build/deployment.
- The deployed Device Setup HTML at `https://work-map-teal.vercel.app/onboarding/device-setup` currently contains the direct URL `https://github.com/liangceli/WorkMap/releases/download/desktop-agent-v0.5.3/WorkMap-Desktop-Agent-Setup-0.5.3.exe`.
- The public GitHub repository currently has Desktop Agent Releases `0.5.1`, `0.5.2`, and `0.5.3`; no `desktop-agent-v0.5.4` Release or `0.5.4` asset exists there.
- Local source and artifacts are already `0.5.4`, including `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.4.exe`. The mismatch is therefore external release/deployment state, not invite-account behavior or source version drift.

### Role And Access Behavior

No role/access behavior changed. Invite-created Employees and other authorized users use the same deployment-configured installer URL.

### Verification

- Repository search confirmed the Device Setup page reads only `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` and does not contain an account- or invite-specific version branch.
- Deployed Device Setup HTTP request returned 200 and exposed the `desktop-agent-v0.5.3` / `0.5.3.exe` URL.
- GitHub public Releases API showed `desktop-agent-v0.5.3` as the latest Desktop Agent release asset and no `desktop-agent-v0.5.4` release.
- Local source reports package `0.5.4` and pairing identity `desktop-agent-windows/0.5.4`; the local `0.5.4` installer exists.

### Manual QA

No Employee-computer download/install was run. This was a source, deployed-page, and public-release diagnosis.

### Intentionally Not Changed

- No source code, Vercel environment variable, Vercel deployment, GitHub Release, installer asset, Employee account, auth, RBAC, API, schema, or Desktop Agent runtime changed.
- Existing `docs/references/` was not touched.

### Remaining Risk And Suggested Next Step

- Upload `WorkMap-Desktop-Agent-Setup-0.5.4.exe` under GitHub Release tag `desktop-agent-v0.5.4`.
- Set Vercel `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to the direct `0.5.4` asset URL and redeploy Web; changing a build-time public environment variable without redeployment will leave the old `0.5.3` URL in the deployed bundle.
- After redeployment, inspect the deployed button URL and download/install on the Employee computer before claiming the upgrade is live.

---

## 2026-07-06 Frontend Loading, Fixed Navigation, Typography, And Developer-Copy Pass

### Original Task Brief

Add a rotating-logo full-page loading overlay, add a section loader while Employees data loads, pin the main menu to the top edge, replace broad heavy typography with a taller condensed style, and hide developer-facing Cognito/frontend/backend status text. Change frontend presentation only.

### Changed Files

- `workmap/apps/web/app/loading.tsx`
- `workmap/apps/web/app/globals.css`
- `workmap/apps/web/app/employees/page.tsx`
- `workmap/apps/web/components/ui/WorkMapLoader.tsx`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/employees/EmployeeDirectory.tsx`
- `design-qa.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added an accessible reusable WorkMap loading treatment for route-level full-screen loading and Employees section loading.
- Connected both loaders to existing route/session/directory loading lifecycles without artificial delays.
- Fixed the main application navigation to the viewport top and added responsive content offsets.
- Applied a condensed system-font stack and tighter display typography.
- Removed the global Cognito/API session diagnostic notice, simplified the role badge, removed the Employees backend-directory notice, and replaced the visible backend-directory row label with user-facing wording.

### Role And Access Behavior

No role, authentication, API, tenant, or RBAC behavior changed. Existing role-based navigation filtering and logout behavior remain intact.

### Verification

- `corepack pnpm --filter @workmap/web typecheck`: passed.
- `corepack pnpm --filter @workmap/web lint`: passed, with the existing Next.js ESLint-plugin warning.
- `corepack pnpm --filter @workmap/web build`: passed; 19 routes generated.
- Browser screenshot comparison: blocked because no in-app browser instance was available.

### Manual QA

Not run. Confirm fixed-nav spacing, responsive menu height, font fallback, and both loading states in the user's browser.

### Intentionally Not Changed

- No backend, API contract, database, auth, Cognito implementation, RBAC, tenant isolation, reports calculation, tracking, or Virtual Office behavior changed.
- No artificial request delay or new dependency was added.

### Remaining Risks And Suggested Next Step

- Condensed typography depends on installed system fonts and may fall back to Inter/system sans on some devices.
- Visual QA remains required in the authenticated browser, especially at desktop, tablet, and mobile widths.

---

## Original Task Brief

Preserve the agreed activity-monitoring principles as a durable framework for later WorkMap optimization, while keeping current development focused on completing core product functionality.

## Changed Files

- `docs/skills/activity-monitoring-compliance-skill.md`
- `docs/skills/README.md`
- `docs/ai-handoff/latest-implementation.md`

## Implementation Summary

- Added a deferred compliance-by-design framework for privacy-minimised foreground application and domain-duration monitoring.
- Recorded the approved collection boundary, permanently prohibited categories, company-device restriction, employee notice and acknowledgement, visible Agent and pause/stop controls, 09:00-17:00 local schedule enforcement, employee own-data access, Owner access auditing, report wording, data governance, evidence integrity, contracts, legal review, implementation sequence, and release gate.
- Explicitly states that WorkMap provides telemetry rather than hours-worked, productivity, misconduct, disciplinary, or termination decisions.
- Marked the framework as deferred so it does not interrupt current core-feature development.

## Role And Access Behavior

No runtime role or access behavior changed. The future framework preserves Employee own-data access, audited authorized Owner/manager access, tenant isolation, and no employee-level activity for Platform Admin by default.

## Verification

- Documentation-only diff review.
- `git diff --check` must pass before closeout.
- No application typecheck, lint, build, or tests are required because runtime code was not changed.

## Manual QA

Not run. This round does not change application behavior.

## Intentionally Not Changed

- No monitoring, Agent, browser extension, API, report, database, auth, virtual-office, deployment, or RBAC behavior changed.
- The deferred framework was not implemented in product code.
- `docs/ai-handoff/director-update.md` and `docs/skills/current-status.md` were not changed.

## Remaining Risks And Next Step

- This framework is not legal advice and cannot guarantee zero legal risk.
- Laws and regulator guidance must be rechecked when implementation resumes.
- Continue core product functionality work now. Apply the framework only after core functionality is complete and before broad production monitoring.

---

## 2026-07-04 Codex Takeover Addendum

### Original Task Brief

Read the WorkMap documentation under `docs/ai-handoff`, `docs/ai-skills`, and `docs/api`, understand the project, and formally take over future repository work.

### Changed Files

- `docs/ai-handoff/codex-takeover-2026-07-04.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Reviewed the requested documentation, the mandatory current skill references, repository structure, package scripts, Prisma model list, recent Git history, and pre-existing working-tree changes.
- Added a durable takeover baseline covering repository boundaries, source-of-truth ordering, current architecture, privacy/RBAC constraints, deployment state, documentation drift, known working-tree ownership, and future operating procedure.
- Preserved the user's existing uncommitted compliance-framework documentation without reverting or recharacterising it as runtime functionality.

### Role And Access Behavior

No runtime behavior changed. Existing Owner, Employee, tenant RBAC, and independent Platform Admin privacy boundaries remain unchanged.

### Verification

- Documentation and diff review only.
- `git diff --check`: passed.
- Scoped secret scan excluding environment files, dependencies, build/generated outputs, TypeScript build metadata, and reference-only directories: passed with zero matching files.
- Application typecheck, lint, build, and tests were not run because no runtime files changed.

### Manual QA

Not run. This was a repository/documentation takeover round with no UI or runtime change.

### Intentionally Not Changed

- No application code, API, Prisma schema/migration, auth, RBAC, tracking, Virtual Office, deployment configuration, generated artifact, or external platform state changed.
- No existing user modifications or untracked reference files were deleted, reverted, or committed.

### Remaining Risks And Suggested Next Step

- Older May/June documentation contains stale implementation statements; future work must verify code and recent handoffs before relying on those claims.
- Desktop Agent external publication, signing, deployment URL update, and separate-machine manual QA remain release concerns.
- Codex can proceed to the next round once a concrete implementation, QA, or release task is supplied.

---

## 2026-07-04 Desktop Agent Timing Status Review

- Original request: confirm whether the repository records the current employee-computer Desktop Agent application-duration testing status.
- Changed files: handoff documentation only; no runtime files changed.
- Result: the implementation and automated tests cover one-second foreground sampling, five-second minimum segments, app switching, idle/lock transitions, delayed-sample caps, shutdown flush, checkpoint recovery, and UTC day rollover.
- Manual QA status: real separate-Windows-employee-computer verification is explicitly still pending for installer/pairing, foreground versus minimized/background exclusion, short-app exclusion, Owner live report comparison, graceful stop, and forced interruption.
- Verification: source and documentation review only; no tests were rerun.
- Intentionally unchanged: Desktop Agent, API, reports, schema, auth, deployment, and tracking rules.
- Next step: run a timed real-device comparison matrix and record observed versus reported durations before claiming tracking accuracy is validated.

---

## 2026-07-06 Desktop Agent Foreground Timing And Owner Report Sync Fix

### Original Task Brief

Investigate and fix inaccurate Desktop Agent application-duration reporting, especially the case where an Employee keeps Microsoft Store focused for a long time but the Owner report does not update. Count only the visible focused application; minimized and background applications must not add active time. Keep the change strictly inside Desktop Agent app timing and Owner Reports synchronization.

### Changed Files

- Desktop Agent version, runtime heartbeat, Windows foreground adapter, Alpha adapter copy, and targeted tests under `workmap/apps/desktop-agent/`.
- Reports live-status controller/service and tracking/report regression test under `workmap/apps/api/`.
- Reports live overlay, API types/client, page polling, and targeted tests under `workmap/apps/web/`.
- `docs/skills/api-contract-skill.md`, `docs/skills/frontend-skill.md`, `docs/ai-handoff/latest-implementation.md`, and `docs/ai-handoff/latest-qa.md`.

### Implementation Summary

- Root cause 1: completed app usage was uploaded only on app switch, idle/lock transition, or Agent shutdown. A continuously focused app therefore remained only in the live Agent Session and was absent from persisted app summary rows.
- Root cause 2: Owner's default company report did not poll live Agent Session data; only selected-user status was polled.
- Root cause 3: UWP applications such as Microsoft Store may be hosted by `ApplicationFrameHost`, causing the host process to be reported instead of the actual child application process.
- Desktop Agent `0.5.1` still samples the visible foreground window at the existing one-second cadence, excludes iconic/minimized windows, ignores background processes, separates idle state, and rejects completed segments shorter than five seconds.
- The Windows adapter now resolves the child application process when the foreground host is `ApplicationFrameHost`, without reading window titles or content.
- App transitions now trigger an immediate heartbeat before the next scheduled ten-second heartbeat, keeping the server-side current foreground state aligned with newly completed events.
- `/reports/agent-status` now supports authorized company/department live foreground aggregates as well as selected-user status. It includes only fresh, open, non-idle foreground segments of at least five seconds and preserves tenant, report-role, and department boundaries.
- Usage summaries expose an `activityRevision`; Reports reloads persisted totals when a completed Desktop Agent event changes, while polling the lightweight live overlay every ten seconds.
- Company and individual report presentation adds the still-open foreground segment to app totals, daily active time, and company employee active totals without mutating the persisted base response or repeatedly accumulating the same live duration.
- Reports copy now explicitly says that active time counts only the visible foreground application and excludes minimized/background and idle time.

### Role And Access Behavior

- Employee report access behavior is unchanged.
- Owner/Manager/Team Lead/HR Admin company live reporting still requires `canViewTeamReports()`.
- Individual employee live status still requires existing own-report or `canViewEmployeeActivity()` permission checks.
- Live company data is tenant-scoped and department-scoped when requested. Platform Admin behavior and privacy boundary were not changed.

### Verification

- Desktop Agent test: 14/14 passed.
- Desktop Agent typecheck, lint, Alpha build, and Windows NSIS build: passed.
- API test: 9/9 passed, including live Microsoft Store company aggregation and idle exclusion.
- API typecheck, lint, and build: passed.
- Web test: 14/14 passed, including live Microsoft Store overlay and no-active-foreground exclusion.
- Web typecheck, lint, and production build: passed; 19 routes generated.
- Windows foreground PowerShell adapter compile/execution smoke: passed; the non-interactive test session correctly returned no foreground app.
- `git diff --check`: passed.
- Scoped secret scan: passed with zero matching files.
- Privacy capability scan found no prohibited collection implementation; its only text match was the existing user-facing sentence stating that those categories are not collected.
- Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.1.exe`, 91,935,806 bytes, SHA-256 `E5612B565E6CEE05D99B60BFB46F1FCC02420DADE9DC869A299AB3FBC08800C4`.

### Manual QA

Not run on the separate Employee Windows computer. The real-device timed comparison remains required after API/Web deployment and installation of Agent `0.5.1`.

### Intentionally Not Changed

- No Prisma schema or migration.
- No authentication architecture, Cognito flow, device credential model, tenant isolation, RBAC capability, Platform Admin behavior, activity retention, domain tracking, Virtual Office, integrations, or unrelated UI changes.
- No screenshots, window titles, full URLs, keystrokes, clipboard, camera, microphone, file contents, page contents, form/password data, email bodies, or private message content were added.

### Remaining Risks And Suggested Next Step

- The new installer is Authenticode `NotSigned`; Windows SmartScreen can still warn.
- Live report display is bounded by one-second Agent sampling, ten-second heartbeat/polling, network latency, and server clock handling. Persisted completed durations remain event-based.
- Publish/deploy the updated API and Web, publish the `0.5.1` installer under a new release URL, update `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL`, install it on the Employee test computer, then compare stopwatch time against Employee/Owner reports for Microsoft Store, a normal desktop app, minimize/background, idle/lock, rapid under-five-second use, app switching, graceful stop, and forced interruption.

---

## 2026-07-06 UI/UX Pro Max Repository Review

### Original Task Brief

Review `nextlevelbuilder/ui-ux-pro-max-skill`, summarize its benefits, and explain how to use it.

### Changed Files

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Reviewed the upstream repository README, skill instructions, CLI package metadata, installation workflow, supported stacks, design-system persistence model, license, and stated limitations.
- Determined that the project is an AI-assistant design knowledge/search skill rather than a frontend component library or ready-made WorkMap theme.
- No third-party package was installed and no application code was changed.

### Role And Access Behavior

No runtime, authentication, tenant, Owner, Employee, or Platform Admin behavior changed.

### Verification

- Source review against the upstream GitHub repository completed.
- Documentation diff review and `git diff --check` are the relevant local checks.
- Frontend/API checks were not run because runtime code was not changed.

### Manual QA

Not run. The external skill was reviewed but not installed or executed.

### Intentionally Not Changed

- No WorkMap frontend, design tokens, dependencies, AI skills, backend, auth, schema, deployment, or RBAC behavior changed.
- The external CLI was not installed because the request was for evaluation and usage guidance only.

### Remaining Risks And Suggested Next Step

- Upstream recommendations are heuristic and still require accessibility, responsive, brand, and product-flow validation.
- If adopted, trial it in a disposable branch or temporary directory first, then compare its output with WorkMap's existing design system before allowing code changes.

---

## 2026-07-06 Local UI/UX Assistant Ignore Rule

### Original Task Brief

Keep the project-local UI/UX Pro Max Codex assistant out of the WorkMap GitHub repository and clarify whether designs created with its help require attribution.

### Changed Files

- `.gitignore`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added the repository-root-anchored `/.codex/` ignore rule.
- This excludes the complete project-local assistant installation created by `uipro init --ai codex`, while leaving global Codex configuration and unrelated paths unchanged.
- Reviewed the upstream MIT license and the additional Apache-2.0 license bundled with the installed `ui-styling` skill for attribution boundaries.

### Role And Access Behavior

No application runtime, authentication, tenant, Owner, Employee, or Platform Admin behavior changed.

### Verification

- `git check-ignore` confirms installed `.codex/skills/` files are ignored.
- `git status --short --untracked-files=all` no longer lists `.codex/` content.
- `git diff --check`: passed.
- Scoped secret scan: passed with no matching files.

### Manual QA

Not applicable. This change affects Git tracking only.

### Intentionally Not Changed

- The installed local assistant files were not deleted or edited.
- `.corepack/` and all unrelated pre-existing application changes were left untouched.
- No WorkMap UI, API, dependency, auth, schema, deployment, or RBAC behavior changed.

### Remaining Risks And Suggested Next Step

- Normal use of the assistant to generate design ideas does not ordinarily require a public product credit under the reviewed licenses. If WorkMap later copies or redistributes substantial portions of the assistant's source, data, documentation, or licensed templates, preserve the applicable license and notices and obtain legal review for ambiguous cases.
- The next round can proceed; review the staged file list before every push as a final safeguard.

---

## 2026-07-06 Desktop Agent 0.5.1 Release Clarification

- Original request: confirm whether the new Desktop Agent must be updated in GitHub Releases.
- Changed files: this handoff only; no application or deployment state changed.
- Result: yes. Commit `73b248b` contains the 0.5.1 timing/report fix, and the local NSIS installer exists at `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.1.exe` with the recorded SHA-256.
- Required external actions: publish a new GitHub Release asset, point Vercel `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to the direct 0.5.1 asset URL, redeploy Web and API, then reinstall/upgrade the Employee computer before timed QA.
- Verification: repository history, installer existence, byte size, and SHA-256 were checked; no upload or external configuration was performed.
- Manual QA: not run.
- Intentionally unchanged: GitHub, Vercel, Render, employee computers, source code, auth, schema, and RBAC.
- Remaining risk: the installer is unsigned, and old download URLs or cached 0.5.0 installers will not contain the fix.

---

## 2026-07-06 Desktop Agent Download URL Diagnosis

- Original request: determine why the Employee download button opens GitHub but does not download the EXE.
- Changed files: this handoff and QA handoff only; no source or external configuration changed.
- Root cause: the deployed Vercel page currently embeds `https://github.com/liangceli/WorkMap/releases/download/desktop-agent-v0.5.0/WorkMap-Desktop-Agent-Setup-0.5.1.exe`, combining the old `desktop-agent-v0.5.0` tag with the new `0.5.1` filename.
- Verification: the deployed Device Setup page returned HTTP 200; its embedded mixed-version URL returned HTTP 404. The correct `desktop-agent-v0.5.1` direct asset URL returned HTTP 200 and resolved to GitHub's release-assets host with attachment disposition.
- Required fix: set Vercel `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to `https://github.com/liangceli/WorkMap/releases/download/desktop-agent-v0.5.1/WorkMap-Desktop-Agent-Setup-0.5.1.exe` for the active deployment environment and redeploy Web.
- Manual QA: not run on the Employee computer.
- Intentionally unchanged: source code, GitHub Release assets, Vercel settings, Render/API, auth, schema, and RBAC.
- Remaining risk: Vercel environment variables are embedded at build time, so changing the value without redeploying will leave the old broken URL in the website bundle.

---

## 2026-07-06 Reports Screenshot Visual Triage

- Original request: review the latest Owner/company aggregate report screenshot and identify obvious issues from the displayed result only.
- Changed files: this handoff only; no runtime source files or external configuration changed.
- Observation: `WinStore.App` is now present in the Apps list with a small active duration, which suggests the UWP/Microsoft Store foreground identification path is at least reaching the report instead of being completely absent.
- Potential issue: `Microsoft Windows Operating System` shows a much larger active duration than the visible user-facing applications. This may be legitimate if Settings/Start/system UI was truly focused for much of the test, but it is also the clearest suspicious signal because it can indicate a Windows shell/host/system process is still being classified as a foreground app.
- Potential issue: `WorkMap Desktop Agent` appears as active for several minutes. This is expected only if the Agent window/setup UI was actually foreground for that time; otherwise it may be noise from testing/pairing flow.
- Interpretation: the screenshot is not enough to prove the timing fix is accurate. It does show that Owner reports can receive app rows including Microsoft Store-style UWP identity, but a stopwatch/manual matrix is still needed to confirm focused-only timing, minimized/background exclusion, and live update latency.
- Verification: visual/read-only review only. No automated tests were rerun and no browser/API/Agent logs were inspected in this round.
- Manual QA: the screenshot is partial manual evidence, not a completed acceptance pass.
- Intentionally unchanged: no Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, or GitHub/Vercel settings were changed.
- Remaining risk and suggested next step: run a controlled timed test with one focused app at a time, including Microsoft Store, Chrome, minimize/background, idle, and app switching. If `Microsoft Windows Operating System` keeps dominating while a normal app is visibly focused, inspect the raw `/reports/agent-status` response and Desktop Agent foreground samples for the exact `processName`/`appName` mapping.

---

## 2026-07-06 App Time Calculation Workflow Explanation

- Original request: explain concisely how the current project calculates app usage time.
- Changed files: this handoff only; no runtime source files changed.
- Summary explained to user: the Desktop Agent samples the visible foreground window about once per second, ignores minimized/background windows, separates idle/lock time, finalizes a segment when the foreground app changes or idle/lock/stop occurs, sends completed app-usage events to the API, and sends current foreground session heartbeat data for live report overlay.
- Report behavior explained: persisted `/reports/usage-summary` stores completed segments; `/reports/agent-status` adds the still-open fresh foreground segment so Owner reports can show currently focused app time before the user switches apps.
- Boundary explained: only the visible focused app should count as active time; background/minimized apps should not add active duration; idle time is separate and is not active app use.
- Verification: documentation/read-only explanation only; no code, tests, deployment, or live device checks were run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, and Vercel settings.
- Remaining risk: real-device timing accuracy still needs stopwatch/manual matrix verification, especially for Microsoft Store/UWP and suspicious system-process rows.

---

## 2026-07-06 Idle Meaning Clarification

- Original request: clarify what `idle` time means in app reports.
- Changed files: this handoff only; no runtime source files changed.
- Explanation given: `idle` means the employee computer/user appears inactive, such as no keyboard or mouse input for the configured idle threshold or the device being locked. It is not an app and does not mean a background/minimized app is being actively used.
- Report meaning: app `active` time should represent visible foreground use; app `idle` time represents time associated with an idle/away period and should not be counted as active app use.
- Examples: leaving Chrome focused and walking away should stop adding Chrome active time after the idle threshold and show idle separately; minimizing Chrome and using another app should count the other foreground app, not Chrome.
- Verification: documentation/read-only explanation only; no code, tests, deployment, or live device checks were run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, and Vercel settings.
- Remaining risk: the exact user-facing wording may need UI copy adjustment later if `idle` is confusing during pilot testing.

---

## 2026-07-06 Keyboard And Mouse Monitoring Boundary Clarification

- Original request: clarify whether WorkMap currently monitors mouse and keyboard activity.
- Changed files: this handoff and QA handoff only; no runtime source files changed.
- Answer given: WorkMap does not currently monitor, record, or upload keystrokes, typed content, mouse clicks, mouse movement paths, clicked coordinates, or per-key/per-click events.
- Technical boundary confirmed: the Windows Desktop Agent uses the OS-level `GetLastInputInfo` value only to calculate how long it has been since the last keyboard/mouse input, for idle detection. This gives an elapsed idle duration, not the actual key, mouse button, coordinates, target UI, or input content.
- Search scope: reviewed project handoff/skills and searched `workmap/apps/desktop-agent`, `workmap/apps/api`, `workmap/apps/web`, and `workmap/packages` for keyboard/mouse/hook-related terms. Found `GetLastInputInfo` idle usage and privacy copy saying keystrokes are not collected; did not find keylogger-style APIs such as `GetAsyncKeyState`, `SetWindowsHookEx`, or `WH_KEYBOARD`.
- Role/access behavior: no runtime, Owner/Employee, Platform Admin, tenant, auth, or RBAC behavior changed.
- Verification: source search/read-only review only; no automated test suite, deployment, or live-device QA was run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, compliance copy, schema, auth, RBAC, deployment, GitHub Release, and Vercel settings.
- Remaining risk: if future work changes idle detection or input-related APIs, preserve the privacy boundary that only idle duration may be inferred and no key/mouse event details are collected.

---

## 2026-07-06 Owner App Usage Metric Semantics Clarification

- Original request: clarify whether Owner reports can show per-app `focus active` time and a separate total app time, especially for multi-monitor cases, without monitoring keyboard/mouse events beyond `GetLastInputInfo`.
- Changed files: this handoff only; no runtime source files changed.
- Answer given: the desired `focus active` behavior is feasible without keylogging or mouse-event monitoring by using the Windows foreground window as the app attribution boundary plus `GetLastInputInfo` for idle detection.
- Multi-monitor rule: Windows still has one foreground/focused window system-wide. If App A is visible on one monitor while the employee actively works in App B on another monitor, App B is the foreground app; App A should receive zero `focus active` time for that period.
- Proposed `focus active` definition: count time only when the app is the foreground window, visible/not minimized, and the device has had input within the configured 30-second idle threshold. Once `GetLastInputInfo` reports no input for 30 seconds, stop adding `focus active` time until input resumes and the foreground app is known.
- Important terminology decision: a separate metric that includes minimized/background/visible-but-not-focused time should not be called `active usage`. It is better labeled as `open time`, `running time`, or `app runtime`, because it may include apps the employee is not actually using.
- Current implementation boundary: the current project mainly reports completed app/domain usage plus live foreground overlay. It does not yet implement a separate background/minimized runtime metric or a distinct `focus active` versus `open/runtime` report contract.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, Vercel settings, and privacy/compliance copy.
- Remaining risk: the phrase “total active time including background/minimized” conflicts with the desired rule that App A should not count as usage while App B is operated. Future implementation should separate `focus active` from optional `open/runtime` instead of merging background/minimized time into active usage.

---

## 2026-07-06 Per-App Time Metric Naming Clarification

- Original request: briefly explain how many per-app time metrics Owner reports should use, what they should be called, and what time each includes.
- Changed files: this handoff only; no runtime source files changed.
- Recommended metrics:
  - `Focus active time`: the main actual-use metric. Includes only time when the app is the Windows foreground/focused window, visible/not minimized, and the employee has input within the 30-second idle threshold.
  - `Focused idle time`: includes time when the app is still the foreground/focused visible window, but `GetLastInputInfo` shows no employee input for at least 30 seconds. This is not active use.
  - `Open/runtime time`: optional auxiliary metric. Includes time when the app/process/window is open or running, including foreground, visible-but-not-focused, background, and minimized states. This should not be labeled as active usage.
- Reporting guidance: Owner should treat `Focus active time` as the primary usage number. `Focused idle time` and `Open/runtime time` are context/debug/availability numbers, not proof of employee app use.
- Verification: documentation-only clarification; no code/tests/deployment/live-device checks run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, Vercel settings, and privacy/compliance copy.
- Remaining risk: current runtime/report contract does not yet expose these three metrics as separate fields; implementing them later will require scoped Desktop Agent/API/Web changes.

---

## 2026-07-06 Per-App 50-Second No-Input Example

- Original request: calculate the three proposed per-app time metrics when an app is open for 50 seconds with no further input.
- Changed files: this handoff only; no runtime source files changed.
- Normal assumption: the employee opened/focused the app with a click or keyboard action at second 0, then provided no further input for 50 seconds.
- Result under the 30-second idle threshold:
  - `Focus active time`: 30 seconds.
  - `Focused idle time`: 20 seconds.
  - `Open/runtime time`: 50 seconds.
- Edge case: if the device was already idle before the app became focused through a non-user-input mechanism, then `Focus active time` would be 0 seconds, `Focused idle time` would be 50 seconds, and `Open/runtime time` would be 50 seconds.
- Verification: documentation-only clarification; no code/tests/deployment/live-device checks run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, Vercel settings, and privacy/compliance copy.
- Remaining risk: runtime code does not yet expose these three metrics as separate fields; this remains a product-definition example for future implementation.

---

## 2026-07-06 Multi-Monitor Three-App Five-Minute Example

- Original request: calculate the three proposed per-app time metrics when two screens show three open apps for five minutes and the employee works only in App A.
- Changed files: this handoff only; no runtime source files changed.
- Assumption: App A, App B, and App C are all open for the full five minutes; App A remains the Windows foreground/focused app for the full period; the employee continuously provides input while working in App A.
- Result:
  - App A: `Focus active time` = 5 minutes, `Focused idle time` = 0 minutes, `Open/runtime time` = 5 minutes.
  - App B: `Focus active time` = 0 minutes, `Focused idle time` = 0 minutes, `Open/runtime time` = 5 minutes.
  - App C: `Focus active time` = 0 minutes, `Focused idle time` = 0 minutes, `Open/runtime time` = 5 minutes.
- Explanation: visible-but-not-focused apps on another monitor do not receive `Focus active time`. `Focused idle time` only applies to the app that is actually foreground/focused while the device is idle.
- Verification: documentation-only clarification; no code/tests/deployment/live-device checks run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, Vercel settings, and privacy/compliance copy.
- Remaining risk: runtime code does not yet expose the three proposed metrics as separate fields; this remains a product-definition example for future scoped implementation.

---

## 2026-07-06 Input Attribution Boundary Clarification

- Original request: explain how WorkMap would distinguish whether mouse/keyboard activity is targeted at App A.
- Changed files: this handoff only; no runtime source files changed.
- Answer: WorkMap should not try to identify the target of each mouse or keyboard event. Under the privacy boundary, `GetLastInputInfo` provides only a device-level “seconds since last input” value and does not reveal the key, mouse click, coordinates, target control, or target application.
- Attribution method: combine global input freshness with the Windows foreground/focused window. If there was recent input and App A is the foreground/focused window at the sample time, attribute that sampled time to App A `Focus active time`.
- Multi-monitor implication: if App B is the foreground/focused window while App A is visible on another screen, recent input is attributed to App B for focus-active purposes, not to App A.
- Important caveat: this is focus-based attribution, not event-target attribution. Hovering over or visually looking at App A while App B remains foreground does not count as App A focus-active time.
- Verification: documentation-only clarification; no code/tests/deployment/live-device checks run.
- Manual QA: not run.
- Intentionally unchanged: Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, GitHub Release, Vercel settings, and privacy/compliance copy.
- Remaining risk: if future implementation needs true per-click/per-key target attribution, it would require expanding the privacy boundary and should not be added without explicit product/legal approval.

---

## 2026-07-06 App Duration Calculation Implementation Plan

- Original request: provide the full plan for the app-duration calculation mechanism, including per-app metrics, how each metric is calculated, how WorkMap identifies the actively worked app, and edge cases.
- Changed files: this handoff only; no runtime source files changed.
- Scope of the future implementation plan: Desktop Agent foreground/runtime sampling, API ingestion/report contract, Owner/Employee report presentation, and focused manual QA. It should not change auth, RBAC, tenant isolation, Platform Admin privacy, domain tracking, virtual office, deployment, or unrelated UI.
- Planned per-app metrics:
  - `Focus active time`: primary actual-use metric. Count sampled time only when the app is the Windows foreground/focused app, visible/not minimized, and global idle age from `GetLastInputInfo` is below 30 seconds.
  - `Focused idle time`: count sampled time when the app is still foreground/focused and visible/not minimized, but global idle age is at least 30 seconds.
  - `Open/runtime time`: optional auxiliary metric. Count time when the app/window/process is open or running, including foreground, visible-but-not-focused, background, and minimized states. Do not label this as active usage.
- Planned app attribution rule: WorkMap should not monitor per-key/per-click targets. It should combine `GetLastInputInfo` input freshness with Windows foreground/focus identity. If recent input exists and App A is foreground at the sample time, assign that sampled `Focus active time` to App A.
- Planned multi-monitor behavior: only the single Windows foreground/focused app receives `Focus active time`. Apps visible on other monitors but not focused receive zero `Focus active time`; if runtime tracking is implemented, they can receive `Open/runtime time`.
- Planned idle behavior: when the foreground app remains focused but input age reaches 30 seconds, stop adding `Focus active time` and start adding `Focused idle time` for that foreground app until input resumes, focus changes, lock occurs, or the app closes.
- Planned minimized/background behavior: minimized/background apps never receive `Focus active time` or `Focused idle time`. They may receive `Open/runtime time` only if that auxiliary metric is implemented and clearly labeled.
- Planned event/segment handling:
  - Sample foreground state at about one-second cadence.
  - Create/continue segments keyed by app identity and state (`focus_active`, `focused_idle`, optionally `open_runtime`).
  - Split segments on foreground app change, idle threshold crossing, lock/unlock, minimize/restore, app close, Agent stop, or day boundary.
  - Preserve existing short-segment filtering only for noisy focus-active foreground fragments; avoid dropping meaningful runtime/idle context without an explicit rule.
- Planned app identity handling: prefer user-facing app/process identity already used by the current Windows foreground adapter, including the existing UWP/ApplicationFrameHost child-process resolution. Do not collect window titles or content.
- Planned API/report contract direction: expose separate fields such as `focusActiveSeconds`, `focusedIdleSeconds`, and optionally `openRuntimeSeconds`; keep old `activeSeconds` compatibility only if needed, mapping it to `focusActiveSeconds` rather than background/minimized time.
- Planned Owner report display: make `Focus active` the main number. Show `Focused idle` and optional `Open/runtime` as secondary context. Copy should say background/minimized/open time is not proof of active use.
- Planned Employee report display: use the same definitions for own-data transparency, with clear wording that WorkMap does not collect keystrokes, clicks, screenshots, contents, or per-input targets.
- Planned verification matrix:
  - One focused normal desktop app for five minutes with continuous input.
  - Focused app left untouched for 50 seconds.
  - Two monitors with App A focused while B/C remain visible/open.
  - Minimized app while another app is used.
  - Background app/process running while another app is used.
  - Microsoft Store/UWP foreground timing.
  - Lock/unlock and idle threshold crossing.
  - Rapid app switching under/over short-segment threshold.
  - Graceful Agent stop and forced interruption.
  - Owner company aggregate and Employee own report comparison against stopwatch.
- Explicit non-goals: no keyboard/mouse event logging, no click coordinates, no typed content, no screenshots, no window titles/content, no per-input target attribution, no productivity scoring, and no Platform Admin employee-level activity expansion.
- Verification: documentation-only plan; no code/tests/deployment/live-device checks run.
- Manual QA: not run.
- Remaining risk: `Open/runtime time` may overcount always-running apps if implemented via process enumeration; future implementation should either make it optional/secondary or clearly distinguish window runtime from background service/runtime.

---

## 2026-07-06 App Duration Three-Metric Implementation

- Original task brief: strictly compare the current APP timing behavior against the agreed rules, change only the app-duration area if needed, and update the Owner report UI so each app clearly shows the three metrics with clear visual/state distinction.
- Changed files:
  - `workmap/apps/desktop-agent/package.json`
  - `workmap/apps/desktop-agent/src/pairing.ts`
  - `workmap/apps/desktop-agent/src/types.ts`
  - `workmap/apps/desktop-agent/src/windowsForeground.ts`
  - `workmap/apps/desktop-agent/src/trackingState.ts`
  - `workmap/apps/desktop-agent/src/runtime.ts`
  - `workmap/apps/desktop-agent/scripts/windows-foreground.ps1`
  - `workmap/apps/desktop-agent/alpha-windows/scripts/windows-foreground.ps1`
  - `workmap/apps/desktop-agent/test/queue-api.test.ts`
  - `workmap/apps/desktop-agent/test/tracking-state.test.ts`
  - `workmap/apps/desktop-agent/test/windows-adapter.test.ts`
  - `workmap/apps/api/src/modules/activity/activity.service.ts`
  - `workmap/apps/api/src/modules/reports/reports.service.ts`
  - `workmap/apps/api/test/tracking-reports-verification.test.ts`
  - `workmap/apps/web/lib/api/activityApi.ts`
  - `workmap/apps/web/lib/api/apiTypes.ts`
  - `workmap/apps/web/components/reports/liveUsage.ts`
  - `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
  - `workmap/apps/web/app/reports/page.tsx`
  - `workmap/apps/web/test/reports-live-usage.test.ts`
  - `docs/api/activity-ingestion-contract.md`
  - `docs/skills/api-contract-skill.md`
  - `docs/skills/frontend-skill.md`
  - `docs/ai-handoff/latest-implementation.md`
  - `docs/ai-handoff/latest-qa.md`
- Implementation summary:
  - Desktop Agent now emits foreground app segments with `isActiveWindow: true` and separate open/runtime app segments with `isActiveWindow: false`.
  - Foreground segments still use the current Windows foreground/focused window plus `GetLastInputInfo` idle state. This preserves the rule that only the app currently receiving Windows focus can receive focus-active time.
  - Runtime/open segments are built from visible top-level Windows app windows, including minimized windows where Windows still exposes the top-level window. These segments roll every 10 seconds by default through `WORKMAP_AGENT_RUNTIME_SEGMENT_MS`.
  - The Windows adapter still does not collect window titles, document names, content, screenshots, keystrokes, clicks, mouse coordinates, or per-input targets.
  - API ingestion now stores all APP raw events, but only `isActiveWindow: true` events update app active/idle summaries.
  - API reports now expose app rows with `focusActiveSeconds`, `focusedIdleSeconds`, and `openRuntimeSeconds`; legacy `activeSeconds` maps to focus-active and legacy `idleSeconds` maps to focused-idle.
  - Runtime-only apps can appear in the Apps list with zero focus-active/focused-idle time and nonzero open/runtime time.
  - Reports live overlay now handles both current focus-active and current focused-idle app time.
  - Web Reports app rows now display three clear chips: `Focus active` in success/green, `Focused idle` in warning/amber, and `Open/runtime` in info/blue.
  - Desktop Agent version was bumped to `0.5.2`.
- Role/access behavior:
  - Owner/Manager company report access remains controlled by the existing report permission checks.
  - Employee own-report access remains unchanged.
  - Platform Admin, auth, tenant isolation, RBAC, device ownership checks, and schema were not changed.
- Verification commands and results:
  - `corepack pnpm --filter @workmap/desktop-agent test`: passed, 15/15.
  - `corepack pnpm --filter @workmap/api test -- tracking-reports-verification`: passed, 9/9.
  - `corepack pnpm --filter @workmap/web test -- reports-live-usage`: passed, 15/15.
  - `corepack pnpm --filter @workmap/desktop-agent typecheck`: passed.
  - `corepack pnpm --filter @workmap/api typecheck`: passed after transaction operation typing was corrected.
  - `corepack pnpm --filter @workmap/web typecheck`: passed.
  - `corepack pnpm --filter @workmap/desktop-agent lint`: passed.
  - `corepack pnpm --filter @workmap/api lint`: passed.
  - `corepack pnpm --filter @workmap/web lint`: passed.
  - `corepack pnpm --filter @workmap/desktop-agent build`: passed.
  - `corepack pnpm --filter @workmap/api build`: passed.
  - `corepack pnpm --filter @workmap/web build`: passed; existing Next ESLint plugin warning only.
  - Scoped changed-file secret scan: passed, no matching secret patterns found.
  - `git diff --check`: passed.
- Manual QA results:
  - Not run on a real Employee Windows computer.
  - Not visually checked in a browser after the UI chip update.
- What was intentionally not changed:
  - No database schema migration.
  - No auth/RBAC/tenant isolation/Platform Admin boundary changes.
  - No domain tracking behavior change.
  - No screenshots, screen recording, window title/content collection, keystroke/click logging, mouse coordinate tracking, or per-input target attribution.
  - No GitHub Release upload or deployed Employee computer update was performed.
- Remaining risks:
  - Open/runtime is window-runtime context, not proof of active use. It can include apps that are open/minimized but not being worked in.
  - True background services/processes without a visible top-level window are intentionally not treated as reliable per-app runtime in this implementation.
  - Microsoft Store/UWP and multi-monitor behavior still need stopwatch QA on the real Employee computer after the new Agent is released/installed.
  - Existing historical report data will not be retroactively split into the new three metrics; old app rows map `activeSeconds` to focus-active and `idleSeconds` to focused-idle.
- Suggested next steps:
  - Publish/build a new Desktop Agent `0.5.2` installer and install it on the Employee computer.
  - Deploy API/Web changes together with the Agent release.
  - Run the planned manual timing matrix: focused app, 50-second no-input idle, two-monitor A/B/C, minimized app, Microsoft Store/UWP, lock/unlock, and Owner/Employee report comparison against stopwatch.

---

## 2026-07-06 Desktop Agent 0.5.2 Installer Artifact

- Original task brief: clarify why `desktop-agent-v0.5.2` is not visible and why the project still appears to have `0.5.1`.
- Finding:
  - Desktop Agent source version is `0.5.2` in `workmap/apps/desktop-agent/package.json`.
  - Desktop Agent pairing version is `desktop-agent-windows/0.5.2` in `workmap/apps/desktop-agent/src/pairing.ts`.
  - Before this round, the local installer artifact had not been generated; `workmap/artifacts/desktop-agent/` still only contained the previous `0.5.0` and `0.5.1` installers.
  - `workmap/artifacts/` is ignored by `workmap/.gitignore`, so generated installers do not show as git changes and are not automatically published to GitHub Releases.
- Changed/generated files:
  - Generated ignored local artifact: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.2.exe`
  - Generated ignored local blockmap: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.2.exe.blockmap`
  - Updated handoff docs only.
- Artifact details:
  - Installer path: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.2.exe`
  - Installer size: 91,936,597 bytes.
  - SHA-256: `DD5A34F962BF7ADF1F0DE809F01D187632BFA4298B634EACA7E8113793955446`
  - Authenticode status: `NotSigned`.
- Verification commands and results:
  - `corepack pnpm --filter @workmap/desktop-agent release:windows`: passed and generated the NSIS installer.
  - `Get-Item workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.2.exe`: confirmed file exists.
  - `Get-FileHash -Algorithm SHA256 ...0.5.2.exe`: produced the SHA-256 above.
  - `Get-AuthenticodeSignature ...0.5.2.exe`: confirmed `NotSigned`.
  - `git check-ignore -v ...0.5.2.exe`: confirmed artifact is ignored by `workmap/.gitignore` rule `/artifacts`.
- Manual QA:
  - Not run on the Employee computer.
  - Not uploaded to GitHub Release.
- What was intentionally not changed:
  - No Desktop Agent source code changes in this round.
  - No API/Web/deployment/auth/schema/RBAC changes.
  - No GitHub Release asset upload and no Vercel environment update.
- Remaining risks and next steps:
  - To make the employee download button use this version, create/upload a GitHub Release asset under tag `desktop-agent-v0.5.2`, set `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to the direct `0.5.2` asset URL, redeploy Web, then reinstall/upgrade the Employee computer.

---

## 2026-07-06 Focused Idle 30-Second Threshold Fix

### Original Task Brief

Investigate why Weixin showed several minutes of focus active/open runtime but zero focused idle after being left open without employee input, and fix only the application-duration calculation area.

### Changed Files

- `workmap/apps/desktop-agent/src/windowsForeground.ts`
- `workmap/apps/desktop-agent/src/runtime.ts`
- `workmap/apps/desktop-agent/scripts/windows-foreground.ps1`
- `workmap/apps/desktop-agent/alpha-windows/scripts/windows-foreground.ps1`
- `workmap/apps/desktop-agent/test/windows-adapter.test.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/src/pairing.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

Generated but git-ignored release artifacts:

- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.3.exe`
- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.3.exe.blockmap`

### Implementation Summary

- Root cause: the Windows foreground adapter, runtime fallback, and PowerShell scripts still used a 300-second/five-minute idle threshold. This contradicted the agreed 30-second rule, so an app left focused for only a few minutes continued to be reported as focus active and showed zero focused idle.
- Added one shared TypeScript default, `DEFAULT_IDLE_THRESHOLD_SECONDS = 30`, and made both the adapter and runtime fallback use it.
- Updated the production and Alpha Windows sampling scripts to default to 30 seconds.
- Added a regression test that fixes the TypeScript, production-script, and Alpha-script threshold contract at 30 seconds.
- Bumped the Desktop Agent and pairing client version from `0.5.2` to `0.5.3` so the corrected binary cannot be confused with the previously built five-minute-threshold installer.
- No API or Web runtime change was required: their existing aggregation/live-overlay logic already preserves a current focused-idle segment and displays it separately.

### Key Behavior And Role/Access Impact

- While an app remains the Windows foreground app, global `GetLastInputInfo` inactivity reaching 30 seconds now moves that foreground segment from focus active to focused idle.
- Time after that transition increases focused idle and open/runtime, but does not increase focus active. New keyboard or mouse input returns the current foreground app to focus active.
- Background and minimized apps still do not gain focus active or focused idle; they can contribute only to clearly labeled open/runtime context while detected as open.
- Owner/Employee report permissions, tenant isolation, report scope, and Platform Admin privacy boundaries are unchanged.
- No keystrokes, mouse events, window titles, screenshots, or content are collected; only the OS-provided elapsed time since the last input is read.

### Verification

- `pnpm --filter @workmap/desktop-agent test`: passed, 16/16.
- `pnpm --filter @workmap/desktop-agent typecheck`: passed.
- `pnpm --filter @workmap/desktop-agent lint`: passed.
- `pnpm --filter @workmap/desktop-agent build`: passed.
- `pnpm --filter @workmap/api test`: passed, 9/9, including live focused-idle aggregation.
- `pnpm --filter @workmap/web test`: passed, 15/15, including current focused-idle report merging.
- `pnpm --filter @workmap/desktop-agent release:windows`: passed and generated the `0.5.3` NSIS installer.
- Packaged-resource inspection confirmed `IdleThresholdSeconds = 30` inside `win-unpacked/resources/agent-scripts/windows-foreground.ps1`.
- Windows PowerShell foreground/idle adapter smoke: passed with a valid privacy-minimised observation.
- Installer size: 91,936,628 bytes.
- Installer SHA-256: `71C79439588D4884004BBFC49CC5A5570104F14250F5584FB53849146C5E0C91`.
- Authenticode status: `NotSigned`.

### Manual QA

Not run on the separate Employee Windows computer. A timed real-device check is still required after installing `0.5.3`: keep Weixin focused, stop input for more than 30 seconds, and confirm focus active stops increasing while focused idle and open/runtime continue increasing in both Employee and Owner reports.

### Intentionally Not Changed

- No API, Web UI, Prisma schema/migration, auth, RBAC, tenant scope, Platform Admin, domain tracking, Virtual Office, or deployment behavior changed.
- No broader activity calculation or historical data rewrite was added.
- The existing untracked `docs/references/` directory was not touched.
- The installer was not uploaded to GitHub Release, the public download URL was not changed, and the Employee computer was not upgraded.

### Remaining Risks And Suggested Next Step

- Existing data collected by `0.5.2` with the five-minute threshold cannot be reliably reclassified after the fact; the correction applies once `0.5.3` is running.
- `WORKMAP_AGENT_IDLE_SECONDS` can intentionally override the default. A deployed machine with that environment variable set to another positive value will use the override.
- The installer is unsigned and may trigger Windows SmartScreen.
- Publish the installer under GitHub Release tag `desktop-agent-v0.5.3`, update `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to its direct asset URL, redeploy Web if needed, install/upgrade the Employee computer, then perform the timed Weixin test above. The implementation is ready for that release/manual-QA round.

---

## 2026-07-06 Windows Generic App Name Review

- Original task brief: explain why `Microsoft Windows Operating System` frequently appears as the current foreground app.
- Changed files: handoff documentation only.
- Finding: the Windows adapter currently prefers `FileVersionInfo.ProductName` over `FileDescription` and `ProcessName`. Multiple Windows shell/system executables expose the generic product name `Microsoft Windows Operating System`, so Report can group File Explorer, desktop/taskbar/Start, and other Windows-owned foreground surfaces under that label.
- Existing-data boundary: the exact underlying process cannot be recovered from the displayed row because the Agent uploads the selected product name rather than a separate process identity.
- Role/access behavior: unchanged.
- Verification: source inspection of `workmap/apps/desktop-agent/scripts/windows-foreground.ps1`; no runtime tests were required because no application code changed.
- Manual QA: not run.
- Intentionally not changed: no Desktop Agent naming, timing, API, Web, schema, auth, RBAC, or deployment behavior changed.
- Remaining risk/next step: the label is technically sourced from Windows metadata but is too broad for useful reporting. If requested, add privacy-safe local process-to-friendly-name resolution for known Windows shell processes, with tests, without collecting titles or content.

---

## 2026-07-06 Focused Input Without Continued Input Clarification

- Original task brief: assess whether Weixin should remain focus active for five minutes after the employee clicks its input box but does not type.
- Changed files: handoff documentation only.
- Confirmed rule: the text caret/input-box focus is not evidence of five minutes of active interaction. With Weixin still foreground, the first 30 seconds after the last input remain focus active; subsequent no-input foreground time is focused idle; the full open period remains open/runtime.
- Current implementation: Desktop Agent `0.5.3` uses the agreed 30-second `GetLastInputInfo` threshold. If a machine reports the full five minutes as focus active, it is likely still running `0.5.2`, has not restarted after upgrade, or has an explicit `WORKMAP_AGENT_IDLE_SECONDS` override.
- Verification: source review confirmed the shared/runtime/script default is 30 seconds. No runtime code changed and no manual QA was run.
- Role/access behavior and privacy collection boundaries are unchanged.
- Next step: install/restart `0.5.3` on the Employee computer and run this exact five-minute stopwatch scenario in Employee and Owner reports.

---

## 2026-07-06 Focused Idle Metric Product Decision Review

- Original task brief: assess the impact of deleting the Focused idle metric.
- Changed files: handoff documentation only.
- Recommendation: do not remove `focusedIdleSeconds` from collection, API aggregation, exports, or the report data model. It preserves the distinction between foreground-without-recent-input and background/minimized runtime, explains the gap between focus-active and open/runtime, and supports accuracy QA.
- UI direction if simplification is desired: keep Focus active as the primary metric; rename Focused idle to a clearer neutral label such as `Foreground, no input` and present it as secondary/expandable detail. Open/runtime remains separate context.
- Prohibited merge: do not add focused-idle time into Focus active, because that would reintroduce active-time inflation.
- Verification: reviewed the current report/API metric contract and definitions. No runtime code or UI changed; no automated/manual QA run.
- Role/access behavior and privacy boundaries are unchanged.
- Next step: decide whether to retain the current visible three-chip UI or request a scoped presentation-only change that preserves the underlying metric.

---

## 2026-07-06 App Metric Visibility Recommendation

- Original task brief: decide whether the current Owner report should hide Focused idle and total/Open-runtime metrics at this stage.
- Changed files: handoff documentation only.
- Recommendation: hide `Focused idle` and `Open/runtime` from the default Owner app-row presentation for the current product stage, leaving `Focus active` as the single primary visible metric.
- Data boundary: retain `focusedIdleSeconds` and `openRuntimeSeconds` in Desktop Agent collection, API aggregation, internal QA, and a future details/debug surface. This is a presentation-only direction, not deletion or merging.
- Rationale: the secondary metrics currently add interpretation burden, can make open time look like work time, and distract from validation of the primary recent-input foreground metric.
- Copy boundary: Focus active must still be described as foreground/focused time with input within 30 seconds, not guaranteed productive work or hours worked.
- Verification: reviewed the current three-chip app-row UI. No runtime/UI code changed and no automated/manual QA run.
- Role/access behavior and privacy boundaries are unchanged.
- Suggested next step: implement a narrowly scoped Web-only change that shows Focus active by default while preserving hidden metrics in the API/data model; optionally add an explicit details affordance later.

---

## 2026-07-06 Desktop Agent Precision And Collapsible App Metrics

### Original Task Brief

Make Focus active the prominent primary metric; hide Focused idle and Open/runtime inside a per-app expandable card; start Focus active immediately when the foreground app has keyboard/mouse input; switch to Focused idle immediately at 30 seconds without input; preserve precise open-to-close runtime across focused, background, and minimized app-window states; and change nothing outside this activity-timing/report presentation boundary.

### Changed Files

- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/src/pairing.ts`
- `workmap/apps/desktop-agent/src/runtime.ts`
- `workmap/apps/desktop-agent/src/trackingState.ts`
- `workmap/apps/desktop-agent/src/types.ts`
- `workmap/apps/desktop-agent/src/windowsForeground.ts`
- `workmap/apps/desktop-agent/scripts/windows-foreground.ps1`
- `workmap/apps/desktop-agent/alpha-windows/scripts/windows-foreground.ps1`
- `workmap/apps/desktop-agent/test/tracking-state.test.ts`
- `workmap/apps/desktop-agent/test/windows-adapter.test.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/reports-app-metric-card.test.ts`
- `workmap/apps/web/tsconfig.tsbuildinfo` (generated by the required typecheck/build)
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

Generated but git-ignored:

- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.4.exe`
- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.4.exe.blockmap`

### Implementation Summary

- Bumped Desktop Agent source and pairing identity to `0.5.4`.
- Replaced per-sample PowerShell process startup with one persistent request/response sampler. Native code now compiles once per Agent run.
- Split sampling into fast foreground/input observations and periodic full open-app scans. Default foreground request spacing is 100ms; full open-app enumeration remains once per second so background/minimized runtime is maintained without paying full enumeration cost on every focus sample.
- Windows measurements on this development computer: first persistent request about 523ms including process startup/native compilation; warmed focus-only requests about 4.5-5.7ms; warmed full open-app request about 90.5ms.
- `GetLastInputInfo` idle age is converted into privacy-minimised `lastInputAtMs` and exact `idleStartedAtMs`. When the same app crosses the threshold, the state machine uses the true last-input-plus-30-seconds boundary rather than the next polling timestamp. Input resumption similarly uses the derived last-input timestamp.
- Removed the previous default five-second minimum segment filter. Any positively observed foreground or open-runtime segment is retained; the existing API contract still stores whole seconds.
- Open/runtime meaning and aggregation remain unchanged. Full scans continue to track detected open app windows across foreground, background, and minimized states; the existing ten-second segment roll is an upload/durability chunk and does not remove time. Focus-only scans preserve background runtime until the next full scan.
- Reports app rows are now accessible interactive cards. Collapsed cards render only the enlarged green Focus active metric. Clicking the card toggles `aria-expanded` and reveals Focused idle and Open/runtime in the existing amber/blue tones.
- The top app summary no longer exposes aggregate Focused idle/Open-runtime values by default. A currently idle Agent shows neutral `No recent input` copy instead of a Focused idle duration.
- Applied the existing WorkMap theme, spacing, radii, typography, and Lucide icon system; no new design system or dependency was introduced.

### Role, Access, And Privacy Behavior

- Owner/Employee report access, tenant scoping, department scoping, and Platform Admin boundaries are unchanged.
- No keystrokes, mouse coordinates/click targets, window titles, screenshots, content, URLs, clipboard, camera, or microphone data was added.
- `GetLastInputInfo` still supplies only global elapsed time since the last input. Foreground identity remains the Windows foreground app.

### Verification

- Desktop Agent tests: 22/22 passed, including exact 30-second boundary, exact resume timestamp, sub-five-second segment retention, focus/full-scan runtime continuity, and real Windows persistent-sampler integration.
- Desktop Agent typecheck, lint, Alpha build, TypeScript build, and Windows NSIS build: passed.
- API tests: 9/9 passed; API typecheck, lint, and build passed.
- Web tests: 17/17 passed, including collapsed and expanded App card render states; Web typecheck, lint, and production build passed with 19 routes.
- Persistent PowerShell timing smoke: passed with privacy-minimised output and no title/content fields.
- Installer path: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.4.exe`.
- Installer size: 91,937,652 bytes.
- Installer SHA-256: `C44A14DF54DDDFC95F80605A004F7326762B4492859367C36BBF77DB7EC76D28`.
- Authenticode status: `NotSigned`.
- Packaged-resource inspection confirmed the 30-second threshold, persistent interactive mode, and separated focus/full open-app request contract in the final installer.
- `git diff --check`: passed.
- Scoped stale-default, prohibited-capability, and secret scans: passed.
- API runtime code unchanged check: passed.

### Manual QA

- Real Windows sampler execution: passed on the development computer.
- Separate Employee-computer stopwatch QA: not run.
- Browser visual/click QA: not run because the in-app browser runtime reported no available browser instance. Automated server-render tests cover default collapsed and expanded content states, but not final pixels or a real click/focus session.

### Intentionally Not Changed

- No API runtime implementation, Prisma schema/migration, authentication, Cognito, RBAC, tenant isolation, Platform Admin behavior, domain tracking, Virtual Office, deployment configuration, or unrelated page/component changed.
- No historical usage rewrite.
- No process-title/content collection and no per-key/per-click monitoring.
- Existing `docs/references/` content was not touched.

### Remaining Risks And Suggested Next Step

- Polling cannot be mathematically zero-latency. Warm focus observations are requested at roughly 100ms spacing; open-app scans are once per second; API/report totals remain whole-second values and network/UI polling adds display latency.
- Open/runtime remains the existing visible top-level app-window context. Truly headless services or hidden tray-only processes without a visible top-level window are not newly included because the request explicitly said to keep Open/runtime behavior unchanged.
- The higher sampling cadence and persistent PowerShell process require a real Employee-computer CPU/battery soak check.
- Publish/redeploy the Web change, publish the final `0.5.4` installer under `desktop-agent-v0.5.4`, install/restart it on the Employee computer, then run timed focus/input, 30-second idle, resume, app-open/close, minimize/background, and card expand/collapse acceptance checks.

---

## 2026-07-06 Browser Domain Tracking Feasibility And Proposed Workflow

### Original Task Brief

Assess, but do not implement yet, a Chrome/Edge MV3 extension that measures per-domain Focus active, Focused idle, and Open/runtime like Desktop Agent app metrics, including two simultaneously visible tabs where only the domain actually receiving keyboard/mouse activity should gain Focus active time.

### Changed Files

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Current Project Finding

- `apps/browser-extension` already provides an MV3 Alpha scaffold with pairing, protected credential storage, offline queue/retry, hostname-only minimization, active-tab/window events, `chrome.idle`, periodic checkpoints, and domain API upload.
- Current implementation is not sufficient for the requested rule: it uses the selected tab in the last-focused browser window plus a global 60-second Chrome idle state. It has no content script and therefore cannot prove that input occurred inside a particular domain page.
- Current domain state also retains the old five-second minimum and has only active/idle summary behavior. It does not yet implement a separate domain Open/runtime contract or the same collapsed three-metric presentation used for apps.

### Feasibility Decision

- Precise attribution is feasible for ordinary permitted HTTP/HTTPS pages only if WorkMap adds a privacy-minimised content script.
- The content script would listen only for the occurrence/timestamp of input activity, throttled and capture-phase, such as keyboard, pointer, wheel, and touch activity. It must never inspect or transmit key values, text, mouse coordinates, target elements, form fields, page content, titles, paths, queries, or fragments.
- Without a content script, WorkMap can only infer from selected tab, focused browser window, and global machine idle. That fallback cannot accurately distinguish which of two visible/split pages received input and should not be described as precise domain use.

### Proposed Metrics

- `Domain Focus active`: the top-level domain for the tab that actually reports a recent page input signal, while its browser window/tab context remains eligible. Start from the input timestamp; continue until another domain receives input, the page/window becomes ineligible, or 30 seconds pass without another page input.
- `Domain Focused idle`: after the last-interacted eligible domain reaches exactly 30 seconds without another page input, move that domain from Focus active to Focused idle. Resume Focus active at the next page input timestamp.
- `Domain Open/runtime`: wall-clock time during which at least one tab for the domain is open, across selected, unselected, background, and split-view states. Recommended aggregation is union/de-duplicated per browser: three `example.com` tabs open for five minutes produce five minutes, not fifteen.
- Browser UI input such as address bar, bookmarks, downloads, DevTools, or extension UI is not attributed to a domain.

### Proposed Two-Tab Behavior

- Separate browser windows side by side: the content script in the page that receives the event sends an activity pulse; service worker verifies the sender tab and top-level hostname, then moves Focus active to that domain.
- Chrome Split View/two visible tabs: both may remain visible, but only the page receiving the actual content-script input pulse gains Focus active. The other visible tab gains only Open/runtime.
- After 30 seconds with no page input, only the most recently interacted eligible domain becomes Focused idle; other visible/open domains remain Open/runtime only.
- Passive reading/video with no input becomes Focused idle after 30 seconds under the user's existing rule. This is telemetry, not proof that no work occurred.

### Proposed Technical Workflow

1. Permission/onboarding: request explicit HTTP/HTTPS host access and add the MV3 `scripting` capability; register an isolated-world content script only after permission/employee notice acceptance.
2. Page signal: inject at document start where allowed, including matching frames when needed. Send only a throttled `{ activityAt }` pulse through `chrome.runtime.sendMessage`; do not send page-derived domain or content.
3. Trusted attribution: service worker obtains `sender.tab.id/windowId`, resolves the top-level tab URL itself, immediately reduces it to `hostname`, and discards the full URL.
4. Eligibility: combine content activity with browser window focus, tab state/visibility context, navigation/removal events, lock state, and Chrome Split View metadata where available.
5. State machine: persist per-tab hostname/open state plus the current last-interacted domain and exact timestamps. Use transition timestamps, not one-second counters, so MV3 service-worker suspension does not lose duration.
6. 30-second boundary: schedule/reconcile the exact `lastDomainInputAt + 30 seconds` transition. If an alarm or service worker wake is late, backdate the event boundary to the exact timestamp.
7. Domain runtime: maintain reference counts/sets of open tab IDs by hostname; begin when the first tab opens/navigates to the hostname and end when the final tab closes/navigates away.
8. Durability: store state in `chrome.storage` because MV3 service-worker globals can be discarded; keep the existing bounded offline queue, retry/backoff, stable event IDs, and restart reconciliation.
9. API/report: add `isActiveWindow` semantics to domain events so runtime-only rows do not inflate active/idle summaries; derive/expose `focusActiveSeconds`, `focusedIdleSeconds`, and `openRuntimeSeconds` for domains without broad auth/RBAC changes.
10. Reports UI: reuse the app card interaction: Domain Focus active prominent by default; expand per-domain card for Focused idle and Open/runtime.
11. Verification: timed normal-tab, two-window, Chrome Split View, iframe editor, navigation, duplicate-domain tabs, background/minimize, 30-second idle/resume, lock, service-worker suspension, offline/retry, browser restart, and Chrome/Edge parity matrices.

### Platform And Privacy Limits

- Content scripts require granted matching host access. `chrome://`, `edge://`, browser New Tab/internal settings, browser stores, and other protected/non-HTTP(S) surfaces cannot be treated as ordinary instrumented domains.
- Cross-origin frame activity requires matching frame permissions/injection; proposed reporting should attribute it to the top-level tab domain unless product requirements later choose frame-domain reporting.
- Chrome MV3 service workers can terminate after inactivity, so all timing state must be persisted and reconstructed; no permanent in-memory timer assumption.
- Chrome exposes Split View metadata only in newer versions; activity pulses remain the primary attribution source and Chrome/Edge version testing is required.
- Edge documents Chrome extension APIs/manifest keys as broadly code-compatible, but both browsers still require separate sideload/store QA and packaging.

### Verification And Sources

- Repository/source review only; no runtime, manifest, API, schema, or UI code changed and no automated/manual test was run.
- Official Chrome Tabs documentation: active means active in its window and does not necessarily mean the window is focused; Split View IDs are available in newer Chrome versions.
- Official Chrome Windows documentation: `onFocusChanged` identifies the currently focused browser window or `WINDOW_ID_NONE`.
- Official Chrome content-script documentation: scripts run in isolated worlds, can use DOM events and runtime messaging, require match/host permissions, and support all-frame injection.
- Official Chrome idle documentation: idle is machine-wide time since input, not per-domain input attribution.
- Official Chrome service-worker documentation: MV3 workers may terminate after inactivity and global variables must not be relied upon for durable state.
- Official Microsoft Edge documentation: Chrome extension APIs and manifest keys are generally code-compatible, subject to supported-API review and Edge-specific testing.

### Intentionally Not Changed

- No browser-extension, Desktop Agent, API, schema, report, auth, RBAC, tenant, deployment, or permission behavior changed.
- No content script or broader host permission was added before product/privacy decisions are confirmed.
- Existing untracked `docs/references/` was not touched.

### Decisions Required Before Implementation

- Confirm that WorkMap may observe only the occurrence/timestamp of page-level keyboard/mouse/pointer/wheel/touch activity, while permanently prohibiting values, coordinates, targets, content, titles, and full URLs. Without this, precise split-tab attribution is impossible.
- Confirm recommended Open/runtime de-duplication: one or more tabs of the same domain count wall-clock time once per browser, not once per tab.
- Confirm passive reading/video policy: after 30 seconds without page input, the last-interacted domain is Focused idle even if the employee may still be reading/watching.

---

## 2026-07-06 Browser Domain Tracking Product Decisions Confirmed

- Original task brief: confirm privacy-minimised page input signals, same-domain multi-tab aggregation, and whether mouse-wheel scrolling counts as domain interaction. No implementation was requested yet.
- Changed files: handoff documentation only.
- Confirmed privacy boundary: content scripts may report only that a trusted page-level keyboard/mouse/pointer/wheel/touch interaction occurred and its timestamp. Key values, typed text, scroll direction/distance, pointer coordinates, target elements, form fields, page content, page titles, and full URLs remain permanently prohibited.
- Confirmed same-domain aggregation: multiple tabs for the same hostname are one domain activity identity. Focus active, Focused idle, and Open/runtime use interval union/de-duplicated wall-clock time; simultaneous or overlapping activity never multiplies by tab count.
- Confirmed wheel behavior: a real user-generated `wheel` event inside an eligible page, including common touchpad two-finger scrolling, counts as page interaction and refreshes that domain's last-activity timestamp. The event must be trusted (`event.isTrusted`); script-driven/automatic scrolling does not count.
- Same-domain example: three `github.com` tabs open for five minutes produce at most five minutes Open/runtime. If interaction moves among those tabs, `github.com` remains one continuous domain Focus active interval where eligible; overlapping input cannot exceed one second of domain Focus active per wall-clock second.
- Focused idle rule remains pending explicit confirmation only for the passive reading/video interpretation: after 30 seconds without any trusted interaction in eligible tabs of that domain, the last-interacted domain becomes Focused idle even if the person may still be reading or watching.
- Verification: documentation/product-rule review only; no extension, API, manifest, schema, or Reports code changed and no tests/manual QA were run.
- Role/access/privacy behavior: unchanged.
- Next step: once the passive reading/video rule is confirmed, implementation can begin under the already scoped Browser Extension + domain API/report plan.

---

## 2026-07-06 Browser Domain User-Story Coverage Review

### Original Task Brief

Review whether the proposed Chrome/Edge domain-duration plan fully covers seven expected user stories: immediate trusted keyboard/mouse/wheel activity, multiple visible pages and domains, same-domain de-duplication, immediate runtime stop on final-tab close, Owner visibility when the extension is disabled/enabled/removed, Reports parity with App monitoring, and an exact 30-second no-input transition to Focused idle. Identify missing cases before implementation.

### Changed Files

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Review Outcome

- The plan covers the core timing model, but it is not yet honest to call it perfect without tightening focus ownership and extension-health semantics.
- Confirmed: trusted mouse-wheel/touchpad scrolling counts as domain interaction.
- Confirmed by this user story: passive reading or video playback with no trusted page input for 30 seconds becomes Focused idle; media playback alone does not refresh activity.
- Recommended focus invariant: only one different domain owns Focus active at an instant within one browser context. A trusted input on domain B ends domain A's Focus active interval at that same timestamp and starts B immediately. If A and B are alternated, each receives its own non-overlapping intervals. Counting both for the entire 30-second freshness window would inflate Focus active above real wall-clock focus time and conflict with App-monitoring semantics.
- Same-hostname tabs are one identity. Moving input among three `github.com` tabs does not create a transition or multiply any metric.
- Each hostname has one de-duplicated Open/runtime interval set: first eligible tab opens/navigates in -> start; intermediate duplicate tabs -> no increment; final eligible tab closes/navigates away -> stop immediately when the browser event is delivered.
- Normal final-tab close/navigation can stop runtime immediately through tab lifecycle events. Forced browser termination, operating-system crash, power loss, or offline removal cannot provide an exact close timestamp; recovery must cap at the last durable observation/checkpoint and label the gap honestly.
- Owner Reports should reuse App cards: Domain Focus active is the prominent collapsed metric; Domain Focused idle and Domain Open/runtime appear on expansion, with the same colors/labels and existing Owner/Employee/RBAC boundaries.

### Extension Disable, Enable, And Remove Boundary

- Enable/re-enable time can be recorded accurately when the extension service worker starts and completes its first authenticated heartbeat.
- The extension cannot reliably report its own exact disable time after the browser has stopped executing it. A missing heartbeat proves only that WorkMap lost the signal; it cannot distinguish disable, uninstall, browser exit, computer sleep/offline, network failure, profile deletion, or a crash.
- A browser uninstall URL can provide a best-effort removal callback, but it is not a guaranteed authenticated delivery path and cannot cover offline/profile-wipe cases. It must not contain a reusable device credential.
- The honest Owner contract should therefore show `Last extension signal`, `Coverage lost/detected at`, `Coverage restored at`, and a reason such as `Extension unavailable or browser offline`. Exact disable/remove attribution requires an independent observer such as enterprise browser management or a separately authorised Desktop Agent/native companion.

### Missing Scenarios Added To The Plan

- Top-level navigation from hostname A to B in the same tab; same-hostname SPA/path/query changes must not create a new domain or collect the URL path.
- Browser UI focus: address bar, bookmarks, downloads, DevTools, extension pages, browser settings, stores, PDF/internal pages, and New Tab must not be attributed to the previously focused domain. Page blur/focus plus tab/window events should end/reconcile focus promptly where browser APIs expose it.
- Cross-origin iframe input should be attributed to the top-level tab hostname; inaccessible or unpermitted frames remain a declared coverage gap.
- Host permission denied/revoked, per-site extension access disabled, incognito behavior, multiple browser profiles, and protected pages must appear as coverage limitations rather than zero usage.
- Chrome and Edge, multiple windows, supported split view, minimized/background tabs, browser/device sleep-lock-wake, service-worker suspension, browser restart, offline queue/retry, duplicated delivery, clock skew, UTC day rollover, and rapid sub-second tab/navigation changes require explicit tests.
- Hostname grouping must remain explicit: `www.example.com` and `app.example.com` are different identities unless a later product decision adopts registrable-domain grouping.
- Chrome and Edge running simultaneously can produce cross-browser overlap. Local same-browser de-duplication is straightforward; cross-browser user-level de-duplication requires API interval reconciliation and must be included if the product promise is one logical domain total across browsers.
- Owner live display needs a bounded freshness contract. The current one-minute MV3 alarm/report persistence path is not immediate enough; implementation should send transition events immediately, persist every boundary, and use privacy-minimised current-domain heartbeat/checkpoint data for live overlay without treating heartbeat as user interaction.

### Role, Access, And Privacy Behavior

- No runtime behavior changed. Future Owner visibility remains tenant/RBAC scoped and Employee own-report access remains unchanged.
- Approved page signals remain limited to trusted interaction occurrence and timestamp. No key value, typed text, pointer coordinate, scroll direction/distance, target element, form field, title, path/query/fragment, page content, screenshot, clipboard, camera, microphone, email, or private-message content is approved.

### Verification And Manual QA

- Repository/source and product-rule review only.
- No extension, API, schema, Reports, auth, RBAC, deployment, or permission code changed; no automated or manual runtime test was run.
- `git diff --check` and a scoped secret scan are required at closeout.

### Intentionally Not Changed

- No Browser Extension implementation began in this review round.
- No broader host permission, content script, API contract, Prisma migration, report UI, Desktop Agent, deployment, or external browser-management integration was added.
- Existing untracked `docs/references/` was not touched.

### Remaining Decisions And Suggested Next Step

- Confirm the recommended non-overlap rule for different domains: interaction transfers Focus active ownership at the exact event timestamp rather than allowing several different domains to accrue Focus active concurrently for 30 seconds.
- Confirm whether the same hostname opened simultaneously in Chrome and Edge must also be de-duplicated into one Owner total; recommended answer is yes at report aggregation level.
- Accept that standard self-installed Chrome/Edge extensions can provide exact re-enable observation and bounded signal-loss detection, but not guaranteed exact self-disable/uninstall time or cause. If exact attribution is mandatory, explicitly authorise an independent Desktop Agent/native or enterprise-management scope.
- After these points are accepted, implement only Browser Extension domain timing, its domain API/report contract, and matching Reports cards, followed by the full Chrome/Edge acceptance matrix.

---

## 2026-07-06 Browser Domain Tracking 0.4.0 Implementation

### Original Task Brief

Implement the confirmed Browser Extension rules without unrelated changes: trusted keyboard/mouse/wheel/touch activity starts domain Focus active immediately; different domains transfer one focus owner without overlapping; same-domain tabs and Chrome/Edge overlap are de-duplicated; 30 seconds without domain input changes to Focused idle; Open/runtime spans first eligible tab open through final same-domain tab close; Owner Reports mirror App cards; and extension disable/remove is represented honestly through bounded signal-loss detection and recovery observation.

### Changed Files

- Browser Extension manifest/package/options, service worker, content registration/content script, tracking state/event contract, API client, generated `alpha-unpacked` manifest/options, and targeted tests under `workmap/apps/browser-extension/`.
- Domain ingestion, browser-extension heartbeat coverage recording, Reports interval aggregation/live coverage, and tracking/report verification under `workmap/apps/api/`.
- Reports domain API types, live merge, domain cards, extension coverage panel, export fields, and targeted tests under `workmap/apps/web/`.
- `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.

### Implementation Summary

- Bumped the Browser Extension package/manifest and pairing/heartbeat identity to `0.4.0`.
- Added optional HTTP/HTTPS host access plus the minimum MV3 `scripting` capability. Pairing explicitly requests website access, registers one isolated-world all-frame content script, and injects it into already-open permitted pages; pairing then triggers immediate open-tab reconciliation.
- The content script handles trusted `keydown`, `pointerdown`, focused `pointermove`, `wheel`, `touchstart`, and `touchmove` events. It sends only activity/boundary timestamps. It never sends event values, typed text, coordinates, scroll direction/distance, DOM targets, page-derived domains, titles, paths, queries, fragments, content, or form data.
- A trailing 250ms activity pulse preserves the latest real input timestamp without flooding MV3 messaging. A page-side 30-second boundary message plus persisted timestamp reconciliation backdates delayed worker wake-ups to exact `lastInputAt + 30 seconds`.
- Replaced selected-tab/global-idle tracking with a persistent version-2 domain state machine. It stores the single focused domain/tab, last input timestamp, open tab-to-hostname map, and one runtime session per hostname.
- Different-domain interaction ends the previous Focus active/Focused idle interval at the new event timestamp. Same-domain tab changes do not multiply or restart the logical domain metric.
- Open/runtime starts when the first eligible tab for a hostname is observed and ends on final-tab close/navigation. Background, unselected, and minimized tabs remain open/runtime; focus/idle stops on page blur, tab activation away, browser window focus loss, lock, navigation, or tab removal.
- Normal tab create/update/remove/replace events reconcile immediately. Ten-second visible-page checkpoints, a 30-second MV3 alarm fallback, stable event IDs, persisted state, capped offline queue, and retry/backoff preserve bounded durability.
- Domain events now carry the existing `isActiveWindow` semantic used by App monitoring: focus active is `!isIdle && isActiveWindow`, focused idle is `isIdle && isActiveWindow`, and runtime is `!isIdle && !isActiveWindow`. Runtime no longer inflates active/idle summaries. No Prisma migration was required.
- Reports computes domain metrics from raw timestamp intervals and unions overlap per hostname, so duplicate same-domain tabs and concurrent Chrome/Edge intervals count once. Legacy focused-idle browser events remain readable. Domain daily totals use the same de-duplicated interval calculation.
- Extension heartbeats more than 90 seconds after the prior signal record a Browser Extension coverage-loss/recovery interval using the existing `ActivityEventType.HEARTBEAT`. Current coverage is derived from the latest device signal. No exact disable/remove cause is claimed.
- Reports polls current extension coverage with the existing ten-second live-status loop. It shows Connected or Signal lost, employee/browser, last signal, coverage-lost detection, and restored observation with explicit browser/offline/network ambiguity.
- Domain rows now use the same accessible collapsed card as Apps: prominent green Focus active; expanded amber Focused idle and blue Open/runtime. CSV/TXT exports include all three domain fields.
- The `ui-styling` accessibility guidance was applied through semantic buttons, existing global focus indicators, `aria-expanded`, specific accessible labels, and existing WorkMap tokens; no UI dependency or broader redesign was added.

### Role, Access, And Privacy Behavior

- Existing Employee own-report and Owner/Manager/Team Lead/HR Admin report permissions, company/department/user scoping, audit logging, tenant isolation, and Platform Admin privacy boundaries are unchanged.
- Company coverage rows are produced only inside the same existing report scope; individual report access continues to use `resolveVisibleReportUserId`.
- Hostnames remain exact lowercase hostnames. Full URLs and page-derived content are not stored or sent.
- Employees can still disable/remove the extension. Owner Reports show signal-loss detection and recovery, not an invented exact click time or cause.

### Verification

- Browser Extension: 13/13 tests passed; typecheck, lint, and Alpha unpacked build passed.
- API: 9/9 tests passed; typecheck, lint, and build passed. Coverage includes runtime exclusion from active, exact three-metric reporting, Chrome/Edge same-domain interval union, and coverage loss/recovery.
- Web: 19/19 tests passed; typecheck, lint, and production build passed with 19 routes. Coverage includes collapsed/expanded domain card behavior.
- Final unpacked output contains `dist/contentScript.js`, `dist/contentRegistration.js`, the updated service worker/state modules, manifest `0.4.0`, and optional `http://*/*`/`https://*/*` permissions.
- `git diff --check`: passed at final handoff closeout.
- Privacy payload scan found no key-value, coordinate, DOM-target, title, full-URL, or page-content collection in the content script/build output.
- Scoped secret scan: passed with no matching files.

### Manual QA

- Real Chrome load-unpacked, Edge load-unpacked, timed multi-tab interaction, disable/re-enable, and Owner/Employee end-to-end comparison were not run in this environment.
- In-app browser visual/click QA was attempted through the required Browser skill, but the current session exposed no available browser instance.
- Automated SSR tests verify domain cards' collapsed and expanded content, but do not substitute for final pixel/keyboard/browser-extension acceptance.

### Intentionally Not Changed

- No Desktop Agent file or timing rule changed.
- No Prisma schema/migration, Cognito/auth architecture, RBAC capability, tenant boundary, Platform Admin surface, Virtual Office, deployment configuration, retention, categorisation rule, or unrelated page was changed.
- No base-domain/public-suffix grouping was added; `mail.google.com` and `docs.google.com` remain separate hostnames.
- No enterprise browser management, native messaging host, forced installation, or exact self-disable/uninstall claim was added.
- Existing unrelated Employees/loading/design QA changes and `docs/references/` were not touched.

### Remaining Risks And Suggested Next Step

- Standard self-installed extensions cannot prove an exact Disable/Remove action. Current Owner status detects missing signal after 90 seconds and labels the cause honestly.
- Normal tab close/navigation has an immediate browser lifecycle event. Browser crash, power loss, profile deletion, or offline forced termination lacks a final event; persisted checkpoints and the two-minute stale-sample cap bound rather than eliminate that uncertainty.
- Protected/internal pages, browser UI, denied/revoked host access, inaccessible frames, and Incognito without explicit extension access remain coverage gaps.
- Calculation begins at exact observed timestamps, but persisted API values/display remain whole seconds; active checkpoints, upload/network time, and the existing ten-second Reports poll bound Owner display freshness.
- Load `workmap/apps/browser-extension/alpha-unpacked` separately in current Chrome and Edge, pair it to the deployed/current API, then run the agreed timed matrix: normal interaction, wheel/touchpad, different-domain transfer, three same-domain tabs, Chrome+Edge overlap, 30-second idle/resume, navigation/final close, minimize/background, permission denial, lock/sleep, offline retry, worker/browser restart, disable/re-enable/remove, and Owner/Employee card comparison.
- The code and automated checks can proceed to that manual acceptance round; do not describe store distribution or production accuracy as passed yet.
