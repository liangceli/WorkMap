# Latest QA Handoff

## 2026-07-15 Mobile Workspace Navigation Refinement QA

### Reviewed Implementation

- Mobile-only workspace navigation visual treatment and horizontal-scroll discoverability.

### Findings

- The active tab is an accessible, high-contrast pill with no residual sidebar-style marker.
- The horizontal overflow area has snap behavior, a visible teal scrollbar, and an explicit `More >` indicator for first-view discoverability.
- The visual override is scoped to the mobile breakpoint and does not alter link targets or access rules.

### Verification Status

- Web tests: pass (`61/61`), including two mobile-navigation style regression checks.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No backend, database, deployment, Desktop Agent, or Browser Extension update is involved.

## 2026-07-15 Reports Live And Audit Section Spacing QA

### Reviewed Implementation

- The Reports live-signals and connection-audit visual spacing adjustment.

### Findings

- Both affected sections share the same scoped class rather than changing generic report section spacing.
- Desktop padding is `24px`; the mobile media query reduces it to `16px`.
- Internal responsive grids and timeline scrolling remain untouched.

### Verification Status

- Web tests: pass (`59/59`), including the responsive spacing regression check.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No backend, database, deployment, Desktop Agent, or Browser Extension change is involved.

## 2026-07-15 Reports Filter Refresh Loading State QA

### Reviewed Implementation

- Reports filter-refresh rendering and the existing pixel-avatar loader.

### Findings

- The previous summary remains available only in component memory while the request is pending; it is no longer rendered.
- Live signals, audit history, trends, and API summary are gated behind completion of the new request.
- Export controls are disabled during loading to prevent exporting stale values.

### Verification Status

- Web tests: pass (`58/58`), including the new filter-refresh loader regression test.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.
- `git diff --check`: pass (line-ending warnings only).
- Scoped secret scan: no matches (excluding env files and generated directories).

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No Agent, Extension, API, database, or deployment update is required by this frontend-only change.

## 2026-07-15 Login And Reports Request Latency Stabilisation QA

### Reviewed Implementation

- Cognito workspace-mapping request de-duplication, onboarding failure protection, standard-route Platform Admin request removal, and bounded Supabase Transaction Pooler runtime configuration.

### Findings

- Confirmed workspace mappings are cached briefly; transient unavailable mappings are deliberately not cached.
- Concurrent authenticated surfaces share one mapping request for the same Cognito user.
- Normal tenant login and pages no longer request `/platform/me`, eliminating the expected `403` request from the normal login/app-shell path.
- Workspace onboarding remains limited to an explicit confirmed missing mapping; failure paths preserve the current user and tenant data.
- No Desktop Agent or Browser Extension package change is required for this repair.

### Verification Status

- Web tests: pass (`57/57`).
- API tests: pass (`16/16`).
- Web/API typecheck: pass.
- Web/API lint: pass.
- Web/API build: pass.
- `git diff --check`: pass.
- Production health: warm `200`; authenticated endpoint performance not tested without a user token.

### Manual QA Status

- Deferred: deployed owner login and Reports load must be checked after both Web and API services receive this commit.

### Risks

- Render Starter cold starts remain an infrastructure-level source of first-request latency.
- Generated TypeScript build-info cache is present locally and should not be included in a source commit.

### Recommendation

- Pass for deployment. Deploy API and Web together; do not change tracking client versions for this scope.

## 2026-07-11 Product Pages Visual Direction V1 QA

### Reviewed Implementation

- Seventeen route-specific desktop designs, three overview boards, real asset usage, route coverage, role/privacy boundaries, and high-density page layout.

### Findings

- All known non-homepage routes have a corresponding visual.
- No fictional tenant, employee profile, Platform Admin tenant record, report API result, or integration state was introduced.
- Existing development fallback data is clearly labeled on Dashboard, Employees, and Reports.
- Employee Detail and Platform Admin use honest unavailable/empty states.
- One select-field template defect was found during visual inspection, fixed, and affected images were regenerated.

### Verification Status

- Design-source JavaScript syntax: pass.
- PNG count: pass (`17/17` route visuals plus `3` overview boards).
- Dimensions: pass (`1440 x 1000` for every route visual).
- Non-empty file validation: pass.
- `git diff --check`: pass.
- Scoped secret scan: pass.

### Manual QA Status

- Visual artifact inspection: completed.
- Runtime browser QA: not run because no runtime application code changed.

### Recommendation

- Pass V1 for user visual review. Do not begin whole-application frontend implementation until the user approves or marks up the route designs.

## 2026-07-10 Employee Privacy Two-Panel QA

### Reviewed Implementation

- Removal of the centre filter block, desktop comparison balance, mobile collapse behaviour, and unused source cleanup.

### Findings

- The section now presents a direct collected/not-collected comparison with symmetrical panel geometry.
- No empty centre column or obsolete filter styling remains.
- Mobile becomes a straightforward stacked comparison while retaining the four employee controls.

### Verification Status

- Homepage-scoped TypeScript: pass.
- Direct homepage ESLint: pass.
- Homepage mobile-menu source tests: pass (`3/3`).
- `git diff --check`: pass.

### Recommendation

- Pass the scoped privacy-section layout revision.

## 2026-07-10 Homepage Contrast And Spacing QA

### Reviewed Implementation

- Hero heading contrast, final CTA/Footer separation, Employee Privacy vertical spacing, and the source of the four pixel-asset candidates.

### Findings

- Hero heading now uses two explicit high-contrast colours from the approved palette.
- The CTA is separated from the Footer by an Amber lower gutter and no longer shares an uninterrupted Ink Navy edge.
- Employee Privacy desktop and mobile padding is vertically symmetrical.
- Candidate pixel previews are exact crops from the repository's Modern Office tileset; runtime artwork is intentionally unchanged pending selection.

### Verification Status

- Homepage mobile-menu source tests: pass (`3/3`).
- `git diff --check`: pass; line-ending warning only.
- Browser visual QA: not run because localhost navigation is blocked by the current in-app browser policy.

### Recommendation

- Pass the three implemented refinements. Keep the privacy centre replacement open until the user chooses candidate `01`–`04`.

## 2026-07-10 Approved Homepage V4 Implementation QA

### Reviewed Implementation

- Public homepage runtime composition, responsive rules, service tabs, FAQ interaction, motion/accessibility states, and real marketing assets.
- Preservation of existing account destinations and the mobile navigation contract.

### Findings

- The homepage now uses the approved visual direction and real WorkMap product imagery; no fictional dashboard values or generated product interface were introduced.
- The full Virtual Office panorama is displayed with its original geometry, and pixel avatars come from repository DIY layers.
- Service tabs, FAQ accordion, mobile menu, anchor navigation, and account links remain functional in source and targeted tests.
- One current-change regression in the mobile menu source contract was found, fixed, and verified (`3/3`).
- No frontend implementation finding remains from the scoped static checks.

### Verification Status

- Homepage-scoped TypeScript: pass.
- Direct homepage ESLint: pass.
- Homepage mobile-menu source tests: pass (`3/3`).
- Full Web tests: initial run `31/35`; the three homepage failures were fixed. The remaining transform failure is external to this change and originates from NUL bytes in `workmap/apps/web/lib/api/authApi.ts`.
- Full Web typecheck/lint/build: blocked by that same pre-existing file corruption.
- Asset dimensions/non-empty checks: pass.
- `git diff --check`: pass; line-ending warnings only.
- Scoped secret and local-machine-path scan: pass.
- Dev server readiness: pass at `http://localhost:3010`.

### Manual QA Status

- Implemented browser QA: not run. The in-app browser policy rejected localhost navigation, and no workaround was used.

### Risks

- Responsive composition and animation timing are not browser-screenshot verified.
- Package-wide verification remains incomplete until the unrelated `authApi.ts` corruption is resolved.

### Recommendation

- The scoped homepage implementation passes source-level QA. Do not label the full Web package release-ready until the external auth file corruption is resolved and browser QA is completed.

## 2026-07-10 Homepage Hero Panorama V4 QA

### Reviewed Implementation

- Source panorama dimensions and content.
- Desktop and mobile V4 Hero replacement.
- Preservation of all non-Hero V3 sections.

### Findings

- Hero media now shows the complete real Virtual Office panorama without cropping or generated text.
- Desktop replacement stays within the original Hero boundary.
- Mobile adds Hero height and shifts later sections without redesigning them.
- No blocking visual finding in the scoped replacement.

### Verification Status

- Source panorama: pass (`1904x949`).
- Desktop V4: pass (`785x2003`).
- Mobile V4: pass (`749x2262`).
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.
- Application checks: not applicable; no runtime code changed.

### Manual QA Status

- Full image artifact inspection: completed.
- Implemented browser QA: not run; this remains a visual-design artifact.

### Recommendation

- Pass the scoped V4 Hero revision for user review.

## 2026-07-10 Services Homepage Visual V3 QA

### Reviewed Implementation

- Desktop/mobile V3 composition, FAQ order and scrolling, service spacing, system-flow clarity, and real DIY avatar reference.

### Findings

- V2's repeated generated character is removed from the design specification; V3 references eight exact repository-layer combinations.
- Flow direction and the Agent branch/merge are explicit; avatars remain outside nodes and connectors.
- FAQ precedes Consent/CTA. Desktop right-side questions scroll independently while left content stays sticky, then scrolling chains to the page.
- Work Visibility no longer has the reported upper-right blank area.

### Verification Status

- Desktop V3 PNG exists and is non-empty: pass (`785x2003`).
- Mobile V3 PNG exists and is non-empty: pass (`749x2100`).
- DIY avatar composition reference exists and is non-empty: pass (`912x176`).
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.
- Application checks: not applicable; no runtime code changed.

### Manual QA Status

- Visual artifact and avatar reference inspection: completed.
- Implemented browser/responsive QA: not run; no implementation exists in this design-only round.

### Recommendation

- Pass V3 for user design review; do not begin implementation until approved.

## 2026-07-10 Services and Employee Privacy Homepage Visual V2 QA

### Reviewed Implementation

- Full desktop and mobile homepage references.
- Services tabs, system flow, employee privacy, consent, sticky FAQ, and footer specification.
- Repository truth for Reports, Compliance, policy acknowledgement, Virtual Office screenshots, and pixel assets.

### Findings

- No blocking visual-design finding in the V2 composition.
- Reports and Virtual Office tab requirements prohibit fictional screenshots and values.
- Policy acknowledgement exists but is not currently an enforced tracking gate; marketing copy must not overstate this behaviour.
- FAQ uses native page scrolling with a sticky left column, not wheel interception.

### Verification Status

- Desktop PNG exists and is non-empty: pass.
- Mobile PNG exists and is non-empty: pass.
- Desktop/mobile, motion, hover, focus, reduced-motion, and FAQ scroll specification: pass.
- `git diff --check`: pass; line-ending warnings only.
- Scoped changed-text secret scan: pass.
- Application typecheck/lint/build: not applicable; no runtime source changed.

### Manual QA Status

- Artifact visual review: completed.
- Implemented browser and responsive QA: not run; no implementation exists in this design-only round.

### Risks

- Generated microcopy is not implementation copy; the V2 specification is authoritative.
- Real authenticated Reports and additional Virtual Office screenshots remain unavailable.

### Recommendation

- Pass the visual-design artifact round for user review. Do not begin frontend implementation until V2 is approved.

## 2026-07-10 Desktop Agent 0.5.7 Windows File-Lock Recovery QA

### Reviewed Implementation

- Reviewed the 0.5.7 version bump, atomic JSON file writer, runtime status-write isolation, legacy startup cleanup, new regression tests, and final NSIS installer output.

### Diff Review Summary And Findings Ordered By Severity

- Critical/high: none found in the scoped desktop-agent diff.
- Medium: a local `status.json` write can still fail after all retries, but it is now explicitly diagnostic-only and cannot terminate the network/runtime loops. The UI may briefly show stale local text while server heartbeats continue.
- Low: failed best-effort cleanup can leave a uniquely named temporary JSON file, but it cannot block later writes because each attempt uses a fresh name.
- Review correction made before final packaging: the legacy-cleanup PowerShell command now excludes its own `$PID`; otherwise its command line could match the same legacy markers it searches for.

### Test And Verification Status

- TypeScript typecheck: pass.
- Desktop-agent tests: pass, 28/28.
- New regression coverage passes for transient Windows rename locks, non-throwing status writes, continued heartbeat under persistent status-file failure, and legacy cleanup source guards.
- Desktop-agent build: pass.
- Windows NSIS x64 packaging: pass.
- Final installer SHA-256: `587C90996C124015AAF51BCF706ABD10FCA9879E2E9ED96F48899C6A6418D9C3`.
- `git diff --check` — pass (line-ending conversion warnings only; no whitespace errors).
- Scoped secret scan excluding environment, dependency, build, artifact, and reference directories — pass; no matches.

### Manual QA Status

- Installer creation and artifact metadata inspection completed.
- A real install-over-0.5.6, full Windows shutdown, next-day sign-in, and owner-report observation were not run because they require the affected employee machine and elapsed lifecycle testing.

### Risks And Recommendation

- Functional automated QA passes and the installer is ready for controlled employee-PC acceptance testing.
- Do not call overnight restart recovery fully proven until the affected PC completes the shutdown/sign-in scenario and the owner account sees a fresh heartbeat plus app activity.
- Pass for GitHub Release candidate publication; next round can proceed.

## 2026-07-09 Virtual Office Mobile Chrome Cleanup QA

- Reviewed implementation: mobile responsive CSS/markup changes in `VirtualOfficeTopBar.tsx`, `OfficeBottomDock.tsx`, and source-level regression coverage for `/virtual-office` mobile chrome.
- Diff review summary:
  - Mobile top controls are now constrained to three clean full-width strips: workspace, area selector, and status/search.
  - Secondary desktop chrome is hidden on phone widths: sync pill, left rail, and mini map.
  - Bottom dock no longer wraps into multiple rows on mobile. It hides the large identity block plus duplicate/unavailable controls and keeps a compact five-action row.
  - Mobile side panel, room card, interaction drawer, command palette, map controls, and toast are bounded to avoid overflow and reduce visual clutter.
  - No virtual-office data fetching, movement, realtime, auth, API, or RBAC behavior changed.
- Findings ordered by severity:
  - No blocking scoped source finding found in the virtual-office mobile chrome diff.
  - Medium remaining visual risk: rendered mobile acceptance could not be captured because the Web app is currently blocked by corrupted `workmap/apps/web/lib/api/authApi.ts`.
  - Low product tradeoff: mobile hides the realtime/sync diagnostic pill to keep the map clean; this matches the current cleanliness request but should be confirmed in real QA.
- Test/verification status:
  - `..\..\node_modules\.bin\tsx.CMD --test test\virtual-office-mobile-chrome-source.test.ts`: passed 3/3.
  - `..\..\node_modules\.bin\eslint.CMD components\office\VirtualOfficeTopBar.tsx components\office\OfficeBottomDock.tsx test\virtual-office-mobile-chrome-source.test.ts`: passed.
  - `..\..\node_modules\.bin\tsc.CMD --noEmit`: failed on pre-existing `lib/api/authApi.ts` NUL/invalid-character corruption.
  - `..\..\node_modules\.bin\eslint.CMD .`: failed on the same pre-existing `authApi.ts` parser error.
  - `.\node_modules\.bin\next.CMD build`: failed on the same pre-existing `authApi.ts` webpack parse error.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no matches found.
- Manual QA status:
  - Not run. Required manual check after restoring `authApi.ts`: open `/virtual-office` at the screenshot-sized mobile viewport and confirm top controls are clean, left rail/mini map/sync pill are hidden, bottom dock is one row, zoom controls do not overlap the dock, and opened panels behave as bounded bottom sheets.
- Risks:
  - Source tests are not pixel tests. Actual phone-browser safe-area behavior, touch hit size, and long-label wrapping still require visual/touch QA.
  - If product later requires realtime connection text visible on mobile, a small collapsed indicator may need to be added.
- Pass/fail recommendation:
  - Pass for scoped source implementation and targeted automated coverage.
  - Do not claim final mobile visual acceptance until Web build and real browser QA are available.
- Whether the next round can proceed: yes, but deployment readiness still requires fixing the existing `authApi.ts` blocker first.

---

## 2026-07-09 Home Mobile Hero Proof Horizontal Layout QA

- Reviewed implementation: home page hero proof mobile CSS override and source regression coverage.
- Diff review summary:
  - The mobile `@media (max-width: 820px)` proof area no longer forces the three proof items into one vertical column.
  - The three proof items now remain in a three-column horizontal grid on small screens.
  - Each proof item keeps icon + text alignment inside its own column.
  - No desktop hero proof layout or hero content copy changed.
- Findings ordered by severity:
  - No blocking scoped finding found in the source diff or targeted checks.
  - Medium remaining visual risk: no rendered mobile browser screenshot was captured because the existing Web build is blocked by `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption.
  - Low expected limitation: a very narrow viewport may wrap text inside each proof item, but the three items remain horizontally arranged.
- Test/verification status:
  - `..\..\node_modules\.bin\tsx.CMD --test test\home-mobile-menu-source.test.ts`: passed 3/3.
  - `..\..\node_modules\.bin\eslint.CMD app\page.tsx test\home-mobile-menu-source.test.ts`: passed.
  - `npm.cmd run typecheck` from `workmap/apps/web`: failed on the pre-existing corrupted `lib/api/authApi.ts`.
  - `npm.cmd run build` from `workmap/apps/web`: failed on the same pre-existing corrupted `lib/api/authApi.ts`.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no new secret found; matches were existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`.
- Manual QA status:
  - Not run. Required manual check after restoring `authApi.ts`: open the home page at the screenshot-sized mobile viewport and confirm `Support your team`, `Privacy by design`, and `Clear boundaries` appear in one horizontal row.
- Risks:
  - Exact visual fit and line wrapping need browser verification after the build blocker is removed.
- Pass/fail recommendation:
  - Pass for scoped CSS/source implementation and targeted automated coverage.
  - Do not claim final pixel-perfect mobile acceptance until full Web build and mobile browser QA are available.
- Whether the next round can proceed: yes, with the known build blocker still outstanding.

---

## 2026-07-09 Home Mobile Menu Redesign QA

- Reviewed implementation: home page header/menu markup, mobile navigation open state, mobile account actions, mobile CSS card layout, and source-level regression test.
- Diff review summary:
  - The opened mobile menu now uses the reference-style top card instead of a centered narrow menu stack.
  - The visual change is gated by the `headerMenuOpen` state, so the closed mobile header and desktop navigation do not receive the card/open-menu overrides.
  - `Login` and `Get started` are rendered only inside the mobile menu while desktop actions remain in the existing `navActions` area.
  - Accessibility wiring is improved by connecting the toggle button to the menu with `aria-controls`.
- Findings ordered by severity:
  - No blocking scoped finding found in the source diff or targeted checks.
  - Medium remaining visual risk: no real browser screenshot was captured because the existing Web build is blocked by `workmap/apps/web/lib/api/authApi.ts` NUL/invalid-character corruption.
  - Low expected limitation: the test is source/CSS-structure coverage, not a pixel comparison.
- Test/verification status:
  - `..\..\node_modules\.bin\tsx.CMD --test test\home-mobile-menu-source.test.ts`: passed 2/2.
  - `..\..\node_modules\.bin\eslint.CMD app\page.tsx test\home-mobile-menu-source.test.ts`: passed.
  - `node --check workmap/apps/web/app/page.tsx`: not applicable for `.tsx` files.
  - Full Web typecheck/build remain blocked by the existing corrupted `authApi.ts`, not by this menu change.
  - `git diff --check`: passed with LF-to-CRLF working-copy warnings only.
  - Scoped secret scan excluding env/generated/dependency/reference/artifact paths: no new secret found; matches were existing documentation/example references to `WORKMAP_JWT_SECRET=qa-local-secret`.
- Manual QA status:
  - Not run. Required manual check after restoring `authApi.ts`: open the home page at a mobile width, open the menu, and compare the top-card layout, left-aligned links, compact close button, and bottom CTA buttons with the supplied Gather reference.
- Risks:
  - Exact spacing, font rendering, and small-screen viewport height behavior are not visually accepted until browser QA runs.
- Pass/fail recommendation:
  - Pass for scoped source implementation and targeted automated coverage.
  - Do not claim final pixel-perfect acceptance until full Web build and mobile browser QA are available.
- Whether the next round can proceed: yes, but deployment readiness requires fixing the existing `authApi.ts` blocker first.

---

## 2026-07-09 Browser Extension 0.4.2 Pairing Feedback Fix QA

- Reviewed implementation: Browser Extension Options pairing flow, Edge optional host-permission request handling, content-script registration wrappers, API error detail handling, version identity, generated unpacked manifest/CSS, and release ZIP metadata.
- Diff review summary:
  - The no-feedback symptom is addressed at the local extension layer. The Options page now shows progress before the API call and cannot silently wait forever on the Edge permission request or content-script registration path.
  - `/device-client/pair` is still called only after permission and tracker registration succeed, preserving the existing permission-before-tracking flow.
  - API 4xx/5xx failures now surface a short sanitized response-body message for employee troubleshooting.
  - Tracking payload/privacy behavior is unchanged.
- Findings ordered by severity:
  - No blocking scoped finding found in code review or automated verification.
  - Medium remaining manual risk: real Edge behavior around optional host permissions must be verified on the employee machine because the original failure occurred inside Edge UI/runtime, not in Node tests.
  - Low expected limitation: if a pairing code is expired or generated for the wrong client type, pairing will still fail; `0.4.2` should now display that failure instead of appearing inert.
- Test/verification status:
  - `npm.cmd run typecheck` from `workmap/apps/browser-extension`: passed.
  - `npm.cmd test` from `workmap/apps/browser-extension`: passed 15/15, including new source coverage for progress messages and timeout path.
  - `npm.cmd run lint` from `workmap/apps/browser-extension`: passed.
  - `npm.cmd run build` from `workmap/apps/browser-extension`: passed.
  - Generated ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.4.2.zip`.
  - ZIP SHA-256: `80190D61C900DC3A26D2DE5BB78F00BF72F6E5C6B88980B2909AC79F63CD1F61`.
  - `git diff --check`: passed with existing LF-to-CRLF warnings only.
  - Scoped secret scan: no new secret found; only existing docs/example `WORKMAP_JWT_SECRET=qa-local-secret` references appeared.
- Manual QA status: not run. Required manual acceptance: load the `0.4.2` unpacked/ZIP in Edge, open Options, click `Pair extension`, confirm visible stage changes, use a fresh Browser Extension pairing code from the correct employee account, confirm success, then verify `/devices` reports `browser-extension-mv3/0.4.2` and fresh `lastSeenAt`.
- Risks:
  - The generated ZIP is for manual load-unpacked installation, not Edge Add-ons distribution.
  - The user must update the Vercel browser-extension download URL after uploading the GitHub Release asset, otherwise employees may still download `0.4.1`.
- Pass/fail recommendation: pass for scoped Browser Extension pairing-feedback/release package fix. Proceed to GitHub Release upload and real Edge pairing acceptance.
- Whether the next round can proceed: yes.

---

## 2026-07-09 Desktop Agent 0.5.6 Release Installer Packaging QA

- Reviewed implementation: Desktop Agent `release:windows` packaging output, generated NSIS installer file, blockmap, SHA-256 hash, and Authenticode signature status.
- Diff review summary: no source-code logic changed during this packaging round. The installer artifact is generated under ignored `workmap/artifacts/desktop-agent/`; handoff docs were updated with artifact metadata.
- Findings ordered by severity:
  - No blocking packaging failure after rerun with approved network access.
  - Medium expected release risk: the installer is `NotSigned`, so Windows may show SmartScreen/security warnings.
  - Medium remaining acceptance risk: installer generation does not prove employee-machine reboot/wake behavior until installed and tested on the real employee PC.
- Test/verification status:
  - `npm.cmd run release:windows`: passed after approved network escalation.
  - Output exists: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.6.exe`.
  - File size: `91,938,656` bytes.
  - SHA-256: `8295AC37ED777C18AF84F83251A76064EA4AEB8193C49CE037D1899ED1CA2766`.
  - Authenticode: `NotSigned`.
- Manual QA status: not run. The installer was not installed or launched on the separate employee Windows computer.
- Risks: GitHub upload can proceed, but production acceptance still depends on installing this exact artifact under the correct Windows user and confirming Owner-side `/devices` and reports refresh after reboot/sleep/network recovery.
- Pass/fail recommendation: pass for packaging. Proceed to GitHub Release upload and employee-machine acceptance.
- Whether the next round can proceed: yes.

---

## 2026-07-09 Desktop Agent 0.5.6 Functional Reliability Fix QA

- Reviewed implementation: Desktop Agent `apiClient.ts`, `runtime.ts`, pairing/version identity, GUI release expectations, runtime queue/API tests, backend `device-client` binding regression, existing activity ingestion cross-tenant checks, and unchanged backend credential/device/session services.
- Diff review summary:
  - Runtime heartbeat/upload flow is now outside the foreground-sampling try block, so sampler failure no longer prevents scheduled heartbeat or queued upload attempts.
  - Heartbeat now handles the specific recoverable stale-session backend error by starting a new session and retrying, while true credential/device 401/403 errors still move to `auth_required`.
  - Runtime API calls now retry only network/5xx failures; 4xx credential/device failures still fail fast. Pairing-code exchange remains non-retried to preserve one-time-code semantics.
  - Backend product code already bound device-client requests through credential context; this round added tests proving spoofed client `deviceId` values are overwritten and wrong client type is rejected.
- Findings ordered by severity:
  - No blocking scoped finding found in code review or automated verification.
  - Medium remaining acceptance risk: this proves the runtime behavior in automated tests, but not yet that the packaged `.exe` is installed under the employee's actual Windows profile and started by Windows after a real overnight shutdown.
  - Medium remaining operational risk: if the Windows sampler itself remains permanently broken on an employee computer, heartbeat/device visibility will recover, but no new foreground app usage can be generated until sampling works.
  - Low expected limitation: Owner-side UI readability/diagnostic display was explicitly out of scope per user instruction; this fix relies on existing `/devices`, reports, and live foreground APIs.
- Test/verification status:
  - `.\node_modules\.bin\prisma.CMD generate`: passed after approved network escalation.
  - `.\node_modules\.bin\tsc.CMD --noEmit -p apps\desktop-agent\tsconfig.json`: passed.
  - `.\node_modules\.bin\tsc.CMD --noEmit -p apps\api\tsconfig.json`: passed.
  - Desktop Agent ESLint from `workmap/apps/desktop-agent`: passed.
  - API ESLint from `workmap/apps/api`: passed.
  - Desktop Agent full package tests: 25/25 passed, including new sampler-failure heartbeat and stale-session recovery regressions.
  - API full package tests: 10/10 passed, including new device-client credential-binding regression and existing tracking/report isolation coverage.
  - Desktop Agent build: passed.
  - API build: passed.
  - `git diff --check`: passed with CRLF working-copy warnings only.
  - High-confidence secret scan: no matches. A broader scan with generic `Bearer` matching returned documentation/code false positives only.
  - `pnpm.cmd --filter ...` attempts were blocked by existing pnpm non-interactive purge/registry-fetch behavior, so equivalent local npm/direct-bin verification was used.
- Manual QA status: not run on the physical employee Windows computer. Required manual acceptance: install `0.5.6`, confirm tray startup after Windows login, confirm `/devices` lastSeen refreshes after reboot, confirm foreground app usage appears in Owner reports, confirm sleep/wake does not leave the device disconnected, confirm offline queue drains after reconnect, and confirm revoking the device still forces re-pair.
- Risks:
  - No installer artifact was produced in this round; `npm.cmd run build` produced the local alpha build only, not the NSIS release installer.
  - The deployed Render API must contain the current backend behavior and the employee computer must be paired with the new `0.5.6` credential/device record for end-to-end acceptance.
  - Existing unrelated Web loader changes remain dirty in the worktree and were intentionally not reviewed as part of this QA pass.
- Pass/fail recommendation: pass for scoped Desktop Agent/API functional implementation and automated regression coverage. Do not call the real employee-machine issue fully resolved until the packaged `0.5.6` installer passes the real reboot/sleep/network acceptance matrix.
- Whether the next round can proceed: yes. Next round should package/release `0.5.6` and run physical Windows acceptance.

---

## 2026-07-09 Desktop Agent 0.5.6 Scope Proposal QA

- Reviewed implementation: Desktop Agent runtime loop, API client timeout/error handling, Windows foreground sampler, Electron startup/autostart, local DPAPI credential storage, queue/status files, backend device/session/report services, frontend API types, and Employees aggregation behavior.
- Diff review summary: no product code was changed. This round produced a concrete 0.5.6 scope recommendation for reliability/diagnostics, with real user scenarios and boundaries.
- Findings ordered by severity:
  - High: an Agent-only release can improve local heartbeat/recovery, but Owner-side clarity requires API/Web diagnostics too. Otherwise Owner still sees only stale `lastSeenAt`/report gaps.
  - High: heartbeat must be decoupled from foreground sampling; otherwise sampler failure can make a running tray process appear disconnected from the Owner side.
  - Medium: stale session 403 should be recoverable; treating all 403 responses as invalid credentials risks unnecessary re-pairing.
  - Medium: DPAPI/wrong-Windows-user failures need explicit UI/diagnostics because installed apps are per-user and credentials are protected to the Windows account.
- Test/verification status: read-only review only. No automated tests were run because no product code changed.
- Manual QA status: not run.
- Risks: this is a proposal, not an implementation. The next coding round must convert the scope into tests and code before packaging.
- Recommendation: proceed only after confirming whether 0.5.6 includes Owner-side API/Web diagnostics or is limited to the Windows `.exe`. For the stated monitoring need, coordinated Agent + API/Web diagnostics is recommended.

---

## 2026-07-09 Desktop Agent Still Disconnected Diagnostic QA

- Reviewed implementation: Desktop Agent `runtime.ts`, `apiClient.ts`, `pairing.ts`, Electron startup, local credential/status storage, backend `device-client` controller, backend `DevicesService`, and previous Desktop Agent stale-connected handoff.
- Diff review summary: no product code was changed. This was a read-only diagnostic review prompted by the employee Desktop Agent still failing to refresh Owner-side device/report data after the `0.5.5` release.
- Findings ordered by severity:
  - High: heartbeat is coupled to successful foreground sampling. If the Windows foreground sampler fails persistently, the Agent process can keep running while no heartbeat reaches `/device-client/heartbeat`, leaving `/devices.lastSeenAt` stale and reports disconnected.
  - Medium: heartbeat/upload `401/403` failures are all treated as `auth_required`. A stale or inactive `agentSession` can produce a backend `403` that may be recoverable, but the current Agent can stop as if the credential were invalid.
  - Medium: diagnostics are still too thin. `status.json` has one error string, but there is no persistent rolling log or explicit UI row for API URL, agent version, bound device id/user, last heartbeat request result, and sampler status.
- Test/verification status: read-only source review only. No automated tests were run because no implementation code changed in this round.
- Manual QA status: not run on the employee Windows computer. Required evidence: capture Agent window status/error line and `%LOCALAPPDATA%\WorkMap\DesktopAgent\status.json` after the disconnected state appears.
- Risks: the exact live cause is not confirmed until employee-machine status/config data is inspected. Plausible live causes include sampler failure, stale session 403, revoked/invalid credential, wrong Windows user profile, blocked network/API, or still-running older binary.
- Recommendation: do not treat `0.5.5` as the final fix. It improved stale-state truthfulness but did not harden the heartbeat/upload loop. Next round should implement heartbeat/sampler decoupling and stale-session recovery, then package a new Desktop Agent release for employee-machine verification.

---

## 2026-07-09 WorkMap Loading Pixel Walker QA

- Reviewed implementation: shared `WorkMapLoader` markup, global loader CSS, selected layered avatar asset paths, six-frame down-walk animation coordinates, reduced-motion behavior, and source regression test coverage.
- Diff review summary: the old rotating `wm-loader-mark`/`WM` logo has been removed from the loader component. The replacement is a four-layer pixel avatar stacked from existing public spritesheets, animated with `background-position` across the confirmed walk-down frames. No loading-state timing, data readiness, auth, or route behavior changed.
- Findings ordered by severity: no scoped blocking finding. Existing repository blocker remains `workmap/apps/web/lib/api/authApi.ts`, which contains NUL/invalid characters and prevents full Web parsing/build.
- Test/verification status: `tsx --test apps/web/test/workmap-loader-source.test.ts` passed 3/3; targeted ESLint passed for `WorkMapLoader.tsx` and the new test; all four sprite asset files were confirmed present; `git diff --check` passed with LF-to-CRLF warnings; scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm.cmd --filter @workmap/web typecheck`, `pnpm.cmd --filter @workmap/web lint`, and `pnpm.cmd --filter @workmap/web build` all failed on the pre-existing `authApi.ts` invalid-character/NUL corruption before full-app validation could complete.
- Manual QA status: not run. Product Design rendered comparison is blocked because the local Web app cannot build until `authApi.ts` is restored.
- Risks: the animation frame coordinates and asset paths are automated-source-tested, but the final perceived scale and visual timing still need browser verification after the build blocker is fixed.
- Recommendation: pass for scoped code review and targeted automated verification. The next round can proceed, but release/deployment acceptance requires fixing `authApi.ts`, rerunning full Web checks, and visually QAing the loader on real routes.

---

## 2026-07-08 Virtual Office Complete-Render Loading Gate QA

- Reviewed implementation: route/auth loading handoff, cached/API office data completion, avatar readiness, TMX loading, tileset/avatar image loading, main canvas first draw, mini-map first draw, full-page loader layering, and map-load error behavior.
- Diff review summary: the Virtual Office continues mounting behind the existing fixed full-page loader so its canvases can initialize, but the chrome/empty canvas cannot become visible until all four readiness gates pass: API data, parsed map, main scene first frame, and mini map first frame.
- Findings ordered by severity: no blocking finding in the scoped diff. Existing high-impact repository blocker remains the NUL-corrupted `workmap/apps/web/lib/api/authApi.ts`.
- Test/verification status: targeted readiness/navigation/reports tests passed 8/8; targeted ESLint passed for the combined changed source/test files; `git diff --check` passed with LF-to-CRLF warnings. Readiness tests verify that any incomplete gate keeps the final UI covered.
- Verification blocked/limited: full Web typecheck/lint/build cannot parse the existing corrupted `authApi.ts`; pnpm also continues to abort its non-interactive modules purge before package scripts.
- Manual QA status: not run. Required cold-load check: navigate into `/virtual-office`, verify the rotating WorkMap Logo is the only visible page state, then verify the complete map/chrome/mini-map appears in one transition after first draw.
- Risks: the loading gate intentionally waits for the initial API request; without an API timeout, a truly hung network request can leave the loader displayed. Asset load errors resolve through the existing tolerant image behavior, while TMX failure shows an explicit error card.
- Recommendation: pass for scoped implementation and targeted automated verification. The next round can proceed, but deployment acceptance requires repairing `authApi.ts`, completing full Web checks, and running cold-cache browser QA.

---

## 2026-07-08 Virtual Office Role-Aware Workspace Menu QA

- Reviewed implementation: shared workspace navigation configuration, AppShell role filtering, Virtual Office authentication-role propagation, top-bar dropdown rendering, and navigation-role regression tests.
- Diff review summary: removed the Virtual Office hardcoded route list and made both AppShell and the Virtual Office dropdown consume one role matrix. The dropdown excludes the current Office route and uses the backend-confirmed role after authentication resolves.
- Findings ordered by severity: no blocking finding in the scoped diff. Existing high-impact repository issue remains `workmap/apps/web/lib/api/authApi.ts`, which contains only NUL bytes and prevents full Web parsing/build.
- Test/verification status: targeted workspace navigation and reports tests passed 7/7; targeted ESLint passed for all changed source/test files; `git diff --check` passed with LF-to-CRLF warnings. Employee exact-route coverage confirms Reports is absent; Manager/Owner/IT Admin role matrices and backend role aliases are also covered.
- Verification blocked/limited: `pnpm --filter @workmap/web typecheck` aborted before scripts because pnpm attempted a non-interactive workspace module purge. Direct full Web TypeScript parsing, full Web test suite, full ESLint, and Next production build failed on the pre-existing NUL-corrupted `authApi.ts`; the full tests reached and passed the navigation assertions before another test imported that file.
- Manual QA status: not run. Required authenticated checks: compare the `/virtual-office` dropdown with AppShell as Employee, Manager, Owner, and IT Admin; confirm Employee cannot see Reports and the current Office route is not duplicated.
- Risks: navigation visibility is not a security boundary; backend route/API authorization must continue enforcing access. Until `authApi.ts` is restored, full build and browser validation remain unavailable.
- Recommendation: pass for scoped implementation and targeted automated verification. The next round can proceed, but deployment readiness requires restoring `authApi.ts` and completing full Web checks plus role-based browser QA.

---

## 2026-07-08 Virtual Office Offline Movement Animation Fix QA

- Reviewed implementation: virtual-office presence freshness helper, REST position-to-remote-player mapping, realtime remote-player render merge, and canvas animation dependency on `player.isMoving`.
- Diff review summary: added a single movement-animation guard for `idle`/`offline` presence. REST positions now normalize freshness before deciding whether `isMoving` may remain true; realtime render merge applies the same guard defensively.
- Findings ordered by severity: no blocking diff-level finding. Existing blocker outside this change remains `workmap/apps/web/lib/api/authApi.ts`, which contains NUL/invalid characters and prevents full Web parsing/build.
- Test/verification status: targeted ESLint passed for `presence.ts`, `useVirtualOfficeData.ts`, and `OfficeMap.tsx`. TypeScript `transpileModule` syntax check passed for those files. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm --filter @workmap/web typecheck` aborted before package scripts because pnpm attempted a workspace install in non-interactive mode. Direct Web `tsc`, full Web ESLint, and Next build failed on the pre-existing `apps/web/lib/api/authApi.ts` invalid-character/NUL corruption.
- Manual QA status: not run. Required browser check: view `/virtual-office` from one account while another account exits and becomes stale/offline; confirm the offline avatar no longer bobs or walks.
- Risks: this fix intentionally leaves offline avatars at their last known map position. If product expectation is to hide users after leaving, that requires a separate behavior decision and likely backend/realtime presence handling.
- Recommendation: pass for scoped diff review and targeted checks. Next round can proceed, but deployment readiness still requires repairing `authApi.ts` and running full Web verification.

---

## 2026-07-08 Employees Split Status Filters QA

- Reviewed implementation: `/employees` toolbar state, dropdown option generation, combined filter predicate, summary bar text, and empty-state copy in `EmployeeDirectory.tsx`.
- Diff review summary: the previous single Status dropdown now becomes two independent filters. `Virtual map` uses the virtual-office presence status, while `Device status` uses the new report/device activity status with `No report signal` fallback for missing values.
- Findings ordered by severity: no blocking diff-level finding. Existing blocker outside this change remains `workmap/apps/web/lib/api/authApi.ts`, which contains NUL/invalid characters and prevents full Web parsing.
- Test/verification status: targeted ESLint passed for `EmployeeDirectory.tsx`. TypeScript `transpileModule` syntax check passed for `EmployeeDirectory.tsx`. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm --filter @workmap/web typecheck` did not reach the package script because pnpm attempted a workspace install and aborted in non-interactive mode. Direct Web `tsc --noEmit --incremental false` failed on the pre-existing `lib/api/authApi.ts` invalid-character/NUL corruption.
- Manual QA status: not run. Required checks: select a virtual-map status such as `Offline`; select a device status such as `Focus active` or `Signal delayed`; confirm both filters combine with Department, Search, and Manager/Employee mode.
- Risks: full app build verification and visual browser QA remain pending until `authApi.ts` is repaired.
- Recommendation: pass for scoped diff review and targeted checks. Next round can proceed after full Web environment repair or to another scoped frontend fix with the same known build blocker documented.

---

## 2026-07-08 Employees And Dashboard Split Presence/Device Status QA

- Reviewed implementation: shared people-status aggregation helper, `/employees` API row mapping, Employee Directory status cell, Dashboard "People in the office" cards, Manager overview data loading, and shared `DashboardEmployee` shape.
- Diff review summary: the UI now separates virtual-office presence from device/report activity. Virtual map status is sourced from virtual-office positions with existing freshness logic; device activity status is sourced from reports/live usage plus visible Desktop Agent and Browser Extension device signals.
- Findings ordered by severity: no blocking diff-level finding in the scoped files. Existing blocker outside this change: `workmap/apps/web/lib/api/authApi.ts` currently begins with NUL/invalid characters, which prevents full Web typecheck, lint, and build from parsing the app.
- Test/verification status: targeted ESLint on changed files passed. TypeScript `transpileModule` syntax check for the changed source files passed. `git diff --check` passed with LF-to-CRLF working-copy warnings. Scoped secret scan returned no matches.
- Verification blocked/limited: `pnpm --filter @workmap/web typecheck` did not reach scripts because pnpm attempted a workspace install and aborted in non-interactive mode. Direct `tsc --noEmit --incremental false`, full `eslint .`, and `next build` all failed on the pre-existing `lib/api/authApi.ts` invalid-character/NUL corruption before they could validate the full app.
- Manual QA status: not run. Required checks: view `/employees` Manager and Employee filtered lists and verify two badges per row; verify the Status filter still follows virtual-map presence; view `/dashboard` "People in the office" and confirm each card shows both virtual-map and device/report status.
- Risks: the local app cannot complete full build verification until `authApi.ts` is restored. Device status labels depend on available report/live/device data; if a role lacks company reporting or a person has no signal, dashboard cards may correctly show `No report signal`.
- Recommendation: pass for scoped diff review and targeted checks. Do not treat this as deployment-ready until the existing `authApi.ts` corruption is fixed and full Web typecheck/lint/build plus browser QA pass.

---

## 2026-07-08 Desktop Agent Stale Connected Status Fix QA

- Reviewed implementation: Desktop Agent runtime initial status, Electron runtime startup failure handling, renderer heartbeat-freshness health derivation, local timestamp display, and GUI release tests.
- Diff review summary: the change is scoped to preventing stale local `status.json` from being presented as current Connected. Runtime starts as offline, startup crashes write a sanitized error state, and the renderer only shows Connected when the last server-confirmed heartbeat is fresh.
- Findings ordered by severity: no blocking diff-level finding. Important product boundary: the backend `/devices` value for `mia admin test` already proves the last server signal was 2026-07-07; this fix corrects the local Agent's misleading presentation but does not repair the already-installed 0.5.4 binary or any underlying network/auth/runtime failure on that employee computer.
- Test/verification status: Desktop Agent direct `tsc --noEmit` passed. `test/gui-release.test.ts` passed 3/3. `test/queue-api.test.ts` passed 5/5. `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned no matches.
- Manual QA status: not run on the Employee Windows computer. Required check: install the next packaged Desktop Agent build, restart the machine or wait across a day boundary, and confirm the local Agent state matches `/devices.lastSeenAt` freshness instead of showing stale Connected.
- Risks: if heartbeat still fails after the next install, Owner reports will remain disconnected; the expected improvement is that the Agent window will expose stale/offline/error rather than falsely reassuring the employee.
- Recommendation: pass for scoped implementation and automated verification. Proceed to package/release/install verification before treating the production Employee machine issue as resolved.

---

## 2026-07-08 Employees Device Heartbeat Aggregation Fix QA

- Reviewed implementation: `/employees` device-health aggregation, `WorkMapApiDevice` frontend type, existing `listDevices()` API wrapper, and backend `/devices` response shape.
- Diff review summary: the page now uses `/devices` as an authenticated API call rather than expecting a frontend `/devices` route. Desktop Agent device `lastSeenAt` is merged per bound user with browser-extension coverage and report/live activity before rendering `Device online/delayed/offline`.
- Findings ordered by severity: no blocking diff-level finding. Important boundary: Owner Reports still use session heartbeat for the `Desktop Agent now` card, so this directory fix does not by itself prove the live session card will become online.
- Test/verification status: `git diff --check` passed with LF-to-CRLF warnings. Scoped secret scan returned only existing documentation/env-name references; no new secret was introduced.
- Verification blocked/not run: Web typecheck/lint/build were not rerun due the known local pnpm/Prisma dependency-state blocker from the previous round.
- Manual QA status: not run. Required check: after deploying, reload `/employees` and confirm the status text includes `/devices`; verify the Employee row device health reflects the Desktop Agent's recent backend `lastSeenAt`.
- Risks: if `/devices` fails because the frontend API base is wrong, auth is missing, or the device is bound to another user, the row can still show offline. This is expected and should be surfaced with a future diagnostics view.
- Recommendation: pass for scoped diff review; proceed to browser/API verification on the deployed environment.

---

## 2026-07-08 Desktop Agent Connected Locally But Owner Report Interrupted QA

- Reviewed implementation: Desktop Agent runtime heartbeat/session/upload code, pairing code exchange, local Agent UI status rendering, backend device heartbeat/session/report status logic, and report panel display.
- Diff review summary: documentation-only investigation. No runtime diff was introduced.
- Findings ordered by severity:
  - High likely cause: the paired device may be bound to a different WorkMap user than the employee selected in Owner reports. Pairing codes are user-bound to the account that generated the code.
  - High diagnostic gap: Agent local `Connected` is not the same as Owner-visible `online`; Owner requires backend `agentSession.lastHeartbeatAt` within 30 seconds.
  - Medium: `Pending uploads: 6` indicates queued local events and should be treated as an upload/API/network/auth signal until proven otherwise.
  - Medium: Desktop Agent default API and `Open WorkMap` frontend URL are hardcoded to the current deployed targets; mismatched deployments can produce split-brain status.
- Test/verification status: source review only. No automated tests were run because no runtime code changed.
- Manual QA status: not run. Required checks are to compare `/devices` device id/user ownership with the selected report user, verify the API base URL in the paired Agent config, and confirm the Owner report is using the same API deployment.
- Risks: without a diagnostics surface, support relies on manually checking device id/user/API URL. The next implementation should make these facts visible without exposing credentials.
- Recommendation: pass for investigation. Next round can proceed with a scoped diagnostics/UI fix or with manual production data verification.

---

## 2026-07-08 Employees Dynamic Aggregation Page QA

- Reviewed implementation: `/employees` now aggregates `/users`, today's company usage summary, company live agent status, and browser-extension coverage; backend reports now include per-user `topApp/topDomain` fields where available.
- Diff review summary: the previous hardcoded Today values (`API scoped`, `Contact view`, `Not shown`) were removed from the API-mapped rows. Rows now display real active/idle durations, top app/domain from reports, device health from activity/coverage, and explicit unavailable/no-data labels when the API cannot provide data.
- Findings ordered by severity: no blocking diff-level finding in the scoped changes. Medium limitation remains: live `topDomain` is not available because live browser foreground-domain state is not currently part of the reports API; same-day summary `topDomain` is used when present.
- Test/verification status: `git diff --check` passed with LF-to-CRLF warnings. Targeted direct `tsc` filtering identified and the implementation fixed new implicit-any/type narrowing issues introduced in `reports.service.ts`.
- Verification blocked: standard pnpm scripts did not reach typecheck/test because the local pnpm wrapper attempted an install and failed on non-interactive module purge, ignored dependency build scripts, and bin creation errors. Direct API typecheck/test remain blocked by missing/generated Prisma client artifacts. Direct Web typecheck remains blocked by an existing invalid-character parse error in `workmap/apps/web/lib/api/authApi.ts`.
- Manual QA status: not run. Required browser check: use an Owner/Manager account with an employee machine producing activity, open `/employees`, confirm Today values are not placeholders, and verify Department/Status/Manager/Employee filters still update rows and counts.
- Risks: aggregation depends on reports endpoints being deployed with the new `employeeUsage.topApp/topDomain` contract. Report failure is now visible in the summary/status text, but should be verified against real 403/500 cases.
- Recommendation: pass for scoped diff review, with automated verification currently blocked by local dependency/Prisma state. Next round can proceed after environment repair and browser QA.

---

## 2026-07-08 Employees Directory Filter Behavior Fix QA

- Reviewed implementation: `/employees` directory filtering in `EmployeeDirectory.tsx`, API row mapping in `app/employees/page.tsx`, and shared `DashboardEmployee` type update.
- Diff review summary: filtering now combines search, department, status, and Manager/Employee role filter. API users are mapped into `roleGroup` from backend role so the segmented control changes the displayed list.
- Findings ordered by severity: no blocking diff-level finding. The page still intentionally displays placeholder Today metrics and inferred device labels; real report/device aggregation was not part of this fix.
- Test/verification status: `git diff --check` passed with existing LF-to-CRLF warnings. Scoped secret scan found only existing handoff/QA documentation examples referencing `WORKMAP_JWT_SECRET=qa-local-secret`.
- Verification blocked: Web typecheck/lint did not run because pnpm attempted a workspace install first and failed before reaching TypeScript/ESLint due node_modules/bin/lockfile permission and ignored-build-script policy errors in this environment.
- Manual QA status: not run. Required check: use `/employees` Department, Status, Manager, and Employee controls and confirm row list plus summary counts update.
- Risks: fallback/mock role inference is heuristic for old demo rows; API rows have explicit role groups. The dynamic data gap for Today metrics/device health remains.
- Recommendation: pass for scoped code review; perform browser interaction QA before treating the UX as accepted.

---

## 2026-07-08 Virtual Office Navigation Menu Layer Fix QA

- Reviewed implementation: `/virtual-office` top brand trigger and expanded workspace navigation menu z-index changes in `VirtualOfficeTopBar.tsx`.
- Diff review summary: the change is limited to stacking order. The navigation menu now renders above the left rail while remaining below the command palette/modal layer.
- Findings ordered by severity: no blocking code finding from diff review. Remaining visual QA is required because browser rendering was not exercised here.
- Test/verification status: `git diff --check` passed with the existing LF-to-CRLF warning. Scoped secret scan found only an existing docs example `WORKMAP_JWT_SECRET=qa-local-secret`.
- Verification blocked: Web typecheck/lint did not execute because pnpm attempted a pre-run install and aborted in non-interactive mode with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- Manual QA status: not run. Check `/virtual-office` by opening the Virtual Office card and confirming the expanded menu is not hidden behind the left rail.
- Risks: needs viewport smoke around the screenshot size plus narrow breakpoints to confirm no new overlap.
- Recommendation: pass for scoped code review; next round can proceed after a quick browser visual confirmation.

---

## 2026-07-07 Browser Extension Alpha ZIP Release Preparation QA

- Reviewed: fresh Browser Extension 0.4.0 build, generated ZIP structure, artifact naming, checksum, expected GitHub Release URL, and required Vercel build-time environment configuration.
- Verification passed: extension build; ZIP root contains `manifest.json` and required UI/dist assets; SHA-256 recorded as `AD85B9E8B3FB6839D3DF2BB8AC4F745CCE8E0CF50C7176865C8BA37FCB7D628F`; `git diff --check`; scoped secret scan.
- Manual QA: not run. GitHub publication, anonymous asset download, Vercel environment update/redeployment, Employee Chrome/Edge install/pairing, and Owner coverage verification remain pending.
- Findings: no package-structure blocker. External authenticated publication is the current gate; private repository visibility would prevent a normal anonymous Employee download.
- Recommendation: pass for local release preparation. Do not claim deployment complete until the asset URL and newly built Web deployment are verified.
- Next round can proceed after the GitHub Release asset is uploaded or an alternative stable HTTPS artifact URL is supplied.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Manual Browser Extension Employee Setup QA

- Reviewed implementation: separated Device Setup panels, configurable Browser Extension ZIP download, Chrome/Edge manual instructions, one-time pairing action, existing-device detection, and paired-state feedback.
- Diff review: changes remain within Employee Device Setup/configuration and handoff documentation. Desktop Agent gating and Browser Extension monitoring/API/reporting logic are unchanged.
- Findings ordered by severity: no blocking or high-severity code findings. Deployment remains incomplete until a correctly rooted Alpha ZIP is published and `NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL` is configured during the Web build.
- Verification passed: Web typecheck, lint, and production build; Browser Extension 13/13 automated tests and build; `git diff --check`; scoped secret scan.
- Verification environment note: direct sandbox execution hit an environment `EPERM` while Node read TypeScript; approved out-of-sandbox reruns passed.
- Manual QA: not run. Real Chrome/Edge Developer mode install, ZIP extraction, permissions, pairing, browser restart, manual update/Reload, disable/remove, and Owner coverage transitions remain to be exercised.
- Risks: unpacked extension directory movement/removal breaks the client; Employee-controlled disable/remove and manual version drift are expected constraints of the selected Alpha path.
- Recommendation: pass for implementation, with release configuration still required. The next round can proceed to ZIP publication and real Employee/Owner end-to-end QA.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Non-Store Browser Extension Workflow Review QA

- Reviewed: current Employee pairing/options flow, extension startup/heartbeat behavior, Owner coverage semantics, manual unpacked installation, and enterprise-managed external distribution boundaries.
- Finding: manual unpacked loading is viable for controlled Alpha testing but is not a production self-service distribution channel. It requires Developer mode, a permanent local folder, manual permission/pairing steps, and manual update/reload operations.
- Finding: enterprise-managed deployment can provide automatic installation and managed updates, but requires customer IT/browser management plus stable signing/ID, hosting, update, rollback, and support infrastructure not currently implemented by WorkMap.
- Owner finding: current Owner/Manager view remains heartbeat-based. It can show connected versus signal lost and domain summaries, but cannot truthfully distinguish disable, removal, browser exit, sleep, offline state, profile change, or failure.
- Verification: source and official browser documentation review only. No runtime code changed, so automated tests and real browser/manual QA were not run.
- Risks: unmanaged users can disable/remove the unpacked extension and remain on old versions; closing a browser window does not necessarily end the browser process; current Alpha packaging is not a managed updater.
- Recommendation: pass for workflow assessment. Proceed with unpacked installation only for a small pilot; production should use either an official store or a deliberately implemented enterprise-managed channel.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Browser Extension Store Publication Effort Review QA

- Reviewed: current MV3 manifest/version/name/permissions and official Chrome Web Store and Microsoft Edge Add-ons publication requirements.
- Finding: publication is feasible and does not require rebuilding the tracking engine. It does require two publisher/listing workflows, store assets, privacy/data-use disclosures, permission justifications, packaging, cross-browser QA, and independent reviews.
- Important finding: `tabs`, `idle`, `scripting`, and optional broad host access are the principal review surface. The store declarations, public privacy policy, and actual hostname/timing behavior must remain consistent.
- Verification: documentation and manifest review only. No runtime code changed, so extension/web/API automated tests and manual browser QA were not run.
- Risks: approval and review time are external; the current Alpha name/package and absent production listing assets/URLs are not ready for immediate public submission.
- Recommendation: pass as a feasibility/effort assessment. The next round can proceed with a scoped store-readiness implementation after publisher ownership, privacy policy, and brand assets are decided.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Browser Extension Employee Control And Owner Coverage QA

- Reviewed: Chrome/Edge employee extension controls, managed-install distinction, MV3 service-worker/alarm lifecycle, WorkMap heartbeat schedule, 90-second API signal-loss threshold, Reports ten-second polling, recovery interval recording, and current Owner copy.
- Confirmed: normal self-service users can inspect, disable, re-enable, remove, and change site access for the extension. Enterprise policy may remove some of those controls.
- Confirmed: Owner coverage updates from heartbeat freshness, not from a direct browser-close event. Expected visible transition is about 90–100 seconds after the last successful signal while Reports is open.
- Important boundary: a closed window may leave the browser/background process running; disable/remove/browser exit/offline/sleep are indistinguishable from heartbeat loss alone.
- Confirmed recovery: the next startup/re-enable heartbeat restores Connected and records an outage interval when the gap exceeded 90 seconds.
- Verification: source/official-documentation review; existing API coverage-loss test asserts the exact 90-second boundary. No code changed and no tests/manual runtime QA were run this round.
- Recommendation: pass for current honest coverage semantics. Do not label the state as exact Disable or Browser closed without an independent managed/native observer.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Employee Self-Service Extension Setup Feasibility QA

- Reviewed: current Employee Device Setup, pairing API/status, extension options/permissions/manifest, lack of store links and `externally_connectable`, and official Chrome/Edge distribution boundaries.
- Finding: a Desktop-Agent-like WorkMap setup wizard is feasible, but a normal website cannot silently install the extension. Browser-native store installation and permission confirmation remain mandatory for self-service users.
- Recommended architecture: browser-specific official store link → native install confirmation → short-lived WorkMap pairing → connected status. Optional WorkMap-to-extension message passing requires a stable store ID and tightly restricted `externally_connectable` origin allowlist.
- Security boundary: do not put a persistent device credential in a URL, page storage, query string, or external message. Only the existing short-lived one-time code may cross the WorkMap-to-extension boundary.
- Distribution finding: unpacked loading remains Alpha/development only. Normal Chrome users require Chrome Web Store; Edge users should use Edge Add-ons; managed organizations may use enterprise force-install policies.
- Verification: source/architecture review and official browser documentation only. No runtime code or tests changed.
- Recommendation: pass for feasibility. Proceed only after choosing store self-service or enterprise-managed distribution, then implement and manually verify install/update/remove/pairing flows.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Employee Browser Extension Installation QA

- Reviewed: Employee Device Setup, Browser Extension pairing control/status, MV3 options page, manifest permissions, Alpha unpacked output, and repository/store-link search.
- Finding - High product gap: the Employee account can generate a pairing code but cannot obtain/install the extension from WorkMap. No Chrome Web Store or Edge Add-ons distribution exists.
- Current test-only path: administrator supplies `alpha-unpacked`; Employee uses browser Developer mode and Load unpacked, then pairs through Extension options.
- Operational risk: unpacked installation is technical, requires the directory to remain available, exposes Developer mode warnings, and has no automatic updates. It must not be presented as a production Employee installation flow.
- Verification: source review only; no runtime code changed and no automated/manual install test was run.
- Recommendation: pass only for controlled Alpha installation. Before broader rollout, implement store/enterprise distribution plus Employee-facing install links and end-to-end installation QA.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Reports Default And Persistent Filters QA

### Reviewed Implementation

Reviewed Reports initialization, local-vs-UTC current date, role default scope, department default, user/department option restoration, local-storage isolation, Apply/preset behavior, initial summary request, live polling, Apps/Domains rendering, exports, and unchanged API authorization.

### Findings Ordered By Severity

- Fixed - High: default range previously opened on the last 30 days rather than the current day.
- Fixed - High: all filter values previously existed only in component memory and were lost after navigation or reload.
- Fixed - Medium: UTC `toISOString()` could select a different calendar day from the employee's local date around timezone boundaries.
- Fixed - Medium: saved filters now validate against the current role and directory instead of restoring an unauthorized/removed employee or department.
- Confirmed: Apps and Domains are generated from the same summary response and one applied filter object; no separate or stale domain filter path exists.
- Preserved: roles without company-summary permission still fall back to My activity, and backend RBAC/tenant scoping remains authoritative.

### Test And Verification Status

- Web tests: passed 25/25, including three new filter default/persistence/isolation/authorization cases.
- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed; 19 routes generated.
- Manual browser QA: not run.
- `git diff --check` and scoped secret scan passed at final closeout.

### Risks And Recommendation

- Preferences are intentionally local to one browser profile and are not cross-device settings.
- Pass for scoped implementation and automated QA. Proceed to navigation/reload acceptance with one Owner/Manager and compare the App and Domain sections under the restored filter.

---

## 2026-07-07 Browser Extension 0.4.0 Manual Test Guide QA

- Reviewed: current manifest/package/unpacked output, permission and pairing screen, device credential storage, trusted page-activity contract, domain state machine, upload queue, API ingestion, report metrics, cross-browser interval union, and extension coverage panel.
- Finding: implementation is ready for local manual Chrome/Edge testing, but not yet store- or production-verified.
- Verification: Browser Extension tests passed 13/13; typecheck, lint, and build passed.
- Manual QA: not run. Real permission prompts, Employee pairing, multi-tab/window timing, Chrome/Edge overlap, idle transition, final-tab closure, offline recovery, disable/re-enable, and Owner Reports comparison remain to be executed.
- Deployment risk: the unpacked extension can be tested locally now, but an online end-to-end test requires the deployed API and Web to contain the matching 0.4.0 domain ingestion/report implementation.
- Recommendation: pass to manual Alpha acceptance; do not claim browser-store or production completion until the timed Employee/Owner matrix passes.
- `git diff --check` and scoped secret scan passed at final closeout.

---

## 2026-07-07 Desktop Agent Shutdown And Auto-Start QA

### Reviewed Implementation

Reviewed Electron window/tray lifecycle, paired startup configuration, runtime shutdown/finalization, queue/checkpoint recovery, CLI signal handling, current NSIS settings, legacy Alpha installer Run key, and existing automated coverage.

### Findings Ordered By Severity

- Expected: closing the GUI window hides a paired Agent to tray; it does not stop monitoring.
- Confirmed: tray `Quit Agent` awaits graceful runtime shutdown before Electron quits.
- Confirmed: a paired packaged Agent registers itself to start at the next Windows user sign-in with the `--background` argument.
- Medium: OS shutdown/logoff has no explicit Electron `query-session-end`/`session-end` shutdown hook. Windows will terminate the process, but a final synchronous upload/session-stop is not guaranteed.
- Mitigated: five-second tracking checkpoints, persistent event queue, and unclean-stop recovery bound the shutdown gap and restore saved activity on next launch.
- Remaining: real NSIS install, Windows shutdown, reboot, sign-in, hidden auto-start, tray presence, and Owner report reconciliation have not been manually verified on the Employee computer.

### Test And Verification Status

- Desktop Agent tests: passed 22/22.
- Desktop Agent typecheck: passed.
- Desktop Agent lint: passed.
- Manual lifecycle QA: not run.
- `git diff --check` and scoped secret scan passed at final closeout.

### Recommendation

Pass for source behavior and automated durability coverage. Proceed to a real paired Windows shutdown/reboot lifecycle test before claiming production-grade graceful shutdown or auto-start behavior.

---

## 2026-07-07 Hard Redirect For Missing Cognito Session QA

### Reviewed Implementation

Reviewed AppShell startup/logout, custom Cognito restoration, shared API token failure, standalone protected onboarding/office routes, public root/login/callback/invite routes, stale shell/workflow state, and authenticated backend-mapping failure behavior.

### Findings Ordered By Severity

- Fixed - High: AppShell previously set loading false after missing authentication, leaving navigation, protected children, and a “Sign in needed” role badge visible.
- Fixed - High: Virtual Office previously showed a protected-route “Sign in required” card instead of returning to the login landing route.
- Fixed - High: a mounted page that finally lost refresh capability could receive API 401/fallback content without leaving the protected route.
- Fixed - Medium: standalone Company/Avatar/Device Setup routes rendered protected content while authentication was still unresolved.
- Preserved: an existing Cognito session with backend mapping or role-access failure remains distinguishable from a missing login and is not incorrectly redirected as logged out.

### Test And Verification Status

- Web tests: passed 22/22. New coverage confirms protected routes replace to `/`, while `/`, `/login`, `/login/callback`, and invitation links remain public.
- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed; 19 routes generated.
- `git diff --check`, forbidden fallback-copy scan, and scoped secret scan passed at final closeout.

### Manual QA, Risks, And Recommendation

- Manual browser QA was not run in this environment.
- Remaining acceptance: signed-out direct navigation, explicit Logout, cross-tab/final refresh-token loss, and browser Back behavior on the deployed app.
- Pass for scoped implementation and automated QA; proceed to deployed authentication-boundary testing.

---

## 2026-07-07 Compliance Card-Gap Background QA

- Reviewed: screenshot target, Compliance grid/component structure, editorial CSS override order, card inheritance, and responsive grid behavior.
- Finding: the visible white strips came from the two direct-child grid containers being styled as white cards by a broad redesign selector, not from the grid `gap` itself.
- Fix review: only layout containers are transparentized; nested content cards remain unchanged. No functional or accessibility behavior changed.
- Verification: Web typecheck, lint, and production build passed; 19 routes generated. `git diff --check` and the scoped secret scan passed at final closeout.
- Manual QA: not run because no in-app browser instance was available. Desktop/mobile `/compliance` refresh remains the visual acceptance step.
- Recommendation: pass for scoped code verification; proceed to visual confirmation.

---

## 2026-07-07 Browser Extension 0.4.0 Test-Readiness QA

- Reviewed: package/manifest version, unpacked output, content script/background/state/API modules, prior implementation handoff, and current automated checks.
- Finding: the `alpha-unpacked` directory is complete enough for Chrome and Edge load-unpacked manual testing.
- Verification: 13/13 extension tests passed; typecheck, lint, and build passed.
- Manual QA: not run. No claim is made yet for real permission prompts, pairing, timed multi-tab behavior, cross-browser de-duplication, Owner Report synchronization, disable/re-enable visibility, or store distribution.
- Risks: this remains an Alpha MV3 unpacked build; real browser/platform gaps require the documented acceptance matrix.
- Recommendation: pass to manual Chrome/Edge testing. Do not proceed to store/production claims until Employee/Owner timed acceptance passes.

---

## 2026-07-07 Cognito Idle Session Renewal QA

### Reviewed Implementation

Reviewed custom Cognito storage/expiry handling, Hosted UI token exchange, Amplify User Pool restoration, shared API authentication, 401 behavior, AppShell startup, cached API consumers, Virtual Office reconnect, company onboarding, logout, and unchanged role boundaries.

### Diff Review And Findings By Severity

- Fixed - High: short-lived ID/access token expiry previously deleted WorkMap's session and produced a false final “session expired” state even when Cognito/Amplify could still refresh the account session.
- Fixed - High: Hosted UI refresh tokens were discarded after authorization-code exchange, making Hosted UI sessions non-renewable in the custom session layer.
- Fixed - High: long-mounted components retained the login-time token. The shared client now resolves a current token per Cognito request and retries once after 401; WebSocket reconnect also resolves a current token.
- Fixed - Medium: concurrent expired-session requests could independently attempt recovery. Restoration is now single-flight.
- Fixed - Medium: AppShell and Owner onboarding now consume the restored session rather than treating short-token expiry as logout.
- Security finding: subject matching, explicit logout clearing, Cognito refresh-token expiry/revocation, backend authorization, tenant isolation, and RBAC remain enforced. No perpetual local bypass was introduced.
- Remaining - Medium: deployed idle/wake behavior still needs real Owner/Manager acceptance beyond the configured short-token lifetime.

### Test And Verification Status

- Web tests: passed 20/20, including the new expired-token/stale-client renewal regression.
- Web typecheck: passed.
- Web lint: passed, with only the existing Next.js ESLint-plugin detection warning.
- Web production build: passed; 19 routes generated.
- `git diff --check`: passed at final closeout (line-ending warnings only).
- Scoped real-secret scan: passed at final closeout; only explicit fake test tokens were present.

### Manual QA, Risks, And Recommendation

- Manual deployed Cognito QA was not run; no authorised production session was used.
- Expected final boundary: Cognito can still require login when the refresh token expires/is revoked or the account is disabled. That is correct security behavior, not the original short-token bug.
- Pass for scoped implementation and automated QA. Proceed to deployment and Owner/Manager idle/wake testing; do not claim deployed persistence until that test passes.

---

## 2026-07-07 Virtual Office Routing Menu QA

### Reviewed Implementation

The upper-left Virtual Office brand control now opens a frontend routing menu to existing workspace pages.

### Findings

- No P0/P1/P2 code finding after typecheck, lint, and production build.
- Existing route authorization remains unchanged and is not bypassed.
- Manual interaction QA is still needed in an authenticated office session.

### Verification Status

- Web typecheck: passed.
- Web lint: passed with existing Next.js plugin warning.
- Web production build: passed; 19 routes generated.

### Manual QA Status

Not run. Check toggle, outside click, Escape, keyboard focus, all four links, and mobile positioning.

### Recommendation

Pass for code verification. The next round can proceed after a short authenticated browser smoke of the new menu.

---

## 2026-07-07 Manager Reports Access QA

- Reviewed: Manager capability map, AppShell Reports navigation, Reports access gate/default scope, company/live authorization, individual employee authorization, tenant lookup, and audit behavior.
- Finding: Manager can view Reports, company aggregates, optional department-filtered aggregates, own report, and selected same-company employee reports.
- Security boundary: cross-tenant target lookup remains blocked/not found; sensitive company and individual report reads remain audit logged.
- Product-scope caveat: Manager access is tenant-wide unless a department filter is explicitly selected; it is not automatically limited to an assigned team/department.
- Verification: source review only; no code changed and no automated/manual runtime test was run.
- Recommendation: pass if tenant-wide Manager reporting is intended. Otherwise, do not treat the current optional department filter as authorization; implement server-side Manager scope restriction in a dedicated round.

---

## 2026-07-07 Global Typography Correction QA

- Reviewed implementation: global body/display font stack changed from condensed fonts to normal-width Inter/Segoe UI/Helvetica fallbacks; heading stretch removed and weight strengthened.
- Findings: no build or type validation failure; no functional code changed.
- Verification: `corepack pnpm --filter @workmap/web build` passed with 19 routes; `git diff --check` passed with line-ending warnings only.
- Manual QA: not run.
- Risk: exact rendering varies slightly if Inter is not installed, with Segoe UI used on typical Windows systems.
- Recommendation: pass for this scoped typography correction; the next round can proceed after visual confirmation.

---

## 2026-07-07 Top Navigation Square-Corner QA

- Reviewed implementation: editorial fixed-navigation outer radius changed from 18px to 0.
- Findings: no code-level issue; the later-loaded redesign stylesheet was the source overriding the global square-corner rule.
- Verification: `corepack pnpm --filter @workmap/web build` passed with 19 routes; `git diff --check` passed with line-ending warnings only.
- Manual QA: not run.
- Risk: cached CSS may require a hard refresh.
- Recommendation: pass for this scoped CSS change; the next round can proceed.

---

## 2026-07-07 Desktop Agent 0.5.3 Download Diagnosis QA

### Reviewed Implementation

Reviewed the Employee Device Setup source, deployed Device Setup HTML, current local Desktop Agent source/artifacts, and public GitHub Desktop Agent Releases.

### Findings Ordered By Severity

- High - External release/deployment mismatch: local Agent is `0.5.4`, but GitHub Releases currently stop at `0.5.3` and the deployed Vercel build embeds the direct `0.5.3` asset URL.
- Not a role bug: the invite-created Employee account does not select a different version; the same build-time URL is used for all users on Device Setup.
- No source-version bug: package metadata, pairing identity, and the local installer are all `0.5.4`.

### Verification And Manual QA Status

- Deployed page: HTTP 200; embedded installer URL is `desktop-agent-v0.5.3/WorkMap-Desktop-Agent-Setup-0.5.3.exe`.
- GitHub Releases API: latest Desktop Agent tag/asset is `desktop-agent-v0.5.3`; no `0.5.4` release was returned.
- Local artifact/source inspection: `0.5.4` confirmed.
- No runtime tests were run because no code changed. No Employee-computer manual download/install was run.

### Recommendation

Diagnosis passes. The next round can proceed with the explicitly authorized external release steps: publish the `0.5.4` GitHub asset, update the Vercel download environment variable, redeploy Web, then verify the deployed link and Employee download. Until then, `0.5.3` is the expected deployed result.

---

## 2026-07-06 Frontend Loading And Navigation QA

### Reviewed Implementation

Frontend-only loading overlays, Employees section loading, fixed application navigation, condensed typography, and removal of visible developer session/directory copy.

### Diff Review Summary

- Changes remain within `apps/web` presentation components/styles plus QA/handoff documentation.
- Existing API requests, authentication, permissions, and data mapping remain unchanged.

### Findings By Severity

- P0/P1/P2 code findings: none after typecheck, lint, and production build.
- Visual QA blocker: no in-app browser instance was available, so screenshot comparison could not be completed.
- Residual risk: system condensed-font availability and responsive fixed-navigation offset need manual browser confirmation.

### Verification Status

- Web typecheck: passed.
- Web lint: passed with existing Next.js plugin warning.
- Web production build: passed; 19 routes generated.

### Manual QA Status

Not run. `design-qa.md` records the unavailable-browser blocker.

### Recommendation

Code checks pass, but final visual acceptance should wait for one authenticated browser pass. The next round can proceed after confirming desktop/mobile navigation spacing and loading-state appearance.

---

## 2026-07-06 Keyboard And Mouse Monitoring Boundary Review

- Reviewed: Desktop Agent foreground/idle adapter references, API/Web report privacy copy, handoff docs, and scoped source search across Desktop Agent, API, Web, and shared packages.
- Finding: no implementation was found for keystroke logging, mouse click logging, mouse movement tracking, keyboard hooks, mouse hooks, `GetAsyncKeyState`, `SetWindowsHookEx`, or `WH_KEYBOARD`-style monitoring.
- Confirmed implementation boundary: Desktop Agent uses Windows `GetLastInputInfo` only to derive elapsed seconds since the last input for idle detection. It does not expose the key pressed, mouse button, click target, cursor coordinates, typed content, or interaction contents.
- Tests: source search/review only; no runtime tests were needed because no code changed.
- Manual QA: not run on the Employee computer.
- Recommendation: pass for the current privacy-boundary answer. If future idle/input implementation changes, rerun a capability scan before release and preserve the no-keystroke/no-mouse-event collection boundary.

---

## 2026-07-06 Desktop Agent Download URL Verification

- Reviewed: deployed Device Setup HTML, configured GitHub download URL, GitHub Release 0.5.1 asset redirect, and the mixed-version URL currently embedded by Vercel.
- High finding: deployed URL uses tag `desktop-agent-v0.5.0` with filename `WorkMap-Desktop-Agent-Setup-0.5.1.exe`; it returns HTTP 404.
- Verified good URL: the same filename under tag `desktop-agent-v0.5.1` returns HTTP 200 and an attachment response.
- Source finding: the page uses the public build-time `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL`; the cross-origin `download` attribute cannot repair an invalid URL.
- Tests: external HTTP checks only; no runtime tests were needed because no application code changed.
- Manual QA: not run on the Employee computer.
- Recommendation: update the Vercel environment variable, redeploy Web, then copy the link from the deployed button and verify it contains `desktop-agent-v0.5.1` before retrying the Employee download. The next round can proceed after this external configuration fix.

## Reviewed Implementation

Reviewed the Employee onboarding gate, backend device revocation response, API cold-start pairing flow, Electron IPC/context isolation, DPAPI credential persistence, runtime/tray/auto-start behavior, privacy copy, Electron Builder/NSIS configuration, ASAR resource paths, final executable, and existing foreground tracking regressions.

## Findings

- High external release requirement: the website still points to the old 0.4.0 ZIP until the 0.5.0 EXE is uploaded and `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` is changed.
- Medium production risk: final installer is Authenticode `NotSigned`; SmartScreen is expected until a signing certificate is configured.
- Medium accepted platform constraint: a browser may download an EXE but cannot launch it automatically. The Employee must open the installer once.
- Fixed: old 10-second pairing timeout now pre-warms Render and provides longer bounded timeouts and GUI progress.
- Fixed: revoked or Browser Extension devices cannot unlock the Desktop Agent onboarding requirement.
- Fixed: temporary visual-QA screenshot code was removed; no screenshot/title collection capability remains.

## Test And Verification Status

- Desktop Agent: typecheck pass, lint pass, 13/13 tests pass, NSIS build pass, packaged runtime smoke pass.
- Web: typecheck pass, lint pass, production build pass.
- API: typecheck pass, lint pass, independent output build pass, 9/9 tests pass.
- GUI visual QA: pass for the unpaired screen using Electron-rendered capture; final packaged process/window smoke also passed.
- Secret scan, screenshot/title capability scan, and `git diff --check`: pass.

## Manual QA Status

- Not yet run with a real Employee pairing code on a separate Windows computer.
- Required after deployment: installer launch, pair progress, website unlock, tray/background behavior, Windows sign-in auto-start, Owner live report, minimized/background exclusion, short-app exclusion, graceful stop, and forced interruption.

## Recommendation

Code and local release gates pass. Proceed to controlled deployment/manual QA, but do not call the Agent broadly production-ready until Authenticode signing and the separate-computer workflow pass.

---

## 2026-07-04 Codex Takeover Review Addendum

### Reviewed Implementation

Reviewed the repository operating guide, all requested `ai-handoff`, `ai-skills`, and `api` documents, mandatory current skill references, repository/package structure, Prisma model inventory, recent commit history, and pre-existing working-tree changes. No runtime implementation was modified.

### Diff Review Summary

- The takeover documentation is limited to `docs/ai-handoff/`.
- Existing user changes in the compliance framework, skills index, and reference directory were preserved.
- The new baseline explicitly distinguishes historical proposal/scaffold documents from newer code and handoff evidence.

### Findings By Severity

- High: none introduced by this documentation-only round.
- Medium: current status/project summary and several API/AI-skill documents are older than the latest Desktop Agent, Agent Session, reports, and extension implementation.
- Low: the repository has multiple documentation eras; future contributors could misread old “not implemented” statements without the documented source-of-truth order.

### Test And Verification Status

- `git diff --check`: passed for the complete working tree.
- Scoped secret scan with environment, dependency, build, generated, TypeScript build metadata, and reference-only paths excluded: passed with zero matching files.
- Runtime typecheck/lint/build/tests: not run because no runtime code changed.

### Manual QA Status

Not run and not required for the takeover documentation itself. Existing external Desktop Agent manual-QA requirements remain open.

### Risks And Recommendation

Pass for project takeover documentation. The next round can proceed. Runtime/release readiness must continue to use its own targeted verification and must not inherit a pass from this documentation review.

---

## 2026-07-04 Desktop Agent Timing Evidence Review

- Reviewed: latest QA/director handoffs, deferred manual-QA checklist, Desktop Agent runtime, tracking state machine, Windows foreground adapter references, and tracking-state tests.
- Finding: automated timing/state coverage exists, but no repository evidence marks precise real-employee-computer duration comparison as manually passed.
- Existing automated evidence: app switch duration, idle/resume, lock, short-segment filtering, duplicate sample handling, delayed-sample cap, graceful shutdown flush, persisted-segment recovery, and UTC day rollover.
- Manual QA: pending on a separate Windows employee computer, including minimized/background exclusion, under-five-second exclusion, live Owner report comparison, graceful stop, and forced interruption.
- Tests rerun: none; this was a read-only evidence review.
- Recommendation: do not yet claim real-device duration accuracy. The next round may proceed with a controlled timed manual test.

---

## 2026-07-06 Desktop Agent Foreground Timing And Owner Sync QA

### Reviewed Implementation

Reviewed the Windows foreground adapter, Desktop Agent state/heartbeat ordering, Agent Session persistence, user/company/department report authorization, live foreground aggregation, persisted-summary revision refresh, frontend live-overlay merge, UWP Microsoft Store handling, privacy field boundaries, Alpha output, and NSIS installer.

### Diff Review Summary

- Change is constrained to Desktop Agent foreground application identification/timing, Reports live synchronization, their tests, and relevant handoff/API/frontend skill documentation.
- No schema migration, auth redesign, RBAC widening, Platform Admin activity access, domain tracking change, or unrelated product change was found.
- Company live results expose aggregate app duration and per-employee total active duration already allowed by the existing company report boundary; they do not expose window titles, content, or raw hidden/background processes.

### Findings Ordered By Severity

- High: none remaining in automated review.
- Medium external verification: real Employee Windows computer timing comparison has not yet been run against deployed API/Web with Agent `0.5.1`.
- Medium release risk: `WorkMap-Desktop-Agent-Setup-0.5.1.exe` is Authenticode `NotSigned`.
- Low expected latency: visible live totals update on the existing approximately ten-second heartbeat/report poll rather than every rendered second; foreground sampling remains approximately one second.
- Fixed: continuously focused apps now appear through the live overlay before an app switch finalizes the persisted segment.
- Fixed: Owner company view now polls live foreground aggregates and refreshes persisted summaries when completed activity changes.
- Fixed: `ApplicationFrameHost` can resolve its child UWP process for Microsoft Store-style applications without reading titles.
- Fixed: app switches send an immediate heartbeat so the live segment and completed event stay aligned.

### Test And Verification Status

- `corepack pnpm --filter @workmap/desktop-agent test`: passed, 14/14.
- Desktop Agent typecheck/lint/build: passed.
- Desktop Agent `release:windows`: passed; NSIS installer built.
- `corepack pnpm --filter @workmap/api test`: passed, 9/9.
- API typecheck/lint/build: passed.
- `corepack pnpm --filter @workmap/web test`: passed, 14/14.
- Web typecheck/lint/build: passed; 19 routes generated.
- Windows foreground adapter direct PowerShell smoke: compiled and executed successfully.
- `git diff --check`: passed.
- Scoped secret scan: passed with zero matching files.
- Privacy capability scan: no prohibited collection implementation found; the single text match was the existing negative privacy disclosure in Reports.

### Manual QA Status

Not run on the real Employee computer. Automated coverage proves state and aggregation rules, not hardware/OS-level duration accuracy in the deployed environment.

### Risks And Recommendation

Code/local release gates pass. Proceed to deploy API/Web and publish/install Agent `0.5.1`, then run the real-device timed matrix. Do not declare the reported Microsoft Store issue fully accepted until Owner and Employee reports are compared against stopwatch results on the target Employee computer. The next round can proceed to deployment/manual QA.

---

## 2026-07-06 UI/UX Pro Max Repository Review

### Reviewed Implementation

Reviewed the external repository's documented design database, recommendation workflow, AI-assistant installation paths, CLI metadata, supported frontend stacks, persisted design-system files, and MIT license. No external code was executed.

### Diff Review Summary

- Local changes are limited to appending this research round to the required handoff files.
- Pre-existing user changes remain untouched.

### Findings By Severity

- High: none introduced; no package was installed and no runtime code changed.
- Medium: generated design recommendations are heuristic and should not be treated as proof of accessibility, usability, or brand fit.
- Low: installation adds skill files to a project or global assistant directory and requires Python 3 for direct search commands, so a temporary trial is preferable before WorkMap adoption.

### Test And Verification Status

- Upstream source/documentation review: completed.
- Local documentation diff review and `git diff --check`: required before closeout.
- Runtime typecheck, lint, build, and tests: not run because no runtime files changed.

### Manual QA Status

Not run. The skill was not installed or invoked.

### Risks And Recommendation

Pass for research purposes. The next round can proceed. If WorkMap adopts the skill, first test its generated design system without modifying production UI, then review output against existing components, accessibility requirements, and product constraints.

---

## 2026-07-06 Local UI/UX Assistant Ignore Review

### Reviewed Implementation

Reviewed the installed project-local `.codex/skills/` tree, repository ignore rules, upstream MIT license, and the Apache-2.0 license included with the installed `ui-styling` skill.

### Diff Review Summary

- Added only the root-anchored `/.codex/` rule to `.gitignore` for assistant files.
- Preserved all unrelated working-tree changes and left `.corepack/` unchanged.

### Findings By Severity

- High: none.
- Medium: attribution obligations can arise if licensed source, datasets, templates, or substantial portions are copied into distributed WorkMap artifacts; ordinary design assistance alone does not normally trigger an end-user-facing credit requirement.
- Low: ignored files can still be forced into Git with `git add -f`, so staged-file review remains necessary.

### Test And Verification Status

- `git check-ignore`: passed; `.codex/skills/ui-ux-pro-max/SKILL.md` resolves to the root `/.codex/` rule.
- Full untracked status review: passed; `.codex/` no longer appears.
- `git diff --check`: passed.
- Scoped secret scan: passed with no matching files.
- Runtime typecheck, lint, build, and tests are not required because application code was not changed by this task.

### Manual QA Status

Not applicable; no UI or runtime behavior changed.

### Risks And Recommendation

Pass once the ignore and diff checks complete. The next round can proceed without adding a public “designed with UI/UX Pro Max” label, subject to preserving license notices if licensed implementation material is redistributed.

---

## 2026-07-06 Owner App Usage Metric Semantics Review

### Reviewed Implementation

Reviewed the current handoff/API/frontend skill notes for Reports and Desktop Agent activity boundaries, plus the prior keyboard/mouse monitoring clarification.

### Diff Review Summary

- Documentation-only update in `docs/ai-handoff/latest-implementation.md`.
- No Desktop Agent, API, Reports UI, schema, auth, RBAC, deployment, or external configuration changed.

### Findings By Severity

- High: none introduced; no runtime behavior changed.
- Medium: the requested phrase “total active time including background/minimized” conflicts with the desired product rule that visible-but-not-focused apps should not count as usage while another app is operated.
- Low: the future implementation should use clear separate labels such as `focus active` and `open/runtime` to avoid Owner report confusion.

### Test And Verification Status

- Conceptual feasibility review: completed.
- Runtime typecheck, lint, build, and automated tests: not run because no runtime files changed.
- `git diff --check`: required before closeout.

### Manual QA Status

Not run. This was a product/technical semantics clarification only.

### Risks And Recommendation

Pass for definition alignment. The next implementation round can proceed if it treats foreground-window time as the authoritative `focus active` metric and keeps background/minimized runtime separate from actual usage.

---

## 2026-07-06 App Duration Three-Metric Implementation QA

### Reviewed Implementation

Reviewed the Desktop Agent foreground/runtime event changes, Windows open-window enumeration, API ingestion/report aggregation, live overlay merge behavior, Reports app-row UI chips, tests, and contract/skill documentation updates for the agreed APP timing rules.

### Diff Review Summary

- Scope stayed within APP duration collection, API reporting, Reports UI presentation, related tests, and handoff/contract notes.
- No schema migration, auth/RBAC, tenant isolation, Platform Admin visibility, domain timing, virtual office, deployment configuration, or unrelated UI surface was intentionally changed.
- The new contract separates:
  - `focusActiveSeconds`: foreground/focused app with recent input.
  - `focusedIdleSeconds`: foreground/focused app after idle threshold.
  - `openRuntimeSeconds`: app open/window runtime context, not active use.
- Legacy `activeSeconds` remains a compatibility alias for focus-active, and legacy `idleSeconds` remains a compatibility alias for focused-idle.

### Findings Ordered By Severity

- High: none found in code review or automated verification.
- Medium manual QA gap: real Employee Windows computer stopwatch testing has not yet been run with Desktop Agent `0.5.2`.
- Medium release dependency: the employee computer will not produce `openRuntimeSeconds` events until the new Desktop Agent build is published and installed.
- Medium interpretation risk: `openRuntimeSeconds` is intentionally not proof of active work; UI now labels it separately, but pilot users may still need product copy/training.
- Low Windows edge risk: runtime enumeration is based on visible top-level Windows windows and process/product names. It should cover foreground, visible-but-not-focused, and minimized windows, but not all hidden background services.
- Low UI risk: the chip layout was validated by typecheck/build/tests, but no browser screenshot/manual visual pass was run in this round.

### Test And Verification Status

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
- `corepack pnpm --filter @workmap/web build`: passed with the existing Next ESLint plugin warning.
- Scoped changed-file secret scan: passed, no matching secret patterns found.
- `git diff --check`: passed.

### Manual QA Status

Not run on the real Employee computer and not visually reviewed in a browser. Automated tests verify the calculation/report merge rules, not OS-level stopwatch accuracy.

### Risks

- New Agent release/deployment is required before Owner reports can show accurate open/runtime rows from employee devices.
- Historical rows will not gain true runtime data retroactively.
- Microsoft Store/UWP, multi-monitor focus attribution, minimized-window runtime, and idle threshold behavior still require real Windows validation.

### Pass/Fail Recommendation

Pass for local implementation and automated verification. The next round can proceed to release/deploy/manual QA, but should not mark the timing feature production-accepted until real-device stopwatch QA passes.

---

## 2026-07-06 Desktop Agent 0.5.2 Installer Artifact QA

### Reviewed Implementation

Reviewed the Desktop Agent package version, pairing version, generated local NSIS artifact, blockmap, hash, signature state, and git ignore rule for artifacts.

### Diff Review Summary

- No runtime source code changed in this round.
- `corepack pnpm --filter @workmap/desktop-agent release:windows` generated local ignored files under `workmap/artifacts/desktop-agent/`.
- The reason the user could not see `0.5.2` before this round was that the `0.5.2` installer artifact had not yet been built, and artifact output is git-ignored.

### Findings Ordered By Severity

- High: none in the local artifact generation path.
- Medium release dependency: `WorkMap-Desktop-Agent-Setup-0.5.2.exe` exists locally but still must be uploaded to a GitHub Release and wired into `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL`.
- Medium signing risk: the installer is `NotSigned`, so Windows warnings are expected.
- Low documentation/history confusion: older handoff sections correctly refer to prior `0.5.1` work; the latest section now records the current `0.5.2` artifact.

### Test And Verification Status

- Desktop Agent source version: `0.5.2`.
- Desktop Agent pairing version: `desktop-agent-windows/0.5.2`.
- `corepack pnpm --filter @workmap/desktop-agent release:windows`: passed.
- Generated installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.2.exe`.
- Installer size: 91,936,597 bytes.
- SHA-256: `DD5A34F962BF7ADF1F0DE809F01D187632BFA4298B634EACA7E8113793955446`.
- Authenticode: `NotSigned`.
- `git check-ignore -v`: artifact ignored by `workmap/.gitignore` `/artifacts`.
- `git diff --check`: passed.

### Manual QA Status

Not run. The artifact was built locally only and was not installed on the Employee computer.

### Risks And Recommendation

Pass for local installer generation. The next round can proceed to GitHub Release upload, Vercel URL update, Web redeploy, Employee reinstall, and stopwatch QA.

---

## 2026-07-06 Focused Idle 30-Second Threshold Fix QA

### Reviewed Implementation

Reviewed the Desktop Agent idle-threshold configuration from the runtime constructor through the Windows PowerShell sampler, the tracking state transition, device heartbeat/event upload, API live/persisted aggregation, and Web report merge/display behavior.

### Diff Review Summary

- The defect was isolated to the Desktop Agent's 300-second default; API and Web already handled focused-idle values correctly.
- The patch is scoped to the idle default, its packaged script copies, a focused regression test, and the release/client version bump.
- No unrelated product code, permissions, schema, or deployment configuration was changed.

### Findings Ordered By Severity

- Fixed - High: all production defaults used five minutes instead of the agreed 30 seconds, causing several minutes of no-input foreground time to remain focus active and focused idle to stay zero.
- Remaining - Medium: Employee-computer behavior is not proven until the generated `0.5.3` installer is installed and a timed test is observed in both Employee and Owner reports.
- Remaining - Medium: previously collected `0.5.2` totals cannot be reliably reconstructed into correct focus-active/focused-idle values.
- Remaining - Low: the installer is Authenticode `NotSigned`, so Windows SmartScreen may warn.
- Remaining - Low: an explicit positive `WORKMAP_AGENT_IDLE_SECONDS` environment override supersedes the corrected default by design.

### Test And Verification Status

- Desktop Agent tests: passed, 16/16.
- Desktop Agent typecheck, lint, Alpha build, TypeScript build, and Windows NSIS release build: passed.
- API tests: passed, 9/9.
- Web tests: passed, 15/15.
- Packaged PowerShell resource inspection: passed; default is 30 seconds.
- Windows foreground/idle sampling smoke: passed.
- Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.3.exe`, 91,936,628 bytes, SHA-256 `71C79439588D4884004BBFC49CC5A5570104F14250F5584FB53849146C5E0C91`, Authenticode `NotSigned`.
- Final diff/secret checks are recorded at round closeout.

### Manual QA Status

Not run on the separate Employee Windows computer. Required acceptance: after installing `0.5.3`, keep Weixin foreground, stop input for more than 30 seconds, verify focus active stops growing at the transition, and verify focused idle/open runtime continue in both Employee and authorized Owner views.

### Recommendation And Next Round

Automated QA recommendation: pass. The next round can proceed to GitHub Release publication, download-link update, Employee-machine upgrade, and timed manual acceptance. Do not describe the real-device defect as fully accepted until that manual check passes.

---

## 2026-07-06 Windows Generic App Name Review QA

- Reviewed implementation: Windows foreground app-name selection only.
- Diff review: documentation-only; no runtime code changed.
- Findings: no high-severity functional defect established from the screenshot. Medium reporting-clarity issue: several Windows processes collapse into the generic `Microsoft Windows Operating System` product name, and existing rows cannot identify which process produced it.
- Verification: confirmed the adapter preference order is ProductName, FileDescription, then ProcessName.
- Manual QA: not run.
- Risk/recommendation: timing remains valid for the foreground surface, but the label is ambiguous. Pass for explanation; a separate scoped naming-normalization change can proceed if requested.

---

## 2026-07-06 Focused Input Without Continued Input Review

- Reviewed implementation: the 30-second idle default from Windows sampling through the runtime adapter.
- Finding: counting all five no-input minutes as focus active would violate the agreed metric definition. Expected split is approximately 30 seconds focus active, 4 minutes 30 seconds focused idle, and 5 minutes open/runtime, subject to one-second sampling and report polling latency.
- Verification: source inspection only; no runtime files changed and no automated or real-device tests were run in this clarification round.
- Remaining risk: a deployed `0.5.2`, a process that was not restarted after upgrade, or a positive environment override can retain a longer threshold.
- Recommendation: pass for rule consistency; proceed with a real-device `0.5.3` stopwatch check before acceptance.

---

## 2026-07-06 Focused Idle Metric Product Review QA

- Reviewed implementation: current Focus active, Focused idle, and Open/runtime report/API contract.
- Finding: deleting Focused idle from the model would create an interpretation gap because open/runtime also contains background and minimized time. Merging it into Focus active would be materially inaccurate.
- Recommendation: retain the metric and optionally simplify only its presentation or rename it to `Foreground, no input`.
- Verification: source/contract review only; no application files changed and no automated or manual tests run.
- Risk: hiding the metric without an accessible breakdown can still make Owner totals appear inconsistent; retain it in detail/export surfaces.
- Pass recommendation: pass for product-direction review. A presentation-only round can proceed if requested.

---

## 2026-07-06 App Metric Visibility Product Review QA

- Reviewed implementation: current three-chip Owner report app-row presentation.
- Finding: showing Focus active, Focused idle, and Open/runtime with equal visual weight increases ambiguity during the accuracy-validation stage. Open/runtime is especially liable to be misread as work time.
- Recommendation: show only Focus active in the default row; preserve Focused idle and Open/runtime in the underlying contract and future detail/debug views.
- Verification: source/UI review only; no application code changed and no automated or manual tests run.
- Remaining risk: a single visible Focus active number can itself be overinterpreted, so accompanying copy must retain the 30-second recent-input definition and avoid productivity/hours-worked claims.
- Pass recommendation: pass. A scoped Web presentation change can proceed without changing Desktop Agent, API, schema, or historical data.

---

## 2026-07-06 Desktop Agent Precision And Collapsible App Metrics QA

### Reviewed Implementation

Reviewed the Windows sampler lifecycle, foreground/input transition timestamps, short-segment policy, open-runtime scan continuity, queue/heartbeat implications, API aggregation regression coverage, App card collapsed/expanded rendering, accessibility state, and package/release version.

### Diff Review Summary

- Runtime changes are confined to Desktop Agent app timing/sampling and Reports app-metric presentation.
- API/schema code did not change; existing three-field contracts remain intact.
- Existing WorkMap theme/components and Lucide icons were reused.
- Product Design context/playback workflow confirmed the implementation should match the existing Reports surface with full card interactivity and no broader redesign.

### Findings Ordered By Severity

- Fixed - High: the old five-second minimum silently dropped short foreground/runtime segments, conflicting with immediate counting.
- Fixed - High: active-to-idle and idle-to-active boundaries previously used the next polling timestamp; they now use timestamps derived from `GetLastInputInfo`.
- Fixed - Medium: spawning/compiling PowerShell for every observation added roughly 400ms+ native startup overhead; the sampler is now persistent and warmed focus-only observations take about 4.5-5.7ms on the development computer.
- Fixed - Medium: secondary metrics had equal default visual weight; they now render only when the individual App card is expanded.
- Remaining - Medium: no real Employee-computer stopwatch, CPU/battery soak, or end-to-end Owner sync acceptance was run.
- Remaining - Medium: browser visual/click QA could not run because no in-app browser instance was available.
- Remaining - Low/expected: focus polling, one-second open-app scans, whole-second API storage, network calls, and report polling impose bounded observation/display latency; no polling design can promise literal zero delay.
- Remaining - Low/expected: Open/runtime preserves the prior visible top-level app-window definition and does not include newly enumerated headless services.

### Test And Verification Status

- Desktop Agent: 22/22 tests passed; typecheck, lint, build, real Windows sampler integration, Alpha copy, and NSIS release build passed.
- API: 9/9 tests passed; typecheck, lint, and build passed.
- Web: 17/17 tests passed; typecheck, lint, and production build passed with 19 routes.
- App card automated coverage verifies Focus active is present when collapsed, Focused idle/Open-runtime are absent when collapsed, and both appear in an expanded render state.
- Privacy scan remains bounded to app names, open app names, input age/timestamps, lock state, and observation time; prohibited content/title collection was not introduced.
- Final installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.4.exe`, 91,937,652 bytes, SHA-256 `C44A14DF54DDDFC95F80605A004F7326762B4492859367C36BBF77DB7EC76D28`, Authenticode `NotSigned`.
- `git diff --check`: passed.
- Stale timing-default scan, prohibited privacy-capability scan, scoped secret scan, and API-code-unchanged check: passed.

### Manual QA Status

- Development Windows sampler smoke/performance measurement: passed.
- Separate Employee Windows computer: not run.
- Real browser visual/keyboard/click inspection: not run due unavailable in-app browser.

### Risks And Recommendation

Pass for scoped implementation and automated QA after final closeout checks. The next round can proceed to deployment/release and real-device acceptance, but should not claim zero-latency or final stopwatch accuracy until that acceptance passes.

---

## 2026-07-06 Browser Domain Tracking Feasibility Review QA

### Reviewed Implementation

Reviewed the existing MV3 manifest, service worker, active-tab/window/idle flow, domain state machine, hostname minimization, credential/offline queue, domain ingestion contract, reports fields, and current tests. Cross-checked feasibility against current official Chrome and Microsoft Edge extension documentation.

### Findings Ordered By Severity

- High - Current scaffold cannot satisfy precise split-tab attribution because it has no content script and relies on selected tab plus machine-wide idle.
- High - If page-level activity occurrence signals are prohibited, the requested rule is technically impossible for two simultaneously visible pages; only an inference-based approximation would remain.
- Medium - Current domain idle threshold is 60 seconds rather than the agreed 30 seconds.
- Medium - Current domain tracking retains a five-second minimum segment and lacks separate Open/runtime semantics.
- Medium - Current optional host access does not yet provide the confirmed content-script permission/onboarding model required for all permitted HTTP/HTTPS pages.
- Medium - MV3 service-worker suspension requires persisted transition state and recovery; global state/timers alone are unsafe.
- Low/expected - Protected browser pages, browser chrome/omnibox, and non-permitted frames cannot provide page-level activity signals.

### Proposed Recommendation

- Proceed only after explicit confirmation of a privacy-minimised event-occurrence content script.
- Attribute events to the top-level tab hostname resolved by the service worker, never to client-supplied URL/content.
- Use exact timestamp transitions and persistent state.
- Count domain Open/runtime as de-duplicated wall-clock union across same-domain tabs.
- Reuse the app report's collapsed three-metric card.

### Test And Manual QA Status

- No code changed and no tests were run; this was feasibility/architecture review only.
- Future acceptance must cover Chrome and Edge separately, normal windows, two-window side-by-side, Chrome Split View where supported, iframe input, protected pages, permissions denied/revoked, MV3 suspension/restart, offline retry, and Owner/Employee report comparison.

### Risks And Recommendation

Pass for feasibility with conditions. Do not start implementation until the three product/privacy decisions in the implementation handoff are confirmed. Once confirmed, the project can proceed with a scoped Browser Extension + domain API/report contract round without altering unrelated systems.

---

## 2026-07-06 Browser Domain Tracking Decision Confirmation QA

- Reviewed decision: privacy-minimised trusted input occurrence signals are approved; same-domain multi-tab metrics are de-duplicated interval unions; trusted wheel/touchpad scrolling counts as interaction.
- Correctness note: event pulses refresh one domain-level last-activity timestamp and do not add duration per event or per tab, preventing overlap multiplication.
- Privacy note: `event.isTrusted` distinguishes browser-produced user events from script-created events; no event payload values, coordinates, DOM targets, content, titles, or full URLs are approved.
- Verification/manual QA: not run; documentation-only confirmation with no runtime changes.
- Remaining decision: passive reading/video after 30 seconds without trusted page input still needs final confirmation before implementation.
- Recommendation: pass for the two confirmed product rules and wheel behavior. Begin implementation only after the remaining idle interpretation is confirmed.

---

## 2026-07-06 Browser Domain User-Story Coverage QA

### Reviewed Implementation And Rules

- Reviewed the seven expected browser-domain stories against the current MV3 manifest/service worker, domain state machine, device heartbeat model, domain ingestion/summary contract, Reports presentation, and Chrome/Edge platform boundaries.
- This was an architecture and product-rule review; no runtime implementation was changed.

### Findings Ordered By Severity

- High - The requirement that Owner Reports show the exact disable/remove time cannot be guaranteed by the extension itself. Once disabled or removed, its code cannot reliably execute an authenticated final report. Missing heartbeat supports bounded coverage-loss detection, not an exact cause or user-action timestamp.
- High - Allowing every recently interacted different domain to remain Focus active for 30 seconds would create overlapping time and inflate totals. Recommended correction: trusted input transfers the single Focus active owner at the event timestamp; same-hostname tabs remain one owner and do not transition.
- High - The current extension has no content script, so it still cannot implement page-specific trusted keyboard/mouse/wheel attribution until the scoped content script is added.
- Medium - The current extension's one-minute alarm and summary-only domain contract do not provide App-like live Owner synchronization or a separate domain Open/runtime metric.
- Medium - Same-hostname de-duplication across tabs can be implemented locally, but Chrome-and-Edge overlap requires API/report interval reconciliation if totals must be browser-independent.
- Medium - Normal tab close/navigation is observable immediately, but forced termination, crash, power loss, offline profile deletion, and service-worker loss require last-checkpoint recovery and cannot promise a mathematically exact close boundary.
- Medium - Browser UI focus, protected pages, denied/revoked host permission, inaccessible frames, incognito, and multiple profiles create explicit coverage gaps that must not be reported as measured zero time.
- Low - Hostname versus registrable-domain grouping needs a durable rule. Current privacy-minimised behavior uses exact lowercase hostname.

### Coverage Recommendation

- Pass for cases 1, 2.2, 2.3, 3 under normal browser lifecycle, 5, 6, and 7 after the proposed extension/API/Reports implementation.
- Case 2.1 is covered accurately only with non-overlapping focus ownership: all interacted domains receive time for their actual focus intervals, not simultaneous 30-second windows.
- Case 4 should be revised to Owner-visible extension coverage history: exact first/re-enabled signal, last signal, bounded coverage-loss detection, and restored time. Guaranteed exact disable/remove attribution requires an independent observer outside the extension.
- Passive reading/video behavior is now confirmed: after exactly 30 seconds without trusted page input, the still-eligible focused domain becomes Focused idle.

### Verification And Manual QA Status

- Source/diff review only; no typecheck, lint, build, automated tests, Chrome test, Edge test, or Owner/Employee end-to-end test was run because runtime code was unchanged.
- Closeout checks: `git diff --check` and scoped secret scan.

### Risks And Recommendation

- The plan is feasible but not yet ready for implementation until different-domain overlap, cross-browser de-duplication, and the honest extension-coverage contract are accepted.
- After those decisions, the next round can proceed with a narrow Browser Extension + domain API/report + Reports-card implementation. Do not claim exact disable/uninstall telemetry from a self-observing extension.

---

## 2026-07-06 Browser Domain Tracking 0.4.0 QA

### Reviewed Implementation

- Reviewed MV3 permissions/content registration, trusted page signals, privacy payload, focus/idle/runtime state transitions, tab lifecycle, state/queue persistence, API event classification, raw interval union, Chrome/Edge overlap, extension heartbeat coverage history, live Reports merge, domain cards, exports, package output, and unchanged access boundaries.

### Diff Review Summary

- Runtime scope is limited to Browser Extension domain tracking, domain ingestion/report aggregation, extension coverage visibility, and Reports domain presentation.
- Desktop Agent and unrelated user-owned Employees/loading/design files are outside the scoped diff and remain untouched.
- No schema migration or new dependency was added.
- Optional web host permission is the one deliberate permission expansion required for page-specific interaction attribution; it is requested during pairing rather than silently installed as a required host permission.

### Findings Ordered By Severity

- Fixed - High: the old extension inferred activity from selected tab plus global 60-second idle and could not attribute input to split/side-by-side pages.
- Fixed - High: domain events had no separate runtime semantic, so an open/background duration could not be represented without inflating active totals.
- Fixed - High: same-domain tabs/browsers previously aggregated summary increments and could multiply overlap. Reports now unions raw intervals per hostname across Chrome/Edge.
- Fixed - High: the old five-second minimum dropped short domain activity. Positively observed intervals are now retained and stored with the existing whole-second API boundary.
- Fixed - Medium: domain idle used global Chrome idle at 60 seconds. Page activity now transitions at the exact trusted last-input-plus-30-second boundary.
- Fixed - Medium: normal create/navigation/close/replacement tab lifecycle and already-open tabs after pairing now reconcile into one runtime session per hostname.
- Fixed - Medium: Owner Reports had no extension coverage state. They now poll connected/signal-lost state, last signal, 90-second loss detection, and restored observation without claiming an exact disable cause.
- Fixed - Medium: domain rows had ambiguous active/idle text. They now reuse the focus-first accessible App card and three explicit labels.
- Remaining - Medium: real Chrome/Edge load-unpacked and separate Employee/Owner stopwatch acceptance have not run.
- Remaining - Medium/expected: browser crash, power loss, offline removal, profile deletion, protected pages, revoked host access, and Incognito can create bounded or explicit coverage gaps.
- Remaining - Low/expected: Owner display has whole-second persistence plus checkpoint/network/ten-second poll latency; this is not literal zero-delay UI.

### Test And Verification Status

- Browser Extension: passed 13/13 tests, typecheck, lint, and build.
- API: passed 9/9 tests, typecheck, lint, and build.
- Web: passed 19/19 tests, typecheck, lint, and production build; 19 routes generated.
- Automated cases cover different-domain focus transfer, same-domain tab runtime de-duplication, exact 30-second idle/resume, persistent checkpoint IDs, short segments, trusted wheel/input privacy markers, optional permission manifest, domain runtime exclusion, Chrome/Edge interval union, extension loss/recovery, and collapsed/expanded domain cards.
- Final unpacked manifest/version/content-script inspection: passed.
- Privacy capability scan: passed for prohibited page/input payload categories.
- `git diff --check` and the final scoped secret scan passed at handoff closeout.

### Manual QA Status

- Not run in Chrome or Edge. The in-app Browser skill was attempted, but no browser instance was available in the current session.
- No claim is made for real extension permission prompts, iframe/browser-version behavior, timed Owner synchronization, disable/re-enable timing, or final pixels until manual acceptance runs.

### Risks And Recommendation

- Pass for scoped implementation and automated verification.
- Proceed to a dedicated Chrome + Edge manual acceptance round using `workmap/apps/browser-extension/alpha-unpacked`.
- Do not proceed to store publication/production accuracy claims until the timed multi-tab, cross-browser, idle, runtime-close, offline/restart, permission, and coverage-loss matrix passes on an Employee computer and matches Owner Reports.

---

## 2026-07-11 Product Pages Visual Refactor QA

### Reviewed Implementation

- Reviewed the shared token update, authenticated app shell, login/auth surfaces, onboarding layouts, data-heavy pages, Platform Admin treatment, Virtual Office chrome, and responsive rules against the approved 17-route visual boards.
- Reviewed all TSX diffs to confirm they contain styling hooks and one presentation-only Device Setup wrapper, with no functional changes.

### Findings Ordered By Severity

- Remaining - High/existing: source `workmap/apps/web/lib/api/authApi.ts` is 410 NUL bytes. It blocks source-worktree web typecheck, lint, one imported test, production build, and normal local rendering. It was not modified because it is outside this visual-only scope and is not reported as a normal Git change.
- Remaining - Medium: in-app Browser security policy rejected the isolated local QA URL, so desktop/mobile rendered comparison and click/keyboard inspection are blocked.
- Fixed - Medium: authenticated pages previously used a marketing-like fixed top navigation, broad gradients, large radii, and inconsistent density. They now share a compact desktop sidebar and responsive tablet/mobile navigation.
- Fixed - Medium: login, callback, invitations, onboarding, business pages, Platform Admin, and Virtual Office chrome previously lacked one durable product language. They now share the approved Ink/Jade/Amber tokens and restrained geometry.
- Fixed - Low: phone navigation no longer expands into a tall multi-row block; it uses a compact horizontal strip with readable fixed-width targets.

### Test And Verification Status

- TSX/theme parse: passed, 12 changed source files.
- CSS parse/static assertions: passed for both global stylesheets; breakpoint, reduced-motion, no-gradient, real-asset, and bounded-radius checks passed.
- Targeted ESLint: passed for every changed TSX/theme file.
- Isolated QA typecheck: passed.
- Isolated QA lint: passed.
- Isolated QA tests: passed, 38/38.
- Isolated QA final build: passed, 19 routes generated.
- Source-worktree typecheck/lint/test/build: blocked only by the existing NUL `authApi.ts`; the source test run passed 34 tests before the imported report test hit that file.
- `git diff --check`: passed.

### Manual QA Status

- Rendered browser QA: blocked by in-app Browser local-target security policy.
- No claim is made that desktop/mobile pixel fidelity, keyboard flow, or final visual acceptance passed.

### Risks And Recommendation

- The frontend style refactor is code-complete and passes full automated verification in an isolated copy with the valid tracked auth client.
- Do not treat rendered visual QA as complete until `authApi.ts` is explicitly restored/fixed and a permitted browser session checks 360/390/768/1024/1440 layouts.
- Functional boundaries are preserved; the next round may proceed only after acknowledging the existing auth-client corruption and the blocked rendered QA.

---

## 2026-07-13 Workspace Navigation Loading Reduction QA

### Reviewed Implementation

- Reviewed AppShell cache initialization, asynchronous auth/context refresh, redirect paths, role-aware navigation, and internal workspace link behavior.

### Findings Ordered By Severity

- Fixed - Medium: the AppShell showed a full-screen loader for every remount even when its cache had a valid summary tied to the current Cognito subject.
- Fixed - Medium: workspace navigation used native anchors, producing a document navigation instead of the existing Next client navigation path.
- Remaining - High/existing: `workmap/apps/web/lib/api/authApi.ts` remains 410 NUL bytes in the source worktree. It blocks normal full-package verification but is unrelated to this change and was not overwritten.

### Test And Verification Status

- New focused cache tests: passed, 2/2; they prove first visits retain the loader and cached tenant/platform summaries can render immediately.
- Isolated QA web typecheck: passed.
- Isolated QA web lint: passed.
- Isolated QA web tests: passed, 40/40.
- Isolated QA production build: passed, 19 routes.

### Manual QA Status

- Not run. No claim is made that the local browser policy block has been removed.

### Risks And Recommendation

- Pass for the scoped performance/UI behavior change. Existing authorization and refresh requests are still authoritative and run unchanged.
- The next round can proceed. A first uncached visit may still show the loader by design; the repeated cached-tab loader should no longer appear.

---

## 2026-07-13 Dashboard Hero And Rounded Button Responsive QA

### Reviewed Implementation

- Reviewed Dashboard signal derivation, hero-only presentation markup, shared button tokens, global button overflow rules, and narrow-screen action/signal layout rules.

### Findings Ordered By Severity

- Fixed - Medium: the Dashboard hero could render as a visually empty panel because it depended on generic first-section styling. It now has an explicit hero class and a contentful real-data signal board.
- Fixed - Medium: button geometry was inconsistent across shared and inline action paths, and narrow labels could exceed available width. Shared tokens and global safeguards now use rounded controls with bounded, wrapping labels.
- Remaining - High/existing: source `authApi.ts` remains NUL-corrupted and blocks normal worktree full-package verification; it was not part of this change.

### Test And Verification Status

- Focused Dashboard/button and AppShell cache tests: passed, 4/4.
- Isolated QA typecheck: passed.
- Isolated QA lint: passed.
- Isolated QA tests: passed, 42/42.
- Isolated QA production build: passed, 19 routes.

### Manual QA Status

- Browser desktop/mobile screenshot and interaction review: not run because the current in-app Browser policy rejects the local target.

### Risks And Recommendation

- Pass for the scoped UI/refactoring change. The dashboard shows only actual state and all action behavior remains unchanged.
- The next round can proceed. Final visual/device QA remains pending the existing browser-access limitation.

---

## 2026-07-13 Invite Ledger Visual Refinement QA

### Reviewed Implementation

- Reviewed the invitation page markup hooks, the Recent invitations ledger styling, long-text safeguards, and the existing small-screen single-column layout.

### Findings Ordered By Severity

- Fixed - Low: Recent invitations inherited the generic white product-card surface and visual language. It now has its own dark workspace-access ledger with non-white rows and clear status hierarchy.
- Fixed - Low: long email/status values could become difficult to scan in a two-column row. The ledger uses bounded grid columns and switches to a stacked record at the existing `760px` breakpoint.
- Remaining - High/existing: source `apps/web/lib/api/authApi.ts` is NUL-corrupted and blocks full web typecheck. It was not part of this visual-only change.

### Test And Verification Status

- Targeted invite page lint: passed.
- Focused Dashboard and invitation responsive contract tests: passed, 4/4.
- Source worktree web typecheck: blocked solely by the existing NUL bytes at `authApi.ts:1`.

### Manual QA Status

- Browser desktop/mobile screenshot and interaction review: not run because the current in-app Browser policy rejects the local target.

### Risks And Recommendation

- Pass for the scoped frontend-only refinement. The invitation data, Owner authorization, and create/list behavior remain unchanged.
- The next round can proceed; rendered visual QA remains deferred pending the existing browser-access limitation.

---

## 2026-07-13 Dashboard Light Signal-Map Banner QA

### Reviewed Implementation

- Reviewed the Dashboard hero style overrides, existing real-status signal rendering, desktop/tablet/mobile breakpoints, and shared action constraints.

### Findings Ordered By Severity

- Fixed - Medium: the prior dark Banner did not provide the requested welcome/workspace composition and could read as an isolated status block. It now has a coherent light workspace presentation with a WorkMap-specific Signal Map.
- Fixed - Low: the hero could become cramped at tablet widths. It now switches to one column at `1024px`, while existing action and signal card protections remain active for narrow screens.
- Remaining - High/existing: source `apps/web/lib/api/authApi.ts` remains NUL-corrupted and blocks full web typecheck; it was not changed.

### Test And Verification Status

- Targeted Dashboard/Invite lint: passed.
- Focused cache, Dashboard, and Invite responsive contract tests: passed, 6/6.
- `git diff --check`: passed.

### Manual QA Status

- Browser desktop/mobile screenshot and interaction review: not run because the current in-app Browser policy rejects the local target.

### Risks And Recommendation

- Pass for the scoped frontend-only Banner redesign. All rendered status values and action behavior remain sourced from the original Dashboard implementation.
- The next round can proceed; final rendered visual QA remains deferred pending the existing browser-access limitation.

---

## 2026-07-13 Dashboard Top Apps Progressive Disclosure QA

### Reviewed Implementation

- Reviewed the shared usage-table presentation state, App-only opt-in, accessibility attributes, data preservation, and narrow row layout.

### Findings Ordered By Severity

- Fixed - Low: long Top apps datasets forced every report row into the Dashboard side stack. The list now defaults to six rows and allows an explicit Show more expansion.
- Fixed - Low: narrow usage rows could compress duration/share beside an application name. The `420px` layout assigns stable row areas for details, duration, and share.
- Remaining - High/existing: source `apps/web/lib/api/authApi.ts` remains NUL-corrupted and blocks full web typecheck; it was not changed.

### Test And Verification Status

- Targeted Dashboard lint: passed.
- Focused cache, Dashboard, Invite, and usage-table tests: passed, 8/8.

### Manual QA Status

- Browser desktop/mobile screenshot and interactive expansion review: not run because the current in-app Browser policy rejects the local target.

### Risks And Recommendation

- Pass for the scoped frontend-only interaction. Reports data is unchanged; the immediately following Domain follow-up aligns the Website usage table with the same behavior.
- The next round can proceed; final rendered visual QA remains deferred pending the existing browser-access limitation.

---

## 2026-07-13 Dashboard Top Domains Progressive Disclosure QA

### Reviewed Implementation

- Reviewed the WebsiteUsageTable opt-in to the existing shared collapse behavior and the updated regression contract.

### Findings Ordered By Severity

- Fixed - Low: Top domains expanded every row even though Top apps was compact by default. Both cards now have the same six-row progressive-disclosure behavior.
- Remaining - High/existing: source `apps/web/lib/api/authApi.ts` remains NUL-corrupted and blocks full web typecheck; it was not changed.

### Test And Verification Status

- Targeted Dashboard lint: passed.
- Focused Dashboard, Invite, and usage-table tests: passed, 6/6.

### Manual QA Status

- Browser desktop/mobile screenshot and interactive expansion review: not run because the current in-app Browser policy rejects the local target.

### Risks And Recommendation

- Pass for the scoped frontend-only refinement. No reporting data or behavior changed beyond local list presentation.
- The next round can proceed; final rendered visual QA remains deferred pending the existing browser-access limitation.

---

## 2026-07-14 Reports UTC Boundary And Tracking Reliability QA

### Reviewed Implementation

- Reviewed the full report date path from browser defaults, quick presets, persisted filters, API query parsing, and UTC range validation.
- Reviewed Desktop Agent runtime shutdown/session behavior, foreground privacy minimisation, persistent queue capacity/retry behavior, and report refresh coupling.
- Reviewed Browser Extension domain-event refresh behavior, queue/batch boundaries, and extension privacy/credential tests.

### Findings Ordered By Severity

- Fixed - High: `/reports` used a local browser date against an API UTC reporting boundary. In Australian mornings this submitted a future UTC date and caused both report endpoints to return HTTP 400.
- Fixed - Medium: browser-domain activity did not advance the report live revision, so an open Reports page could remain stale until another reload/action.
- Fixed - Low: a graceful Desktop Agent exit closed the server session but could leave the local status representation as `connected`.
- Expected - Informational: Owner access to `/platform/me` returns 403 by design because Platform Admin endpoints remain outside tenant Owner scope.

### Test And Verification Status

- New UTC date-boundary API regression test: passed.
- New persisted future-filter fallback regression test: passed.
- New safe API validation-detail regression test: passed.
- New Browser Extension activity-revision integration assertion: passed.
- New Desktop Agent graceful-shutdown local-status assertion: passed.
- Full Web tests: passed, 48 tests.
- Full API tests: passed, 11 tests.
- Full Desktop Agent tests: passed, 29 tests.
- Full Browser Extension tests: passed, 15 tests.
- Shared types and all affected application typechecks: passed.
- Web/API/Desktop Agent/Browser Extension lint and build: passed.
- `smoke:stage4`: environment-blocked only. `DATABASE_URL` is absent and no local API listens on port 3001; the command did not run assertions or contact production.

### Manual QA Status

- Not run. No claim is made that the production environment has already received this source change or that a real Windows desktop/manual browser session was performed.

### Risks And Recommendation

- Pass for source-level release preparation: the reported morning UTC mismatch and the identified stale-revision/local-status reliability gaps are covered by regression tests.
- The next round can proceed after source deployment is authorized. Final manual QA and a configured local Stage 4 smoke remain pending environment access.

---

## 2026-07-14 Login Secondary Action Link Treatment QA

### Reviewed Implementation

- Reviewed the existing sign-in, password-reset, confirmation resend, and return-to-sign-in actions plus the CSS cascade that previously applied the green button surface.

### Findings Ordered By Severity

- Fixed - Low: global `.wm-auth-form button` styling made the Forgot password helper action appear as a green CTA.
- Fixed - Low: the secondary-action treatment now has an explicit class with transparent background, muted grey text, a bottom rule, and visible keyboard focus.

### Test And Verification Status

- New focused login secondary-action style test: passed.
- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed, 19 routes.

### Manual QA Status

- Not run. No claim is made that a browser-rendered or deployed page was manually inspected.

### Risks And Recommendation

- Pass. This is a presentation-only change; Cognito password recovery and all authentication behavior are unchanged.
- The next round can proceed.

---

## 2026-07-14 Login Password Visibility Toggle Alignment QA

### Reviewed Implementation

- Reviewed the password input geometry, the globally inherited form-button minimum height, and the existing show/hide password event path.

### Findings Ordered By Severity

- Fixed - Low: the shared `46px` button minimum height overrode the password toggle's intended `40px` size, pushing the eye control outside its `44px` input alignment.
- Fixed - Low: the password toggle now has a dedicated class that locks its inset and square dimensions without changing its interaction.

### Test And Verification Status

- Focused login style tests: passed, 2/2.
- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed, 19 routes.

### Manual QA Status

- Not run. No claim is made that a browser-rendered or deployed page was manually inspected.

### Risks And Recommendation

- Pass. This is a presentation-only geometry correction; authentication and password handling are unchanged.
- The next round can proceed.

---

## 2026-07-14 Reports Current-Day Default QA

### Reviewed Implementation

- Reviewed Reports initialization, browser-storage restoration, current UTC reporting-date fallback, and the date values forwarded to report and live-status requests.

### Findings Ordered By Severity

- Fixed - Medium: a prior Reports date range persisted in browser storage and was restored on a later page open, requiring the user to manually reset From and To.
- Verified - Low: only the date range is reset. Valid role-aware report scope and department preferences remain available after reload.

### Test And Verification Status

- Report filter regression tests: passed, 4/4, including historical range reset.
- Full Web tests: passed, 50/50.
- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed, 19 routes.
- Build-generated `tsconfig.tsbuildinfo` was restored to its tracked content before diff review.

### Manual QA Status

- Not run. No browser-rendered or deployed page is claimed as manually inspected.

### Risks And Recommendation

- Pass. The behavior is scoped to initial browser-filter restoration and continues to use the existing UTC report-date contract.
- The next round can proceed; final deployed browser QA remains deferred.

---

## 2026-07-14 Activity Tracking Architecture Review QA (Analysis Only)

### Reviewed Implementation

- Reviewed the real Desktop Agent foreground/window sampler, tracking state machine, local durable queue, heartbeat/session flow, MV3 Extension service worker and content script, activity ingestion, Prisma models, reports aggregation, and reports live overlay.

### Findings Ordered By Severity

- High: `GRACEFUL_SHUTDOWN` is presented as `Stopped`, but it is sent for any successful application quit path and does not prove that a user deliberately stopped monitoring.
- High: a backend heartbeat timeout cannot distinguish network loss, sleep, device shutdown, Agent crash, forced termination, or server unreachability; no durable device-status-event history exists.
- High: Desktop Focus Active is derived from global Windows last-input state plus one foreground window. It cannot reliably prove per-app interaction or support the requested multi-monitor parallel Focus Active semantics.
- Medium: the Desktop Agent stores only an active foreground checkpoint; visible/open runtime segments are not checkpointed. Queue capacity/age expiration can intentionally discard undelivered activity without a server-side reconciliation record.
- Medium: Extension Focus Active is single-tab/domain. Browser-window focus changes are handled only indirectly; parallel domain activity and cross-browser correlation are not modelled.
- Medium: app and domain totals are separately displayed, but the data model has no correlation/session layer for an explicit Browser App Total-to-Domain Breakdown relationship.

### Test And Verification Status

- Desktop Agent package tests: passed, 29/29.
- Browser Extension package tests: passed, 15/15.
- API package tests: passed, 11/11.
- These automated tests validate current contracts and regression rules. They do not constitute a real Windows multi-monitor, sleep, forced-termination, or browser-profile acceptance test.

### Manual QA Status

- Not run. No physical employee machine, browser profile, real multi-monitor session, network interruption, or production deployment was exercised in this analysis-only round.

### Risks And Recommendation

- Do not treat the current tracking semantics as satisfying the requested parallel-active and detailed interruption-reason requirements.
- Proceed only after architecture approval, then implement the proposed staged changes with real-device and integration tests.

---

## 2026-07-14 Activity Tracking Reliability Implementation QA

### Reviewed Implementation

- Reviewed the rewritten Desktop Agent tracking state, restart persistence, status queue, graceful shutdown behavior, and real Windows adapter integration.
- Reviewed MV3 tab/window/idle recovery, persistent queue behavior, domain-only payload minimisation, guarded reinjection after service-worker recovery, and options status surface.
- Reviewed backend activity/heartbeat sequence guards, durable device-status history, report aggregation and current-status rendering, plus tenant/device credential boundaries.

### Findings Ordered By Severity

- Fixed - High: a late or retried app/domain activity event could overwrite an AgentSession sequence cursor with an older value. Conditional maximum-sequence updates now prevent cursor regression for both activity and heartbeat writes.
- Fixed - High: stale last-input information could be clamped into a current sample and manufacture Focus Active time. Precise-input mode now closes the session at the actual inactivity boundary; legacy mode keeps the existing sampling-gap cap.
- Fixed - Medium: an MV3 service-worker restart could leave already-open permitted tabs without the guarded interaction listener until another tab event occurred. Startup recovery now injects the existing dynamic script into applicable current tabs.
- Verified - Medium: browser domain events and desktop application events remain separately aggregated and rendered; the Reports UI does not silently sum domain time into desktop browser-app total time.
- Remaining - Medium/environment: `smoke:stage4` cannot run in this checkout because `DATABASE_URL` and a local API on port 3001 are absent. No production or cloud database was used as a substitute.
- Remaining - Informational: true per-application interaction attribution and forced-termination cause detection have operating-system limits; the implementation records bounded, explainable signals rather than asserting certainty it does not have.

### Test And Verification Status

- Desktop Agent tests: passed, 33/33; typecheck, lint, build, and Windows installer package: passed.
- Browser Extension tests: passed, 17/17; typecheck, lint, and MV3 build: passed.
- API tests: passed, 12/12; typecheck, lint, and build: passed.
- Web tests: passed, 50/50; typecheck, lint, and build: passed.
- Shared types typecheck: passed.
- Prisma schema validation: passed using an ephemeral non-secret validation URL; the migration file was not applied because no local database was configured.
- `git diff --check`: passed.
- Credential-pattern and extension build-path scans: passed.
- `smoke:stage4`: blocked before assertions by missing local environment configuration, not treated as passed.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. Automated results are not a claim of real Windows, browser-profile, multi-monitor, offline, sleep, or deployed acceptance testing.

### Risks And Recommendation

- Pass for the implemented source-level runtime, package, and regression suite. The current source can proceed to a configured isolated local integration environment and the user's consolidated manual QA.
- Do not mark final end-to-end smoke, production deployment, or human acceptance as complete until a disposable local database/API environment and the deferred manual checks are available.

---

## 2026-07-15 Avatar Studio Visual QA

### Reviewed Implementation

- Reviewed the protected `/onboarding/avatar` page markup and scoped stylesheet overrides for asset picker sizing, selected states, live preview hierarchy, and mobile layout.

### Findings Ordered By Severity

- Fixed - Medium: option cards were constrained to 76px columns, allowing long layer names to wrap one letter per line and making the picker effectively unusable.
- Fixed - Medium: category grids had independent max-height scrolling, creating stacked scrollbars and hiding available avatar layers.
- Verified - Low: the page reuses existing WorkMap sprite assets and Lucide icons only; no generated character or fake visual asset was added.

### Test And Verification Status

- Web typecheck and lint: passed.
- Web regression suite: passed, 50/50.
- Production web build: passed.
- `git diff --check` and credential-pattern scan: passed.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. A local visual browser run was not performed because the protected route requires a real Cognito session and no session was fabricated.

### Recommendation

- Pass for merge/deployment. The next round can proceed; authenticated desktop and mobile visual inspection remains the only deferred validation for this scoped style change.

---

## 2026-07-15 Device Setup Download Button QA

- Root cause confirmed: the download `<a>` was stretched to the neighboring button height by the flex row while retaining normal inline text layout, leaving apparent blank space under the label.
- The link now centers its label vertically and horizontally and remains width-bounded on narrow screens.
- Web typecheck, lint, production build, and `git diff --check` passed. Download and pairing logic were not modified.
- Manual QA: Deferred by user, pending final consolidated manual QA.

---

## 2026-07-15 Agent Restart And Audit Reliability QA

### Reviewed Implementation

- Reviewed client and server heartbeat handling, activity-upload connection-state transitions, Agent session retry behavior, device-status persistence, historical report aggregation, and Owner Reports audit rendering.

### Findings Ordered By Severity

- Fixed - High: bounded workstation clock skew caused heartbeat 400 responses during restart. The server now normalizes up to five minutes of future skew while preserving the current activity interval; larger skew remains rejected.
- Fixed - High: `/device-client/session/start` retries could create overlapping server sessions when a prior response was lost. Start is now idempotent by device-bound client session ID.
- Fixed - High: a successful activity upload could mark the Agent connected while heartbeat remained unavailable, causing repeated Network Offline transitions and contradictory UI. Connection recovery now requires heartbeat success.
- Fixed - Medium: equivalent status transitions with different retry event IDs created repeated audit rows. The API now performs semantic consecutive-transition deduplication.
- Fixed - Medium: Reports exposed raw duplicate sessions/status rows and truncated the browser-visible history. The API now coalesces safely identifiable historical duplicates, and the UI shows the complete bounded result with occurrence/sync timing.
- Verified - Informational: Focus Active is intentionally collected and queued while the network is unavailable. This is offline durability, not proof that the backend is currently connected.

### Test And Verification Status

- API typecheck, lint, build, and tests: passed, 14/14.
- Desktop Agent typecheck, lint, build, tests, renderer syntax check, and Windows packaging: passed, 34/34.
- Web typecheck, lint, build, and tests: passed, 50/50.
- Installer `WorkMap-Desktop-Agent-Setup-0.5.8.exe` exists and is non-empty; SHA-256 recorded in the implementation handoff.
- `git diff --check` and the scoped credential-pattern scan passed.
- `smoke:stage4` is environment-blocked by missing `DATABASE_URL`. It failed before any database connection or mutation and is not reported as passed.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. The fixed 0.5.8 binary has not been restarted on the affected employee computer, and the server/web changes have not been deployed or production-verified by Codex.

### Risks And Recommendation

- Pass for source, package, regression, and installer verification.
- Production acceptance still requires deploying API/Web and installing 0.5.8 on the affected workstation. Existing 0.5.7 receives only the server-side protections after deployment.

---

## 2026-07-15 Reports Employee Information Hierarchy QA

### Reviewed Implementation

- Reviewed the selected employee report order, Desktop and Browser live-state sources, both audit timelines, current-domain freshness rules, responsive behavior, and preservation of Daily Trend/API Summary.

### Findings Ordered By Severity

- Fixed - Medium: live status, session history, lifecycle history, metrics, and summaries were interleaved, making the employee report difficult to scan. Current state and historical audit are now separate two-column sections above the unchanged trend and API summary.
- Fixed - Medium: the API did not expose a truthful current Browser Domain. It now returns one only from a connected extension device's fresh, active-window, non-idle activity event.
- Fixed - Low: the employee view repeated a verbose role-aware loaded-state panel and a metric grid before the requested content. Loaded-state narration is now limited to loading/error/empty states, and company-scope composition remains unchanged.
- Verified - Informational: Browser heartbeat loss alone cannot prove whether a user disabled the extension, closed the browser, lost network, or experienced a worker interruption. The UI does not invent a manual-stop reason.

### Test And Verification Status

- API typecheck, lint, build, and tests: passed, 14/14.
- Web typecheck, lint, production build, and tests: passed, 52/52.
- Source regression verifies live status -> connection audit -> Daily Trend -> API Summary order and the responsive two-column layout.
- `git diff --check` and the scoped credential-pattern scan passed.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. No authenticated production or local visual acceptance test was performed.

### Recommendation

- Pass for source, API contract, responsive composition, regression coverage, and build verification. API and Web must both be deployed for the new current-domain field and reordered report UI to appear; no Agent or Extension package update is required for this increment.

---

## 2026-07-15 Reports 500 Regression QA

### Findings Ordered By Severity

- Fixed - Critical: failure of the new optional current Browser Domain query propagated through `Promise.all` and could fail the complete `usage-summary` response. The query is now failure-isolated; core Reports data remains available.
- Fixed - High: after an initial summary failure, the successful ten-second live-status poll saw a revision mismatch and repeatedly requested the same failing summary. The failed revision is now suppressed until data changes or the user explicitly retries.
- Fixed - Low: extension coverage queries loaded complete activity rows when only a few fields were needed. The Prisma projections are now minimal.

### Test And Verification Status

- API tests: passed, 14/14. The added test forces the optional Prisma query to reject and verifies a connected coverage response with null current-domain enrichment.
- Web tests: passed, 53/53. The added test verifies same-revision retry suppression.
- API and Web typecheck, lint, and production builds: passed.
- `git diff --check` and scoped credential-pattern scan: passed.

### Manual QA Status

- The user-provided production screenshots are evidence of the original failure only. Post-fix deployed QA is not run and is not reported as passed.

### Recommendation

- Pass for immediate API/Web redeployment. No migration or tracking-client reinstall is required. Confirm one authenticated employee Reports request after deployment and inspect Render logs for the sanitized current-domain warning if enrichment remains unavailable.

---

## 2026-07-15 Render Deployment Failure Diagnosis

- Build phase: passed. Prisma Client generation and `@workmap/api` build both completed.
- Startup phase: failed before readiness because Supabase Session Pooler returned `EMAXCONNSESSION` with `pool_size: 15`.
- The API source contains no interactive transaction, advisory-lock, temporary-table, or session-state dependency that would block using transaction pooling for normal runtime CRUD traffic.
- Recommendation: change only Render's runtime `DATABASE_URL` to the Supabase transaction endpoint, bound Prisma connections, redeploy, then verify `/health` and `/health/readiness`. Do not run Prisma migrations through that transaction-pooler URL.
- Deployment recovery is pending the Render environment-variable update; production recovery is not reported as passed.
