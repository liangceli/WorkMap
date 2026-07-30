# Latest QA Handoff

## 2026-07-30 Desktop Agent 0.6.10 Startup And Lease-recovery QA

### Findings And Diff Review

- High, fixed: one transient protected-config read no longer strands a paired Electron process with `runtime === null`. Startup uses bounded retries, and a later successful renderer/UI config read starts the same runtime without requiring a Windows restart.
- High, fixed: the UI no longer claims `Recording locally` or shows a stale current App when no runtime exists; it explicitly states that collection is not running while startup is retried.
- High, fixed: crash recovery no longer stamps a prior-day Focus/Open-runtime tail with the newly fetched lease. Valid tails retain their original server-issued lease and therefore remain eligible for normal API validation; unverifiable tails are not queued.
- Regression review: foreground sampling, 60-second v2 idle behavior, multi-App Open/runtime collection, multiple-window de-duplication, interval settlement, durable queue/retry, heartbeat, lifecycle boundaries, same-lease recovery, privacy minimisation and GUI packaging tests all remain green.
- Scope review: no Browser Extension, API, Web/Reports, policy configuration, database/schema/migration, auth/RBAC, tenant/device credential or deployment code changed.

### Test And Artifact Status

- Desktop tests: pass, 73/73.
- Desktop typecheck: pass.
- Desktop lint: pass.
- Desktop build/native-host build: pass.
- Windows NSIS release: pass; `WorkMap-Desktop-Agent-Setup-0.6.10.exe`, 98,747,615 bytes, SHA-256 `BEEE0916DE30E2D2282F2F8B5C57C711738B3E8BBD39D8B02C44E81BF536B7E0`.
- Initial release attempt was blocked only by sandbox network access while Electron Builder downloaded a Windows dependency; the approved network retry completed successfully.
- Authenticode: `NotSigned`. Treat SmartScreen/install trust as an open release risk.
- Real installed 0.6.10 Windows QA was not run. No employee device was remotely changed and no deployed API/database smoke was claimed.

### Recommendation

- Automated QA recommendation: pass for this Agent-only patch. The code can proceed to a controlled 0.6.9-to-0.6.10 local upgrade smoke.
- Release recommendation remains conditional on that manual smoke: preserve the existing local data directory, confirm automatic runtime/heartbeat/policy startup, allow pending to drain, verify Reports confirmed totals advance, and perform at least one restart/lease-boundary scenario with no new relabelled policy rejections.
- No API/Web deployment or database migration is required. The historical rejected count remains honest and is not expected to reset.

## 2026-07-30 Desktop 0.6.9 Cross-lease Open/runtime Recovery Diagnosis QA

- High, confirmed from local SQLite and redacted NDJSON evidence: the five new terminal rows are all `OPEN_RUNTIME`, share a July 29 occurrence range, were enqueued during July 30 startup and carry the July 30 v3 lease. They are outside that lease's allowed UTC windows, so the API's `POLICY_REJECTED` result is correct.
- High, code-confirmed defect: startup recovery constructs the persisted old Open/runtime checkpoint with the newly fetched policy, allowing old occurrence timestamps to be mislabeled with a new lease. This is a Desktop Agent recovery defect, not a Reports/API/policy-configuration failure.
- The increase from 56 to 61 is therefore fully accounted for by one five-interval recovery batch. The terminal rows are excluded from confirmed totals; current Focus collection and later valid interval ingestion are not disproved by this incident.
- No source code changed and no product automated suite was run for this read-only diagnosis. No real Windows restart regression QA was run. A future fix requires changed-lease and same-lease recovery tests for both Open/runtime and Focus before release.
- Recommendation: diagnosis passes with greater than 95% confidence; implementation can proceed as an Agent-only 0.6.10 hardening change. Do not alter API policy enforcement or delete historical dead letters to conceal the symptom.

## 2026-07-30 Desktop 0.6.9 Runtime-not-started Diagnosis QA

- High, confirmed: the screenshot is not a Reports rendering defect. `Agent diagnostics are not available yet` is returned only when the Electron main-process runtime is null; the untouched Diagnostics labels are HTML defaults rather than live policy/sync values.
- High, confirmed: when runtime is null, the UI falls back to persisted `status.json`, explaining the prior-day Teams/heartbeat/queue display. That fallback cannot prove current collection.
- High, code-backed candidate: a transient startup config/DPAPI read failure skips runtime and auto-start initialization permanently for that process, while later UI polling can recover the paired config display without starting runtime. The `Enabling...` auto-start label is supporting evidence.
- No code changed and no automated suite was run for this read-only diagnosis. Real employee-machine restart QA remains required. Pass when a full tray quit/reopen produces live Diagnostics, current heartbeat, loaded policy and advancing confirmed sync; fail if runtime remains unavailable.

## 2026-07-29 Desktop Remote-session Attribution Review QA

- Native code review confirms the Agent resolves the local `GetForegroundWindow()` process and does not inspect window titles, page contents or processes running inside an outbound remote server session.
- Local keyboard/mouse input while the Remote Desktop client owns the foreground window refreshes its Focus-active evidence; 60 seconds without trusted input transitions that same client to Focused idle.
- Switching to a local App, locking/disconnecting the local Windows session, or suspending the local machine closes/pauses the Remote Desktop Focus lane through existing boundaries.
- No code changed and no automated suite was rerun for this read-only clarification. No real Remote Desktop manual QA was run. Pass for the code-backed behavior statement; exact installed-client naming remains device-level QA.

## 2026-07-29 Connection Audit Local-day And Event-time QA

### Findings And Diff Review

- High, fixed: Connection Audit inherited UTC usage dates, so an Australian-morning page could truthfully be July 29 locally while requesting July 28 as its audit date.
- High, fixed: stale current-live Browser devices created inferred heartbeat-loss history outside the selected audit range, which explains the July 27/28 one-event device cards shown on July 29.
- Medium, fixed: the API selected status rows by receipt/record time but displayed occurrence time, misplacing delayed offline lifecycle uploads.
- The fix is limited to Reports read/query/presentation. Browser Extension and Desktop Agent runtime, lifecycle generation, queues, tracking intervals, policy and upload behavior were not changed.
- Existing concurrent Connection Audit loading/error and Desktop start de-duplication changes were preserved. No conflicting change was reverted.

### Test And Verification Status

- `pnpm --filter @workmap/web test`: pass, 104/104.
- `pnpm --filter @workmap/api test`: pass, 59/59.
- Web/API typecheck: pass.
- Web/API lint: pass.
- Web/API build: pass.
- `git diff --check`: pass.
- Repository secret scan excluded env, dependencies and generated outputs; only five existing synthetic credential/URL test-fixture files matched, with no new real secret finding.
- New boundary coverage: Adelaide current-local-day resolution, western time zone behind UTC, historical range preservation, exact Adelaide midnight boundaries, old inferred Browser interruption suppression, current confirmed Browser start retention, and server query on `startedAt` rather than `recordedAt`.

### Manual QA, Risk And Recommendation

- Real deployed API/Web QA was not run. The automated result is a pass for deployment to a controlled environment.
- After deployment, verify the current Adelaide day both before and after UTC midnight. Only stored events whose displayed occurrence time falls in the labelled local range should appear; API failure must show unavailable/stale-confirmed state, not false zero.
- A missing client event cannot be fabricated by the frontend. If a new Browser start still does not appear after a successful audit response and upload window, inspect the stored lifecycle response rather than changing display logic.
- Proceed to controlled API/Web deployment and real `/reports` QA. No Browser Extension or Desktop Agent package update is required for this fix.

## 2026-07-29 Honest Desktop Connection Audit QA

### Reviewed Implementation And Findings

- High-severity defect fixed: the API coalesced separate Desktop v2 startup events with different `clientEventId` values, so a current-day startup could be absent while an older identical row remained outside the selected range.
- High-severity honesty defect fixed: the dedicated audit endpoint used optional fallbacks and could return a successful empty history after a query failure.
- Medium-severity presentation defect fixed: an unrequested/failed audit was rendered as `0 events` during first load or failure. Loading, unavailable, confirmed-empty and stale-confirmed states are now distinct.
- No outstanding current-change correctness finding was found in diff review. Desktop lifecycle capture/upload and Browser Extension files are outside this implementation scope and were not modified by this fix.

### Test / Verification Status

- `pnpm --filter @workmap/api typecheck`: pass.
- `pnpm --filter @workmap/api lint`: pass.
- `pnpm --filter @workmap/api test`: pass, 59/59.
- `pnpm --filter @workmap/api build`: pass.
- `pnpm --filter @workmap/web typecheck`: pass on clean sequential rerun.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web test`: pass, 104/104.
- `pnpm --filter @workmap/web build`: pass.
- Focused API lifecycle test: pass, 7/7. Focused audit render tests: pass, 13/13. `git diff --check`: pass.

### Manual QA, Risks And Recommendation

- Real deployed API/Web and Windows lifecycle QA was not run. Historical Desktop start rows discarded by the old API cannot be backfilled without inventing evidence.
- After deployment, verify a new start, lock, unlock, suspend and resume on one paired Agent. Pass when each confirmed transition appears under the selected employee/day within the polling window, and an induced audit API failure displays `Unavailable` rather than `0 events`.
- Recommendation: automated QA pass; proceed to API/Web deployment and controlled real-device audit QA. No Agent release, Browser Extension update or database migration is needed for this fix.

## 2026-07-29 Browser Extension 0.5.14 Focus Recovery QA

### Reviewed Implementation And Findings

- High, fixed: Domain Focus could remain self-locked after MV3 restart/reconciliation failure because messages were dropped when `focusedWindowId` was null and the `PAUSED`/`LIMITED` collector gate prevented trusted input from proving recovery. This exactly explains healthy heartbeats and increasing open/runtime alongside stale snapshots and zero Focus.
- Recovery is conservative: only a trusted content-script activity pulse from the verified OS-focused, non-minimized, non-incognito window and its eligible active HTTP(S) tab can restore Focus. Passive checkpoints, background windows, internal/protected pages, invalid policy/lease/window, missing permissions, auth/upgrade blocks and queue pressure cannot do so.
- Maintenance errors now expose bounded safe stage codes (`FOCUS_WINDOW_QUERY_RETRY`, `FOCUS_TAB_QUERY_RETRY`, `FOCUS_STATE_PERSIST_RETRY`, `OPEN_RUNTIME_TAB_QUERY_RETRY`) without URL, page, input or credential data.
- Historical missing Focus cannot be repaired honestly because the extension did not retain proof for those intervals. Existing `POLICY_REJECTED` dead letters remain excluded from Reports.

### Verification Status

- `pnpm --filter @workmap/browser-extension typecheck`: passed.
- `pnpm --filter @workmap/browser-extension lint`: passed.
- `pnpm --filter @workmap/browser-extension test`: passed, 77/77.
- `pnpm --filter @workmap/browser-extension build`: passed.
- `pnpm --filter @workmap/browser-extension release:zip`: passed.
- ZIP inspection: 22 entries, embedded manifest 0.5.14, 51,345 bytes, SHA-256 `F47CCBB76AEA68835D034220C2379CFCCD90A7FE2B09CCF0BAA955E524B9E5AC`.

### Manual QA And Recommendation

- Real Chrome and Edge load-unpacked execution was not run by Codex.
- Required pass sequence: reload the existing 0.5.14 unpacked extension without deleting/re-pairing; interact with a foreground eligible site for 3-5 minutes; confirm collector/snapshot freshness, accepted or duplicate Focus interval evidence, confirmed-through advancement and matching Reports growth; then idle past policy threshold and use trusted input to verify Focus resumes; finally send activity from a background window/tab and verify it is not counted.
- Automated QA passes and the artifact is suitable for controlled device QA. Do not publish broadly until the real Chrome/Edge sequence passes.

## 2026-07-29 Multi-monitor Focused Idle Clarification QA

- Native code review confirmed Desktop Agent obtains a single OS-wide foreground window through `GetForegroundWindow()`; it does not assign an independent focused App to each monitor.
- Runtime review confirmed every `foreground_changed` event calls `acquireFocus` for the new App, and the focus engine emits the previous App through the switch timestamp before starting the new App.
- Existing automated coverage `starts focus immediately and switches without overlap` verifies the previous focused interval closes exactly when the next App becomes foreground.
- Therefore Edge-visible/Codex-foreground is not an Edge Focused Idle case. It is Codex Focus plus potentially concurrent Edge Open/runtime.
- No real multi-monitor Windows manual QA was run. Pass for the code-backed behavior clarification; device-level observation remains optional QA.

## 2026-07-29 Focused Idle Review QA

- Code review confirmed `FOCUS_IDLE_THRESHOLD_MS = 60_000`, Desktop and Browser focus engines emit `FOCUS_IDLE`, API summaries aggregate it separately, and Reports exposes it in expanded metric cards.
- Verification command: `tsx --test apps/desktop-agent/test/desktop-focus-v2.test.ts apps/browser-extension/test/browser-focus-v2.test.ts apps/web/test/reports-app-metric-card.test.ts`.
- Result: 21/21 passed, including the explicit Desktop case where 90 seconds without input becomes 60 seconds Focus active plus 30 seconds Focused idle.
- No manual Windows/browser idle-duration test was run. Pass for the current implementation claim; real-device timing remains observational QA.

## 2026-07-28 Desktop DRAINING_V1 Manual QA

- Screenshot evidence confirms v2 collection is already functioning: the device is connected, the snapshot is current, v2 queue is zero, and confirmed-through/last-sync are current.
- `DRAINING_V1` is a temporary migration state, not evidence that the Agent is collecting new activity with v1.
- Recommendation: observe for up to 10 minutes. Pass when the pill becomes `V2`; if it persists, inspect the employee machine's legacy queue/logs without deleting or re-pairing it.

## 2026-07-28 Browser Policy Refresh Manual QA

- The Chrome Extension card is connected with current health/last-sync and one pending item, so the yellow lease warning does not mean the Browser connection failed.
- `SNAPSHOT_POLICY_LEASE_INVALID` remains current until a newer valid Domain snapshot is accepted; normal recovery should update snapshot time/current Domain within the next policy-maintenance cycles.
- Owner/Employee manual policy editing or re-acknowledgement is not part of normal lease refresh. A repeatedly advancing rejection timestamp is a fail condition if it persists beyond 5-10 minutes.
- Chrome-only persistence with Edge healthy narrows the issue to the Chrome device/runtime rather than the shared Monitoring Policy. A code-backed candidate is repeated resend of a stale `latestSnapshot` when Chrome has no foreground focus evidence to replace it.
- Immediate non-destructive check: foreground Chrome on a normal HTTP(S) page for 1-2 minutes. Pass if snapshot received advances and the current Domain becomes confirmed; continued new lease-invalid timestamps while Chrome is foreground require a Browser Extension fix.
- Manual result: passed. After Chrome was foregrounded on a normal page, the `Policy lease needs refresh` warning disappeared, confirming automatic recovery and a newer accepted snapshot.
- Live Chrome inspection was unavailable because the Codex Chrome-control integration is not installed in the selected Chrome profile; this candidate is not yet live-debugger verified.
- The `POLICY_REJECTED` Open Runtime sequence is historical terminal evidence. It requires investigation only if newly rejected counts/timestamps continue increasing after the refreshed lease is active.
- Recommendation: observe one focused normal HTTP(S) tab for 5-10 minutes; pass when snapshot time advances, current Domain becomes confirmed, queue stays near zero, and no new rejection appears.

## 2026-07-28 Post-migration Queue Recovery Manual QA

- Manual evidence: Desktop health is online/server-confirmed, secure heartbeat is current, and the latest shown batch accepted 20 intervals with no duplicate or rejection.
- Manual evidence: pending was still `892` but reportedly decreasing; confirmed-through lagged current time by roughly one hour, consistent with backlog replay rather than full recovery.
- The visible 12:13-12:23 HTTP/network failures are historical. Pass condition requires no newly timestamped failures while pending declines and confirmed-through advances.
- Recommendation: partial pass. Do not add Browser traffic yet; wait for Desktop pending to reach approximately `0-5` and confirmed-through to be within approximately five minutes of current time, then enable one extension for a 10-15 minute observation.

## 2026-07-28 Production Migration P3009 Follow-up QA

- Confirmed the new `P3009` is Prisma's expected guard for an unresolved failed migration record, not a second SQL/index failure.
- Confirmed the checked-in/local migration file still uses transaction-compatible `CREATE INDEX IF NOT EXISTS` and does not require another code change.
- Production recovery is not complete until `migrate resolve --rolled-back` succeeds before `migrate deploy`; no production command was run by Codex.

## 2026-07-28 Tracking Query Migration Recovery QA

### Reviewed Failure And Correction

- Confirmed Prisma `P3018` wraps the migration in a transaction and PostgreSQL rejected the first `CREATE INDEX CONCURRENTLY` with SQLSTATE `25001`.
- The first statement could not execute, so the transaction did not create either index; recovery must mark the failed migration rolled back and retry the corrected file.
- Replaced only the two migration statements with transaction-compatible `CREATE INDEX IF NOT EXISTS`. Schema, query predicates and runtime behavior are unchanged.

### Findings Ordered By Severity

- Critical external security action: the screenshot exposed the complete production database URL. The Supabase database password must be rotated and Render updated before any further migration or deployment.
- High, corrected locally: the original concurrent index syntax is incompatible with the observed Prisma production migration transaction.
- Medium deployment risk: regular index creation can temporarily block Tracking writes. Stop all tracking clients and avoid Reports during the migration; retained local queues prevent data loss.
- No evidence of a partial index or data mutation exists because PostgreSQL rejected the first statement before index creation.

### Verification And Recommendation

- `git diff --check`: passed.
- `prisma validate --schema prisma/schema.prisma` with a non-production placeholder URL: passed.
- Installed Prisma CLI help confirms the recovery syntax `migrate resolve --rolled-back <migration> --schema <schema>`.
- Application source did not change in this correction, so the previously passing API tests/typecheck/lint/build remain the relevant application verification.
- Production migration retry, Render reconnection with the rotated password, and real queue-drain QA are not run.
- Pass for a follow-up commit and controlled migration recovery. Do not proceed with the exposed credential or run a new migration before resolving `20260728130000_tracking_query_performance`.

## 2026-07-28 Supabase Query And Lock-Pressure QA

### Reviewed Implementation And Diff

- Reviewed the Supabase PostgreSQL slow-query/timeout sample against Tracking v2 transaction ordering, `ClientWriteLane` serialization, Prisma schema indexes and the legacy Reports coverage query.
- The implementation is additive and narrow: one tenant predicate, two indexes, one focused query assertion, and the previously verified pool fail-fast change.
- No client collection/sending code, payload contract, acceptance policy, report totals or role behavior changed.

### Findings Ordered By Severity

- High, fixed in source: the serialized overlap read omitted `companyId`, preventing the company-leading lane/time index from being a usable plan and extending the write-lane lock into tens of seconds.
- High, pending production migration: `/reports` company coverage needs a company/date-leading covering index; the supplied query took roughly 102 seconds without it.
- High, external state: Supabase Pro/Micro is active, but compute alone cannot correct these query plans. The production indexes and API code still need deployment.
- Medium, expected deployment risk: the corrected transaction-compatible index build can temporarily block writes, so production clients must be stopped for the bounded migration window and query/IO metrics watched.
- No regression was found in tenant isolation, same-App overlap rejection, different-App runtime concurrency, confirmed ledger insertion or report aggregation semantics.

### Test And Verification Status

- `tsx --test apps/api/test/tracking-v2-live-semantics.test.ts`: passed 14/14.
- `pnpm --filter @workmap/api test`: passed 57/57.
- API typecheck: passed.
- API lint: passed.
- API build: passed.
- `prisma validate --schema prisma/schema.prisma`: passed with a non-secret placeholder URL.
- Production migration/deploy and real Windows queue drain: not run.

### Manual QA, Risks And Recommendation

- No real Windows, installed Agent, deployed Render API or production query-latency QA was performed by Codex in this round.
- Pass for migration plus API deployment. Apply the migration once, restart/deploy the API, and keep the Agent SQLite queue intact.
- Do not declare recovery until pending trends down to zero, heartbeat and confirmed-through advance, rejected counts stay stable, and Supabase no longer reports the prior statement-timeout query shapes.
- The next round can proceed to controlled production migration/deployment and one-client drain observation; re-enable additional clients only after the first queue drains normally.

## 2026-07-28 Supabase Outage Fail-Fast QA

### Reviewed Implementation

- Reviewed Desktop 0.6.9 local NDJSON, supplied Render `P1001`/Tracking v2 logs, online API readiness, Supabase/Render public status, Prisma runtime URL handling and the API sync/reconciliation transaction boundaries.
- Reviewed the API-only fallback change from `pool_timeout=30` to `pool_timeout=10` and its pooler-mode tests.

### Findings Ordered By Severity

- High, infrastructure incident: Render could not reach the Supabase session pooler. This caused real sync requests to outlive the Agent's 60-second request and made pending grow even with only one client enabled.
- High, fixed in source: the application had raised Prisma's fallback pool acquisition wait to 30 seconds. Multiple serial acquisitions could therefore keep a disconnected Tracking request alive past the client envelope and amplify a transient database outage.
- Informational: the public readiness probe recovered before real `sync-v2`; this does not contradict the incident because `SELECT 1` does not prove that previously queued transactions and locks have cleared.
- No evidence of a policy, credential, tenant isolation, data-collection or terminal-rejection regression was found. Terminal rejected remained 56 while only pending grew.

### Test And Verification Status

- `pnpm.CMD --filter @workmap/api test`: passed 57/57.
- API typecheck, lint and production build: passed.
- `git diff --check`: passed.
- No migration is required.

### Manual QA Status, Risks And Recommendation

- Partial real-environment diagnostics were run: production readiness returned `200` / database ok, public provider status was checked, pooler TCP was reachable, and the local 0.6.9 Agent log was followed through repeated 60-second failures up to 542 pending.
- Post-change deployment and queue-drain QA are not run and must not be represented as passed.
- Pass for an API-only deployment. Do not rebuild/reinstall Desktop or Browser, clear SQLite, delete rejected rows, change policy, or migrate the database.
- After deploy/restart, pass only when the single Agent becomes server-confirmed online and pending trends to zero. If not, capture the newest request ID and Render's final server result; then inspect project-specific Supabase connection/lock metrics rather than increasing Agent request rate or compute size.

## 2026-07-28 Tracking Backpressure / Desktop 0.6.9 QA

### Reviewed Implementation

- Reviewed the single-Agent failure-rate evidence, Desktop request scheduling and durable queue, API transaction/cursor path, reconciliation worker, Reports dirty-ledger fallback, Prisma pool limit, release versioning and generated NSIS installer.
- Diff review confirms that collection engines and Browser Extension code were not modified. Product changes are limited to Desktop upload transport/backpressure and API ingestion/reconciliation/read-path cost.

### Findings Ordered By Severity

- Resolved - Blocker: newly created Desktop intervals no longer bypass retryable failure backoff. One global 5/15/30/60-second gate coalesces all retry triggers while SQLite continues retaining new intervals.
- Resolved - Blocker: Reports reads no longer launch write-heavy reconciliation against the same active date that ingestion is updating. Dirty dates remain accurate through the existing official-ledger fallback.
- Resolved - High: reconciliation waits for 60 seconds of target quiet, runs every 30 seconds and takes four targets, removing the intentional 15-second collision with continuous 15-second interval settlements.
- Resolved - High: cursor refresh uses the persisted contiguous prefix and unresolved tail instead of an unbounded full-epoch rescan. Tests cover a gap, a terminal rejection, preserved historical rejection and latest accepted time.
- Resolved - High: Desktop now permits the bounded API/pool envelope to return an acknowledgement and limits each transaction to 20 intervals. Stable IDs and duplicate acknowledgements preserve replay safety.
- Verified - High: valid Focus active/focused idle/open-runtime intervals still enter the formal ledger and Reports; snapshot-policy rejection remains isolated from confirmed health; Browser multi-window, multi-screen, lock/minimize and queue behavior still pass.
- Remaining - High: no deployed queue-drain or current Render log was observed. Code-level pass is not proof that the existing production pending count has recovered.
- Remaining - Medium: one sustained active date intentionally stays in ledger-fallback state until it is quiet for 60 seconds. Totals remain exact, but cached summary coverage can lag by that bounded interval.

### Test / Verification Status

- `pnpm --filter @workmap/desktop-agent typecheck`: pass.
- `pnpm --filter @workmap/desktop-agent lint`: pass.
- `pnpm --filter @workmap/desktop-agent test`: pass, 68/68.
- `pnpm --filter @workmap/desktop-agent build`: pass.
- `pnpm --filter @workmap/desktop-agent release:windows`: pass after rerunning with permitted network access; the first sandboxed attempt failed only with outbound `EACCES`.
- `pnpm --filter @workmap/api typecheck`: pass.
- `pnpm --filter @workmap/api lint`: pass.
- `pnpm --filter @workmap/api test`: pass, 57/57.
- `pnpm --filter @workmap/api build`: pass.
- `pnpm --filter @workmap/browser-extension typecheck`: pass.
- `pnpm --filter @workmap/browser-extension lint`: pass.
- `pnpm --filter @workmap/browser-extension test`: pass, 72/72.
- `pnpm --filter @workmap/browser-extension build`: pass.
- `git diff --check`: pass. Changed-text secret scan: pass.

### Manual QA And Recommendation

- Real Windows installation, local SQLite queue drainage, deployed API latency, Supabase connection use, `/reports` load time, and 1/2/4-client recovery were not run.
- QA recommendation: code/release candidate pass; production recovery remains conditional. Deploy API first, install 0.6.9 without deleting/re-pairing, and require pending to trend down to zero plus advancing confirmed timestamps before re-enabling other clients.
- No migration is required. Do not alter policy or clear the 56 historical terminal rejections; they are separate retained evidence and are not the current pending backlog.
- The next round can proceed to controlled deployment and real-device verification, but not yet to a production-readiness or capacity declaration.

## 2026-07-28 Standard Four-Client Non-Recovery QA

### Reviewed Evidence And Findings

- Reviewed the Standard instance screenshot, affected Desktop UI, Owner Reports state, latest local redacted NDJSON, Desktop 15-second transport and retry scheduling, Browser 30-second transport, API 15-second transaction, eight-connection pool fallback, cursor refresh, and reconciliation cadence.
- Blocker: Standard did not restore client acknowledgements. The latest 30-minute Desktop window has 113 attempts, 0 confirmations and 112 failures; 110 terminate at the exact 15-second client envelope while pending rises to 129.
- Blocker: `/reports` is slow and warns about sequence gaps under the same load. This is consistent with backend request/database starvation affecting both write and read paths.
- High: `Confirmed through 10:07` and a 10:09 received snapshot prove some server-side completion after the client's 09:41 last-confirmed sync. Durable pending therefore includes possibly already-committed rows awaiting accepted/duplicate acknowledgement; deleting the queue would be unsafe.
- High: four active tracking clients plus continuous retry is beyond current evidence-backed capacity. More compute alone does not remove the eight-connection, long-transaction and repeated-reconstruction bottlenecks.
- Remaining: exact post-upgrade server exception is not confirmed because the signed-in Render dashboard tab was unavailable. A current Render `P2024`/transaction-stage log and database active-connection view are still required for final server correlation.

### Verification And Recommendation

- Read-only local log/source/screenshot diagnosis: pass. Product tests, deliberate load test, Render restart, client isolation/recovery and signed-in post-upgrade log inspection: not run.
- Current four-client Standard readiness: fail. Reduce active clients to one for controlled queue drainage, then implement the scoped Desktop/API performance correction before reintroducing four simultaneous clients.
- The next round can proceed with implementation, preserving local collection accuracy, durable queue identity, policy/tenant/device boundaries and accepted Reports ledger semantics.

## 2026-07-28 Render Standard Capacity Estimate QA

### Reviewed Evidence And Findings

- Verified current Desktop 10-second health / 15-second settlement cadence, 15-second client timeout, API 15-second transaction envelope, 15-second reconciliation worker cadence, and Prisma's 8-connection session-pool fallback.
- Recomputed the observed single-Agent rate as 3,915 attempts over 454.6 minutes, or 8.61 requests/minute. Combined with observed 5.9-second p50 / 11.2-second p95 response time, five Agents can consume approximately 4.2 / 8.0 concurrent Tracking requests before non-Tracking work.
- High: Standard's 2 GB / 1 CPU is required headroom but does not remove the 8-connection or long-transaction bottleneck.
- High: two simultaneous employees are the conservative current pilot gate; three is supervised-test-only, and five or more is not evidence-backed.

### Verification And Recommendation

- Read-only source/log calculation: pass. Standard deployment, controlled load test and real multi-device QA: not run.
- Multi-user production readiness remains fail. The next performance round can proceed, but no higher employee capacity should be advertised until load gates pass with pending returning to zero and no `P2024`, OOM or reconciliation timeout.

## 2026-07-28 Two-Employee Prisma Pool Exhaustion QA

### Reviewed Implementation And Evidence

- Reviewed the supplied Render Prisma stack trace, current Desktop redacted NDJSON, existing Desktop retry/dead-letter rules, API transaction/pool configuration, and the prior 512 MB memory-limit evidence.
- No product or infrastructure setting was changed.

### Findings Ordered By Severity

- Blocker: Prisma exhausted all 8 configured application connections and timed out queued queries after 30 seconds (`P2024`). Tracking syncs then failed retryably after 46-142 seconds; policy/device/activity queries were also starved.
- Blocker: the local queue continued growing from 11 to 47 while nearly every request hit the Desktop 15-second timeout. The current API deployment is not reliable for a two-employee sustained Tracking v2 test.
- High: adding the second employee increased load but did not create a policy error. It exposed existing request amplification, long transactions, reconciliation pressure and insufficient 512 MB instance headroom.
- High: pending intervals remain retryable local data and the terminal rejected count stayed at 56. Recovery is expected after backend stability, but it has not yet been observed for this incident.
- Medium: increasing only Prisma `connection_limit` is not an adequate fix and can overload the database. Vertical API headroom must be paired with shorter/coalesced work and bounded retry/reconciliation.

### Verification And Recommendation

- Read-only log/source diagnosis: pass. Automated tests, Render resize, deployed load testing, database connection metrics and real two-device recovery QA: not run.
- Upgrade the API to Render Standard 2 GB / 1 CPU now as operational containment; no migration or Agent reinstall is required. Do not onboard more sustained clients until the performance patch and 1/5/20/50-client load gates are completed.
- Current multi-user readiness: fail. The next round should proceed with server/runtime performance corrections while preserving collection accuracy, durable queues, policy enforcement, tenant/device boundaries and official Reports ledger semantics.

## 2026-07-28 Reports Stale Heartbeat Versus Policy QA

### Reviewed Implementation And Evidence

- Reviewed API connection freshness calculation, snapshot rejection precedence, visible Browser-device selection, Web connection/snapshot presentation, server diagnostic presentation, and the supplied Live signals screenshot.
- No product implementation was changed.

### Findings Ordered By Severity

- Verified - High: all visible health rows say `Policy Active`; `0/3 connected` is caused by stale server-received heartbeat timestamps, not a global policy failure.
- Verified - High: Desktop uses a 30-second health freshness limit and Browser uses 90 seconds. The shown Desktop 09:41 confirmation became stale only because no later health row was received.
- Verified - Medium: Chrome's last snapshot has a specific expired/replaced-lease rejection, but the stale client is not currently completing automatic lease refresh. Edge shows only an older terminal interval tombstone.
- Confirmed - Medium: Desktop stale connection and snapshot copy incorrectly says `Browser heartbeat` / `Browser Extension` because shared Web presentation hardcodes Browser wording. Connection/policy logic remains separate and correct.
- Remaining - Medium: the screenshot cannot identify whether the current missing heartbeat is caused by a stopped Agent, sleep, local network, API outage, or timeout. Local Desktop diagnostics are required.

### Verification And Recommendation

- Read-only source/screenshot diagnosis: pass. Automated product tests and real deployed client QA: not run.
- Do not alter policy from this evidence. Require advancing Desktop heartbeat/sync and a refreshed Chrome lease/snapshot. A Web-only client-specific wording correction is safe to schedule separately.
- The next round can proceed, but current client connectivity must be re-established before declaring live tracking healthy.

## 2026-07-27 Render Memory Exhaustion And Tracking v2 Scalability QA

### Reviewed Implementation And Evidence

- Reviewed supplied Render memory/CPU/request graphs and API transaction logs, Desktop sync cadence/coalescing behavior, the Tracking v2 ingestion transaction, full-epoch cursor refresh, full-day reconciliation worker, Prisma runtime pool configuration, schema indexes, and current-day local NDJSON request statistics.
- No product or deployment implementation was changed.

### Findings Ordered By Severity

- Blocker: a single sustained Desktop client generated 3,787 `sync-v2` attempts over 439 minutes (8.63/minute) while the 512 MB API instance reached its memory limit and restarted. The current deployment is not acceptable for a simultaneous multi-user pilot.
- Blocker: API logs contain repeated transaction-stage `TRACKING_SYNC_INTERNAL` failures taking 15-26 seconds, and the reconciliation worker exceeded its 10-second transaction timeout after 23,884 ms. Restart did not cure these failures.
- High: normal Focus, open/runtime, and health activity can produce separate sync requests in one logical collection cycle. This needlessly multiplies server load without improving local tracking accuracy.
- High: ingestion reconstructs cursor coverage from all rows in an active epoch, while reconciliation repeatedly loads and merges all fragments for the user/source/day. Both paths become more expensive as the workday grows.
- High: the Desktop 15-second client timeout matches the API's transaction timeout. Timed-out client retries can overlap server-side completion/rollback and create a positive feedback loop under pressure.
- Medium: available evidence strongly supports request amplification plus accumulating recomputation and constrained compute. It does not yet distinguish a separate retained-object memory leak; heap/RSS observation during a controlled idle window is still required.

### Verification And Recommendation

- Read-only source/log/metrics diagnosis: pass. Automated product tests, deployed heap profiling, query plans, load testing, and real multi-user QA: not run.
- Operational recommendation: upgrade Render API to Standard 2 GB now as temporary containment, then implement sync coalescing/backoff and short/incremental ingestion plus bounded background reconciliation before onboarding multiple sustained clients.
- Release recommendation: fail current backend scalability for multi-user Tracking v2. The next round may proceed with a deliberately scoped performance correction; it must preserve local collection, tenant/device credential boundaries, policy enforcement, idempotency, durable retry, and official Reports ledger accuracy.

## 2026-07-27 Desktop Agent 0.6.8 HTTP 502 Recovery QA

### Reviewed Implementation And Evidence

- Reviewed Desktop `sync-v2` HTTP 5xx handling, retry/dead-letter state changes, supplied screenshots, exact local NDJSON rows around the 16:42 Adelaide burst, later confirmed syncs, and current Render platform status.
- No product implementation was changed.

### Findings Ordered By Severity

- Confirmed - High: the user's Render notification states that `workmap-api` exceeded its memory limit and was automatically restarted. This closes the previously unproven service-side cause of the 502 burst.
- Verified - High: the six-row 502 burst returned an HTML gateway page, not a Tracking v2 business rejection. All affected intervals stayed retryable; none increased the durable 56 rejected count.
- Verified - High: HTTP 200 resumed in about 20 seconds and pending drained from 13 to zero across recovered requests while interval rejection stayed zero. Together with increasing `/reports` totals, there is no evidence of data loss in the observed batch.
- Remaining - Medium: the restart cause is memory exhaustion, but the underlying memory-growth cause remains unresolved. Render metrics/API logs must distinguish leak, traffic/load spike, expensive request concurrency, and insufficient instance memory.
- Confirmed - Medium: the diagnostic renderer exposes a bounded fragment of raw non-JSON HTML for 502 responses instead of a clear retry message. This is a presentation defect, not queue or ledger corruption.
- Remaining - Medium: 62 current-day 15-second no-response timeouts remain a separate transport/diagnostic reliability concern even though observed retries recovered.

### Verification And Recommendation

- Read-only source/log diagnosis: pass. Public hosting status check: no July 27 platform-wide incident reported.
- Automated product tests and manual fault injection were not run because this round changed documentation only.
- Pass the observed queue recovery and accepted-data path. No emergency release is required solely for this short recovered 502 burst. Proceed to a narrowly scoped Desktop transport/diagnostic refinement only if the user wants clearer errors and fewer false timeout rows; do not change collection or ledger logic.

## 2026-07-27 Desktop Agent 0.6.8 Network Diagnostics QA

### Reviewed Implementation And Evidence

- Reviewed Desktop `sync-v2` 15-second timeout, failure classification, retry/dead-letter state changes, SQLite queue statistics, recent-failure persistence, renderer fallback wording and the current-day local redacted NDJSON.
- No product implementation was changed.

### Findings Ordered By Severity

- Verified - High: current no-response/network failures retry pending intervals and do not increment terminal dead letter. A stable historical `56 rejected` is therefore correct.
- Verified - High: after the last displayed timeout, HTTP 200 resumed, a 12-interval request confirmed with zero rejection, pending drained to zero and dead letter stayed 56. The observed queued data recovered rather than being newly rejected.
- Confirmed - Medium: 44 of 45 current-day failures align with the exact 15-second Desktop client timeout; the remaining failure is HTTP 502. Frequent timeouts are not ideal even though recovery worked.
- Confirmed - Medium: current 0.6.8 no-response diagnostics incorrectly receive the legacy-history fallback sentence and omit `Automatic retry: yes`, even though the runtime follows the retry branch.
- Remaining - Low: no server request-log correlation or deliberate network/latency fault injection was performed, so the exact upstream source of the slow response is not proven.

### Verification And Recommendation

- Read-only source/log diagnosis: pass. `git diff --check`: pass. Scoped secret scan: pass.
- Automated product tests and manual network QA were not run because this round changed documentation only.
- Pass the queue behavior and observed recovery. Do not describe 45 daily request failures as ideal network health. A future separate Desktop transport/diagnostic patch may raise timeout headroom and correct wording, but must leave collection, Tracking v2 intervals, policy and Reports ledger semantics unchanged.

## 2026-07-27 Desktop Connection Audit Web-Only QA

### Reviewed Implementation

- Reviewed the Desktop-specific all-status renderer, status titles/details/tones, legacy-session fallback, linked-session deduplication, Browser formatter isolation, source filtering, sorting, inferred/delayed-sync labels, and the complete current Web suite.
- Confirmed that this scope changes Web presentation only. Desktop Agent `0.6.8`, Tracking v2 queues/sync, policy/lease, API persistence, database/schema and Reports activity totals are untouched.

### Findings Ordered By Severity

- Fixed - Medium: stored Desktop v2 start, user stop, shutdown, crash, termination and unknown-interruption events were omitted by the former supplemental allow-list.
- Fixed - Medium: Desktop `RESTARTED` could be labelled `Browser profile started`; Desktop now has an isolated `Agent restarted` mapping.
- Fixed - Medium: directly showing all status rows could duplicate legacy session start/end rows. Linked v2 evidence now wins by `agentSessionId`, with legacy rows retained only as fallback.
- Preserved - High: no collection/upload/ledger/policy behavior changed. Audit history remains independent from current Live heartbeat and confirmed App totals.
- Remaining - Low: signed-in production rendering and real Windows restart/lock/sleep/quit sequencing have not been manually exercised. Existing concurrent Browser changes share the Web component and must remain included/reviewed when the worktree is committed.

### Test And Verification Status

- Focused audit tests: pass `12/12`.
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/web lint`: pass.
- `pnpm.cmd --filter @workmap/web test`: pass `98/98` after retaining the explicit Desktop source-filter invariant required by the full suite.
- `pnpm.cmd --filter @workmap/web build`: pass.
- `git diff --check`: pass. Scoped secret scan: pass.

### Manual QA And Recommendation

- Real signed-in Owner `/reports` and Windows lifecycle QA: **NOT RUN**.
- Pass for Web-only source implementation. No Agent/API/database release is needed. Proceed to manual audit-history verification and deploy Web only after the concurrent Browser work is intentionally reconciled.

## 2026-07-27 Browser Extension 0.5.13 Connection Health QA

### Reviewed Implementation

- Reviewed the complete Browser sync failure/success path, retry classification, status queue transitions, server heartbeat-gap inference, Connection Audit grouping/presentation, API transaction budget, and the real 0.5.12 screenshots.
- Verified that a short online request failure is a local diagnostic only, browser-confirmed network loss remains a real transition, heartbeat expiry does not fabricate a cause, and recovery remains correlated to a later server-confirmed heartbeat.

### Findings Ordered By Severity

- Fixed - High: a single 408/429/5xx/fetch timeout previously emitted `SERVER_UNREACHABLE`, and the next success emitted `RECONNECTED`, creating the observed infinite alternating audit history.
- Fixed - High: the 10-second `/sync-v2` timeout was shorter than the API's possible 5-second transaction wait plus 15-second transaction runtime. The Extension now permits 30 seconds for this route.
- Fixed - Medium: `Signal interrupted` implied a stronger lifecycle conclusion than Browser APIs can prove. Current wording states only that WorkMap did not receive a confirmed heartbeat within 90 seconds and lists the indistinguishable possible causes.
- Preserved - Medium: old false transitions remain in historical audit data. Removing or rewriting server history was intentionally rejected; validation must focus on whether 0.5.13 stops creating new rows.
- Preserved - Low: Chrome and Edge/profile identities remain separate devices and histories; no grouping or tenant/RBAC behavior changed.

### Verification And Recommendation

- Browser Extension: typecheck pass; lint pass; 72/72 tests pass; build pass; release ZIP pass.
- Web Browser-specific validation: typecheck pass; lint pass; production build pass; 12/12 focused live/audit tests pass.
- Full Web suite: 97/98. The only failure is an unrelated concurrent Desktop Connection Audit source-string assertion; it appeared after another conversation added Desktop implementation/tests during this round. Browser tests remain green and Desktop code was not altered here.
- `git diff --check`: pass. Scoped secret scan: pass. Artifact manifest/version/content/size/hash: pass.
- Manual QA: not run. Do not claim real Chrome or Edge completion until the ten-minute open-browser and close/reopen heartbeat-gap sequence is executed for both browsers.
- Recommendation: proceed to real Chrome/Edge load-unpacked QA with 0.5.13. Do not publish or deploy until that QA confirms no new `WorkMap request unavailable` / `Connection restored` flapping.

## 2026-07-27 Desktop Connection Audit Current-State QA

### Reviewed Implementation

- Reviewed current Desktop Agent `0.6.8` v2 lifecycle production, Electron lock/unlock/suspend/resume integration, API status-history query/coalescing, legacy session compatibility, and Owner Web audit filtering, titles, details, timestamps, and tones.
- No product implementation was changed.

### Findings Ordered By Severity

- Confirmed - Medium: `0 events` is not a connection failure. Normal v2 startup is stored as `RUNNING / AGENT_STARTED` but filtered from the Desktop audit card; current connection belongs to Live signals.
- Confirmed - Medium: the Desktop v2 history remains incomplete because the Web allow-list omits direct start, user-stop, shutdown, crash, termination, and unknown-interruption status rows.
- Confirmed - Medium: a Desktop `RESTARTED` row currently receives the Browser-specific title `Browser profile started` because both clients share one formatter. This is incorrect presentation, not a collection or ledger defect.
- Confirmed - Low: lock/sleep close the current foreground boundary; unlock/resume render as `Reconnected`, with the reason line distinguishing the actual Windows transition.
- Confirmed - Low: server-inferred recovered heartbeat gaps currently exist for Browser Extension. Current Desktop v2 does not have the same persisted gap-inference flow; the generic section subtitle is broader than Desktop's implementation.

### Verification, Risk, And Recommendation

- Source/diff review: pass for explaining current behavior. `git diff --check`: pass. Scoped secret scan: pass.
- Automated product tests and real Windows lifecycle QA were not run because this round changed documentation only.
- Pass for the status explanation; fail any claim that the Desktop v2 Start/Stop/Interruption timeline is complete. The next round may proceed with a narrowly tested Web/API audit correction if explicitly requested.

## 2026-07-25 Browser Extension 0.5.12 Runtime Preservation QA

### Reviewed Implementation And Findings

- **Resolved, critical:** current v8 runtime records were treated as unknown and destructively replaced with initial state on every read. Options' five-second diagnostics refresh and background post-sync reads therefore reset live Tracking v2 state and explain the exact all-pending screenshot plus severe report undercount.
- The fix returns a v8 record unchanged before all legacy migration branches. Legacy versions 5/6/7 retain their existing migrations; unknown stored versions now throw rather than silently erase evidence.
- The new controlled IndexedDB test proves activation, heartbeat, confirmed-through and request ID round-trip exactly with zero write calls. It fails against the previous implementation.
- Diff review found no Desktop Agent, API, Web, shared contract, Prisma, auth, policy, RBAC or tenant change. Hostname-only privacy and durable queue behavior are unchanged.

### Verification Status

- `pnpm --filter @workmap/browser-extension typecheck`: PASS.
- `pnpm --filter @workmap/browser-extension lint`: PASS.
- `pnpm --filter @workmap/browser-extension test`: PASS `71/71`.
- `pnpm --filter @workmap/browser-extension build`: PASS.
- `pnpm --filter @workmap/browser-extension release:zip`: PASS.
- `git diff --check`: PASS with line-ending normalization warnings only; scoped high-confidence secret scan: PASS, zero matches.
- Artifact: 22 entries; 50,036 bytes; manifests `0.5.12`; SHA-256 `4F0C6121A78C21D3200E01295F8AD1FE4CA0A29A2BC7ED10CA996C89301E287C`.

### Manual QA, Risks, Recommendation

- Real Chrome/Edge QA: **NOT RUN**. The user screenshot is diagnostic evidence from broken 0.5.11, not post-fix acceptance.
- Previously erased local time cannot be fabricated. The affected screenshot had no queued or dead-letter rows available for recovery.
- Remaining risk: browser-specific scheduling and the existing sync timeout budget require field observation after upgrade.
- Recommendation: **PASS for same-entry Edge/Chrome load-unpacked QA; HOLD store/production publication until live heartbeat, accepted interval, confirmed-through and `/reports` growth are observed.** The next QA round can proceed.

## 2026-07-25 Browser Extension 0.5.11 Field Sync Failure Triage QA

### Reviewed Evidence And Findings

- The supplied audit row proves one Edge request failed at 2:07 PM and that the failure event itself reached the server later; it does not identify whether Tracking v2 failed by browser timeout/network/CORS or HTTP 5xx.
- Source review confirms retryable failures retain durable interval IDs and apply bounded IndexedDB retry backoff. The row therefore supports a temporary confirmation lag, not a conclusion that the interval was discarded.
- Public API health and database readiness were healthy when checked during this round. This cannot reconstruct the historical 2:07 PM failure.
- Found a real timeout-budget risk: the Extension aborts every API request after 10 seconds, shorter than the Tracking v2 transaction's 5-second acquisition plus 15-second execution allowances.
- Found a coverage gap: there is no executable runtime test that drives a failed/aborted sync through durable retry and a later accepted confirmation. Existing queue and API classification tests pass but do not prove that composed recovery path.

### Verification, Manual QA, And Recommendation

- Browser Extension suite: PASS `70/70`.
- Real Edge/Chrome timed QA: **NOT RUN**.
- No code diff was made because the current screenshot does not provide 95% attribution for the undercount. Obtain the affected Edge Options diagnostic/request ID/queue state before choosing between a sync-timeout recovery fix and a different collector or server-side investigation.
- Recommendation: **HOLD additional Browser release; continue field diagnosis.** The next round can proceed immediately once the complete Options diagnostics capture is available.

## 2026-07-25 Browser Extension 0.5.11 QA

### Reviewed Implementation And Findings

- **Resolved, high:** real Edge `0.5.10` could maintain server-confirmed heartbeat/snapshot while producing no confirmed interval because the 20-second keepalive did not settle either formal ledger engine. The keepalive now settles/persists Focus and Browser Domain runtime itself; correctness no longer assumes punctual 30-second alarms.
- **Resolved, medium:** repeated startup callbacks created distinct forced status IDs, which the API correctly retained as distinct profile starts. A device-scoped 5-second durable guard now suppresses only duplicate callbacks from the same boot.
- **Expected boundary, not a defect:** Domain Focus totals can be lower than Desktop Edge Focus because Browser Extension excludes browser chrome, address bar, protected/internal pages, DevTools, inaccessible PDFs and any interval that cannot be assigned to one eligible hostname. A large gap accompanied by `No confirmed interval`, as in the supplied evidence, is not accepted as normal.
- Diff review found no Desktop Agent, API, Web, shared contract, Prisma, auth, policy, RBAC or tenant-isolation change. Hostname-only privacy and unknown-gap non-backfill are preserved.

### Verification Status

- Focused executable tests: pass `11/11`.
- `pnpm --filter @workmap/browser-extension typecheck`: pass.
- `pnpm --filter @workmap/browser-extension lint`: pass.
- `pnpm --filter @workmap/browser-extension test`: pass `70/70`.
- `pnpm --filter @workmap/browser-extension build`: pass.
- `pnpm --filter @workmap/browser-extension release:zip`: pass.
- Artifact inspection: 22 entries; manifest `0.5.11`; 49,974 bytes; SHA-256 `AB718F8849ABFF078D98C7856B63EFBA33E508401972DA2B262D2D58356E426F`.
- `git diff --check`: pass. Scoped secret scan with generated/reference/env exclusions: pass, no matches.

### Manual QA, Risks, Recommendation

- Real Chrome/Edge load-unpacked QA: **NOT RUN**. The user screenshots are post-0.5.10 failure evidence, not post-0.5.11 acceptance.
- Existing duplicate status rows and unrecorded historical time remain immutable evidence; 0.5.11 prevents new same-boot duplicates and creates future intervals, but does not fabricate/backfill history.
- Remaining manual risk is Browser scheduling behavior in the user's installed Edge/Chrome builds. Validate accepted/duplicate interval evidence and advancing `Confirmed interval through` across at least 10 minutes, then tab switch, idle, minimize, lock/unlock, sleep/wake and browser restart.
- Automated recommendation: **PASS for load-unpacked QA; not yet accepted for store/production publication.** The next QA round can proceed.

## 2026-07-24 Browser Extension 0.5.10 Durable Focus/Runtime QA

### Reviewed Implementation And Findings

- P0 fixed: normal trusted pointer movement was absent, causing Browser Domain Focus active to expire while Desktop Windows last-input remained active.
- P0 fixed: the 30-second MV3 termination boundary raced the 30-second alarm. Repeated worker recovery sealed both Focus and Domain runtime at zero-length old tails, explaining online heartbeats/current snapshots with few or no confirmed historical intervals.
- The fix uses one 20-second timer only while a proven Focus or policy-authorised Domain runtime engine exists. Each tick runs bounded reconciliation/persistence; no URL, coordinate, target or content is collected.
- Existing conservative discontinuity behavior is preserved: unexpected termination, sleep, restart, lock and clock gaps are not fabricated or backfilled.
- Desktop Agent was not modified. API/Reports ledger and aggregation contracts were not modified because real evidence already showed accepted Browser rows and the fresh-client defect was pre-ledger interval generation.

### Automated Verification

- `pnpm --filter @workmap/browser-extension typecheck`: PASS.
- `pnpm --filter @workmap/browser-extension lint`: PASS.
- Focused Browser tests: PASS `22/22`.
- Full Browser tests: PASS `68/68`.
- `pnpm --filter @workmap/browser-extension build`: PASS.
- `pnpm --filter @workmap/browser-extension release:zip`: PASS.
- Two-hour continuous eligible Edge simulation: exact `7,200,000ms` Focus active and `7,200,000ms` Domain open/runtime, positive adjacent/non-overlapping intervals only.
- Final diff/secret/artifact checks are recorded in the final task report.

### Manual QA, Risks, And Recommendation

- Real Chrome/Edge load-unpacked QA is **NOT RUN**. Automated checks cannot prove the browser will retain the worker exactly as expected on the user's installed Edge build.
- The 20-second keepalive is intentionally active only during a proven collection session. Chrome documents 30-second service-worker inactivity termination and permits periodic extension API calls for exceptional lifetime-sensitive work; resource impact should still be observed during manual QA.
- Browser Domain Focus is not required to equal Desktop Edge Focus on browser chrome, internal/protected pages, inaccessible PDFs or other pages where content instrumentation cannot run.
- Recommendation: implementation PASS; production acceptance HOLD until same-entry upgrade QA confirms confirmed-through advances during an uninterrupted eligible page session, pointer movement maintains active state, no-input becomes Focused idle, and sleep/lock remain excluded.

## 2026-07-24 Reports Browser Audit Collapsed-Row QA

### Reviewed Implementation And Findings

- Confirmed from the supplied UI and Network evidence that `OPTIONS 204` is normal preflight and the actual audit `GET` returns `200`. The visible `16 events` count means audit events were already present in frontend state.
- Fixed - High: the height-bounded Browser audit CSS Grid compressed many implicit device rows because each child could shrink and clipped overflow. This produced the exact repeated grey-bar pattern while hiding every device/event label.
- The Browser audit scroll area is now a vertical Flex column; device groups cannot shrink. Empty devices with no history are excluded, while Chrome/Edge/profile histories remain keyed by `deviceId`.
- No API/backend or client telemetry change was needed. Desktop Agent behavior is untouched.

### Automated Verification

- Focused Browser/refresh tests - pass, `8/8`.
- `pnpm --filter @workmap/web typecheck` - pass.
- `pnpm --filter @workmap/web lint` - pass.
- `pnpm --filter @workmap/web test` - pass, `93/93`.
- `pnpm --filter @workmap/web build` - pass. Existing warning: Next.js plugin is not detected in the current ESLint configuration.
- Final diff, generated-file cleanup, `git diff --check`, and scoped secret scan are recorded at the end of this round.

### Manual QA, Risks, And Recommendation

- Post-fix signed-in Owner `/reports` QA is **NOT RUN**. The in-app inspection surface had no authenticated WorkMap tab, so production behavior was not claimed from source tests alone.
- After Web deployment, verify the same `16 events` dataset displays readable per-device titles and rows, each device list remains separate, the 420px area scrolls, and silent polling neither blanks nor compresses the content.
- Automated recommendation: **PASS** for Web deployment consideration. No Browser Extension/Desktop Agent release is needed. Production acceptance remains **HOLD** until the short signed-in visual check passes.

## 2026-07-24 Reports Connection Audit Refresh QA

### Reviewed Implementation And Findings

- Confirmed the screenshot defect directly in source: `loadAudit()` set `loading: true` before every five-second request, and `AuditTimeline` replaced all rows with a loading paragraph whenever that flag was true.
- Fixed the high-impact UX defect by removing Connection Audit loading presentation/state and retaining the mounted list during silent polling.
- Added transition-only audit revision comparison. The current state object is preserved for identical session/status history; only a real session boundary or device lifecycle record changes the displayed history.
- Reviewed Browser identity fields across audit, coverage, and Tracking v2 live data. Grouping is keyed by `deviceId`, with browser/workstation/version used only for labeling, so Chrome, Edge, unknown/future identities, and multiple same-browser profiles cannot share one event list.
- No API change was required because existing responses already contain device ID, browser name, version, and workstation metadata.

### Automated Verification

- Focused Connection Audit tests - pass, `6/6`.
- `pnpm --filter @workmap/web typecheck` - pass.
- `pnpm --filter @workmap/web lint` - pass.
- `pnpm --filter @workmap/web test` - pass, `91/91`.
- `pnpm --filter @workmap/web build` - pass. Existing warning: Next.js plugin is not detected in the current ESLint configuration.
- `git diff --check` - pass with line-ending warnings only. Scoped secret scan excluding environment, dependency, build, generated, artifact, cache, and reference directories - no finding. Desktop Agent, Browser Extension runtime, API, shared-types, and Prisma diff - none.

### Manual QA, Risks, And Recommendation

- Real Owner `/reports` browser QA is **NOT RUN**. The supplied screenshots are valid pre-fix evidence only.
- Required QA: keep one user-scoped report open for at least 30 seconds and confirm no loading flash; preserve a non-top scroll position; trigger Desktop sleep/resume and lock/unlock; restart Chrome and Edge separately; confirm each new transition appears only in the matching device section; test two profiles of the same browser if available.
- The page still performs silent five-second polling. True push-only updates would require a separately designed, authenticated, tenant-scoped SSE/WebSocket audit subscription and is intentionally not fabricated in this frontend-only repair.
- Automated recommendation: **PASS**. Proceed to signed-in visual/lifecycle QA, then deploy Web if it passes. No Browser Extension or Desktop Agent release is needed for this frontend repair.

## 2026-07-23 Browser Extension 0.5.9 Repeated Injection QA

### Reviewed Implementation And Findings

- Reviewed the supplied Chrome and Edge error pages, the compiled line mapping, dynamic content-script registration, existing-tab recovery injection, Options pairing registration, and the page-level installation guard.
- Confirmed high-severity `0.5.8` defect: repeat injection redeclared top-level `const workMapWindow`; JavaScript failed before the idempotency marker could be checked. This independently explains the identical failures in both browsers.
- Fixed by adding a per-execution function scope and retaining the per-frame marker. No broad registration/focus/runtime architecture change was required.
- Separately verified the Reports policy semantics: `Not enabled` means the active Browser Domain runtime policy flag is false or absent. It is not evidence that the fixed content script failed to produce intervals; installing an Extension does not auto-enable a privacy policy.

### Automated Verification

- `pnpm --filter @workmap/browser-extension typecheck` - pass.
- `pnpm --filter @workmap/browser-extension lint` - pass.
- `pnpm --filter @workmap/browser-extension test` - pass, `66/66`, including real repeat execution of the transpiled content script in one VM context with no duplicate listeners/messages.
- `pnpm --filter @workmap/browser-extension build` - pass.
- `pnpm --filter @workmap/browser-extension release:zip` - pass.
- ZIP inspection - manifest `0.5.9`, 22 entries, 49,024 bytes, SHA-256 `C37621B92B543772F414B0868B0D2145478179A9C4BED89345220DEB8BE5879D`.
- `git diff --check` - pass. Scoped secret scan excluding environment, dependency, build, unpacked, artifact, generated, cache, and reference directories - no finding. Desktop Agent diff - none.

### Manual QA, Risks, And Recommendation

- Post-fix real Chrome load-unpacked: **NOT RUN**. Post-fix real Edge load-unpacked: **NOT RUN**.
- Required focused QA: upgrade the existing unpacked entry to `alpha-unpacked` 0.5.9 without removing it, reload affected tabs, clear the old extension error list, trigger Options registration/reload twice, and confirm no new `workMapWindow` SyntaxError and only one activity listener set per frame.
- Runtime policy QA remains separate: verify `/compliance` says enabled on a newly created acknowledged policy version, then verify each Extension Options page says Domain open/runtime enabled and has a fresh granting lease before expecting `/reports` duration.
- Automated QA recommendation: **PASS** for the repeat-injection patch. Distribution/production recommendation: **HOLD** until the focused Chrome and Edge manual checks pass. The next round may proceed to controlled manual QA; do not auto-publish.

## 2026-07-23 Browser Extension 0.5.8 QA

### Reviewed Implementation

- Reviewed the full Browser flow: MV3 listeners, OS-focused Domain Focus lane, trusted all-frame evidence, hostname eligibility/privacy, Domain runtime tab-set engine, durable checkpoint/queue migration, policy/lease/acknowledgement/window enforcement, sync correlation and terminal diagnostics, official ledger/reconciliation, Owner Connection Audit, Compliance enablement, and Domain Reports rendering.
- Reviewed official Chrome Extension API limits: profile startup is observable; idle exposes active/idle/locked; service-worker suspend/termination does not provide reliable asynchronous close telemetry. The product therefore separates confirmed events from inferred heartbeat loss.
- No Desktop Agent behavior or source file was modified.

### Diff Review Findings

- No open critical or high-severity finding remains.
- Fixed during QA: same status with a different client event ID initially bypassed API duplicate suppression for all statuses. The final rule preserves only distinct Browser `profile-start` events and keeps ordinary status retries/coincident duplicate states idempotent.
- Fixed during QA: a stale Browser could produce two identical `Signal interrupted` audit rows when both coverage history and current v2 health supplied the same inferred timestamp. The final presentation de-duplicates by device/title/time and has an executable regression.
- Fixed during release QA: `release:zip` could return success without leaving a 0.5.8 ZIP, risking accidental reuse of 0.5.7. The script now uses the explicit Windows PowerShell path and verifies a non-empty archive.
- Historical rejected rows are intentionally retained. A pre-existing `FOCUS_OVERLAP` or `INVALID_DURATION` tombstone may still appear but remains excluded from official totals.

### Automated Verification

- `pnpm --filter @workmap/browser-extension typecheck` — pass.
- `pnpm --filter @workmap/browser-extension lint` — pass.
- `pnpm --filter @workmap/browser-extension test` — pass, `65/65`.
- `pnpm --filter @workmap/browser-extension build` — pass.
- `pnpm --filter @workmap/browser-extension release:zip` — pass with explicit artifact confirmation.
- `pnpm --filter @workmap/api typecheck` / `lint` / `build` — pass.
- `pnpm --filter @workmap/api test` — pass, `55/55`.
- `pnpm --filter @workmap/web typecheck` / `lint` / `build` — pass.
- `pnpm --filter @workmap/web test` — pass, `88/88`.
- `pnpm --filter @workmap/shared-types typecheck` / `build` — pass.
- `pnpm prisma:generate` — pass.
- `git diff --check` — pass.
- Scoped secret scan excluding `.env*`, `node_modules`, `dist`, `.next`, `alpha-unpacked`, `artifacts`, `*.tsbuildinfo`, generated and reference directories — no finding.
- ZIP inspection — package/manifest `0.5.8`, 22 entries, 48,842 bytes, SHA-256 `B739FB3AB5CA916FA3F3270752F1B0D5AE471FB9AEC45B8A51C65266BCF1E9F2`.

### Covered Executable Scenarios

- Same-host tabs de-duplicate; different hosts run in parallel; worker restart closes only through the durable observation; runtime cannot start without its separate lease flag; policy closure projects exactly to the authorised UTC boundary.
- One Focus hostname across windows/displays; same-host tab identity; Split View trusted peer; `WINDOW_ID_NONE`; minimize; idle/lock; protected/excluded/incognito pages; trusted/untrusted/background/iframe evidence; SPA and cross-host navigation; reload/replace/remove; host permission/registration recovery.
- Queue identity/backoff/capacity, encrypted credentials, lifecycle gaps/clock jumps/no-backfill, snapshot rejection separate from health, accepted/duplicate/rejected evidence, policy/ack/lease/window gates, and service-worker persistence.
- API accepts Browser Domain Focus/runtime into the ledger, rejects disabled runtime, persists inferred interruption/recovery, unions Chrome/Edge same-host Focus/runtime overlap, and preserves status idempotency.
- Web displays separate App/Domain runtime policy and metrics, confirmed versus inferred Browser audit events, current stale heartbeat interruption, and de-duplicated coverage/live interruption.

### Manual QA Status And Required Matrix

- Real Chrome load-unpacked: **NOT RUN**.
- Real Edge load-unpacked: **NOT RUN**.
- Not yet manually verified: upgrade in place while retaining pairing/IndexedDB; website access grant/revoke/regrant; single/dual windows and dual displays; same/different-host multi-tab; supported Split View; address bar/DevTools/internal/PDF pages; minimize/restore; lock/unlock; sleep/wake; offline/reconnect; browser restart; Extension reload/disable/enable; policy version enablement and employee re-acknowledgement; `/reports` live Domain, Connection Audit and historical Focus/open-runtime totals.
- Browser close/disable/crash/sleep cannot be labelled with an exact cause or occurrence time by MV3. Manual QA should require a current inferred interruption at confirmed-heartbeat + 90 seconds and a persisted inferred gap/recovery after reconnect, not a fabricated “closed,” “disabled,” or “sleeping” row.
- Open/runtime QA must prove: three same-host tabs equal one wall-clock range; different hosts can accumulate in parallel; minimize/background/ordinary idle retain open context; lock and last-tab close stop it; disabled/unacknowledged/outside-window/expired lease rejects or pauses it; Chrome/Edge same-host overlap is not doubled in Reports.

### Recommendation

- Automated QA: **PASS**.
- Production/store release: **HOLD** until migration/API/Web are deployed in order and real Chrome + Edge load-unpacked QA passes.
- The next round may proceed to controlled manual QA. Do not auto-publish or enable the runtime policy before the server contract is deployed.

## 2026-07-23 Desktop Agent Connection Audit Semantics QA

### Reviewed Implementation

- Reviewed Desktop Agent `0.6.8` Electron lock/unlock/suspend/resume hooks, Tracking v2 lifecycle production and durable status queue, API status persistence and duplicate suppression, Reports range query/coalescing, and Owner Web audit rendering.
- No product implementation was modified.

### Findings Ordered By Severity

- Confirmed - Medium: the Connection Audit is a historical transition list, not the source of current online/offline state. The supplied `Locked` then `Reconnected` rows accurately represent Windows System Lock and System Unlock, while current connection must be read from Live signals.
- Confirmed - Medium: the v2 timeline is incomplete. Web renders only six supplemental status values, while v2 normal start, user stop, shutdown, crash, termination, and unknown-interruption status records can be omitted because v2 does not create the legacy session rows used by the other branch.
- Confirmed - Low: `Reconnected` represents both resume and unlock; the displayed reason disambiguates them. Delayed status delivery over 30 seconds is labeled with the later server sync time.
- Confirmed - Low: repeated identical status/reason transitions are coalesced, results are limited to 500, and timestamps are displayed from client occurrence time in the viewer's browser locale.
- Separate scope: Browser Extension connection audit remains incomplete and `0 events` is not proof that no Browser interruption occurred.

### Test, Manual QA, Risk, And Recommendation

- Source/diff review: pass for the screenshot interpretation.
- `git diff --check`: pass. Scoped secret scan: pass.
- Automated product tests were not rerun because this round changed documentation only. Real Windows lifecycle QA was not run; the supplied screenshot provides manual evidence for the lock/unlock pair.
- Pass for explaining the current behavior. Do not call the full v2 Start/Stop/Interruption audit complete. A future narrow API/Web correction should render all stored v2 lifecycle events and cover start, quit, lock/unlock, sleep/resume, crash/unknown, dedupe, delayed sync, and live-state independence.

## 2026-07-23 Browser Extension 0.5.7 Cross-Epoch Focus Reliability QA

### Reviewed Implementation

- Reviewed the state-v7 migration, atomic queue/watermark write, occurrence-time epoch construction, policy-window/activation clamps, request-start clock calibration, network/mutation-lane separation, sync coalescing, pairing-generation guard, stale snapshot-response guard, compiled unpacked output, and ZIP.
- Diff review found no Desktop Agent, API/shared, Web, schema, credential, RBAC, or privacy-boundary change.

### Findings Ordered By Severity

- Fixed - High: a new Browser Focus epoch could start before a prior emitted epoch ended after slow sync or a changed server offset. The durable cross-epoch watermark now enforces half-open adjacency or a conservative gap.
- Fixed - High: HTTP wait blocked later Chrome events in the global mutation lane. Network wait is outside that lane; only durable request preparation and response merge remain serialized.
- Fixed - High: an in-flight response could become stale once events are processed concurrently. Pairing-generation/device/client identity guards discard obsolete responses, and snapshot acceptance/rejection applies only to the exact sent epoch/sequence still current.
- Fixed - Medium: clear/page replacement paths could issue duplicate immediate requests. Requests are coalesced and replacement state can share one upload.
- Preserved - High: intervals remain durable before sync; a future legacy watermark pauses rather than overlaps; old terminal tombstones remain excluded from Reports.
- Remaining - Medium: real Chrome/Edge MV3 scheduling, service-worker recycling, and deployed API latency have not been exercised with 0.5.7. Automated tests are not production acceptance.
- Remaining - Separate scope: Browser connection audit still lacks a full Browser status-history producer/API query and is not fabricated in this patch.

### Test And Verification Status

- `pnpm.cmd --filter @workmap/browser-extension typecheck`: pass.
- `pnpm.cmd --filter @workmap/browser-extension lint`: pass.
- `pnpm.cmd --filter @workmap/browser-extension test`: pass `61/61`.
- `pnpm.cmd --filter @workmap/browser-extension build`: pass.
- `pnpm.cmd --filter @workmap/browser-extension release:zip`: pass.
- ZIP root/content, compiled reliability markers, manifest version, size, and SHA-256: pass.

### Manual QA Status, Risk, And Recommendation

- Chrome and Edge 0.5.7 reload/upgrade retention, permission cycles, multi-window/display, Split View, minimize/lock/sleep, offline/reconnect, restart/reload/disable-enable, and live `/reports` checks are **NOT RUN**.
- Pass for source-level correction and local alpha artifact. Proceed to real Chrome and Edge load-unpacked QA; do not publish or call the defect closed in production until a latency/tab-switch run produces accepted/duplicate intervals with no new `FOCUS_OVERLAP`.
- Desktop Agent was not changed. The next round can proceed with manual Browser QA and then a screenshot/log review.

## 2026-07-23 Browser Extension 0.5.6 Focus-Overlap Diagnosis QA

### Reviewed Implementation

- Reviewed the supplied `/reports`, Edge Options, Chrome Options, and Edge `FOCUS_OVERLAP` evidence against Browser MV3 event serialization, content-message occurrence mapping, epoch construction, durable state, sync correlation, API overlap/tombstone rules, reconciliation, live presentation, and connection-audit sources.
- No runtime fix was made in this round; this is a source-backed defect diagnosis and repair recommendation.

### Findings Ordered By Severity

- Confirmed - High: Edge emitted a Focus interval whose wall-clock range overlapped an earlier accepted Focus interval from the same Edge device/stream. The API correctly rejected it as terminal `FOCUS_OVERLAP`; Reports excludes it, so totals are safe but that slice is undercounted.
- Confirmed - High: the Browser runtime has no cross-epoch local Focus high-water mark. Processing-time epoch anchoring, delayed occurrence timestamps, a mutable server offset, and network work on the serialized event lane can produce a cross-epoch regression that engine-local tests cannot detect.
- Confirmed - Medium: `clearFocus(true)` can schedule the same immediate sync twice, and a page transition can add a third sync. This increases event latency and the overlap risk; it does not by itself invalidate the durable queue.
- Confirmed - Medium: Browser connection audit is not implemented end to end. Current live heartbeat coverage works, but API device-status history is Desktop-only and Browser v2 emits no corresponding historical transition stream.
- Verified - High: accepted Browser Focus Active/Idle rows enter the official ledger and Domain Reports. Rejected tombstones do not enter totals. Chrome/Edge accepted overlap is unioned for the same user/domain/metric.
- Verified - Medium: Edge recovered after the rejection and accepted later intervals; Chrome's stale snapshot is independent from its online connection. Neither screenshot indicates a stuck credential, policy, permission, registration, or health lane.

### Test And Verification Status

- `pnpm.cmd --filter @workmap/browser-extension typecheck`: pass.
- `pnpm.cmd --filter @workmap/browser-extension lint`: pass.
- `pnpm.cmd --filter @workmap/browser-extension test`: pass `56/56`; current suite lacks the cross-epoch slow-sync scenario.
- `tsx --test test/tracking-v2-reconciliation.test.ts test/tracking-v2-live-semantics.test.ts`: pass `16/16`.
- Direct two-epoch reproduction: each interval individually valid, but `[00:00:00, 00:00:10]` and `[00:00:09, 00:00:11]` overlap, confirming the missing cross-epoch invariant.

### Manual QA Status, Risk, And Recommendation

- The screenshots are valid manual evidence of Chrome/Edge 0.5.6 heartbeats, accepted Browser intervals, Edge recovery, and confirmed Domain totals. They are not a full lifecycle matrix.
- Fail final 0.5.6 reliability acceptance because one real terminal Focus rejection proves possible data loss. Pass the backend safety behavior because the rejected interval is clearly diagnosed and excluded.
- Proceed to a Browser-only 0.5.7 source/test/artifact round. Keep the old tombstone as historical evidence; fixing the generator must not delete or relabel it. Browser connection audit should be scoped explicitly as a separate API/Web-capable addition.
- Desktop Agent was not changed and must remain out of the repair unless the user separately authorizes behavior changes.

## 2026-07-23 Reports Current Browser Connection Selection QA

### Reviewed Implementation

- Compared the supplied Chrome 0.5.6 Options diagnostics with `/reports` live cards and confirmed Domain summary.
- Reviewed the current Web live presentation, API live-device fields/coverage semantics, Browser 30-second alarm and 10-second request timeout, and existing Reports tests.

### Findings Ordered By Severity

- Verified - High: the 0.5.6 core Domain pipeline is operational in the supplied run. Heartbeat/sync is server-confirmed, snapshot confirmation exists, one Focus interval is accepted, confirmed-through advances, queue/dead-letter is clear, and the confirmed Domain ledger is visible in `/reports`.
- Remaining - Medium: one screenshot shows a heartbeat older than 90 seconds before a later successful sync/healthy collector. It recovered and did not lose the accepted interval, but a longer Chrome/Edge lifecycle run is still needed before treating heartbeat continuity as fully accepted.
- Fixed - Medium: inactive historical Chrome pairing identities crowded Live signals and made an active 0.5.6 connection look broken. Fresh same-browser devices now take presentation priority and old inactive cards no longer affect visible coverage or live dead-letter attention.
- Preserved - High: if no fresh instance exists for a browser, the newest interrupted card remains visible. The UI does not claim success or hide a real all-offline condition.
- Verified - Low: old device/history rows are presentation-filtered only; no API/database records or rejection evidence were deleted.

### Test And Verification Status

- Web typecheck: pass.
- Web lint: pass.
- Web automated tests: pass `84/84`, including two behavioral Browser-device-selection regressions.
- Web production build: pass. Non-blocking existing warnings remain for webpack cache snapshotting and Next.js ESLint-plugin detection.
- Final diff/secret checks recorded after documentation update.

### Manual QA Status And Recommendation

- User-supplied Chrome 0.5.6 screenshots prove the pre-Web-change data path. Post-change `/reports` rendering and all Edge checks are **NOT RUN**.
- Pass for merge/deploy consideration after final static checks. After deployment, verify obsolete Browser cards are hidden while 0.5.6 is fresh and the newest interrupted card returns after every Chrome instance is stale.
- Do not automatically revoke/delete historical devices in this UI change. Device cleanup remains a separate authorized administration action.
- No Desktop Agent change, Browser artifact rebuild, browser-store publication, GitHub Release, API deployment, or production deployment occurred.

## 2026-07-22 Browser Extension 0.5.6 Health/Collector Separation QA

### Reviewed Implementation

- Compared the real 0.5.5 Options and `/reports` screenshots with Browser alarm, service-worker, sync, local diagnostic, API Reports freshness, and content-script paths.
- Checked current official Chrome alarm/service-worker/scripting documentation. Chrome allows arbitrary alarm delay beyond the requested period and recommends recreating important alarms at worker startup; current WorkMap registers listeners synchronously and recreates its named alarm during each worker initialization.

### Findings Ordered By Severity

- Fixed - High: Options used 30 seconds while Reports used 90 seconds, creating false local Offline state during allowed Chrome alarm jitter.
- Fixed - High: collector presentation defaulted missing snapshot state to `PAUSED`; it now uses separately persisted current collector state.
- Fixed - High: Focus/window/tab reconciliation failure could prevent the same alarm cycle from sending health. Health now runs independently and the collector failure becomes bounded `FOCUS_RECONCILE_RETRY` evidence.
- Fixed - Medium: periodic Options refresh overwrote editable pairing/exclusion inputs; only diagnostics now refresh periodically.
- Verified - Medium: 0.5.5 completed activation and at least one real heartbeat. Multiple live cards are distinct paired device IDs/versions; stale historical devices were not merged into the new client.
- Remaining - High: no screenshot proves a normal eligible page snapshot or accepted/duplicate Domain interval. `NONE` while Options is focused is expected, but Chrome/Edge end-to-end Focus acceptance remains open.

### Test And Verification Status

- Typecheck pass; lint pass; automated tests `56/56` pass.
- Build and `release:zip` pass.
- ZIP manifest/version, entry count, compiled 90-second boundary, compiled heartbeat isolation, diagnostic code, size, and SHA-256 inspected successfully.
- Final diff and scoped secret checks are recorded after documentation update.
- No API/shared/Web package checks were required because their code/contracts were not changed.

### Manual QA Status

- **NOT RUN** for Chrome/Edge 0.5.6 reload, three-minute heartbeat continuity, normal-page snapshot, Focus Active/Idle ledger acceptance, multi-window/display, protected pages, minimize/lock/sleep, offline/reconnect, restart, disable/enable, or `/reports` Domain totals.
- Direct Codex Chrome inspection was unavailable because the separate ChatGPT Chrome-control extension/native-host integration is not installed in the selected profile. This is unrelated to the WorkMap extension; supplied screenshots were still reviewed as real evidence.

### Risks And Pass/Fail Recommendation

- Pass for source, automated diagnostics, heartbeat/collector separation, and local artifact generation.
- Do not call Domain tracking operationally accepted until real 0.5.6 manual QA shows repeated heartbeat plus confirmed snapshot and accepted/duplicate interval evidence.
- Old paired Browser devices remain visible until an authorized device-management action revokes them; no automatic deletion was introduced.
- No store publication, GitHub Release, API/Web deployment, or production deployment was performed.

## 2026-07-22 Browser Extension 0.5.5 Pairing Initialization QA

### Reviewed Implementation

- Reviewed the supplied 0.5.4 Options and `/reports` evidence against current pairing, IndexedDB reset, background initialization, alarm recovery, diagnostics, versioned build output, and tests.
- Reviewed only Browser Extension and handoff changes. Desktop Agent, API, shared contracts, Web Reports, schema, deployment, and production data were not changed.

### Findings Ordered By Severity

- Fixed - Critical: pairing could permanently stop before the first heartbeat because background `deleteDatabase()` was blocked by the Options page's open Tracking v2 IndexedDB connection.
- Fixed - High: Options treated the pairing message as fire-and-forget and immediately rendered an empty durable status, so it could not distinguish completed initialization from a lost/failed worker reset.
- Fixed - High: the 30-second alarm did not recover when the worker had first initialized before durable pairing existed. It now detects saved pairing/config drift and initializes from the durable credential/config.
- Verified - Medium: the screenshot's stale Reports card is client version 0.5.3 and the 0.5.4 Options device has a different device ID. Empty Domains and zero Browser audit events are downstream symptoms of no accepted 0.5.4 sync, not evidence that Reports counted rejected data.
- Remaining - High: real Chrome/Edge 0.5.5 end-to-end acceptance has not run, so server heartbeat, snapshot acceptance, interval acceptance, Domain totals, lifecycle behavior, and upgrade retention are not yet manually proven.

### Test And Verification Status

- Browser Extension typecheck: pass.
- Browser Extension lint: pass.
- Browser Extension automated tests: pass `52/52`.
- Browser Extension build and `release:zip`: pass.
- Artifact manifest/version, 18 ZIP entries, compiled transactional reset, compiled pairing acknowledgement, size, and SHA-256: pass.
- No API/shared/Web package checks were required because this round changes no API contract, persistence rule, Reports rendering, or shared type.

### Manual QA Status

- **NOT RUN** for Chrome and Edge 0.5.5 load-unpacked/reload, pairing retention, permission grant/revoke/regrant, multi-window/display, Split View, minimize, lock/sleep, offline/reconnect, browser restart, extension reload/disable/enable, or `/reports` live/history acceptance.
- The user screenshots are valid 0.5.4 pre-fix reproduction evidence only.

### Risks And Pass/Fail Recommendation

- Pass for the source-level pairing deadlock fix, automated regression, and local 0.5.5 artifact.
- Do not call the release operationally accepted until a same-path Chrome reload shows a fresh 0.5.5 server-confirmed heartbeat and an accepted/duplicate Domain interval in `/reports`.
- Old 0.5.3 stale devices and tombstones are intentionally preserved and may remain visible until an authorized admin revokes or otherwise manages that device.
- No browser-store publication, GitHub Release, API deployment, or production deployment was performed.

## 2026-07-22 Browser Extension 0.5.4 Monotonic Millisecond QA

### Reviewed Implementation And Findings

- Reviewed the 0.5.3 Chrome Options diagnostics, the separate Browser live card/audit/Domain Reports screenshots, Browser Focus engine, durable queue/recovery path, shared validator, API ledger conversion, tombstone/report semantics, tests, unpacked output, and ZIP.
- Fixed - Critical: fractional real-browser monotonic boundaries could either produce terminal `INVALID_DURATION` or pass validation with an integer duration and crash API `BigInt` conversion as retryable `TRACKING_SYNC_INTERNAL`.
- Fixed - High: 0.5.4 emits whole-millisecond bounds/durations, including after restoring a fractional 0.5.3 checkpoint; rapid sub-millisecond events produce no zero/negative/overlapping row.
- Fixed - High, server defense: old fractional bounds are rejected as terminal `MONOTONIC_MISMATCH`, retain request ID in a tombstone, and never enter the official ledger/Reports.
- Verified presentation: connection health, current snapshot confirmation, and historical interval disposition are separate. `2/2 connected` plus `Current activity not confirmed` and an `INVALID_DURATION` warning is consistent with a fresh heartbeat and an unconfirmed/rejected activity lane; empty Domains is correct with zero accepted/duplicate Browser intervals.
- Preserved: pairing/identity, policy/lease/acknowledgement/schedule, hostname-only privacy, Focus/Idle semantics, queue identity, tenant/RBAC, and disabled Browser open/runtime.

### Test And Verification Status

- Browser: typecheck/lint/build/release ZIP pass; tests `51/51` pass.
- Shared types: typecheck/lint/build pass; tests `23/23` pass.
- API: typecheck/lint/build pass; focused Tracking v2 live semantics `12/12` pass.
- Full API: `49/50`; only the unchanged fixed-date `tracking-reports-verification.test.ts` fails because its 2026-06-17 legacy event is too old on 2026-07-22.
- ZIP inspection: version `0.5.4`, 18 entries, `40,742` bytes, SHA-256 `BE555797A4B7DF66925299D004B7BE45BF0619756E8C16168A0E57C1456C9EAC`.

### Manual QA, Risks, And Recommendation

- Chrome/Edge 0.5.4 real-device QA was not run: **未手测**.
- API/shared validation must be deployed before judging old queued 0.5.3 records; Extension-only reload prevents new fractional records but cannot safely rewrite stable queued event identities.
- The six existing `INVALID_DURATION` dead letters will remain. One or more old pending rows may become new `MONOTONIC_MISMATCH` dead letters during safe drain; success is that retrying 500 stops and later 0.5.4 intervals are accepted/duplicated.
- Pass for root-cause isolation, implementation, automated checks, and local artifact. Proceed to controlled API deployment plus same-path Chrome/Edge 0.5.4 load-unpacked acceptance; do not publish externally yet.

## 2026-07-22 Browser Extension 0.5.3 Standalone Pairing QA

### Reviewed Implementation And Findings

- Reviewed the 0.5.2 Edge Options and `/reports` screenshots, Web pairing request, API pairing mode/status/policy/sync identity rules, Browser activation/diagnostics path, Reports activation filter, tests, unpacked output, and ZIP.
- Fixed - Critical: normal Browser pairing legitimately produces `workstationId=null`, but 0.5.2 rejected it locally before v2 activation, leaving the Extension permanently paired-but-offline and absent from Tracking v2 Reports.
- Fixed - High: that local semantic failure was misclassified as retryable `NETWORK_ERROR`; the reproduction accumulated 123 false retries. True mismatch is now terminal `DEVICE_IDENTITY_MISMATCH`/`AUTH_REQUIRED`.
- Preserved - Security: scoped credential, tenant/user/device, client type, browser identity, revocation, policy/lease, acknowledgement, UTC windows, source/stream validation, and hostname-only privacy remain enforced.
- Preserved - Reporting: the patch only reaches the existing server path; it does not fabricate connection, snapshot, interval, audit, or Domain totals.

### Test And Verification Status

- Browser typecheck/lint/build/release ZIP: pass.
- Browser tests: pass `48/48`.
- Focused API pairing/policy tests: pass `8/8` from the API working directory. The first raw-root invocation lacked decorator tsconfig and failed before assertions.
- ZIP inspection: pass; version `0.5.3`, 40,433 bytes, SHA-256 `0B3171146F394A6AECFE94B4F477E868BC75A28601F8668061FA841F9FD729AE`.

### Manual QA And Recommendation

- Post-fix Chrome/Edge QA was not run; screenshots prove only the original 0.5.2 failure.
- Required acceptance: retained pairing after reload, first heartbeat, policy/lease activation, current Domain confirmation, accepted/duplicate/rejected interval evidence, `/reports` Browser card/audit/Domain totals, permission revoke/regrant, restart, and offline recovery.
- Pass for root-cause isolation, source correction, tests, build, and local Alpha artifact. Proceed to Edge 0.5.3 real-device QA before any live-success or publication claim.

## 2026-07-22 Desktop Agent 0.6.8 Boundary Precision QA

### Reviewed Implementation And Diff Summary

- Reviewed the complete Desktop-only diff for runtime mutation ordering, stream clock selection, persisted watermark compatibility, policy/lease cutoff behavior, snapshot half-open semantics, version metadata, tests, Alpha output, and NSIS output.
- No API, Web, Prisma, server policy, tenant/RBAC, or privacy collection source changed. Unrelated Browser Extension modifications present in the shared worktree were not touched.

### Findings Ordered By Severity

- Pass: Electron power callbacks can no longer mutate Focus/runtime outside the native/tick mutation lane. A deterministic regression test proves the Electron boundary waits for an existing native mutation.
- Pass: delayed pre-lease observations remain outside the lease; Focus and runtime use independent clocks; old events below the stream watermark are ignored; and watermarks do not regress across epochs.
- Pass: Focus and runtime intervals seal exactly at the authorised cutoff. The legal cutoff interval is retained, while the cutoff live snapshot is not uploaded outside the half-open window.
- Pass: 0.6.7 persisted runtime state upgrades without a database migration and initializes the two additive watermarks safely.
- Pass: focused API tests confirm valid Focus Active/Idle enter the official ledger and Reports, different Apps may accrue open/runtime concurrently, and same-App runtime overlap remains rejected.
- Medium residual risk: the real Windows native/Electron event ordering and installer upgrade have automated coverage but have not been reproduced manually on the user's device. Slow HTTP can still delay live presentation because sync I/O was intentionally not refactored in this precision round.
- Existing/unrelated: the full API suite remains `48/49` because a fixed-date legacy fixture is now outside the service age limit. Focused current Tracking v2 tests pass `15/15`.

### Test And Verification Status

- Desktop Agent: test `67/67`, typecheck pass, lint pass, build pass.
- Focused API Tracking v2/Reports: `15/15` pass.
- NSIS installer generated successfully: `WorkMap-Desktop-Agent-Setup-0.6.8.exe`, SHA-256 `3FEA611B0ED0F2AE57AB7DBC0B4657570C3B0E4214E1446EAEB0F12337A379E2`.
- `git diff --check` passed for the shared worktree. Scoped Desktop/docs secret scan returned no findings.

### Manual QA And Recommendation

- Real-device QA was not run. Required acceptance: in-place upgrade from 0.6.7, credential retention, normal App switching, lock/unlock, suspend/resume, offline recovery, policy lease refresh, and an actual configured schedule cutoff.
- Pass for code integration and producing a controlled-test 0.6.8 installer. Proceed to real-device acceptance before publishing broadly; do not delete the existing 56 historical rejected rows, because stability rather than disappearance is the success signal.

## 2026-07-22 Desktop Agent 0.6.7 Real-Device QA Diagnosis

### Reviewed Implementation

- Reviewed the July 22 Reports/Agent screenshots, current 0.6.7 runtime lifecycle and clock paths, local Agent status, safe NDJSON sync metadata, SQLite queue/dead-letter rows, Tracking v2 server overlap predicate, and existing Desktop tests.

### Findings Ordered By Severity

- High: 0.6.7 still creates Focus overlap at a real lock/suspend/resume boundary. Two new July 22 rows totaling 40.172 seconds were terminally rejected and are absent from Reports.
- High: native boundary events are serialized through `eventChain`, but Electron power-status boundaries mutate the same engines outside that lane. Host-event processing also awaits HTTP sync, and the observed event lane accumulated over two minutes of delay. Existing tests cover a transient null foreground identity only, not concurrent native/Electron power boundaries.
- Medium: the active policy shown by the Agent is 09:00–21:33, not the previously requested 09:00–23:00. It was valid during the noon defect, so it is not the cause of these overlap rows.
- Verified: connection health, current snapshot, and recent accepted history are healthy. Reports confirmed through 13:46:41 and the latest upload reported 12 accepted / 0 rejected; the whole morning was not lost.
- Verified: the later `13 pending` display was transient settlement batching rather than a stuck queue. Read-only samples observed fresh zero-attempt rows being replaced after acknowledgement and then zero pending; NDJSON recorded the 12-row batch as HTTP 200 confirmed while dead letters stayed at 56.
- High: the 0.6.7 comparison window added 23 terminal rows: `FOCUS_OVERLAP +7`, `POLICY_REJECTED +11`, `RUNTIME_OVERLAP +5`, and `HTTP_400 +0`. SQLite and NDJSON group them into four incidents at lease activation, an event-backlog/epoch boundary, policy-window closure, and lock/suspend. This is not normal healthy-client behavior even though the server correctly rejected every invalid slice.
- High: current-lease runtime rows began 1.155 seconds before that lease was issued, policy-end rows extended about ten seconds beyond the 21:33 cutoff, and Focus/runtime overlap occurred around 17:57 without a retained local lifecycle diagnostic. Because lifecycle events are not comprehensively diagnostic-logged, absence of that diagnostic does not prove ordinary foreground use. A robust fix must cover lease/window clamping, stream-specific clocks, monotonic UTC watermarks, and event-lane backlog in addition to power-boundary serialization.
- Quantified: the inspected log window returned 8,444 interval results, of which 8,421 were accepted-or-duplicate and 23 rejected (0.272%). The main 0.6.7 pipeline is therefore materially healthy, but its boundary correctness is incomplete.
- Verified: `2h48m` Focus Active is internally consistent with the per-App Focus cards and plausible for the reported awake/input periods. Open/runtime is concurrent per App and is not an additive work-hours total; lock/sleep time correctly does not become focused idle.
- Low: brief 10:35 and 13:35 network errors recovered automatically and are not the cause of a continuing disconnect.

### Test And Verification Status

- Read-only local inspection completed. The two new dead letters were recovered as Weixin 6,516 ms and WeChatAppEx x64 33,656 ms, both at the 12:34 lifecycle boundary.
- `pnpm --filter @workmap/desktop-agent test` passed 61/61 and `pnpm --filter @workmap/desktop-agent typecheck` passed as an unchanged-code baseline.
- Lint/build were not run because no product code changed in this diagnosis-only round.
- Temporary read-only inspection code was removed. No secrets or prohibited private content were added to the repository.

### Manual QA Status And Recommendation

- User-provided real Windows evidence demonstrates the remaining defect; no additional controlled lock/suspend test was run.
- Fail for the claim that 0.6.7 fully eliminates Focus overlap. Pass for current connection/sync health and for the majority of July 22 history.
- Proceed to a narrowly scoped Desktop Agent lifecycle serialization, per-stream clock/watermark, and exact policy-boundary fix with regression tests before issuing another Agent build. The API overlap/policy enforcement and Reports warning should remain unchanged; do not delete old dead letters or hide the warning as the fix.

## 2026-07-21 Browser Extension 0.5.2 Reliability QA

### Reviewed Implementation

- Reviewed the complete Browser-only diff: MV3 event ownership, hostname eligibility, all-frame privacy messages, Focus engine/checkpoint recovery, IndexedDB queue/dead letters, policy/lease windows, request correlation, snapshot/interval result handling, Options diagnostics, API tombstones, Reports aggregation/presentation, Prisma migration, tests, unpacked output, and ZIP.
- Confirmed no Desktop Agent file changed and existing Web-auth work was not reverted.

### Findings Ordered By Severity

- Fixed - Critical: a healthy sync could be presented as disconnected when only snapshot/policy state was paused or rejected. Connection now derives only from the latest server-confirmed heartbeat; snapshot and interval lanes remain independent.
- Fixed - Critical: an active tab in a background/minimized window or an inaccessible page could be mistaken for real page focus. Focus now requires the OS-focused usable browser window and fresh page proof; only one hostname owns Focus.
- Fixed - High: terminal HTTP 200 interval rejection deleted the queue row while losing its code/request history. It now creates bounded local dead-letter evidence and an API tombstone with request ID; Reports excludes it from totals and exposes the safe reason.
- Fixed - High: trusted page evidence included pointer/touch movement and selection changes. Only explicitly allowed trusted event occurrences/times remain; content, values, targets, coordinates, directions, distances, titles, and full URLs are absent.
- Verified - High: Browser Domain Focus active and Focused idle are accepted into the formal ledger and returned by Domain Reports. Chrome/Edge overlapping confirmed ranges for the same user/hostname/metric are unioned.
- Verified - High: minimization, `WINDOW_ID_NONE`, idle/lock, background windows, hidden/ineligible pages, navigation, removal/replacement, policy pause, lifecycle gaps, restart checkpoints, and clock jumps close at a trustworthy boundary without negative/overlapping time.
- Deferred - High: Browser Domain open/runtime remains disabled because the repository has no separate Browser policy/schema/acknowledgement contract. The Desktop-only flag was not broadened.
- Remaining - High: real Chrome/Edge runtime and staging database/API/Reports QA are not complete; automated simulation cannot prove all browser/version/OS behavior.

### Test And Verification Status

- Browser Extension typecheck/lint/build/release pass; automated tests `46/46` pass.
- Focused API tests `15/15` and focused Web Reports tests `7/7` pass; API/Web typecheck, lint, and build pass; Prisma schema validates.
- Full API suite `48/49`: unrelated aging fixture failure in `tracking-reports-verification.test.ts`.
- Full Web suite `79/82`: three pre-existing brittle `reports-information-order.test.ts` assertions fail; affected behavior tests pass.
- `git diff --check`, changed-file secret scan, manifest/version check, ZIP entry review, size check, and SHA-256 check pass.

### Manual QA Status

- Not run. No real Chrome or Edge load-unpacked session, pairing upgrade, permission transition, multi-display/window, Split View, minimize/lock/sleep, offline/restart, extension lifecycle, or `/reports` end-to-end session was executed.

### Risks And Release Recommendation

- Database migration must precede API deployment. Older tombstones have null request IDs by design.
- Unsupported Split View versions stay conservative and expose a coverage limitation; they do not claim both panes are active.
- Store/add-on publication and production deployment were not authorized and were not performed.
- Pass for source, privacy, automated ledger/Reports behavior, build, and local artifact generation. Proceed to staging migration and real Chrome/Edge manual QA; do not call this production accepted until those checks pass.

## 2026-07-21 Browser Extension Dedicated-Thread Handoff Review

### Reviewed Implementation

- Read the current MV3 `0.5.1` Browser Extension runtime, focus engine, durable store, credential vault, content script/registration, policy/sync API, Options UI, package tests, shared Tracking v2 contract, Browser-specific API policy/sync/report paths, and Web Reports rendering.

### Findings Ordered By Severity

- High: the Browser Extension already has a substantial v2 foundation and should be evolved in place; a rewrite or reuse of Desktop native-window code would violate the MV3/browser framework.
- High: Browser-local sync response types and diagnostics lag the current server/Desktop contract. Snapshot rejection and interval rejection reasons can be lost behind HTTP 200 and aggregate dead-letter counts.
- High: production-quality browser behavior still needs runtime-level evidence for multiple windows/displays, split view, minimized/background state, lock/sleep, service-worker eviction/restart, permission change, and Chrome/Edge coexistence.
- Medium: Domain open/runtime is disabled in Browser v2 by current policy. Enabling it safely requires an explicit Browser policy and Reports contract; it must not reuse the Desktop flag silently or treat an open tab as proof of active work.
- Verified: the privacy boundary is hostname plus timestamps/state only, and existing source does not collect page content, full URLs, titles, input values, or other prohibited private data.

### Test And Manual QA Status

- No commands were run and no browser was opened in this prompt-generation round.
- This is a source-grounded handoff review, not an implementation pass or production acceptance.

### Pass/Fail Recommendation

- Pass for handing Browser Extension ownership to a separate dedicated Codex conversation using the copy-ready prompt.
- Do not claim Browser Extension completion until that conversation implements the scoped changes, passes affected package/API/Web verification, builds a versioned artifact, and records honest Chrome/Edge manual-QA status.

## 2026-07-21 Cognito Idle Session Recovery QA

### Reviewed Implementation

- Reviewed the browser Cognito session store, Hosted UI refresh response handling, Amplify fallback, protected-route guards, API request authentication, post-login tenant mapping, return routing, and the complete current Web auth diff.

### Findings Ordered By Severity

- Fixed - Critical: any temporary refresh exception cleared the Cognito session and converted a recoverable idle token expiry into an apparent logout. Retryable provider/network failures now preserve the stored session; only explicit terminal authentication failures clear it.
- Fixed - High: Cognito API `401` responses did not force-refresh and replay the original request. The client now performs exactly one refreshed retry.
- Fixed - High: the first `/auth/me` mapping after login did not opt into Cognito refresh behavior. Login and callback mapping now use `authSource: "cognito"`.
- Fixed - Medium: missing sessions redirected to `/`, losing the user's destination and contributing to the observed login-loop experience. They now go to `/login?next=...`, and only validated internal protected paths are restored after sign-in.
- Verified - High: the change does not weaken Cognito validation, tenant/RBAC mapping, Owner/Employee/Platform Admin separation, or invalidate-on-terminal-failure behavior.
- Remaining - Medium: no deployed browser or real long-idle Cognito manual test was run, so production resolution still requires deployment and real-session confirmation.

### Test And Verification Status

- Focused Cognito refresh and redirect tests: pass, `7/7`.
- Web typecheck: pass.
- Web lint: pass.
- Web build: pass in approximately 65 seconds.
- Full Web suite: `77/81`; authentication coverage passes and the four failures are unchanged pre-existing Reports source/render assertions unrelated to this diff.
- `git diff --check`: pass after the final documentation update.
- Changed-file high-confidence secret scan: pass, zero matches.

### Manual QA Status

- Not run. No authenticated deployed session, access-token-expiry wait, temporary network interruption, invalid-refresh-token flow, or post-login return-route flow was exercised in a real browser.

### Risks And Deployment Order

- Web-only deployment is required. No database migration, API rollout, policy change, or Desktop Agent release is required for this fix.
- During a prolonged Cognito/API outage the session is retained, but individual API-backed screens may show their existing temporary failure state until a later action retries successfully.
- Production acceptance requires testing both recoverable failure and genuine invalid-session behavior; retaining a terminally invalid credential would be a regression, while clearing on a transient error would recreate the original issue.

### Pass/Fail Recommendation

- Pass for source correctness and automated auth recovery behavior.
- Proceed to commit/push and Web deployment after final diff/secret review.
- Do not call the production incident closed until a real idle authenticated browser remains signed in and a deliberately invalid session still returns safely through `/login?next=...`.

## 2026-07-21 Desktop Agent 0.6.7 Focus/Idle/Open-runtime QA

### Reviewed Implementation

- Independently reviewed the 0.6.6 Windows event lane, monotonic-to-UTC projection, Focus engine lifecycle, SQLite interval queue, HTTP 200 sync response handling, native Windows privacy boundary, policy/lease/acknowledgement flow, API overlap validation, ledger/report aggregation, Compliance UI, and the complete current diff.

### Findings Ordered By Severity

- Fixed - Critical: delayed native foreground events could be re-anchored to processing time after an awaited HTTP request, and a transient null foreground identity reset the Focus epoch. Together these created client-generated UTC overlaps and terminal `FOCUS_OVERLAP` dead letters. Events now retain their delivery-time monotonic offset and transient gaps remain on one Focus clock lane.
- Fixed - High: HTTP 200 interval rejections were omitted from Agent recent diagnostics/NDJSON even as SQLite rejected counts increased. New responses now preserve exact safe rejection codes/counts, request ID, interval stage, terminal/retry status, and remediation. Server logs receive only privacy-safe aggregates.
- Verified - High: Focused idle uses the policy's 60-second threshold. A 90-second no-input foreground scenario splits into 60 seconds Focus active and 30 seconds Focused idle; both are accepted into the ledger and returned by Reports.
- Implemented/verified - High: policy-enabled v2 open/runtime is separate from Focus. Different visible Apps can accrue concurrently, the same App is de-duplicated across windows/processes, and same-App overlapping ledger intervals remain rejected as `RUNTIME_OVERLAP`.
- Verified - High: runtime-disabled policy rejects `OPEN_RUNTIME` as `OPEN_RUNTIME_NOT_ENABLED` and stores no official interval. Enabling runtime creates a new tenant policy version and does not inherit the employee's old acknowledgement.
- Verified - High: Reports `openRuntimeEnabled` follows the active policy, and accepted runtime intervals display as runtime only with zero Focus time.
- Verified - High: no title, full URL, message/content, input text, clipboard, screenshot, file content, camera, microphone, token, or complete activity payload was added to collection/logging.
- Verified - High: the approved retry generated a real 0.6.7 NSIS installer. Installer and unpacked executable versions, ASAR runtime files/version literal, and packaged native-helper identity were inspected without running the installer.
- Remaining - Medium: existing dead letters are retained. SQLite can now show their stored code totals, but exact historical request/time diagnostics missing from older versions cannot be reconstructed.
- Remaining - Medium: no production migration/deployment or real Windows end-to-end test was run.

### Test And Verification Status

- Prisma generate/validate: pass; validate used a non-secret local placeholder URL and did not connect to a database.
- Desktop Agent typecheck/lint/native/source/Alpha build and renderer syntax: pass. Tests: `61/61` pass.
- Focused API semantics/compliance tests: `18/18` pass. API typecheck/lint/build: pass.
- Full API suite: `46/47`; unrelated existing fixed-date Reports verification is now older than the permitted ingestion window.
- New Web runtime-policy tests: `2/2` pass. Web typecheck/lint/build: pass.
- Full Web suite: `73/77`; four unrelated pre-existing brittle Reports render/source assertions remain.
- Native source/Alpha helper hash match: SHA-256 `CF85768D015BC7D8350EA0D2B026DFA39A6F1C0391BDB528219FE825C0887A2D`.
- `git diff --check`: pass. Changed-file high-confidence secret scan: zero matches.
- NSIS release: pass. `WorkMap-Desktop-Agent-Setup-0.6.7.exe` is `115,429,898` bytes, SHA-256 `9421839744780102CC8DB5B42422AB4205CFD52DEE9C7D88FF8D3FE1E7AD675A`, and Authenticode `NotSigned`. The unpacked executable reports ProductVersion `0.6.7.0` / FileVersion `0.6.7`.
- Follow-up focused rerun: Desktop `61/61`, API `18/18`, and Web runtime/live-status `4/4` pass.

### Manual QA Status

- Not run. No real 0.6.7 installation, production DB migration, API/Web deployment, new policy acknowledgement, Windows multi-App observation, or `/reports` browser verification was performed.

### Risks And Deployment Order

- Deploy the additive migration before the API, then deploy Web with the API contract. Existing policy rows remain runtime-disabled by default.
- Migration remains blocked because no `DATABASE_URL` is visible in the repository `.env*`, current process, Windows User environment, or Windows Machine environment. No database target was guessed and no migration/seed was run.
- An authorised Owner/HR Admin must create the new runtime-enabled policy version, and the employee must acknowledge it before a valid runtime lease is issued. The existing `09:00-23:00 Australia/Adelaide` schedule is copied, not bypassed.
- Runtime has approximately two-second visible-window sampling granularity. Concurrent runtime totals are not wall-clock work totals and must remain separate from Focus active.
- Do not delete old rejected rows or call them confirmed data. Verify that new rejections carry request-correlated diagnostics instead.

### Pass/Fail Recommendation

- Pass for source correctness, privacy/RBAC/policy boundaries, focused automated semantics, native build, and the inspected unsigned 0.6.7 artifact.
- Proceed to commit only after normal diff review. Deployment cannot proceed safely until the intended database configuration is visible and the additive migration is applied.
- After migration/API/Web deployment, perform controlled real-device QA. Do not call Focused idle or open/runtime production-verified until newly completed 0.6.7 intervals are confirmed in `/reports`.

## 2026-07-20 Test Policy Window Extension To 23:00 QA

### Reviewed Implementation

- Reviewed the real policy source, Adelaide timezone conversion, lease reuse rules, Desktop Agent 0.6.6 five-minute refresh behavior, Compliance RBAC, tenant scoping, Web control, demo seed, and the complete current diff.

### Findings Ordered By Severity

- Fixed - High: the active test policy ended at 17:00, so evening App snapshots and intervals were correctly rejected even while secure heartbeat remained online. The workspace can now explicitly extend the schedule to 23:00 through an authenticated policy endpoint.
- Verified - High: a `09:00-23:00` Adelaide policy creates a lease ending at `13:30Z` for 2026-07-20, and the policy predicates accept evening instants inside that window.
- Verified - High: no Agent update is required. 0.6.6 refreshes within five minutes, the API rejects stale-window lease reuse, and the changed lease ID makes the runtime adopt the new window.
- Verified - High: the route requires `manageCompliancePolicy` and scopes the policy lookup to the authenticated company; Employee and cross-tenant attempts fail.
- Verified - High: in-place changes may expand but cannot narrow the schedule, so an older issued lease cannot temporarily authorize a broader window after a privacy-reducing policy edit.
- Remaining - High: the production tenant has not yet been updated because there was no authenticated browser session and the new endpoint is not deployed. Source completion is not the same as a live policy mutation.
- Remaining - Medium: existing schema/onboarding defaults stay at 17:00 for future tenants; this avoids expanding collection globally during a single-workspace testing adjustment.

### Test And Verification Status

- Focused work-hours/policy lease tests: pass, `10/10`.
- API typecheck/lint/build: pass.
- Web typecheck/lint/build: pass.
- Full API suite: fail, `39/40`; only the unrelated fixed-date ingestion test is older than the existing 31-day limit.
- Full Web suite: fail, `71/75`; all four failures are pre-existing Reports source/render assertions outside the current Compliance diff.
- `git diff --check`: pass.
- High-confidence secret scan: pass for the current diff; no credential, token, private URL, or database secret was introduced.

### Manual QA Status

- Not run for the live policy change, real Windows Agent refresh, or evening App interval appearing in Reports.
- Browser inspection only: no authenticated WorkMap tenant session was available, so no production state was modified.

### Security And Scope Review

- No all-day hardcode, policy deletion, tenant bypass, role weakening, credential change, re-pair, schema migration, production SQL, or new Desktop Agent binary was introduced.
- The request changes only the current test workspace after an authorised save. Heartbeat remains independent and continues outside the collection schedule.

### Pass/Fail Recommendation

- Pass for the scoped API/Web implementation, Adelaide lease behavior, automated policy boundaries, and build checks.
- Proceed to commit/push and coordinated API/Web deployment, then perform the Owner save and real-device verification. Do not call the live 09:00-23:00 behavior complete until Agent Diagnostics and one newly confirmed Reports interval prove it.

## 2026-07-20 Desktop Agent 0.6.6 Real-Time Input Lane And Clock-Correct Health QA

### Reviewed Implementation

- Compared all three screenshots with the installed 0.6.5 status file, Tracking v2 runtime state, privacy-safe NDJSON logs, live Windows process tree, renderer health calculation, serialized runtime host-event path, and native Windows polling loop.
- Reviewed the 0.6.6 code diff, rebuilt native helper, packaged native resource, version metadata, and Windows installer.

### Findings Ordered By Severity

- Fixed - Critical: every high-frequency input pulse awaited an immediate network sync on the same serialized lane that advances activity observation. With approximately four-second API latency and input sampling up to ten times per second, App observation fell about 15 minutes behind real time even though health remained online.
- Fixed - High: input pulses are now durable-local updates served by the normal bounded sync cadence; the native host emits at most one coalesced pulse per second while retaining the exact newest Windows input timestamp.
- Fixed - High: the renderer compared a server timestamp to an uncorrected client clock. The inspected client was about `131661 ms` ahead, making a current heartbeat look offline. The same thresholds now use the runtime server offset.
- Verified - High: this is not a cosmetic warning removal. Offline, paused, auth, upgrade, and failed request states remain authoritative; the 30/120-second thresholds are unchanged.
- Verified - High: the screenshot's `Confirmed - 1 accepted / 0 duplicate / 0 rejected`, `Confirmed interval through 4:12:51 PM`, zero pending queue, and historical Reports totals prove that some App data was accepted. The failure was severe delivery lag, not total absence.
- Remaining - High: evidence still queued only inside the running 0.6.5 process is not durably recoverable after replacement; it must not be fabricated as confirmed work time.
- Remaining - Medium: 0.6.6 was built but not installed, so actual post-upgrade snapshot/interval freshness remains a manual QA item.

### Test And Verification Status

- Desktop Agent typecheck/lint/build: pass.
- Renderer syntax: pass.
- Desktop Agent tests after native rebuild: pass, `53/53`.
- Windows NSIS installer: pass; size, hash, file/product version, and packaged native-helper identity verified.
- Authenticode: `NotSigned`.
- `git diff --check`: pass. High-confidence scan of the complete changed diff found zero secret matches.

### Security And Scope Review

- No screenshots, window titles, URLs, paths, keystrokes, clipboard, text input, page content, or full activity payloads were added. The helper continues to read only privacy-minimized App identity and last-input timing evidence.
- No policy weakening,全天采集硬编码, API/Web/schema/database change, auth/RBAC/tenant change, credential reset, or Browser Extension change was introduced.

### Manual QA Status

- Passed for diagnosis of the installed 0.6.5 failure condition only.
- Not run for installation or end-to-end behavior of 0.6.6.

### Pass/Fail Recommendation

- Pass for the identified root-cause correction, automated checks, native build, and unsigned 0.6.6 artifact.
- Proceed to commit/distribution and controlled real-device installation. Do not call the production tracking loop fully verified until a fresh snapshot and a newly completed 0.6.6 interval are both visible in Reports.

## 2026-07-20 Desktop Agent 0.6.5 Cross-Epoch Snapshot And Live UI Health QA

### Reviewed Implementation

- Reviewed the remaining deployed Reports screenshot against the current Agent runtime/log state and the API snapshot upsert path.
- Reviewed the Desktop engine epoch/sequence lifecycle, Electron UI state source, real heartbeat freshness thresholds, release metadata, and generated Windows installer.

### Findings Ordered By Severity

- Fixed - Critical: the API treated `snapshotSequence` as globally monotonic even though it resets inside every new `clockEpochId`. A current in-window snapshot from a restarted/resumed epoch could therefore be silently ignored behind an older epoch's higher sequence.
- Verified - Critical: cross-epoch ordering now uses the already validated `lastObservedAt`; same-epoch ordering still uses sequence. Automated tests prove a new epoch sequence `1` replaces old epoch sequence `900`, while a delayed old epoch sequence `901` cannot overwrite the newer observation.
- Fixed - High: the active Agent window no longer depends exclusively on a potentially stale `status.json`; it reads the running runtime's current server-confirmed heartbeat and sync state.
- Verified - High: this is not a cosmetic green-state override. Automated tests retain genuine `offline` and online-but-`paused` states, and the renderer's existing freshness thresholds were not changed.
- Verified - High: accepted App intervals still enter the official activity ledger/report day fragment and are returned by Reports history; the focused API integration-style test covers one confirmed `10,000 ms` interval.
- Unchanged - Medium: a real outside-work-window snapshot continues to be rejected while health may succeed. Reports should show connection online plus current activity unconfirmed/outside collection time, not a disconnect.
- Remaining - Medium: the real deployed API plus installed 0.6.5 Windows loop has not been manually tested.

### Test And Verification Status

- Focused API live-semantics tests: pass, `7/7`.
- Desktop Agent tests: pass, `52/52`.
- Desktop Agent typecheck/lint/build: pass.
- Desktop Agent Windows NSIS release: pass; artifact size and SHA-256 verified.
- API typecheck/lint/build: pass.
- Full API suite: fail, `34/35`; only the unrelated fixed-date `tracking-reports-verification.test.ts` exceeds the existing 31-day age limit.
- Windows installer Authenticode check: `NotSigned`.
- `git diff --check`: pass after the handoff update.
- High-confidence secret scan: no new secret; the only repository match is the unchanged synthetic Prisma URL parsing test fixture.

### Manual QA Status

- Not run. The installer was not installed, no API deployment was performed, and no real in-window/outside-window Reports observation was performed in this round.

### Security And Scope Review

- No policy weakening,全天采集硬编码, schema/migration, production database mutation, credential change, re-pair, RBAC/tenant change, or Web change was introduced.
- No token, credential, full URL, window title, user input, page content, or activity payload was added to logs or UI.
- Build-generated native binary timestamp noise was restored to HEAD and excluded from the implementation diff.

### Pass/Fail Recommendation

- Pass for source, focused semantics, package verification, and creation of the unsigned 0.6.5 installer.
- Proceed to API deployment and controlled 0.6.5 installation/manual QA. Do not call the production end-to-end loop verified until the Reports snapshot and a subsequently completed interval are observed on the real device.

## 2026-07-20 Desktop Agent / Reports Connection And Snapshot Separation QA

### Reviewed Implementation

- Independently reviewed the Desktop v2 runtime, API client/store/types/focus engine and diagnostic UI; the API sync, policy, device controller, and Reports services; Owner Reports live-activity types/rendering; local privacy-safe SQLite/runtime/log state; and all current changes against HEAD.
- Verified the actual transaction and presentation semantics rather than relying on the prior handoff's completion language.

### Findings Ordered By Severity

- Fixed - Critical: Reports used `snapshot.receivedAt ?? health.receivedAt`; an old snapshot therefore masked a current server-confirmed health signal and falsely rendered a red `Signal interrupted / Stale` state.
- Fixed - High: connection freshness is now based only on server-received health; snapshot freshness/rejection/current-state is a separate lane. Snapshot policy rejection cannot turn current health into a disconnect.
- Fixed - High: a newer snapshot rejection is retained across health-only syncs and suppresses the older stored snapshot from being presented as current. A newer accepted snapshot replaces the old row and clears the warning.
- Fixed - High: an older or duplicate snapshot cannot clear a newer rejection warning merely because its payload passes policy validation; warning clearing requires an actual sequence replacement.
- Verified - High: HTTP 200 confirms the sync/health transaction, not blanket interval acceptance. A focused integration-style service test demonstrates one valid `10,000 ms` App interval is accepted into `ActivityInterval`, receives a report day fragment, and appears in the Reports ledger fallback.
- Fixed - Medium: the validator no longer conflates invalid state timing with an outside-window result. `SNAPSHOT_OUTSIDE_POLICY_WINDOW` is reserved for the actual window predicate; invalid/missing timing returns `SNAPSHOT_OBSERVATION_TIME_INVALID`.
- Fixed - Medium: Desktop Diagnostics separately display connection/heartbeat, current App snapshot, historical rejected/network items, last confirmed interval upload, and exact policy/lease/window details.
- Verified limitation - Medium: exact reasons for the two historical generic `HTTP_400` dead letters and one generic `POLICY_REJECTED` dead letter cannot be recovered because older local persistence omitted the detailed safe reason/request correlation.
- Remaining - Medium: no real deployed Windows Agent/API/Reports loop was manually tested, so production behavior is not claimed as verified.

### Policy Assessment

- Inspected configuration: `Australia/Adelaide`, `09:00-17:00`, work-hours-only, App focus enabled, acknowledgement `ACKNOWLEDGED`, 24-hour lease, and relevant allowed UTC window `2026-07-19T23:30:00Z` to `2026-07-20T07:30:00Z`.
- Recommendation: do not change the schedule/timezone/lease based on the available evidence. Policy rejection explains why a particular snapshot was not accepted, but the configuration itself is not proven wrong. No policy behavior was weakened in this round.

### Test And Verification Status

- Desktop Agent typecheck/lint/build/renderer syntax: pass.
- Desktop Agent package tests: pass, `50/50`.
- API typecheck/lint/build: pass.
- Focused API live-semantics tests: pass, `5/5`.
- API policy lease tests: pass, `3/3`.
- Web typecheck/lint/build: pass.
- Focused Web live-presentation tests: pass, `2/2`.
- Full API package suite: fail, `32/33`; unrelated fixed-date test is now outside the 31-day ingestion window.
- Full Web package suite: fail, `71/75`; four stale/brittle assertions already conflict with HEAD and are unrelated to the current diff.
- `git diff --check`: pass.
- High-confidence secret scan: pass for the current change; the only repository match was an existing synthetic Prisma URL parsing fixture, reviewed with its credential segment redacted.

### Manual QA Status

- Not run. No real Windows installation, production API/Web deployment, real work-window transition, or Owner Reports browser verification was performed.
- Required manual evidence remains: outside-window heartbeat stays Connected with unconfirmed App copy; in-window snapshot becomes current; a subsequently completed interval is visible in historical Reports.

### Risks

- The deployed API and Web must be updated together because Web now consumes the new independent live-activity fields.
- A new Desktop installer/release is needed to expose the improved Agent Diagnostics UI; this round only ran the package build and did not version or publish an installer.
- The two tracked files rewritten by required verification were restored to HEAD after explicit user authorization and are not part of the implementation diff.
- Existing API/Web test debt should be repaired separately rather than mixed into this sync-status correction.

### Pass/Fail Recommendation

- Pass for the scoped source correction and focused automated semantics.
- Do not claim production completion until the real Windows Agent/API/Web/Reports loop is manually exercised.
- The next implementation round may proceed; production rollout should proceed only to coordinated QA, not directly to a verified-complete claim.

## 2026-07-19 Desktop Agent 0.6.4 Detailed Sync Failure Reasons QA

### Reviewed Implementation

- Reviewed the Tracking v2 API failure response, the Agent response parser and persisted diagnostic data, NDJSON diagnostic logging, and Diagnostics panel rendering.

### Findings Ordered By Severity

- Fixed - High: future Tracking v2 HTTP failures no longer collapse to a generic `HTTP_400`; the Agent retains a safe reason code, human-readable reason, remediation, retryability, stage, and request ID.
- Fixed - High: the same request ID is present in the Agent display/local log and API structured Render log, allowing one failed request to be traced without exposing payload or credentials.
- Expected limitation - Medium: historic entries written by earlier builds retain only `HTTP_400`; their unavailable reason is now stated explicitly rather than guessed.

### Verification

- API typecheck and production build: passed.
- Desktop Agent typecheck and Windows NSIS build: passed.
- Installer exists and SHA-256 was verified.
- `git diff --check`: passed, with line-ending notices only.
- Manual QA: not run; it requires deployment of the matching API plus installation of this rebuilt 0.6.4 Agent.

### Risk

- The UI can show every safe reason returned by the deployed API, but it cannot reconstruct a reason that an older API/Agent never persisted. Exact production wording therefore requires API and Agent to be deployed together.

## 2026-07-19 Desktop Agent 0.6.4 Snapshot Isolation And Diagnostics QA

### Reviewed Implementation

- Reviewed the API transaction boundary, snapshot validation, client-health persistence, Agent warning recovery, rolling local diagnostics, Reports reason mapping, migration, and Windows release artifact.

### Findings Ordered By Severity

- Fixed - Critical: an invalid or expired live Focus snapshot no longer rejects valid completed intervals or prevents heartbeat, health, and `lastSeenAt` confirmation.
- Fixed - High: the API returns one of three exact snapshot warning codes and stores the safe code/request ID/timestamp for Owner-side diagnosis.
- Fixed - High: the Agent drops only stale provisional snapshot state, refreshes its policy lease, and preserves queued historical intervals.
- Fixed - High: Agent and Render diagnostics can be correlated by request ID without storing credentials, tokens, complete payloads, URLs, window titles, or content.
- Fixed - Medium: Owner Reports provides an exact reason and remediation instead of a generic interrupted-state explanation.
- Remaining - Medium: the coordinated production migration/API/Web/Agent rollout and real Windows manual QA have not been executed.

### Test And Verification Status

- Shared types, Desktop Agent, API, and Web typechecks: pass.
- Desktop Agent tests: 50/50 pass.
- Focused API snapshot-isolation test: pass.
- API and Web production builds: pass.
- Prisma schema validation: pass without connecting to or modifying a database.
- Windows 0.6.4 installer build: pass; size and SHA-256 verified.
- Manual QA: not run.

### Recommendation

- Source and Alpha artifact are ready for a coordinated test deployment. Apply migration `20260719053000_tracking_snapshot_diagnostics` before deploying the matching API. Do not represent production behavior as verified until the real Agent/API/Reports loop is manually exercised.

## 2026-07-19 Tracking V2 Sync Failure Correlation Diagnostics QA

### Reviewed Implementation

- Reviewed the inspected local v2 records: the policy revision and integer duration values are valid, while prior HTTP 400 responses lacked a retained server-side failure stage.
- Reviewed the correlation changes across the Agent HTTP client, persisted diagnostic model, runtime state, and API sync exception path.

### Findings Ordered By Severity

- Fixed - High: request-level Tracking v2 failures can now be correlated by one request ID across the local Agent status and Render log.
- Fixed - High: response details are restricted to a known failure-stage allowlist and sanitized short messages; credentials and activity payloads are not persisted or logged.
- Remaining - Medium: the exact historical HTTP 400 cannot be reconstructed because it occurred before the new diagnostic fields existed.

### Test And Verification Status

- Desktop Agent typecheck: pass.
- API typecheck: pass.
- Manual QA: not run; requires a real rejected request after API deployment and Agent 0.6.4 installation.

### Recommendation

- Proceed with the scoped backend deployment and Desktop Agent 0.6.4 build. Do not re-pair an existing installation solely for this update.

## 2026-07-19 Desktop Agent V2 Integer Interval Repair QA

### Reviewed Implementation

- Reviewed the local v2 queue diagnosis: 32 terminal `INVALID_DURATION` records were caused by fractional monotonic-clock interval values generated by the Desktop Agent.

### Findings Ordered By Severity

- Fixed - Critical: `durationMs` could contain fractional milliseconds even though the shared v2 contract requires a positive integer. The server correctly terminally rejected these intervals.
- Verified - Critical: persisted start, end, and duration now use one integer-millisecond coordinate system; duration is calculated as `end - start`.
- Verified - High: the regression test covers fractional clock input and asserts integer, positive, internally consistent output.
- Remaining - Medium: previously terminally rejected records are deliberately not converted into confirmed activity because that would manufacture unverified work time.

### Test And Verification Status

- Desktop Agent tests: pass, 50/50.
- Desktop Agent typecheck: pass.
- Windows NSIS installer build: pass.
- `git diff --check`: pass; line-ending notices only.

### Manual QA Status

- Not run. Install `0.6.3`, keep one foreground App active beyond the next settlement window, then confirm a newly generated interval is accepted and appears in Reports.

### Pass/Fail Recommendation

- Pass for a targeted Desktop Agent `0.6.3` release. The diagnosed protocol-invalid durations are no longer emitted by the repaired code.

## 2026-07-19 Desktop Agent Queue Status Separation QA

### Reviewed Implementation

- Reviewed the v2 Desktop Agent status handoff from `runtimeV2.ts` to the Electron renderer after the local `queue.json` inspection returned exactly 1,000 retained legacy records.

### Findings Ordered By Severity

- Fixed - High UI diagnosis: `queuedEvents` combined SQLite Tracking v2 intervals with the legacy file queue, so the Agent presented historical compatibility records as current pending v2 uploads.
- Verified - High data retention: the change only separates reported counts. It does not delete, clear, mutate, or stop retrying `queue.json` records.
- Verified - Medium backward compatibility: new status fields are optional, so a pre-v2 or partially upgraded status file continues to render without an error.

### Test And Verification Status

- `pnpm --filter @workmap/desktop-agent test`: pass, 48/48.
- `pnpm --filter @workmap/desktop-agent typecheck`: pass.
- `node --check apps/desktop-agent/renderer/app.js`: pass.
- `git diff --check`: pass; CRLF notices only.

### Manual QA Status

- Not run. A newly built Agent installer is needed to inspect the separate compatibility notice on Windows. No manual queue cleanup has been performed.

### Pass/Fail Recommendation

- Pass for a scoped Desktop Agent release. The visible v2 pending count will no longer be inflated by the legacy migration backlog.

## 2026-07-18 Tracking v2 Upload Confirmation And Reconciliation Diagnostics QA

### Reviewed Implementation

- Reviewed the post-`f5ad70b` failure mode: an accepted Tracking v2 upload could wait on daily-summary reconciliation before returning to the Agent, while the reconciliation worker discarded the diagnostic error detail.

### Findings Ordered By Severity

- Fixed - High: daily aggregation was in the synchronous `sync-v2` request path even though dirty targets are already durably queued for the worker. A slow or failing aggregate refresh could delay client acknowledgement and cause a retry/offline presentation.
- Fixed - Medium: worker warnings hid the database error code/message necessary to repair reconciliation. New logs are redacted and capped; no request payload or device credential is logged.
- Remaining - Medium: the worker still has a real production database error, currently unknown because the deployed version emits only generic warnings. The next deployment must provide its precise sanitized error.

### Test And Verification Status

- `git diff --check`: pass, with CRLF conversion notices only.
- Node syntax checks for modified API modules: pass.
- API typecheck/lint/build: blocked locally by inconsistent `node_modules` and unavailable registry fetch. The command was stopped before pnpm could remove or reinstall dependencies.

### Manual QA Status

- Not run. Production verification requires one API deployment, confirmation that a paired Agent reaches `Connected`, and inspection of the first detailed reconciliation warning if aggregation still fails.

### Pass/Fail Recommendation

- Pass for API-only deployment to decouple acceptance from aggregation and restore retry responsiveness.
- Do not call reconciliation complete until the post-deploy detailed Render error is inspected and corrected.

## 2026-07-19 Tracking v2 Reconciliation Advisory-Lock Fix QA

### Reviewed Implementation

- Reviewed the detailed deployed worker error: `P2010`, `Failed to deserialize column of type 'void'`.
- The only raw read in the reconciliation transaction was `SELECT pg_advisory_xact_lock(...)`; PostgreSQL documents this locking function as returning `void`.

### Findings Ordered By Severity

- Fixed - Critical: `$queryRaw` attempted to deserialize the advisory lock's `void` return value, preventing every affected dirty target from reaching the daily-summary upserts.
- Fixed - High: the initial `$executeRaw` adjustment was insufficiently defensive because the SQL statement still directly selected a PostgreSQL `void` value. The lock now runs inside a referenced CTE and the final query returns only a supported boolean column to Prisma.

### Test And Verification Status

- `node --check` for the reconciliation service, worker, and sync service: pass.
- `git -C workmap diff --check`: pass; CRLF conversion notices only.
- Scoped changed-diff credential scan: pass; no match.
- Full API typecheck/lint/build: not re-run. The local dependency state previously requested a destructive pnpm modules purge and registry access was unavailable; neither action was taken.

### Manual QA Status

- Not run. Production needs one API deployment, then confirmation that worker warnings stop and a paired client can move from local queue to confirmed report totals.

### Pass/Fail Recommendation

- Pass for a narrowly scoped API deployment. No migration or client release is required.

## 2026-07-18 Tracking v2 Sync UUID Lock Recovery QA

### Reviewed Implementation

- Reviewed the Render production exception and the `lockWriteLanes()` raw PostgreSQL query used by `POST /device-client/sync-v2`.
- `ClientWriteLane.id` is a Prisma `@db.Uuid`; the old `Prisma.join(laneIds)` binding produced a PostgreSQL `uuid = text` comparison. The fix changes only those bindings to `CAST($n AS uuid)`.

### Findings Ordered By Severity

- Fixed - Critical: every v2 sync transaction attempted to lock a UUID lane against text-bound raw parameters and failed with Prisma `P2010` / PostgreSQL SQLSTATE `42883`. Because lane locking occurs before snapshot, health, or interval persistence, valid paired clients could not sync any v2 data.
- Verified - High: the regression test asserts each generated lane ID remains parameterized and is explicitly cast as UUID before the `FOR UPDATE` lock.
- Remaining - Medium: local queues already marked `DEAD_LETTER` after earlier HTTP 400 responses remain intentionally non-retriable and are not altered by this server-side repair.

### Test And Verification Status

- API test suite: passed, 22/22.
- API typecheck, lint, and production build: passed.
- `git diff --check`: passed with only informational CRLF conversion warnings.
- Scoped changed-diff credential scan: passed.

### Manual QA Status

- Not run. Production confirmation requires deploying the API, allowing one paired v2 client to retry, confirming a successful sync/heartbeat, and checking Render no longer logs `uuid = text` for `sync-v2`.

### Pass/Fail Recommendation

- Pass for immediate API-only deployment. No migration and no tracking-client installer/extension update are required for the UUID lock fix.

## 2026-07-18 Tracking Client GitHub Release Automation QA

### Reviewed Implementation

- Reviewed the new GitHub Actions release workflow and the Browser Extension archive naming change.

### Diff Review Summary

- The workflow publishes independently named, version-derived releases: `desktop-agent-v<version>` with the NSIS `.exe`, and `browser-extension-v<version>` with the Load-unpacked `.zip`.
- Push detection is limited to the corresponding client `package.json`, preventing ordinary source commits from making duplicate releases. Manual dispatch is available for a deliberate rebuild/re-upload.
- Release assets are checked before GitHub CLI is invoked. Existing release assets are replaced with `--clobber`, making retry behavior deterministic.
- The workflow runs on Windows, matching both the NSIS release path and the Extension's PowerShell `Compress-Archive` implementation. pnpm setup precedes Node cache setup.
- No secret or hard-coded version was introduced. The extension archive name now follows the package version.

### Findings Ordered By Severity

- High: none found in the changed automation.
- Medium: the repository must allow `GITHUB_TOKEN` write permissions in GitHub Actions settings; this is an external repository setting, not a code defect.
- Low: hosted-runner release execution has not happened yet, so Electron signing/runner-specific behavior remains unproven until the first GitHub Actions run.

### Test And Verification Status

- Prettier check for workflow and modified packager: pass.
- Browser Extension: typecheck pass; lint pass; 31 automated tests pass; `release:zip` pass and generated the expected versioned archive.
- Desktop Agent: typecheck pass; lint pass; 48 automated tests pass.
- GitHub Actions workflow execution and real GitHub Release upload: not run; no live tag/release was created during this round.

### Manual QA Status

- Not run. No desktop installation, extension loading, tracking, or live GitHub UI interaction was required for this configuration-only task.

### Risks

- GitHub's workflow-permission setting and the first hosted Windows build are external runtime gates.
- Existing untracked `workmap/scripts/diagnose-tracking-v2-readonly.mjs` remains outside this task and was not reviewed or changed.

### Pass/Fail Recommendation

- Pass for local release-automation implementation and package-level verification.
- The next round can proceed after this workflow is committed and pushed. The first real Actions run should be checked for GitHub permission and hosted Windows packaging evidence before relying on it operationally.

## 2026-07-17 Tracking Protocol v2 Concurrency And Bootstrap Plan QA

### Reviewed Implementation

- Revised final plan against current Prisma Device/Credential/PairingCode models, pairing transaction, Desktop `0.5.10` Windows input adapter, Extension `0.4.3` identity baseline, v1 activity storage, and PostgreSQL/Prisma platform constraints.

### Diff Review Summary

- All three mandatory findings and both suggested refinements are valid against the repository and are resolved in the plan.
- Focus concurrency now has a database serialization lane and a cross-epoch PostgreSQL exclusion constraint rather than only query-before-insert validation.
- First App/Domain acquisition now has a strict `nextIntervalSequence = 1` bootstrap proof, so provisional UI timing need not wait for periodic settlement and cannot enter official history.
- One active Desktop is enforced through immutable Device client identity, a workstation row lock, compare-and-swap replacement, and a partial unique index. Browser family is immutable server-owned Device identity.
- Policy leases now contain concrete server-generated UTC windows, avoiding independent C#/JavaScript/Node DST interpretation.
- `LASTINPUTINFO.dwTime` rollover has a deterministic unsigned mapping/test requirement, and the undefined sync-envelope `clientSequence` field was removed.

### Findings Ordered By Severity

- Critical/high plan blockers from this review: resolved.
- Medium: the PostgreSQL extension, exclusion constraint, partial unique index, and legacy identity backfill still require real migration implementation and disposable-database validation.
- Medium: the initial provisional proof depends on snapshot-only requests taking the same Focus lane lock; this is now explicit and must be preserved in implementation.
- Medium: ambiguous legacy browser/client identities deliberately block v2 activation until repaired or re-paired.
- Low: different Browser Profile devices may still provide conflicting live evidence; the plan correctly preserves and labels it for arbitration rather than fabricating one profile.

### Test And Verification Status

- Source/repository alignment review: pass.
- PostgreSQL/Prisma/Microsoft platform constraint review: pass.
- Required-plan-field and rejected-design scan: pass.
- Code-fence/heading/trailing-whitespace structure check: pass; 24 balanced fences, 53 headings, zero trailing-whitespace matches.
- `git diff --check`: pass for tracked changes; line-ending conversion warnings only.
- Untracked plan whitespace check: pass; expected no-index difference exit with no whitespace finding.
- Focused changed-file secret scan: pass.
- Runtime tests/builds/migrations: not run because this round changed documentation only.

### Manual QA Status

- Not run. No runtime implementation or real-device behavior is claimed.

### Risks

- Current runtime remains on the existing v1 models and behavior until work packages 1-6 are implemented.
- Database permissions, migration race tests, real Supabase pool behavior, Windows rollover/helper behavior, installed Chromium lifecycle, and Reports readback are not yet runtime evidence.

### Pass/Fail Recommendation

- Pass for final implementation-plan readiness.
- Fail if evaluated as Desktop `0.6.0`, Extension `0.5.0`, Tracking Protocol v2, schema migration, API, or Reports runtime completion.
- Work package 1 and work package 2 may now begin; v2 activation remains blocked until their automated contract, migration, concurrency, pairing, policy, and compatibility gates pass.

## 2026-07-17 Tracking Protocol v2 Integrity Plan QA

### Reviewed Implementation

- Revised final plan against Desktop Agent `0.5.10`, Browser Extension `0.4.3`, current client error/queue behavior, client-type-only pairing, Prisma policy/device/event models, increment-only summaries, and Reports aggregation.

### Diff Review Summary

- All five mandatory review findings are valid against the repository and are resolved in the plan.
- Event-ID idempotency and stream sequence identity are now independently unique and conflict checked with a canonical payload hash.
- Canonical queue rows are immutable and one-to-one; transport compression cannot merge sequence-bearing events.
- Multi-device user totals now use interval union and Active-over-Idle precedence; company totals sum reconciled users instead of raw device/app rows.
- Collection schedule timezone is separated from UTC Reports dates and requires Owner confirmation before v2 activation.
- Workstation selection is bound on the authenticated one-time code, and browser live-state arbitration no longer silently chooses among conflicting profiles.
- Snapshot, health, subject identity, downgrade, 24-hour lease, and cross-midnight projection rules are now explicit.

### Findings Ordered By Severity

- Critical/high plan blockers from this review: resolved.
- Medium: the plan requires an additive cross-stack implementation and migrations; none of these runtime/data-model changes exist yet.
- Medium: old `0.5.10/0.4.3` binaries can only show generic error/offline behavior for a future HTTP `426`; the plan correctly limits the dedicated `UPGRADE_REQUIRED` UI claim to new clients.
- Medium: exact union/reconciliation performance must be measured against the real Supabase pool, with dirty-date ledger fallback retained for correctness.
- Low: stable app identity fallbacks and same-browser multi-profile arbitration can expose an honest unresolved state but cannot always identify the exact foreground profile.

### Test And Verification Status

- Repository/source-level alignment review: pass.
- Official Windows/Chrome constraint review: pass.
- Plan structure: pass; 22 balanced code fences, 53 headings, zero trailing whitespace.
- Required-field scan for dual uniqueness, hashes/conflicts, snapshot/health, workstation binding, reconciliation, timezone, and non-compacting queues: pass.
- Rejected-design scan: pass.
- `git diff --check`: pass for tracked files; line-ending warnings only.
- Focused secret scan: pass; no real secret matches.
- Runtime tests/builds/migrations: not run because this round changed documentation only.

### Manual QA Status

- Not run. No runtime implementation or real-device behavior is claimed.

### Risks

- The current production code still has v1 second-level events, max-sequence behavior, increment-only summaries, client-type-only pairing, generic old-client `4xx` handling, and incomplete policy enforcement until the plan is implemented.
- Real multi-monitor, Windows session/power behavior, installed Chrome/Edge suspension, multi-profile ambiguity, and Owner/Employee Reports readback remain later concentrated manual QA.

### Pass/Fail Recommendation

- Pass for implementation-plan readiness.
- Fail if evaluated as Desktop `0.6.0`, Extension `0.5.0`, schema, API, or Reports runtime completion.
- The next development round may start with work package 1 and then the additive backend foundation; v2 client activation must remain blocked until compatibility, pairing, policy, idempotency, and reconciliation tests pass.

## 2026-07-17 Tracking Clients Revised Plan QA

### Reviewed Implementation

- Current Desktop Agent `0.5.10`, Browser Extension `0.4.3`, v1 local queues/checkpoints, activity/device ingestion, Prisma policies/summaries, Reports live/status aggregation, and the revised final implementation plan.

### Diff Review Summary

- The revised plan now uses the fixed 60-second rule, positive-millisecond history, event-driven MV3 behavior, contiguous sequence cursors, confirmed-only official history, lossless activation boundaries, device policy enforcement, UTC Reports aggregation with a separate IANA monitoring schedule, and source-specific freshness.
- Open Runtime is removed from core Focus acceptance and remains a separately enabled policy package.
- Automated and real-platform verification are separated so the plan does not claim ordinary CI can prove multi-monitor, UAC/RDP, power-loss, SmartScreen/AV, or every installed Chrome/Edge service-worker condition.
- Older v1 proposal and scaffold-era verification files are retained but explicitly marked historical.

### Findings Ordered By Severity

- Critical/high design blockers from the review: resolved in the plan.
- Medium: this remains a cross-stack Tracking Protocol v2 implementation touching clients, API, additive schema, policy, migration, and Reports; backend/policy compatibility must deploy before v2 activation.
- Medium: old v1 data already removed by the existing 1,000-row queue cap is unrecoverable; the revised migration preserves all rows still present locally and prevents new silent eviction.
- Medium: the current runtime still uses 30-second idle defaults, second-level v1 ingestion, max-sequence cursors, five-second live filtering, and incomplete client policy enforcement until implementation work is completed.
- Low: exact attention cannot be inferred during passive reading, calls, meetings, or offline work; the revised wording preserves that limitation.

### Test And Verification Status

- Source-level architecture review: pass.
- Official Windows/Chrome API constraint review: pass.
- Plan structure, internal headings, and 18 balanced code fences: pass.
- `git diff --check`: pass.
- Focused changed-file secret scan: pass; no matches.
- Runtime tests/builds were not run because no runtime code changed.

### Manual QA Status

- Not run. No Agent installation, Extension loading, live signal, or Reports browser interaction was changed or claimed.

### Risks

- This is a complete implementation blueprint, not completed client/report development.
- The existing runtime remains on the current v1/slice behaviour until the plan is implemented and verified.
- Real Windows and installed Chrome/Edge acceptance remains intentionally deferred until development and platform automation complete.

### Pass/Fail Recommendation

- Pass for architecture-plan delivery.
- Fail if evaluated as Desktop `0.6.0` / Extension `0.5.0` runtime completion.
- Core work packages 1-6 can proceed against this revised plan. Open Runtime must not block them.
- Final concentrated manual acceptance cannot proceed until the runtime, migration, automated verification, and artifacts are complete.

## 2026-07-16 Desktop Agent 0.5.10 Linear Runtime Diagram QA

### Reviewed Implementation

- Reviewed the new `0.5.10` Draw.io source against the current Agent runtime, tracking-state, local queue, and Reports live-usage display paths.

### Findings Ordered By Severity

- Critical/high/medium: none found in this documentation-only change.
- Low: visual opening in diagrams.net was not performed; XML validity confirms the source structure but not subjective canvas presentation.

### Test And Verification Status

- PowerShell XML parse: pass; exactly two Draw.io diagrams are present.
- `git diff --check`: pass.
- Focused changed-file secret-pattern scan: pass; no matches.

### Manual QA Status

- Not run. No runtime behavior changed.

### Risks And Recommendation

- Pass for documentation delivery after the final diff and secret checks. The diagram correctly distinguishes the durable completed slice from the following zero-second live heartbeat and explains the Reports display guard.

## 2026-07-16 Desktop Agent 0.5.10 Focus Slice Continuity QA

### Reviewed Implementation

- Reviewed the Agent event-upload/heartbeat order and the Reports same-range monotonic display guard.

### Findings Ordered By Severity

- Critical/high/medium: none found in the scoped change.
- Low: the live display can temporarily retain a slightly older maximum for the same reporting range until the persisted aggregate catches up. It never changes exports or server-side values, and prevents the user-visible time regression caused by independently timed requests.

### Test And Verification Status

- Reports focused tests: pass, 4/4, including the completed-slice display-regression case.
- Desktop Agent focused tests: pass, 27/27, including proof that `/device-client/app-usage` precedes the rollover heartbeat.
- Desktop Agent and Web typecheck: pass.
- Web lint: pass.
- Windows NSIS installer build: pass. `WorkMap-Desktop-Agent-Setup-0.5.10.exe` exists and is non-empty.
- `git diff --check`: pass.

### Manual QA Status

- Not run. Manual verification is deferred until the `0.5.10` installer is used with a paired device.

### Risks And Recommendation

- Pass for release. Existing `0.5.9` installations keep their previous runtime behavior; the Agent-side ordering fix requires the `0.5.10` installer. No database migration, API deploy, or Browser Extension release is required.

## 2026-07-16 Compliance Card-Grid Surface Fix QA

### Reviewed Implementation

- Reviewed the scoped CSS selector for the two direct `.wm-compliance-card-grid` containers on `/compliance`.

### Findings

- No behavior, data, API, or component markup changes were made.
- The stronger page-scoped selector overrides the generic white-section treatment only for the grid containers, while retaining the individual card surfaces.

### Verification Status

- Scoped CSS diff review: pass.
- `git diff --check`: pass.

### Manual QA Status

- Not run. Browser confirmation is required after the frontend deployment.

### Recommendation

- Pass for frontend deployment; no functional regression expected from this CSS-only scope.

## 2026-07-16 Device Setup Button Height Alignment QA

### Reviewed Implementation

- Reviewed the first-panel-only CSS rule for the Desktop Agent download and pairing-code actions.

### Findings Ordered By Severity

- Critical/high/medium: none.
- Low: authenticated screenshot confirmation was not performed locally. The rule is narrowly scoped to the first pairing panel and does not alter either action's behavior.

### Test And Verification Status

- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.
- `git diff --check`: pass (line-ending conversion warnings only; no whitespace errors).
- Scoped secret scan: pass; no matches.

### Manual QA Status

- Not run in an authenticated browser session.

### Risks And Recommendation

- Pass for deployment as a frontend style-only change. The next round can proceed.

## 2026-07-16 Desktop Agent 0.5.9 Runtime Diagram QA

### Reviewed Implementation

- Reviewed the new two-page Draw.io source against the 0.5.9 focus-slice runtime, local queues, Device API flow, Reports revision cadence, paired-device continuity, and privacy constraints.

### Findings

- No runtime code changed.
- The diagram explicitly distinguishes durable ten-second Focus Active slices from visible-window Open/runtime records, which prevents the prior heartbeat-only reporting gap from being misrepresented.
- The diagram contains no real credential, pairing code, database URL, token, user data, or unapproved collection category.

### Verification Status

- Draw.io XML structural parse: pass, two pages.
- Scoped credential-pattern scan: pass.
- `git diff --check`: pass; no whitespace errors.

### Manual QA Status

- Not manually opened in diagrams.net. No application behavior changed.

### Recommendation

- Pass. Use `workmap-desktop-agent-0.5.9-runtime.drawio` as the current architecture reference; retain the 0.5.8 diagram only as release history.

## 2026-07-16 Desktop Agent 0.5.9 Continuous Focus Reporting QA

### Reviewed Implementation

- Reviewed the Desktop Agent focus segmentation change, the Reports revision refresh cadence, the release version propagation, and the generated Windows installer.

### Findings Ordered By Severity

- Critical/high: none found in the scoped diff.
- Medium: the continuous-focus fix is delivered in a new executable. Any employee who stays on 0.5.8 will retain the old switch/idle/shutdown-only persistence behavior until the 0.5.9 installer is applied.
- Low: all Apps with visible-window runtime are already recorded through the existing raw event stream, while the Apps summary distinguishes focus-active time from open/runtime time. This is deliberate and avoids representing an unattended open window as active work.

### Test And Verification Status

- Desktop tracking state tests: pass, 11/11, including continuous 10-second focus persistence, idle, resume, app changes, runtime tracking, day boundary, and recovery coverage.
- Desktop GUI/release tests: pass, 3/3, including the 0.5.9 version assertion.
- Desktop Agent typecheck: pass.
- Web typecheck: pass.
- API tracking/report contract tests: pass, 17/17.
- Windows NSIS release build: pass in 60 seconds.
- Installer and blockmap exist and are non-empty.
- `git diff --check`: pass; no whitespace errors.

### Manual QA Status

- Deferred. No Agent was installed or paired by Codex during this round.

### Risks And Recommendation

- Pass for releasing `WorkMap-Desktop-Agent-Setup-0.5.9.exe`. Deploying the web-only portion improves refresh timing, but the durable focus-slice behavior requires the 0.5.9 Agent executable.
- No Prisma migration, API deployment, or Browser Extension update is required for this fix.

## 2026-07-16 Collapsed Sidebar Styling QA

### Reviewed Implementation

- Reviewed the collapsed desktop sidebar CSS changes for the expand button, navigation hit areas, icon dimensions, icon stroke width, logout icon consistency, and responsive-selector boundaries.

### Diff Review Summary And Findings Ordered By Severity

- Critical/high/medium: none found in the scoped stylesheet diff.
- Low: authenticated visual QA was unavailable locally because the existing auth guard redirected the unauthenticated browser to the public homepage. Production build validation passed, but final visual spacing remains a manual check.
- The implementation changes CSS only; no JSX, state, events, routes, navigation visibility, or access logic changed.

### Test And Verification Status

- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.
- Browser smoke: local site loads; authenticated sidebar state not reached without a valid session.
- `git diff --check`: pass (line-ending conversion warnings only; no whitespace errors).
- Scoped secret scan: pass; no matches.

### Manual QA Status

- Partial only. The public local page loaded, but the authenticated collapsed rail could not be rendered in the available browser session.

### Risks And Recommendation

- Low visual-only risk. Pass for deployment after a quick authenticated desktop refresh/collapse check.
- No functional regression was identified, and the next round can proceed.

## 2026-07-16 Desktop Agent 0.5.8 Runtime Diagram QA

### Reviewed Implementation

- Reviewed the Draw.io source against the current Desktop Agent version, pairing flow, runtime loop, Windows adapter, tracking state, file queues, API client, and Electron lifecycle code.

### Findings

- No runtime code changed. The diagram accurately distinguishes focus-active time, focused-idle time, and open-runtime window segments.
- The diagram correctly shows that abnormal termination cannot always send a final client event; the next Agent start recovers the local tracking checkpoint while the backend can infer a stale heartbeat interruption.
- The diagram contains no real device credential, database URL, pairing code, token, or user data.

### Verification Status

- Draw.io XML parse: pass (`2` pages, `88` cells).
- `git diff --check`: pass.
- Diagram credential scan: pass.

### Manual QA Status

- Not opened manually in diagrams.net. No browser, Agent, or production QA was run because no runtime behavior changed.

### Recommendation

- The next round can proceed. Open the `.drawio` file in diagrams.net only if a visual layout adjustment is desired; no software deployment or Agent upgrade is associated with this artifact.

## 2026-07-16 5432 Session-Pool Throughput and Page Request Scope QA

### Reviewed Implementation

- Reviewed the bounded Prisma runtime connection change for Supabase `:5432`, parallelization of independent report reads, and removal of duplicate live/audit usage-summary data from Dashboard and Employees.

### Findings

- The API retains `:5432` session-pool semantics and preserves explicit URL-level `connection_limit` values. The new default is eight, deliberately below both the configured 48 pool slots and the 16-value runtime safety ceiling.
- Parallelized calls are independent read operations over the same existing filters. No aggregation formula, data shape, authorization decision, or fallback behavior changed.
- Dashboard and Employees still request their dedicated live status exactly as before; the removed usage-summary enrichments were duplicate data neither page rendered from that endpoint.

### Verification Status

- API tests: pass (`17/17`), including the runtime database URL regression tests.
- API typecheck: pass.
- Web typecheck: pass.
- `git diff --check`: pass.

### Manual QA Status

- Not run against production. Manual validation should compare first load and return navigation for Dashboard, Employees, and Reports after API plus web deployment.

### Risk Assessment

- Low to moderate operational risk: eight connections is intentionally conservative relative to 48 shared Supabase slots, but actual latency also depends on Render cold starts and Supabase regional network performance. No migration or client update is required.

## 2026-07-16 Reports In-Tab Snapshot Reuse QA

### Reviewed Implementation

- Reviewed report cache isolation, cache expiry, background live-status refresh, revision-gated aggregate refresh, audit reuse, and the existing filter-loading transition.

### Findings

- No backend, database, authentication, Agent, Extension, or deployment behavior changed.
- Snapshots are scoped to the authenticated user and report inputs, remain only in browser memory, and cannot be reused across a different signed-in user or range.
- A failed background refresh retains the latest successful snapshot instead of replacing it with an empty report page.

### Verification Status

- Web typecheck: pass.
- `git diff --check`: pass.
- Secret scan: pass; no secrets found in changed source or handoff files.

### Manual QA Status

- Not run. Confirm rapid Reports -> another application page -> Reports navigation in the browser after deployment.

### Risk Assessment

- Low: a cached historical aggregate can be visible for up to the existing 20-second revision-check window while current Agent/Extension status continues to refresh.

## 2026-07-16 Web Request Scope and Reports Load Sequencing QA

### Reviewed Implementation

- Reviewed short-lived API-context caching, five-minute shell-context reuse, report-first initialization, deferred Owner-directory loading, and gated live-status polling.

### Findings

- No correctness issue found in the scoped frontend changes. Workspace and platform shell contexts are explicitly separated, preventing cross-context cache reuse.
- The report summary still uses the same request path and access checks. Directory loading was moved only after the summary because it populates a UI filter rather than being a prerequisite for the selected report.

### Verification Status

- Web tests: pass (`69/69`).
- Web lint: pass.
- Web typecheck: pass.
- Web production build: pass.
- `git diff --check`: pass.
- Secret scan: pass.

### Manual QA Status

- Not run. Production network latency and cold-start behavior are outside this frontend-only local verification.

### Risk Assessment

- Low: an intra-app shell label may be up to five minutes old, while every API request continues to be authenticated and authorized by the backend.
- The tracked TypeScript build-info file was regenerated by verification and should not be treated as a runtime source change.

### Recommendation

- The next round can proceed with normal browser verification of rapid route transitions and the first `/reports` load; no Agent or database action is required for this frontend change.

## 2026-07-16 Render Zero-Downtime Session-Pool Recovery QA

### Reviewed Implementation

- Deferred Prisma startup connection after HTTP port binding, preserving database-aware readiness.

### Findings

- The second Render log proves the connection limit and retry code was deployed, but all session-pool slots were still unavailable before Nest could call `listen`.
- Moving recovery after `app.listen` removes the deployment gate without hiding database health. This specifically addresses a replacement instance competing with the old instance for a full Supabase session pool.

### Verification Status

- API tests: pass (`17/17`).
- API typecheck: pass.
- API lint: pass.
- API build: pass.

### Manual QA Status

- Pending Render deploy and `/health` plus `/health/readiness` verification.

### Recommendation

- Deploy this backend-only change with port `5432` unchanged. Verify Render does not use `/health/readiness` as its deployment health-check path; it is intentionally a database readiness endpoint.

## 2026-07-16 Render Session Pool Startup Recovery QA

### Reviewed Implementation

- Prisma runtime URL normalization and transient startup retry for Supabase session-pool deployments on port `5432`.

### Findings

- The attached Render log shows that build succeeded; the process failed only during Prisma initialization with `EMAXCONNSESSION` because the Supabase `:5432` session pool had reached its 15-client cap.
- Port `5432` is retained. The API now caps its own Prisma use to one connection and does not inject transaction-pooler settings into a session-pool URL.
- Regression tests cover transaction and session pooler URL behavior, explicit configuration preservation, and malformed URL preservation.

### Verification Status

- API tests: pass (`17/17`).
- API typecheck: pass.
- API build: pass.

### Manual QA Status

- Pending Render deployment and service health check.

### Recommendation

- Deploy this backend-only fix while keeping the Render `DATABASE_URL` pointed at the existing Supabase pooler host on port `5432`. No migration or client release is required.

## 2026-07-16 Reports 500 Resilience QA

### Reviewed Implementation

- Report query concurrency reduction, optional tracking-section fallbacks, and safe failure diagnostics for `/reports/usage-summary`.

### Findings

- The previous usage-summary assembly issued multiple nested parallel Prisma reads. With the runtime limited to a small Supabase transaction-pooler connection budget, one optional tracking/audit read could fail the entire report request.
- Core app/domain summaries remain required and are not replaced with fabricated data.
- Status, live coverage, audit timeline, and freshness enrichments now degrade to explicit empty API values when their backing query fails, preserving report access and preventing a misleading full-page 500.
- Regression coverage simulates `P2022` failures in optional activity/status reads and confirms that the core report still returns.

### Verification Status

- API typecheck: pass.
- API tests: pass (`16/16`).
- API lint: pass.
- API production build: pass.
- `git diff --check`: pass; only LF-to-CRLF warnings were emitted.

### Manual QA Status

- Not run against the deployed Render service in this coding environment.

### Recommendation

- Pass for backend deployment. No database migration or Desktop Agent/Browser Extension release is required for this fix.

## 2026-07-16 Invitation Activity Panel Spacing QA

### Reviewed Implementation

- The owner invitation-list panel visual treatment and responsive spacing.

### Findings

- The amber element was confirmed to be decorative, not data-backed quota or seat usage; the visual now reads as a local access marker rather than a meter.
- The panel and invitation rows gain scoped internal spacing without changing the invitation-list rendering or status values.
- Narrow-screen padding and row stacking remain covered by a regression assertion.

### Verification Status

- Web tests: pass (`65/65`), including recent-invitation panel layout coverage.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass; existing Next ESLint-plugin configuration warning remains.
- Scoped invitation-panel credential scan: pass; no credential-like values found.

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No invitation quota/capacity, API, database, deployment, Desktop Agent, Browser Extension, or tracking change is involved.

## 2026-07-15 Collapsible Workspace Sidebar QA

### Reviewed Implementation

- Desktop workspace-sidebar collapse treatment and responsive fallbacks.

### Findings

- The default desktop sidebar remains familiar and fully labelled; the collapsed form retains every available navigation action as an accessible icon rail.
- The active navigation route remains visually identifiable. Hover, focus, native title, and keyboard focus expose the label in the compact state.
- The collapse preference is local to the browser and cannot change account state, role access, routing, report data, or backend behavior.
- At `1024px` and below the collapse control is removed and the established responsive header returns; at the small mobile breakpoint the horizontal labelled navigation remains available.

### Verification Status

- Web tests: pass (`64/64`), including sidebar collapse and responsive recovery regression coverage.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.
- `git diff --check`: pass.

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No API, database, deployment, Desktop Agent, Browser Extension, or tracking changes are involved.

## 2026-07-15 Reports Loader Unframed Avatar QA

### Reviewed Implementation

- Reports-only selected-report loading presentation.

### Findings

- The nested section loader has no border, background, rounded frame, or fixed height in this report-loading state.
- The outer Reports loading panel remains unchanged, so page space and centering are stable while data loads.
- The override does not affect full-page or other section loaders.

### Verification Status

- Web tests: pass (`62/62`), including a Report loader frame regression check.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass.

### Manual QA Status

- Not run in this coding environment.

### Recommendation

- Pass for Web deployment. No backend, database, deployment, Desktop Agent, or Browser Extension update is involved.

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

---

## 2026-07-16 Reports Responsive Live Refresh And Query Separation QA

### Reviewed Implementation

- Reviewed the request split between `/reports/usage-summary`, `/reports/agent-status`, and the new `/reports/tracking-audit` endpoint.
- Reviewed the new bounded live-browser query, aggregate-summary revision source, user/company authorization handling, and additive Prisma indexes.

### Findings Ordered By Severity

- No current-change correctness issue found in source review. The primary summary continues to use the existing aggregation methods; only optional live/audit sections move to independent requests.
- The production latency improvement from indexes requires migration `20260716103000_report_query_performance` to be applied. It was not applied by this task.
- Local Prisma database validation was not rerun because this shell has no `DATABASE_URL`; no production credential was read or printed.

### Test And Verification Status

- API tests: passed, 17/17.
- Web tests: passed, 72/72.
- API/Web typecheck, lint, and production builds: passed.
- `git diff --check` and scoped source credential scan: passed; Windows line-ending notices were informational only.
- Manual authenticated performance QA: not run.

### Recommendation

- Pass for a coordinated API/Web deployment and the already-scoped additive index migration. Do not update Desktop Agent or Browser Extension for this API/Web-only increment. Confirm production request duration and visible-tab report freshness after deployment; do not interpret automated source tests as production performance acceptance.
## 2026-07-16 - Desktop Agent timing-path audit

- Reviewed v0.5.9 source flow only; no files in the runtime were changed.
- Finding: Focus Active display can visibly regress at each 10-second rollover because the new heartbeat reaches `/reports` before the completed activity slice is uploaded and aggregated.
- Severity: high for Owner report correctness perception; the durable activity event is normally uploaded afterwards, but the live display is not monotonic and must not be treated as an exact continuous timer.
- Manual QA: not run in this analysis-only round.

---

## 2026-07-16 Browser Extension v0.4.2 Audit QA

### Reviewed Implementation

- Reviewed the actual MV3 background lifecycle, content-script activity signals, persisted Domain tracker, queue/retry logic, activity ingestion, and `/reports` current-domain presentation.

### Findings Ordered By Severity

- High: `background.ts` writes a completed Domain slice to durable storage, sends heartbeat, and only then flushes the Domain queue. This can make `/reports` show a connected Extension but temporarily no current Domain or an old Domain at a checkpoint boundary.
- Medium: optional HTTP/HTTPS host permission and content-script registration failures can leave a paired Extension connected but unable to observe user interactions. The background currently swallows registration failures and does not expose this as a tracking-health state.
- Medium: when tab blur/visibility events are unavailable, the previous Focus Active interval remains open for up to the explicit 30-second grace period. This is bounded but can overstate per-domain Focus Active time around a missed tab switch.
- Informational: unlike Desktop Agent's earlier live-duration regression, Extension heartbeat has no current Domain duration. Its persisted Domain aggregate does not use the desktop live-duration merge path and should not numerically reset at each checkpoint after the server accepts slices.
- Informational: Browser close, disable, uninstall, and worker termination have no reliable explicit stop callback in MV3; inferred signal loss is the truthful status model for those situations.

### Test Status

- `pnpm.cmd --filter @workmap/browser-extension test`: passed, 17/17.
- Test gap confirmed: no automated test asserts completed-Domain upload precedes heartbeat, reports-current-domain continuity, or paired-without-host-permission health reporting.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. No production browser session or extension load was performed.

### Recommendation

- Do not ship a claim that Browser Extension v0.4.2 already has the Desktop Agent v0.5.10 timing-path correction. Make the small ordering and tracking-health changes above, add narrow regression coverage, build a new extension package, then validate one Chrome/Edge live-domain session.

---

## 2026-07-16 Browser Extension v0.4.3 Reliability QA

### Findings And Resolutions

- Fixed - High: checkpoint processing now uploads queued completed Domain slices before its heartbeat. Reports therefore cannot be made fresh by the heartbeat while the corresponding persisted Domain summary is still waiting locally.
- Fixed - High: tracking-access diagnostic events no longer update `lastSeenAt`. A website-permission health change cannot claim a current Extension connection ahead of a real heartbeat/activity upload.
- Fixed - Medium: an active tab immediately seals a previously active tab in the same browser window. Different windows preserve explicitly bounded parallel Focus Active intervals.
- Fixed - Medium: missing website access and dynamic content-script registration failure now persist a safe health state and appear in Extension options/Reports instead of silently allowing a paired but non-collecting state.
- Fixed - Medium: media is not treated as a standalone activity source. It is accepted only after recent trusted input while visible and focused, so background/autoplay does not create usage time.
- Retained limitation - Informational: MV3 has no dependable shutdown callback for browser close, disable, uninstall, or worker eviction. The system continues to use inferred signal loss for those cases.

### Automated Verification

- `pnpm.cmd --filter @workmap/browser-extension test`: passed, 20/20.
- `pnpm.cmd --filter @workmap/browser-extension typecheck`, `lint`, and `build`: passed.
- `pnpm.cmd --filter @workmap/api test`: passed, 18/18.
- API typecheck/lint/build and Web typecheck/lint/build: passed.
- `git diff --check` and scoped current-diff credential scan: passed.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. Automated tests do not substitute for loading v0.4.3 in a real Chrome/Edge profile and testing the permission and multi-window scenarios.

### Recommendation

- Pass for packaging Browser Extension v0.4.3 and coordinated API/Web deployment. No database migration and no Desktop Agent update are required for this extension release.

### Release Artifact Verification

- Verified `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.4.3.zip` contains the complete load-unpacked structure at zip root and reports `manifest.json` version `0.4.3`.

---

## 2026-07-18 Tracking Clients v2 QA

### Reviewed Implementation

- Reviewed the v2 Desktop Agent interval engine, protocol activation guard, durable queue/retry path, native Windows foreground adapter integration, and crash-window legacy checkpoint handling.
- Reviewed the v2 MV3 Extension worker, persistent tab/window Domain engine, hostname minimization, queue/retry path, and Windows release/Load-unpacked packaging paths.
- Reviewed v2 server ingestion/reconciliation, Reports v2-first merging, schema/migration shape, and Web source-module resolution needed for the production build.

### Findings Ordered By Severity

- Fixed - High: legacy checkpoint data could cross the v2 activation boundary after a client upgrade. The runtime now clips it at activation and fingerprints migrated legacy events so an interrupted migration cannot upload the same completed slice twice.
- Fixed - High: Desktop focus display no longer depends on a reset current-segment timer at each checkpoint. The v2 engine preserves an active interval baseline and emits confirmed immutable intervals.
- Fixed - High: Extension v2 persists its state independently of MV3 worker memory and uploads hostname-only completed intervals through a bounded queue.
- Fixed - Medium: the Web build initially could not resolve NodeNext `.js` source specifiers exported by shared types. The Webpack extension alias now resolves the corresponding TypeScript source for Web builds without changing server module semantics.
- Remaining - Manual QA: the true Windows foreground adapter and MV3 behaviour need a real Windows/Chrome or Edge validation; automated tests do not replace that test.

### Test And Verification Status

- Shared types: typecheck, lint, build passed.
- API: tests 21/21, typecheck, lint, build passed.
- Desktop Agent: tests 48/48, typecheck, lint, Windows release build passed.
- Browser Extension: tests 31/31, typecheck, lint, build, and package zip passed.
- Web: typecheck, lint, production build passed.
- Prisma schema validation passed with a placeholder local connection string; no database was contacted.
- `git diff --check` passed. The only output was informational CRLF conversion notices. High-confidence credential-pattern scan returned clean.
- `smoke:stage4` not run because the current smoke script mutates test/demo database records and requires a dedicated local API/database; this is an explicit verification gap, not a pass.

### Artifacts

- Desktop installer exists and is non-empty: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.0.exe`.
- Extension package exists and is non-empty: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.0.zip`.
- Extension Load-unpacked root contains `manifest.json`, `options.html`, and `dist/backgroundV2.js`.

### Manual QA Status

- Deferred by user, pending final consolidated manual QA. No production deployment, Windows installation, browser loading, pairing, or live authenticated report session was performed in this task.

---

## 2026-07-19 V2 Sync Correlation Diagnostics QA

### Reviewed Implementation

- Reviewed the new request-ID propagation from Desktop Agent to `POST /device-client/sync-v2`, API validation and safe response echoing, structured stage-level failure logging, and Agent durable diagnostic persistence.

### Findings Ordered By Severity

- Fixed - High diagnostic gap: a local queued batch and a Render failure could not previously be correlated without inspecting sensitive request details. Both sides now retain the same UUID and safe stage/status metadata.
- Remaining - Expected boundary: credential rejection can occur in the guard before the sync service. The Agent still stores its generated ID and HTTP status, but there is no sync-service stage log for a request that never reaches the controller.
- Existing unrelated test gap: `tracking-reports-verification.test.ts` uses a historical input that now violates the existing activity age guard; it is not caused by this change.

### Test And Verification Status

- Shared typecheck passed.
- API typecheck and production build passed.
- Desktop Agent typecheck, 49/49 package tests, and Windows build passed.
- New API request-ID test passed 2/2.
- `git diff --check` passed and the changed-diff credential-pattern scan was clean.

### Recommendation

- Pass for source-level diagnostics. Proceed with a coordinated API plus Desktop Agent deployment, then capture the safe request ID from local diagnostic state and the Render log if a sync fails.

### Recommendation

- Pass for source, focused automated verification, and Alpha artifact generation. Proceed only with a coordinated non-production validation of the migration/API/Web/client rollout before any production claim.

---

## 2026-07-18 Render Startup Alias QA

### Finding

- Fixed - Critical deployment blocker: `load-local-env.ts` derived its workspace root from an `.env` path. Render starts the filtered API package without a local `.env`, so the alias target was computed beneath `apps/api` and did not exist. Node then loaded shared TypeScript source and failed on the new `.js` export.

### Verification

- `pnpm.cmd --filter @workmap/api typecheck`: passed.
- `pnpm.cmd --filter @workmap/api build`: passed.
- From the same `workmap/apps/api` working directory used by Render, a Node process loaded the compiled alias hook and required `@workmap/shared-types`; `TRACKING_PROTOCOL_VERSION_V2` and `SingleFocusSessionEngineV2` were available.

### Manual QA Status

- Render deployment retry is not run by this task. No migration, database record, or production configuration was modified.

---

## 2026-07-18 Paired Client Activation Recovery QA

### Reviewed Implementation

- Reviewed the Desktop and MV3 activation paths from scoped credential validation through policy retrieval, activation handshake, local queue draining, heartbeat, and Reports eligibility.
- Verified that a policy prerequisite now produces a dedicated local status rather than a false offline state, and that both clients retry without re-pairing.

### Findings Ordered By Severity

- Fixed - High: a device could pair successfully but fail v2 activation because the policy schedule time zone, acknowledgement, or lease was unavailable. The previous client treated this as generic offline and stopped activation.
- Fixed - High: Extension alarms refreshed policy but did not re-run initial activation after a prerequisite was resolved. The alarm now retries activation and starts tracking after success.
- Fixed - Medium: the Compliance page had an existing protected API action to confirm the schedule time zone but no UI path to invoke it.
- Remaining - Manual QA: live verification still must confirm that the deployed API accepts the paired device credential and that policy confirmation causes a server-confirmed heartbeat and subsequent Reports data. This is not represented as passed.

### Verification

- `tsc --noEmit -p apps/desktop-agent/tsconfig.json`: passed.
- `tsc --noEmit -p apps/browser-extension/tsconfig.json`: passed.
- `tsc --noEmit -p apps/web/tsconfig.json`: passed.
- Desktop focused runtime/queue tests: 20/20 passed; GUI/release tests: 3/3 passed.
- Browser focused runtime/queue/service-worker tests: 18/18 passed.
- Windows native host, Desktop NSIS installer, Extension unpacked build, and Extension ZIP build completed successfully.
- `git diff --check`: passed.

### Recommendation

- Source and artifacts are ready for coordinated Web plus client deployment. No Prisma migration is needed. Manual validation remains deferred by user and should specifically verify policy confirmation, automatic client activation, queue drainage, current heartbeat, and Report visibility.

---

## 2026-07-19 Desktop Agent 0.6.2 Artifact QA

### Reviewed Release Boundary

- Verified that the existing `0.6.1` installer predates the request-ID sync diagnostics and must not be represented as including today's diagnostic code.
- Verified the released package and runtime source report `0.6.2` consistently.

### Verification

- `pnpm --filter @workmap/desktop-agent exec tsx --test test/gui-release.test.ts`: passed, 3/3.
- `pnpm --filter @workmap/desktop-agent release:windows`: passed in 82.5 seconds.
- `WorkMap-Desktop-Agent-Setup-0.6.2.exe` and its blockmap exist and are non-empty.

### Manual QA And Risk

- No live upgrade or re-pairing test was run. A normal in-place upgrade is designed to retain local pairing, but uninstalling with local-data deletion or a server-side device revoke requires a new pairing code.
- Matching API diagnostics must be deployed with the `0.6.2` installer to correlate the Agent's local `requestId` with Render logs.

---

## 2026-07-20 Tracking V2 Monday Policy-Window Recovery QA

### Reviewed Implementation

- Reviewed policy-lease reuse and live snapshot validation after a Monday-morning `SNAPSHOT_OUTSIDE_POLICY_WINDOW` diagnostic.
- Verified the policy-window calculation for Australia/Adelaide includes Monday 10:35 within the configured 09:00-17:00 workday.

### Findings Ordered By Severity

- Fixed - High: a non-expired but stale/malformed stored lease could be reused without revalidating its allowed UTC windows.
- Fixed - High: live snapshots were validated as if their whole state duration were a confirmed interval; a state spanning a previous policy boundary could prevent a valid in-window current observation from being stored.
- Preserved - Required privacy/policy boundary: confirmed duration intervals are still rejected unless their full duration stays inside an approved window.

### Verification

- Focused `tracking-v2-policy-lease` tests: 3/3 passed.
- `pnpm.cmd --filter @workmap/api typecheck`: passed.
- `pnpm.cmd --filter @workmap/api build`: passed.

### Manual QA Status And Risk

- Deferred pending API deployment. Live production validation is still required because this task cannot exercise the employee Windows session or deployed policy lease.
- No migration, re-pairing, client reinstall, credential change, or report aggregation schema change is required for this API-only correction.
