# Latest QA Handoff

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
