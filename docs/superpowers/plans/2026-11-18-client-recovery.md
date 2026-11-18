# Client Recovery Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the audited client recovery and diagnostic defects without changing measured time or unrelated product behavior.

**Architecture:** Keep the existing serialized Browser runtime and existing Desktop UI. Retry failed content registration through the existing maintenance path, bound browser callback waits, and correct two Desktop display defects. No server changes are needed.

**Tech Stack:** TypeScript, Node test runner/tsx, Chromium MV3, Electron, Windows NSIS packaging.

**Spec:** Approved local-client audit scope in `docs/ai-handoff/latest-implementation.md`, section `2026-11-18 Local Client Repair Scope`. The user's latest request authorizes only the identified defects.

## Global Constraints

- Do not change Focus/runtime accounting, trusted-input rules, idle thresholds, schedules, exclusions or historical totals.
- Do not change API payloads, protocol v2, schema, credentials, pairing, queue storage or server minimum-version requirements.
- Preserve all existing uncommitted work. Do not commit, push, deploy or install new clients without a separate request.
- Planned patch versions: Desktop 0.6.13 and Browser 0.5.21. Retain existing installer app identity and extension upgrade procedure.
- A timeout must fail closed, never fabricate Focus evidence or backfill an unobserved gap.

## Review Focus

- Failed registration must not appear HEALTHY merely because policy refresh succeeds (Task 1).
- Missing permission must not trigger a permission prompt or bypass collection restrictions (Task 1).
- Successful registration must not cause repeat injection on every alarm (Task 1).
- A late callback after timeout must not resume stale work or prevent a later successful query (Task 2).
- Existing server error text and rejection diagnostics must remain accurate (Task 3).

### Task 1: Failed Browser registration recovery

**Files:** Modify `workmap/apps/browser-extension/src/backgroundV2.ts`; create `workmap/apps/browser-extension/test/registration-recovery.test.ts`.

**Interfaces:** Reuse `registerContentScript(): Promise<boolean>`, `restoreCollectorIfAllowed(): Promise<void>` and existing `trackingAccess`; add a private maintenance recovery method if needed. No persisted schema additions.

- [x] Add failing runtime tests: FAILED registration is retried by an alarm; a failed retry leaves collection gated and health non-HEALTHY; successful retry restores eligibility only after registration; REGISTERED access is not reinjected; denied permission is not requested automatically. Assert interval queues are not cleared.
- [x] Run the new test with `node --import tsx --test apps/browser-extension/test/registration-recovery.test.ts` from `workmap`; confirm the intended failures against current source.
- [x] Retry only failed registration through existing maintenance, no more frequently than the existing 30-second alarm cadence. Preserve permission/registration failures across health restoration and policy refresh. Retain existing fresh-evidence recovery and queue behavior.
- [x] Re-run new tests plus content-registration, collector-keepalive, focus-recovery and policy-lease-recovery tests; require zero failures.

### Task 2: Bounded Browser query callbacks

**Files:** Modify `workmap/apps/browser-extension/src/backgroundV2.ts`; create `workmap/apps/browser-extension/src/browserCallback.ts` and `workmap/apps/browser-extension/test/browser-callback-timeout.test.ts`.

**Interfaces:** `browserCallback<T>(invoke: (resolve: (value: T) => void, reject: (error: Error) => void) => void, timeoutMessage: string, timeoutMs = 15000): Promise<T>`. Use for existing tab/window/idle/probe callback wrappers only; do not change global scheduling or HTTP transport.

- [x] Add failing tests for a never-returning callback, synchronous throw, normal success/error, ignored late completion and a successful subsequent request. Add a runtime-level test proving timed-out maintenance reaches the existing diagnostic/heartbeat path.
- [x] Run the new test; confirm failures reflect missing timeout behavior, not unrelated harness problems.
- [x] Implement a settle-once deadline with timer cleanup. Preserve existing successful results and existing no-proof behavior on query failure. Do not race whole state-mutating maintenance tasks.
- [x] Re-run timeout, focus-recovery, collector-keepalive and full Browser suites; require zero failures.

### Task 3: Desktop startup and network diagnostic display

**Files:** Modify `workmap/apps/desktop-agent/src/electron/main.ts`, `workmap/apps/desktop-agent/renderer/app.js`, `workmap/apps/desktop-agent/test/gui-release.test.ts`; add `workmap/apps/desktop-agent/test/renderer-diagnostics.test.ts` if required for renderer execution coverage.

**Interfaces:** Preserve current IPC and diagnostic data shape. Read login settings with the same `args: ["--background"]` used when registering them. Keep fallback-message selection within existing renderer flow.

- [x] Add failing tests that setter/getter login-item arguments agree and that NETWORK_ERROR without HTTP response is described as a connection failure, not a historical rejection. Preserve explicit server messages and existing HTTP rejection fallback.
- [x] Run focused Desktop tests; confirm the intended failures.
- [x] Make the getter argument and renderer fallback changes only. Do not change auto-start registration policy, sampling or synchronization.
- [x] Re-run focused and full Desktop suites; require zero failures.

### Task 4: Compatible patch releases and handoff

**Files:** Desktop `package.json`, `src/version.ts`, `scripts/build-alpha.mjs`, version-dependent tests; Browser `package.json`, `manifest.json`, `src/trackingV2Types.ts`, version-dependent tests; both existing handoff files. Update any current-release-only version references needed for consistency, not historical notes.

- [x] Bump patch versions only after regression tests pass. Verify no server, protocol, storage or pairing change in the diff.
- [x] Run both complete test suites, typechecks, lint and builds using existing local dependencies. Record any environment blocker explicitly.
- [x] Produce `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.13.exe` and `workmap/artifacts/browser-extension/CandidGrid-Browser-Extension-0.5.21.zip` with existing release scripts, after verifying exact generated cleanup targets are confined to their build directories. Do not install or publish.
- [x] Inspect packaged versions/content, record SHA-256 hashes, and run `git diff --check` plus a scoped added-line secret/private-identifier scan.
- [x] Review the final diff and update implementation/QA handoffs, including real-browser testing limitations and unresolved attribution of the employee's original interruption.

**Compatibility acceptance:** Existing Desktop 0.6.12 and Browser 0.5.20 retain the same server protocol and may continue operating, but keep their existing defects. Updating should retain the existing installation identity and local stores; removing/re-pairing is not part of this repair. This patch does not reconstruct uncollected history.

**Execution gate:** Review this scope before implementation; suggested execution is native in the current session. No automatic commit/push or rollout.

**Execution outcome (2026-11-18):** User confirmed native execution. All four tasks completed locally, with 193/193 regression tests passing and both artifacts content-verified. Four Important final-review findings were fixed with RED-to-GREEN evidence. The existing native aggregate smoke-check ordering failure was independently checked and documented, not silently fixed. Real installed-client upgrade/long-running acceptance and a seeded IndexedDB retention integration test remain outside this completed implementation gate. See the latest implementation and QA entries for exact verification, hashes and residual risks. No commit, installation, push or server change occurred.
