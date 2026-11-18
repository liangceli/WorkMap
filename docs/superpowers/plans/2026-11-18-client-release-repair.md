# Client Release Repair Plan

> Execution: inline in the existing checkout as requested; no commit, push, installation or remote release. Preserve the preceding uncommitted client patch.

**Goal:** Correct the three release-only defects approved in the user's follow-up.
**Design / spec:** Keep the current workflow, archive naming and native helper. Supply the changed-file input to Browser release detection, align its upload lookup with the existing CandidGrid archive, and accept the existing required smoke events regardless of arrival order without accepting a subsequent unhealthy state.
**Constraints:** No runtime, accounting, policy, API, database, pairing, dependency or version changes. Existing versions remain 0.6.13 / 0.5.21. The user's in-place workflow takes precedence over creating a separate worktree or committing steps.

## Task 1: Workflow detection and archive contract

- [x] Add executable regression tests under `workmap/apps/desktop-agent/test/release-workflow.test.ts`: run the real detection shell against disposable Git histories, and run the existing archive script plus the real release-metadata step against a disposable extension fixture.
- [x] Observe Browser-only/both detection and archive lookup fail on the old workflow; retain Desktop-only, unchanged-version, manual-target and initial-push controls.
- [x] Change only the two affected lines in `.github/workflows/publish-tracking-clients.yml`; rerun the tests.

## Task 2: Native smoke event ordering

- [x] Add `workmap/apps/desktop-agent/test/native-build-smoke.test.ts`, executing the actual smoke function with controlled process events and timers. Cover all event orders, LIMITED, missing evidence, a later unhealthy state, split output, process error/exit and timeout.
- [x] Observe health-first permutations fail before repair.
- [x] In `scripts/build-native-host.mjs`, remember the latest health result and evaluate completeness after each parsed event. Preserve required event types, timeout, process cleanup and failure rules; rerun tests.

## Final verification

- [x] Run both complete client suites, both typechecks and lint; run real native build smoke if the local toolchain permits it without changing installed clients.
- [x] Review the final scoped diff independently; address consequential findings through failing regressions.
- [x] Run whitespace and scoped secret/conflict scans, update both handoffs, and leave all work uncommitted for the user.

## Progress / rulings

- Pre-flight: tasks share no runtime interface. The workflow test exercises package output as a producer/consumer contract, not source-text equality.
- Ruling: remain in the existing dirty checkout and retain the test/verification record here, because the user explicitly wants one combined later main push. No destructive cleanup of earlier artifacts or work.
- RED: 22 targeted cases ran against the original scripts: 13 passed, nine failed as expected (three Browser detection cases, actual archive lookup, four health-before-last event permutations and chunked LIMITED-first). The initial restricted run could not start Git Bash; an authorized local-only rerun supplied the valid RED evidence. Native completeness/error negative controls stayed passing.
- Implementation: two workflow line changes; the smoke test now remembers the latest qualifying health state and checks all required evidence on every parsed event. Test output decoding accommodates Windows PowerShell UTF-16LE versus hosted pwsh UTF-8; this does not change the release script.
- Task 1 and Task 2: complete, targeted GREEN 22/22. After one additional passing CRLF checkout case, final combined client suite PASS 216/216, zero failures/skips; both typechecks/lint PASS. Real `node scripts/build-native-host.mjs` compiled the existing helper and passed its smoke check, exit 0.
- Final review: independent read-only review found no Critical or Important issue. An initially suspected CRLF issue was retracted after actual Git Bash parsing and execution both passed. Ruling: retain the new CRLF regression but do not add unproven normalization behavior; the normal Windows runner path is covered, not every custom shell installation.
- Final minor (deferred): single-client-version test fixtures edit both package files, so the case with the other package entirely absent from the changed-file list is not separately tested. Existing version-gating controls pass; this is non-blocking coverage only, not a known release defect.
- Completion boundary: no Git commit/push, actual GitHub Actions run/release upload, client reinstall or additional version bump. Existing installed 0.6.13 / 0.5.21 clients need no update for these release-script-only changes.
