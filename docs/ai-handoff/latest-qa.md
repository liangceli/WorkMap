# Latest QA Handoff

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
