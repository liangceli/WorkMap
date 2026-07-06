# Latest Implementation Handoff

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
