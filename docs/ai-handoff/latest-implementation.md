# Latest Implementation Handoff

## 2026-08-12 Authenticated Reports `Illegal invocation` Hotfix

### Original Task Brief

- Diagnose and fix the production client-side exception shown immediately after signing in and opening `/reports`: `Uncaught TypeError: Illegal invocation`.

### Root Cause And Implementation

- Root cause was confirmed with greater than 95% confidence in `workmap/apps/web/components/reports/completionPoller.ts`. The default scheduler copied the browser's native `setTimeout` and `clearTimeout` functions into a plain object and then invoked them as object methods. That changed their receiver from the browser global object to the scheduler object; Edge rejected the unbound Web API invocation. The authenticated Reports component starts these pollers immediately, which explains why the protected page crashed while the public route remained usable.
- Added `createCompletionPollerScheduler(timerHost)`. Its wrappers call timer methods through their owning host, preserving the required browser binding. The completion-based, non-overlapping Live/Audit/Summary polling cadence and all report data semantics are unchanged.
- Added a regression test with a strict timer host that throws unless both timer methods receive the correct `this` binding.

### Changed Files

- `workmap/apps/web/components/reports/completionPoller.ts`
- `workmap/apps/web/test/reports-completion-poller.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Verification And Boundaries

- Focused Reports tests: pass, 18/18.
- Web typecheck: pass.
- Web lint: pass.
- Web production build: pass, including static `/reports` generation.
- Full Web tests: 106/109. All Reports/poller tests pass. The three failures are pre-existing stale Dashboard visual/source assertions and an old `WorkMap` branding expectation in the Desktop audit test; none touches the changed poller.
- The unauthenticated in-app browser redirects from `/reports` to the public home page, so authenticated production visual QA was not available in that session. No Vercel deployment was performed. The production error will remain until this Web change is deployed and then verified with a signed-in Owner/HR Admin account.
- Auth, RBAC, API, Browser Extension, Desktop Agent, tracking policy, ledger and report calculations were intentionally not changed.

## 2026-08-12 Tracking v2 Ingestion, Reports Polling And Browser Focus Recovery

### Original Task Brief

- Investigate the recurring Browser Extension and Desktop Agent retry clusters, Render `TRACKING_SYNC_INTERNAL` transaction failures, `/reports` 500/CORS console errors, roughly ten-second report loads, and suspected Browser Domain Focus undercount.
- Use parallel specialists, proceed only after reaching greater than 95% confidence in the identified failure chains, preserve durable queued activity, and fix the shared system without modifying Desktop Agent behavior.
- Keep Browser Focus conservative: never invent time across an unproved foreground-window gap, and never weaken policy, acknowledgement, lease, schedule, tenant, credential or privacy enforcement.

### Confirmed Root Causes

- Render records showed concurrent Tracking v2 requests failing at `stage=transaction` after approximately 15-30 seconds and across batch sizes from zero to 50 intervals. This matches the API's Prisma interactive-transaction wait/timeout envelope and confirms a database transaction/pool contention class of failure, rather than client policy rejection. The former generic error mapping did not expose the safe Prisma category or the transaction phase, so the narrower distinction between pool acquisition, transaction expiry, retryable conflict and database connectivity could not be made from old logs alone.
- `/reports` independently started async Live, Audit and Summary refreshes every five seconds with no in-flight guard. Slow calls overlapped indefinitely, generated more API/database work, and produced a feedback loop. Live failure also returned before Audit refresh, leaving Connection Audit stale. The Audit endpoint queried an unused, unbounded App timeline, and the initial page path loaded major sections serially.
- The browser's IndexedDB queue and normal network retry did not stop new collection. The actionable undercount path was repeated `FOCUS_WINDOW_QUERY_RETRY` / `FOCUS_TAB_QUERY_RETRY`: a transient Chrome/Edge window-query exception marked the entire collector `LIMITED`, while Focus capture required `HEALTHY`. Trusted input could therefore remain conservatively uncounted until a later maintenance pass restored the collector.
- Browser `UNOBSERVED_GAP` remains an intentional honesty boundary: after service-worker suspension, browser restart, sleep or a clock discontinuity, the Extension seals Focus at the last durable observation and does not backfill time that it cannot prove.

### Changed Files And Implementation Summary

- API ingestion/config: `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`, `tracking-v2-reconciliation.service.ts`, `tracking-v2-reconciliation.worker.ts`, `src/config/allowed-origins.ts`, `src/main.ts`, and their focused tests.
  - Tracking sync now records a safe Prisma category and named transaction-step timings server-side, including pool acquisition, lane lock, identity/overlap checks, tombstones, intervals/summaries, cursor, snapshot, health and commit. It never logs raw SQL, credentials or activity payloads, and the client still receives the existing generic retryable error.
  - Repeated reconciliation-target and device/day-summary writes are batched into parameterized PostgreSQL upserts inside the same authoritative transaction. Tenant isolation, immutable ledger insertion, idempotency, cursor ordering and report semantics remain atomic.
  - The reconciliation worker no longer blocks every quiet target merely because any v2 device in the deployment was recently active. It retains the per-target 60-second quiet boundary and conservative one-target batch.
  - CORS preflight caching is ten minutes. The observed console CORS errors were secondary gateway/500 responses that did not pass through normal application CORS handling; this change reduces preflight noise but does not mask server failure.
- Reports: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, new `completionPoller.ts`, report API/client types and focused tests; `workmap/apps/api/src/modules/reports/reports.controller.ts`, `reports.service.ts` and audit tests.
  - Live refresh is 15 seconds, Connection Audit 60 seconds, and Summary revision refresh 60 seconds. Each is a completion-based single-flight loop, so a slow request can never overlap itself.
  - Live, Audit and Summary are independent. One failure keeps the last confirmed UI data and cannot block the other sections or replace content with a recurring loading state.
  - Initial Live and Summary loads run in parallel after the policy time zone is known; Audit starts independently. Stale filter requests are aborted and a filter becomes applied only after its Summary succeeds.
  - Report GETs have bounded 10/15/20-second timeouts. The Web requests Connection Audit with `includeTimeline=false`; the API default remains `true` for backward compatibility, but this Reports screen no longer queries an App timeline it does not render.
- Browser Extension: `workmap/apps/browser-extension/src/backgroundV2.ts`, version constants/manifests, generated unpacked manifest and Focus/service-worker tests.
  - A transient focused-window or active-tab proof-query failure now seals current Focus at the last durable observation and clears only the unproved Focus identity. It records the bounded retry diagnostic but leaves connection health, IndexedDB interval collection and Domain open/runtime independent and healthy.
  - A later successful visible/focused page proof or trusted event immediately resumes Focus and records `FOCUS_QUERY_RECOVERED`. Unknown time is not backfilled.
  - Persistence/storage failure still uses the existing global `LIMITED` safety state. Network upload retry still retains stable event IDs in IndexedDB and does not pause collection.
  - Honest release version is `0.5.18` because this is a Browser Focus reliability patch, not a new protocol or policy contract.

### Verification, Artifact And Deployment Boundary

- Browser Extension typecheck and lint: pass; full tests pass 84/84; build and `release:zip`: pass.
- API typecheck and lint: pass; full tests pass 68/68; production build: pass.
- Web typecheck and lint: pass; focused Reports tests pass 20/20; production build: pass. Full Web tests pass 105/108. The three failures are unrelated stale Dashboard/branding source assertions already present in the concurrent workspace; the changed Reports tests all pass.
- Final Browser ZIP: `workmap/artifacts/browser-extension/CandidGrid-Browser-Extension-0.5.18.zip`, 72,459 bytes, SHA-256 `9426985D6428EB536F61DDE1EA6DD6D8CCE64528AAE9034F4D9C2EB0B9F06EF0`, 26 entries, manifest/package/runtime version `0.5.18`.
- Read-only production probes confirmed the configured Web origin currently receives correct application CORS headers, while API readiness under concurrent probing varied from roughly two to seven seconds. Authenticated Render/Supabase dashboards were not available in the in-app browser, so the production database connection mode, total connection budget and instance count still require operator verification.
- No Desktop Agent source, package, behavior or artifact changed. No database schema/migration, policy semantics, credential behavior, RBAC, tenant isolation or payload privacy boundary changed. No production deployment, store publication, database mutation, pairing reset or local queue deletion was performed.
- Manual signed-in `/reports`, real Chrome/Edge load-unpacked, offline/reconnect queue drain, MV3 suspend/restart and multi-client load QA were not run. Deploy API first, then Web, then load Extension 0.5.18 without re-pairing. Acceptance requires 30 minutes with Desktop + Edge + Chrome: no recurring sync 500/502 cluster, pending drains to the normal active 0/1 level, dead-letter counts do not rise, confirmed-through advances, report refresh remains non-overlapping, and Browser Focus resumes on the first fresh proof after an injected window-query failure.
- Remaining risk: the new parameterized batch upserts have full unit/type/build coverage but have not been exercised against the real Supabase PostgreSQL instance. The new safe diagnostics are deliberately needed to distinguish any residual `P2024`, `P2028`, retryable conflict or named slow transaction step after deployment. Do not declare the production incident resolved before that monitored acceptance passes.

## 2026-08-10 Australian Employee Monitoring Notice Copy Refresh

### Original Task Brief

- Replace rough or internal-facing employee privacy and monitoring wording with professional copy aligned to applicable Australian employment/privacy expectations and CandidGrid's real implemented responsibilities.
- Change text only. Do not alter UI layout/styles, components, handlers, tracking logic, API, authentication, RBAC, database, policy controls or deployment configuration.
- Do not claim legal compliance, consent, collection limits or employee controls that the product cannot prove.

### Changed Files And Implementation Summary

- Web employee-facing copy was updated across the public home/FAQ, login, invitation acceptance, company onboarding, first monitoring-notice review, device setup, Reports, Settings, dashboard privacy cards, employee profile, virtual-office privacy boundary and report export text.
- The main notice surfaces are `workmap/apps/web/app/compliance/page.tsx`, `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx` and `workmap/apps/web/components/compliance/PolicyAcknowledgementModal.tsx`. They now distinguish product notice from the employer's legally required workplace notice, disclose collection/exclusions and schedule/runtime semantics, and describe confirmation as receipt/review rather than consent or waiver.
- Desktop employee-facing text was updated in `workmap/apps/desktop-agent/renderer/index.html`, `renderer/app.js`, `src/runtimeV2.ts` and the package description. Browser employee-facing text was updated in `workmap/apps/browser-extension/manifest.json`, `options.html`, `src/options.ts`, `src/backgroundV2.ts`, the generated `alpha-unpacked` text copies and the matching branding assertion.
- Copy now accurately distinguishes foreground App/hostname Focus active and focused idle from optional App/Domain open/runtime; discloses device/browser identity, version, time zone, heartbeat, connection/interruption, virtual-office presence and intentional CandidGrid interactions; and lists excluded content without the former ambiguous “by default” wording.
- The current policy retention value is labelled as a setting rather than a promise of automatic deletion because no automatic retention-deletion job was confirmed in this repository.

### Role, Legal And Product Boundaries

- Employee-role report requests are own-scope only where an own-summary surface exists; the current Reports page is not exposed to the Employee role. Team Leads, Managers, HR Admins and Owners can view role-permitted team/employee activity. IT Admins do not receive another employee's activity through that role. Platform Admin remains limited to privacy-safe tenant metadata, service health and audit information.
- The receipt button still invokes the existing acknowledgement endpoint; only its displayed wording changed. It now expressly says receipt/review is not consent, a waiver or proof that the employer met legal obligations.
- The copy follows the OAIC APP 1/APP 5 notification model, Fair Work workplace-privacy guidance and the need to consider separate state/territory workplace-surveillance rules. It does not claim that every employer is an APP entity or that the private-sector employee-record exemption always applies; OAIC confirms contractors/service providers may still be subject to the APPs.
- No employer legal name/contact, actual processing/storage region, overseas-recipient countries, employer-specific purposes, consequences, retention/deletion procedure or complaint contact exists in configurable product data. The UI therefore requires the organisation to provide those facts separately instead of inventing them. This product notice is not a complete employer APP Privacy Policy or state/territory surveillance notice.

### Verification, Manual QA, Risks And Next Step

- Web typecheck, lint and production build: pass. Full Web tests: 103/106; the three failures are confirmed pre-existing stale source assertions (two expect a `heroSignals` fixture absent in `HEAD`; one expects `WorkMap service unreachable` while `HEAD` already returns `CandidGrid service unreachable`). The changed open/runtime notice regression passes.
- Desktop Agent typecheck and lint: pass; full tests pass 75/75; TypeScript emit and text-package build pass.
- Browser Extension typecheck and lint: pass; full tests pass 84/84; TypeScript emit and unpacked-package text build pass. The display-name assertion was updated from the removed Alpha label.
- Manual signed-in browser/Windows/Chrome/Edge UI QA was not run. No production deployment or external legal sign-off was performed.
- Intentionally unchanged: all component structure/styles, event handlers, acknowledgement behavior, collection/idle/runtime logic, payloads, permissions, APIs, authentication, RBAC, database/schema, policy values and deployment configuration.
- Remaining go-live work is organisation-specific rather than safe to infer in source: supply the real controller/employer identity and privacy/HR contact, exact purposes and consequences, storage/processor/overseas disclosures, retention/deletion practice and applicable jurisdictional notice timing; obtain Australian employment/privacy counsel review; then manually QA long copy at desktop/mobile widths and in packaged clients. The next round can proceed to that employer-specific legal completion and manual acceptance, but the product must not yet be advertised as universally “compliant”.

## 2026-08-10 Tracking v2 Reconciliation Load-shedding Fix

### Original Task Brief

- Fix the recurring local Desktop Agent `HTTP 500 / TRACKING_SYNC_INTERNAL / transaction` uploads observed after the workspace-calendar reporting rollout.
- Proceed only with greater than 95% confidence, preserve queued activity, and do not change Desktop Agent or Browser Extension collection, interval creation, retry, policy, privacy, tenant or reporting semantics.
- Keep the implementation isolated from unrelated services and avoid masking errors by weakening validation or dropping data.

### Confirmed Cause And Changed Files

- Read-only local NDJSON and SQLite evidence showed failed requests lasting roughly 16-30 seconds at the API transaction stage, retryable queue retention, unchanged dead-letter totals, successful accepted batches between failures, and later cursor advancement. This is delayed ingestion rather than a terminal client rejection or evidence that the Agent stopped collecting.
- The existing API reconciliation worker started two seconds after every API boot and attempted four dirty historical targets every 30 seconds. Its per-target quiet period prevented same-target races but did not yield to unrelated active Tracking v2 ingestion. The workspace-calendar migration intentionally marked the rebuilt historical targets dirty, creating sustained background database work while clients were uploading. Prior deployed reconciliation logs also recorded expired Prisma transactions, consistent with the observed sync transaction timeouts.
- `workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.service.ts`: added a read-only recent-Tracking-activity check using activated, non-revoked `Device.lastSeenAt`. The check neither writes device state nor changes interval acceptance.
- `workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.worker.ts`: gives clients a 60-second recovery window after API startup, defers background materialization while any activated Tracking v2 device has been server-confirmed within two minutes, and processes one dirty target per quiet cycle instead of four.
- `workmap/apps/api/test/tracking-v2-reconciliation.test.ts`: added regressions proving the activity check is read-only, active Tracking traffic prevents a reconciliation write transaction, and reconciliation resumes with a one-target batch after the database becomes quiet.

### Behavior, Boundaries, And Deployment

- Desktop Agent and Browser Extension source, versions, packages, interval generation, queues, retry/backoff, heartbeat, snapshot, Focus/idle/Open-runtime clocks and request payloads are unchanged.
- `/device-client/sync-v2`, policy/lease validation, device credentials, tenant/RBAC boundaries, immutable `ActivityInterval` rows, calendar-day fragments and exact overlap-aware report totals are unchanged.
- Dirty summary targets remain durable. During active uploads, Reports continues using the existing exact ledger-fragment fallback; after two minutes without server-confirmed Tracking v2 activity, the worker resumes one target every 30-second cycle. This favors durable ingestion over cache freshness without omitting accepted data.
- No Prisma schema or migration changed. Deployment requires only the API build; no database migration, Web deployment, Agent release, Extension release, re-pairing or local-data reset is required.

### Verification, Manual QA, Risks, And Next Step

- Focused reconciliation test: pass, 10/10.
- API typecheck: pass. API lint: pass. API full test suite: pass, 65/65. API build: pass.
- Real Render/Supabase deployment and live two-client queue-drain QA were not run in this implementation round. Do not claim the production 500 cluster is resolved until the API is deployed and observed.
- Remaining trade-off: one active Tracking v2 tenant currently defers background cache materialization globally on the shared API/database. Exact Reports remain available through the raw-fragment fallback, but a large historical rebuild may take longer and should be allowed to drain during a quiet/off-hours window. At future multi-instance scale, move reconciliation to a separately controlled worker rather than restoring aggressive in-process batches.
- Recommended acceptance: deploy API only, keep the Agent/Extension installations and local stores intact, observe that heartbeat remains confirmed, pending returns to its normal 0/1 cycle, dead-letter totals do not increase, accepted/duplicate results advance confirmed-through, and Render no longer logs reconciliation/sync transaction expiry during active uploads.

## 2026-08-07 Workspace-calendar Reports Implementation

### Original Task Brief

- Replace the UTC-calendar behavior that made the Adelaide morning of August 7 appear as August 6 and prevented selecting August 7 until 09:30 local time.
- Keep collection authorization and policy enforcement unchanged; do not alter or release the Desktop Agent or Browser Extension.
- Implement only with high confidence and preserve the immutable Tracking v2 ledger, tenant isolation, role boundaries, and privacy-minimised payloads.

### Changed Files And Implementation Summary

- `workmap/apps/api/src/modules/common/reporting-calendar.ts`: added dependency-free IANA calendar helpers for local date resolution, local-midnight UTC boundaries, DST-safe calendar arithmetic, and interval splitting at workspace midnight.
- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`: accepted Tracking v2 intervals still retain UTC instants in the immutable ledger, but their derived day fragments are now split using the immutable policy lease `scheduleTimeZone`. Client requests, captured fields, interval acceptance rules, policy windows, lease validation, queue behavior, and retry semantics are unchanged.
- `workmap/apps/api/src/modules/reports/reports.service.ts`: report date validation, raw event/session/audit ranges, live provisional segments, and response labels now use the active workspace policy time zone. A requested `2026-08-07` therefore means local workspace midnight through the next local midnight, while database instants remain UTC.
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, `reportFilters.ts`, and `connectionAuditRange.ts`: Reports reads the active policy time zone before choosing the default/max date, presets and cache key. Usage totals and Connection Audit now use the same selected workspace calendar dates; the prior adjacent-UTC-day audit workaround and UTC-only label were removed.
- `workmap/apps/web/lib/api/apiTypes.ts`: report range time zone is now an IANA string rather than the literal `UTC`.
- `workmap/prisma/migrations/20260807093000_workspace_reporting_calendar/migration.sql`: leaves every raw `ActivityInterval` untouched, rebuilds derived day fragments from the ledger and each interval's immutable lease time zone, rebuilds device/day totals, and marks user/day reconciliation targets dirty so the existing exact overlap-aware worker/read fallback regenerates report caches. Physical `utcDate` column names remain for schema compatibility, but their documented value becomes the policy/workspace reporting date.
- API and Web regression tests cover Adelaide morning boundaries, invalid future local dates, 23-hour and 25-hour DST days, intervals crossing Adelaide midnight, current-day filter defaults, exact Connection Audit requests, and existing UTC test fixtures through explicit mock policy zones.

### Role, Data, And Deployment Behavior

- No Desktop Agent or Browser Extension source/version/artifact changed. No client reinstall or client release is required for this round.
- Owner/Employee/Platform Admin permissions, tenant/device credential boundaries, policy acknowledgement, work hours, allowed UTC windows, and collection enablement are unchanged. UTC remains the transport/storage representation for timestamps; only the reporting-day boundary changes.
- Existing accepted 09:00-09:29 Adelaide intervals are not lost. After the migration rebuild they move from the apparent August 6 UTC bucket into the August 7 workspace-calendar report.
- The migration has not been applied to production and no Render/Vercel deployment was performed. Recommended zero-mixed-state rollout: pause the API during a short maintenance window so clients queue safely, apply the migration, deploy the API and Web from the same commit, then resume the API and watch pending queues drain. If pausing is unavailable, deploy API/Web and apply the migration immediately afterward; expect a brief transitional report mismatch only.

### Verification, Manual QA, Risks, And Next Step

- API typecheck, lint, build and full tests: pass; 62/62 tests.
- Web typecheck, lint, production build and focused date/audit tests: pass; focused tests 10/10. Full Web suite is 105/106 because an unrelated pre-existing branding assertion expects `WorkMap service unreachable` while current source already says `CandidGrid service unreachable`; neither file is touched by this round.
- Prisma schema validation: pass with a non-secret placeholder URL. Final `git diff --check` and bounded secret scan: pass with zero secret-pattern matches.
- Real deployed Reports, production migration, real Adelaide browser date selection, and physical Desktop/Browser tracking were not manually tested. Do not claim production completion until deployment and the migration are complete.
- Remaining risk: the data migration rebuilds a large derived cache inside one database transaction and has not been executed against a production-sized clone. The immutable ledger is preserved, and dirty targets use the existing exact read fallback, but deployment should monitor migration duration, reconciliation backlog, API latency, and queue drain. Historical V1-only summary rows are not re-keyed; all currently activated Desktop/Browser clients use Tracking v2.
- Recommendation: source implementation is ready for a controlled migration/deployment round. After deployment, verify at Adelaide 00:00-09:29 that today is selectable, create activity across local midnight, and compare Reports with the accepted Tracking v2 ledger.

## 2026-08-07 Reports UTC-Date Boundary And Desktop Retry Diagnosis

### Original Task Brief

- Investigate why the Owner Reports page opened on the Adelaide morning of August 7 with August 6 selected and would not allow August 7 in the calendar.
- Determine whether the local Desktop Agent's retryable HTTP 500/502/network diagnostics meant that August 7 App activity was rejected or lost.

### Changed Files And Implementation Summary

- Documentation only: this handoff and `docs/ai-handoff/latest-qa.md` record the evidence-backed diagnosis. No product source, schema, policy, collection, queue, API contract, deployment configuration, or client release was changed.
- Confirmed in `workmap/apps/web/components/reports/reportFilters.ts` that the Reports default day and maximum selectable day use `new Date().toISOString().slice(0, 10)`, and in `ReportSummaryPanel.tsx` that the UI labels usage totals as UTC. The API also rejects a requested report day later than the current UTC date and returns `timeZone: "UTC"`.
- At 09:26 Adelaide on 2026-08-07, UTC was still 2026-08-06 23:56. Therefore August 7 was intentionally unavailable until 09:30 Adelaide, when the UTC calendar day advanced. Live signals are independent of the selected historical summary range, explaining why August 7 live timestamps appeared above an August 6 usage summary.
- Usage recorded from 09:00 through 09:29:59 Adelaide belongs to the August 6 UTC report under the current model; activity from 09:30 onward belongs to the August 7 UTC report. This is a reporting-day/UX mismatch for Adelaide, not evidence of collection loss.
- Read-only inspection of the local August 6 and August 7 NDJSON files reconstructed the Adelaide 09:00-09:31 timeline. Between 09:14 and 09:28 there were five retryable `TRACKING_SYNC_INTERNAL` HTTP 500 responses, four retryable HTTP 502 responses, and one no-response `NETWORK_ERROR`. Subsequent HTTP 200 responses accepted the queued interval batches with zero rejections and repeatedly drained the queue to zero.
- Read-only SQLite inspection later showed 61 unchanged historical dead letters and one newly generated pending row with zero attempts; eight seconds earlier there had been seven pending rows. This confirms the active queue continued draining rather than remaining stuck. Exact upstream causes of the 500/502 responses require deployed Render/API logs correlated by request ID; the local client evidence alone cannot distinguish an API transaction/database interruption from a gateway restart.

### Verification, Manual QA, Risks, And Next Step

- Repository started clean. Source review confirmed the same UTC-day rule on both Web and API; local log and SQLite inspection were read-only and excluded credentials, URLs, window titles, and content.
- No package typecheck, lint, test, or build was required because no product code changed. Real Reports refresh after 09:30 was not controlled in this task; code and current system time predict that August 7 becomes selectable after that boundary.
- Remaining product decision: retain UTC summaries and make the boundary more prominent, or implement tenant/viewer-time-zone report-day semantics end to end. Changing only the HTML date maximum would be incorrect because it would label a UTC bucket as a local calendar day and would split Adelaide's 09:00-09:29 work across the wrong apparent date.
- Recommendation: the Agent recovery path passes this incident review. Treat local-calendar reporting as a separate scoped Web/API aggregation change with boundary tests; do not alter Desktop collection or retry behavior to address it.

## 2026-08-06 Browser Extension 0.5.17 CandidGrid Branding

### Original Task Brief

- Replace the Browser Extension's old user-visible WorkMap name and logo with the new product brand `CandidGrid`, using `workmap/apps/web/public/brand/candidgrid-mark.png` as the authoritative mark.
- Keep the work Browser-only, preserve the existing MV3 Tracking v2 architecture and the uncommitted 0.5.16 policy-boundary reliability fix, and do not touch concurrent Desktop Agent or Web implementation work.

### Changed Files And Implementation Summary

- `workmap/apps/browser-extension/manifest.json`, `package.json`, and `src/trackingV2Types.ts`: release identity moved to 0.5.17; the manifest name is now `CandidGrid Domain Tracking Alpha` and declares 16/32/48/128 CandidGrid icons.
- `workmap/apps/browser-extension/icons/candidgrid-{16,32,48,128}.png`: deterministic transparent icon sizes derived from the repository's authoritative 512px CandidGrid mark. The Web source image was read but not modified.
- `workmap/apps/browser-extension/options.html` and `options.css`: Options title/header/favicon now use the CandidGrid name and mark.
- `src/backgroundV2.ts`, `contentRegistration.ts`, `extensionApi.ts`, `hostnameExclusions.ts`, `options.ts`, and `optionsDiagnostics.ts`: all user-visible pairing, permission, policy, retry and diagnostic copy now says CandidGrid.
- `scripts/build-alpha.mjs` and `package-alpha.mjs`: unpacked builds include the icon directory and the release archive is named `CandidGrid-Browser-Extension-<version>.zip`.
- `test/service-worker.test.ts` and `test/sync-diagnostics.test.ts`: version/copy assertions were updated and new regression checks verify the manifest brand, exact icon dimensions, build packaging, CandidGrid archive name and absence of the old visible brand.
- Generated `alpha-unpacked` was rebuilt with the 0.5.17 manifest, CandidGrid Options page and icons.

### Compatibility, Access, And Intentionally Unchanged Behavior

- Internal upgrade identifiers deliberately remain unchanged: `@workmap/browser-extension`, lowercase `workmap:*` runtime messages, `workmapConfig`/`workmapStatus` storage fields, IndexedDB/queue identities, deployed API paths and `X-WorkMap-Request-Id`. These are protocol/storage compatibility identifiers, not visible product branding; renaming them would risk losing pairing, durable queue data or backend request correlation during upgrade.
- No collected field, hostname-only privacy rule, credential handling, policy/lease/acknowledgement behavior, Focus/idle/open-runtime logic, API contract, Reports calculation, schema, tenant/RBAC boundary, Desktop Agent or Web source behavior changed in this branding round.
- The uncommitted 0.5.16 event-boundary lease closure and four-minute policy refresh improvement remain included in 0.5.17.

### Verification, Artifact, Manual QA, Risks, And Next Step

- Browser Extension typecheck: pass. Lint: pass. Full tests: pass, 84/84. Build: pass. Release ZIP: pass. `git diff --check`: pass before the final handoff update.
- Artifact: `workmap/artifacts/browser-extension/CandidGrid-Browser-Extension-0.5.17.zip`, 71,153 bytes, SHA-256 `4D733EFE52ED3DA7B7971C8E21B464340D4F3423C24BF8B794893B3125D3E298`; ZIP inspection found 26 entries and manifest name/version/icons all match 0.5.17 CandidGrid.
- Real Chrome/Edge load-unpacked upgrade was not run. Required manual acceptance: load the rebuilt `alpha-unpacked`, verify the extension list/icon and Options title/logo, confirm existing pairing survives, and confirm heartbeat, snapshot, accepted intervals and Domain open/runtime continue normally.
- No Chrome Web Store, Edge Add-ons, GitHub Release or production deployment was performed. Automated implementation is ready for the Browser-only manual acceptance round; store publication should wait for that check.

## 2026-08-06 Browser Extension 0.5.16 Event-boundary Lease Closure

### Original Task Brief And Confirmed Cause

- Investigate a local Edge 0.5.15 batch of 15 `POLICY_REJECTED` Browser intervals shown both in Options diagnostics and the Owner Reports live card, and implement a Browser-only fix once the cause exceeded 95% confidence.
- The local unpacked 0.5.15 background/manifest hashes matched the workspace build and its files predated the August 6 rejection, so this was not stale 0.5.14 code. All 15 interval rejections and one `SNAPSHOT_POLICY_LEASE_INVALID` occurred in one 11:38:51 request; the replacement lease was issued 14 seconds later at 11:39:05.
- Confirmed cause: alarm/keepalive closure used the authorised policy boundary, but browser-event paths such as tab/navigation/blur/lock called `clearFocus()` or `clearOpenRuntime()` with the later event time. When one arrived just after lease expiry, every concurrently open hostname could produce a final interval crossing the old lease window, and the API correctly rejected the whole group. The client policy refresh cadence also exactly matched the API's five-minute lease-reuse cutoff, leaving no timing margin before expiry.

### Changed Files And Implementation Summary

- `workmap/apps/browser-extension/src/backgroundV2.ts`: all Focus and Domain open/runtime clear paths now use a shared authorised close calculation. While policy is healthy, real browser-event timing is unchanged; after a policy window/lease ends, closure is clamped to the latest authorised UTC boundary and cannot extend through the late event.
- `workmap/apps/browser-extension/src/trackingV2Types.ts`: Browser version is 0.5.16 and policy refresh cadence is four minutes, intentionally below the API's unchanged five-minute reuse cutoff.
- `workmap/apps/browser-extension/test/browser-open-runtime-v2.test.ts`: adds an exact lease-expiry event sequence proving Focus plus two parallel runtime hostnames all end at the authorised boundary rather than the later browser event.
- `workmap/apps/browser-extension/test/policy-lease-recovery.test.ts`: asserts that the client refresh cadence remains shorter than the API reuse cutoff.
- `workmap/apps/browser-extension/package.json`, `manifest.json`, generated `alpha-unpacked`, and version assertions were updated to 0.5.16. No Desktop Agent, API, shared validation, Web/Reports, schema, policy permission, tenant/RBAC or privacy collection behavior changed. Concurrent uncommitted Web changes were preserved and not edited.

### Verification, Artifact, Manual QA, And Remaining Risk

- Browser Extension typecheck: pass. Lint: pass. Full tests: pass, 82/82. Build: pass. Release ZIP: pass.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.16.zip`, 52,301 bytes, SHA-256 `516F7181CFB87922E8A760E5EB8DD68965C0470968D981A050D00BACE92D264C`; the ZIP contains 22 expected files and its manifest reports 0.5.16.
- Real Edge/Chrome load-unpacked upgrade and a live lease rollover were not manually run. Required acceptance is to preserve pairing while upgrading, keep several different eligible hostnames open across a lease rollover, and confirm no new interval dead letters or snapshot-lease rejection loop appears.
- The existing 15 terminal 0.5.15 dead letters remain immutable evidence, stay excluded from Reports, and cannot be safely reconstructed or backfilled. 0.5.16 prevents future browser-event closure from creating that cross-boundary batch; it does not erase historical diagnostics.

## 2026-08-06 Home Product Tabs Real-screen Styling

### Original Task Brief

- Modify frontend presentation only. Keep the existing third Virtual Office tab and replace the first two homepage product-tab illustrations with authentic WorkMap project-page imagery.
- Use fictional names/data in public marketing imagery. Preserve all authentication, data fetching, API, report aggregation, RBAC, tenant isolation, Desktop Agent, and Browser Extension behavior.
- Keep the result clean and responsive on desktop and mobile.

### Changed Files And Implementation Summary

- `workmap/apps/web/app/page.tsx`: replaced the Work visibility signal-ledger illustration with a real Dashboard capture and the Reports capability-list illustration with a real Reports capture; added one presentation-only reusable image wrapper and descriptive alternative text.
- `workmap/apps/web/app/home.module.css`: removed CSS used only by the two deleted abstract illustrations and added the screenshot frame/elevation plus a narrower mobile radius/elevation rule.
- `workmap/apps/web/public/marketing/workmap-dashboard-demo.png`: repository project-route capture using the real WorkMap shell, project fields, pixel avatars, and fictional Demo Workspace employees.
- `workmap/apps/web/public/marketing/workmap-reports-demo.png`: repository project-route capture using the real WorkMap Reports surface and fictional Demo Workspace values.
- `workmap/apps/web/tsconfig.tsbuildinfo`: tracked incremental TypeScript metadata regenerated by the required Web typecheck/build verification; no runtime source or contract is stored there.
- `design-qa.md` and `.codex_previews/home-product-screenshots/*`: recorded normalized source/implementation comparisons and desktop/mobile browser evidence. Preview files are QA evidence, not runtime assets.

### Role, Access, And Behavior

- Public homepage tab selection and links are unchanged. The Virtual Office tab and panorama are unchanged.
- The screenshots are static public marketing assets and do not call APIs or expose a real tenant. Visible names are fictional: Mia Manager, Ethan Engineer, and Sofia Sales; the workspace is labeled Demo workspace.
- No role permission, route guard, session behavior, tenant/company boundary, data request, report calculation, tracking client, policy, or backend contract changed.

### Verification And Manual QA

- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/web lint`: pass.
- `pnpm.cmd --filter @workmap/web build`: pass; the existing non-blocking Next ESLint-plugin warning and webpack cache snapshot warnings remain.
- Browser QA: pass at 1600 x 900 and 390 x 844. Work visibility/Reports tab switching, image rendering, stacking, horizontal mobile tab rail, screenshot containment, and browser console errors were checked. No console errors were found.
- Product Design normalized source/implementation comparison: pass; see `design-qa.md`.

### Intentionally Unchanged, Remaining Risk, And Next Step

- No Dashboard, Employees, Reports, authentication, API, schema, RBAC, tenant isolation, Desktop Agent, Browser Extension, deployment, or tracking logic changed.
- The source captures intentionally display development/demo labels so public imagery cannot be mistaken for live customer data. The marketing screenshots will need manual replacement only if the authenticated product shell receives a future major visual redesign.
- This frontend-only round is ready to proceed to deployment/visual acceptance.

## 2026-08-04 Browser Extension 0.5.15 Policy-lease Recovery

### Original Task Brief And Confirmed Cause

- Investigate local Edge 0.5.14 after a healthy recovery left 11 `POLICY_REJECTED` dead letters and repeated `SNAPSHOT_POLICY_LEASE_INVALID` diagnostics, and implement a Browser Extension-only fix if the cause could be established with at least 95% confidence.
- The unpacked local Edge installation was identified without reading its protected credential. Its `dist/backgroundV2.js` SHA-256 and manifest SHA-256 exactly matched the workspace 0.5.14 `alpha-unpacked` files, so the local event was reproduced against the current source rather than an unknown build.
- Confirmed cause: startup fetched and installed the refreshed policy before sealing durable Focus and Domain open/runtime checkpoints. Reconstructed old occurrence times were therefore labelled with the new lease; the API correctly rejected the batch because those times were outside that lease's authorised UTC windows. One Focus tail plus multiple concurrently open hostnames explains the single-request group of 11 rejections.
- A rejected live snapshot could remain in `latestSnapshot` and be sent again after `SNAPSHOT_POLICY_LEASE_INVALID`, producing the repeated safe diagnostics visible in Options.

### Changed Files And Implementation Summary

- `workmap/apps/browser-extension/src/backgroundV2.ts`: seals the last durable Focus/open-runtime observation under the policy stored with that checkpoint before installing a replacement lease, clears obsolete live-snapshot state during recovery, applies the same ordering during periodic policy refresh, schedules prompt delivery of the sealed tail, and removes a terminally rejected snapshot from the next sync while retaining its bounded rejection diagnostic.
- `workmap/apps/browser-extension/src/trackingV2Store.ts`: allows the atomic Focus interval/state transaction to persist an intentionally absent current snapshot.
- `workmap/apps/browser-extension/test/policy-lease-recovery.test.ts`: adds runtime tests for old-lease Focus/open-runtime recovery, startup lease ordering, and no resend after terminal live-snapshot lease rejection.
- Version metadata and assertions moved from 0.5.14 to 0.5.15 in `package.json`, source/generated manifests, `trackingV2Types.ts`, and `service-worker.test.ts`.
- No Desktop Agent, API, Web/Reports behavior, schema, policy authorization, tenant/RBAC boundary, credential handling, or privacy collection field changed. Existing dead letters remain immutable evidence and are not inserted into Reports or fabricated/backfilled.

### Verification, Artifact, Manual QA, And Remaining Risk

- Browser Extension typecheck: pass. Lint: pass. Full tests: pass, 80/80. Build: pass. Release ZIP: pass. `git diff --check`: pass.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.15.zip`, 51,726 bytes, SHA-256 `5AC8017DBF9E2AE8E93F88A9878A5BB071A9B94354158D3031D2C2805F6FC0DE`; ZIP, alpha-unpacked and package manifests all report 0.5.15.
- Real Edge/Chrome load-unpacked upgrade and a live lease rollover were not manually run. Required acceptance: upgrade the paired 0.5.14 profile to 0.5.15, preserve pairing, keep several different eligible domains open across a policy refresh/service-worker restart, and confirm new intervals are accepted/duplicate with no new `POLICY_REJECTED` or repeated `SNAPSHOT_POLICY_LEASE_INVALID` entries.
- The 11 historical 0.5.14 dead letters cannot be safely relabelled or recovered because the server has already terminally rejected them; 0.5.15 prevents the same cross-lease corruption for future checkpoints. The implementation is ready for the manual Browser-only acceptance round, but not store publication without that QA.

## 2026-07-31 Local Focus-idle Interval Recovery Review

### Original Task Brief And Findings

- Attempted to list every Focus Idle period recorded today by the current computer's Desktop Agent.
- The local v2 SQLite store is an outbox, not a historical ledger. `acknowledge()` deletes successfully confirmed pending intervals, so the live database retains only pending/dead-letter rows plus the current runtime checkpoint. Today's accepted Focus Idle rows are no longer present locally.
- Today's redacted NDJSON contains lifecycle/policy/sync request metadata and interval counts but deliberately omits interval metric, App identity and start/end boundaries. SQLite recovery found zero deleted 2026-07-31 Focus Idle rows. The current checkpoint was Active, so it did not expose an ongoing Idle interval either.
- The authoritative complete intervals remain in the backend `ActivityInterval` ledger. The local device id required for a narrow read-only query was identified without exposing its protected credential, but the available controlled browser did not have an authenticated Supabase session and no local `DATABASE_URL` was present.

### Scope And Next Step

- No Agent, Browser Extension, API, Web, database, policy or local queue data changed. No credential, window title, page content or user input was printed.
- To produce the exact Adelaide-time ranges, run a read-only backend query filtered to this device, `DESKTOP_APP`, `FOCUS`, `FOCUS_IDLE`, and the 2026-07-31 local-day bounds, then merge contiguous settlement chunks. Authentication or a user-run SQL result is still required.

## 2026-07-31 Employee Desktop Agent Diagnostics Review

### Original Task Brief And Finding

- Reviewed another monitored employee's Desktop Agent screenshots after three same-day no-response `NETWORK_ERROR` entries and one HTTP 200 `SNAPSHOT_POLICY_LEASE_INVALID` entry.
- Current state is healthy and server-confirmed: heartbeat and last sync are current at 2:20:36 PM, one interval was accepted with zero duplicate/zero rejected, confirmed-through is current at 2:20:03 PM, the queue contains only one pending row and zero rejected rows, and the refreshed v3 policy lease is active through the next day.
- The 10:19 AM snapshot lease rejection recovered automatically; the displayed policy lease was reissued at 10:19:33 AM. The three network failures were transient and later successful synchronization proves they are not the current connection state.

### Scope And Recommendation

- No Desktop Agent, Browser Extension, API, Reports, database, policy or deployment code changed in this read-only review.
- Observe that the single pending row drains and that `No active app` changes when an ordinary App is foreground. Investigate only if pending grows or remains stuck, confirmed-through stops advancing, a normal foreground App remains unresolved beyond several seconds, or new network failures repeat frequently. Compare timestamps across employees to distinguish shared API outages from the employee computer's network/VPN.

## 2026-07-31 Cognito Session Exit Home Redirect

### Original Task Brief And Confirmed Cause

- Investigate when the current Web project exits Cognito login and prevent authenticated pages such as `/reports` from remaining mounted with `Cognito session expired. Sign in again.`. A confirmed ended login must return to the public home page `/`.
- Keep the change strictly inside Web authentication/navigation behavior. Do not alter Reports data aggregation/fetch contracts, API endpoints, RBAC, tenant isolation, Desktop Agent, Browser Extension, tracking, or device data.
- Confirmed screenshot cause: Reports calls the shared authentication resolver directly. A terminal refresh failure could be returned as displayable text while a warm AppShell cache skipped its older missing-session branch, leaving the protected page visible.

### When WorkMap Ends A Login

- Explicit user logout or removal/corruption of the stored `workmap.cognitoSession` ends the local browser login.
- A short-lived access/ID token expiring does **not** end login while a valid refresh token or Amplify session can renew it.
- Login ends when Cognito explicitly rejects renewal: `invalid_grant`, Cognito `401/403`, `NotAuthorizedException`, invalid/expired refresh credentials, no authenticated Cognito user, or an equivalent terminal response such as a disabled/revoked account.
- After an API `401`, WorkMap still force-refreshes once and replays the original request once. Only a second `401` after that successful refresh is treated as a confirmed unusable WorkMap authentication session.
- Temporary network, provider, rate-limit, or server refresh failures remain retryable, preserve the stored session, and do not redirect.

### Changed Files And Implementation Summary

- `workmap/apps/web/lib/auth/cognitoRedirect.ts`: both missing-session and confirmed-ended-session protected routes now use `window.location.replace("/")`; the forced ended-session path cannot be blocked by stale local session data.
- `workmap/apps/web/lib/auth/cognitoUserPoolAuth.ts`: terminal Cognito restore outcomes trigger the home replacement inside the shared authentication layer before a page can retain the failure as its own state.
- `workmap/apps/web/lib/api/apiClient.ts`: a second Cognito-authenticated API `401` after the existing single forced refresh clears the local session and replaces the protected route with `/`. Request payloads, response adaptation, non-401 errors, retry count, and data endpoints are unchanged.
- `workmap/apps/web/components/auth/CognitoSessionNavigationGuard.tsx` and `app/layout.tsx`: a read-only global navigation guard catches a missing session on protected-route mount/focus/visibility and cross-tab local-storage logout. Public `/`, `/login`, `/login/callback`, and `/invite/:token` remain public.
- `workmap/apps/web/components/office/useVirtualOfficeRealtime.ts`: replaced the obsolete expired-session display copy only; its socket URL, token restoration call, reconnect timing, movement protocol, polling fallback, and data handling are unchanged. The terminal restore now redirects centrally before this fallback copy can become a retained page state.
- Updated `cognito-protected-redirect.test.ts`, `cognito-session-refresh.test.ts`, `docs/skills/frontend-skill.md`, this handoff, and `latest-qa.md`. Required typecheck regenerated tracked `workmap/apps/web/tsconfig.tsbuildinfo`.

### Role, Access, Verification, And Manual QA

- The redirect is role-neutral and applies to Owner, Manager, Employee, IT Admin, and Platform Admin only after authentication is absent or conclusively unusable. It does not change any role permission or tenant/company boundary.
- Focused Cognito tests: pass, `9/9`.
- Full Web tests: pass, `106/106`.
- Web typecheck: pass. Web lint: pass. Web production build: pass; the existing non-blocking Next ESLint-plugin warning remains.
- Manual browser QA with a real deployed Cognito account/session was not run. Automated tests cover missing session, terminal invalid refresh, retryable refresh preservation, one-refresh API recovery, second-401 termination, stale local session data, and public-route exclusions.

### Intentionally Unchanged, Remaining Risk, And Next Step

- No Reports component, usage/device request, backend/API service, database/schema, policy, RBAC, tenant isolation, Desktop Agent, Browser Extension, tracking runtime, deployment variable, or Cognito token lifetime changed.
- A real deployed provider/session-expiry smoke remains the final environment-level acceptance gap. Deploy the Web-only change, invalidate one test refresh token while `/reports` is open, and confirm the browser immediately replaces Reports with `/`; also verify a temporary offline period preserves login and later recovers.
- The implementation and automated verification pass; the project can proceed to the deployment/manual acceptance round.

## 2026-07-30 App-versus-Domain Focused-idle Diagnosis

### Original Task Brief And Confirmed Cause

- Investigated why Reports shows roughly 48 minutes of focused idle for Microsoft Edge while the visible Browser Domain rows contain only roughly two minutes of focused idle in total.
- Desktop and Browser metrics are independent ledgers. Desktop Agent attributes idle to Edge while Edge remains the Windows foreground App after the shared 60-second no-input threshold. Browser Extension requires a focused, non-minimized browser window, an eligible HTTP/HTTPS active tab, a visible/focused content-script proof and trusted page interaction evidence before attributing time to a hostname.
- The Browser Focus engine itself supports `FOCUS_IDLE`, but the current v0.5.14 runtime handles Chrome's 60-second `idle` state by setting the collector to `PAUSED` and immediately calling `clearFocus()`. That ends the hostname timeline at the idle boundary instead of keeping the last proven focused hostname in the idle state. The small Domain Idle values are therefore mostly callback/checkpoint timing around that boundary, not the full period for which Edge remains foreground and the user is away.
- Reports and API preserve the two sources separately and faithfully sum their accepted intervals; they do not copy App idle into Domain rows. The visible Domain Focus Active total is close to Edge Focus Active, which is consistent with active hostname capture working while Domain Focused Idle is systematically underrepresented by the runtime behavior.

### Scope And Safe Direction

- This was read-only diagnosis. No Desktop Agent, Browser Extension, API, Reports, database, policy, interval, queue or deployment code changed.
- Do not repair this by assigning all Edge idle to the last hostname in Reports; that would fabricate Domain evidence. A future Extension-only correction should preserve the proven hostname as `FOCUS_IDLE` on Chrome `idle`, resume it on trusted interaction, and still clear it on lock, browser focus loss, minimization, tab/domain change, protected/inaccessible pages, policy boundaries or collector failure.

## 2026-07-30 Employee Agent Intermittent Sync Review

### Original Task Brief And Finding

- Reviewed an employee Desktop Agent showing three historical failures: HTTP 502 at 2:00 PM, a no-response network error at 3:00 PM, and retryable HTTP 500 `TRACKING_SYNC_INTERNAL` at 4:02 PM.
- The current 5:03 PM diagnostics prove recovery: connection is server-confirmed online, the App snapshot is confirmed, one interval was accepted with zero duplicate/zero rejected, confirmed-through and snapshot timestamps are current, and the latest sync succeeded.
- `5 pending / 0 rejected` means five locally durable rows still await settlement; it is not evidence of rejection or data loss. It is acceptable as a transient queue only if it falls back toward zero and does not continuously grow.

### Scope And Recommendation

- No Desktop Agent, Browser Extension, API, Reports, database, policy, queue or deployment code changed in this read-only diagnosis.
- The historical failures point to temporary API/gateway/database/network interruption rather than a current Agent collector defect. Investigate their request IDs only if new failures continue, pending remains elevated for more than several minutes, or confirmed-through stops advancing.

## 2026-07-30 Ten-user Capacity Readiness Review

### Original Task Brief And Current Assessment

- Reviewed whether the currently deployed WorkMap architecture can perfectly handle 10 simultaneously online employees using Desktop Agent, Browser Extension and Web/Reports.
- Code-backed assessment: a controlled 10-user pilot is reasonable on the reported Render Standard API and Supabase Pro Micro database, but production reliability cannot be called proven or perfect without a staged concurrency/load test and provider metrics.
- Ten employees with one Desktop and one Extension represent roughly 20 tracking clients. Desktop health sync is 10 seconds, Focus/Open-runtime settlement is 15 seconds, Desktop batches are capped at 20, Browser active-session checkpointing is 20 seconds, Browser alarm maintenance is 30 seconds, and Browser batches are capped at 50. Client requests are serialized per client, persisted locally and retried with backoff.

### Backend And Infrastructure Findings

- The API limits a Supabase session-pooler Prisma client to 8 connections with a 10-second pool wait; sync transactions use 5-second acquisition/15-second transaction limits. Tracking writes use per-device/lane locks and indexed overlap queries.
- Reconciliation is removed from interactive sync and report writes: a sequential worker handles 4 quiet targets every 30 seconds, while Reports can read exact ledger fragments for dirty days.
- Visible Reports poll live state every 5 seconds and may refresh a historical summary when its revision changes. Ten collectors are lighter than ten simultaneously open, actively changing Reports pages.
- Virtual-office realtime is still in-memory per API instance with no shared pub/sub. One instance is acceptable for a 10-person pilot, but horizontal API scaling would require shared pub/sub to keep cross-instance movement coherent.

### Scope, Evidence Gap And Next Step

- This was read-only capacity research. No Agent, Extension, API, Web, schema, deployment or provider setting changed and no load test ran against production.
- Before claiming 10-user production support, run a 60-minute staging/pilot test with 10 Desktop clients, 10 Extensions and representative Reports viewers. Require queues to return to zero, no 5xx/502/P1001/pool-timeout errors, fresh heartbeats, stable Render/Supabase memory/CPU/connections, and acceptable Reports latency.

## 2026-07-30 Desktop Agent 0.6.11 Transient No-active-App Review

### Original Task Brief And Finding

- Reviewed whether the Agent briefly showing `No active app` while switching applications is expected.
- The native helper reconciles the Windows foreground window every 1 second and emits `app: null` when Windows temporarily has no foreground HWND or the foreground belongs only to excluded shell UI such as Explorer, Search, Start, or Lock UI. The renderer polls Agent state every 2 seconds, so a sub-second native transition can remain visible for roughly one UI refresh.
- Runtime v2 closes the prior Focus segment at the exact null-foreground boundary and starts the next App only after its identity is confirmed. The gap is not attributed to either App, preventing overlap or fabricated work time. Open/runtime remains a separate visible-App stream.

### Scope And Recommendation

- This was read-only behavior review. No Agent, Browser Extension, API, Reports, database, policy, interval or queue code changed and no automated test or real App-switch manual QA was run by Codex.
- A roughly 1-3 second transition is expected. A regular focused App remaining `No active app` for more than about 5-10 seconds should be treated as a collector/identity-resolution issue and investigated with the redacted diagnostics rather than dismissed as normal.

## 2026-07-30 Desktop Agent 0.6.11 Auto-start Label Diagnosis

### Original Task Brief And Finding

- Investigated whether an installed 0.6.11 Agent continuously showing `Starts with Windows: Enabling...` is normal while Reports and tracking otherwise work.
- It is not a real enabling/progress state and waiting will not change it. The renderer displays `Enabling...` whenever a paired Agent reports `startsWithWindows=false`.
- The installed machine has a real HKCU Windows Run entry for `electron.app.WorkMap Desktop Agent` that launches the packaged executable with `--background`, so auto-start is registered and this symptom does not indicate a collection, heartbeat, interval-upload or Reports failure.
- Root cause is code-confirmed against the repository's Electron 37.10.3 typings: `setLoginItemSettings` registers with `args: ["--background"]`, but `getLoginItemSettings()` queries without those arguments. Electron explicitly requires the same `path`/`args` for `openAtLogin` to be reported correctly.

### Scope, Verification And Next Step

- This round was read-only diagnosis; no Desktop Agent production code, installer, Browser Extension, API, Web, database, policy or tracking behavior changed.
- Verification used the installed user's filtered Windows Run entry, the current Electron main/renderer paths, and the pinned Electron API contract. No automated suite or reboot manual QA was run.
- A future minimal Agent UI fix should share the `--background` argument constant between registration and lookup, then add a regression test. It does not require an API/Web deployment or database migration.

## 2026-07-30 Desktop Agent 0.6.11 GitHub Release CI Fix

### Original Task Brief And Root Cause

- Fix the failed GitHub Actions `desktop-agent v0.6.11` release without changing Desktop Agent collection, interval construction, policy, durable queue, sync, API or Reports behavior.
- The attached complete Actions log showed that typecheck and lint passed and 74 of 75 tests passed. The only failure was the legacy PowerShell adapter's real interactive-Windows integration test timing out after four seconds on a GitHub-hosted Windows runner.
- That runner does not guarantee an interactive desktop, and its first PowerShell sampler launch may compile `Add-Type` and enumerate windows slowly. This test is not the Tracking v2 native helper used by the packaged 0.6.11 Agent.

### Changed Files And Implementation Summary

- Changed `workmap/apps/desktop-agent/test/windows-adapter.test.ts` so the environment-dependent legacy sampler smoke is skipped only when `CI=true` (or when not on Windows). It still runs on a real local Windows desktop.
- The current Tracking v2 compiled native helper remains protected by its build-time real-process protocol smoke, which requires initial foreground, visible-App and `HEALTHY` events before packaging succeeds.
- Updated `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.
- No production source, package version, installer contents, Browser Extension, API, Web, database, migration, deployment variable, policy, tenant/device credential, RBAC or Owner/Employee boundary changed.

### Verification, Manual QA And Next Step

- CI-mode focused test: pass, 6 passed / 1 intentionally skipped.
- Local real-Windows Desktop suite: pass, 75/75; the legacy sampler integration test executed and returned consecutive privacy-minimised observations.
- Desktop `typecheck` and `lint`: pass.
- Windows NSIS `release:windows`: pass after the sandbox-only network restriction was retried with network approval; `WorkMap-Desktop-Agent-Setup-0.6.11.exe` and blockmap were produced.
- No new installed-device or live Reports manual QA was run because this is test-only CI stabilization. The 0.6.11 installed/live smoke from the preceding handoff remains required.
- Do not rerun the old failed Run #23 because it uses the old commit. Commit and push this test/docs fix, then manually dispatch `Publish Tracking Clients` from the new commit with target `desktop-agent`. Keep version `0.6.11`; the failed run stopped before creating its tag/release.

## 2026-07-30 Desktop Agent 0.6.11 Native-host Packaging And Recovery Fix

### Original Task Brief And Confirmed Root Cause

- Fix the newly installed 0.6.10 Agent that kept server-confirmed heartbeat/sync online while the current App snapshot remained at 11:03/11:04 AM, including after the employee fully restarted the Agent. Preserve the accepted Focus, idle, Open/runtime, queue, policy and sync behavior.
- Installed-machine reproduction proved this was not a Reports delay: the 0.6.10 process restarted at about 11:23 AM and its native activity helper exited again within seconds. Directly launching the installed helper returned exit code `-2147450726` and the safe .NET error that `workmap-windows-activity-host.dll` did not exist.
- The packaged helper was a stale 19,533,608-byte framework-dependent apphost. Although the build requested `PublishSingleFile`, its output directory was not cleaned, allowing the stale executable to survive and be packaged without its managed DLL.

### Implementation Summary

- `build-native-host.mjs` now deletes and recreates the publish directory before every publish, requires exactly one self-contained executable, and runs that executable during the build. The build passes only after the helper emits initial `foreground_changed`, `visible_apps_changed`, and `HEALTHY` protocol events.
- `WindowsActivityHostAdapterV2` now supervises the single helper process. Unexpected error/exit closes the existing runtime timeline through the unchanged health-error path, then restarts at 1s/3s/10s/30s/60s capped backoff. A healthy restart resets backoff; `stop()` cancels pending restart; duplicate starts and stale events from a replaced process are ignored.
- Native failure diagnostics retain only safe classifications such as `NativeHostDependencyMissing`; raw stderr, paths, App payloads, credentials, titles and content are not persisted.
- The native adapter marker is `1.1.1`, and Desktop/Alpha/package metadata is `0.6.11`. The tracked Alpha helper was regenerated from 19,533,608 to 70,923,615 bytes as the real self-contained binary.

### Changed Files And Boundaries

- Changed Desktop-only build/runtime/test/version files: `scripts/build-native-host.mjs`, `scripts/build-alpha.mjs`, `src/windowsActivityHost.ts`, `src/runtimeV2.ts`, `src/version.ts`, native `Program.cs`, package metadata, `gui-release.test.ts`, `windows-activity-host-v2.test.ts`, and the tracked Alpha native executable.
- Updated `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.
- Owner/Employee, tenant/device credential, policy, Focus/idle/Open-runtime definitions, interval construction, API payloads, durable queues and Reports rendering are unchanged. No Browser Extension, API, Web, database/schema/migration, deployment variable or policy-schedule change is required.

### Verification, Artifact And Manual QA

- Desktop tests: pass, 75/75, including single-instance restart, dependency-missing classification, healthy backoff reset, stop cancellation, stale-process isolation and build guard coverage.
- Desktop `typecheck`, `lint`, and `build`: pass. The clean build produced one 70,923,615-byte helper and its build-time real-process smoke passed.
- Windows NSIS release: pass. `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.11.exe`, 115,437,319 bytes, SHA-256 `5274F29C2A48499F4B4902944231AEC78FCA4F707CD491E02D19062598D00475`.
- The helper from the final `win-unpacked` release was directly executed on the real Windows machine and emitted foreground, visible-App and `HEALTHY` events with no stderr. The final installer is `NotSigned`.
- A full in-place installation of 0.6.11 and live Reports confirmation has not been run by Codex. Required manual smoke: install over 0.6.10 without deleting local data, verify current App and snapshot time advance within seconds, switch Apps, wait for a confirmed interval, and verify Reports confirmed-through advances.

### Remaining Risk And Next Step

- Activity not observed while the 0.6.10 helper was absent cannot be reconstructed; 0.6.11 resumes honest measurement from its first valid observation.
- Authenticode remains unsigned, so Windows SmartScreen trust remains an existing release risk.
- Proceed to install the 0.6.11 artifact on the test machine. No backend deployment or database migration is needed.

## 2026-07-30 Installed Desktop Agent 0.6.10 Native-host Exit Diagnosis

### Original Task Brief And Evidence

- Investigated why the newly installed `vdesktop-agent-windows/0.6.10` remained `Connected` in Owner Reports while `Current activity not confirmed` persisted and the last App snapshot stopped at about 11:04 AM.
- Read-only inspection of the redacted local NDJSON log showed the native Windows activity helper reported healthy at `2026-07-30T01:31:59.333Z` and then emitted `HOST_PROCESS_EXITED` at `2026-07-30T01:39:48.372Z` (about 11:09:48 AM Australia/Adelaide).
- The last HTTP 200 sync carrying an App snapshot was at `2026-07-30T01:34:17.257Z`. From `2026-07-30T01:39:52.436Z` onward, heartbeat-only syncs continued receiving HTTP 200 responses but carried no snapshot. This exactly explains the Reports split between a fresh connection and stale current App.

### Code-backed Root Cause And Scope

- `WindowsActivityHostAdapterV2` clears its child-process reference and emits a health error when the helper exits. `DesktopTrackingV2Runtime.processHostEvent()` correctly closes the active timeline and preserves heartbeat operation, but neither that error path nor the regular tick restarts the native helper.
- Waiting alone cannot self-heal this instance. Fully quitting and reopening the Desktop Agent starts a new helper and is the immediate workaround; Reports should receive a fresh App snapshot shortly afterward if policy permits collection.
- The 10:00 AM `POLICY_REJECTED` Open/runtime warning in the screenshot is historical and separate from this incident. It is not the reason the 11:04 snapshot became stale.
- No source, queue data, policy, API, Web/Reports, Browser Extension, database, credential or tracking interval was changed in this diagnosis. A follow-up Agent release should add a single-process native-helper watchdog with bounded backoff and regression tests while preserving the existing collection and sync model.

### Verification And Remaining Risk

- Verified the log sequence against `runtimeV2.ts` and `windowsActivityHost.ts`; no automated suite was run because this round was read-only diagnosis.
- Real installed-Agent evidence confirms 0.6.10 does not recover automatically from this native-helper exit. The exact underlying native process exit cause was not persisted, so it cannot be recovered from the existing redacted log; the missing watchdog behavior is nevertheless proven.

## 2026-07-30 Desktop Agent 0.6.10 Startup And Lease-recovery Hardening

### Original Task Brief

- Implement the two confirmed Desktop 0.6.9 defects as a small Agent-only release: a paired Electron process could remain alive without a Tracking v2 runtime after one transient protected-config read failure, and startup recovery could relabel an old Focus/Open-runtime tail with a newly fetched policy lease, producing terminal `POLICY_REJECTED` rows.
- Preserve the accepted foreground-App sampler, idle threshold, visible-App/Open-runtime engine, interval settlement, durable queue, retry/backoff, sync payload, API policy enforcement and Reports behavior.

### Implementation Summary

- Added a bounded runtime-start coordinator with 1s/3s/10s/30s/60s retries. A later successful UI config read can also self-heal after that initial retry budget, so the employee does not need to restart Windows merely because the protected config was temporarily unavailable.
- Electron state no longer describes a paired process with no runtime as `Recording locally`. Until runtime startup succeeds, it clears the stale fallback current-App display and explicitly says activity is not being collected while startup is retried.
- Captures the persisted policy that originally authorised a crash-recovery tail before fetching the current policy. A recovered Focus/Open-runtime tail is queued with that original policy version/lease only when every recovered timestamp remains inside that original lease and allowed UTC window.
- A tail that cannot be proven against its original stored lease is not relabelled or queued. Only that unconfirmed tail is cleared, and a privacy-safe diagnostic is written. Existing queued intervals, confirmed history and dead letters are not changed or deleted.
- Normal same-lease recovery remains active. After recovery is closed, new Focus/Open-runtime epochs use the current lease exactly as before.
- Bumped the Desktop package, native-host user-facing version and Alpha package to `0.6.10`; regenerated the tracked Windows native helper and built the NSIS installer.

### Changed Files

- `workmap/apps/desktop-agent/src/runtimeStartup.ts`
- `workmap/apps/desktop-agent/src/electron/main.ts`
- `workmap/apps/desktop-agent/src/runtimeV2.ts`
- `workmap/apps/desktop-agent/src/version.ts`
- `workmap/apps/desktop-agent/src/windowsActivityHost.ts`
- `workmap/apps/desktop-agent/test/runtime-startup.test.ts`
- `workmap/apps/desktop-agent/test/runtime-v2-boundary-serialization.test.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/scripts/build-alpha.mjs`
- `workmap/apps/desktop-agent/alpha-windows/package.json`
- `workmap/apps/desktop-agent/alpha-windows/native/windows-activity-host/publish/workmap-windows-activity-host.exe`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Verification, Artifact And Boundaries

- `pnpm --filter @workmap/desktop-agent test`: pass, 73/73. New coverage proves transient config self-healing, UI-triggered recovery after the bounded budget, original-lease recovery across a lease refresh, same-lease recovery and rejection of an unverifiable out-of-window tail.
- `pnpm --filter @workmap/desktop-agent typecheck`: pass.
- `pnpm --filter @workmap/desktop-agent lint`: pass.
- `pnpm --filter @workmap/desktop-agent build`: pass, including the native Windows activity host.
- `pnpm --filter @workmap/desktop-agent release:windows`: pass. Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.10.exe`, 98,747,615 bytes, SHA-256 `BEEE0916DE30E2D2282F2F8B5C57C711738B3E8BBD39D8B02C44E81BF536B7E0`.
- Installer Authenticode status is `NotSigned`; this is an existing distribution risk and was not misrepresented as signed.
- Owner/Employee, tenant/device credential, policy and privacy boundaries are unchanged. No Browser Extension, API, Web/Reports, schema, migration, database, deployment environment or policy schedule changed.
- No real installed-Agent Windows regression was run by Codex. Required manual QA: upgrade 0.6.9 to 0.6.10 without deleting local data, verify runtime/heartbeat/policy start automatically, pending drains, confirmed-through advances, the historical rejected count remains visible, and restart across a lease change creates no newly relabelled `POLICY_REJECTED` rows.

### Remaining Risk And Next Step

- The existing 61 dead letters remain historical evidence; 0.6.10 prevents this startup defect from manufacturing more but does not erase them.
- If an old unconfirmed tail references a missing/invalid original lease or lies outside its original window, it is intentionally not counted because the server cannot lawfully verify it.
- Proceed to commit/push and distribute the 0.6.10 installer only after the stated local upgrade/restart smoke. No backend or database deployment is required for these two fixes.

## 2026-07-30 Desktop 0.6.9 Cross-lease Open/runtime Recovery Diagnosis

### Original Task And Exact Evidence

- Investigated why one Desktop Agent's terminal rejected count increased from 56 to 61 after the current release. The new diagnostic was one HTTP 200 request at July 30, 2026 10:00:17 AM Australia/Adelaide with request ID `0a458663-f0e9-4c44-b76f-61219165f0b5`; the API accepted the sync envelope/health but terminally rejected five completed intervals as `POLICY_REJECTED`.
- Read-only inspection of the local SQLite queue confirmed all five rows were `OPEN_RUNTIME` intervals, not Focus intervals. They shared an old occurrence range of `2026-07-29T07:30:14.347Z` through `2026-07-29T07:30:31.414Z` (about 5:00 PM Adelaide on July 29) but were created/enqueued during the July 30 10:00 AM startup.
- The five rows used the newly fetched v3 lease issued at `2026-07-30T00:30:10.530Z`. That lease's first allowed window began at the same July 30 timestamp, so the July 29 occurrence timestamps were outside the lease. The API therefore correctly rejected the rows. No App names, credentials, tokens, window titles or content were read or recorded during inspection.

### Code-backed Root Cause

- Desktop Agent startup fetches and assigns the current policy before recovering persisted Focus/Open-runtime tails. `closeRecoveredV2Tail()` recreates the Open/runtime engine from the prior persisted clock/checkpoint while passing the newly fetched policy.
- The recovered old occurrence timestamps are consequently emitted with the new lease identity. This relabeling cannot make yesterday's tail valid under today's lease and is rejected by the server's correct policy/identity validation.
- The observed five-row count represents five retained Open/runtime checkpoint lanes. It does not mean five current Apps failed to upload, policy was disabled, or Reports lost five Focus-active intervals. These five terminal rows are excluded from confirmed report totals.

### Changed / Unchanged / Required Follow-up

- Documentation only in this round. No Desktop Agent, API, Web, Browser Extension, database, Reports, policy configuration, queue data or dead-letter history was changed or deleted.
- Implemented in 0.6.10: a valid recovered checkpoint keeps its original stored lease instead of being relabelled. Only a tail that cannot be verified inside that original lease/window is discarded; the next live epoch starts under the current lease. Same-lease recovery remains covered separately.
- Added independent 0.6.10 regression coverage for changed-lease Open/runtime/Focus recovery, same-lease valid recovery, multiple retained Open/runtime lanes and runtime-startup self-healing.
- The existing 61 terminal rows remain honest historical evidence. After a fix, success means pending uploads drain, confirmed-through advances and this rejected count no longer grows from cross-lease startup recovery.

## 2026-07-30 Desktop 0.6.9 Runtime-not-started Diagnosis

### Original Task And Evidence

- Investigated an employee Desktop Agent 0.6.9 that showed `Offline - retrying`, a July 29 heartbeat/current App, one pending upload, placeholder Diagnostics (`Not confirmed`, `Not loaded`, `Not synced`) and `Agent diagnostics are not available yet`, while Owner Reports received no current App activity on July 30.
- The Diagnostics grid values are static HTML placeholders until the Electron main process exposes a live `DesktopAgentRuntimeV2`. The explicit unavailable message proves `runtime === null`; therefore the native Windows activity host and Tracking v2 runtime were not active in that application session.
- The top-level App, heartbeat and queue values came from the persisted `status.json` fallback. They are historical fallback state, not proof of current collection or current server connectivity.

### Code-backed Cause And Immediate Recovery

- At application startup, one failed/transient `loadAgentConfig()` call causes the app to skip `configureAutoStart()` and `startRuntime()`. Later UI polling can successfully load the same protected config and show the paired device ID, but `getUiState()` does not start the missing runtime. The screenshot's paired device ID plus `Starts with Windows: Enabling...` and unavailable runtime diagnostics match this path.
- Immediate non-destructive recovery is a full tray `Quit Agent` followed by reopening the installed Agent. Do not merely close the window. Pass when Diagnostics becomes live, the policy lease loads, secure heartbeat becomes current, and a request ID/sync result appears.
- Do not re-pair or delete the local data directory as the first response. If a full restart repeats the state, capture only the visible `status.error` or a redacted diagnostic/error result; never share `config.json`, protected credentials or tokens.

### Changed / Unchanged / Remaining Work

- Documentation only. No Desktop Agent, API, Web, Browser Extension, policy, schema, queue or upload code changed in this diagnosis.
- The runtime-null session did not start the native collector, so current-day App activity during that gap cannot be assumed to have been retained. Historical fallback copy should not be described as `Recording locally`.
- A follow-up Desktop release should make runtime startup recover automatically when a later config read succeeds, use bounded retry for startup failures, and render an honest runtime-not-running diagnostic instead of static placeholders. Implementation requires explicit change authorization.

## 2026-07-29 Desktop Remote-session Attribution Review

### Original Task And Confirmed Behavior

- Reviewed how the current Desktop Agent attributes time when an employee uses an outbound company Remote Desktop session.
- The local Windows activity host follows the single OS-wide foreground window. While the Remote Desktop client is foreground and receives normal local keyboard/mouse input, Tracking v2 records Focus active against that client identity (for example Remote Desktop Connection, Microsoft Remote Desktop or Windows App, depending on executable product metadata).
- The local Agent cannot see which App is foreground inside the remote server. Remote Excel, Edge and IDE work therefore remains one local Remote Desktop-client App total unless an independently authorised Agent also runs inside the remote Windows session.
- After 60 seconds without trusted local input while the Remote Desktop client remains foreground, its lane changes from Focus active to Focused idle. Switching locally to another App closes the Remote Desktop Focus lane and starts the newly foreground local App. Local lock, disconnect or suspend closes/pauses collection at that boundary.
- Full-screen versus windowed Remote Desktop does not change attribution. On multiple monitors, Windows still has one global foreground window, so only the App currently receiving local foreground input owns Focus.

### Changed / Verified / Unchanged

- Documentation only. No Desktop Agent, Browser Extension, API, Web, policy, schema, queue, upload or Reports behavior changed.
- Review covered the native `GetForegroundWindow`/process product-name resolver, local input pulses, Windows session boundaries and the Tracking v2 Focus engine's 60-second idle transition.
- No real company Remote Desktop session was run by Codex. A device-level check should confirm the exact displayed client name used by the installed RDP product.

## 2026-07-29 Connection Audit Local-day And Event-time Fix

### Original Task Brief

- Fix Owner `/reports` Connection Audit showing July 27/28 Browser blocks when the current Adelaide calendar date is July 29, and ensure opening the page at any time shows only the selected/current day's honestly stored starts, locks, sleeps, recoveries and other observable lifecycle transitions.
- Keep the change minimal and do not alter Browser Extension or Desktop Agent collection, lifecycle generation, queue, upload, focus/runtime or policy behavior.

### Confirmed Root Causes And Implementation

- Reports usage filters intentionally default to the UTC reporting date. During the Adelaide morning, that date is still the prior day, so Connection Audit inherited the wrong calendar day. Audit now resolves the current default day in the viewer's IANA time zone, expands only its API read across adjacent UTC dates, and filters the rendered entries back to the exact local calendar range. Historical selected ranges remain selected ranges.
- Browser audit presentation added inferred heartbeat loss from every stale live device without checking the audit range. Old Chrome/Edge device interruptions could therefore appear on a current-day audit even when no current transition existed. Stored and inferred Browser entries are now subject to the same local-range predicate; empty old device groups disappear.
- The API filtered lifecycle history by `recordedAt` even though the audit displays `startedAt`. An offline-retained event received later could land on the receipt day instead of the day it happened. The dedicated audit query now filters `startedAt`; tenant/user/source selection and response fields are unchanged.
- The section explicitly labels its local calendar range and time zone while preserving the existing statement that usage totals remain UTC.
- Concurrent pre-existing work on the same Reports surface separated audit loading/ready/error and preserved distinct Desktop startup events. Those edits were retained without rollback or overwrite.

### Changed Files

- `workmap/apps/web/components/reports/connectionAuditRange.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/connection-audit-range.test.ts`
- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/test/tracking-audit-event-time.test.ts`
- `docs/skills/frontend-skill.md`
- `docs/skills/api-contract-skill.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Role, Verification And Manual QA

- Owner/Manager/Team Lead/HR and selected-user tenant/RBAC resolution are unchanged. No new endpoint, credential, schema or migration was added.
- Web test passed 104/104; API test passed 59/59. Web/API typecheck, lint and build passed. The new tests cover Adelaide/Los Angeles UTC boundaries, historical ranges, exact local-day filtering, suppression of old live-heartbeat inference, retention of today's confirmed Browser start, and API lifecycle event-time query shape.
- `git diff --check` and the final secret scan are recorded in the matching QA handoff.
- Real deployed `/reports` QA was not run. Production behavior requires deploying the existing combined API/Web changes; no Agent or Browser Extension release is required for this audit-only fix.

### Remaining Risk And Next Step

- The UI never invents a startup, lock, sleep or close. A transition appears only after the client has uploaded it and the API has confirmed/stored it; unavailable audit requests are shown as unavailable rather than as zero events.
- After API/Web deployment, open `/reports` before and after Adelaide's UTC-day boundary, select the employee, and verify today shows only today's confirmed rows. Start/reload one browser profile and lock/unlock or sleep/resume once; new rows should append during silent polling without old-date device cards reappearing.

## 2026-07-29 Honest Desktop Connection Audit

### Original Task Brief

- Make Owner `/reports` Connection Audit honestly show the selected employee's confirmed Desktop Agent lifecycle transitions for the selected day/range, including normal start, lock/unlock, sleep/resume, shutdown/stop and interruption states.
- Keep the fix minimal and do not change Desktop Agent collection, focus/runtime accounting, queue, upload cadence, Tracking v2 payloads, policy, database schema, tenant/RBAC boundaries or Browser Extension behavior.

### Root Cause And Implementation

- Desktop Agent 0.6.9 already enqueues a unique confirmed `RUNNING / AGENT_STARTED` status with operation `protocol-v2-start` after each successful v2 startup. The API's consecutive-status coalescing preserved separate Browser profile starts but incorrectly returned the previous Desktop start whenever two Desktop starts had the same status/reason. If the previous row belonged to an earlier day, the new day's audit query legitimately found no stored start.
- `DevicesService` now treats a Desktop `protocol-v2-start` carrying a different `clientEventId` as a distinct lifecycle start. Retrying the same ID remains idempotent, while unrelated repeated health/status noise retains the existing coalescing behavior.
- The dedicated `/reports/tracking-audit` endpoint no longer converts failed session/status/timeline queries into successful empty arrays. A query failure now reaches the caller as a failure instead of becoming a false `0 events` result. Optional audit enrichments inside the main usage summary remain optional and unchanged.
- The Reports client now tracks audit loading/ready/error separately. Before the first confirmed response it says `Loading`, not `0 events`; on failure it says `Unavailable` and explicitly refuses to conclude that the range is empty. A failed background refresh retains and labels the last confirmed history rather than clearing rows or scroll state. Only a successful empty response renders `0 events` and `No confirmed connection events`.
- Existing Desktop wording already covers all stored v2 statuses: started, stopped by user, network offline, shutdown, sleeping, locked, crashed, terminated, service unreachable, interrupted, reconnected and restarted. That mapping was verified and not broadened with invented states.

### Changed Files

- `workmap/apps/api/src/modules/devices/devices.service.ts`
- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/test/agent-session.test.ts`
- `workmap/apps/api/test/tracking-reports-verification.test.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/connection-audit-refresh.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Role / Access / Deployment Behavior

- Existing user/tenant resolution and Owner/Manager/Team Lead/HR report-access checks are unchanged. The dedicated audit remains limited to the same authorised selected-user scope.
- No migration or new Desktop Agent/Browser Extension release is required. Production behavior requires deploying the API and Web changes.
- Previously coalesced Desktop starts were never stored and cannot be reconstructed honestly. After API deployment, each future confirmed v2 startup is retained; a start that occurred before deployment appears only if an independent stored legacy session exists.

### Verification And Manual QA

- API typecheck, lint, test and build passed; full API tests: 59/59.
- Web typecheck, lint, test and build passed; full Web tests: 104/104.
- Focused lifecycle test: 7/7. Focused Desktop/Browser audit presentation test: 13/13. Dedicated Reports verification passed, including failure propagation instead of false-empty audit history.
- One Web typecheck attempt ran concurrently with `next build` and temporarily saw `.next/types` files being regenerated; the clean sequential rerun passed. This was a verification race, not a source failure.
- `git diff --check` passed. Real deployed `/reports` QA was not run.

### Intentionally Unchanged, Risks And Next Step

- No Desktop Agent, Browser Extension, Prisma schema/migration, policy, tracking interval, live health or usage aggregation behavior changed.
- The page polls the dedicated audit endpoint every five seconds while visible; it is honest polling, not realtime push. An event still queued locally will appear only after the API confirms and stores it.
- Deploy API and Web, then start/restart one already-paired Desktop Agent, lock/unlock once, and sleep/resume once. The selected employee/day audit should add distinct confirmed rows without resetting the Agent or re-pairing the device.

## 2026-07-29 Browser Extension 0.5.14 Focus Recovery

### Original Task Brief And Evidence

- Fix Browser Extension Domain Focus undercounting. Production evidence from 0.5.13 showed server-confirmed heartbeats and Domain open/runtime progressing while the current Domain snapshot was stale, the collector remained `PAUSED`, and Reports showed `0m` Focus active for every Domain.
- Keep the existing MV3/Tracking v2 architecture and privacy boundary. Do not change Desktop Agent behavior or manufacture historical Focus for unobserved time.

### Root Cause And Implementation

- `backgroundV2.ts` previously discarded every content-script message whenever the durable `focusedWindowId` was `null`, and its general collection gate also rejected input while the collector was `PAUSED`/`LIMITED` or a delayed `chrome.idle` state remained idle. A missed/recycled MV3 reconciliation could therefore self-lock Domain Focus even though health and the independent open-tab runtime lane continued.
- Trusted activity now performs a fresh proof chain before recovery: the sender window must be the real focused, non-minimized, non-incognito browser window; the sender tab must be the eligible active tab under the existing Split View rule; the top-level hostname must be HTTP(S); host permission/content registration and the acknowledged policy lease/window must be valid.
- After that proof, trusted input can restore the durable focused-window/system-active state, recover the collector, and resume Focus from the actual input timestamp. Passive checkpoints cannot override a real system-idle boundary, and background-window messages still cannot acquire Focus.
- Focused-window, active-tab, state-persistence and open-runtime reconciliation failures now retain stage-specific safe diagnostics instead of collapsing everything into `FOCUS_RECONCILE_RETRY`.
- Version advanced from 0.5.13 to 0.5.14 in the package, source version constant, source manifest, generated unpacked manifest and version assertions.

### Changed Files

- `workmap/apps/browser-extension/src/backgroundV2.ts`
- `workmap/apps/browser-extension/src/trackingV2Types.ts`
- `workmap/apps/browser-extension/test/focus-recovery.test.ts`
- `workmap/apps/browser-extension/test/service-worker.test.ts`
- `workmap/apps/browser-extension/package.json`
- `workmap/apps/browser-extension/manifest.json`
- `workmap/apps/browser-extension/alpha-unpacked/manifest.json`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Verification, Artifact And Manual QA

- Browser Extension typecheck, lint, test and build passed. Test result: 77/77, including recovery from null focused-window/`PAUSED`, recovery from `LIMITED`, passive-checkpoint idle protection, background-window rejection and safe window-query diagnostics.
- Release ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.14.zip`; 22 entries; 51,345 bytes; embedded manifest 0.5.14; SHA-256 `F47CCBB76AEA68835D034220C2379CFCCD90A7FE2B09CCF0BAA955E524B9E5AC`.
- Real Chrome/Edge load-unpacked QA was not run by Codex. Reload/upgrade the existing unpacked installation without removing or re-pairing, then verify on an eligible foreground HTTP(S) page that collector becomes healthy, snapshot confirmation advances, accepted/duplicate Focus intervals advance confirmed-through, and Reports Focus active grows after trusted input.
- Historical unobserved time and terminal dead-letter rows are intentionally not reconstructed. This fix affects newly proven Focus after 0.5.14 runs.

### Intentionally Unchanged And Remaining Risk

- No Desktop Agent, API, Web, schema, tenant/RBAC, policy contract or Reports aggregation behavior changed.
- Open/runtime remains policy-controlled and separate from Focus. It may continue while eligible tabs remain open, but it does not prove active use.
- Release is ready for controlled Chrome/Edge load-unpacked QA, not automatic store publication or production deployment.

## 2026-07-29 Multi-monitor Focused Idle Clarification

### Original Task And Result

- Reviewed whether an Edge window left visible on one monitor accrues Focused Idle while the employee actively works in Codex on another monitor.
- It does not. The Windows host uses the OS-wide `GetForegroundWindow()` result, so all monitors share one foreground App. Clicking or typing in Codex switches the Focus lane from Edge to Codex and closes the Edge focused interval without overlap.
- Edge can continue accruing the separate Open/runtime metric while its eligible window remains open/visible and that policy lane is enabled. Open/runtime does not mean Edge was focused or actively used.
- If input stops for 60 seconds while Codex remains the foreground App, Codex—not Edge—begins accruing Focused Idle. Edge accrues Focused Idle only when Edge itself remains the global foreground App without trusted input past the threshold.

### Changed / Verified / Unchanged

- Documentation only; no Desktop Agent, Browser Extension, API, Web, policy, schema, collection, upload or report behavior changed.
- Code review covered the native Windows foreground source, runtime foreground-switch handling, and the no-overlap focus-engine test.
- No real multi-monitor Windows manual QA was run in this clarification.

## 2026-07-29 Focused Idle Current-behavior Review

### Original Task And Result

- Reviewed whether the current project collects Focused Idle. It does for both Tracking v2 Desktop App focus and eligible Browser Domain focus.
- The shared threshold is 60 seconds. The first 60 seconds after the latest trusted input remain `FOCUS_ACTIVE`; continued focus without trusted input becomes `FOCUS_IDLE`. New trusted input resumes active focus.
- Desktop lock, suspend/disconnect, unavailable input desktop, foreground switch, policy pause, or collection boundary closes/pauses the focused lane instead of attributing unlimited idle. Browser focus must remain on an eligible focused HTTP(S) tab/window.
- The API aggregates `focusedIdleMs`/`focusedIdleSeconds`, and expanded Reports App/Domain cards render `Focused idle` independently from Focus active and Open/runtime.

### Changed / Verified / Unchanged

- Documentation only; no Desktop, Browser, API, Web, policy, schema or data behavior changed.
- Focused Desktop, Browser and Reports presentation tests passed 21/21.
- Manual idle timing QA was not run in this review. Zero displayed idle can still be legitimate when no interval passes the threshold, focus is closed by lock/switch, or data is queued/rejected.

## 2026-07-28 Desktop DRAINING_V1 Observation

- User-provided Reports evidence for another employee shows Desktop Agent 0.6.9 connected with a current App snapshot, current heartbeat/sync, zero pending v2 uploads and confirmed-through at the current time, while the migration pill reads `DRAINING_V1`.
- Code review confirms `DRAINING_V1` means v2 is active while the separate pre-v2 file queue is being uploaded. The displayed health queue is `trackingV2Store.stats()` and does not include that legacy `queue.json`, so `0 pending` and `DRAINING_V1` can coexist.
- Legacy rows are sent in batches of 20; retryable failures use bounded backoff up to five minutes. Once the legacy queue reaches zero, the runtime automatically persists migration state `V2`. No code changed.

## 2026-07-28 Browser Policy Refresh Observation

- User-provided Reports evidence shows the re-enabled Chrome Extension is connected and syncing, but its first live Domain snapshot was rejected with `SNAPSHOT_POLICY_LEASE_INVALID` because it used an expired/replaced lease.
- Current Browser v2 behavior intentionally resets the policy-refresh timer, pauses/clears the rejected live snapshot, fetches the current policy on maintenance, and starts a new snapshot automatically. A later accepted snapshot clears this server diagnostic.
- A policy lease is a server-issued, device/policy/version/time-window-bound authorization that currently lasts 24 hours; lease refresh is client/server maintenance and does not require an Owner or Employee to edit policy settings.
- If the diagnostic timestamp repeatedly advances for more than 5-10 minutes, new snapshots are still being rejected and the automatic refresh loop has not converged; that requires technical diagnostics rather than an Owner/Employee policy action.
- Follow-up evidence shows Chrome still rejecting at 2:00 PM while Edge is healthy. The browsers are separate device identities with separate leases, so this does not indicate a tenant-wide policy failure.
- Code review found a matching stale-snapshot path: after a lease rejection, `clearFocus` can persist a closing snapshot carrying the old lease; when Chrome has no usable foreground window, reconciliation may not create a replacement snapshot, while later health syncs continue carrying the stale `latestSnapshot`. No Browser code has been changed yet.
- User then foregrounded Chrome on a normal HTTP(S) page and confirmed the current lease warning disappeared. This verifies that a fresh Chrome focus snapshot replaced the stale snapshot and restored live Domain confirmation without Owner/Employee policy action.
- The shown `POLICY_REJECTED` Open Runtime interval is a terminal server tombstone and is excluded from historical totals; it is not retried. No code changed.

## 2026-07-28 Post-migration Queue Recovery Observation

- User-provided production Desktop Agent evidence now shows `Agent connected`, current server-confirmed health, and successful interval batches (`20 accepted / 0 duplicate / 0 rejected`).
- The retained local queue was still large (`892 pending`) but was reported to be decreasing. `Confirmed interval through` remained behind current time, so recovery was active but not complete.
- Historical `HTTP 500`, `TRACKING_SYNC_INTERNAL` and network diagnostics from before recovery remain visible by design; they are not current failures unless new timestamps continue appearing.
- No code changed. Keep the Browser Extension disabled until Desktop pending is near steady state and confirmed-through catches up, then re-enable only one extension and observe incrementally.

## 2026-07-28 Production Migration P3009 Follow-up

- A direct retry of `prisma migrate deploy` returned `P3009` because the failed `20260728130000_tracking_query_performance` record had not first been marked rolled back.
- The local migration remains corrected and contains only transaction-compatible `CREATE INDEX IF NOT EXISTS` statements.
- Required production order remains: rotate the exposed database credential, run `prisma migrate resolve --rolled-back 20260728130000_tracking_query_performance --schema prisma/schema.prisma`, confirm success, then run `prisma migrate deploy --schema prisma/schema.prisma`.
- No application or schema change was needed for this follow-up; production recovery is still pending user execution.

## 2026-07-28 Tracking Query Migration Transaction Compatibility

### Original Task Brief And Incident

- Recover production migration `20260728130000_tracking_query_performance` after Prisma returned `P3018` / PostgreSQL `25001` because `CREATE INDEX CONCURRENTLY` cannot execute inside Prisma Migrate's transaction block.
- Preserve the already-pushed API query/pool fixes and avoid changing Desktop Agent, Browser Extension, policy, queue or report semantics.

### Changed Files And Implementation

- `workmap/prisma/migrations/20260728130000_tracking_query_performance/migration.sql`: replaced both unsupported `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements with transaction-compatible `CREATE INDEX IF NOT EXISTS` statements.
- Because the failed statement was the first operation inside a transaction, PostgreSQL did not partially create either index. The failed Prisma migration record must be marked rolled back before retrying the corrected file.
- This migration was already committed as `c9311cc` before the production failure, so the corrected migration requires a follow-up commit. No successful environment is known to have applied the original checksum.

### Deployment And Safety

- Rotate the Supabase database password before any retry because the production connection string was exposed in a screenshot. Update Render `DATABASE_URL` and the current shell variable; never commit or paste the replacement value.
- Stop tracking clients and avoid Reports during the short migration window because regular PostgreSQL index creation can temporarily block writes. Run `prisma migrate resolve --rolled-back 20260728130000_tracking_query_performance`, then `prisma migrate deploy` with the corrected migration.
- After migration success, deploy/restart Render, enable one Desktop Agent, and verify queue drainage before restoring additional clients.

### Verification / Unchanged / Risk

- `git diff --check`: passed.
- `prisma validate --schema prisma/schema.prisma` with a non-production placeholder URL: passed.
- Installed Prisma CLI help confirms the recovery syntax `migrate resolve --rolled-back <migration> --schema <schema>`.
- Prisma schema and index definitions are unchanged; only the migration execution form changed.
- No application, Desktop, Browser, Web, auth/RBAC, tenant, policy or stored-data behavior changed in this correction.
- Production retry and real queue-drain QA are not run. Index build duration depends on current table size and database load; keep clients stopped until the command completes.

## 2026-07-28 Supabase Query And Lock-Pressure Fix

### Original Task Brief

- Continue the Tracking v2 recovery after the user upgraded the Supabase organization to Pro and moved the production database from Nano to Micro.
- Use the supplied Supabase PostgreSQL log to fix the remaining database bottleneck without changing Desktop Agent or Browser Extension collection/sending behavior.

### Confirmed Root Cause

- The supplied Supabase sample contained 21 PostgreSQL `57014` statement timeouts in 47 records.
- Tracking v2 overlap reads took roughly 38-91 seconds. The query filtered by device/lane/time but omitted `companyId`, so it could not use the existing company-leading time index and held the serialized `ClientWriteLane` transaction lock while scanning.
- A `ClientWriteLane` upsert waited roughly 56 seconds, consistent with overlapping sync transactions queued behind the slow overlap read.
- The legacy `ActivityEvent` company coverage group-by used by `/reports` took roughly 102 seconds because the available user-oriented index did not lead with the requested company/date range.

### Changed Files And Implementation Summary

- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`: the overlap lookup now includes the authenticated `companyId` alongside device/source/stream/time. Acceptance, duplicate and overlap semantics are unchanged; the predicate both strengthens tenant bounding and enables the intended lane/time index path.
- `workmap/apps/api/test/tracking-v2-live-semantics.test.ts`: captures the overlap query and asserts that it is scoped to the authenticated company and device while preserving the existing same-App runtime overlap rejection test.
- `workmap/prisma/schema.prisma`: adds an `ActivityInterval(companyId, deviceId, source, stream, endedAt)` index for recent overlap candidates and an `ActivityEvent(companyId, startedAt, userId)` covering index for company/date coverage reads.
- `workmap/prisma/migrations/20260728130000_tracking_query_performance/migration.sql`: adds both indexes with transaction-compatible PostgreSQL `CREATE INDEX IF NOT EXISTS`; apply it during a bounded maintenance window with tracking clients stopped.
- The earlier uncommitted Prisma `pool_timeout=10` fail-fast hardening and its tests are preserved as part of the same recovery deployment.

### Role, Collection And Data Behavior

- Owner/Employee/tenant/device credential boundaries are unchanged. The overlap query now explicitly carries the already-authenticated tenant id.
- Desktop 0.6.9 and Browser 0.5.13 source, versions, SQLite/storage queues, interval payloads, retry behavior, Focus/open-runtime rules, policy leases and privacy fields are unchanged.
- No queued, accepted, duplicate, rejected, summary or audit row is rewritten or deleted.

### Verification

- Focused Tracking v2 semantics test: passed 14/14.
- Full API test: passed 57/57.
- API typecheck, lint and build: passed.
- Prisma schema validation: passed with a non-secret local placeholder datasource URL; the existing Prisma 7 configuration deprecation warning is informational.
- Production migration, Render deployment, post-deploy SQL timing and real Windows queue-drain QA were not run.

### Intentionally Unchanged, Remaining Risks And Next Steps

- No Web UI, Desktop Agent, Browser Extension, policy schedule, auth/RBAC or report calculation code changed.
- The new indexes do not exist in production until the corrected `prisma migrate deploy` succeeds. Resolve the failed migration as rolled back, retry it during a bounded maintenance window, do not use `db push`, and do not clear client queues.
- Deploy/restart the Render API after the database is healthy. Start with one Desktop Agent and require pending to decrease, server-confirmed heartbeat/confirmed-through to advance and terminal rejected to stay unchanged. Then re-enable the second client set incrementally.
- Recheck Supabase Query Performance after traffic resumes. The previous 38-102 second query shapes should disappear; if they remain slow after the new indexes are built, capture fresh `EXPLAIN (ANALYZE, BUFFERS)` evidence before buying Small compute.

## 2026-07-28 Supabase Outage Fail-Fast / API Pool Wait Hardening

### Original Task Brief

- Investigate why a single installed Desktop Agent 0.6.9 continued accumulating hundreds of pending Tracking v2 rows after every other Desktop Agent and Browser Extension was stopped.
- Correlate the supplied Render output with the local Agent diagnostics, solve the incident without changing Desktop/Browser collection semantics, and preserve queued data.

### Confirmed Incident Evidence

- The current Agent is 0.6.9 and its local NDJSON confirms the new 20-row batch plus 5/15/30/60-second global retry gate is active. This is not an old-client retry storm.
- Matching Render request IDs show Prisma `P1001`: the API could not reach the configured Supabase session-pool endpoint. A 20-row request remained server-side for 66-128 seconds while the Agent correctly stopped waiting after 60 seconds and retained the rows.
- The local queue rose from 312 to 542 during observation while terminal rejected remained 56. The new rows are pending durable SQLite data, not policy rejections or deleted usage.
- Policy v3 remained acknowledged and the Agent continued confirming it. Policy is not the cause.
- Supabase's public status showed the Tokyo region, database and pooler operational, and the pooler's TCP port was reachable from the test workstation. The API readiness endpoint later returned `200` / `database: ok`, but real sync transactions still timed out, which is consistent with stale in-flight API connections/transactions surviving the transient database outage.

### Changed Files And Implementation Summary

- `workmap/apps/api/src/modules/prisma/prisma.service.ts`: changed only the runtime fallback `pool_timeout` from 30 seconds to Prisma v6's documented 10-second default for both Supabase session and transaction pooler URLs. Explicitly configured URL values remain untouched.
- `workmap/apps/api/test/prisma-runtime-url.test.ts`: updated both pooler-mode assertions to require the new bounded fallback.
- Handoff: this file and `docs/ai-handoff/latest-qa.md`.
- The shorter acquisition wait makes a saturated/unavailable database fail before Desktop 0.6.9's 60-second transport deadline, allowing its existing global backoff to operate instead of leaving disconnected requests executing and amplifying an outage.

### Verification

- API test: passed 57/57.
- API typecheck, lint and build: passed.
- `git diff --check`: passed; line-ending notices were informational only.
- No credential or database URL was added.

### Intentionally Unchanged / Manual QA / Next Step

- No Desktop Agent or Browser Extension source, package, collection engine, interval schema, local queue, policy, Reports calculation, database schema or migration changed. Desktop remains 0.6.9 and Browser remains 0.5.13.
- No local pending or historical rejected row was cleared. Re-pairing and reinstalling are not required.
- The new API code is not yet deployed, so post-deploy queue drainage is not claimed. Deploying the API will also restart the instance and clear the currently hanging process-local connections.
- After deployment, keep one Desktop Agent running and require pending to fall in batches, secure heartbeat/confirmed-through to advance, terminal rejected to stay at 56, and Render to stop logging long `P1001`, `P2024` or `TRACKING_SYNC_INTERNAL` transactions. If `DATABASE_URL` explicitly includes `pool_timeout=30`, change that explicit value to `10` in Render because source intentionally respects operator-supplied parameters.

## 2026-07-28 Tracking v2 Backpressure And Reconciliation Fix / Desktop 0.6.9

### Original Task Brief

- Investigate why one remaining Desktop Agent continued accumulating pending uploads after the other employee's Desktop Agent and both Browser Extensions were stopped.
- Implement only after reaching at least 95% confidence, preserve the existing Desktop/Browser collection and data semantics, and concentrate the change on request amplification, database concurrency and Reports latency.

### Root Cause Confirmed Before Editing

- The latest single-Agent NDJSON window contained 113 attempts in 30 minutes, zero confirmations and 112 failures; 110 ended at the old Desktop 15-second transport limit and two returned retryable `TRACKING_SYNC_INTERNAL`.
- The local queue kept growing even after three of four clients were stopped. This disproved a simple “Render Standard cannot handle two employees” explanation and confirmed a positive feedback loop in the application.
- Desktop retried failed rows with per-row backoff, but every newly collected interval was immediately ready and could trigger another request. The old 15-second transport timeout was also shorter than the bounded pool-wait plus API transaction envelope, so the client could abandon a request that later committed and then replay the retained row.
- API sync rebuilt cursor coverage from every interval/tombstone in the current clock epoch on every request. In parallel, the reconciliation worker ran every 15 seconds and Reports reads synchronously attempted the same write-heavy full-day reconciliation. Active uploads kept marking the same date dirty, so ingestion, Reports and reconciliation competed for the same eight Prisma connections.

### Changed Files

- Desktop 0.6.9: `apps/desktop-agent/package.json`, `alpha-windows/package.json`, `scripts/build-alpha.mjs`, `src/version.ts`, `src/windowsActivityHost.ts`, `src/apiClient.ts`, `src/runtimeV2.ts`, `src/trackingV2Types.ts`, release tests and regenerated Alpha native host binary.
- API: `tracking-v2-sync.service.ts`, `tracking-v2-reconciliation.service.ts`, `tracking-v2-reconciliation.worker.ts`, `tracking-v2-reports.service.ts` and focused tests.
- Handoff: this file and `docs/ai-handoff/latest-qa.md`.

### Implementation Summary

- Desktop collection engines, privacy fields, SQLite durability, sequence/event identities, policy enforcement and Tracking v2 request schema are unchanged.
- Desktop `/sync-v2` now waits up to 60 seconds for a bounded server response, uploads at most 20 intervals per transaction, and applies one global retry gate after retryable network/429/5xx failures: 5s, 15s, 30s, then 60s maximum. Newly created rows can no longer bypass an outage backoff and sustain a retry storm. A confirmed response resets the gate; terminal 4xx handling remains unchanged.
- API cursor maintenance now starts from the persisted contiguous sequence and reads only the unresolved tail instead of re-reading the full accepted epoch. Missing and terminal-rejection ranges, latest accepted time and duplicate semantics are preserved.
- Background reconciliation now processes at most four targets every 30 seconds and only after a target has had no new interval for 60 seconds. Active-day ingestion is no longer deliberately raced by full-day summary writes.
- Owner Reports no longer performs reconciliation write transactions on a normal read. Dirty dates use the existing exact formal-ledger fallback, so visible totals remain accurate while background summaries wait for a quiet point. The explicit operational retry path can still request immediate reconciliation.
- No schema or database migration is required. Browser Extension 0.5.13 source/package was not changed.

### Verification And Release Output

- Desktop: typecheck pass; lint pass; test pass 68/68; build pass; Windows NSIS release pass.
- API: typecheck pass; lint pass; test pass 57/57; build pass.
- Browser Extension 0.5.13 regression: typecheck pass; lint pass; test pass 72/72; build pass.
- `git diff --check`: pass. Changed-text secret scan: pass, no likely secrets.
- Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.9.exe`, 115,431,708 bytes, SHA-256 `5FABB6196F0EC368AEEB88FF409A87B64CD53A62F667AC6B7A671CFDC2EAA3EB`; file metadata reports product/file version 0.6.9.

### Role / Access Behavior And Intentionally Unchanged Areas

- Tenant, device credential, Browser/Desktop identity, Owner/Employee and policy acknowledgement boundaries are unchanged.
- Focus active, focused idle, App open/runtime, Browser Domain logic, multi-window/multi-display handling, lock/sleep/minimize behavior, privacy exclusions and official interval validation are unchanged.
- No queue rows were deleted or rewritten; old pending rows keep their original IDs and will be acknowledged as accepted or duplicate after recovery.
- No policy schedule, Prisma connection limit, Render instance type, database schema, Web component or Browser Extension release was changed.

### Manual QA, Remaining Risks And Next Steps

- Real deployed Render/Supabase and real Windows drain QA were not run; the API code is not deployed and the 0.6.9 installer is not installed by this implementation round. Do not claim production recovery yet.
- Deploy the API change first, then install Desktop 0.6.9 without clearing SQLite or re-pairing. Keep only one Agent enabled initially and observe that pending decreases to zero, `Confirmed through` advances, and new Render logs show no `P2024`, transaction timeout or memory restart. Then re-enable the second Agent and each unchanged Browser Extension one at a time.
- Existing 0.6.8 Agents do not have the new global gate and should be upgraded. Browser 0.5.13 retains its existing 30-second transport/backoff behavior; its complete regression suite passed, but four-client production load remains a required manual gate.
- Controlled 1/5/20/50-client load testing is still required before publishing a capacity number or calling the system production-ready. The next round can proceed to deployment and measured queue-drain QA.

## 2026-07-28 Standard Upgrade Did Not Recover Four-Client Tracking

### Original Task Brief

- Investigate continued Desktop pending growth and very slow Owner `/reports` loading after upgrading `workmap-api` to Render Standard, with two employees each running a Desktop Agent and Browser Extension.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, Browser Extension, API, Web, database, policy, Render setting or deployment was changed.

### Post-Upgrade Evidence And Root-Cause Boundary

- The Standard instance change is visibly active (`1 CPU / 2 GB`), but the affected Desktop Agent remained `Offline - retrying`; pending rose from the screenshot's 110 to 129 during inspection.
- In the latest 30-minute local NDJSON window, Desktop made 113 sync attempts, confirmed 0, and failed 112. Of those failures, 110 ended at approximately 15.0 seconds as `NETWORK_ERROR`; two returned retryable HTTP 500 `TRACKING_SYNC_INTERNAL`.
- Owner Reports independently shows Desktop queue 125, Browser queue 7, a sequence-gap warning, and prolonged selected-report loading. The 110-versus-125 screenshot difference is normal time progression while the queue is still growing, not two different counters.
- Reports also shows Desktop `Confirmed through 10:07` and `Snapshot received 10:09` while the client's `Last sync` remains 09:41. This is evidence that at least some timed-out requests later completed server-side, but the 15-second Desktop caller did not receive the acknowledgement. Its local rows therefore remain pending and are replayed; the server may later classify them as duplicates. The incident is not evidence that all post-09:41 activity was lost.
- Desktop `/sync-v2` still has a 15-second client timeout, equal to the API interactive transaction timeout and shorter than the previously observed total server durations. Browser 0.5.13 permits 30 seconds, matching its much smaller visible queue. Desktop serializes requests but new interval/health triggers can request another sync immediately after an in-flight timeout, while row-level backoff does not stop newly-created ready intervals from producing more requests.
- Standard adds CPU/RAM but leaves the explicit Supabase session-pool fallback at eight connections and does not remove full-epoch cursor reconstruction or 15-second full-day reconciliation cadence. Current post-upgrade local evidence proves response starvation; a signed-in post-upgrade Render log was not available in the inspection environment, so whether the newest server error remains Prisma `P2024`, transaction timeout, or lock/queue waiting is not falsely claimed.

### Immediate Containment And Required Product Fix

- Do not upgrade to the $85 compute Pro instance as the next action. First close heavy `/reports` refreshes, temporarily disable (not remove or clear) both Browser Extensions, and pause one Desktop Agent. After in-flight work clears or the API is restarted, allow one Desktop Agent to drain before reintroducing the second Agent and then each Extension one at a time.
- Required Desktop correction: increase the transport envelope beyond the API envelope, coalesce normal Focus/open-runtime/health sync, and apply a global retry circuit/backoff so new rows cannot sustain one request every 15 seconds during outage.
- Required API correction: shorten ingestion transactions, replace per-sync full-epoch cursor reconstruction with incremental cursor maintenance, and coalesce/bound or separate reconciliation from the API process. Reports read performance must be measured under the same load.
- No queue deletion, re-pairing, policy weakening or migration is indicated. Real Standard four-client recovery and post-upgrade Render log correlation remain not run.

## 2026-07-28 Render Standard Current-Code Capacity Estimate

### Original Task Brief

- Estimate how many simultaneously monitored employees the Render Standard 2 GB / 1 CPU API instance can support with the current WorkMap implementation.

### Evidence And Capacity Boundary

- Current Desktop production constants settle tracking every 15 seconds and require health sync every 10 seconds; normal Focus, open/runtime and health triggers are not fully coalesced.
- The observed single-Agent day contains 3,915 sync attempts over 454.6 minutes, or 8.61 requests/minute per Agent. The prior completed-request distribution was approximately 5.9-second p50 and 11.2-second p95.
- At those measurements, two Agents generate about 17.2 requests/minute and consume roughly 1.7 concurrent database requests at p50 or 3.2 at p95. Five Agents generate about 43 requests/minute and reach roughly 4.2 concurrent requests at p50 or 8.0 at p95, before policy, authentication, Reports, reconciliation or retry work.
- Prisma's Supabase session-pool configuration remains capped at 8 connections on Standard unless explicitly changed; Standard provides more CPU/RAM but does not automatically enlarge this application limit. Increasing the limit alone is not considered safe remediation.

### Recommendation And Limits

- Current conservative pilot capacity on one Standard instance: **two simultaneously monitored employees**. A third may be used only for short supervised testing with pending, latency, memory and `P2024` monitoring.
- Do not plan five or more simultaneous monitored employees on the current implementation. Ten is outside the evidence-backed capacity. These are operational gates, not vendor instance limits.
- No production capacity claim is valid until sync coalescing/backoff, shorter incremental transactions and bounded reconciliation are implemented and controlled 1/5/20/50-client load tests pass.
- No product code, configuration, database, policy, Agent, deployment or Render setting was changed. Real Standard-instance load testing and multi-device recovery QA were not run.

## 2026-07-28 Render Workspace Pro Versus API Compute Clarification

### Original Task Brief

- Determine whether purchasing the displayed Render Pro workspace plan will resolve the current Tracking v2 pending/P2024 incident.

### Findings And Recommendation

- The displayed `$25/mo Pro` purchase is a Render **workspace plan**. It adds team, bandwidth, build, preview, audit-log, compliance and autoscaling features, but it does not by itself change `workmap-api` RAM or CPU. Render explicitly bills compute separately from the workspace plan.
- The required immediate containment is a separate service-level change: open the `workmap-api` Web Service and change its instance type to **Standard (2 GB RAM / 1 CPU)**. Keeping the Hobby workspace is sufficient for a solo owner unless Pro's collaboration/governance features are independently needed.
- If Workspace Pro has already been selected, the API still needs the Standard instance change. Workspace Pro alone will not resolve Prisma `P2024`, 8-connection starvation, memory exhaustion or the growing local pending queue.
- No code, policy, database, migration, Agent, Render setting or deployment was changed in this clarification round. Official Render workspace-plan, compute-instance and billing documentation was reviewed; live resize/recovery QA was not run.

### Suggested Next Step

- On the shown `Scaling` page, leave Autoscaling off and Manual Scaling at one instance. Open the service's left-side `Settings`, find `Instance Type`/plan, and change the current `Starter` compute badge to **Standard (2 GB RAM / 1 CPU)**.
- Wait for `workmap-api` to become healthy, then verify both Agents' pending queues drain and confirmed-through timestamps advance. Treat Workspace Pro as optional unless its separate team/governance features are wanted.

## 2026-07-28 Two-Employee Tracking Queue And Prisma Pool Exhaustion Diagnosis

### Original Task Brief

- Investigate a Desktop Agent that changed to `Recording locally` and accumulated 27 pending Tracking v2 uploads after a second monitored employee was added.
- Determine from the supplied Render log whether the Render instance is overloaded and whether it should be upgraded.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, migration, policy, database, Render setting, release artifact, or deployment behavior was changed.

### Evidence And Conclusion

- The Render log gives a direct backend failure: Prisma `P2024`, `Timed out fetching a new connection from the connection pool`, with `connection_limit: 8` and `timeout: 30`. Failures affected policy acknowledgement, device authorization, activity ingestion and Tracking v2 transaction-stage syncs, so this is system-wide database-pool starvation rather than a policy rejection.
- Tracking sync failures were retryable HTTP 500 `TRACKING_SYNC_INTERNAL`; sampled server durations were 46-142 seconds. The Desktop transport stops waiting after 15 seconds, so most local entries appear as `NETWORK_ERROR` even while the corresponding server request remains queued or executing.
- Local redacted NDJSON confirms the visible queue was still growing during the incident: pending increased from 11 to 47, nearly every request ended at the 15-second client timeout, and the durable terminal rejection count stayed at 56. Pending data remains in the local SQLite retry queue; this evidence does not indicate that it was deleted or terminally rejected.
- A second employee increased concurrent sync, policy, credential and ingestion work and exposed the existing scalability defect sooner. Previous evidence already showed one sustained client could drive the 512 MB API to memory-limit restart. The current deployment is therefore undersized and inefficient for even a two-user sustained test.
- Immediate containment recommendation: vertically upgrade the Render API to Standard (2 GB RAM / 1 CPU), then allow the existing Agents to retry without reinstalling, deleting local data, changing policy or running a database migration. The upgrade is necessary for test continuity but is not the complete product fix.
- Required product follow-up remains: coalesce normal Tracking v2 sync triggers, add real exponential backoff/jitter, keep ingestion transactions short and incremental, and bound/separate full-day reconciliation. Do not merely increase Prisma `connection_limit`: more connections can shift pressure to the database and do not fix long-lived transactions or request amplification.

### Verification, Manual QA, And Suggested Next Step

- Parsed the supplied 200-line Render stack trace and correlated request IDs/timestamps with the current Desktop redacted NDJSON. Cross-checked official Render compute specifications and Prisma `P2024` pool behavior.
- Product tests, Render resize, database metrics, production deployment, and two-device recovery QA were not run in this read-only round.
- After resizing, require both Agents' secure heartbeat to advance, pending to trend to zero, confirmed-through to advance, durable rejected count to remain unchanged, and `/reports` accepted totals to increase. If pending does not begin falling within 5-10 minutes of stable API availability, capture the newest request ID and matching Render log before changing any queue or policy state.

## 2026-07-28 Reports Stale Heartbeat Versus Policy Diagnosis

### Original Task Brief

- Explain whether the supplied Owner `/reports` Live signals screenshot means Tracking v2 policy stopped working.
- Distinguish current heartbeat freshness, snapshot policy-lease rejection, and historical interval rejection.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, Browser Extension, API, Web, schema, policy, database, release artifact, or deployment behavior was changed.

### Findings

- The screenshot does not show a globally broken policy. All three visible cards report `Policy Active`. The red card state and `0/3 connected` summary are driven by heartbeat freshness, not policy state.
- API source determines connection only from the latest server-received health row: Desktop is fresh for 30 seconds and Browser Extension for 90 seconds. The Desktop health row was last received at Jul 28 09:41, but no newer confirmed health arrived before the screenshot, so the card correctly became stale after 30 seconds.
- The Desktop snapshot and confirmed-through values are from Jul 27, the queue has one pending row, and no current heartbeat is confirmed. The screenshot alone cannot distinguish Agent stopped/closed, Windows sleep, local network loss, API unavailability, or a request timeout. Opening Desktop diagnostics and observing whether `Last secure heartbeat` advances is the next direct check.
- Chrome `Policy lease needs refresh` is narrower: its last live Domain snapshot used an expired or replaced lease and received `SNAPSHOT_POLICY_LEASE_INVALID`. A running client normally fetches the current policy and sends a new snapshot, but this Chrome 0.5.12 client is also stale and therefore is not currently completing that recovery.
- The Edge `POLICY_REJECTED` banner is a historical terminal interval tombstone. It remains excluded from official Domain totals and does not prove the current policy is inactive.
- The 22 hidden inactive Browser connections are old pairings suppressed from the main Live view; they are not 22 currently connected clients.
- A confirmed Web presentation defect exists: `trackingV2ConnectionPresentation()` hardcodes `Browser heartbeat not received` and Browser-specific detail for every stale device, including Desktop. The stale snapshot detail also hardcodes Browser Extension. The Desktop card should use Desktop-specific wording. This text bug does not alter API freshness, policy enforcement, ingestion, or Reports totals.

### Verification, Manual QA, And Suggested Next Step

- Reviewed current API freshness thresholds/calculation, live-device selection, connection/snapshot presentation, server diagnostic mapping, and the supplied timestamps/statuses.
- Product tests and signed-in deployed QA were not run because this was a read-only diagnosis.
- First operational check: open Desktop Agent and require heartbeat/last confirmed sync to advance repeatedly, not just once. For Chrome, keep/reload the current Extension and require a new heartbeat, current lease, and accepted snapshot. No policy schedule change or database migration is indicated by this screenshot.
- A future Web-only wording correction can make Desktop and Browser stale messages client-specific without changing either collector.

## 2026-07-27 Render Memory Exhaustion And Tracking v2 Scalability Diagnosis

### Original Task Brief

- Review the supplied Render metrics and API logs after the confirmed `workmap-api` memory-limit restart.
- Explain how to resolve the issue and whether multiple simultaneous users would make it worse.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, migration, policy, database, deployment, or Render configuration was changed.

### Evidence And Root-Cause Model

- Render shows a 512 MB / 0.5 CPU API instance. Memory rises from roughly 40% after the morning instance transition to a sustained 70-85%, then reaches the limit and restarts. CPU is usually moderate but has repeated request-correlated spikes. The public-request chart shows approximately 15,311 requests in the selected period.
- The API logs show repeated `TRACKING_SYNC_INTERNAL` failures in transaction stage before the restart, commonly taking 15-26 seconds. The 16:42:42 Adelaide Nest startup log is the replacement instance coming online after the memory-limit restart. Slow transaction failures resume after startup, so restart restored availability but did not remove the underlying load.
- The reconciliation worker also logged an expired Prisma transaction: its configured timeout is 10 seconds, while 23,884 ms had elapsed before a summary upsert. This is direct evidence that aggregation work is exceeding its current transaction budget.
- The current Desktop runtime settles Focus every 15 seconds, settles all visible App open/runtime lanes every 15 seconds, and requires health sync every 10 seconds. Focus settlement, runtime settlement, and health can each trigger a separate serialized HTTP request in one logical tick.
- The current-day local NDJSON contains 3,787 Desktop `sync-v2` attempts over 439 minutes: 8.63 requests/minute from one Agent. Of these, 1,435 carried zero intervals, 1,350 carried one interval, and 427 carried six intervals. Completed request p50 was 5.9 seconds, p95 was 11.2 seconds, 320 requests took at least 10 seconds, 67 hit the Desktop 15-second client timeout, and 9 received HTTP 502.
- The API sync transaction repeatedly reads persisted interval/tombstone history to reconstruct cursors. `refreshCursors()` loads every disposition in the requested clock epoch and recomputes coverage, so work grows with the duration of the active epoch.
- The background reconciliation worker runs every 15 seconds. For each dirty user/source/day target it loads every day fragment, recomputes merged ranges in Node memory, then performs per-subject upserts and company aggregation inside an interactive transaction. Continuous 15-second ingestion repeatedly dirties the same target while reconciliation is running, causing repeated full-day work and expired transactions.
- Desktop's 15-second HTTP timeout aligns with the API's 15-second interactive transaction timeout. A client-aborted request can still be completing/rolling back server-side; the Agent then retries durable pending data, increasing pressure while the server is already slow.
- This evidence supports workload amplification and growing full-history/full-day recomputation as immediate scalability defects. The graph alone does not prove a classic retained-object memory leak; a heap profile and idle/no-traffic comparison would still be required for that label.

### Multi-User Impact And Required Resolution Order

- Multiple users will increase independent ingestion lanes, interval rows, fragments, dirty reconciliation targets, database connections, in-flight transactions, Node allocations, and retry traffic. Some costs are linear per user, while repeated full-day reconciliation and contention can become worse than linear. The current 512 MB single-instance setup is not ready for a simultaneous multi-user pilot.
- Immediate operational containment: move the API from Render Starter 512 MB to Standard 2 GB before more sustained testing. This provides four times the memory and twice the CPU, but is headroom rather than the complete fix.
- First product fix: coalesce normal Focus settlement, open/runtime settlement, snapshot, and health into one bounded sync. Target roughly one normal sync per 30 seconds, retaining immediate durable local settlement and immediate boundary sync for lock, sleep, app transition, shutdown, and reconnect. Data accuracy must remain unchanged; only server confirmation latency increases modestly.
- Second product fix: add explicit retry backoff/jitter/circuit-breaking for retryable 5xx/timeout bursts and give the Desktop transport more timeout headroom than the API transaction envelope. Prevent raw gateway HTML from being rendered as the diagnostic reason.
- Third product fix: remove full-epoch cursor reconstruction from each ingestion transaction. Maintain `ClientSyncCursor` incrementally with controlled out-of-order/gap tests, and keep the ingestion transaction short.
- Fourth product fix: stop running full-day in-memory reconciliation every 15 seconds in the API process. Coalesce one user/source/day job, process it at a bounded cadence, avoid per-subject sequential upserts, and preferably move aggregation to a separately sized background worker. Horizontal API scaling should follow this separation rather than multiplying the same background scan in every API instance.
- Release gating: run controlled 1/5/20/50-client load tests and require stable memory after warm-up, no OOM restart, no transaction-expired warnings, bounded database connections, pending queues returning to zero, zero new terminal rejection, advancing confirmed-through values, and correct Reports totals.

### Verification, Manual QA, And Remaining Risk

- Reviewed the supplied Render metrics/logs, current Desktop scheduling and sync guard, API interactive transaction, cursor reconstruction, reconciliation worker/service, Prisma singleton/pool configuration, schema indexes, and the current-day local redacted NDJSON.
- Cross-checked current official Render instance/metrics guidance and Prisma transaction guidance. Product tests, heap profiling, deployed load testing, database query plans, Supabase active-connection metrics, and real multi-user QA were not run because this was a read-only diagnosis.
- Existing Desktop local queue/retry safety behaved correctly through the restart, but backend scalability is a release blocker for adding multiple sustained Tracking v2 clients.

## 2026-07-27 Desktop Agent 0.6.8 HTTP 502 Burst Diagnosis

### Original Task Brief

- Explain why Desktop Agent diagnostics showed a burst of HTTP 502 rows while pending still returned to zero, Owner `/reports` totals kept increasing, and the durable rejected count remained at 56.
- Determine whether this indicates invalid tracking data or data loss.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, policy, database, release artifact, or deployment behavior was changed.

### Evidence And Conclusion

- Follow-up evidence from the user confirmed the service-side root cause: Render emailed that the `workmap-api` Web Service exceeded its memory limit, triggering an automatic restart and temporary unavailability. This directly explains the observed HTML 502 burst during the restart window; the earlier gateway/restart diagnosis is now confirmed rather than inferred.
- The supplied 16:42 Adelaide screenshot corresponds to a local NDJSON burst of six HTTP 502 responses between 16:42:35 and 16:42:48. The response body is an HTML gateway error page rather than WorkMap's structured Tracking v2 JSON, so this was an upstream hosting/proxy response, not an interval validation rejection.
- During the burst, pending rose from 6 to 13 while dead letter stayed at 56. HTTP 5xx follows the runtime retry branch; only terminal 4xx or explicit terminal interval results enter dead letter.
- HTTP 200 resumed at 16:43:08. The first recovered request reduced pending to 12, and the next confirmed request at 16:43:23 drained pending to zero with dead letter still 56. Subsequent syncs continued to confirm with zero interval rejection. This proves the observed batch was retained and retried rather than discarded.
- As of the inspected log tail, the day contained 9 HTTP 502 failures, 62 no-response/timeout failures, and 3,658 confirmed HTTP 200 syncs. The latest confirmed sync still had `pending=0`, `deadLetter=56`, and `intervalRejected=0`.
- The user's independent observation that official `/reports` totals continue increasing is additional ledger evidence that accepted intervals are reaching the backend. Stable 56 remains the correct historical tombstone count, not a sign that new 502 failures are being hidden.
- The event was service-specific memory exhaustion, not a platform-wide Render incident. Render/API metrics and logs are still required to distinguish an application memory leak from a workload spike or an undersized instance.

### Confirmed Diagnostic UX Gap And Suggested Next Step

- The Agent currently displays the sanitized raw HTML body returned by the gateway. This is noisy and user-hostile; an eventual narrow Agent diagnostic patch should replace non-JSON 5xx bodies with a bounded message such as `WorkMap service temporarily unavailable; automatic retry enabled`.
- The separate 15-second timeout issue remains: current no-response diagnostics use misleading legacy fallback wording. A future transport/diagnostic-only release can address timeout headroom and truthful retry wording without touching collection, interval construction, policy, queue durability, or Reports ledger semantics.
- No urgent repair is required for this recovered burst. Escalate to server-log/performance diagnosis if pending stops returning to zero, `Confirmed interval through` stops advancing, Reports totals stop growing, or 502 bursts recur for minutes rather than seconds.
- The next server-side action is to inspect Render memory metrics and API logs immediately before the restart. Do not assume that upgrading the instance alone is a complete fix until sustained memory growth versus a one-time traffic/load spike is distinguished.

### Verification

- Reviewed current Desktop 5xx/4xx classification and retry/dead-letter branches, the supplied diagnostics, and the current-day local redacted NDJSON around the exact burst and recovery.
- Public Render status was checked for current platform-level incident context. Product tests and deliberate network fault injection were not run because product code did not change.

## 2026-07-27 Desktop Agent 0.6.8 Stable Rejection Count And Network-Timeout Diagnosis

### Original Task Brief

- Review the supplied current-day Desktop Agent network diagnostics and determine whether the Tracking v2 queue remaining at `56 rejected` for roughly one week is normal.
- Distinguish historical terminal interval rejection from current request/network diagnostics using current source and the local redacted NDJSON evidence.

### Changed Files

- Diagnostic handoff only: this file and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, policy, installer, artifact, database, or deployment behavior was changed.

### Evidence And Conclusion

- `Tracking v2 queue rejected` is the durable SQLite count of terminal interval tombstones. It increases only when an interval receives a terminal server rejection or a terminal 4xx request classification. A no-response/timeout follows the retry path and does not enter dead letter, so a stable `56` while network diagnostics appear is expected and desirable.
- The retained `56` are historical evidence: `FOCUS_OVERLAP 36`, `POLICY_REJECTED 13`, `RUNTIME_OVERLAP 5`, and `HTTP_400 2`. They are not a current failure counter and are intentionally not deleted after upgrade.
- The 2026-07-27 local NDJSON contains 45 failed `sync-v2` requests: 44 `NETWORK_ERROR` entries finished in the 14.9-15.2 second window and one fast HTTP 502. Current Desktop `/sync-v2` has a 15-second client timeout, so the repeated no-response rows are strongly identified as client timeout/slow-response events rather than new invalid intervals.
- The final shown timeout completed at `05:57:02Z`; successful HTTP 200 syncs resumed three seconds later. At `05:57:29Z`, one confirmed request carried 12 intervals, returned zero interval rejections, drained pending to zero and kept dead letter at 56. Later requests continued to confirm with HTTP 200. This proves retry recovery for the observed batch.
- Stable rejected count plus `0 pending`, later confirmed sync and zero new interval rejection is good evidence that 0.6.8 is no longer creating the earlier overlap/policy tombstones. It does not by itself prove every Reports total; `Confirmed interval through` and official `/reports` totals remain the final ledger evidence.

### Confirmed Diagnostic UX Gap And Suggested Next Step

- Current no-response `AgentApiError` has no server message/remediation/retryable field. The renderer therefore incorrectly falls back to `Historical rejection: the Agent version ... did not save a detailed server reason`, even for a current 0.6.8 timeout. The runtime nevertheless retries those intervals.
- The 15-second Desktop timeout equals the observed cutoff and is shorter than the API's possible transaction wait/runtime envelope documented by the Browser 0.5.13 investigation. A future narrowly scoped Desktop transport/diagnostic refinement could provide more headroom and truthful `request timed out / automatic retry` wording without changing collection, interval construction, policy or ledger rules.
- No repair was made in this diagnosis round. Server-side request logs were not queried, so the source-backed conclusion is client timeout/slow response; the exact upstream latency component remains unproven.

### Verification

- Reviewed current Desktop API timeout, retry/dead-letter branches, SQLite queue counters, diagnostic rendering fallback and the current-day NDJSON request IDs/outcomes/durations.
- `git diff --check` and scoped secret scan were run after the documentation update. No automated product test or real network fault injection was run because product code did not change.

## 2026-07-27 Desktop Connection Audit Web-Only Completion

### Original Task Brief

- Proceed only with at least 95% confidence and optimise the Owner `/reports` Desktop Agent audit history without changing Desktop Agent `0.6.8`, its collection/upload behavior, policy, backend ingestion, database, or official App totals.
- Render all already-stored Tracking v2 lifecycle events with Desktop-specific wording and avoid duplicate legacy-session rows.

### Changed Files

- Web presentation: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- New focused tests: `workmap/apps/web/test/desktop-connection-audit.test.ts`.
- Long-lived handoff: this file and `docs/ai-handoff/latest-qa.md`.
- Existing concurrent Browser Extension and Browser Reports changes were preserved. No Desktop Agent, API, shared contract, Prisma/schema/migration, policy, installer, artifact, or deployment file was changed by this Desktop audit work.

### Implementation Summary

- Desktop audit now consumes every stored `DESKTOP_AGENT` status instead of the former six-status allow-list. It has a Desktop-only formatter, so `RUNNING`, stop, shutdown, crash, termination, unknown interruption and restart use native Agent wording rather than Browser wording.
- `RESTARTED` now displays `Agent restarted`, never `Browser profile started`; startup/reconnect/restart are positive, confirmed stops/lock/sleep/shutdown are neutral, and unavailable/crash/termination/unknown interruption are attention states.
- Legacy `AgentSession` history remains a compatibility fallback. A linked v2 start/end status suppresses the equivalent legacy row by real `agentSessionId`, preventing duplicate start/stop entries while preserving old history when no v2 event exists.
- Event occurrence time, inferred marker, delayed-sync timestamp, newest-first order and separate Live-signals semantics are unchanged. This is presentation-only: current connection still comes from health/heartbeat, and App Focus/Idle/Open-runtime totals still come from the official accepted interval ledger.

### Verification, Manual QA, And Remaining Risk

- Focused Desktop + Browser + silent-refresh audit tests: pass `12/12`.
- Web typecheck: pass; lint: pass; full tests: pass `98/98`; production build: pass.
- `git diff --check` and scoped secret scan pass. Diff review confirms no Desktop Agent/API/schema/policy modification from this scope.
- Real signed-in Owner `/reports` and Windows lifecycle QA were **NOT RUN**. After the existing concurrent Browser work is reconciled, only the Web needs deployment for this Desktop audit improvement; no Agent release, API deployment, or migration is required.
- Next manual check: open today's employee report, restart the Agent, lock/unlock, sleep/resume and use Quit Agent; require one correctly worded row per stored transition with no legacy duplicate and no change to Live signals or App totals.

## 2026-07-27 Browser Extension 0.5.13 Connection-Flap Correction

### Original Task Brief

- Investigate real Chrome/Edge `0.5.12` Connection Audit histories that continuously alternated `Server Unreachable` and `Reconnected` while the Browser remained open.
- Stop transient request failures from becoming false lifecycle transitions and replace the ambiguous browser-close label `Signal interrupted` with wording limited to what WorkMap can actually prove.

### Changed Files

- Browser Extension runtime/API/version/tests: `workmap/apps/browser-extension/src/backgroundV2.ts`, `extensionApi.ts`, `trackingV2Types.ts`, `package.json`, `manifest.json`, `alpha-unpacked/manifest.json`, and the focused queue/service-worker/sync-diagnostic tests.
- Browser-only Reports presentation/tests: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, `trackingV2LivePresentation.ts`, `browser-connection-audit.test.ts`, and `tracking-v2-live-presentation.test.ts`.
- Generated release: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.13.zip`.
- Existing concurrent Desktop Connection Audit edits in the shared Reports component and handoff files were preserved; this round did not author or change Desktop Agent behavior.

### Implementation Summary And Behavior

- Root cause confirmed: every retryable sync failure immediately set the Extension connection to `OFFLINE` and durably queued `SERVER_UNREACHABLE`; the next successful sync queued `RECONNECTED`. Because `/sync-v2` used a 10-second client timeout while the API transaction may wait 5 seconds and run for up to 15 seconds, harmless slow requests produced the exact alternating history seen in real screenshots.
- `/sync-v2` now uses a 30-second timeout, leaving transport headroom above the API transaction budget. Other Extension API calls retain their existing 10-second timeout.
- One online-interface request failure no longer proves server unreachability. While the most recent server-confirmed heartbeat is at most 90 seconds old, local connection remains `ONLINE`; after it expires, local health becomes `OFFLINE` but no unsupported `SERVER_UNREACHABLE` lifecycle cause is emitted. Bounded request diagnostics and durable interval retry behavior remain unchanged.
- A browser-confirmed local network loss (`navigator.onLine === false`) still queues one `NETWORK_OFFLINE / NETWORK_UNAVAILABLE` transition. Lock/unlock, profile start, startup, policy, queue, Focus, and Domain open/runtime behavior are unchanged.
- Persistent missing heartbeats continue to use the server's existing authoritative gap lane: one inferred interruption after the 90-second freshness boundary and one recovery row after a later confirmed heartbeat. This prevents request-level flapping while retaining honest outage coverage.
- Browser Live signals and Connection Audit now use `Browser heartbeat not received` / `Heartbeat not received`. The detail explicitly says browser close, offline, disabled, sleep, or crash cannot be distinguished. Historical `SERVER_UNREACHABLE` rows are retained but presented as `WorkMap request unavailable`; recovery rows are presented as `Connection restored`, and an unknown reason is described as a confirmed heartbeat arriving again.
- Existing historical flapping rows are not deleted or rewritten. Installing 0.5.13 stops new false request-failure transitions; older rows remain auditable in historical report ranges.

### Verification, Manual QA, And Remaining Risk

- Passed: Browser Extension typecheck, lint, all 72 tests, build, and `release:zip`.
- Passed: Web typecheck, lint, production build, and 12 focused Browser live/audit tests.
- Full Web test finished 97/98 with one unrelated concurrent Desktop test failure: `reports-information-order.test.ts` still expects the old Desktop source-filter text after another conversation refactored Desktop audit formatting. This round did not modify that Desktop work.
- `git diff --check`, scoped secret scan, ZIP content/version/size/hash inspection were run after final edits.
- Real Chrome and Edge load-unpacked QA was not run. Required check: leave each browser open for at least ten minutes, confirm no alternating request-failure/recovery rows appear, close it, wait over 90 seconds, and confirm exactly one `Heartbeat not received` row; reopening should add one `Connection restored` row.
- Version: `browser-extension-mv3/0.5.13`. ZIP size: 50,520 bytes. SHA-256: `A701426522CD1B8BB7355CBB942331FA16110C583704EA3CF89014C779C560E6`.
- No API/schema/policy, Desktop Agent behavior, deployment, store publication, or historical database deletion was performed.

## 2026-07-27 Desktop Connection Audit Current-State Review

### Original Task Brief

- Inspect the current Owner `/reports` Desktop Agent Connection Audit card and explain every status it can show and the real condition represented by each label.
- Explain the supplied `0 events` state from current source rather than treating it as proof that the Agent is offline or inactive.

### Changed Files

- Diagnostic handoff only: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, policy, release, artifact, or deployment behavior was changed.

### Current Code Findings

- The source package remains Desktop Agent `0.6.8` on Tracking v2. The current v2 runtime durably emits `RUNNING / AGENT_STARTED` after activation, `STOPPED_BY_USER / USER_STOP` for the in-app Quit Agent path, `LOCKED / SYSTEM_LOCK`, `SLEEPING / SYSTEM_SUSPEND`, and `RECONNECTED` with either `SYSTEM_UNLOCK` or `SYSTEM_RESUME` from Electron power/session events.
- The Desktop audit renderer still combines legacy `AgentSession` rows with a narrow status-event allow-list: `NETWORK_OFFLINE`, `SERVER_UNREACHABLE`, `SLEEPING`, `LOCKED`, `RECONNECTED`, and `RESTARTED`. Tracking v2 `RUNNING`, user-stop, shutdown, crash, termination, and unknown-interruption status events are therefore not rendered directly.
- Consequently `0 events` means only that no renderable Desktop audit transition exists in the selected report range. It does not mean unpaired, offline, no heartbeat, or no App activity. Current online state remains the separate Live signals health/heartbeat lane.
- Visible confirmed status rows are: `Sleeping / System Suspend` (neutral), `Locked / System Lock` (neutral), `Reconnected / System Resume|System Unlock` (positive), `Network Offline / Network Unavailable` (attention), and `Server Unreachable / Server Request Failed` (attention). Current v2 does not normally generate the last two lifecycle rows for ordinary sync failures; diagnostics and Live signals carry that state.
- Legacy `AgentSession` rows can render `Agent started`, `Stopped by user`, `Device shut down`, `Suspended`, `Agent crashed`, `Agent terminated`, or `Interrupted`. Stale open legacy sessions older than 30 seconds are presented as an unknown interruption, but current Tracking v2 does not create those legacy sessions.
- A current presentation defect remains: the shared Browser formatter maps `RESTARTED` to `Browser profile started`. Because Desktop keeps `RESTARTED` in its allow-list, a Desktop restart status would receive that Browser-specific title and a neutral marker. No fix was authorized or made in this explanation round.
- Rows use client occurrence time, newest first. Confidence `INFERRED` appends `(inferred)`; delivery over 30 seconds appends the separate server sync time; consecutive identical status/reason transitions are coalesced.

### Verification And Next Step

- Re-read the current Desktop Electron/runtime v2 producer, API status-history query/coalescing, Browser heartbeat-gap inference, and Web audit renderer/formatter.
- `git diff --check` and a scoped secret scan were run after this documentation update. No product test or real Windows lifecycle QA was run because product code did not change.
- A future narrow Web/API correction should give Desktop its own status formatter, render all stored Tracking v2 lifecycle transitions once, and test that audit history remains independent from Live signals. It must not fabricate inferred causes or change tracking/policy behavior.

## 2026-07-25 Browser Extension 0.5.12 Current Runtime State Preservation

### Original Task Brief

- Continue debugging Edge `0.5.11` after a complete Options capture showed the paired device entirely reset to pending/unknown/paused despite the same device having previously uploaded lifecycle events.
- Fix Browser Extension only. Do not modify Desktop Agent.

### Root Cause And Implementation

- `BrowserTrackingV2Store.readRuntimeState()` migrated legacy versions 5, 6 and 7 but omitted the current version 8 success branch. Every read of a valid v8 runtime therefore fell through to `createInitialBrowserTrackingV2State()` and overwrote the IndexedDB meta record.
- Options reads runtime diagnostics every five seconds, so merely leaving Options open repeatedly erased protocol activation, policy/lease, heartbeat/sync confirmations, timeline watermarks, diagnostics and tracking-access state. The background also reads runtime after a sync result, so confirmed state could be erased during normal collection. The supplied screenshot exactly matched the generated initial v8 state.
- Current v8 records now return unchanged and without an IndexedDB write. Legacy 5/6/7 migrations remain intact. An existing record with an unknown future/corrupt version now fails closed instead of being destructively replaced with an initial state.
- Added an executable storage regression using a controlled IndexedDB transaction. It persists representative v8 activation, heartbeat, confirmed-through and request-correlation fields, reads the state, asserts exact equality, and asserts zero writes during the read. This test fails on 0.5.11 and passes on 0.5.12.
- Version advanced to `browser-extension-mv3/0.5.12`; source package, manifest, generated alpha manifest and version assertions are aligned.

### Changed Files And Boundaries

- Runtime fix: `workmap/apps/browser-extension/src/trackingV2Store.ts`.
- Version metadata: `trackingV2Types.ts`, Browser `package.json`, `manifest.json`, and generated `alpha-unpacked/manifest.json`.
- Regression tests: `tracking-v2-store.test.ts` and `service-worker.test.ts`.
- Release/QA memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `docs/skills/deployment-skill.md`.
- No Desktop Agent, API, Web, shared contract, Prisma schema/migration, policy, RBAC, tenant isolation or production deployment changed.

### Verification, Artifact, Manual QA, And Risks

- Browser Extension typecheck and lint pass; full test suite passes `71/71`; build and `release:zip` pass.
- `git diff --check` passes with line-ending normalization warnings only; scoped high-confidence secret scan reports zero matches.
- ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.12.zip`; 22 entries; 50,036 bytes; embedded manifest `0.5.12`; SHA-256 `4F0C6121A78C21D3200E01295F8AD1FE4CA0A29A2BC7ED10CA996C89301E287C`.
- Real Edge/Chrome load-unpacked QA: **NOT RUN**. Reload the existing unpacked entry from `workmap/apps/browser-extension/alpha-unpacked` without removing it or clearing storage. The same pairing should remain.
- The 0.5.11 screenshot showed queue `0/0/0`; there is no retained interval payload to reconstruct the time already erased before 0.5.12. Future state and newly generated time are preserved. Existing server ledger rows remain unchanged.
- Required acceptance: keep Options open while using one foreground eligible page for at least 5 minutes. Policy/lease/permission fields must remain stable, heartbeat and confirmed-through must advance, interval upload must show accepted/duplicate, and `/reports` Domain totals must grow without closing the tab.
- The separately identified 10-second client timeout versus longer server transaction allowance remains a robustness risk and was not mixed into this precise state-corruption patch.

## 2026-07-25 Browser Extension 0.5.11 Field Sync Failure Triage (No Runtime Change)

### Original Task Brief

- Debug a real Edge `0.5.11` Connection Audit row showing `Server Unreachable / Server Request Failed` after startup, and determine whether it explains Browser Domain totals growing too slowly.
- Explain whether a future full-access browser QA session can operate prepared domains and compare Options with Owner `/reports` without modifying Desktop Agent.

### Investigation And Current Conclusion

- The audit row is a historical retryable request failure, not proof that the API is currently unavailable. A direct read-only check on 2026-07-25 found both public API health and database readiness healthy.
- Browser intervals are atomically persisted before upload. A retryable sync failure retains those interval identities and applies bounded retry delays of 5 seconds, 10 seconds, then up to 5 minutes; it does not terminally delete them. One such failure should delay Reports confirmation rather than permanently lose the interval.
- The audit event intentionally does not expose credential or payload data, but is too coarse to distinguish client timeout, fetch/CORS/network failure, or API 5xx. The exact Options diagnostic, request ID, queue counts, last interval result and `Confirmed interval through` are required to distinguish a recovered delay from a stuck upload.
- A concrete robustness mismatch exists: all Extension API requests currently use a 10-second browser timeout while Tracking v2 permits up to 5 seconds to acquire its transaction and 15 seconds inside it. This can cause a client-side abort before a legitimate slow sync completes. It is not yet attributed as this field failure at 95% confidence because the supplied screenshot omits the diagnostic code/message and current queue state.
- Current tests cover durable queue backoff, HTTP failure classification, and keepalive interval generation independently, but do not exercise the full runtime path from failed/aborted fetch through retry to accepted server confirmation. No production code or version was changed in this triage round.
- Domain Focus is not mathematically required to equal Desktop Edge Focus: the Browser excludes address bar/browser chrome, internal or protected pages, DevTools, inaccessible PDFs, background/minimized/locked time, and any time without one eligible hostname. A large continuing gap on one foreground eligible HTTP/HTTPS page still requires investigation.

### Verification, Manual QA, And Next Step

- `pnpm --filter @workmap/browser-extension test`: pass `70/70` on `0.5.11`.
- Real browser interaction QA: **NOT RUN**. No authenticated page or device was controlled in this round.
- Next evidence required from the affected Edge profile: one complete Options diagnostics capture after 3-5 minutes on a foreground eligible page, including Last interval upload, Confirmed interval through, queue pending/ready/dead-letter, Last request ID, and Historical rejected/network diagnostics. Do not include credentials or tokens.
- With explicit authorization and a supported signed-in browser-control surface, a future session can operate user-prepared Chrome tabs and compare timed interactions against Options and `/reports`. Full filesystem/shell permission alone does not guarantee arbitrary Edge or Windows UI control; lock/sleep and Edge-only checks may still require user actions.
- No Desktop Agent, API, Web, shared contract, artifact, deployment, or historical data was changed.

## 2026-07-25 Browser Extension 0.5.11 Independent Interval Settlement And Startup Idempotency

### Original Task Brief

- Continue debugging real Owner `/reports` evidence from Edge `0.5.10`: the Extension heartbeat and current hostname snapshot were server-confirmed, but `Confirmed through` remained empty and confirmed Domain Focus totalled only 49 seconds while Desktop Edge Focus showed 7 minutes 52 seconds.
- Investigate two identical `Browser profile started` rows for the same Edge device at the same second.
- Fix Browser Extension only. Do not modify Desktop Agent.

### Root Cause And Implementation

- The 0.5.10 20-second MV3 keepalive only called Chrome reconciliation/observation APIs. Formal `BrowserFocusEngineV2.settle()` and `BrowserOpenRuntimeEngineV2.settle()` remained exclusive to the 30-second alarm path. Real Edge proved that heartbeat/snapshot maintenance could continue while no alarm-created interval reached the durable queue. The previous two-hour test incorrectly supplied both 20-second checkpoints and guaranteed 30-second alarms, so it did not cover this production failure.
- The keepalive is now an independent correctness path: every proven, authorised 20-second checkpoint settles and atomically persists Focus and Domain open/runtime slices, then schedules their existing Tracking v2 sync. Alarm delivery remains useful maintenance but is no longer required for interval creation or `Confirmed interval through` progress.
- Lifecycle discontinuity, policy/window closure, lock, queue pressure and unknown gaps still prevent settlement/backfill. No hostname is created for browser chrome, internal/protected pages, DevTools, inaccessible PDFs or other ineligible surfaces.
- Every startup callback previously forced a new `RESTARTED / AGENT_RESTART` event with a fresh ID, and the API intentionally preserves distinct profile starts. A 5-second local durable guard keyed by device now collapses duplicate startup/update callbacks from one Browser boot into one queued status event. It does not merge events between devices or normal later restarts.
- Browser Domain Focus is expected to approach, but not exactly equal, Desktop Edge Focus: only OS-foreground eligible HTTP/HTTPS page time can be attributed to a hostname. The supplied 49-second result plus no confirmed interval was nevertheless a real Extension defect, not a valid metric-boundary difference.

### Changed Files

- Browser runtime/storage/version: `workmap/apps/browser-extension/src/backgroundV2.ts`, `extensionStorage.ts`, `trackingV2Types.ts`, `package.json`, and `manifest.json`.
- Tests: `collector-keepalive.test.ts`, new `runtime-start-dedupe.test.ts`, and version assertions in `service-worker.test.ts`.
- Generated release outputs: `workmap/apps/browser-extension/alpha-unpacked` and `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.11.zip`.
- Long-lived QA/release memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `docs/skills/deployment-skill.md`.
- No Desktop Agent, API, Web, shared contract, Prisma schema/migration, policy, RBAC, tenant isolation, or production deployment changed.

### Verification, Artifact, Manual QA, And Next Steps

- Focused executable regression passes `11/11`; full Browser Extension suite passes `70/70`; typecheck and lint pass.
- A runtime-orchestration test calls the actual keepalive checkpoint and proves both engines are settled/persisted without an alarm. A two-hour engine simulation with no alarm delivery produces exactly 7,200,000ms of adjacent non-overlapping Focus active plus 7,200,000ms of Domain open/runtime. A storage-backed runtime test proves two same-boot startup callbacks create one durable event.
- Build and `release:zip` pass. ZIP has 22 entries, manifest `0.5.11`, size `49,974` bytes, SHA-256 `AB718F8849ABFF078D98C7856B63EFBA33E508401972DA2B262D2D58356E426F`.
- Real Edge/Chrome load-unpacked QA is **NOT RUN**. Reload the existing unpacked entry from `workmap/apps/browser-extension/alpha-unpacked` without clearing pairing/storage. On one eligible Edge page, Options should show accepted/duplicate interval evidence and `Confirmed interval through` advancing within roughly 20-40 seconds; `/reports` should then gain Domain Focus/runtime without tab close. One browser start should add no more than one new profile-start row.
- Existing duplicate historical rows and previously missed time are not rewritten or backfilled. No store upload, GitHub Release, API/Web deployment, or production publication was performed.

## 2026-07-24 Browser Extension 0.5.10 Durable Focus/Runtime Continuity

### Original Task Brief

- Investigate real Owner `/reports` evidence where the employee used Edge from roughly 09:30, Desktop Agent showed about 54 minutes of Edge Focus active, but confirmed Browser Domains totalled only about seven minutes and Domain open/runtime contained mostly a few seconds.
- Fix Browser Extension under-counting only. Do not modify Desktop Agent.

### Root Cause And Metric Boundary

- The fresh Edge `0.5.9` Live signal was online and server-confirmed snapshots continued, but `Confirmed through` still showed no confirmed interval. This isolates the failure to Browser interval creation rather than pairing, heartbeat, current snapshot, API authentication, or Reports rendering.
- The content script captured trusted clicks, keyboard, wheel and touch start but explicitly omitted trusted pointer movement. Windows last-input semantics include mouse movement, so ordinary mouse-led Edge use refreshed Desktop Focus but not Browser Domain Focus. `pointermove` now contributes occurrence time only; no coordinate, direction, target, URL, title or page content is read or sent.
- Chrome can terminate an MV3 worker after 30 seconds of inactivity, while production alarms have a 30-second minimum cadence and can be delayed. The prior worker commonly terminated just before the alarm; startup conservatively sealed Focus and Domain runtime at the old durable checkpoint, then reopened at the current instant. Repeating that lifecycle generated only short switch/close fragments.
- While a proven Focus or authorised Domain open/runtime engine exists, the worker now owns one bounded 20-second collector keepalive. Its checkpoint calls real Chrome APIs and persists current state before the 30-second termination boundary, allowing the existing alarm to emit durable official slices. It stops when no authorised collection session remains.
- Unexpected worker termination remains conservative. Lock, policy/window closure, queue pressure, sleep/clock gaps beyond the existing continuity tolerance and browser/extension shutdown are not backfilled.
- Browser Focus active is expected to approach Desktop Edge Focus only while Edge is OS-foreground and the current page is eligible HTTP/HTTPS content. It is not required to equal Desktop Edge time because browser chrome, internal/protected pages, inaccessible PDFs, DevTools, address-bar time and other unobservable surfaces remain excluded. Domain open/runtime is separate open-tab context and also must not be compared as equal to Desktop app runtime.

### Changed Files

- Browser runtime: `workmap/apps/browser-extension/src/backgroundV2.ts`, `contentScript.ts`, and version constant in `trackingV2Types.ts`.
- Release metadata/output: Browser `package.json`, `manifest.json`, `alpha-unpacked/manifest.json`, and `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.10.zip`.
- Tests: new `collector-keepalive.test.ts`, extended content-script executable test, and service-worker/version assertions.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `docs/skills/deployment-skill.md`.
- No Desktop Agent, API, Web, Prisma schema/migration, policy/RBAC, or tenant behavior changed.

### Verification, Artifact, Manual QA, And Next Steps

- Focused regression passes `22/22`; full Browser Extension suite passes `68/68`. Typecheck and lint pass.
- A two-hour executable engine simulation with trusted activity, 20-second checkpoints and 30-second alarm settlement produces exactly two hours of non-overlapping Focus active plus two hours of Domain open/runtime for one eligible Edge hostname.
- Browser build and `release:zip` pass. ZIP has 22 entries, manifest `0.5.10`, size `49,734` bytes, SHA-256 `DDB2461E28D6B4111E0D85FB0D01866C737E802DFE3FEB30B643C78DFFEB456B`.
- Real Chrome/Edge load-unpacked QA is **NOT RUN**. Upgrade the existing unpacked entry without clearing storage, then observe at least 10 minutes of continuous mouse-led eligible page use plus a 60-second no-input idle transition. Options must show accepted/duplicate intervals and advancing `Confirmed interval through`; `/reports` must gain Focus active/Focused idle/open-runtime without requiring a tab close.
- No store upload, GitHub Release, API/Web deployment, policy change, or production publication was performed.

## 2026-07-24 Reports Browser Connection Audit Collapsed-Row Fix

### Original Task Brief

- Continue investigating the deployed Owner `/reports` Connection Audit after Browser Extension reported `16 events` but rendered only sixteen blank grey bars and no readable history.
- Interpret the supplied Network evidence and fix the real cause without changing working Browser Extension, Desktop Agent, API, auth, RBAC, or tenant behavior.

### Changed Files

- Web implementation: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- Web regression: `workmap/apps/web/test/browser-connection-audit.test.ts`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/frontend-skill.md`, and `docs/skills/qa-skill.md`.
- No API, shared type, Prisma schema/migration, Browser Extension runtime/version/artifact, Desktop Agent, policy, deployment, or production data changed.

### Root Cause And Implementation Summary

- The `OPTIONS 204` in the supplied Network panel is the expected CORS preflight. The following `GET 200` is the real audit request. The Browser card's `16 events` count proves those records reached the Web component; this was not an empty API response or Browser upload failure.
- The Browser device container used a height-bounded CSS Grid. With many implicit device rows and child groups using `overflow: hidden`, the rows were allowed to shrink together inside roughly 420px. Every group's title and events were clipped, leaving only its low-surface background as a narrow grey bar.
- The scroll container now uses a vertical Flex layout and every device history is `flex: 0 0 auto`. Histories keep their intrinsic content height and the outer container scrolls instead of compressing rows.
- Devices with no historical transition/inferred interruption are omitted from Connection Audit. Chrome, Edge, future browser identities, and multiple profiles remain strictly separated by real `deviceId`; current connection status remains in Live signals.
- Owner/user report authorization and tenant scoping are unchanged.

### Verification, Manual QA, Risks, And Next Steps

- Focused executable React render tests pass `8/8`, including sixteen device groups with visible first/last Chrome/Edge titles, event details, non-shrinking styles, and no loading text.
- Web typecheck and lint pass. Full Web tests pass `93/93`. Production Web build passes; the existing non-blocking Next.js ESLint-plugin detection warning remains.
- Real signed-in post-fix Owner visual QA is **NOT RUN** because this checkout did not have access to the user's authenticated browser tab. The supplied screenshots are accepted pre-fix evidence only.
- Deploy the Web build, then reopen the same user/date report and verify readable per-device histories, scrolling, and silent five-second refresh. No Browser Extension or Desktop Agent release is required for this Web-only repair.

## 2026-07-24 Reports Connection Audit Silent Refresh And Browser Separation

### Original Task Brief

- Fix the Owner `/reports` Connection Audit section repeatedly replacing both Desktop Agent and Browser Extension history lists with `Loading connection history...` every few seconds.
- Keep existing rows visible and add confirmed transitions such as sleep, lock, restart, interruption, and recovery without a loading flash.
- Strictly separate Chrome, Edge, and any additional Browser device/profile histories instead of mixing every Browser Extension event into one undifferentiated list.

### Changed Files

- Web implementation: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- Web tests: `workmap/apps/web/test/browser-connection-audit.test.ts` and new `connection-audit-refresh.test.ts`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/frontend-skill.md`, and `docs/skills/qa-skill.md`.
- No Desktop Agent, Browser Extension runtime/version/artifact, API, shared type, Prisma schema/migration, auth, RBAC, tenant isolation, policy, or deployment behavior changed.

### Implementation Summary

- Removed Connection Audit's visible loading state entirely. The existing five-second audit request remains a silent fallback because Reports currently has no Connection Audit SSE/WebSocket subscription contract; the current rows and scroll container remain mounted while it runs.
- Audit state now uses a stable transition-only revision derived from session open/close and device status records. Identical responses return the existing React state object, so ordinary polling does not update the history UI. A newly confirmed transition changes the revision and appears automatically in the list.
- Active Desktop Agent session history no longer embeds the changing `lastHeartbeatAt` value in the historical `Agent started` row. Current heartbeat/connection belongs to Live signals; Connection Audit now changes for lifecycle transitions rather than every heartbeat.
- Browser histories are grouped by real `deviceId`, not merely by source. Each nested section shows its resolved Chrome/Edge identity, a safe short device/workstation identity, version when available, its own event count, and only that device's events. Multiple profiles of the same browser also remain separate.
- Existing confirmed/inferred semantics, heartbeat-gap inference, stable event IDs, event ordering, report-range filtering, Owner access, and API tenant scoping are unchanged.

### Verification And Manual QA

- Focused executable tests pass `6/6`: no loading replacement, unchanged refresh state identity, new transition insertion, Chrome/Edge device separation, inferred interruption semantics, and interruption de-duplication.
- Web typecheck and lint pass. Full Web tests pass `91/91`. Production Web build passes; the existing non-blocking Next.js ESLint-plugin configuration warning remains.
- `git diff --check`, scoped secret scan, and final diff review are recorded in `latest-qa.md`.
- Real signed-in Owner browser QA is **NOT RUN**. No Web/API production deployment was performed. Next manual QA should leave the panel open across several silent polls, then trigger Desktop lock/unlock and Browser restart/interruption/recovery and confirm only the relevant per-device list gains a row without losing scroll position.

## 2026-07-23 Browser Extension 0.5.9 Repeated Content-Script Injection Fix

### Original Task Brief

- Investigate real Chrome and Edge `0.5.8` error-page evidence showing `Uncaught SyntaxError: Identifier 'workMapWindow' has already been declared` from `dist/contentScript.js` after pairing both browsers.
- Determine whether the observed `/reports` Domain open/runtime `Not enabled` state is a Browser script defect or a Web/API/policy state problem, and fix the confirmed Browser defect once confidence exceeds 95%.

### Changed Files

- Browser Extension: `workmap/apps/browser-extension/src/contentScript.ts`, package/manifest/version constant, version assertions, and new executable regression `test/content-script-idempotency.test.ts`.
- Generated release outputs: `workmap/apps/browser-extension/alpha-unpacked` and `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.9.zip`.
- Long-lived memory: this handoff and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, shared contract, Prisma schema/migration, policy, RBAC, deployment, or production data was modified.

### Root Cause And Fix

- The registered all-frame content script and the recovery/manual injection can legitimately execute `dist/contentScript.js` in the same document. In `0.5.8`, the intended `window.__workmapDomainActivityInstalled` guard was preceded by a top-level lexical `const workMapWindow` declaration. A second classic-script execution failed during parsing before the guard could run, exactly matching the supplied Chrome/Edge stack trace.
- The content-script runtime is now enclosed in a fresh IIFE scope. Re-execution can parse safely, then returns through the existing per-frame `window` marker. This preserves dynamic registration and recovery injection while preventing duplicate listeners/messages and retaining all hostname-only privacy rules.
- The patch is versioned `0.5.9`; reusing `0.5.8` would leave two behaviorally different packages with the same diagnosable version.

### Domain Open/Runtime Diagnosis

- `/reports` renders `Not enabled` only when `trackingV2Coverage.domainOpenRuntimeEnabled` is not exactly `true`. The API derives that field from the current active Monitoring Policy's independent `collectDomainOpenRuntime` flag, whose migration default is deliberately `false`.
- Installing `0.5.8` or `0.5.9` never enables the privacy-sensitive policy automatically. An authorised Owner/policy administrator must use `/compliance` -> `Browser Domain open/runtime` -> `Enable and create new policy version`; employees must acknowledge the new version before Extensions receive a lease with `collectDomainOpenRuntime: true`.
- If `/compliance` has no Browser Domain runtime control, Web production is stale. If enabling it fails, check that migration `20260723120000_browser_domain_runtime_policy` and the matching API are deployed. If Compliance says enabled but Reports still says `Not enabled`, inspect the usage-summary response for a stale/missing `trackingV2Coverage.domainOpenRuntimeEnabled`. If Reports says enabled but an Extension remains disabled, inspect its Options policy version, acknowledgement, and lease fields.
- The repeated content-script SyntaxError blocks page activity/checkpoint instrumentation but does not alter the server policy flag. It is therefore a real Browser bug, but not the reason the Reports policy label says `Not enabled`.

### Verification, Artifact, And Manual QA

- Browser typecheck, lint, test (`66/66`), build, and `release:zip` pass. The new test transpiles and executes the actual content-script source twice in one VM document, verifies no exception, and verifies that window/document/runtime listeners and startup messages are not duplicated.
- ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.9.zip`; manifest `0.5.9`; 22 entries; 49,024 bytes; SHA-256 `C37621B92B543772F414B0868B0D2145478179A9C4BED89345220DEB8BE5879D`.
- Post-fix real Chrome/Edge load-unpacked QA is **NOT RUN**. The supplied screenshots are valid pre-fix `0.5.8` evidence only. No store upload, GitHub release, API/Web deployment, database migration, or production policy change was performed.

## 2026-07-23 Browser Extension 0.5.8 Connection Audit And Domain Runtime

### Original Task Brief

- Release Browser Extension `0.5.8` only after reaching at least 95% confidence in the current MV3/Tracking v2 architecture.
- Send every Browser lifecycle transition that Chrome/Edge can honestly observe to Owner `/reports` Connection Audit in near real time, including start/restart, lock/unlock, network/service interruption and recovery. Do not claim an exact close, disable, crash, or sleep cause when the Extension cannot observe it.
- Implement policy-controlled Browser Domain open/runtime end to end without reusing the Desktop `collectOpenRuntime` flag. Same-host tabs must de-duplicate, different hosts may run in parallel, rejected data must not enter Reports, and Chrome/Edge overlap must not double-count.
- Preserve hostname-only privacy, pairing, device credential binding, policy version/lease/acknowledgement/windows, durable queues, terminal diagnostics, tenant/RBAC boundaries, and all Desktop Agent behavior.

### Changed Files

- Browser runtime/store/release: `workmap/apps/browser-extension/src/backgroundV2.ts`, new `browserOpenRuntimeEngineV2.ts`, `browserFocusTimelineV2.ts`, `trackingV2Store.ts`, `trackingV2Types.ts`, `extensionStorage.ts`, `options.ts`, `manifest.json`, `package.json`, `scripts/package-alpha.mjs`, generated `alpha-unpacked/manifest.json`, and Browser tests.
- Shared/API/policy/ledger/reports: `workmap/packages/shared-types/src/tracking-v2.ts`, Compliance controller/service, device policy/sync/status services, Reports services, Prisma schema, and migration `20260723120000_browser_domain_runtime_policy`.
- Web: Compliance policy/acknowledgement UI and API types/client, `/reports` live/audit/Domain metric presentation, and focused Web tests.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/api-contract-skill.md`, `frontend-skill.md`, `qa-skill.md`, and `deployment-skill.md`.
- No file under `workmap/apps/desktop-agent` was modified.

### Connection Audit Implementation

- Browser status events use the scoped device credential, stable `clientEventId`, durable local queue, retry/backoff, protocol v2 identity, safe metadata, and server occurrence/receipt separation.
- Directly observable transitions are queued immediately: pairing start (`RUNNING / AGENT_STARTED`), browser profile start or Extension update (`RESTARTED / AGENT_RESTART`), lock (`LOCKED / SYSTEM_LOCK`), unlock (`RECONNECTED / SYSTEM_UNLOCK`), confirmed network/service failures, and confirmed recovery.
- Owner `/reports` requests audit history every five seconds while the selected employee report is visible. Stored Browser status history is no longer excluded, multiple genuine profile starts with different event IDs remain distinct, and retries of one event ID remain idempotent.
- A last server-confirmed Browser heartbeat older than 90 seconds creates an honest current `Signal interrupted` row even before recovery. On the next successful heartbeat, the API persists an inferred `UNKNOWN_INTERRUPTED / HEARTBEAT_TIMEOUT` gap and a recovery row unless a more specific client-reported lock/network/service transition already explains the gap.
- Chrome/Edge cannot reliably report an exact browser close, Extension disable/uninstall, process crash, machine power loss, or sleep entry while no JavaScript can run. These remain `Signal interrupted` with inferred coverage-lost time and recovery time; the UI does not label them as a user stop or exact sleep/close cause. `runtime.onSuspend` is deliberately not treated as reliable asynchronous telemetry.
- The previous fake “Extension started” row derived from pairing/enabled time was removed. Connection Audit now distinguishes confirmed client transitions from inferred heartbeat gaps and de-duplicates the same current interruption across coverage and live-heartbeat sources.

### Browser Domain Open/Runtime Implementation

- New immutable policy field and lease grant: `collectDomainOpenRuntime`, default `false`. An authorised policy administrator enables it through `POST /compliance/policy/:policyId/domain-open-runtime-version`, which creates a new policy version and requires a new employee acknowledgement. Desktop `collectOpenRuntime` remains separate.
- Runtime begins only when policy, acknowledgement, lease, schedule UTC window, host permission, content-script registration, Browser identity and queue capacity all permit it. The API requires both the active policy and the issued lease to grant Browser Domain runtime; otherwise it returns terminal `OPEN_RUNTIME_NOT_ENABLED`.
- The Extension enumerates only eligible, permission-granted ordinary HTTP/HTTPS tabs and stores/sends hostname only. A hostname with one or more open tabs has one runtime clock; three same-host tabs open for five minutes produce five minutes, not fifteen. Different hostnames may run in parallel.
- Minimized/background windows and ordinary user idle do not close open/runtime because it describes “page remained open,” not work or Focus. Last-tab close, cross-host navigation, exclusion/permission loss, lock, policy/window/lease boundary, queue pressure, and proven lifecycle discontinuity close the relevant runtime interval. Service-worker/browser/sleep gaps stop at the last durable observation and are never backfilled.
- Open/runtime has its own clock/checkpoint/watermark and IndexedDB stream sequence identity. Runtime state and emitted intervals are atomically persisted; worker restart seals only proven time. The v2 queue schema migrates old Focus rows without changing their stable IDs.
- Accepted Browser `BROWSER_DOMAIN / OPEN_RUNTIME` intervals enter the official ledger and Domain Reports. Duplicate intervals remain idempotent; terminal rejections remain dead-letter evidence with safe code/request ID and never enter totals.
- Reports exposes separate App and Domain runtime-enabled flags. Confirmed same-user/same-host/same-metric overlaps from Chrome and Edge are unioned during reconciliation instead of added. App and Domain totals remain separate and are not presented as one “total work” duration.

### Privacy, Policy, And Access Behavior

- Recorded: Browser/device/version identity, server-confirmed health, safe lifecycle state/reason/time/confidence, hostname-only Focus Active/Focused Idle/open-runtime intervals, policy/lease/window/version, queue/result state, and bounded safe diagnostics.
- Never recorded: full URL, path/query/fragment, title, page/iframe URL or content, key value, typed text, form value, target element, pointer coordinate, scroll direction/distance, screenshots, clipboard, camera, microphone, bearer token, or reusable device credential.
- Iframe trusted interaction can prove top-level page Focus but remains attributed only to the top-level hostname. One Browser instance still has at most one Focus hostname, based on the OS-focused usable window plus the one eligible page that proves focus/trusted interaction. Multiple displays do not create multiple Focus lanes.
- Focus stops on minimize, background/focus loss, internal/protected page, ordinary idle threshold, lock, lifecycle discontinuity, and policy boundary. Open/runtime is deliberately broader context and is never described as active work.
- Incognito remains manifest-disabled. Chrome/Edge/profile devices remain separate identities; server Reports performs confirmed overlap union where possible.
- Owner/HR policy-management authorization, employee acknowledgement, tenant isolation, revocation, activation, credential binding and source/browser identity validation are unchanged.

### Verification, Artifact, And Manual QA

- Final automated results: Browser typecheck/lint/build/release pass and tests `65/65`; API typecheck/lint/build pass and tests `55/55`; Web typecheck/lint/build pass and tests `88/88`; shared types typecheck/build pass; Prisma client generation passes.
- The first API regression run caught a same-status/different-ID idempotency issue; the rule was narrowed so only distinct Browser profile-start events remain separate. Final API suite is green.
- `git diff --check` passes. Scoped secret scan excluding `.env*`, dependency/build/output/reference directories found no secret signature. No Desktop Agent code diff exists.
- Unpacked: `workmap/apps/browser-extension/alpha-unpacked`.
- ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.8.zip`; manifest/package `0.5.8`; 22 entries; size `48,842` bytes; SHA-256 `B739FB3AB5CA916FA3F3270752F1B0D5AE471FB9AEC45B8A51C65266BCF1E9F2`.
- `release:zip` was hardened to fail if the ZIP is missing/empty after compression; this prevents a successful command from leaving the prior-version artifact as the newest visible package.
- Real Chrome and Edge load-unpacked QA is **NOT RUN**. No Chrome Web Store, Edge Add-ons, GitHub Release, database migration, API/Web production deployment, or other publication was performed.
- Deploy migration/API/Web before enabling the new Domain runtime policy and before distributing 0.5.8. Then reload the same unpacked Extension entry to preserve pairing/IndexedDB and complete the manual matrix recorded in `latest-qa.md`.

## 2026-07-23 Desktop Agent Connection Audit Semantics Review

### Original Task Brief

- Inspect the current Owner `/reports` Connection Audit implementation and explain which Desktop Agent states produce which visible labels.
- Interpret the supplied `Locked / System Lock` and `Reconnected / System Unlock` rows from source rather than treating the audit list as the current live connection state.

### Changed Files

- Diagnostic handoff only: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, policy, release, artifact, or production behavior was changed.

### Implementation And Data-Flow Findings

- The current source package is Desktop Agent `0.6.8`. Electron emits `SLEEPING / SYSTEM_SUSPEND`, `RECONNECTED / SYSTEM_RESUME`, `LOCKED / SYSTEM_LOCK`, and `RECONNECTED / SYSTEM_UNLOCK` from Windows power/session events. Tracking v2 also queues `RUNNING / AGENT_STARTED` at runtime start and `STOPPED_BY_USER / USER_STOP` on an in-app Quit Agent.
- A lock or sleep event first closes the current foreground interval boundary, then durably queues the lifecycle status. Unlock/resume is therefore a recovery transition; it does not retroactively count the locked/sleeping period as focus.
- The API stores confirmed client occurrence time separately from server receipt time. Reports uses the event `startedAt` as the displayed time, formatted in the viewing browser's locale. If receipt trails occurrence by more than 30 seconds, the detail appends a separate `synced <time>` value.
- Device status history is tenant/user scoped, filtered to `DESKTOP_AGENT`, limited to 500 records, and selected by the report range using server-side `recordedAt`. Consecutive identical device/session/status/reason rows are coalesced.
- The Web audit combines legacy `AgentSession` rows with only six supplemental device statuses: `NETWORK_OFFLINE`, `SERVER_UNREACHABLE`, `SLEEPING`, `LOCKED`, `RECONNECTED`, and `RESTARTED`. Positive green markers apply only to `RUNNING` and `RECONNECTED`; attention red applies to network/server loss, crash, termination, and unknown interruption; other displayed statuses use a neutral grey marker.

### Screenshot Interpretation

- `Locked — Desktop Agent - System Lock — 12:49 PM` means Windows reported a lock-screen transition and the Agent closed the current focus boundary at that client-reported time.
- `Reconnected — Desktop Agent - System Unlock — 1:52 PM` means Windows later reported unlock and the Agent delivered that transition. Here `Reconnected` means recovery from lock; it is not proof of a network failure.
- These two rows are historical transitions in the selected report range. They do not determine whether the Agent is currently online; current connection is shown in Live signals from fresh server-confirmed health/heartbeat.

### Confirmed Presentation Gap

- Tracking v2 status events for `RUNNING`, `STOPPED_BY_USER`, `DEVICE_SHUTDOWN`, `AGENT_CRASHED`, `AGENT_TERMINATED`, and `UNKNOWN_INTERRUPTED` are not in the supplemental allow-list. Because the current v2 runtime does not create the legacy `AgentSession` used by the other audit branch, its normal start/quit and several terminal events can be absent from this timeline even though they were stored.
- `RECONNECTED` is intentionally reused for both `SYSTEM_RESUME` and `SYSTEM_UNLOCK`; the reason line is required to tell which occurred. `RESTARTED` currently receives a neutral marker rather than a recovery-positive marker.
- Current Tracking v2 does not emit `NETWORK_OFFLINE` or `SERVER_UNREACHABLE` lifecycle events for ordinary sync failures; those enum values are primarily legacy-compatible. Live health and diagnostics remain the reliable current network indicators.
- No product fix was made because this round requested source-backed explanation. A future narrow API/Web change should render all v2 lifecycle transitions directly and add focused audit tests without changing collection, policy, or live heartbeat semantics.

### Verification And Manual QA

- Reviewed Desktop Electron power hooks, Tracking v2 lifecycle queue/finalization, status API persistence/deduplication, Reports query/coalescing, and Web audit rendering/tone/formatting.
- `git diff --check` and a scoped secret scan were run after this documentation update.
- No new automated product test was required because runtime behavior was not changed. Real Windows lock/unlock QA was not run in this review; the supplied screenshot is manual evidence for one stored lock/unlock pair.

## 2026-07-23 Browser Extension 0.5.7 Cross-Epoch Focus Reliability

### Original Task Brief

- Implement the previously diagnosed Browser-only repair after a real Edge 0.5.6 `FOCUS_OVERLAP` tombstone proved that independently valid Focus epochs could regress in UTC and overlap.
- Preserve MV3/Tracking v2, hostname-only privacy, policy/lease/acknowledgement rules, pairing, old rejection evidence, and all Desktop Agent behavior.

### Changed Files

- Runtime/timeline/store: `workmap/apps/browser-extension/src/backgroundV2.ts`, new `browserFocusTimelineV2.ts`, `trackingV2Store.ts`, and `trackingV2Types.ts`.
- Tests: new `test/browser-focus-timeline-v2.test.ts`, plus `service-worker.test.ts`, `sync-diagnostics.test.ts`, `tracking-v2-store.test.ts`, and the queue/version fixture.
- Release metadata/output: Browser `package.json`, `manifest.json`, generated `alpha-unpacked`, and `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.7.zip`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `deployment-skill.md`.

### Implementation Summary

- Runtime state advances from version 6 to 7 with `focusTimelineThroughAt`, the latest end of every locally emitted Focus interval across all clock epochs. The watermark and new interval rows are written in the same IndexedDB transaction. A 0.5.6 upgrade derives the watermark from the server-confirmed-through value and every retained queued interval; pairing and rejection history are not reset.
- A new Focus epoch is anchored to the trusted page observation's occurrence-time projection, not the later message-processing time. Activation time, the active server-issued UTC window, and the durable Focus watermark are hard lower bounds. If a legacy watermark is temporarily ahead of current server time, collection waits instead of fabricating future or overlapping Focus.
- Server clock offset now uses the client request-start boundary rather than response-arrival time. A slow API response therefore cannot shift the next epoch backward by the response latency.
- Network fetch is outside the serialized browser-state mutation lane. Request preparation and response application remain serialized around durable state, while tab/window/blur/trusted-input events arriving during HTTP wait are persisted first. Sync requests are coalesced, obsolete pairing-generation responses are ignored, and an old snapshot response cannot confirm/reject a newer local snapshot.
- Duplicate boundary uploads were removed: clear/page replacement paths persist the old interval, prove the replacement page, and schedule one combined sync where possible. Durable-before-sync ordering remains unchanged.

### Privacy, Policy, And Intentional Non-Changes

- Collection remains hostname plus Focus Active/Focused Idle timing and safe operational diagnostics. No path/query/fragment, title, page content, input text/key value, pointer detail, credential, or reusable secret is added.
- Domain open/runtime remains disabled; no Desktop policy flag is reused.
- No Desktop Agent, shared contract, API, Web, Prisma/schema, tenant/RBAC, credential, or production deployment change is included. Browser connection audit remains a separately identified API/status-history gap.
- The old Edge 0.5.6 `FOCUS_OVERLAP` tombstone remains visible and excluded from totals; 0.5.7 prevents new client-generated overlap rather than deleting evidence.

### Verification, Artifact, And Manual QA

- Browser typecheck, lint, tests `61/61`, build, and `release:zip` pass. Executable regressions cover delayed evidence, regressed clock estimates, cross-epoch adjacency, future legacy watermark recovery, monotonic watermark advancement, request-start clock calibration, and stale snapshot-response isolation.
- ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.7.zip`; 21 entries; manifest `0.5.7`; size `44,623` bytes; SHA-256 `FF09C62FCC37233DB297D8639C1A4E7876595C3DC7A05D8A6BB71DF0FD06AEED`.
- Real Chrome/Edge 0.5.7 load-unpacked QA is **NOT RUN**. Reload the same unpacked extension entry so pairing/IndexedDB survive, then test slow/offline sync plus rapid tab/window changes and require no new `FOCUS_OVERLAP`, accepted/duplicate interval evidence, advancing confirmed-through, and correct Domain totals.
- Source/artifact can proceed to this manual QA round. Do not publish or deploy automatically.

## 2026-07-23 Browser Extension 0.5.6 Focus-Overlap Diagnosis

### Original Task Brief

- Review the supplied `/reports`, Edge 0.5.6 Options, and Chrome 0.5.6 Options screenshots; determine whether the Edge `FOCUS_OVERLAP` is a real problem; and inspect the complete Browser Extension-to-ledger-to-Reports flow against current source and executable tests.
- Do not modify Desktop Agent behavior, delete historical evidence, or hide a current failure.

### Changed Files

- Diagnostic handoff only: `docs/ai-handoff/latest-implementation.md` and `docs/ai-handoff/latest-qa.md`.
- No Browser Extension, Desktop Agent, API, shared-contract, Web, schema, release, artifact, or production file was changed in this review round.

### Evidence-Based Findings

- The normal Browser v2 pipeline is operational. Chrome and Edge have fresh server-confirmed heartbeats, valid policy v2/acknowledgement/lease/windows, granted host access, registered content scripts, healthy collectors, accepted interval results, advancing confirmed-through values, and confirmed Domain rows in `/reports` (`work-map-teal.vercel.app` Focus Active 5m7s / Focused Idle 14s and `github.com` Focus Active 17s in the supplied capture).
- The Edge `FOCUS_OVERLAP` is a real Extension-side correctness defect, not a Chrome-versus-Edge conflict. API overlap lookup is scoped by `deviceId`, `source`, and `stream`, so a Chrome device cannot cause the Edge tombstone. The server correctly kept the rejected Edge interval out of the official ledger and Reports; the consequence is an undercount for that rejected slice, not double-counted report time.
- Root cause confidence exceeds 95%. Browser event handlers and sync calls share one serialized operation lane, and `clearFocus(true)` can request sync both inside `persistUpdate` and again after clearing state. Page-boundary flows can add another immediate request. A delayed sync therefore delays later browser evidence and changes `serverOffsetMs` while an existing epoch retains its old wall-clock anchor.
- A newly created engine is anchored from processing-time `serverNow(state)` even when the content message's trusted occurrence time has been mapped to an earlier monotonic timestamp. The durable state has an engine-local checkpoint and a server-confirmed-through diagnostic, but no durable local Focus timeline high-water mark shared across engine epochs. A later epoch can consequently start before the prior emitted epoch ended even though every interval is individually positive and valid. A direct two-epoch engine reproduction produced `[00:00:00, 00:00:10]` followed by `[00:00:09, 00:00:11]`.
- The existing 56 Browser tests cover non-overlap inside one engine/epoch, but do not simulate a slow sync, a queued trusted event, a server-offset update, engine teardown, and a new epoch together. This explains why the suite passes while the real Edge tombstone exists.
- Reports reconciliation unions overlapping accepted Chrome/Edge intervals for the same user, hostname, day, and metric. It does not unconditionally add them. The focused API test for that exact case passes.
- Chrome's online-but-stale snapshot is semantically correct: connection health is based on the fresh confirmed heartbeat, while no newer eligible-page observation exists. Edge later recovered, drained its ordinary queue, accepted more intervals, and advanced confirmed-through; the retained dead-letter remains visible by design.
- Browser connection audit remains incomplete. MV3 `backgroundV2.ts` does not send the legacy extension-status event stream, and the API `getDeviceStatusHistory` query currently filters to Desktop Agent. Live Browser connection state is valid, but `Browser Extension: 0 events` cannot prove that there were no interruptions.

### Recommended 0.5.7 Repair Scope

- Add a migrated, durable local Focus timeline high-water mark and clamp every new Browser Focus epoch after all previously emitted local Focus intervals, including queued/unconfirmed intervals.
- Anchor a delayed trusted observation to its occurrence-time wall-clock projection rather than processing-time `serverNow`, while preserving activation, policy-window, lease, clock-jump, restart, and no-backfill boundaries.
- Remove duplicate immediate sync calls and move/coalesce network work outside the browser-event mutation lane without weakening durable-before-sync ordering.
- Add a controlled regression that combines delayed sync, queued activity/blur/tab transitions, server-offset changes, worker restart, and cross-epoch validation; assert no local or server `FOCUS_OVERLAP` and no negative/overlong interval.
- Treat Browser connection-audit production as a separate API/status-history contract change. Do not fabricate audit rows from current heartbeat state.

### Verification And Recommendation

- Browser Extension typecheck: passed; lint: passed; tests: passed `56/56`.
- Focused API live-semantics and reconciliation tests: passed `16/16`, including official Browser Domain ledger entry, terminal rejection exclusion, adjacent interval preservation, and Chrome/Edge union reconciliation.
- User-supplied screenshots are real manual evidence for Chrome and Edge 0.5.6 connection, accepted interval, and Reports visibility. Multi-window/display, minimize, lock, sleep, restart, offline, and Split View acceptance were not exercised in this review.
- 0.5.6 is not clean enough to call final Browser reliability acceptance because `FOCUS_OVERLAP` can recur and lose a slice. Proceed to a narrow Browser-only 0.5.7 reliability fix; do not modify Desktop Agent.

## 2026-07-23 Reports Current Browser Connection Selection

### Original Task Brief

- Review real Chrome Browser Extension 0.5.6 Options and `/reports` screenshots from July 23 around 10 AM, decide whether the data path is healthy, and remove obsolete Browser connection-failure blocks from the live section without hiding a genuine current outage.
- Do not modify Desktop Agent or delete historical device/ledger evidence.

### Changed Files

- Reports presentation and selection: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx` and `trackingV2LivePresentation.ts`.
- Executable Web regressions: `workmap/apps/web/test/tracking-v2-live-presentation.test.ts`.
- Synced existing Reports source-contract assertions with the current revision/live-section architecture: `workmap/apps/web/test/reports-information-order.test.ts`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/frontend-skill.md`, and `qa-skill.md`.

### Implementation Summary

- The supplied 0.5.6 evidence proves the core Browser Domain path is working: a server-confirmed heartbeat/sync and request ID exist; policy v2, acknowledgement, lease, schedule, host permission and content registration are valid; the queue/dead-letter counts are zero; one interval is `ACCEPTED` with zero duplicate/rejected; confirmed-through advanced; and `/reports` contains a confirmed `work-map-teal.vercel.app` Domain Focus Active row for 20 seconds.
- The local screenshot also captured one heartbeat older than the shared 90-second freshness boundary, followed by a later successful sync and `HEALTHY` collector state. This is a recovered transient interruption, so 0.5.6 is materially healthy but should still be observed over a longer Chrome/Edge lifecycle run before calling it issue-free.
- `/reports` previously rendered every non-revoked Browser pairing, so obsolete 0.5.3/0.5.4/0.5.5 device identities appeared as red live cards beside the active 0.5.6 device. Live presentation now groups Browser devices by employee and browser identity. When that browser has one or more fresh connections, only those fresh Browser cards appear. When none is fresh, the newest interrupted card remains visible so a real outage cannot be hidden.
- The live connected/total, confirmed-snapshot count, sequence-gap warning and dead-letter warning are recalculated from visible current cards. A neutral count says how many older inactive Browser cards were hidden.
- Historical device, rejection, ledger and confirmed report data are not deleted or rewritten. Old Browser pairings remain available to backend/device management and historical diagnostics; this is a Live signals presentation rule only.

### Role, Privacy, And Intentional Non-Changes

- Owner/HR-visible Reports behavior changes only; backend tenant isolation and report authorization remain unchanged.
- No Browser Extension binary/version, Desktop Agent, API, shared contract, database/schema, policy, credential, Domain collection rule, store publication, or deployment changed.
- Browser Extension stays at `0.5.6`; its existing ZIP and SHA-256 are unchanged. Domain open/runtime remains disabled.

### Verification And Manual QA

- Web typecheck, lint, full automated tests `84/84`, and production build pass. The new executable tests cover fresh Browser replacement, removal of hidden old dead-letter attention, and preservation of the newest interrupted card when a browser has no current connection.
- `git diff --check` and scoped secret scan are recorded in `latest-qa.md`.
- Supplied screenshots are genuine pre-Web-change Chrome 0.5.6 evidence. The changed `/reports` UI was **NOT RUN** in a deployed/signed-in browser, and Edge 0.5.6 remains **NOT RUN**.
- After deploying the Web change, verify the screenshot scenario shows Desktop Agent plus the current Chrome 0.5.6 card, a visible hidden-card count, and no obsolete 0.5.3/0.5.4/0.5.5 live warning. Stop the current 0.5.6 connection for more than 90 seconds and verify the newest Chrome interruption card reappears.

## 2026-07-22 Browser Extension 0.5.6 Health/Collector Separation

### Original Task Brief

- Review real 0.5.5 Options and `/reports` screenshots because the client still appeared wrong, and modify only after reaching at least 95% root-cause confidence.
- Preserve the current MV3/Tracking v2 architecture, privacy boundaries, and all Desktop Agent behavior.

### Changed Files

- Runtime and local status: `workmap/apps/browser-extension/src/backgroundV2.ts` and `src/extensionStorage.ts`.
- Options diagnostics: `src/options.ts` and new pure module `src/optionsDiagnostics.ts`.
- Version/release: `src/trackingV2Types.ts`, `package.json`, `manifest.json`, and generated `alpha-unpacked/manifest.json`.
- Tests: new `test/options-diagnostics.test.ts`, `test/sync-diagnostics.test.ts`, `test/service-worker.test.ts`, and the version fixture in `test/queue-api.test.ts`.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.6.zip`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `deployment-skill.md`.

### Implementation Summary

- The screenshots prove that 0.5.5 pairing initialization was fixed: the new device had policy v2, acknowledgement, lease/windows, granted host permission, registered content script, request ID, and a real server-confirmed heartbeat/sync at 20:29:12. This is different from the 0.5.4 all-pending failure.
- Options nevertheless called the client Offline after 30 seconds while API/Reports use a 90-second Browser freshness window. Chrome officially guarantees only that a 30-second alarm will not fire sooner and explicitly permits arbitrary additional delay. Root-cause confidence for the contradictory `Options Offline` / `Reports Connected` presentation is above 99%.
- Options also rendered collector state from `latestSnapshot.collectorState` and hard-coded `PAUSED` when no snapshot existed. The screenshot's `connected / PAUSED` therefore was not the current collector state. Current connection and collector enums are now persisted separately; Options displays the exact collector lane and uses the same 90-second connection boundary as Reports.
- The existing five-second Options refresh previously reloaded API/browser/exclusion form values. It now refreshes diagnostics only, leaving user input untouched.
- Tracking maintenance previously ran window/tab/Focus reconciliation before the alarm heartbeat. A Chrome API or local Focus-maintenance exception could therefore skip health sync and leave no safe diagnostic. Startup and recurring alarm cycles now isolate collector maintenance from heartbeat: maintenance failure records bounded `FOCUS_RECONCILE_RETRY`, sets collector `LIMITED`, and still runs health sync even if diagnostic persistence also fails. A later event/alarm retries and restores collector health when policy allows.
- `Current Domain NONE` while Options itself is focused is correct because extension/internal pages are intentionally ineligible. Options now states that a focused, interacted-with HTTP/HTTPS page is required. The screenshots still do not prove a normal-page snapshot or formal interval was accepted, so that remains manual acceptance work.
- `/reports` shows multiple 0.5.3/0.5.4/0.5.5 Browser devices because repeated pairing created separate device identities. This patch does not silently revoke or delete old devices.

### Role, Privacy, And Intentional Non-Changes

- No Desktop Agent, API, shared Tracking v2 contract, Web Reports code, database schema, policy/RBAC/tenant boundary, device credential, or production deployment changed.
- Domain open/runtime remains disabled. No URL path/query/fragment, title, page content, input value, pointer detail, credential, or reusable secret is recorded.

### Verification And Artifact

- Browser typecheck pass, lint pass, automated tests `56/56`, build pass, and `release:zip` pass.
- Executable regressions prove 30–90 second Browser heartbeats remain Online and that Focus maintenance plus diagnostic-write failure cannot suppress the independent heartbeat callback.
- ZIP manifest version `0.5.6`, 20 entries, size `42,366` bytes, SHA-256 `5A25594155D81920598EA852299EDD1C66BE59EAC254D89DBEBC9E9D873797AB`.

### Manual QA And Next Step

- Supplied screenshots are real 0.5.5 evidence, not post-fix 0.5.6 acceptance. Chrome/Edge 0.5.6 load-unpacked QA is **NOT RUN**.
- Reload the same `alpha-unpacked` entry without removing/re-pairing. On Options, require a heartbeat/sync that advances repeatedly for at least three minutes and an exact `HEALTHY`, `LIMITED`, or `PAUSED` collector value rather than an inferred fallback.
- Focus and interact on a normal HTTP/HTTPS page for at least 70 seconds, switch to a second hostname, then require a confirmed current snapshot, an accepted/duplicate Focus Active plus Focused Idle interval, advancing confirmed-through, and a Domain row in `/reports`.
- If snapshot remains NONE, retain the newest `FOCUS_RECONCILE_RETRY`/request ID screenshot and the extension service-worker console error. Do not share credentials or full URLs.

## 2026-07-22 Browser Extension 0.5.5 Pairing Initialization Recovery

### Original Task Brief

- Review the real 0.5.4 Options and `/reports` screenshots and decide whether the Browser Extension was healthy.
- Fix only after reaching at least 95% root-cause confidence, preserve the existing MV3/Tracking v2 architecture, and do not change Desktop Agent behavior.

### Changed Files

- Browser pairing/runtime/store: `workmap/apps/browser-extension/src/options.ts`, `src/backgroundV2.ts`, and `src/trackingV2Store.ts`.
- Browser version/release: `src/trackingV2Types.ts`, `package.json`, `manifest.json`, and generated `alpha-unpacked/manifest.json`.
- Tests: `test/tracking-v2-store.test.ts`, `test/service-worker.test.ts`, and the version fixture in `test/queue-api.test.ts`.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.5.zip`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/qa-skill.md`, and `deployment-skill.md`.

### Implementation Summary

- The screenshots are not a healthy 0.5.4 data path. The Options page belongs to a newly paired 0.5.4 device and shows no first heartbeat, policy, lease, host-permission check, content registration, snapshot, interval, or request ID. The `/reports` Browser card explicitly remains the different stale 0.5.3 client, so it does not prove that 0.5.4 interval generation failed again; 0.5.4 never initialized far enough to exercise it.
- Root-cause confidence is above 99%. After saving pairing, Options immediately reopened the Tracking v2 IndexedDB for status while the background worker tried to reset it with `indexedDB.deleteDatabase()`. Because Options and the MV3 worker are separate contexts, the open connection could block deletion. Reset then rejected before initialization, the one-shot message error was discarded, and later alarms returned against the already-initialized empty in-memory state forever.
- 0.5.5 clears `intervals`, `deadLetters`, and `meta` atomically in one read/write transaction instead of deleting the multi-context database. Options closes its own store before notifying the worker and waits for a positive initialization acknowledgement. A post-pair initialization error now remains honestly paired/offline instead of being mislabeled unpaired.
- Alarms and later runtime events now compare durable `workmapConfig` with in-memory pairing state and self-heal an interrupted or lost pairing message by resetting and initializing from the saved config.
- Existing 0.5.3 server-side device/history is not deleted. After a same-path 0.5.5 reload, the newly paired device should produce its own fresh 0.5.5 heartbeat/snapshot/interval evidence; stale device cleanup or revocation remains an explicit admin action.

### Role, Privacy, And Intentional Non-Changes

- No Desktop Agent, API, shared Tracking v2 contract, Web Reports code, database schema, policy/RBAC/tenant boundary, or credential format changed in this round.
- Domain open/runtime remains disabled. Hostname-only collection and all existing prohibitions on full URLs, page content, titles, input values, pointer details, credentials, and reusable secrets remain unchanged.

### Verification And Artifact

- Browser typecheck pass, lint pass, tests `52/52`, build pass, and `release:zip` pass.
- The new executable store regression simulates an already-open multi-context database and proves reset clears all three stores in one transaction without `deleteDatabase()`.
- ZIP root/manifest/compiled reset and pairing acknowledgement were inspected. Manifest version `0.5.5`, 18 root entries, size `41,473` bytes, SHA-256 `0A025846BE2A59A7C6C2111FC3A29A69EFA230B045D5F338844480F48282CC2B`.
- Final diff/secret checks are recorded in `latest-qa.md`.

### Manual QA And Next Step

- The supplied screenshots are real pre-fix 0.5.4 failure evidence. No real Chrome or Edge 0.5.5 load-unpacked session was run here; manual QA is **NOT RUN**.
- Reload the same `alpha-unpacked` path so the new 0.5.4 pairing is retained. Re-pairing should not be necessary unless the saved credential was revoked or the extension identity/storage was removed.
- Within one alarm cycle (normally 30 seconds), expect policy/lease, permission/registration, request ID, last confirmed sync, and a fresh server-confirmed heartbeat. Interact with an eligible HTTP/HTTPS page, wait long enough to close an interval, then require accepted/duplicate evidence, an advancing confirmed-through cursor, a fresh 0.5.5 Browser card, and a confirmed Domain row in `/reports`.
- The Browser connection-audit panel can still legitimately show zero events until an actual offline/reconnect or lifecycle transition occurs; it is not the heartbeat ledger.

## 2026-07-22 Browser Extension 0.5.4 Monotonic Millisecond Reliability Fix

### Original Task Brief

- Review real Chrome 0.5.3 Options and `/reports` evidence after standalone pairing, decide whether the data path was healthy, and fix only after reaching at least 95% root-cause confidence.
- Preserve MV3/Tracking v2, hostname-only privacy, server-confirmed health/snapshot/history separation, existing pairing, and all Desktop Agent behavior.

### Changed Files

- Browser runtime/version: `workmap/apps/browser-extension/src/browserFocusEngineV2.ts`, `src/trackingV2Types.ts`, `package.json`, `manifest.json`, and generated `alpha-unpacked/manifest.json`.
- Shared validation: `workmap/packages/shared-types/src/tracking-v2.ts`.
- Tests: Browser `browser-focus-v2.test.ts`, `service-worker.test.ts`, `queue-api.test.ts`; shared `tracking-v2.test.ts`; API `tracking-v2-live-semantics.test.ts`.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.4.zip`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/api-contract-skill.md`, `qa-skill.md`, and `deployment-skill.md`.

### Implementation Summary

- The screenshots prove the 0.5.3 standalone-identity fix worked: the device paired, policy v2/lease/acknowledgement/UTC windows loaded, host access and content registration were healthy, and the server confirmed at least one heartbeat and snapshot.
- The data path was not fully healthy. Options showed six terminal `INVALID_DURATION` rows plus repeated `TRACKING_SYNC_INTERNAL`; Reports correctly kept connection health separate, marked current Domain unconfirmed/stale, displayed the rejected tombstone/request ID, and left Domains empty because no interval had been accepted or duplicated.
- Root cause confidence is above 99%. Real `performance.now()` values are fractional. Arbitrary boundaries produced fractional `durationMs` and `INVALID_DURATION`; exact idle boundaries could produce an integer duration with fractional monotonic bounds, pass the old validator, and then throw when API persistence converted those bounds to database `BigInt`, yielding the observed 500.
- Browser 0.5.4 quantizes the clock epoch, every observation, and recovered 0.5.3 checkpoint boundary to the nearest whole millisecond before interval construction. Emitted wall-clock and monotonic durations remain equal, positive, adjacent, and non-overlapping; sub-millisecond transitions cannot emit zero/negative ledger rows.
- Shared Tracking v2 now requires provided monotonic bounds to be safe integers. Legacy fractional rows therefore become terminal `MONOTONIC_MISMATCH` tombstones with request correlation instead of retrying as server 500. They remain excluded from Reports.
- Existing dead-letter history is intentionally retained. After the API validation update is deployed, any old 0.5.3 pending fractional rows may add a bounded `MONOTONIC_MISMATCH` dead letter while draining; new 0.5.4 rows should then show accepted/duplicate evidence.

### Role, Privacy, And Intentional Non-Changes

- No Desktop Agent file or behavior, policy/RBAC/tenant boundary, pairing credential, hostname privacy rule, Focus/Idle rule, Domain open/runtime flag, Reports aggregation, or database schema changed.
- Browser Domain open/runtime remains disabled. No URL path/query/fragment, title, page content, user input, pointer coordinate, credential, or reusable secret is collected.

### Verification And Artifact

- Browser: typecheck pass, lint pass, tests `51/51`, build pass, `release:zip` pass.
- Shared types: typecheck pass, lint pass, tests `23/23`, build pass.
- API: typecheck pass, lint pass, build pass; focused Tracking v2 live semantics `12/12` pass, including fractional Browser bounds becoming a correlated terminal tombstone rather than 500.
- Full API suite: `49/50`; the sole failure is the pre-existing fixed `2026-06-17` legacy fixture in `tracking-reports-verification.test.ts`, now rejected as too old on `2026-07-22`. The failing file was not changed.
- ZIP manifest version `0.5.4`, 18 root entries, size `40,742` bytes, SHA-256 `BE555797A4B7DF66925299D004B7BE45BF0619756E8C16168A0E57C1456C9EAC`.

### Manual QA And Next Step

- The supplied screenshots are real 0.5.3 reproduction evidence, not post-fix acceptance. Chrome/Edge 0.5.4 load-unpacked QA has not run and is explicitly **未手测**.
- Deploy the API/shared validation build first, then reload 0.5.4 from the same `alpha-unpacked` path so pairing is retained. Do not delete the six historical tombstones merely to make the counter look clean.
- Acceptance requires a fresh server-confirmed heartbeat and snapshot, old pending queue drain, no new `INVALID_DURATION`/`TRACKING_SYNC_INTERNAL`, at least one accepted or duplicate interval, advancing `Confirmed interval through`, and a non-empty confirmed Domain row in `/reports` after a real interval closes.
- A zero Browser connection-audit count for the selected range is not inconsistent with a fresh heartbeat when no interruption/recovery transition has been recorded; validate the audit separately with offline/reconnect QA.

## 2026-07-22 Browser Extension 0.5.3 Standalone Pairing Activation Fix

### Original Task Brief

- Investigate real Edge 0.5.2 diagnostics showing a paired device but no server-confirmed heartbeat, policy, snapshot, interval, or Browser card/Domain rows in `/reports`.
- Fix only after reaching at least 95% confidence; preserve MV3/Tracking v2 and do not modify Desktop Agent behavior.

### Changed Files

- Browser runtime/version: `workmap/apps/browser-extension/src/backgroundV2.ts`, `src/trackingV2Types.ts`, `package.json`, `manifest.json`, and generated `alpha-unpacked/manifest.json`.
- Tests: `test/sync-diagnostics.test.ts`, `test/service-worker.test.ts`, and `test/queue-api.test.ts`.
- Artifact: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.3.zip`.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/api-contract-skill.md`, `qa-skill.md`, and `deployment-skill.md`.
- Concurrent uncommitted Desktop Agent 0.6.8 changes were preserved and not edited by this Browser round.

### Implementation Summary

- Root cause was confirmed above 99% confidence. Web creates the normal Browser pairing code without a workstation selection; API intentionally resolves it as `STANDALONE`, stores `workstationId=null`, and permits Browser v2 policy/activation/sync. Browser 0.5.2 alone contradicted that contract by requiring a workstation before policy retrieval.
- This explains the complete reproduction: pairing and website access succeeded, but heartbeat/policy/snapshot/interval stayed pending, collector stayed paused, `/reports` had no activated Browser device, and each alarm retry added a misleading `NETWORK_ERROR`.
- 0.5.3 accepts API-supported standalone Browser identity while retaining scoped credential, exact `clientType`, `deviceId`, and immutable `CHROME`/`EDGE` checks. Desktop workstation requirements are unchanged.
- A real device/browser mismatch is now terminal `DEVICE_IDENTITY_MISMATCH`, presented as `AUTH_REQUIRED` with re-pair remediation; it is no longer a retryable network outage.
- No API/schema/Reports/policy/RBAC/tenant/privacy/Focus semantics changed. Browser Domain open/runtime remains disabled. Existing 0.5.2 historical diagnostics are not silently deleted; after recovery their false network count should stop increasing.

### Verification And Artifact

- Browser typecheck, lint, build, and `release:zip`: pass.
- Browser tests: pass `48/48`, including executable standalone-null and terminal-mismatch regressions.
- Focused API pairing/policy tests: pass `8/8` with the API tsconfig. An earlier raw-root invocation omitted decorator configuration and failed before assertions; this was a tooling invocation failure, not a product failure.
- ZIP version `0.5.3`, size 40,433 bytes, SHA-256 `0B3171146F394A6AECFE94B4F477E868BC75A28601F8668061FA841F9FD729AE`; ZIP root and manifest were inspected.

### Manual QA, Intentional Non-Changes, And Next Step

- The screenshots are valid pre-fix reproduction evidence. Post-fix Edge/Chrome load-unpacked QA has not run and is not reported as passed.
- Reload 0.5.3 from the same `alpha-unpacked` path to retain pairing; confirm a concrete policy/lease and secure heartbeat appear, then interact with an eligible HTTP/HTTPS page and verify snapshot plus interval evidence.
- Confirm `/reports` gains a separate Edge/Chrome Extension live card, connection audit, and confirmed Domain totals. If still pending, provide a new Options screenshot with the top error, policy, last request ID, and newest bounded diagnostic only; never provide credentials or full URLs.

## 2026-07-22 Desktop Agent 0.6.8 Boundary Precision Fix

### Original Task Brief

- Proceed only with at least 95% confidence and preserve the otherwise healthy 0.6.7 behavior.
- Apply a narrow fix for the four recovered lease/window/lifecycle overlap clusters without weakening policy, hiding diagnostics, or changing unrelated functionality.

### Changed Files

- Runtime/state: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `trackingV2Types.ts`, and `trackingV2Store.ts`.
- Version/release: Desktop package/version/native-host message/build-alpha metadata, generated Alpha metadata/native binary, and Windows installer artifact.
- Tests: `runtime-v2-boundary-serialization.test.ts`, `runtime-v2-ui-status.test.ts`, `tracking-v2-store.test.ts`, and `gui-release.test.ts`.
- Long-lived memory: this handoff and `docs/ai-handoff/latest-qa.md`.
- Unrelated Browser Extension working-tree changes were preserved and not edited as part of this Desktop round.

### Implementation Summary

- Desktop Agent version is now `0.6.8` / `desktop-agent-windows/0.6.8`.
- Native host events, Electron power events, and periodic ticks now mutate Focus/runtime through the same serialized runtime lane. Duplicate lock/suspend evidence is idempotent instead of allowing Electron and native callbacks to close/reset the engines concurrently.
- Focus and open/runtime now project event time through their own clock epochs. A delayed event without an active stream clock is projected back by its measured monotonic lag instead of being treated as current server time.
- Additive persisted `focusTimelineThroughAt` and `openRuntimeTimelineThroughAt` watermarks prevent a new epoch from recreating time already emitted by that stream. Existing 0.6.7 JSON state loads compatibly with empty watermarks; no SQLite or server migration is required.
- Events projected before the current stream watermark or before the policy lease/window are ignored. They are not shifted into authorised time and do not overwrite the current App/visible-App observation.
- Focus and runtime boundaries are independently clamped to the exact current allowed-window/lease end. The final interval may end exactly at the authorised cutoff, while the half-open cutoff snapshot is removed instead of generating a misleading snapshot policy rejection.
- Server cursor responses also advance the matching per-stream watermark. Watermarks never regress and remain after engine resets, policy refresh, queue pressure, or process recovery.
- Existing policy, acknowledgement, tenant/device credential, privacy, Focus/Idle semantics, concurrent per-App open/runtime semantics, diagnostics, queue/dead-letter evidence, and Reports enforcement remain unchanged.

### Role, Access, Privacy, And Security

- No API route, database schema, tenant/RBAC boundary, Owner/Employee/Platform Admin permission, pairing credential, or server overlap/policy rule changed.
- No new title, URL, page content, input, token, screenshot, clipboard, camera, microphone, or message collection was added.

### Verification

- Desktop Agent test: passed `67/67`.
- Desktop Agent typecheck: passed.
- Desktop Agent lint: passed.
- Desktop Agent build including native host and Alpha directory: passed.
- Focused API Tracking v2 ledger/Reports tests: passed `15/15`, including valid Focus Active/Idle official history and open/runtime reconciliation.
- Full API test baseline: `48/49`; the one failure is the documented pre-existing fixed-date `tracking-reports-verification` fixture rejected as too old on 2026-07-22. No API source changed in this round.
- `git diff --check` passed for the shared worktree; scoped Desktop/docs secret scan found no credential, token, database URL, or private key.
- Windows NSIS build: passed after allowing Electron resource download. Artifact: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.8.exe`, size `115431004` bytes, SHA-256 `3FEA611B0ED0F2AE57AB7DBC0B4657570C3B0E4214E1446EAEB0F12337A379E2`.

### Manual QA, Intentional Non-Changes, And Next Step

- No real-device installation, upgrade retention, App switching, lock/unlock, suspend/resume, offline/reconnect, policy refresh, or 21:33/23:00 cutoff smoke was run in this coding environment. Do not mark those passed.
- Network requests remain on the existing awaited/coalesced sync path to avoid a broader response-ordering refactor. Slow network can still delay the live UI, but event timestamps, stream watermarks, and cutoff clamps now protect official interval ordering.
- No backend/database/Web deployment is required for this client-only fix. Install 0.6.8 over 0.6.7, confirm pairing/state retention, then observe that pending drains and the existing rejected total remains stable through controlled App switch plus one lock/unlock and sleep/resume cycle.

## 2026-07-22 Desktop Agent 0.6.7 Real-Device Overlap Diagnosis

### Original Task Brief

- Check whether the July 22 `/reports` totals and Desktop Agent diagnostics are correct for a device opened around 09:40, used from about 10:00 to 12:30, resumed around 13:25, and inspected around 13:50.
- Diagnose from current source, local durable state, logs, and screenshots without treating the 0.6.7 handoff as proof that overlap was fully fixed.

### Changed Files

- Long-lived diagnosis only: this handoff and `docs/ai-handoff/latest-qa.md`.
- No Desktop Agent, API, Web, schema, policy, build artifact, or production data was modified.

### Implementation And Diagnostic Summary

- Connection and the main interval path are working: the screenshots show server-confirmed Online health, a fresh heartbeat/sync, a fresh Reports snapshot, a confirmed-through cursor at 13:46:41, and a latest batch of 12 accepted / 0 duplicate / 0 rejected intervals.
- The local SQLite queue drained back to one transient pending interval during inspection. The displayed pending count is a momentary settlement/upload backlog, not evidence that the morning was unsent.
- A follow-up check of the later `13 pending / 56 rejected` screenshot confirmed normal batch cycling: one 12-interval batch was accepted with HTTP 200 and removed, a newly settled 12-interval batch replaced it, and a subsequent SQLite sample reached zero pending. Pending rows were only seconds old with zero retry attempts; the dead-letter total remained 56.
- Comparing the first 0.6.7 screenshot at July 21 15:40 (`33 rejected`) with July 22 14:10 (`56 rejected`) recovered all 23 new rows. They form four boundary/backlog incidents rather than 23 independent failures: five current-lease `OPEN_RUNTIME` policy rejections at 15:49:34-15:50:02 (the new lease was issued at 15:49:35.952, so the Agent back-projected rows before lease validity); five Focus plus five runtime overlaps at 17:57:23-17:57:44 (no lifecycle diagnostic was retained locally, but lifecycle events are not comprehensively diagnostic-logged, so an unrecorded session boundary cannot be excluded); two Focus plus four runtime policy rejections crossing the 21:33 schedule end; and two Focus overlaps at the July 22 12:34 lock/suspend boundary.
- The 23-row delta is therefore not a healthy expected value. Server rejection correctly protects policy and non-overlap constraints, but the client should clamp new epochs to lease validity, seal exactly at the policy-window end, and never create cross-epoch overlap. The delta excludes about 81.194 seconds of Focus Active across the three Focus-bearing clusters; runtime durations are concurrent per App and must not be summed as employee work time.
- 0.6.7 nevertheless produced two new terminal `FOCUS_OVERLAP` rows on July 22. Local SQLite recovered exact intervals: Weixin for 6,516 ms and WeChatAppEx x64 for 33,656 ms, covering 12:33:52.830–12:34:33.002 Adelaide time. About 40.172 seconds were excluded from official Reports; the rest of the morning was not rejected.
- Both new rejections align with the 12:34–12:35 lock/suspend/resume cluster. Logs show the events were uploaded more than two minutes later after a long serialized run of HTTP syncs, many taking 4–11 seconds.
- Source review found an uncovered lifecycle race/backlog path: the native host closes Focus on session/power boundaries through `eventChain`, while Electron `powerMonitor` calls `reportDeviceStatus()` and closes the same boundary outside that chain. Foreground/visible-app host handlers also await network sync, allowing power-boundary events to queue for minutes. 0.6.7 covered transient unidentified foreground gaps but has no full-runtime test for concurrent Electron/native lock/suspend boundaries.
- The same source review found two related precision gaps: policy eligibility projects both streams with `focusClock` whenever it exists instead of using each stream's own clock, and a delayed event with no clock is treated as happening at the current server time. New epochs are clamped to protocol activation only, not to the active lease/window or a persisted stream watermark. These gaps explain how a pre-lease runtime observation and a post-cutoff slice could be generated despite a valid server policy.
- In the inspected July 21 15:40 to July 22 14:10 log window, 8,444 interval results were returned: 8,421 were accepted-or-duplicate and 23 were rejected, a 0.272% rejection rate. This supports a precision patch rather than a rewrite, but the rejected Focus time is still real missing Reports time and should not be dismissed as cosmetic diagnostics.
- Exact identification of the already accepted server interval that collided with these two rows still requires the deployed database or server request logs. The local evidence and source path strongly isolate the remaining defect to clock-epoch/lifecycle-boundary handling, not policy or connection health.
- The displayed `2h48m` Focus Active total is plausible for the reported usage: Focus is one foreground lane, while focused idle is separate and lock/sleep time is not counted. Open/runtime values are concurrent per App and must not be summed as employee work time.
- Current policy is valid at noon and did not cause these two rejections. The Agent reports `Australia/Adelaide 09:00–21:33`, which does not match the previously requested 09:00–23:00 and should be corrected separately if 23:00 remains required. The shown UTC window is also clipped by the current lease expiry and should refresh before expiry.

### Verification And Manual QA

- Read-only inspected `status.json`, July 22 NDJSON, and `tracking-v2.sqlite`; no token, complete URL, title, input, or page content was printed or retained.
- Confirmed dead letters increased from 54 to 56 at the two July 22 overlap responses and recovered their safe App names/timestamps/durations.
- Desktop Agent baseline test: `pnpm --filter @workmap/desktop-agent test` passed 61/61.
- Desktop Agent baseline typecheck: `pnpm --filter @workmap/desktop-agent typecheck` passed.
- No lint/build was run because this was a diagnosis-only round with no product code change.
- Real-device evidence was supplied by the user screenshots and local Agent state; no new scripted lock/sleep reproduction was performed.

### Remaining Risks And Suggested Next Step

- 0.6.7 is not fully overlap-safe across lease/window and real lock/suspend/resume boundaries. A follow-up 0.6.8 precision round should keep the server policy unchanged; serialize native events, Electron power events, ticks, and recovery mutations; project Focus and runtime using separate clocks; persist non-regressing UTC watermarks for both streams; and close at the exact lease/window boundary. Network upload should be coalesced away from the local event-mutation lane only with request/response ordering tests, because observed sync latency (median about 5.3 seconds, P95 about 9.0 seconds) can otherwise backlog foreground events for minutes.
- The intended code scope is Desktop Agent runtime/state/tests and version/build metadata only. No API schema migration, Reports redesign, tenant/RBAC weakening, always-on policy, or deletion of historical dead-letter evidence is required.
- Current sync after the 13:25 resume is healthy, so this is a narrow but real missing-time defect rather than a disconnected Agent or total upload failure.

## 2026-07-21 Browser Extension 0.5.2 Reliability, Diagnostics, And Reports

### Original Task Brief

- Take ownership of the existing Chrome/Edge Manifest V3 Browser Extension without touching Desktop Agent behavior or replacing the Tracking Protocol v2 architecture.
- Make Domain Focus reliable across multiple windows/displays/tabs, Split View, minimization, lock/sleep, offline/MV3 restart, policy boundaries, and server rejection paths.
- Separate server-confirmed connection health, current Domain snapshot confirmation, and accepted/duplicate/rejected historical intervals in Options and `/reports`; build a versioned unpacked artifact and ZIP.
- Implement Browser Domain open/runtime only if a separate safe Browser policy/schema/Reports contract could be completed honestly.

### Changed Files

- Browser runtime/privacy/state: `workmap/apps/browser-extension/src/backgroundV2.ts`, `browserEligibilityV2.ts`, `browserFocusEngineV2.ts` tests, `contentScript.ts`, `contentRegistration.ts` tests, `extensionApi.ts`, `trackingV2Store.ts`, and `trackingV2Types.ts`.
- Browser UI/release: `workmap/apps/browser-extension/options.html`, `options.css`, `src/options.ts`, `manifest.json`, `package.json`, generated `alpha-unpacked`, and `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.2.zip`.
- Browser tests: `browser-runtime-harness.test.ts`, `content-registration.test.ts`, `sync-diagnostics.test.ts`, and the updated focus, queue/API, service-worker, and store tests.
- API/database/Reports: Tracking v2 sync and Reports services/tests, `workmap/prisma/schema.prisma`, migration `20260721153000_tracking_rejection_request_correlation`, Web Reports types/presentation/cards/tests.
- Long-lived memory: this handoff, `latest-qa.md`, `docs/skills/api-contract-skill.md`, `qa-skill.md`, and `deployment-skill.md`.
- Existing uncommitted Cognito/Web-auth work was preserved. No Desktop Agent file or behavior was modified.

### Implementation Summary

- Browser Extension version is `0.5.2`. The three state lanes are now explicit: only a successful server sync updates secure heartbeat/connection time; each current snapshot is `LOCAL_PENDING`, `CONFIRMED`, `REJECTED`, `STALE`, or `NONE`; interval results retain accepted/duplicate/rejected counts, request ID, confirmed-through cursor, and safe rejection-code groups.
- Every `sync-v2` sends `X-WorkMap-Request-Id`. HTTP errors and HTTP 200 item/snapshot rejections are correlated separately. Terminal interval rejections move from the durable queue into a bounded IndexedDB dead-letter store (1,000 rows / 31 days); bounded recent diagnostics retain only safe code, stage, outcome, request ID, count, time, retryability, and remediation (100 groups / 14 days).
- Focus eligibility requires an actual focused, non-minimized normal browser window plus an eligible HTTP/HTTPS top-level tab. A tab in a background window is rejected. One extension instance owns at most one hostname; same-host tab switches remain one Domain identity without overlap.
- Content scripts remain all-frame and emit only `event.isTrusted` occurrence/time for keyboard, pointer/mouse press, wheel, touch, input, or change. Iframe activity is attributed through `sender.tab` to the top-level hostname. Pointer coordinates, key values, text, targets, scroll detail, full URLs, titles, and content are never sent.
- Chrome 140+ Split View uses the official `splitViewId`: a trusted event from a peer sharing the focused window's active Split View can take the single Focus lane. Without this proof the runtime stays conservative and never marks two pages active.
- Internal/protected pages, inaccessible PDF viewers, exclusions, incognito, hidden pages, background windows, minimization, `WINDOW_ID_NONE`, system idle/lock, tab/window removal, and real navigation seal Focus. Same-host SPA path/query changes do not create a new Domain. Reload and cross-host navigation require fresh content-script proof.
- A 30-second alarm plus a 15-second tolerance detects unobserved lifecycle gaps. Sleep, worker suspension/restart, clock rollback/divergence, crash, or restart tails are sealed only at the last durable observation and are not backfilled. Policy `idleThresholdMs`, acknowledgement, timezone, lease, and server-issued UTC windows remain authoritative.
- Options now shows version/device, Online/Offline/Auth/Upgrade connection, last secure heartbeat, snapshot state/observed/confirmed/rejection, interval result and request, confirmed-through time, queue/dead-letter code groups, policy/schedule/lease, permission/registration health, recent diagnostics, and explicit coverage limitations.
- API tombstones now store the request ID for new terminal interval rejections. Live Reports returns safe recent rejection evidence and counts. `/reports` keeps connection, current snapshot, official history, and rejection attention separate; rejected intervals do not enter totals.
- Confirmed Browser `FOCUS_ACTIVE` and `FOCUS_IDLE` intervals are proven to enter the official ledger and Domain Reports. Reconciliation unions overlapping same-user/same-hostname/same-metric ranges across Chrome/Edge devices instead of adding them unconditionally.
- Browser Domain open/runtime was intentionally not implemented. The current Desktop `collectOpenRuntime` policy is not reused; Browser runtime remains disabled in Options, API acceptance, and Reports until a separate policy/version/acknowledgement/lease contract exists.

### Role, Access, Privacy, And Security

- Device credentials remain encrypted locally with non-extractable AES-GCM keys and bound to tenant, user, device, client type, workstation, and Chrome/Edge identity. Revocation, protocol activation, policy version/lease, acknowledgement, and allowed UTC windows remain enforced server-side.
- No Owner/Employee/Platform Admin, tenant-isolation, RBAC, or Desktop Agent boundary changed. The additive tombstone request ID is privacy-safe correlation metadata; old tombstones legitimately show no request ID.
- Manifest incognito mode is `not_allowed`. Only optional HTTP/HTTPS host access is requested; no history, download, clipboard, camera, microphone, or webRequest permission was added.

### Verification

- Browser Extension: typecheck pass; lint pass; test pass `46/46`; build pass; `release:zip` pass.
- Focused API Tracking v2/Reports tests pass `15/15`; API typecheck, lint, and build pass. Prisma generate and schema validate pass.
- Full API suite is `48/49`: one pre-existing time-dependent `tracking-reports-verification.test.ts` fixture is now older than the service's maximum event age and fails with `Activity event is too old`; focused tests for this change pass.
- Focused Web Reports tests pass `7/7`; Web typecheck, lint, and production build pass. Full Web suite is `79/82`; the three remaining brittle `reports-information-order.test.ts` source/layout assertions predate and are unrelated to this Browser diff.
- `git diff --check` passes. Final changed-file secret scan and ZIP inspection pass; the ZIP has 19 entries and no sources/tests/credentials.

### Artifact

- Unpacked: `workmap/apps/browser-extension/alpha-unpacked`.
- ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.2.zip`.
- Size: `39,989` bytes.
- SHA-256: `232E9BD5D705B5EB7D1A98249C93F0BE1CE1AC8431354CE44493703CE3C22AA5`.

### Manual QA And Remaining Risks

- Real Chrome and Edge load-unpacked QA was not run. Installation/upgrade with pairing retention, permission revoke/regrant, single/dual-window and dual-display, same/different-host tabs, supported Split View, address bar/DevTools/internal pages, minimize/restore, lock/unlock, sleep/wake, offline/reconnect, browser restart, extension reload/disable/enable, and live/historical `/reports` remain manual acceptance gates.
- Apply migration `20260721153000_tracking_rejection_request_correlation` before deploying the API that selects `ClientSequenceTombstone.requestId`.
- Split View proof depends on Chrome/compatible Edge exposing `splitViewId`; unsupported versions deliberately provide limited coverage instead of dual counting. Chrome/Edge profiles remain separate device identities; server reconciliation mitigates same-user/same-domain overlap only after accepted ledger data exists.
- Proceed to the next round for real Chrome/Edge load-unpacked and staging migration/API/Web smoke. Do not publish to Chrome Web Store, Edge Add-ons, GitHub Releases, or production yet.

## 2026-07-21 Browser Extension Dedicated-Thread Handoff Prompt

### Original Task Brief

- Keep the current Codex conversation dedicated to Desktop Agent work.
- Inspect the real Browser Extension framework and provide a copy-ready prompt for a separate Codex conversation to take ownership of Browser Extension implementation, including multi-window/display, multiple pages, minimization, lock, MV3 lifecycle, policy, diagnostics, upload, and Reports behavior.

### Reviewed Current State

- The Browser Extension is not an empty scaffold. Source identity is `browser-extension-mv3/0.5.1`; it is a Chrome/Edge Manifest V3 extension using `backgroundV2.ts`, a dynamically registered all-frame content script, Tracking Protocol v2, policy/lease/acknowledgement checks, an encrypted device credential, IndexedDB durable interval queue, stable event/sequence identity, retry/backoff, live hostname snapshots, and server-confirmed health sync.
- Collection is hostname-only. Page signals contain only trusted interaction occurrence/timestamp; full URL, path/query/fragment, title, content, form/input values, key values, pointer coordinates, screenshots, clipboard, files, camera, microphone, email, and private messages remain prohibited.
- The current v2 focus engine supports one focused Browser domain with Focus active/Focused idle and a 60-second evidence threshold. It clears on browser focus loss, system idle/lock, invalid/non-HTTP(S) tabs, exclusions, or policy ineligibility, and persists before sync so MV3 worker restarts do not rely on globals alone.
- Current v2 Browser types lag the shared/server/Desktop response contract: they do not model `focusSnapshotResult` or request correlation, and terminal interval rejections increment only a count. The Options UI does not yet provide Desktop-style separation of connection, current Domain snapshot, confirmed interval upload, queue/rejection codes, policy schedule/lease, and bounded historical diagnostics.
- Browser v2 currently receives `collectOpenRuntime: false`; the API deliberately enables the existing open/runtime policy only for Desktop Agent. Domain open/runtime must not be enabled by merely flipping that literal. It requires an explicit Browser policy/product contract, separate reporting semantics, acknowledgement/version behavior, and tests if included.

### Changed Files And Scope

- Documentation only: this handoff and `docs/ai-handoff/latest-qa.md` record the source review and dedicated-thread boundary.
- No Browser Extension, Desktop Agent, API, Web, shared type, Prisma, deployment, artifact, or version file was changed.

### Verification And Manual QA

- Read-only source review covered Browser Extension manifest/package, v2 runtime/engine/store/types/API/content registration/content script/options, existing tests, API policy/sync/report Browser branches, shared Tracking v2 contract, and Reports Browser rendering.
- No automated package command or real Chrome/Edge manual QA was run because this round produced a handoff prompt rather than runtime changes.
- Existing uncommitted Web-auth changes were preserved and not reverted or overwritten.

### Remaining Risks And Suggested Next Step

- Multi-window/multi-display, split-view, minimized/background, lock/sleep, service-worker eviction, browser restart, permission revoke/regrant, Chrome/Edge concurrency, and real Reports behavior are not production-confirmed by this prompt-only review.
- Give the copy-ready prompt from the accompanying response to a new Codex conversation. That conversation must independently inspect git/source and implement/test there; it must not treat this review or an old handoff as proof of completion.

## 2026-07-21 Cognito Idle Session Recovery And Login Return Routing

### Original Task Brief

- Diagnose and fix the intermittent deployed Web behavior where a signed-in user left WorkMap idle, then a refresh or navigation returned to `/`, and repeated sign-in attempts could remain on the public page until a later retry.
- Implement a real authentication recovery fix rather than hiding the redirect or weakening tenant/RBAC boundaries.

### Confirmed Root Cause

- An expired browser access/ID token is expected and should be recovered with the Cognito refresh token. The Web client instead treated every Hosted UI or Amplify refresh exception—including temporary network, Cognito, or API availability failures—as a permanent logout, immediately cleared `workmap.cognitoSession`, and redirected protected pages to `/`.
- Protected API calls did not retry the original request after an API `401` with a forced Cognito refresh.
- The first `/auth/me` request after interactive sign-in used a raw token without `authSource: "cognito"`, so it did not receive the refresh/retry behavior.
- A genuinely missing/invalid session redirected to the public root and discarded the requested protected route, which made a successful later sign-in look like a login loop.

### Changed Files

- Session classification and recovery: `workmap/apps/web/lib/auth/cognitoSession.ts`, `cognitoUserPoolAuth.ts`, and `cognitoRedirect.ts`.
- API authentication/retry: `workmap/apps/web/lib/api/apiClient.ts` and `apiAuth.ts`.
- Login/callback/protected route integration: `workmap/apps/web/components/login/CognitoLoginPanel.tsx`, `components/layout/AppShell.tsx`, `app/login/callback/page.tsx`, `app/virtual-office/page.tsx`, and the affected onboarding pages.
- Automated coverage: `workmap/apps/web/test/cognito-session-refresh.test.ts` and `cognito-protected-redirect.test.ts`.
- Long-lived frontend contract and handoff: `docs/skills/frontend-skill.md`, this file, and `docs/ai-handoff/latest-qa.md`.
- `workmap/apps/web/tsconfig.tsbuildinfo` was regenerated by the required Web checks and remains a tracked generated diff.

### Implementation Summary

- Refresh failures are now classified as terminal or retryable. Explicit Cognito invalid-session responses such as `invalid_grant`, `401/403`, `NotAuthorizedException`, or an invalid/expired refresh token clear the stored session. Network failures, rate limiting, unknown provider failures, and server errors preserve it.
- A retryable refresh receives one bounded 500 ms automatic retry. If it still fails, the current API action returns a temporary error without destroying the browser session or forcing navigation; a subsequent page/API action can recover normally.
- A Cognito-authenticated API `401` forces a token refresh and retries the original request once with the new token.
- A permanently missing/invalid session now routes to `/login?next=<protected path>`. After successful tenant mapping, the login panel returns the user to that validated internal route. External, protocol-relative, backslash, and public-route values are rejected to prevent open redirects.
- Login callback and the first post-login `/auth/me` mapping now identify the request as Cognito-authenticated and therefore use the same refresh/retry path.

### Role, Privacy, And Security Behavior

- No API, database schema, Desktop Agent, policy, RBAC, tenant isolation, Cognito group mapping, or Platform Admin boundary changed.
- The fix does not extend token lifetime, bypass Cognito, or keep explicitly invalid refresh credentials. It only avoids destroying a recoverable session on temporary failure.
- Tokens, refresh tokens, full authentication URLs, and provider response bodies are not logged or shown in diagnostics.

### Verification

- Focused Cognito refresh/redirect tests: pass, `7/7`, covering expired-session refresh, API `401` forced refresh plus original-request retry, two temporary refresh failures with stored-session preservation and later recovery, terminal `invalid_grant` clearing, safe return routing, and public-route behavior.
- Web typecheck: pass.
- Web lint: pass.
- Web build: pass in approximately 65 seconds. Existing non-blocking Next/Webpack warnings remain.
- Full Web suite: `77/81` pass. All authentication tests pass. The four failures are the same pre-existing brittle Reports render/source assertions documented in the preceding handoff and are outside this auth diff.
- `git diff --check`: pass after the final documentation update.
- High-confidence secret scan across changed text files: zero matches.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- No real Cognito account, deployed browser session, long-idle wait, or production sign-in loop was exercised in this round. Source and automated behavior are verified; production behavior must not be called verified until the Web deployment and real idle-session test succeed.
- A persistent retryable outage deliberately keeps the user on the requested page and preserves credentials, but the affected data request may display its existing temporary error/blocked state until the next action succeeds.
- This is Web-only. It requires a new Web deployment after commit/push; it does not require a database migration, API deployment, or Desktop Agent release.

### Suggested Next Steps

1. Review, commit, and push this Web diff, then deploy the Web application.
2. In a real signed-in browser, open `/reports`, leave it idle beyond the access-token expiry or reproduce a refresh boundary, then refresh/navigate. Confirm it stays authenticated or recovers without visiting `/`.
3. Temporarily interrupt network access during refresh and restore it; confirm the session remains and a later action succeeds. Sign out or invalidate the refresh token separately; confirm WorkMap goes to `/login?next=%2Freports` and returns to Reports after sign-in.

## 2026-07-21 Desktop Agent 0.6.7 Focus Integrity, Diagnostics, Focused Idle, And Policy-Gated Open/runtime

### Original Task Brief

- Repair the real increase in Tracking v2 rejected rows where local SQLite showed new rejected intervals but `Historical rejected / network diagnostics` and the privacy-safe NDJSON file showed only HTTP 200.
- Fix the underlying `FOCUS_OVERLAP` production path instead of hiding the red/rejected signal.
- Make Focused idle accurate under the agreed rule: the foreground App remains Focus active for 60 seconds after the last trusted Windows keyboard/mouse evidence, then accrues Focused idle until new input, App switch, lock, exit, or policy boundary.
- Add App open/runtime as a separate policy-controlled metric: one eligible user-visible top-level Windows window means the App is open, covered/minimized windows count, tray-only/background helpers do not, the same App is de-duplicated, and different Apps may accrue concurrently without inflating Focus active.
- Preserve policy acknowledgement, tenant/device credential, work-window, role, and privacy boundaries, and produce Desktop Agent `0.6.7` if verification succeeds.

### Confirmed Root Causes

- `POST /device-client/sync-v2` correctly returned HTTP 200 when health succeeded even if one or more interval results were rejected. Desktop Agent 0.6.6 inspected the snapshot result but did not persist `response.results[]` interval rejection codes into recent diagnostics or NDJSON, so the queue dead-letter count increased without an actionable current diagnostic.
- `FOCUS_OVERLAP` was produced by a client time-line defect, not by valid simultaneous App work. A transient null foreground identity destroyed the Focus engine/clock epoch, and foreground events queued behind a multi-second HTTP request were re-anchored near processing time rather than their original Windows monotonic event time. The replacement interval could therefore project into UTC time already occupied by the preceding interval.
- Focused idle was already represented in the v2 engine but lacked the requested full-chain regression evidence. The production v2 policy threshold is 60 seconds.
- Tracking v2 schema/report enums already had an `OPEN_RUNTIME` lane, but active policy leases hardcoded it off and the Windows v2 host emitted no visible-App set, so v2 could not produce open/runtime rows.

### Changed Files

- Desktop runtime, durable state, diagnostics, renderer, native host, and version metadata: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `desktopOpenRuntimeEngineV2.ts`, `trackingV2Store.ts`, `trackingV2Types.ts`, `diagnosticLog.ts`, `windowsActivityHost.ts`, `renderer/app.js`, native `Program.cs`, package/build/version files, rebuilt Alpha native executable, and Desktop tests.
- API policy/sync/report/compliance code and tests: `workmap/apps/api/src/modules/devices/tracking-v2-policy.service.ts`, `tracking-v2-sync.service.ts`, `modules/reports/tracking-v2-reports.service.ts`, compliance controller/service, and focused tests.
- Web Compliance/Reports contract and tests: `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx`, `PolicyAcknowledgementModal.tsx`, `components/reports/ReportSummaryPanel.tsx`, API types/client, and `compliance-open-runtime-policy.test.ts`.
- Additive schema/migration: `workmap/prisma/schema.prisma` and `workmap/prisma/migrations/20260721120000_monitoring_open_runtime_policy/migration.sql`.
- Long-lived contract/handoff: `docs/skills/api-contract-skill.md`, this file, and `docs/ai-handoff/latest-qa.md`.

### Implementation Summary And Expected Behavior

- The host-to-runtime clock offset is now captured as soon as native stdout delivers an event. A delayed event keeps its original UTC projection. A transient unidentified foreground gap closes the current Focus segment but retains the same engine epoch and sequence lane. These changes prevent new client-generated `FOCUS_OVERLAP` intervals while preserving genuine server overlap validation.
- Every HTTP 200 sync now aggregates rejected interval results by safe code/count. A new rejection is saved to recent diagnostics and NDJSON with request ID, stage `interval`, terminal/retry state, safe explanation, and remediation. The SQLite queue line also shows existing dead-letter code counts. Existing historical rows can reveal their stored rejection code, but old versions did not persist enough time/request context to reconstruct a missing historical diagnostic item.
- Focused idle remains foreground-only. Automated evidence proves 90 seconds with no input becomes exactly 60 seconds Focus active plus 30 seconds Focused idle and that both accepted intervals enter the official ledger and Reports.
- The native Windows host now enumerates eligible top-level windows every two seconds using only window visibility/minimized state plus privacy-minimized process identity. It does not read window titles, URLs, messages, input text, page content, screenshots, clipboard, files, camera, or microphone.
- Open/runtime is a separate `OPEN_RUNTIME` stream. Multiple windows with the same App identity count once; Codex and Teams can accrue concurrently; closing the final eligible window, lock/disconnect/suspend, policy expiry, queue pressure, or Agent shutdown closes the interval. Runtime is never added to Focus active or Focused idle.
- Existing policies default `collectOpenRuntime` to false. An Owner/HR Admin must explicitly create a new active policy version from Compliance. The new version copies the existing timezone and `09:00-23:00` schedule, requires a new employee acknowledgement, and receives no valid Desktop runtime lease before acknowledgement. Cross-tenant, device identity, lease, schedule, and source validation remain enforced.
- Reports now labels runtime as enabled only when the API confirms the active policy flag. Confirmed `OPEN_RUNTIME` ledger rows appear as `openRuntimeSeconds` separately from focus time.
- Source/Alpha version metadata is `desktop-agent-windows/0.6.7`; native adapter protocol version is `1.1.0`.

### Role, Privacy, And Security Behavior

- Only roles with the existing compliance-management capability (`OWNER` and `HR_ADMIN`) can create the runtime-enabled policy version. Employee and wrong-tenant policy mutation remains rejected.
- Existing employee acknowledgement is tied to the old policy id and cannot silently authorize the new collection field.
- No policy was deleted, no all-day collection was hardcoded, and tenant, device credential, protocol activation, lease, Owner/Employee Reports, and Platform Admin boundaries were not weakened.
- Server interval-rejection logs contain only request ID, rejection code/count, interval count, and duration; they do not contain App names, titles, URLs, tokens, or activity payloads.

### Verification

- Prisma client generation: pass. Prisma static validation: pass using an explicit non-secret local placeholder URL; no database connection or migration execution was performed.
- Desktop Agent typecheck/lint/build/native build: pass. Renderer syntax: pass. Desktop tests: `61/61` pass.
- Focused API tests: `18/18` pass, including health confirmed plus rejected snapshot, newer snapshot replacement, Focus active + Focused idle ledger/report insertion, concurrent different-App runtime report insertion, same-App runtime overlap rejection, runtime-disabled policy rejection, and new policy version/re-acknowledgement.
- API typecheck/lint/build: pass. Full API suite: `46/47`; only the pre-existing fixed-date `tracking-reports-verification.test.ts` fails the 31-day ingestion limit.
- New Web runtime-policy tests: `2/2` pass. Web typecheck/lint/build: pass. Full Web suite: `73/77`; the same four pre-existing brittle Reports render/source assertions fail and are unrelated to this change.
- Native source/Alpha executables are identical: `70,923,615` bytes, SHA-256 `CF85768D015BC7D8350EA0D2B026DFA39A6F1C0391BDB528219FE825C0887A2D`.
- `git diff --check`: pass. High-confidence secret scan across changed/untracked text files: zero matches.
- Windows NSIS packaging: pass after the explicitly approved network-enabled retry. Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.7.exe`; size `115,429,898` bytes; SHA-256 `9421839744780102CC8DB5B42422AB4205CFD52DEE9C7D88FF8D3FE1E7AD675A`; Authenticode `NotSigned`.
- The unpacked application reports ProductVersion `0.6.7.0` / FileVersion `0.6.7`. Its ASAR contains `desktopOpenRuntimeEngineV2.js`, `runtimeV2.js`, and the literal client version `desktop-agent-windows/0.6.7`. The packaged/source/Alpha native helper hashes are identical.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- No real 0.6.7 installation, production database migration, API/Web deployment, policy-version creation, employee acknowledgement, or real Windows Agent -> API -> Reports loop was run. Automated evidence is strong, but real-device behavior is not claimed as passed.
- Existing rejected/dead-letter rows were not deleted, retried as confirmed work, or backfilled. Their counts remain visible; missing old request/time detail cannot be recovered safely.
- Open/runtime uses a two-second visible-window observation cadence, so open/close edges have sampling granularity. It is context, not proof of work, and concurrent App runtime can exceed wall-clock time.
- The migration must deploy before the updated API. API and Web should then deploy together. Runtime stays off until an authorised administrator enables it and the employee acknowledges the new version.
- Database migration is still not run. On the final follow-up, `workmap/.env` did not exist, no other `.env.*` file was present, and `DATABASE_URL` was absent from process, Windows User, and Windows Machine environment scopes. The target database therefore could not be identified safely despite the reported setup; no guessed connection or external write was attempted.
- `apps/web/tsconfig.tsbuildinfo` was regenerated by the required Web checks and remains a tracked generated diff.

### Suggested Next Steps

1. Make `DATABASE_URL` available to the same PowerShell/Codex process (or create ignored `C:\Users\liangceli\WorkMap\workmap\.env`) without pasting the credential into chat or committing it. Run `prisma migrate status`, then `prisma migrate deploy` only against the intended target.
2. Commit/push after reviewing the current diff, then deploy API plus Web after the migration. Do not enable the field with direct SQL or a broad seed.
3. As Owner/HR Admin, enable App open/runtime in Compliance; verify the new policy preserves `Australia/Adelaide 09:00-23:00`. As the employee, review and acknowledge that new version.
4. Install the verified 0.6.7 artifact and test: no new `FOCUS_OVERLAP`; 90 seconds no input yields about 60s Focus active + 30s Focused idle; two simultaneously open Apps gain separate runtime; closed/tray-only Apps do not; completed intervals appear in `/reports` without changing connection health semantics.

## 2026-07-20 Test Policy Window Extension To 23:00

### Original Task Brief

- Extend the current test workspace monitoring schedule from `09:00-17:00` to `09:00-23:00` in `Australia/Adelaide`, because evening Desktop Agent App activity was correctly outside the old policy window and therefore could not be accepted into Reports.
- Preserve policy, tenant, role, acknowledgement, device credential, and lease enforcement rather than hardcoding all-day collection or suppressing policy warnings.

### Confirmed Behavior And Scope

- The 17:00 cutoff is stored on the active `MonitoringPolicy`; it is not hardcoded in Desktop Agent 0.6.6. The observed post-17:00 `SNAPSHOT_OUTSIDE_POLICY_WINDOW` rejection was therefore accurate under the old `09:00-17:00` configuration.
- The change adds a safe tenant-scoped way for an authorised policy administrator to extend the active schedule. It does not perform a cross-tenant production data migration and does not silently change the user's currently deployed tenant without an authenticated Owner/HR Admin action.
- For Adelaide on 2026-07-20, `09:00-23:00` produces the allowed UTC window `2026-07-19T23:30:00.000Z` through `2026-07-20T13:30:00.000Z`.
- Desktop Agent 0.6.6 refreshes policy every five minutes and treats a changed `policyLeaseId` as a policy boundary even when `policyVersion` remains `v1`. The API refuses to reuse a lease whose windows do not match the updated schedule, so it creates a matching lease and the installed Agent can adopt it without a new Agent release or re-pair.

### Changed Files

- API work-hours route and validation: `workmap/apps/api/src/modules/compliance/compliance.controller.ts` and `compliance.service.ts`.
- API policy regression coverage: `workmap/apps/api/test/compliance-work-hours.test.ts` and `tracking-v2-policy-lease.test.ts`.
- Owner/HR Admin Compliance control and API contract: `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx`, `workmap/apps/web/lib/api/complianceApi.ts`, and `apiTypes.ts`.
- Demo seed schedule: `workmap/prisma/seed.ts`.

### Implementation Summary

- Added `PATCH /compliance/policy/:policyId/work-hours` for the active policy in the authenticated tenant. It accepts strict 24-hour `HH:MM` times, requires a same-day end later than the start, and retains the existing `manageCompliancePolicy` capability boundary (`OWNER` and `HR_ADMIN`).
- Cross-tenant policy IDs return not found. Employees cannot mutate policy.
- An existing policy can only be extended in place. Narrowing requires a new policy version, preventing a still-valid older lease from temporarily preserving a broader collection window.
- The Compliance page now shows the effective schedule and gives only Owner/HR Admin users start/end inputs plus `Save work hours`. After save it states that clients receive the matching lease within five minutes.
- Demo seed update/create values now use `09:00-23:00`. This is not a production database mutation by itself.

### Role, Privacy, And Security Behavior

- Tenant isolation, device credentials, policy acknowledgement, collection switches, schedule timezone, lease validation, Owner/Employee report boundaries, and Platform Admin separation remain enforced.
- No token, credential, URL, window title, keystroke/input, page content, or complete activity payload is logged or rendered.
- Collection remains work-hours-only. This is a specific test-window extension, not all-day collection and not a removal of policy enforcement.

### Verification

- Focused API work-hours and lease tests: pass, `10/10`. Coverage includes authorised extension, Employee rejection, cross-tenant rejection, superseded-policy rejection, invalid/overnight rejection, narrowing rejection, Adelaide 23:00 UTC conversion, stale-lease non-reuse, and in-window predicates.
- API typecheck, lint, and production build: pass.
- Web typecheck, lint, and production build: pass.
- Full API suite: `39/40`; the only failure is the pre-existing fixed-date `tracking-reports-verification.test.ts`, now older than the 31-day ingestion limit (`Activity event is too old`).
- Full Web suite: `71/75`; the four pre-existing brittle Reports render/source assertions remain unrelated to the Compliance schedule diff.
- `git diff --check`: pass. Secret scan status is recorded in the matching QA handoff.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- An in-app browser check found no authenticated production session; it reached the public WorkMap page. Therefore no live tenant row was changed, no API/Web deployment was performed, and no real post-17:00 Agent -> API -> Reports manual loop is claimed as passed.
- The Prisma schema default and tenant-onboarding default remain `09:00-17:00`. They were intentionally not changed because the request applies to the current test workspace, while changing defaults would alter future tenants globally. The demo seed is `09:00-23:00`.
- Desktop Agent remains 0.6.6; no installer, re-pair, schema migration, or database migration is required.
- The currently deployed tenant remains on its existing schedule until the API/Web changes are deployed and an Owner/HR Admin saves `09:00` / `23:00` on Compliance.

### Suggested Next Steps

1. Commit and push this change, then deploy API and Web together. Do not run a broad production seed or cross-tenant SQL update.
2. Sign in as Owner/HR Admin, open Compliance, set `Start 09:00` and `End 23:00`, and select `Save work hours`.
3. Within five minutes, verify Agent Diagnostics shows `Australia/Adelaide - 09:00-23:00` and the allowed UTC end is `13:30Z` for 2026-07-20; focus an App long enough to close an interval and confirm Reports increases.

## 2026-07-20 Desktop Agent 0.6.6 Real-Time Input Lane And Clock-Correct Health

### Original Task Brief

- Investigate the real installed 0.6.5 result after Reports showed a received-but-old App snapshot and the Agent simultaneously showed a red `Offline - retrying` header while Diagnostics showed `Online - server-confirmed health`.
- Fix the underlying delivery and status problems rather than suppressing the warning, then produce a new Windows Agent.

### Confirmed Live Evidence And Root Cause

- Reports and local diagnostics prove data was not completely absent. One App interval was server-confirmed through `2026-07-20T06:42:51.385Z`, the queue returned to zero, and the API continued returning HTTP 200. Reports received a snapshot at approximately 4:24 PM, but that payload's last observation still described approximately 4:13 PM.
- The installed 0.6.5 runtime at client time `2026-07-20T07:02:14.820Z` had `serverOffsetMs = -131661`, a latest server-confirmed heartbeat at `2026-07-20T07:00:03.034Z`, and a snapshot observation at `2026-07-20T06:43:14.260Z`. The renderer compared the server timestamp directly with uncorrected local `Date.now()`, so a fresh response appeared more than 120 seconds old and produced the false red Offline state. Diagnostics correctly showed Online because it used the runtime connection state.
- The native process was alive and healthy; this was not a dead sampler. Windows polls last-input changes every 100 ms. The runtime treated every `interaction_pulse` as an immediate sync and awaited the HTTP request on its serialized host-event lane. Production round trips were about four seconds, so input events arrived much faster than they could be processed. The snapshot sequence advanced, but observation time fell roughly 15 minutes behind real time.

### Changed Files

- Runtime scheduling/status contract: `workmap/apps/desktop-agent/src/runtimeV2.ts` and `src/types.ts`.
- Native Windows input coalescing and rebuilt Alpha helper: `workmap/apps/desktop-agent/native/windows-activity-host/Program.cs` and `alpha-windows/native/windows-activity-host/publish/workmap-windows-activity-host.exe`.
- Agent renderer: `workmap/apps/desktop-agent/renderer/app.js`.
- Regression coverage: `workmap/apps/desktop-agent/test/runtime-v2-ui-status.test.ts`, `test/gui-release.test.ts`, and `test/windows-activity-host-v2.test.ts`.
- 0.6.6 release metadata: `workmap/apps/desktop-agent/package.json`, `alpha-windows/package.json`, `scripts/build-alpha.mjs`, `src/version.ts`, and `src/windowsActivityHost.ts`.

### Implementation Summary

- Agent status now exposes the already maintained server/local clock offset. Heartbeat freshness still uses the existing 30-second fresh and 120-second stale thresholds, but evaluates them on the server-corrected clock. Genuine failed/time-out requests still set the runtime Offline/Auth/Upgrade/Error states.
- `interaction_pulse` still persists the exact Windows last-input monotonic timestamp locally, but no longer waits for a separate HTTP request. Normal ten-second health sync, fifteen-second settlement, completed intervals, foreground transitions, and lifecycle boundaries continue to trigger server sync.
- Native input polling remains at 100 ms for precise Windows last-input detection, but output pulses are coalesced to at most one per second. The newest exact input timestamp is retained and any pending pulse is discarded across lock/disconnect/suspend boundaries.
- Adapter version is `1.0.1`; Agent version is `desktop-agent-windows/0.6.6`.
- No policy, work-window, lease, tenant/device credential, RBAC, database, API, or Web behavior changed in this round.

### Windows Artifact

- Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.6.exe`.
- Size: `115428880` bytes.
- SHA-256: `BED3199FC7895CD19BA6A7064C58E60EE5EFFCA89BF20EAA7F483AC87C33263F`.
- Authenticode: `NotSigned`.
- Packaged executable reports ProductVersion `0.6.6.0` / FileVersion `0.6.6`.
- Source, Alpha, and packaged native helper hashes are identical: `82575E85884A4F432E8D2AB5DBCEC6DB9EB17334025201DD50A7E89DC9408D68`.

### Verification

- Desktop Agent typecheck: pass.
- Desktop Agent lint: pass.
- Desktop Agent tests after rebuilding the native helper: pass, `53/53`.
- Desktop Agent source/Alpha build: pass.
- Renderer `node --check`: pass.
- Windows NSIS release: pass after the sandboxed packaging component download was permitted.
- Regression coverage asserts server offset propagation, real offline/paused state preservation, no per-input immediate HTTP sync, bounded native pulse output, and preservation of exact observed input timestamps.
- `git diff --check`: pass. High-confidence scan of the complete changed diff found zero secret matches.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- Real installed 0.6.5 state/log/process diagnosis was performed on Windows. It confirmed the clock skew, HTTP duration, event-lane lag, healthy native process, accepted interval, zero pending queue, and three historical dead letters without exposing credentials, URLs, titles, input, or content.
- The 0.6.6 installer was not installed in this round. Therefore a real 0.6.6 Agent -> deployed API -> Reports loop is not claimed as passed.
- Input evidence still waiting only in the old process's in-memory event chain is not a durable queue and cannot be safely reconstructed after upgrade. Do not manufacture the lagging historical period; verify new intervals from 0.6.6 forward.
- The three pre-existing rejected records were not deleted or retried as confirmed data.
- No API/Web/database deployment is required for this 0.6.6-only correction. Existing device pairing should remain valid.

### Suggested Next Steps

1. Commit/push the 0.6.6 Agent source and distribute the generated installer.
2. Close/upgrade the old Agent, install 0.6.6, then verify within one minute that the header and Diagnostics both show Online and snapshot observation time stays near current time.
3. Keep one App focused for more than fifteen seconds or switch Apps, then confirm `Confirmed interval through` advances and the App duration increases in historical Reports.

## 2026-07-20 Desktop Agent 0.6.5 Cross-Epoch Snapshot And Live UI Health

### Original Task Brief

- Fix the remaining real condition shown after the Reports connection/snapshot separation was deployed: Reports is correctly `Connected`, but the App snapshot remains old while the running Agent continues to send HTTP 200 health/snapshot syncs, and the local Agent window can still show a red heartbeat warning.
- Produce a new Windows Agent without hiding real failures, weakening the policy, or merely changing warning colors.

### Confirmed Root Cause

- The policy is not misconfigured. The inspected policy remains `Australia/Adelaide`, work-hours-only `09:00-17:00`, App focus enabled, acknowledgement complete, and its lease/allowed UTC windows are valid for the inspected time.
- The initial `SNAPSHOT_OUTSIDE_POLICY_WINDOW` was a real, expected rejection outside the configured collection window. It explains why that particular provisional snapshot was not stored, while its HTTP 200 health was still confirmed.
- The additional in-window stale snapshot had a separate API ordering bug. `DesktopFocusEngineV2` creates a new `clockEpochId` and restarts `snapshotSequence` at one after lock/resume, restart, or policy-boundary recovery. The API compared the incoming sequence against the last stored sequence globally, without considering `clockEpochId`, so a fresh new-epoch sequence such as `1` could be silently ignored behind an old-epoch sequence such as `900` even though the new observation was later.
- The red local Agent window had a separate display-source problem. The active runtime retained current server-confirmed heartbeat/sync state in memory, but Electron IPC always reread `status.json`. A delayed/failed local file update could therefore show an old heartbeat even while runtime sync logs and Reports health were current.

### Changed Files

- API snapshot ordering and regression coverage: `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts` and `workmap/apps/api/test/tracking-v2-live-semantics.test.ts`.
- Agent live UI state: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `src/electron/main.ts`, `test/runtime-v2-ui-status.test.ts`, and `test/gui-release.test.ts`.
- Agent 0.6.5 release metadata: `workmap/apps/desktop-agent/package.json`, `alpha-windows/package.json`, `scripts/build-alpha.mjs`, `src/version.ts`, and `src/windowsActivityHost.ts`.

### Implementation Summary

- Snapshot ordering is now scoped correctly: within the same clock epoch, monotonic `snapshotSequence` wins; across different epochs, the already policy/time-validated `lastObservedAt` wins. This lets a genuinely newer restarted session replace an old high sequence while preventing a delayed older epoch from overwriting current state.
- While the runtime is active, the Agent UI now reads the runtime's in-memory server-confirmed health/sync state. `status.json` remains only the startup/runtime-unavailable fallback.
- The real freshness behavior is unchanged: the renderer still applies its existing 30-second fresh and 120-second stale thresholds. A genuinely old server-confirmed heartbeat, offline runtime, paused collector, auth problem, upgrade requirement, or policy setup requirement is still shown accurately.
- Policy validation, lease enforcement, work hours, tenant/device credentials, and Owner/Employee boundaries are unchanged.
- Agent version is now `desktop-agent-windows/0.6.5`.

### Deployment And Artifact

- No Prisma schema or database migration is required for this round.
- Deploy the API change first. The already deployed Reports Web UI does not require another change for this round. Then install Desktop Agent 0.6.5 to fix the local red stale-file display; existing pairing credentials should remain valid.
- Windows installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.5.exe`.
- Size: `115436850` bytes.
- SHA-256: `500C1F1063B88F92A1ED396EE290986B26D912EDD3FE5C421057A596E8A9CB86`.
- Windows Authenticode status: `NotSigned`; do not describe this build as code-signed.

### Verification

- Focused API live semantics: pass, `7/7`. Coverage includes rejected snapshot plus confirmed health, valid snapshot replacement, accepted interval insertion/Reports display, new-epoch low-sequence replacement, and delayed old-epoch rejection.
- Desktop Agent typecheck, lint, source/Alpha build, and Windows NSIS release: pass.
- Desktop Agent tests: pass, `52/52`, including in-memory connected state and preservation of real offline/paused states.
- API typecheck, lint, and build: pass.
- Full API suite: `34/35`; the one unrelated existing fixed-date Reports verification now exceeds the 31-day ingestion limit and fails with `Activity event is too old`.
- `git diff --check`: pass after the handoff update. The high-confidence secret scan found no new secret; its only repository match is the unchanged synthetic Prisma URL parsing fixture already documented in prior QA.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- No installer was installed and no real Windows Agent -> deployed API -> Reports end-to-end manual QA was run. The installer was built and inspected only; production behavior is not claimed as manually verified.
- Existing three dead-letter records were not deleted or rewritten. Two historical `HTTP_400` rows and one historical `POLICY_REJECTED` row still lack enough persisted old-client detail to reconstruct exact reasons.
- No Web, policy configuration, schedule, timezone, lease duration, database schema/data, auth/RBAC, tenant boundary, pairing credential, or Browser Extension behavior was changed.
- After API deployment and 0.6.5 installation, verify that the local heartbeat remains current, the in-window Reports snapshot advances past the old timestamp, a completed interval advances `Confirmed through`, and the corresponding App duration appears in historical Reports. Outside work hours, connection should remain online while current App is explicitly unconfirmed/outside collection time.

### Suggested Next Steps

1. Commit and push this source change, deploy the API, then distribute/install the generated 0.6.5 installer.
2. Run the real-device checks above before calling the production loop fully verified.

## 2026-07-20 Desktop Agent / Reports Connection And Snapshot Separation

### Original Task Brief

- Independently verify the Desktop Agent 0.6.4 Tracking Protocol v2 sync path instead of trusting prior handoff completion claims.
- Determine why server-confirmed heartbeat timestamps remain current while the live App snapshot remains old and Owner `/reports` shows `Signal interrupted / Stale`.
- Keep health, current snapshot, historical diagnostics, and confirmed interval upload as separate state lanes; preserve tenant, credential, acknowledgement, lease, work-window, and role boundaries.
- Add automated evidence for snapshot rejection with successful health, valid snapshot replacement, and valid App interval insertion/reporting.

### Root Cause And Local Evidence

- Heartbeat is genuinely server-confirmed. The sync transaction stores `ClientHealthSnapshot`, updates device `lastSeenAt`, and returns HTTP 200 even when the optional live snapshot has a warning result. Privacy-safe local runtime/log inspection also showed recent confirmed heartbeat/sync timestamps, `pending = 0`, and later accepted in-window snapshots/intervals.
- A rejected live snapshot is intentionally not written over the last accepted `LiveFocusSnapshot`. That explains why `snapshot.receivedAt` can remain old while health is current. The old Reports implementation then used `snapshot.receivedAt ?? health.receivedAt` for a single freshness value, so the old snapshot masked the new health timestamp and produced the false red disconnect state.
- The inspected local policy is internally consistent: `Australia/Adelaide`, work-hours-only `09:00-17:00`, App focus enabled, acknowledgement `ACKNOWLEDGED`, a 24-hour lease issued at `2026-07-19T08:42:19Z` and expiring at `2026-07-20T08:42:19Z`, with the relevant allowed UTC window `2026-07-19T23:30:00Z` through `2026-07-20T07:30:00Z`. No schedule, timezone, lease duration, or collection switch was changed.
- The observed `SNAPSHOT_OUTSIDE_POLICY_WINDOW` warning proves the snapshot lane was rejected by policy, but it does not prove the configured Adelaide schedule was wrong. The prior validator also used that same code for invalid/missing state timing. Validation now reports `SNAPSHOT_OBSERVATION_TIME_INVALID` for timing faults and reserves `SNAPSHOT_OUTSIDE_POLICY_WINDOW` for the actual window check.
- Three local dead letters were inspected without exposing App names or payloads: two historical `HTTP_400` records and one `POLICY_REJECTED` record. Older builds persisted no safe server subreason/request correlation for those rows, so their exact causes cannot be reconstructed. Fabricating a more precise reason would be incorrect.

### Changed Files

- API sync and health/snapshot persistence: `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`.
- API live Reports semantics: `workmap/apps/api/src/modules/reports/tracking-v2-reports.service.ts`.
- API regression coverage: `workmap/apps/api/test/tracking-v2-live-semantics.test.ts`.
- Owner Reports types and rendering: `workmap/apps/web/lib/api/apiTypes.ts`, `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, and `workmap/apps/web/components/reports/trackingV2LivePresentation.ts`.
- Owner Reports regression coverage: `workmap/apps/web/test/tracking-v2-live-presentation.test.ts`.
- Desktop diagnostics state/persistence: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `src/trackingV2Store.ts`, `src/trackingV2Types.ts`, and `src/diagnosticLog.ts`.
- Desktop diagnostics UI/tests: `workmap/apps/desktop-agent/renderer/app.js`, `renderer/index.html`, and `test/gui-release.test.ts`.

### Implementation Summary

- Live-activity connection freshness now uses only the latest server-received health timestamp. Legacy `fresh` fields remain as compatibility aliases for this connection lane.
- Snapshot freshness/status is independent and reports `CURRENT`, `NO_CURRENT_FOCUS`, `STALE`, `REJECTED`, or `NOT_RECEIVED`. A newer snapshot warning takes precedence over an older stored snapshot, while a newer accepted snapshot clears the warning.
- Owner Reports shows `Connected` for fresh server-confirmed health even when the current App snapshot is rejected, stale, or unavailable. Snapshot copy separately says `Current activity not confirmed`, `Outside collection window`, `Snapshot stale`, or `No current App snapshot`; only stale/missing health produces `Signal interrupted`.
- A health-only sync preserves the latest snapshot diagnostic because it does not prove a new snapshot was accepted. A valid accepted snapshot explicitly clears that diagnostic.
- A duplicate or older snapshot that passes policy validation but does not replace the stored sequence cannot clear a newer rejection diagnostic.
- Desktop Diagnostics now separates connection/heartbeat, local and server-confirmed snapshot state, historical rejected/network diagnostics, and the last interval upload result. Policy timezone, local schedule, exact allowed UTC window, App focus switch, acknowledgement, and lease issue/expiry are visible without storing credentials, URLs, titles, user input, or content.
- Interval diagnostics record accepted/duplicate/rejected counts and the latest server-confirmed cursor time. HTTP 200 is still not presented as proof that every interval was accepted.

### Role And Security Boundaries

- No policy enforcement was removed or weakened. Tenant/device checks, protected device credentials, protocol activation, acknowledgement, collection switches, lease validity, work windows, and Owner/Employee access boundaries are unchanged.
- No auth, RBAC, Prisma schema/migration, deployment configuration, pairing flow, Browser Extension behavior, or Platform Admin behavior was changed.
- Diagnostics remain privacy-minimized: no token, credential, full URL, window title, keystroke/input, screen/page content, or complete activity payload is logged or rendered.

### Verification

- Desktop Agent: typecheck, lint, build, renderer `node --check`, and package tests passed; package tests are `50/50`.
- API: typecheck, lint, and production build passed.
- Focused API live-semantics tests passed `5/5`: health confirmation despite snapshot rejection, precise invalid-timing rejection, newer valid snapshot replacement/diagnostic clearing, duplicate snapshot warning preservation, and accepted App interval insertion plus Reports ledger display (`10,000 ms`).
- Existing policy lease tests passed `3/3`, including Adelaide Monday work-window generation and stale-window non-reuse.
- Web: typecheck, lint, and production build passed. Focused connection/snapshot presentation tests passed `2/2`.
- Full API suite is `32/33`: the unrelated existing `tracking-reports-verification.test.ts` uses a fixed June date that is now older than the 31-day ingestion limit and fails with `Activity event is too old`.
- Full Web suite is `71/75`: four unrelated existing source/render assertions fail (`expanded domain card...`, `failed summary revision...`, `initial report loads...`, and responsive section padding). The relevant failing HEAD facts were verified unchanged by this diff; for example HEAD already contains three detail sections while the test expects two.
- `git diff --check` passed. The high-confidence repository secret scan found no production secret; its only match was an existing synthetic Prisma URL parsing test fixture, which was reviewed with credentials redacted.

### Manual QA, Intentionally Unchanged, And Remaining Risks

- Real Windows Agent -> deployed API -> Owner Reports end-to-end manual QA was not run. No production deployment, policy mutation, database write, installer installation, re-pair, or real-device work-window transition was performed.
- A source/Alpha package build was run, but no new version bump or distributable NSIS release was created for this round.
- Required real-device QA: deploy matching API/Web, install a rebuilt Agent, verify fresh health plus outside-window snapshot copy, verify in-window current App replacement, wait for a completed interval, and confirm the same App duration appears in historical Reports.
- Build/typecheck rewrote two tracked generated files (the Alpha native-host executable copy and Web `tsconfig.tsbuildinfo`). After explicit user authorization, both were restored to HEAD and excluded from the implementation commits.

### Suggested Next Steps

1. Fix or time-anchor the unrelated API fixed-date test and update the four stale Web assertions in a separate maintenance round.
2. Run the coordinated real Windows QA sequence above before calling the production loop verified.

## 2026-07-19 Desktop Agent 0.6.4 Detailed Sync Failure Reasons

### Original Task Brief

- Replace the Desktop Agent Diagnostics panel's generic `HTTP_400` entries with a safe, complete, actionable reason for every future Tracking v2 sync rejection.
- Retain one correlation request ID across the Agent UI, privacy-safe local log, and API structured Render log.

### Changed Files

- API failure contract and structured log: `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`.
- Agent error parsing and persistence: `workmap/apps/desktop-agent/src/apiClient.ts`, `src/runtimeV2.ts`, `src/diagnosticLog.ts`, and `src/trackingV2Types.ts`.
- Agent Diagnostics presentation: `workmap/apps/desktop-agent/renderer/app.js`, `renderer/index.html`, and `renderer/styles.css`.

### Implementation Summary

- API Tracking v2 failures now return and log a privacy-safe `reasonCode`, `reasonMessage`, `remediation`, `retryable`, `stage`, and `requestId` instead of only a generic HTTP status.
- The Agent records those same safe fields in its persisted diagnostics and rolling NDJSON log, then shows a separate diagnostic card for each failed request: timestamp, HTTP status, code, stage, clear reason, automatic-retry decision, next action, and request ID.
- Known server rejection codes include invalid policy lease, invalid observation time, outside-work-window snapshot, invalid duration, protocol-boundary mismatch, malformed payload, transaction failure, and credential authorization failure. Unknown future failures still show the server-safe message plus the request ID rather than being reduced to `HTTP_400`.
- Historical failures created by older Agent builds cannot be reconstructed because their detailed server reason was never persisted. The UI labels these explicitly as historical rather than fabricating a cause.
- No activity payload, window title, URL, credential, or token is added to UI diagnostics or logs.

### Deployment Boundary

- No Prisma schema, migration, database operation, pairing flow, or credential storage was changed.
- Deploy the matching API before installing this rebuilt Agent. Existing device credentials remain valid after a normal 0.6.4 upgrade; re-pairing is not required solely for this diagnostics patch.

### Windows Artifact

- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.4.exe`
- Size: `115435291` bytes.
- SHA-256: `B626573F6EDD3951B040B28B7625604FD2C0B9520227FFB6ACAAB4E2960E3B81`.

### Verification

- `pnpm --filter @workmap/api typecheck`: passed.
- `pnpm --filter @workmap/desktop-agent typecheck`: passed.
- `pnpm --filter @workmap/api build`: passed.
- `pnpm --filter @workmap/desktop-agent release:windows`: passed after the packaging helper download was permitted.
- `git diff --check`: passed; only existing line-ending notices were reported.

### Manual QA

- Not run. A future intentionally rejected request should show its detailed safe reason in the Agent Diagnostics panel, in `%LOCALAPPDATA%\\WorkMap\\DesktopAgent\\logs\\agent-YYYY-MM-DD.ndjson`, and in Render by searching the same request ID.

## 2026-07-19 Desktop Agent 0.6.4 Snapshot Isolation And Product Diagnostics

### Original Task Brief

- Fix the repeated Tracking v2 `policy`-stage HTTP 400 failures that left the Agent recording locally while Owner Reports showed a stale or interrupted signal.
- Make an invalid live snapshot independent from valid completed intervals and heartbeat confirmation.
- Add privacy-safe, product-level diagnostics on the Agent, API, and Reports surfaces without logging credentials, tokens, window titles, URLs, or activity payloads.

### Changed Files

- Tracking contract and persistence: `workmap/packages/shared-types/src/tracking-v2.ts`, `workmap/prisma/schema.prisma`, and `workmap/prisma/migrations/20260719053000_tracking_snapshot_diagnostics/migration.sql`.
- API sync and Reports: `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`, `workmap/apps/api/src/modules/reports/tracking-v2-reports.service.ts`, and `workmap/apps/api/test/tracking-v2-snapshot-isolation.test.ts`.
- Desktop Agent runtime and diagnostics: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `src/diagnosticLog.ts`, `src/trackingV2Store.ts`, `src/trackingV2Types.ts`, `src/apiClient.ts`, Electron/renderer files, release metadata, and focused release tests.
- Owner Reports presentation: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx` and `workmap/apps/web/lib/api/apiTypes.ts`.

### Implementation Summary

- The API now validates the live Focus snapshot separately from completed intervals. An expired/mismatched lease, invalid observation time, or outside-policy-window snapshot returns a precise warning result instead of rejecting the whole sync request.
- Valid completed intervals, device health, heartbeat, and `lastSeenAt` continue to be confirmed even when the live snapshot is rejected. A stale provisional snapshot can no longer block confirmed history or make a healthy client appear disconnected.
- The three safe snapshot rejection codes are `SNAPSHOT_POLICY_LEASE_INVALID`, `SNAPSHOT_OBSERVATION_TIME_INVALID`, and `SNAPSHOT_OUTSIDE_POLICY_WINDOW`.
- The Agent clears only the rejected provisional snapshot/checkpoint, refreshes the current policy lease, and resumes tracking when the refreshed policy permits collection. Confirmed or queued historical intervals are not silently discarded.
- The Agent writes rolling privacy-safe NDJSON logs to `%LOCALAPPDATA%\WorkMap\DesktopAgent\logs\agent-YYYY-MM-DD.ndjson`, rotates at 5 MB, retains seven days, and offers a Diagnostics panel plus redacted diagnostic export.
- Agent/API sync diagnostics share the same request ID and record only safe fields such as operation, interval count, snapshot state, queue count, HTTP status, reason code, retry time, and duration.
- Owner Reports now shows the exact server diagnostic reason and remediation instead of only a generic stale/interrupted message.

### Database And Deployment Boundary

- Added nullable diagnostic columns to `ClientHealthSnapshot`: `serverDiagnosticCode`, `serverDiagnosticRequestId`, and `serverDiagnosticAt`.
- Migration `20260719053000_tracking_snapshot_diagnostics` was created and validated locally but was not applied to production.
- Coordinated rollout order is: apply the migration, deploy the matching API, deploy Web, then install Desktop Agent 0.6.4. Existing protected device credentials remain valid; upgrading does not require re-pairing.

### Windows Alpha Artifact

- Installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.4.exe`
- Size: `115431874` bytes.
- SHA-256: `2C84BCD5127073E4635051EA47D9A43BF1D2DB3AEC60C3A61D9A3861FC91D97E`.

### Verification

- Shared types, Desktop Agent, API, and Web typechecks passed.
- Desktop Agent package tests passed: 50/50.
- Snapshot-isolation API test passed and verified that an expired live lease still permits heartbeat persistence and returns the exact warning code.
- API production build and Web production build passed.
- Prisma schema validation passed using an ephemeral local placeholder URL; no database connection or mutation occurred.
- Desktop Agent 0.6.4 Windows installer build completed and the artifact version, size, and hash were verified.

### Manual QA And Remaining Risk

- Manual production QA and deployment were not run. They remain deferred pending the coordinated migration/API/Web/Agent rollout.
- Browser Extension runtime and artifact were not changed in this scoped repair.
- Remaining risk is limited to live environment validation of lease refresh and the new Reports diagnostic display against the production database/API combination.

## 2026-07-19 Tracking V2 Sync Failure Correlation Diagnostics (0.6.4)

### Original Task Brief

- Determine whether the current paired Desktop Agent's local Tracking v2 evidence identifies the cause of HTTP 400 sync failures.
- Add minimal, safe diagnostics so a future rejected request can be correlated between the Agent and Render without exposing credentials or activity payloads.

### Confirmed Findings

- `policyVersion: "v1"` is the active tracking-policy revision, not an Agent version. It matches the active policy lease and is valid.
- The inspected terminal records used integer durations (`1981` ms and `203` ms), so the shared-contract integer-duration rule was not the cause of those HTTP 400 responses.
- Some failed requests contained zero intervals, which means the historical HTTP 400 cannot be attributed solely to an individual activity interval. The earlier client diagnostics retained only `HTTP_400`, making the exact request-level failure stage unavailable.

### Changed Files

- `workmap/apps/desktop-agent/src/apiClient.ts`
- `workmap/apps/desktop-agent/src/runtimeV2.ts`
- `workmap/apps/desktop-agent/src/trackingV2Types.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/alpha-windows/package.json`
- `workmap/apps/desktop-agent/scripts/build-alpha.mjs`
- `workmap/apps/desktop-agent/src/version.ts`
- `workmap/apps/desktop-agent/src/windowsActivityHost.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`

### Implementation Summary

- The API now returns a sanitized `stage` (`parse`, `policy`, `transaction`, or `response`) plus the existing request ID for Tracking v2 request-level failures.
- Render emits one structured warning per rejected request with the same request ID, stage, status/code, and a sanitized short message. No credentials or activity payloads are logged.
- Agent `status.json` now persists the last failed sync's HTTP status, request ID, safe error message, and failure stage, while preserving the existing successful-sync status.
- The Desktop Agent release version is `0.6.4`. Existing paired installations retain their protected device credential and do not require re-pairing after upgrade.

### Verification

- `pnpm.cmd --filter @workmap/desktop-agent typecheck` passed.
- `pnpm.cmd --filter @workmap/api typecheck` passed.
- Windows installer build pending in this task round.

### Manual QA

- Not run. After API deployment and Agent 0.6.4 installation, the next rejected sync should be correlated using `lastSyncDiagnostic.requestId` / `recentSyncFailures[].requestId` in local `status.json` and the matching Render log entry.

### Intentionally Not Changed

- No pairing, credential, tenant, policy, activity aggregation, report, schema, or migration behavior was changed.

### Remaining Risk

- This release makes a future request-level rejection conclusive; it does not manufacture acceptance of previously rejected history.

## 2026-07-19 Desktop Agent V2 Integer Interval Repair

### Original Task Brief

- Diagnose why a paired Desktop Agent could return successful empty sync health updates while activity did not reach Owner Reports.

### Root Cause

- Local Tracking v2 diagnostics showed 32 `DEAD_LETTER` intervals with `lastCode: INVALID_DURATION`.
- The Windows/native monotonic clock can provide fractional milliseconds, while the Tracking v2 contract requires a positive integer `durationMs`. The Agent had persisted fractional values such as `1806.6998000014573`, so the API correctly rejected those intervals.

### Changed Files

- `workmap/apps/desktop-agent/src/desktopFocusEngineV2.ts`
- `workmap/apps/desktop-agent/test/desktop-focus-v2.test.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/alpha-windows/package.json`
- `workmap/apps/desktop-agent/scripts/build-alpha.mjs`
- `workmap/apps/desktop-agent/src/version.ts`
- `workmap/apps/desktop-agent/src/windowsActivityHost.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`

### Implementation Summary

- Tracking v2 now canonicalizes persisted monotonic start/end boundaries to integer milliseconds and derives `durationMs` from those same two persisted values.
- Intervals that cannot form a positive integer-millisecond range are not queued. This affects only sub-millisecond clock noise; it avoids invalid zero-duration payloads without creating overlap.
- UTC projection now uses the same millisecond precision.
- Desktop Agent release version is `0.6.3`.
- Existing rejected v2 `DEAD_LETTER` rows remain retained for audit. They are not reclassified into valid work time. New Agent activity creates valid v2 intervals.

### Verification Commands And Results

- `pnpm.cmd --filter @workmap/desktop-agent test`: passed, 50/50.
- `pnpm.cmd --filter @workmap/desktop-agent typecheck`: passed.
- `pnpm.cmd --filter @workmap/desktop-agent release:windows`: passed after a sandbox-only packaging-download retry.
- `git diff --check`: passed; only CRLF conversion notices.

### Artifact

- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.3.exe` (115,431,951 bytes).

### Manual QA

- Not run. The monitored computer must install `0.6.3` before newly generated intervals can be confirmed by the server.

### Intentionally Not Changed

- No API, database, Prisma schema, migration, pairing, credential, Browser Extension, or legacy queue behavior changed.

### Remaining Risks

- The existing rejected v2 rows and retained v1 compatibility queue are historical data, not valid newly confirmed activity. They should remain visible to diagnostics but must not be counted as work time.

## 2026-07-19 Desktop Agent Queue Status Separation

### Original Task Brief

- Correct the Desktop Agent status UI after local diagnostics proved that the displayed `1,000` pending uploads were retained legacy `queue.json` records, not Tracking v2 intervals awaiting upload.

### Changed Files

- `workmap/apps/desktop-agent/src/types.ts`
- `workmap/apps/desktop-agent/src/runtimeV2.ts`
- `workmap/apps/desktop-agent/renderer/index.html`
- `workmap/apps/desktop-agent/renderer/app.js`
- `workmap/apps/desktop-agent/renderer/styles.css`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Tracking v2 now writes only its SQLite pending interval count to `AgentStatus.queuedEvents`; queued lifecycle events remain included by the renderer as before.
- Retained v1 compatibility records are written separately as `queuedLegacyEvents` with the current `trackingMigrationState`.
- The Desktop Agent UI labels the primary value as `Pending Tracking v2 uploads` and displays a separate amber compatibility notice only when legacy records exist. The notice makes clear that retained historical records are preserved and retried through the v1 compatibility path.
- No legacy records are deleted, cleared, re-paired, or silently reclassified. The existing `DRAINING_V1` compatibility retry remains unchanged.

### Verification Commands And Results

- `pnpm --filter @workmap/desktop-agent test`: passed, 48/48.
- `pnpm --filter @workmap/desktop-agent typecheck`: passed.
- `git diff --check`: passed; line-ending notices only.
- The first `node --check` invocation used a wrong relative renderer path and did not inspect source; corrected source syntax verification is recorded in the QA handoff.

### Manual QA

- Not run. The current installed Agent will not receive this UI/runtime status change until a new Windows installer is built and installed. Existing paired credentials and local queues remain intact.

### Intentionally Not Changed

- No API, database, Prisma schema, migration, pairing, credential, queue retention, upload logic, or Browser Extension change.

### Remaining Risks

- A retained v1 queue still depends on the pre-existing compatibility endpoint to drain. Its presence is now observable separately rather than being misreported as Tracking v2 backlog.

## 2026-07-18 Tracking v2 Upload Confirmation And Reconciliation Diagnostics

### Original Task Brief

- Investigate why the deployed `f5ad70b` UUID-lock repair still left a paired Desktop Agent in `Offline - retrying` with a full local queue while Render repeatedly logged only a generic Tracking v2 reconciliation warning.

### Changed Files

- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`
- `workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.service.ts`
- `workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.worker.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Removed synchronous reconciliation from `POST /device-client/sync-v2`. Once the intake transaction accepts a v2 interval, snapshot, and health payload, the API now returns the acknowledgement without waiting for daily-report aggregation.
- The existing reconciliation worker remains responsible for dirty aggregate targets. A failed aggregate refresh can no longer make a successful client upload wait long enough to time out and appear offline.
- Worker warnings now include a capped, redacted database error code/message. URLs and Device/Bearer credentials are removed before logging, so the next Render failure identifies the remaining reconciliation fault without disclosing secrets.
- No Prisma schema, migration, pairing, device credential, legacy queue record, Reports contract, or client installer was changed.

### Verification Commands And Results

- `git -C workmap diff --check`: passed; CRLF notices only.
- `node --check` on the two modified API modules: passed.
- API package typecheck/lint/build: not run. The local `workmap/node_modules` state is inconsistent with the lockfile; pnpm requested a destructive modules-directory purge, then failed to reach the registry. No dependency directory was removed or reinstalled.

### Manual QA

- Not run. Deploying this API-only patch is required before the Agent can retry against the decoupled sync path and before Render can emit the actual reconciliation error.

### Intentionally Not Changed

- No Desktop Agent or Browser Extension update is required for this API-only change.
- No local client queue or historical event was deleted, requeued, or mutated.

### Remaining Risks

- The separate reconciliation failure remains unresolved until the newly detailed Render warning identifies its exact database error. It will no longer block client upload acknowledgement.
- Existing v1 legacy queue items remain in `DRAINING_V1`; their independent retries are preserved and must not be discarded without an explicit data-retention decision.

## 2026-07-19 Tracking v2 Reconciliation Advisory-Lock Fix

### Original Task Brief

- Diagnose the detailed Render worker warning: Prisma `P2010`, `Failed to deserialize column of type 'void'`, which kept Tracking v2 reconciliation targets retryable.

### Changed Files

- `workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.service.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- The company-summary transaction takes a PostgreSQL advisory transaction lock to serialize concurrent aggregate updates. The lock function correctly returns PostgreSQL `void`, but it was called through Prisma `$queryRaw`, which attempts to deserialize a result set and therefore raised `P2010`.
- Changed the lock query so `pg_advisory_xact_lock` executes inside a referenced CTE while the final result returned to Prisma is only `TRUE AS "locked"`. This guarantees the lock is held while no PostgreSQL `void` column is deserialized. The transaction, aggregation algorithm, schemas, intervals, clients, pairing, credentials, and Reports contract are unchanged.
- This allows the existing worker to progress dirty reconciliation targets and populate the confirmed daily summaries used by `/reports`.

### Verification Commands And Results

- `node --check workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.service.ts`: passed.
- `node --check workmap/apps/api/src/modules/devices/tracking-v2-reconciliation.worker.ts`: passed.
- `node --check workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`: passed.
- `git -C workmap diff --check`: passed; CRLF conversion notices only.
- Scoped changed-diff credential scan: passed; no match.
- Full API typecheck/lint/build remains blocked locally by the pre-existing inconsistent `node_modules` state and unavailable registry access. No dependency directory was changed.

### Manual QA

- Not run. A Render API deployment is required; afterward the already-paired Agent retries automatically and the reconciliation worker should stop logging the `void` deserialization warning.

### Intentionally Not Changed

- No migration, database data, Desktop Agent, Browser Extension, authentication, or report UI change.

### Remaining Risks

- The production worker has not yet run this corrected CTE path. If another database error exists, the existing redacted worker logging will identify it without exposing credentials.

## 2026-07-18 Tracking v2 Sync UUID Lock Recovery

### Original Task Brief

- Diagnose and repair the production `POST /device-client/sync-v2` failure that left newly paired Desktop Agents in `Offline - retrying` with pending local uploads and no new Reports data.

### Changed Files

- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`
- `workmap/apps/api/test/tracking-v2-sync-uuid-lock.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Render logs identified the exact production failure: PostgreSQL rejected the v2 write-lane lock query with `uuid = text` (`P2010` / SQLSTATE `42883`).
- `lockWriteLanes()` now explicitly casts every `ClientWriteLane.id` raw SQL parameter as `uuid` before `FOR UPDATE`. The lane rows remain deterministically ordered and the existing transaction/concurrency behavior is preserved.
- Added a focused regression test which verifies the generated raw lock SQL keeps UUID values parameterized and casts each parameter to `uuid`.
- No database schema, Prisma migration, pairing, credential, collection, Reports aggregation, Desktop Agent, Browser Extension, auth, or RBAC behavior was changed.

### Role And Access Behaviour

- Device credentials retain their existing device/user/tenant scope. This repair changes only the internal database type handling after the existing device credential has been authenticated.
- No report-read access is added to a device credential.

### Verification Commands And Results

- `pnpm.cmd --filter @workmap/api test`: passed, 22/22 including `v2 write-lane lock casts raw lane identifiers to UUID`.
- `pnpm.cmd --filter @workmap/api typecheck`: passed.
- `pnpm.cmd --filter @workmap/api lint`: passed.
- `pnpm.cmd --filter @workmap/api build`: passed.
- `git diff --check`: passed; only informational Windows CRLF conversion warnings were emitted.
- Scoped diff credential-pattern scan: passed; no match.

### Manual QA

- Not run locally. Render deployment and a real paired-client retry against the deployed API remain required to confirm the original production path.

### Intentionally Not Changed

- No Prisma migration is required or included.
- No Desktop Agent or Browser Extension package update is required for this server-side fix.
- No local agent queue records were edited or deleted.

### Remaining Risks

- Existing v2 `PENDING` intervals should retry automatically once the repaired API is deployed.
- Previously dead-lettered `HTTP_400` intervals remain deliberately non-retriable; this fix does not requeue historical client-side dead letters.
- The deployed API must be verified from Render logs after deployment to ensure the `P2010` / `uuid = text` error no longer appears.

## 2026-07-18 Tracking Client GitHub Release Automation

### Original Task Brief

- Automate GitHub tag/release creation and binary upload for each new Desktop Agent and Browser Extension version, so releases no longer require manual tag and asset handling in GitHub.

### Changed Files

- `.github/workflows/publish-tracking-clients.yml`
- `workmap/apps/browser-extension/scripts/package-alpha.mjs`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added a Windows GitHub Actions workflow that detects committed `package.json` version changes on `main` separately for Desktop Agent and Browser Extension. It also supports a targeted manual `workflow_dispatch` retry for either client or both clients.
- Desktop release jobs install pinned pnpm, Node 22, and .NET 9; run the package typecheck/lint/tests; create the existing NSIS installer; then create `desktop-agent-v<version>` or replace its `.exe` asset in the matching GitHub Release.
- Extension release jobs install pinned pnpm and Node 22; run typecheck/lint/tests; create the unpacked MV3 ZIP; then create `browser-extension-v<version>` or replace its `.zip` asset in the matching GitHub Release.
- Browser Extension packaging now reads its version from `apps/browser-extension/package.json`; the release asset cannot remain accidentally hard-coded to `0.5.0` after a version bump.
- The workflow uses GitHub's ephemeral `github.token` with `contents: write`; no repository secret, Cognito credential, device credential, or local environment value is added.

### Role And Access Behaviour

- The workflow token is limited to GitHub repository contents/release writes. It has no WorkMap API, tenant, Cognito, device, or Reports access.
- A release is created only from the committed source version on `main`, or when a maintainer explicitly chooses its target in the Actions manual-run control.

### Verification Commands And Results

- `pnpm --dir workmap exec prettier --check ../.github/workflows/publish-tracking-clients.yml apps/browser-extension/scripts/package-alpha.mjs`: pass.
- `pnpm --dir workmap --filter @workmap/browser-extension typecheck`: pass.
- `pnpm --dir workmap --filter @workmap/browser-extension lint`: pass.
- `pnpm --dir workmap --filter @workmap/browser-extension test`: pass, 31 tests.
- `pnpm --dir workmap --filter @workmap/browser-extension release:zip`: pass; generated `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.0.zip`.
- `pnpm --dir workmap --filter @workmap/desktop-agent typecheck`: pass.
- `pnpm --dir workmap --filter @workmap/desktop-agent lint`: pass.
- `pnpm --dir workmap --filter @workmap/desktop-agent test`: pass, 48 tests.
- GitHub-hosted Windows runner execution, real tag creation, and release upload: not run locally and not claimed.

### Manual QA

- Not run. This round changes release automation only; it does not install the Agent, load the Extension, create a live GitHub Release, or exercise tracking behavior.

### Intentionally Not Changed

- Desktop Agent and Browser Extension runtime, auto-start behavior, pairing, tracking, backend, Reports, package versions, and existing release artifacts.
- No existing GitHub Release, tag, secret, or unrelated untracked user file was modified.

### Remaining Risks

- The repository's GitHub Actions settings must grant workflows `Read and write permissions`; otherwise GitHub will reject release/tag creation.
- First execution still depends on the hosted Windows runner being able to build the current Electron/.NET installer and invoke GitHub CLI. The workflow fails rather than creating a partial release if a test or artifact check fails.
- This configuration intentionally releases only after a package version change or a maintainer's manual dispatch; it does not retroactively publish existing artifacts.

### Suggested Next Steps

- Commit and push these workflow changes. In GitHub Actions, run `Publish Tracking Clients` once with `both` to publish the current `0.6.0`/`0.5.0` artifacts if desired. Later releases need only a committed package-version bump on `main`; Actions will create the tag, release, and asset automatically.

## 2026-07-17 Tracking Protocol v2 Concurrency And Bootstrap Plan Revision

### Original Task Brief

- Re-evaluate the latest three mandatory and two suggested architecture findings against the real WorkMap repository.
- Update the final Tracking clients execution plan without rewriting its settled architecture.
- Make concurrent Focus writes, first-session live timing, one-Desktop workstation binding, DST-safe policy windows, and Windows input-tick rollover implementation-ready.

### Changed Files

- `docs/designs/workmap-tracking-clients-final-implementation-plan.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Accepted all five findings after confirming the current `Device` lacks client/browser/workstation identity, pairing creates devices without workstation locking, and the prior plan had no database serialization rule for overlap.
- Added `ClientWriteLane(deviceId, source, stream)` row locking plus a PostgreSQL `btree_gist` half-open range exclusion for Focus. The constraint spans clock epochs, permits exact adjacency, and intentionally permits overlap between different Browser Profile device IDs for later arbitration/union.
- Added `nextIntervalSequence` to `LiveFocusSnapshotV2`. A first state can start a UI-only provisional counter from `stateStartedAt` only when sequence `1`, cursor `0`, no dispositions, epoch, policy lease, and lane-locked database state all agree. Confirmed history remains ledger-only.
- Chose immutable `Device.clientType` and server-owned `Device.browserName`, a raw PostgreSQL partial unique index for one active Desktop per workstation, workstation row locking, and compare-and-swap Desktop replacement so concurrent codes cannot revoke the wrong device.
- Added server-issued, lease-scoped `allowedUtcWindows` and `DevicePolicyLease`; C#, Electron, Extension JavaScript, and ingestion compare UTC windows rather than independently resolving DST.
- Added deterministic 32-bit `LASTINPUTINFO.dwTime` rollover behavior/tests and removed the undefined envelope-level `TrackingSyncRequestV2.clientSequence`.
- Added migration, concurrency, pairing, initial-live, DST-window, and rollover verification requirements to work packages and release acceptance.
- No runtime, Prisma schema, migration, API, client, Reports, auto-start, authentication, or deployment behavior changed.

### Role And Access Behaviour

- Workstation selection and replacement remain Cognito-authenticated, tenant/user scoped, and server bound to a one-time pairing code.
- Device credentials remain write-only for their immutable device/client/workstation identity and cannot read Reports.
- Employee own-data, authorised Owner/manager reads, report auditing, cross-tenant rejection, and Platform Admin employee-detail exclusion remain unchanged.

### Verification Commands And Results

- Current Prisma Device/Credential/PairingCode and pairing Web/API source review: pass.
- Current Desktop `0.5.10`, Extension `0.4.3`, Windows adapter, activity storage, and migration pattern review: pass.
- Official PostgreSQL exclusion/range, `btree_gist`, Prisma customized-migration, and Microsoft tick behavior review: pass.
- Plan contract scan: pass; required database lane/exclusion, cross-epoch rule, initial sequence proof, immutable device/browser identity, partial unique index, UTC windows, and rollover coverage are present.
- `TrackingSyncRequestV2.clientSequence` field scan: pass; zero field definitions remain.
- Plan structure: pass; 24 balanced code fences, 53 headings, and zero trailing-whitespace matches.
- `git diff --check`: pass for tracked changes; line-ending conversion warnings only.
- Untracked plan whitespace check: pass; `git diff --no-index --check` returned only its expected file-difference exit status and no whitespace finding.
- Focused secret scan: pass; no database URL, Redis URL, private key, cloud access key, device credential, or JWT-like token match.
- Runtime typecheck, lint, build, tests, migrations, and packaging were not run because runtime code did not change.

### Manual QA

- Not run. No Agent installation, Extension loading, account flow, tracking signal, or Reports UI behavior changed or was claimed.

### Intentionally Not Changed

- Desktop Agent and Extension runtime or existing auto-start/tray behavior.
- API/Web runtime, Prisma schema/migrations, Cognito, RBAC, deployment, generated artifacts, and optional Open Runtime scope.
- Existing unrelated user documentation changes in the worktree.

### Remaining Risks

- This is an implementation-ready blueprint, not Tracking Protocol v2 runtime completion.
- Supabase/Postgres must permit the migration's `btree_gist` extension and the exact exclusion/partial-index SQL must pass disposable-database migration validation.
- Legacy Device identity conflicts require explicit quarantine/repair before v2 activation; the plan intentionally does not guess.
- Real Windows, installed Chrome/Edge, Owner/Employee Reports, and migration performance remain implementation and later concentrated-QA work.

### Suggested Next Steps

- The reviewed architecture now meets the entry criteria for work package 1 contracts/fixtures and work package 2 additive backend/database foundation. Keep v2 activation disabled until their migration, concurrency, policy, pairing, and compatibility tests pass.

## 2026-07-17 Tracking Protocol v2 Integrity Plan Revision

### Original Task Brief

- Re-evaluate the latest five mandatory architecture findings against the real Desktop Agent `0.5.10`, Browser Extension `0.4.3`, pairing, Prisma, ingestion, and Reports code.
- Accept only findings supported by the repository and platform behavior, then update the final implementation plan.
- Cover idempotency/sequence conflicts, queue compaction, multi-device totals, monitoring timezone, workstation pairing, downgrade behavior, stable subject identity, and accurate Desktop input wording.

### Changed Files

- `docs/designs/workmap-tracking-clients-final-implementation-plan.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Accepted all five mandatory findings and the three suggested refinements, with one explicit compatibility limit: already released binaries cannot gain a dedicated `UPGRADE_REQUIRED` UI from a server-only change.
- Added dual uniqueness for event identity and stream sequence identity, server-computed canonical `payloadHash`, `IDEMPOTENCY_CONFLICT` / `SEQUENCE_CONFLICT`, and a frozen canonicalization version.
- Completed `LiveFocusSnapshotV2` with clock epoch, policy, browser, stable subject, current-state identity, and exact latest-emitted event/sequence references; fully defined privacy-minimal `ClientHealthV2`.
- Prohibited semantic merging or renumbering of queued canonical intervals. HTTP compression/batching remains allowed only as transport.
- Replaced direct user/company summary addition with device/subject caches, durable dirty targets, user/day interval union, Active-over-Idle precedence, company sums of reconciled users, and a ledger fallback for dirty report dates.
- Kept Reports date ownership in UTC but added an Owner-confirmed IANA monitoring timezone. Existing `09:00-17:00` values are not silently interpreted as UTC; collection stops after an explicit 24-hour offline policy lease.
- Defined the Cognito-authenticated workstation selection flow, pairing-code workstation binding, exchange override rejection, one active Desktop per workstation, standalone Extension behavior, and Chrome/Edge/profile live arbitration.
- Split immutable `subjectKey` from mutable `displayName` and corrected Desktop semantics: `GetLastInputInfo` proves Windows-session input observed while an app was foreground, not input targeted at that app.
- Added post-activation downgrade behavior. The server returns structured HTTP `426 UPGRADE_REQUIRED` and never refreshes Healthy status; new clients handle it explicitly, while old clients may show only their existing generic error/offline state.
- Resolved a derived cross-midnight conflict: one canonical interval owns the event/sequence, while server-generated day fragments carry no separate client sequence.
- No runtime, schema, migration, API, client, Reports UI, auto-start, authentication provider, or deployment behavior changed in this documentation task.

### Role And Access Behaviour

- Workstation listing and code creation remain Cognito-authenticated and tenant/user scoped.
- Pairing exchange cannot select a workstation; it consumes the server-bound one-time code.
- Device credentials remain write-only for their bound tenant/user/client/device/workstation and cannot read Reports.
- Employee own-data, authorised Owner/manager views, report auditing, cross-tenant rejection, and Platform Admin privacy boundaries remain mandatory.

### Verification Commands And Results

- Focused source review of current Prisma models, pairing Web/API flow, client `4xx` behavior, Extension startup/focus restoration, ingestion, and Reports aggregation: pass.
- Official Microsoft `GetLastInputInfo` and Chrome windows/alarms/service-worker constraints reviewed: pass.
- Plan structure: pass; 22 balanced code fences, 53 headings, zero trailing-whitespace matches.
- Rejected-design scan: pass; no stale `lastInteractionAt`, UTC-only schedule, semantic queue-compaction, seven-day collection promise, Clerk, or 3CX direction remains in the plan.
- `git diff --check`: pass for tracked changes; line-ending conversion warnings only.
- Untracked plan whitespace check: pass; `git diff --no-index --check` reported only the expected file-difference exit status and no whitespace finding.
- Focused secret scan: pass; no credential, private key, JWT, database URL, or cloud access-key match.
- Runtime typecheck, lint, build, tests, migrations, and packaging were not run because runtime code did not change.

### Manual QA

- Not run. No Agent installation, Extension loading, account flow, live tracking, or Reports browser behavior changed or was claimed.

### Intentionally Not Changed

- Desktop Agent/Extension auto-start and tray behavior.
- Client/API/Web runtime, Prisma schema and migrations, Cognito architecture, credentials, RBAC, deployment, and generated artifacts.
- Open Runtime remains an optional later policy package and is not represented as implemented.

### Remaining Risks

- This is an implementation blueprint, not Tracking Protocol v2 runtime completion.
- Existing `0.5.10/0.4.3` binaries cannot render a new dedicated downgrade message; server-side rejection and health status are the enforceable boundary until a new client is installed.
- Exact app identity fallback quality, multi-profile browser arbitration, IANA/DST schedule behavior, interval-union load, and real Windows/Chrome lifecycle behavior still require implementation and the listed automated/manual verification.
- Existing v1 rows already evicted by the old 1,000-row queue cap remain unrecoverable.

### Suggested Next Steps

- Begin work package 1 deterministic contracts/fixtures, then the additive backend/pairing/policy/reconciliation foundation. Do not activate either v2 client before those compatibility tests pass.

## 2026-07-17 Tracking Clients Revised Final Implementation Plan

### Original Task Brief

- Review the latest Desktop Agent and Browser Extension plans against the real repository.
- Determine whether the architecture and Desktop/Browser/mixed-use scenario tables are complete and internally consistent.
- Apply the accepted technical review corrections to the final plan before runtime development begins.
- Keep the design grounded in Desktop Agent `0.5.10`, Browser Extension `0.4.3`, current API/Prisma/Reports behavior, and real Windows/Chrome platform limits.

### Changed Files

- `docs/designs/workmap-tracking-clients-final-implementation-plan.md`
- `docs/api/activity-ingestion-contract.md`
- `docs/ai-handoff/stage4-tracking-reports-verification.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Revised the implementation source of truth for Desktop Agent `0.6.0`, Browser Extension `0.5.0`, Tracking Protocol `v2`, backend ledger/live snapshots, and Reports.
- Fixed the product contract at 60 seconds and required every valid completed `durationMs > 0` interval to remain in the ledger and summaries; UI grouping cannot delete short history.
- Replaced the impossible Extension five-second heartbeat with event-driven sync plus a production 30-second recovery/retry/reconciliation alarm and source-specific stale thresholds.
- Replaced a single time watermark with device/source/stream/clock-epoch contiguous sequence cursors, missing ranges, terminal rejection tombstones, and `clientEventId` idempotency.
- Restricted historical totals and exports to confirmed ledger data. Live animation is provisional, correctable, never persisted, and disabled when sequence continuity is unknown.
- Added an online idempotent v2 activation handshake, `protocolActivatedAt`, preserved credentials, legacy v1 queue drain, and explicit `0.5.10 -> 0.6.0` / `0.4.3 -> 0.5.0` upgrade fixtures.
- Added the missing device policy endpoint/cache/offline lease/server enforcement design; Reports daily summaries remain UTC while monitoring schedules require a separately confirmed IANA timezone.
- Added the Windows hidden top-level message loop, WTS/power lifecycle, helper supervision/signing/SmartScreen/AV boundaries, and honest crash/power-loss inference limits.
- Reduced the core release to accurate Focus/Current Focus. Open Runtime is a separate policy-gated optional package and does not block the core versions.
- Reworked ingestion around batch 50, per-item results, set-based short transactions, and no per-interval duplicate/summary queries.
- Split verification into deterministic tests, API/database integration, Windows/Chromium platform automation, and explicitly deferred concentrated real-device QA.
- Marked two older proposal/verification documents as historical without deleting their contents.
- No runtime implementation was changed in this architecture-only task.

### Role And Access Behaviour

- Employee own-data, authorised Owner/manager individual/company reports, cross-tenant rejection, report-access audit, and Platform Admin employee-detail exclusion remain mandatory.
- Device credentials remain write-only for their bound tenant/user/client/device/workstation and cannot read Reports.

### Verification

- Inspected current Desktop, Extension, API, Prisma, Reports, pairing, queue, and test code.
- Checked the design against Microsoft WinEvent/GetLastInputInfo/WTS/power/window-message constraints and Chrome MV3 lifecycle, tabs, windows, idle, content-script, and alarm constraints.
- Plan structure/headings/code-fence check: pass; 18 balanced code fences.
- `git diff --check`: pass.
- Focused changed-file secret scan: pass; no matches.
- Runtime tests/builds were not run because this task changed documentation only.

### Manual QA

- Not run. This task produced an implementation plan and did not change client/API/Reports runtime behaviour.

### Intentionally Not Changed

- Desktop Agent, Browser Extension, API, Web UI, Prisma schema/migrations, authentication, device credentials, deployment, and build artifacts.
- Existing historical diagrams and handoff entries were retained.

### Remaining Risks

- The current clients and Reports do not yet satisfy the target architecture; the plan must not be reported as implemented.
- Existing v1 queues may already have silently evicted old rows under their current 1,000-row cap; an upgrade cannot reconstruct data that no longer exists locally.
- Open Runtime is broader than the current foreground-only compliance baseline and remains uncollected until its independent policy, employee notice, retention, implementation, and QA are complete.
- Passive reading, meetings, calls, and offline work remain outside what interaction recency can prove.
- Multi-monitor, UAC, RDP, sleep/hibernation, power loss, SmartScreen/AV, and real installed Chrome/Edge lifecycle behavior remain concentrated manual QA after development.

### Suggested Next Steps

- Execute core work packages 1-6 in order: deterministic contracts/upgrades, additive backend/policy foundation, Desktop Focus, Browser Focus, confirmed-history/provisional-current Reports, and compatibility rollout. Open Runtime remains optional work package 7.

## 2026-07-16 Desktop Agent 0.5.10 Linear Runtime Diagram

### Original Task Brief

- Update the detailed linear Desktop Agent flow diagram for the current `0.5.10` runtime.

### Changed Files

- `docs/designs/workmap-desktop-agent-0.5.10-runtime.drawio`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added a new, editable two-page Draw.io source without replacing the `0.5.8` or `0.5.9` historical diagrams.
- Page one traces the production path from Agent startup, local queue/checkpoint recovery, 100 ms Windows foreground sampling, tracking-state boundaries, durable event creation, the `0.5.10` pre-heartbeat upload order, API acknowledgement/idempotency, report aggregation, and the same-view display guard.
- Page two gives a concrete continuous-Edge example. It shows why `6m 17s` remains visible when the ten-second slice rolls over: the completed slice is first queued and uploaded, then the heartbeat is allowed to expose the new zero-second live slice, while Reports keeps the same-view maximum until durable aggregation catches up.
- The diagram also marks app switches, idle/lock/no-window boundaries, UTC-day boundaries, offline retry, checkpoint recovery, shutdown flush, and the bounded in-memory loss risk during abrupt power loss.

### Verification

- PowerShell XML parse: pass; Draw.io source contains two pages, `0.5.10 Linear Runtime Flow` and `0.5.10 Edge rollover example`.
- `git diff --check`: pass.
- Focused changed-file secret-pattern scan: pass; no matches.

### Manual QA

- Not run. The Draw.io source was XML-validated; opening it in diagrams.net for visual-layout confirmation is deferred.

### Intentionally Not Changed

- Agent runtime, frontend logic, backend/API, database, Prisma schema, deployment configuration, credential behavior, and Browser Extension behavior.

### Remaining Risk

- The diagram reflects the current `0.5.10` code and configured defaults. If interval environment values are intentionally changed later, the labels in this explanatory diagram should be updated with the runtime configuration.

## 2026-07-16 Desktop Agent 0.5.10 Focus Slice Continuity

### Original Task Brief

- Fix the Reports Focus Active display regression where a continuous app could appear to fall from a value such as `6m 17s` to `6m 0s` at a ten-second Agent slice boundary, without dropping completed activity time.

### Changed Files

- `workmap/apps/desktop-agent/src/runtime.ts`
- `workmap/apps/desktop-agent/src/pairing.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/test/queue-api.test.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `workmap/apps/web/components/reports/liveUsage.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/reports-live-usage.test.ts`

### Implementation Summary

- Desktop Agent `0.5.10` now sends a completed durable Focus slice to the existing local queue and flushes it before its rollover heartbeat publishes the next live slice.
- The queue remains the source of durability: an event is removed only after the existing idempotent API acknowledgement. A network failure retains the event for the existing retry path.
- Reports now retains the last displayed maximum totals for the same scope, employee, department, and reporting range while the independently fetched persisted aggregate catches up to a just-acknowledged heartbeat transition.
- A changed filter range or reporting scope resets that display guard. API summaries, exports, database values, RBAC, pairing, backend endpoints, and Browser Extension behavior are unchanged.
- Version metadata and the Windows installer are now `0.5.10`.

### Verification

- Web focused report tests: pass, 4/4.
- Desktop Agent focused runtime, tracking, and release tests: pass, 27/27.
- `pnpm.cmd --filter @workmap/desktop-agent typecheck`: pass.
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/web lint`: pass.
- `pnpm.cmd --filter @workmap/desktop-agent release:windows`: pass.
- `git diff --check`: pass.

### Build Artifact

- `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.10.exe` (non-empty NSIS installer).

### Manual QA

- Not run. A paired Windows-device verification is required after release; no deployment, database, or API configuration is required by this code change.

### Intentionally Not Changed

- Prisma schema/migrations, API/backend, tenant/RBAC logic, device credentials, Browser Extension, data collection categories, retry semantics, and existing persisted activity events.

### Remaining Risk

- An abrupt power loss before the next existing local checkpoint can still lose only the in-memory fraction since that checkpoint; completed slices and queued uploads remain durable. This change removes the normal-network display regression without weakening that durability model.

## 2026-07-16 Compliance Card-Grid Surface Fix

### Original Task Brief

- On `/compliance`, remove the white background visible through the gaps between parallel cards. Change styles only.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Scoped the neutral container reset to direct Compliance card-grid sections.
- The grid container now explicitly has no surface, background image, border, shadow, or padding. Card content, policy data, acknowledgement behavior, layout breakpoints, and all other pages are unchanged.

### Verification

- Scoped CSS diff reviewed.
- `git diff --check`: pass.

### Manual QA

- Not run. Refresh `/compliance` after deployment and confirm the card gaps reveal the page background rather than a white container.

### Intentionally Not Changed

- Compliance API, policy acknowledgement, data collection behavior, authentication, backend, database, Desktop Agent, Browser Extension, and deployment.

### Remaining Risk

- Visual confirmation remains deferred until the frontend deployment is viewed in a browser.

## 2026-07-16 Device Setup Button Height Alignment

### Original Task Brief

- Frontend styling only: make the left Desktop Agent action buttons in `/onboarding/device-setup` match the compact visual treatment of the Browser Extension action buttons on the right. Do not change functionality.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Scoped a style rule to the first (Desktop Agent) pairing panel only.
- Fixed its download link and pairing-code button to the same compact `44px` height, `10px 14px` padding, and `20px` line height used by the right-side actions.
- Added border-box sizing and start alignment so the left action row cannot stretch either control into the oversized treatment shown in the screenshot.

### Role And Access Behavior

- No download URL, pairing-code creation, disabled state, status message, authentication, role, routing, API, or data behavior changed.

### Verification

- `pnpm.CMD --filter @workmap/web typecheck`: pass.
- `pnpm.CMD --filter @workmap/web lint`: pass.
- `pnpm.CMD --filter @workmap/web build`: pass; existing Next.js ESLint-plugin warning only.
- `git diff --check`: pass (line-ending conversion warnings only; no whitespace errors).
- Scoped secret scan of changed style and handoff files: pass; no matches.

### Manual QA

- Not run in an authenticated browser session. This is a stylesheet-only, first-panel-scoped layout correction.

### Intentionally Not Changed

- `device-setup/page.tsx`, component logic, download links, pairing interactions, AppShell/sidebar styling, APIs, database, RBAC, Desktop Agent, Browser Extension, and deployment.

### Remaining Risk And Suggested Next Step

- Low visual-only risk. Refresh `/onboarding/device-setup` and confirm both left buttons now have the same compact height as the right action row.
- The next round can proceed.

## 2026-07-16 Desktop Agent 0.5.9 Runtime Diagram Sync

### Original Task Brief

- Synchronize the Desktop Agent architecture diagram with the 0.5.9 continuous Focus reporting implementation.

### Changed Files

- `docs/designs/workmap-desktop-agent-0.5.9-runtime.drawio`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added a new two-page Draw.io source instead of overwriting the historical 0.5.8 diagram.
- Page one documents the 0.5.9 release/paired-device continuity, Windows sample inputs, ten-second durable Focus slices, local queues, idempotent Device API upload, and five-second Reports revision replacement path.
- Page two documents the continuous Focus lifecycle, the distinction between Focus Active and visible-window Open/runtime, all completion boundaries, checkpoint recovery, and the privacy boundary.

### Verification

- Draw.io XML parses as one `mxfile` with two diagrams.
- Scoped secret scan: pass; no credentials, pairing codes, or database URLs were added.
- `git diff --check`: pass; only existing CRLF conversion warnings were emitted.

### Manual QA

- Not required for the source-diagram update. The new file has not been manually opened in diagrams.net.

### Intentionally Not Changed

- Desktop Agent runtime, Windows installer, Browser Extension, API/backend, database, Prisma schema/migrations, authentication, deployment, and frontend behavior.

### Remaining Risk And Suggested Next Step

- The historical `workmap-desktop-agent-0.5.8-runtime.drawio` remains accurate for 0.5.8. Use the new 0.5.9 diagram for the current release and for any future implementation review.

## 2026-07-16 Desktop Agent 0.5.9 Continuous Focus Reporting

### Original Task Brief

- Fix the Reports Apps list so a continuously used Desktop Agent application does not appear briefly and then disappear, and so durable App usage accumulates for every application used during the selected report range.

### Changed Files

- `workmap/apps/desktop-agent/src/trackingState.ts`
- `workmap/apps/desktop-agent/test/tracking-state.test.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/src/pairing.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- The root cause was a lifecycle mismatch: the Agent exposed the current foreground App immediately through heartbeat, but did not persist active time until an App switch, idle/lock boundary, shutdown, or day boundary. The report could therefore show a short transient row and then an empty Apps list while work continued.
- `AppTrackingState` now closes and persists a bounded focus-active slice every ten seconds while Windows samples continue to prove activity. Each slice uses the existing durable queue, upload, and server idempotency path; it does not collect a window title, content, input, screenshot, or any new data field.
- Existing visible-window runtime events remain separate from focus-active time. The existing Reports API combines persisted focus summaries with open/runtime-only App rows, so Apps used in the selected range remain available without treating merely open Apps as focused work.
- Reports now checks the lightweight activity revision on the existing five-second live refresh cadence. A newly persisted focus slice replaces transient heartbeat-only data without the prior visible blank period.
- The Windows Agent release version is now `0.5.9` (`desktop-agent-windows/0.5.9`). A new NSIS installer was generated at `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.9.exe`.

### Role And Access Behavior

- No report authorization, tenant filtering, API endpoint, database schema, activity aggregation formula, pairing code, device credential, or employee/owner visibility boundary changed.
- Existing paired 0.5.8 installations retain their local device configuration when 0.5.9 is installed over them; the new build does not require pairing again unless the previous local application data was deliberately removed.

### Verification

- `node_modules/.bin/tsx.CMD --test apps/desktop-agent/test/tracking-state.test.ts`: pass, 11/11.
- `node_modules/.bin/tsx.CMD --test apps/desktop-agent/test/gui-release.test.ts`: pass, 3/3.
- `pnpm.cmd --filter @workmap/desktop-agent typecheck`: pass.
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/api test -- tracking-reports-verification.test.ts`: pass, 17/17.
- `pnpm.cmd --filter @workmap/desktop-agent release:windows`: pass in 60 seconds.
- Artifact existence check: installer is non-empty (91,942,795 bytes) and its blockmap is non-empty.
- `git diff --check`: pass; only existing CRLF conversion warnings were emitted.

### Manual QA

- Not run against a real employee machine in this round. Manual QA should install 0.5.9 over a paired 0.5.8 Agent, keep one App active for more than 30 seconds, switch to another App, and confirm the selected employee report retains both Apps with growing persisted focus time.

### Intentionally Not Changed

- Browser Extension runtime, API/backend source, Prisma schema/migrations, authentication, device pairing rules, database deployment, report scope semantics, and existing frontend styling outside the five-second revision cadence.

### Remaining Risk And Suggested Next Step

- Source changes do not alter an already installed 0.5.8 executable. Publish and install the 0.5.9 installer to receive this Agent runtime fix; no database migration is required.
- The next round can proceed after consolidated paired-device manual QA.

## 2026-07-16 Collapsed Sidebar Control And Icon Styling

### Original Task Brief

- Frontend styling only: improve the poorly positioned expand-navigation button in the collapsed authenticated sidebar, enlarge the rail icons, and make their strokes heavier. Do not change any other behavior.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Moved the collapsed sidebar expand button fully inside the 76px rail and placed it below the WorkMap logo, instead of leaving it floating across the sidebar/content boundary.
- Enlarged the expand button to `46x42px`, its icon to `23px`, and its stroke to `2.35`.
- Added reserved top spacing before the collapsed navigation links so the relocated button cannot overlap the first navigation item.
- Increased collapsed navigation targets from `46px` to `50px`, enlarged navigation icons to `24px`, and increased their stroke to `2.3`.
- Enlarged and thickened the collapsed logout icon consistently.
- All changes are limited to collapsed desktop sidebar CSS selectors.

### Role And Access Behavior

- No role filtering, navigation items, routing, authentication, session behavior, click handlers, ARIA labels, or permissions changed.

### Verification

- `pnpm.CMD --filter @workmap/web typecheck`: pass.
- `pnpm.CMD --filter @workmap/web lint`: pass.
- `pnpm.CMD --filter @workmap/web build`: pass; existing Next.js ESLint-plugin warning only.
- `git diff --check`: pass (line-ending conversion warnings only; no whitespace errors).
- Scoped secret scan of the changed stylesheet and handoff files: pass; no matches.

### Manual QA

- The local site was opened successfully, but `/dashboard` redirected to the public homepage because the local browser had no authenticated workspace session. The collapsed authenticated rail was therefore not visually inspected in-browser during this round.

### Intentionally Not Changed

- React/TSX components, sidebar state persistence, routes, data fetching, backend, API, database, RBAC, Desktop Agent, Browser Extension, and responsive mobile behavior.

### Remaining Risk And Suggested Next Step

- Refresh any authenticated desktop page, collapse the sidebar, and confirm the new under-logo button placement at the normal desktop viewport. The CSS selectors are scoped away from the mobile layout, where the toggle is already hidden.
- The next round can proceed after that visual confirmation.

## 2026-07-16 Desktop Agent 0.5.8 Runtime Diagram

### Original Task Brief

- Explain the real WorkMap Desktop Agent `0.5.8` runtime behavior and provide a Draw.io diagram.

### Changed Files

- `docs/designs/workmap-desktop-agent-0.5.8-runtime.drawio`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added a two-page Draw.io source file based on the current Electron entry point, Windows foreground adapter, tracking state machine, durable queues, API client, credential store, and status lifecycle code.
- Page one covers startup, pairing, DPAPI-protected credential storage, Windows sampling, activity segmentation, durable queues, device API uploads, and Reports visibility.
- Page two covers client-visible status transitions, power events, shutdown/crash recovery, retry classification, queue acknowledgement, and bounded retry behavior.
- The diagram explicitly records the privacy boundary: normalized application name and duration are collected; window titles, document contents, screenshots, keystrokes, clipboard, and credentials are not collected.

### Verification

- Draw.io XML parsed successfully: two pages and 88 cells.
- `git diff --check`: pass.
- Credential-pattern scan of the diagram: pass.

### Manual QA

- Not required for a documentation-only diagram artifact. The diagram has not been manually opened in diagrams.net yet.

### Intentionally Not Changed

- Desktop Agent runtime code, Electron UI, backend APIs, Prisma schema/migrations, credentials, Desktop Agent package/release version, Browser Extension, and deployment.

### Remaining Risk

- The Draw.io diagram is a code-derived explanation, not an executable runtime trace. Production network timing and operating-system-specific edge cases remain subject to normal runtime verification.

## 2026-07-16 5432 Session-Pool Throughput and Page Request Scope

### Original Task Brief

- After Supabase session-pool capacity was raised to 48, keep `:5432`, safely loosen the API's database concurrency, and combine it with the existing frontend cache so authenticated pages load faster without changing product behavior.

### Changed Files

- `workmap/apps/api/src/modules/prisma/prisma.service.ts`
- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/test/prisma-runtime-url.test.ts`
- `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx`
- `workmap/apps/web/app/employees/page.tsx`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Supabase `:5432` session-pool URLs now default to eight Prisma connections per API instance rather than one. The cap leaves capacity for Render's overlapping deployment instance and other operational connections; it does not consume all 48 Supabase pool slots.
- An explicit `connection_limit` already present in `DATABASE_URL` remains authoritative. `WORKMAP_PRISMA_CONNECTION_LIMIT` can deliberately override the runtime value only when set to an integer from 1 through 16; no new environment variable is required for the default of eight.
- Independent Reports aggregates, coverage reads, activity-revision checks, Browser Extension coverage reads, and current-Agent status reads now run concurrently rather than serially. Response shapes, calculations, tenant filtering, role checks, and optional-section fallbacks are unchanged.
- Dashboard and Employees now request only their displayed report aggregate. They continue to load the existing dedicated live-status endpoint, but no longer also request duplicate live coverage or audit history from the usage-summary endpoint.
- This compounds the existing browser memory caches: returns to the shell and Reports can render cached data immediately, while the API can service unavoidable fresh reads without the previous one-connection serialization.

### Verification

- `pnpm.cmd --filter @workmap/api test`: pass (`17/17`).
- `pnpm.cmd --filter @workmap/api typecheck`: pass.
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `git diff --check`: pass before and after the scoped code change.

### Manual QA

- Not run against production. Confirm login, Dashboard, Employees, and Reports response times after deploying both API and web changes.

### Intentionally Not Changed

- Prisma schema/migrations, Supabase schema, API response contracts, Cognito, RBAC, tenant isolation, reports calculations, Desktop Agent, Browser Extension, deployment settings, and production credentials.

### Remaining Risk

- A first-time load, cache expiry, new filter, or actual activity revision still requires current server data. If production monitoring later shows a sustained need for more than eight Prisma connections per Render instance, the bounded runtime override can be adjusted without changing code; it should not be set to the Supabase pool total.

## 2026-07-16 Reports In-Tab Snapshot Reuse

### Original Task Brief

- When navigating away from `/reports` and returning, show the most recent report immediately while live status and changed aggregates refresh in the background. Do not change backend, database, deployment, Desktop Agent, Browser Extension, or report calculations.

### Changed Files

- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/components/reports/reportSnapshotCache.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added a memory-only report snapshot cache scoped by signed-in user, role, auth source, report scope, department, and UTC date range.
- A fresh snapshot renders immediately on a return to `/reports`; it is never written to browser storage or disk.
- Live Agent/Extension status still refreshes in the background. Historical aggregation refreshes only when the existing activity-revision check is due and detects a change.
- User audit data is reused for up to one minute before it is refreshed in the background, preventing audit history from blanking during a refresh.
- The cache keeps at most 20 snapshots and expires after five minutes without activity.
- Clicking **Apply filters** still clears the preceding view and shows the existing WorkMap loader for the newly selected scope/range.

### Verification

- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `git diff --check`: pass.
- Secret scan: pass; no secrets found in changed source or handoff files.

### Manual QA

- Not run. Browser navigation behavior remains pending manual confirmation.

### Intentionally Not Changed

- API contracts, reports calculations, Cognito, backend, Prisma schema/migrations, production configuration, Desktop Agent, Browser Extension, and deployment.

### Remaining Risk

- The first visit, an expired snapshot, a changed report revision, or a new filter selection still needs the normal server report query. The browser does not manufacture or persist report data.

## 2026-07-16 Web Request Scope and Reports Load Sequencing

### Original Task Brief

- Reduce avoidable frontend requests so each authenticated page prioritizes its own data without changing backend, database, deployment, Desktop Agent, Browser Extension, report calculations, or permission behavior.

### Changed Files

- `workmap/apps/web/lib/api/apiAuth.ts`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/layout/appShellCache.ts`
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/components/reports/reportFilters.ts`
- `workmap/apps/web/test/app-shell-cache.test.ts`
- `workmap/apps/web/test/reports-filter-persistence.test.ts`
- `workmap/apps/web/test/reports-information-order.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Successful Cognito-to-WorkMap API context mappings are now shared in memory for 60 seconds; failed mappings remain uncached.
- `AppShell` now reuses a fresh, per-user cached workspace or platform shell context for up to five minutes. Intra-app navigation no longer re-requests `/auth/me`, `/companies/current`, and `/users/me` merely to redraw the shared navigation shell.
- The workspace and platform cache entries are intentionally separated so a Platform Admin cache cannot satisfy a tenant workspace shell, or vice versa.
- `/reports` now requests its required usage summary before the Owner-only directory. The directory remains loaded for employee-filter controls, but it no longer delays the first report response.
- Live agent-status polling starts only after the initial report and any required Owner directory request have settled, avoiding the previous startup burst of summary, directory, and live-status reads against the same API/database pool.
- Existing report endpoints, role checks, query parameters, polling interval, exports, calculations, and displayed data contracts remain unchanged.

### Role and Access Behavior

- The browser cache only controls whether the shared navigation labels are re-read. Server-side authentication, tenant isolation, and role enforcement remain authoritative for every report request.
- A saved Owner employee filter remains valid during the short period before the directory finishes loading; the reports API remains the authority for rejecting inaccessible users.

### Verification

- `pnpm.cmd --filter @workmap/web test`: pass (`69/69`).
- `pnpm.cmd --filter @workmap/web lint`: pass.
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/web build`: pass. Next.js reported only its existing ESLint-plugin configuration warning.
- `git diff --check`: pass.
- Secret scan excluding environment files and generated directories: pass.

### Manual QA

- Not run in a browser or against production during this local frontend-only change.

### Intentionally Not Changed

- Backend code, Prisma schema/migrations, Render or Supabase configuration, API contracts, Cognito behavior, Desktop Agent, Browser Extension, report aggregation, and production deployment.

### Remaining Risks

- The first authenticated application load and any cache expiry still perform the minimum identity/company reads required to render the shared shell.
- Shell labels can remain cached for up to five minutes; permission-sensitive requests are not cached by this change and still receive normal server-side enforcement.

## 2026-07-16 Render Zero-Downtime Session-Pool Recovery

### Original Task Brief

- Resolve the repeated Render deployment failure after the API already limits its own Supabase `:5432` session-pool usage.

### Changed Files

- `workmap/apps/api/src/main.ts`
- `workmap/apps/api/src/modules/prisma/prisma.service.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Removed the blocking Prisma connection attempt from Nest module initialization, so the API can bind its Render port before attempting database recovery.
- After the HTTP server is listening, Prisma performs the same bounded transient connection retry in the background. This allows Render to retire the previous instance and release its Supabase session connection instead of creating a replacement deadlock.
- `/health/readiness` still executes a real database query and returns `503 not_ready` until the database connection is available; `/health` remains the process liveness endpoint.

### Intentionally Not Changed

- Supabase connection host/port configuration, database schema, migrations, API contracts, reports behavior, Cognito, Desktop Agent, and Browser Extension.

### Verification

- `pnpm.cmd --filter @workmap/api test`: pass (`17/17`).
- `pnpm.cmd --filter @workmap/api typecheck`: pass.
- `pnpm.cmd --filter @workmap/api lint`: pass.
- `pnpm.cmd --filter @workmap/api build`: pass.

### Manual QA

- Pending a Render deployment. Keep `DATABASE_URL` on the existing Supabase pooler port `5432`.

### Remaining Risk

- If a Render health-check path has been manually set to `/health/readiness`, it will correctly remain unhealthy until a session is freed. The Render service must use `/health` or no explicit health-check path for zero-downtime replacement.

## 2026-07-16 Render Session Pool Startup Recovery

### Original Task Brief

- Fix the Render API deployment failure while retaining the Supabase session-pool connection on port `5432`.

### Changed Files

- `workmap/apps/api/src/modules/prisma/prisma.service.ts`
- `workmap/apps/api/test/prisma-runtime-url.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Supabase pooler URLs on port `5432` now keep session-pool semantics and receive a bounded Prisma `connection_limit=1` plus `pool_timeout=30` when those values are not explicitly configured.
- The transaction-pooler branch for port `6543` remains supported, but it is no longer required for this deployment; its default Prisma limit is bounded to two connections.
- Prisma startup retries only transient connection-capacity or reachability failures three times with short bounded delays. Invalid URLs, credentials, and schema problems still fail immediately.

### Intentionally Not Changed

- Database schema, migrations, Render environment variables, API contracts, Cognito, Reports UI, Desktop Agent, and Browser Extension.

### Verification

- `pnpm.cmd --filter @workmap/api test`: pass (`17/17`).
- `pnpm.cmd --filter @workmap/api typecheck`: pass.
- `pnpm.cmd --filter @workmap/api build`: pass.

### Manual QA

- Not run against Render from this coding environment. The next Render deploy must retain the existing Supabase pooler host and port `5432` in `DATABASE_URL`.

### Remaining Risk

- If 15 session-pool clients are already held by other external tools or services, the API cannot acquire even its single connection until one frees. The bounded retry avoids an immediate transient deployment failure but cannot bypass Supabase's global cap.

## 2026-07-16 Reports 500 Resilience

### Original Task Brief

- Investigate recurring production `500 Internal server error` responses from `/reports/usage-summary` and prevent optional tracking/audit reads from taking down the complete Owner or employee report.

### Changed Files

- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/test/tracking-reports-verification.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Replaced the wide, nested `Promise.all` fan-out in usage-summary assembly with bounded, ordered report reads. This avoids a single report request attempting many simultaneous Prisma operations while the Supabase transaction pooler has a small connection budget.
- App and domain summary tables remain required report data. Live current-app/domain enrichment, device coverage, status history, session audit, timeline, and activity-revision reads are isolated as optional sections.
- If an optional tracking query is unavailable during a partial rollout or transient database failure, the API returns the core historical report and an empty value for that affected enrichment instead of returning HTTP 500 for the entire report.
- Required summary failures now log a safe section label and Prisma/Nest error code; optional fallbacks log the affected section and code. Raw database URLs, credentials, bearer tokens, and raw database errors are not logged by this handling.
- Added a regression test that simulates optional activity/status query failures and proves the report summary still responds.

### Role and Access Behavior

- Owner/company aggregation, employee own-report scope, tenant isolation, audit logging of sensitive report access, and platform boundaries are unchanged.

### Verification

- `pnpm.cmd --filter @workmap/api typecheck`: pass.
- `pnpm.cmd --filter @workmap/api test`: pass (`16/16`).
- `pnpm.cmd --filter @workmap/api lint`: pass.
- `pnpm.cmd --filter @workmap/api build`: pass.
- `git diff --check`: pass (line-ending warnings only).

### Manual QA

- Not run against the production Render service in this coding environment.

### Intentionally Not Changed

- Prisma schema, migrations, Supabase configuration, Render configuration, API routes/contracts, Cognito, Desktop Agent, Browser Extension, report calculations, and Web UI.

### Remaining Risk

- A failure in the required `AppUsageSummary` or `WebsiteUsageSummary` aggregation will still correctly return an error because there is no truthful historical report to render. The API now logs the exact required section and code for that case.

## 2026-07-16 Invitation Activity Panel Spacing

### Original Task Brief

- Rework the Recent invitations panel accent and missing padding. Confirm whether its amber line represents invitation capacity before changing it.

### Repository Finding

- It is not an invitation quota or seat-usage indicator. `InvitationsService.create()` creates tenant-scoped invitations without a capacity check, and `/onboarding/invite` receives only the invitation list. The existing amber line was decorative only.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/invite-list-panel-layout.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- The top-edge amber bar is replaced by an inset vertical access marker beside the panel heading, plus a subtle decorative dot rule on the opposite side. It no longer resembles a progress bar.
- The dark invitation panel now has responsive internal padding, and every invitation row has a larger, consistent `16px` inset.
- At the mobile breakpoint, panel padding reduces to `18px` and the marker stays aligned with the smaller inset.

### Verification

- `pnpm.cmd --filter @workmap/web test`: pass (`65/65`).
- `pnpm.cmd --filter @workmap/web typecheck`: pass.
- `pnpm.cmd --filter @workmap/web lint`: pass.
- `pnpm.cmd --filter @workmap/web build`: pass. Existing Next ESLint-plugin configuration warning only.
- Scoped invitation-panel credential scan: pass; no credential-like values found.

### Intentionally Not Changed

- Invitation limits, seat/capacity logic, API responses, owner authorization, invitation creation/acceptance behavior, backend, database, deployment, Desktop Agent, Browser Extension, and tracking behavior.

## 2026-07-15 Collapsible Workspace Sidebar

### Original Task Brief

- Add a visually coherent collapsible left navigation for the Reports workspace without changing product behavior.

### Changed Files

- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/app-shell-sidebar.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Desktop authenticated pages now provide a compact toggle on the right edge of the workspace sidebar.
- The collapsed state is a 76px icon rail with clear active styling, native labels, and keyboard-visible tooltips; the selected state and all role-filtered navigation links remain intact.
- The visual preference is stored only in browser local storage. At `1024px` and below, the existing complete responsive navigation is restored; the smaller horizontal mobile navigation remains label-based and scrollable.

### Verification

- `pnpm --filter @workmap/web test`: pass (`64/64`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.
- `git diff --check`: pass.

### Intentionally Not Changed

- Routes, navigation permissions, authentication, API/data fetching, reports behavior, backend, database, deployment, Desktop Agent, Browser Extension, and tracking behavior.

## 2026-07-15 Reports Loader Unframed Avatar

### Original Task Brief

- Adjust only the Reports loading visual so the pixel avatar has no inner white bordered frame.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/reports-information-order.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- The Reports-only selected-report loader now removes the nested Loader border, rounded container, background, and fixed inner height.
- The report loading panel still centers the existing animated pixel avatar and loading label, without changing request, loading, or report-rendering behavior.

### Verification

- `pnpm --filter @workmap/web test`: pass (`62/62`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.

### Intentionally Not Changed

- Loading logic, Reports data/API behavior, backend, database, deployment, authentication, Desktop Agent, Browser Extension, and every non-Reports Loader.

## 2026-07-15 Mobile Workspace Navigation Refinement

### Original Task Brief

- Adjust only the mobile workspace navigation styling: replace the selected tab treatment and make horizontal navigation scrollability obvious.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/mobile-navigation-style.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- At `760px` and below, workspace navigation uses fixed-width, scroll-snapped pill tabs with a visible thin teal scrollbar and a non-interactive `More >` affordance.
- The selected tab is now a high-contrast light pill; the desktop sidebar marker is hidden only in the mobile treatment.
- Labels remain centered within bounded tab widths and all navigation links, routes, role filtering, and handlers are unchanged.

### Verification

- `pnpm --filter @workmap/web test`: pass (`61/61`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.

### Intentionally Not Changed

- Navigation data, routes, authentication, backend, API contracts, database, deployment, Desktop Agent, Browser Extension, and tracking behavior.

## 2026-07-15 Reports Live And Audit Section Spacing

### Original Task Brief

- Adjust only the frontend spacing of the Reports live-signals and connection-audit sections so their content no longer sits against the outer frame.

### Changed Files

- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/reports-information-order.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- The two Reports sections now use a dedicated visual class with `24px` desktop padding.
- Their padding reduces to `16px` at `640px` and below, retaining readable card spacing without constraining the responsive two-column layout or audit-list scroll areas.

### Verification

- `pnpm --filter @workmap/web test`: pass (`59/59`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.

### Intentionally Not Changed

- Reports data, tracking/client behavior, APIs, backend, database, deployment, authentication, and any non-Reports page behavior.

## 2026-07-15 Reports Filter Refresh Loading State

### Original Task Brief

- Change only the Reports frontend so applying filters replaces the old report interface with the existing WorkMap pixel-avatar loading state until the selected report arrives.

### Changed Files

- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/reports-information-order.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- During the initial report request or an Apply filters refresh, the area below the controls now renders only the existing `WorkMapLoader` pixel avatar and the label “Loading selected report”.
- Previous live status, audit, trends, and API summary content is withheld until the new response succeeds, preventing it from being mistaken for the selected range.
- CSV/TXT export controls are disabled while loading, and the displayed reporting-range text no longer refers to the previous summary.

### Verification

- `pnpm --filter @workmap/web test`: pass (`58/58`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.

### Manual QA

- Not run in this coding environment.

### Intentionally Not Changed

- Backend, API contracts, database/schema/migrations, deployment configuration, authentication, report calculations, Desktop Agent, Browser Extension, and tracking behavior.

### Remaining Risk

- This change deliberately represents the selected-report request as loading; an API failure still replaces the loader with the existing report-error state.

## 2026-07-15 Login And Reports Request Latency Stabilisation

### Original Task Brief

- Investigate the unusually slow Cognito login and Reports loading path after the Supabase pooler production incident, without changing tenant, Cognito, RBAC, report semantics, or tracking-client behaviour.

### Changed Files

- `workmap/apps/web/lib/api/apiAuth.ts`
- `workmap/apps/web/test/api-auth-cache.test.ts`
- `workmap/apps/web/app/login/callback/page.tsx`
- `workmap/apps/web/components/login/CognitoLoginPanel.tsx`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/api/src/modules/prisma/prisma.service.ts`
- `workmap/apps/api/test/prisma-runtime-url.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Protected Web surfaces now coalesce concurrent `/auth/me` mapping checks for the same Cognito user and reuse only a confirmed successful mapping for eight seconds.
- Temporary backend, network, or token failures are never cached as an unavailable workspace and never route an existing user into company or avatar onboarding.
- Login callback and the existing-session login panel resolve the normal workspace mapping first, then check Platform Admin only as a fallback for an unmapped account; real user data is fetched only after a confirmed workspace mapping.
- Standard tenant routes no longer call the Platform Admin endpoint merely to receive an expected `403`; that endpoint is checked only on `/platform-admin`.
- The API keeps Supabase Transaction Pooler (`6543`) Prisma parameters bounded and PgBouncer-compatible, with a conservative pool of four connections per API process rather than two, allowing Reports' existing parallel aggregate queries to complete with less local queueing.

### Verification

- `pnpm --filter @workmap/web test`: pass (`57/57`).
- `pnpm --filter @workmap/web typecheck`: pass.
- `pnpm --filter @workmap/web lint`: pass.
- `pnpm --filter @workmap/web build`: pass.
- `pnpm --filter @workmap/api test`: pass (`16/16`).
- `pnpm --filter @workmap/api typecheck`: pass.
- `pnpm --filter @workmap/api lint`: pass.
- `pnpm --filter @workmap/api build`: pass.
- Warm production `GET /health`: `200` in approximately `656ms`; authenticated production timing was not run because no user credential was inspected or emitted.
- `git diff --check`: pass.

### Manual QA

- Not run in this coding environment. Production redeploy and an owner login/Reports check remain required.

### Intentionally Not Changed

- Cognito provider/configuration, tenant records, onboarding data, database schema/migrations, Reports aggregation semantics, Desktop Agent, Browser Extension, and any production credentials.

### Remaining Risk

- A Render Starter service can still have a cold-start delay after inactivity; this code removes avoidable Web/API request latency but cannot remove hosting sleep without an infrastructure/plan change.
- Existing local `workmap/apps/web/tsconfig.tsbuildinfo` was regenerated by typecheck and remains uncommitted generated cache output.

### Suggested Next Step

- Deploy the API and Web changes together, keep Render `DATABASE_URL` on the Supabase Transaction Pooler port `6543`, and validate one owner login plus one Reports load on the deployed build.

## 2026-07-11 Product Pages Visual Direction V1

### Original Task Brief

- Create one visual design for every remaining WorkMap frontend page using the approved homepage identity.

### Changed Files

- `docs/designs/workmap-product-pages-v1.html`
- `docs/designs/workmap-product-pages-v1-spec.md`
- `docs/designs/workmap-product-pages-v1/*.png`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Produced 17 desktop visual designs covering every non-homepage route, plus three overview boards.
- Defined three related layouts: editorial authentication/onboarding, compact authenticated workspace, and full-bleed Virtual Office.
- Used only existing repository development fallback data, real layered avatar composites, the real Virtual Office panorama, and real empty/unavailable states.
- Kept Platform Admin visually and conceptually separate from tenant Owner pages.
- No application runtime source, backend, auth, routing, API, schema, tracking, reports, compliance, realtime, or Virtual Office behavior changed.

### Verification

- Embedded design-source JavaScript syntax: pass.
- All 17 page PNGs: `1440 x 1000`, non-empty.
- Visual inspection: completed for all overview boards and the Login, Device Setup, Dashboard, Employees, Reports, Compliance, Virtual Office, Platform Admin, and debug compositions.
- Corrected malformed select-field markup found during visual QA and re-rendered affected invitation, employees, and reports pages.
- `git diff --check`: pass.

### Manual QA

- Design artifacts were visually reviewed; implemented browser QA is not applicable because runtime code was not changed.

### Remaining Risks

- These are desktop V1 designs. Mobile behavior is specified but separate mobile artboards have not been produced.
- No authenticated application styling has been implemented yet.

### Suggested Next Step

- Collect route-by-route visual approval before implementing the shared shell and page styles.

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

---

## 2026-07-11 Product Pages Visual System Implementation

### Original Task Brief

Apply the approved homepage visual direction to the remaining WorkMap frontend pages, including strong responsive behavior, without changing APIs, auth, routing, state, events, forms, RBAC, tenant behavior, or other product logic. Review and test the result, stopping any finite command that exceeds five minutes.

### Changed Files

- Shared visual tokens and cross-page styling: `workmap/apps/web/lib/theme/workmapTheme.ts`, `workmap/apps/web/app/globals.css`, and `workmap/apps/web/app/workspace-redesign.css`.
- Styling hooks only: Avatar Debug, Employee Detail, Integrations, Invitation Acceptance, Cognito Callback, Company/Avatar/Device/Invite onboarding, Platform Admin, and Settings page components.
- Device Setup received one presentation-only wrapper around its two existing pairing panels; all handlers, conditions, payloads, and copy remain unchanged.
- Existing product-page visual specifications and route boards under `docs/designs/workmap-product-pages-v1*` remain the approved visual reference.

### Implementation Summary

- Replaced the previous navy/mint generic SaaS treatment with the approved Ink Navy `#080D22`, Signal Jade `#27E0A2`, Civic Amber `#F7B731`, paper, coral, and calm neutral system.
- Converted authenticated pages to a compact Ink desktop sidebar with role-aware existing navigation; tablet uses a compact grid and phone layouts use a horizontal scroll navigation strip.
- Unified Dashboard, Employees, Employee Detail, Reports, Compliance, Integrations, Settings, Invite Management, Platform Admin, login/callback, invitation acceptance, all onboarding screens, Avatar Debug, and Virtual Office chrome.
- Removed gradients, oversized radii, heavy shadows, and marketing-like floating card treatment from the product system. Panels use 4-8px radii, restrained borders, denser tables, and role/status accents.
- Login uses the real `public/marketing/workmap-virtual-office-panorama.png` asset. No fake dashboard, employee, report, compliance result, or product statistic was introduced.
- Added explicit responsive composition at 1024px, 760px, and 420px plus reduced-motion handling. Tables remain scrollable rather than shrinking text below readable sizes.

### Role And Behavior Boundaries

- No API, backend, Prisma, auth/Cognito, invitation, tenant, RBAC, Platform Admin, report calculation, compliance calculation, data-fetching, state-management, event-handler, routing, or form-submission behavior changed.
- Existing role-aware navigation and Platform Admin privacy separation are preserved.

### Verification

- Changed TSX/theme source parse: passed for 12 files.
- CSS parse and static design assertions: passed; desktop/tablet/mobile/reduced-motion rules exist, no gradient remains in the new product stylesheet, the real map asset is referenced, and new radii remain bounded.
- Targeted ESLint for all changed TSX/theme files: passed.
- Isolated QA copy using the Git HEAD `authApi.ts`: web typecheck passed, web lint passed, 38/38 web tests passed, and the final Next production build passed with 19 routes.
- Source worktree full typecheck/lint/test/build are blocked only by the pre-existing `workmap/apps/web/lib/api/authApi.ts` file containing 410 NUL bytes. That unknown file was not overwritten.
- `git diff --check`: passed during implementation closeout.

### Manual And Visual QA

- Browser capture at desktop/mobile viewports was attempted against the isolated successful build, but the in-app Browser security policy rejected the local target. No alternate browser or policy bypass was used.
- Rendered pixel fidelity and interactive visual QA therefore remain blocked, not passed. Source-level responsive review and production compilation do not replace the final rendered inspection.

### Intentionally Not Changed

- Homepage runtime/markup, backend services, API contracts, Prisma, auth, business logic, package versions, and cloud deployment were not changed.
- The pre-existing `authApi.ts` NUL corruption was preserved in the source worktree.

### Remaining Risk

- Exact rendered spacing, text wrapping, focus appearance, and map chrome at 360/390/768/1024/1440 still require a browser session that permits the local application URL, after the existing `authApi.ts` corruption is resolved or explicitly approved for restoration.

---

## 2026-07-13 Workspace Navigation Loading Reduction

### Original Task Brief

Investigate and, only if it does not affect functionality, remove the multi-second full-page `Opening your workspace` loader shown when switching authenticated workspace tabs.

### Changed Files

- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/layout/appShellCache.ts`
- `workmap/apps/web/test/app-shell-cache.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Identified two causes: `AppShell` always initialized its loading state to `true`, even when the cache already held a summary for the current Cognito subject; workspace navigation also used native anchors, forcing full document navigation.
- A warm, current-subject cache now dismisses the AppShell loader in `useLayoutEffect` before the shell paints. The existing async authentication, current-company, current-user, platform-context, redirect, and cache-refresh flows still run unchanged in the background.
- Replaced internal AppShell anchors with Next `Link` components. They preserve the same URLs, active-state logic, role filtering, browser link semantics, and logout behavior while allowing route prefetch/client navigation.
- First visit, missing cache, expired/missing Cognito session, unsuccessful backend mapping, and sign-out continue to use their existing loader/redirect behavior.

### Role And Access Behavior

- No authorization result is sourced from the cache. Existing API auth and role/company validation remain authoritative and run on every AppShell mount.
- No API, backend, Cognito, RBAC, tenant, navigation visibility, state payload, or business-rule behavior changed.

### Verification

- Focused new cache test: passed, 2/2.
- Isolated QA copy with the valid tracked `authApi.ts`: web typecheck passed, lint passed, 40/40 web tests passed, and production build passed with 19 routes.
- The source worktree still contains the pre-existing 410-NUL `authApi.ts` corruption, so its package-wide typecheck/lint/test/build remain independently blocked; that file was not modified.

### Manual QA

- Not run. The observed symptom is addressed through deterministic cache/render and internal-link behavior; browser visual QA remains subject to the existing local-browser policy block.

### Intentionally Not Changed

- No data requests were removed, deferred, or changed. No page-level loader, report/employee loading behavior, Virtual Office gate, or authentication redirect was altered.

### Remaining Risk

- A first workspace visit still correctly displays the loader while the required initial auth/context read resolves. Any remaining wait on first visit is a real authentication/network cost, not the repeated cached-tab wait addressed here.

---


---

## 2026-07-13 Dashboard Hero And Rounded Button Responsive Pass

### Original Task Brief

Redesign the empty Dashboard banner using only genuine current workspace data. Make buttons consistently rounded across the website and prevent button text from overflowing at every responsive size, without changing product functionality.

### Changed Files

- `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx`
- `workmap/apps/web/lib/theme/workmapTheme.ts`
- `workmap/apps/web/components/ui/WorkMapButton.tsx`
- `workmap/apps/web/app/globals.css`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/dashboard-hero-button-layout.test.ts`
- Handoff files.

### Implementation Summary

- Rebuilt the Dashboard hero as an Ink Navy workspace overview with a real signal board: Session, Presence, Device coverage, and Policy. Values are derived from the existing Dashboard state; unavailable data is labelled honestly instead of being replaced with examples.
- Hero internal navigation now uses existing Next client routing. No action URL or role-dependent action list changed.
- Added a shared 12px button radius token, applied it to primary/secondary/ghost/danger buttons, native button controls, styled action anchors, and mobile action layouts.
- Added shared max-width, minimum-width, wrapping, and overflow rules for action labels. Dashboard hero actions stack to full width on narrow screens; its signal board collapses to one column at 420px.

### Role And Behavior Boundaries

- No Dashboard request, report calculation, permission check, data field, API call, tenant scope, route, or action handler changed.
- The hero exposes only the same session, positions, coverage, and policy state already loaded for the Dashboard.

### Verification

- Focused cache and Dashboard/button responsive tests: passed, 4/4.
- Isolated QA copy using valid tracked auth client: web typecheck passed, lint passed, 42/42 tests passed, and production build passed with 19 routes.
- Source worktree full verification remains blocked by the existing 410-NUL `authApi.ts`; that file was not changed.

### Manual QA

- Not run. Browser-rendered viewport inspection remains blocked by the existing in-app local-target policy.

### Intentionally Not Changed

- No fake metrics, illustration, backend, auth, API, data-fetching, state-management, RBAC, or mobile business workflow was added or changed.

### Remaining Risk

- The automated responsive contract prevents button-label overflow in the shared design paths. Exact visual spacing on all supported physical devices still requires the final browser viewport QA session.

---

## 2026-07-13 Invite Ledger Visual Refinement

### Original Task Brief

Redesign the `/onboarding/invite` Recent invitations area so it no longer uses a white background, while preserving the invitation workflow and providing a safe responsive layout.

### Changed Files

- `workmap/apps/web/app/onboarding/invite/page.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/invite-list-panel-layout.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Replaced the generic white Recent invitations card with a dedicated Ink Navy workspace-access ledger, including an Amber rule, Jade label, and darker invitation records.
- Each invitation now uses semantic visual hooks for the email, existing role/status text, and existing expiry text. No invitation payload, formatting source, action, request, or permission behavior changed.
- Long emails and status text can wrap safely. At `760px` and below, the existing invite page becomes one column and each ledger row changes to a readable email/status/expiry stack.

### Verification

- Invite-page lint passed for `page.tsx` and its new responsive-layout test.
- Focused Dashboard and invitation responsive contract tests passed, 4/4.
- Source-worktree typecheck remains blocked by the existing 410-NUL `apps/web/lib/api/authApi.ts` file; it was not modified.

### Manual QA

- Not run. Rendered local-browser verification remains blocked by the existing in-app Browser local-target policy.

### Intentionally Not Changed

- No invitation creation, list retrieval, error handling, authentication, owner-only authorization, API contract, routing, or data model behavior changed.

### Remaining Risk

- Exact rendered spacing and hover feedback at physical device widths still need the deferred browser visual QA session after the existing source corruption/browser policy limitations are resolved.

---

## 2026-07-13 Dashboard Light Signal-Map Banner

### Original Task Brief

Redesign the `/dashboard` banner to follow the provided light workspace-reference composition while remaining consistent with WorkMap's Ink/Jade/Amber visual system and responsive behavior.

### Changed Files

- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/dashboard-hero-button-layout.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Reworked the existing Dashboard hero into a light editorial workspace surface: dark Ink title/copy, Jade primary action, Amber structural rules, and a right-hand Signal Map.
- The Signal Map still renders only the existing Session, Presence, Device coverage, and Policy values. It now uses a pale Jade field, restrained map-path guides, and readable light cards instead of the previous dark block.
- The desktop composition becomes one column at `1024px`; action controls retain full-width stacking at `760px`, and signal cards remain single-column at `420px`.

### Role And Behavior Boundaries

- The existing role-specific title, subtitle, actions, status derivation, navigation targets, API reads, and authorization behavior remain unchanged.
- No illustration asset, fake workspace metric, backend field, API contract, or state-management logic was added.

### Verification

- Targeted Dashboard/Invite lint passed.
- Focused cache, Dashboard, and Invite responsive contract tests passed, 6/6.
- `git diff --check` passed.
- Source-worktree typecheck remains blocked by the pre-existing 410-NUL `apps/web/lib/api/authApi.ts` file; it was not modified.

### Manual QA

- Not run. Rendered local-browser verification remains blocked by the existing in-app Browser local-target policy.

### Intentionally Not Changed

- No Dashboard data, loading behavior, authentication, access control, report calculation, navigation behavior, or button action changed.

### Remaining Risk

- Exact rendered spacing, hover behavior, and 360/390/768/1024/1440 visual fidelity require the deferred browser visual QA session.

---

## 2026-07-13 Dashboard Top Apps Progressive Disclosure

### Original Task Brief

Change the Dashboard Top apps list into a collapsed card that initially shows six rows and expands all rows only after the user clicks Show more.

### Changed Files

- `workmap/apps/web/components/dashboard/UsageTable.tsx`
- `workmap/apps/web/components/dashboard/AppUsageTable.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/usage-table-collapse.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added optional progressive disclosure to the shared usage table. It renders the first six rows by default, displays a rounded Show more control only when additional rows exist, and Show less restores the compact view.
- The initial change enabled `AppUsageTable`; the immediately following Domain follow-up enables the same behavior for `WebsiteUsageTable`.
- The control changes local presentation state only. It does not fetch, sort, filter, mutate, or hide any report data from the underlying Dashboard state.
- Added `aria-expanded` and `aria-controls`; narrow usage rows keep name, duration, and share readable at `420px` and below.

### Verification

- Targeted Dashboard lint passed.
- Focused cache, Dashboard, Invite, and usage-table tests passed, 8/8.
- Source-worktree typecheck remains blocked by the existing 410-NUL `apps/web/lib/api/authApi.ts` file; it was not modified.

### Manual QA

- Not run. Rendered local-browser verification remains blocked by the existing in-app Browser local-target policy.

### Intentionally Not Changed

- No reports API request, report calculation, ordering, activity record, Dashboard authorization, tenant scope, or domain list behavior changed.

### Remaining Risk

- Exact button and list expansion motion at physical viewport sizes require the deferred browser visual QA session.

---

## 2026-07-13 Dashboard Top Domains Progressive Disclosure

### Original Task Brief

Make the Dashboard Top domains from Reports API card use the same collapsed-card behavior as Top apps.

### Changed Files

- `workmap/apps/web/components/dashboard/WebsiteUsageTable.tsx`
- `workmap/apps/web/test/usage-table-collapse.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Enabled the existing shared UsageTable six-row progressive-disclosure option for `WebsiteUsageTable`.
- Top domains now defaults to six rows and uses the same rounded Show more/Show less control, accessibility attributes, data order, and responsive row layout as Top apps.

### Verification

- Targeted Dashboard lint passed.
- Focused Dashboard, Invite, and usage-table tests passed, 6/6.
- Source-worktree typecheck remains blocked by the existing 410-NUL `apps/web/lib/api/authApi.ts` file; it was not modified.

### Manual QA

- Not run. Rendered local-browser verification remains blocked by the existing in-app Browser local-target policy.

### Intentionally Not Changed

- No domain data, API request, query, calculation, sorting, tenant scope, or Dashboard authorization behavior changed.

### Remaining Risk

- Exact rendered expand/collapse behavior remains subject to the deferred browser visual QA session.

---

## 2026-07-14 Reports UTC Boundary And Tracking Reliability Repair

### Original Task Brief

Investigate the production `/reports` failure seen in the morning, then strictly review the Desktop Agent monitoring and reporting path so the identified failure class cannot recur.

### Root Cause

- The Web report filter used the browser's local calendar date while the API validates report ranges against the UTC reporting date.
- In an Australian early-morning session, the browser submitted the local next day while the API was still on the prior UTC day. Both `/reports/usage-summary` and `/reports/agent-status` correctly rejected that range with HTTP 400.
- The observed `/platform/me` HTTP 403 is not part of the report failure: an Owner bearer token is correctly denied from the Platform Admin endpoint.

### Changed Files

- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/components/reports/reportFilters.ts`
- `workmap/apps/web/lib/api/apiClient.ts`
- `workmap/apps/web/test/reports-api.test.ts`
- `workmap/apps/web/test/reports-filter-persistence.test.ts`
- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/test/report-date-boundary.test.ts`
- `workmap/apps/api/test/tracking-reports-verification.test.ts`
- `workmap/apps/desktop-agent/src/runtime.ts`
- `workmap/apps/desktop-agent/test/queue-api.test.ts`

### Implementation Summary

- Unified Report defaults, quick presets, max selectable date, and persisted-filter validation on the same UTC reporting date used by the API.
- A locally persisted future range now safely falls back to the current UTC range before any request is sent.
- The API error surface retains a bounded, credential-redacted validation detail, so a future validation issue is diagnosable instead of only showing a generic HTTP status.
- Report live revisions now include both Desktop Agent app events and Browser Extension domain events. A currently open report refreshes when either client produces new activity.
- A graceful Desktop Agent shutdown now writes its final local state as `offline` after session close and queue flush, avoiding a stale `connected` status in the local Agent UI.
- Restored the locally NUL-corrupted `apps/web/lib/api/authApi.ts` working copy to the valid tracked source. It now has no NUL bytes and matches `HEAD`, so it is intentionally absent from the final source diff while Web typecheck/build run in the shared worktree.

### Tracking And Security Review

- Desktop Agent: foreground segments, idle/locked boundaries, UTC day rollover, queue persistence/capacity, retry classification, inactive-session recreation, shutdown flush, and Windows adapter privacy minimisation were covered by the full package tests.
- Browser Extension: active-tab/domain lifecycle, focus/idle handling, persistent bounded queue, retry/backoff, credential envelope handling, and hostname-only data minimisation were covered by the full package tests.
- API: device credential scoping, pairing/revoke behavior, duplicate activity idempotency, tenant/user isolation, report authorization, and Browser/Agent report aggregation were covered by the full package tests.
- No API contract, database schema, authentication behavior, tenant boundary, role boundary, collection payload shape, or tracking calculation was changed.

### Verification

- `pnpm.CMD --filter @workmap/web test`: passed, 48 tests.
- `pnpm.CMD --filter @workmap/api test`: passed, 11 tests.
- `pnpm.CMD --filter @workmap/desktop-agent test`: passed, 29 tests.
- `pnpm.CMD --filter @workmap/browser-extension test`: passed, 15 tests.
- Web/API/Desktop Agent/Browser Extension typecheck and lint: passed.
- Web/API/Desktop Agent/Browser Extension build: passed.
- `pnpm.CMD --filter @workmap/shared-types typecheck`: passed.
- `pnpm.CMD smoke:stage4`: blocked before runtime assertions because this workspace has no `DATABASE_URL` and no local API on port 3001. It did not target production or modify cloud state.
- `git diff --check`: passed before the final documentation check; it is rerun as the final repository verification.

### Manual QA

- Not run. Production deployment and consolidated manual Windows/browser verification remain deferred. This code change has not been deployed to the Render/Vercel environment from this task.

### Intentionally Not Changed

- No production environment, Cognito configuration, Platform Admin access, database, Prisma schema, migration, event payload contract, or tracking permission was changed.

### Remaining Risk

- The UTC fix prevents the verified timezone mismatch. A device with an incorrectly configured system clock can still submit invalid date selections; the safe validation detail makes that condition visible.
- The source fix must be deployed before the already-deployed `/reports` page changes behavior.

---

## 2026-07-14 Login Secondary Action Link Treatment

### Original Task Brief

Replace the green `Forgot password?` button with a muted grey underlined text link, without changing Cognito password-recovery behavior.

### Changed Files

- `workmap/apps/web/components/login/CognitoAuthForm.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/login-secondary-actions-style.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added the `wm-auth-text-link` presentation hook to the existing Forgot password, resend confirmation, and back-to-sign-in actions.
- The shared treatment is transparent, muted grey, bottom-underlined, compact, keyboard-focusable, disabled-safe, and uses `overflow-wrap` for narrow screens.
- All existing button callbacks, Cognito workflows, form fields, routes, and submit behavior remain unchanged.

### Verification

- Focused login secondary-action style regression test: passed.
- `pnpm.CMD --filter @workmap/web typecheck`: passed.
- `pnpm.CMD --filter @workmap/web lint`: passed.
- `pnpm.CMD --filter @workmap/web build`: passed, 19 routes.

### Manual QA

- Not run. No browser session or production deployment was started for this presentation-only change.

### Intentionally Not Changed

- No Cognito configuration, password-reset request, verification-code flow, account creation, routing, API, authentication, or backend behavior changed.

### Remaining Risk And Next Step

- The visual change is covered by source-level regression and production build checks. The next round can proceed; final physical browser visual QA remains deferred.

---

## 2026-07-14 Login Password Visibility Toggle Alignment

### Original Task Brief

Correct the password visibility eye button so it aligns inside the right edge of the password input.

### Changed Files

- `workmap/apps/web/components/login/CognitoAuthForm.tsx`
- `workmap/apps/web/app/workspace-redesign.css`
- `workmap/apps/web/test/login-secondary-actions-style.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- Added the `wm-auth-password-toggle` hook to the existing show/hide password button.
- The toggle now explicitly remains `40px` square with a `2px` top/right inset inside the `44px` input, overriding the shared `46px` form-button minimum height that caused the vertical overflow.
- Password visibility behavior, input padding, labels, accessibility names, and Cognito authentication flows are unchanged.

### Verification

- Focused login style tests: passed, 2/2.
- `pnpm.CMD --filter @workmap/web typecheck`: passed.
- `pnpm.CMD --filter @workmap/web lint`: passed.
- `pnpm.CMD --filter @workmap/web build`: passed, 19 routes.

### Manual QA

- Not run. No browser session or production deployment was started for this presentation-only fix.

### Intentionally Not Changed

- No password handling, show/hide event behavior, Cognito configuration, API, routing, or backend behavior changed.

### Remaining Risk And Next Step

- Source-level geometry and build checks pass. The next round can proceed; final physical-browser visual QA remains deferred.

---

## 2026-07-14 Reports Current-Day Default

### Original Task Brief

- When `/reports` is opened, set both From and To to the current reporting day instead of restoring a prior date range from browser storage.

### Changed Files

- `workmap/apps/web/components/reports/reportFilters.ts`
- `workmap/apps/web/test/reports-filter-persistence.test.ts`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

### Implementation Summary

- A newly opened Reports page now always uses the current UTC reporting date for both From and To.
- The stored report view and authorized department preference are still restored after their existing role and directory checks.
- Historical date ranges, including a previously selected 7/30/90-day range, are deliberately not restored on a new page open; the current-day default is persisted again once initialization completes.
- No report API request shape, report calculation, Cognito behavior, tenant/RBAC boundary, or Desktop Agent behavior changed.

### Verification

- Focused report-filter regression test: passed, 4/4.
- `pnpm.cmd --filter @workmap/web test`: passed, 50/50.
- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `pnpm.cmd --filter @workmap/web build`: passed, 19 routes.

### Manual QA

- Not run. No browser session or production deployment was started for this source change.

### Intentionally Not Changed

- No API endpoint, persisted activity data, Desktop Agent/Browser Extension runtime, authentication, permissions, date-range query contract, or visual layout changed.

### Remaining Risk And Next Step

- The default follows the existing UTC reporting-date contract shown in the page UI. Final browser and deployed verification remain pending; the next round can proceed.

---

## 2026-07-14 Activity Tracking Architecture Review (Analysis Only)

### Original Task Brief

- Perform a code-grounded architecture review of Desktop Agent, Browser Extension, activity ingestion, device/session status, database aggregation, and Owner Reports before any tracking-system rewrite.

### Reviewed Runtime Surface

- `workmap/apps/desktop-agent/src/{runtime.ts,trackingState.ts,windowsForeground.ts,fileStore.ts,apiClient.ts}` and the Windows PowerShell adapter.
- `workmap/apps/browser-extension/src/{background.ts,domainState.ts,contentScript.ts,extensionStorage.ts,extensionApi.ts}` and `manifest.json`.
- `workmap/apps/api/src/modules/{activity,devices,reports}` plus `workmap/prisma/schema.prisma`.
- `workmap/apps/web/components/reports/{ReportSummaryPanel.tsx,liveUsage.ts,reportFilters.ts}` and report API types.

### Findings Summary

- The Windows Agent records one foreground application for Focus Active time and separately enumerates visible top-level windows for non-active Open/runtime context. It does not discover every process or attribute keyboard/mouse input to individual applications.
- The Extension has an MV3 service worker, optional host permission, trusted page-interaction signals, durable storage, alarms, queue retry, and hostname-only ingestion. Its Focus Active state remains a single focused tab/domain, not a multi-window parallel-active model.
- Activity retry idempotency, UTC day splitting, credential device binding, tenant isolation, and revoke enforcement exist. The durable queues are bounded at 1,000 items / 31 days and intentionally drop older items when full or expired.
- Current device session data supports only `GRACEFUL_SHUTDOWN` and `UNEXPECTED_STOP`. Reports derive `online`, `stopped`, and `interrupted` from heartbeat freshness and those two values; there is no durable status-event history or reliable reason classification for network loss, sleep, shutdown, crash, or forced termination.
- Reports keep app and domain totals separate, but have no explicit cross-client correlation model, no per-window/process/tab identity, and no labelled parallel-activity/union total.

### Verification

- `pnpm.cmd --filter @workmap/desktop-agent test`: passed, 29/29.
- `pnpm.cmd --filter @workmap/browser-extension test`: passed, 15/15.
- `pnpm.cmd --filter @workmap/api test`: passed, 11/11.

### Intentionally Not Changed

- No runtime, API, Prisma schema, database migration, auth/RBAC, report calculation, or client behavior was modified in this analysis round.

### Next Decision Required

- Confirm the proposed unified Activity Session and Device Status model before implementing the staged tracking redesign. The full code-grounded architecture report and proposed phases were delivered in the Codex response for review.

---

## 2026-07-14 Activity Tracking Reliability Implementation

### Original Task Brief

- Implement the approved reliability design across the real Windows Desktop Agent, MV3 Browser Extension, activity ingestion, device-status lifecycle, and Owner Reports without changing Cognito, tenant/RBAC, or unrelated product behavior.

### Changed Files

- Desktop Agent runtime, tracking state, durable storage, client API, Electron lifecycle, and focused tracking/queue tests under `workmap/apps/desktop-agent/`.
- MV3 background runtime, persisted domain state, durable queues, options status UI, client API, and tests under `workmap/apps/browser-extension/`.
- Activity ingestion, device-status handling, report aggregation, and integration tests under `workmap/apps/api/`.
- `workmap/prisma/schema.prisma` and `workmap/prisma/migrations/20260714090000_activity_status_history/`.
- Reports API types, live report presentation, and report regressions under `workmap/apps/web/`.

### Runtime Implementation Summary

- The Windows runtime continues to use the real User32 foreground/last-input/visible-window adapter. Tracking now persists bounded per-app Focus Active segments, retains separate visible/open runtime context, closes at the precise idle/lock/no-window boundary, survives restart recovery, filters short slices, and does not collect titles or content.
- A recent input can keep more than one recently interacted application Focus Active for a bounded 30-second grace window. Legacy adapter output without precise input retains single-foreground behavior and sampling-gap protection rather than inventing parallel activity.
- Desktop device status now records a durable lifecycle with reason, timestamps, source, timezone, heartbeat freshness, session, and confidence. Graceful shutdown is no longer represented as a network failure; authentication failure and ambiguous termination remain interruption states rather than false user stops.
- The MV3 service worker persists tab/domain state and activity/status queues, restores state through storage and alarms, re-registers its guarded interaction listener into already-open permitted HTTP(S) tabs after worker recovery, handles focus and idle/locked changes, and uploads hostnames only.
- Backend activity and heartbeat ingestion now preserves the maximum accepted client sequence per agent session, so a late retry cannot regress the session cursor. Reports expose precise device status/freshness/history while keeping desktop app totals and browser-domain totals separate instead of adding them together.
- Pairing, device-bound hash-only credentials, revoke enforcement, bounded durable queues, retry/backoff, stable event IDs, and duplicate-safe ingestion remain in the same Cognito/tenant/RBAC architecture.

### Build Artifacts

- Windows Alpha installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.7.exe` (non-empty automated package output).
- Load-unpacked MV3 directory: `workmap/apps/browser-extension/alpha-unpacked/`.
- MV3 archive: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.4.2-stage4.zip`.

### Verification

- Shared types typecheck: passed.
- Web tests: passed, 50 tests; typecheck, lint, and build: passed.
- API tests: passed, 12 tests; typecheck, lint, and build: passed.
- Desktop Agent tests: passed, 33 tests; typecheck, lint, build, and Windows installer packaging: passed.
- Browser Extension tests: passed, 17 tests; typecheck, lint, and MV3 build: passed.
- Prisma schema validation: passed with an ephemeral non-secret validation URL; no database migration was applied and no database was changed.
- `git diff --check`: passed.
- Source and unpacked-extension credential scan: passed; no credential-shaped value or development-machine absolute path was found.
- `pnpm smoke:stage4`: environment-blocked. The workspace has neither `DATABASE_URL` nor a local API on port 3001, so the smoke script could not begin its database-backed assertions. It did not contact production or modify cloud state.

### Manual QA

- Deferred by user, pending final consolidated manual QA. No physical Windows installation, browser load-unpacked session, multi-monitor interaction run, or production deployment is claimed as completed.

### Intentionally Not Changed

- Cognito, auth behavior, tenant isolation, RBAC, Platform Admin boundaries, existing report permissions, realtime office behavior, 3CX, Clerk, and prohibited private-content collection remain unchanged.

### Remaining Risk

- Windows can reliably provide global last-input and foreground/visible-window context, but it cannot prove keyboard or pointer attribution to every visible application. The bounded grace model is explicit about that limitation and must be manually exercised on real multi-monitor workflows.
- A forced process termination or sudden power loss cannot always be classified locally at the instant it happens; the server records it as an interruption until a later reconnect/recovery provides more evidence.
- A disposable local database plus API process is still required to run the existing end-to-end `smoke:stage4` script. This is an environment gap, not a passed smoke result.

---

## 2026-07-15 Avatar Studio Visual Refinement

### Original Task Brief

- Redesign only the visual presentation of `/onboarding/avatar` as a clear character-building page. Preserve avatar assets, profile persistence, authentication, navigation, and selection behavior.

### Changed Files

- `workmap/apps/web/app/onboarding/avatar/page.tsx`
- `workmap/apps/web/app/workspace-redesign.css`

### Implementation Summary

- Reframed the page as an Avatar Studio with a live dark preview stage, selected-layer summary, visible selected state, optional-layer labels, and compact selection counts.
- Replaced the narrow internal picker layout with readable asset cards, single-line ellipsised labels, tooltips, and page-level scrolling. This removes the prior vertical letter wrapping and nested category scroll areas.
- Added responsive behavior: the preview moves before the builder below 900px, and option cards become a stable two-column grid below 640px. Buttons and labels retain bounded widths.
- Added only existing Lucide icons and existing layered WorkMap avatar assets. No avatar data, save API call, setup-state update, or routing logic changed.

### Verification

- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `pnpm.cmd --filter @workmap/web test`: passed, 50/50.
- `pnpm.cmd --filter @workmap/web build`: passed.
- `git diff --check`: passed.
- Credential-pattern source scan: passed.

### Manual QA

- Not run locally: this protected page redirects without a real Cognito session, and no session was fabricated for visual testing. Production/manual visual verification remains Deferred by user, pending final consolidated manual QA.

### Intentionally Not Changed

- Avatar assets, avatar encoding/storage, profile update requests, Cognito behavior, onboarding completion logic, virtual-office routing, APIs, schema, and backend code.

---

## 2026-07-15 Device Setup Download Button Alignment

- Fixed the stretched download-link text alignment on `/onboarding/device-setup` by making the existing primary download style an explicit centered inline-flex control with a stable minimum height and safe width.
- The same presentation fix applies to the Windows installer and Browser Extension ZIP links. Download URLs, pairing behavior, setup requirements, authentication, APIs, and backend code were not changed.
- Web typecheck, lint, production build, and `git diff --check` passed. Manual authenticated visual QA was not run.

---

## 2026-07-15 Agent Restart And Audit Reliability Fix

### Original Task Brief

- Investigate and fix the production-observed Desktop Agent restart error (`Current activity observation is too far in the future`), misleading connected/offline UI, repeated Network Offline audit entries, and overlapping or incomplete Agent session history in Owner Reports.

### Changed Files

- Device heartbeat, Agent session start, and status-event handling: `workmap/apps/api/src/modules/devices/devices.service.ts`.
- Report history aggregation: `workmap/apps/api/src/modules/reports/reports.service.ts`.
- Desktop runtime connectivity state and renderer status copy under `workmap/apps/desktop-agent/`.
- Owner Reports audit rendering: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- Focused API and Desktop Agent regression tests covering clock skew, retry idempotency, status deduplication, and report coalescing.

### Runtime Implementation Summary

- Heartbeats now tolerate and normalize bounded client clock skew up to five minutes against server time while preserving the observed activity duration. Larger future timestamps still fail validation instead of accepting unbounded or corrupt time.
- Agent session start is idempotent by the client session ID. A retried request whose first response was lost reuses the existing active session rather than creating a phantom overlapping session.
- Device status writes now deduplicate equivalent consecutive transitions even when a retry has a new client event ID.
- Successful activity uploads no longer overwrite a failed-heartbeat connection state. Network Offline is recorded once per transition, and the Agent returns to connected only after an actual heartbeat succeeds.
- The desktop window now distinguishes `Agent connected` from `Recording locally`; queued activity may continue to accumulate during a network interruption and is uploaded after heartbeat recovery.
- Reports coalesce historical duplicate server sessions by client session ID and collapse consecutive equivalent device-status transitions at read time. The UI displays the complete API result (bounded to 500 rows server-side), explicit session end reasons, event occurrence time, and delayed sync time where applicable.

### Build Artifact

- Windows installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.5.8.exe`.
- Size: 91,942,548 bytes.
- SHA-256: `8FECA0D42E22CF9A3CE5A836D8A5DB1D41C6E82248F85FF1B9FE207033220CDE`.
- A 0.5.8 client install is required for the corrected runtime connection state and renderer messaging. Server deployment alone gives 0.5.7 the bounded clock-skew and session-idempotency protections, but not the client-side transition fix.

### Verification

- API: typecheck, lint, build, and 14 tests passed.
- Desktop Agent: typecheck, lint, build, 34 tests, renderer syntax check, and Windows installer packaging passed.
- Web: typecheck, lint, build, and 50 tests passed.
- `git diff --check`: passed.
- Credential-pattern source scan excluding environment, dependency, generated, build, coverage, reference, and artifact paths: passed with no matches.
- `pnpm smoke:stage4`: not run successfully because this process has no `DATABASE_URL`; Prisma stopped before connecting. No database was contacted or modified, and production was not used as a smoke target.

### Manual QA

- The supplied production screenshots established the original symptoms. Post-fix Windows restart, corporate-network interruption, and deployed Reports verification were not run by Codex. Deferred by user, pending final consolidated manual QA.

### Intentionally Not Changed

- No Prisma schema, migration, activity duration semantics, foreground tracking rules, queue capacity, authentication, Cognito, tenant/RBAC, browser-extension runtime, or production infrastructure was changed.

### Remaining Risks

- Historical rows without a client session ID cannot be safely merged automatically because they lack a reliable identity; they remain visible rather than being guessed away.
- Offline Focus Active continuing to increase is expected while local foreground activity remains valid. Network reachability controls synchronization, not local collection; the bounded durable queue preserves those events until recovery.

---

## 2026-07-15 Reports Employee Information Hierarchy

### Original Task Brief

- Consolidate the selected employee `/reports` view into four clear sections: current Desktop Agent and Browser Extension activity, connection audits for both clients, the existing Daily Trend, and the existing API Summary.

### Changed Files

- Employee report composition and responsive cards: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- Browser coverage response typing: `workmap/apps/web/lib/api/apiTypes.ts`.
- Fresh current-domain lookup: `workmap/apps/api/src/modules/reports/reports.service.ts`.
- API coverage verification: `workmap/apps/api/test/tracking-reports-verification.test.ts`.
- Web information-order regression test: `workmap/apps/web/test/reports-information-order.test.ts`.

### Implementation Summary

- Selected employee reports now render in the requested order: a two-column live-status section, a two-column connection-audit section, the unchanged Daily Trend, then the unchanged API Summary.
- The Desktop live card uses the existing Agent status payload for connection, current foreground app, active/idle time, host, and last heartbeat.
- Browser coverage now exposes `currentDomain` and `currentDomainObservedAt` only from a real Browser Extension activity event that is active-window, non-idle, no more than 45 seconds old, and belongs to a currently connected extension device. Stale, idle, background, or disconnected observations are not labelled as current activity.
- Desktop audit combines session start/end records with device lifecycle events and preserves exact occurrence times plus delayed-sync context.
- Browser audit combines extension coverage and Browser Extension lifecycle events. If only heartbeat loss is known, the UI labels it as an unconfirmed interruption rather than claiming a manual stop.
- Company aggregate reports retain their previous coverage, metric, Daily Trend, employee usage, and API Summary composition.
- No schema, migration, activity duration calculation, ingestion contract, authentication, tenant/RBAC rule, Desktop Agent runtime, or Browser Extension runtime changed in this UI/API increment.

### Verification

- API typecheck, lint, build, and tests: passed, 14/14.
- Web typecheck, lint, production build, and tests: passed, 52/52.
- `git diff --check`: passed; only existing line-ending conversion warnings were emitted.
- Credential-pattern source scan: passed with no matches.

### Manual QA

- Deferred by user, pending final consolidated manual QA. Authenticated desktop/mobile browser verification was not run because no real Cognito session was fabricated.

### Remaining Risk

- The current extension protocol does not emit an explicit uninstall, browser-close, or user-disable lifecycle event. Those cases cannot be truthfully distinguished from heartbeat loss; the report therefore shows an unconfirmed interruption unless an explicit status event exists.

---

## 2026-07-15 Reports 500 Regression Fix

### Original Task Brief

- Fix the production `GET /reports/usage-summary` 500 responses that appeared after adding the employee Reports live Browser Domain presentation.

### Changed Files

- Optional current-domain query isolation and minimal Prisma projection: `workmap/apps/api/src/modules/reports/reports.service.ts`.
- Production failure-mode API regression: `workmap/apps/api/test/tracking-reports-verification.test.ts`.
- Failed-revision request suppression: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`.
- Web polling regression: `workmap/apps/web/test/reports-information-order.test.ts`.

### Implementation Summary

- The newly added current Browser Domain lookup is now an optional enrichment. If Prisma/database execution rejects that query, Reports logs only a sanitized error code, returns the full usage summary and connection coverage, and sets the two current-domain fields to null.
- Both extension queries now select only the fields used by the report rather than materializing complete activity rows.
- The Web live poll remembers a failed activity revision. It does not retry the same failing usage summary every ten seconds; a new revision or an explicit Apply Filters action allows a new attempt.
- No report aggregation, duration calculation, auth/RBAC, schema, migration, Desktop Agent, or Browser Extension runtime behavior changed.

### Verification

- API tests passed, 14/14, including a simulated Prisma `P2022` failure of the optional current-domain query while `getUsageSummary` still succeeds.
- API typecheck, lint, and build passed.
- Web tests passed, 53/53, including failed-revision polling suppression.
- Web typecheck, lint, and production build passed.
- `git diff --check` and credential-pattern source scan passed.

### Manual QA And Deployment

- The supplied production screenshots confirmed the pre-fix 500 and retry storm. Post-fix production verification was not run because these source changes have not yet been deployed.
- Deploy API and Web. No database migration and no Desktop Agent or Browser Extension package update are required.

---

## 2026-07-15 Render Database Connection Exhaustion

- The Render build for commit `904a249` completed successfully, including dependency install, Prisma Client generation, and the API Nest build.
- Deployment failed before the HTTP listener started because `PrismaService.onModuleInit()` received Supabase `EMAXCONNSESSION`: the Session Pooler had reached its configured 15-client pool size.
- This is not a schema, migration, Reports query, or TypeScript build failure. Re-running the same deployment against the same exhausted Session Pooler is not a reliable fix.
- Production runtime should use the Supabase Transaction Pooler endpoint on port 6543 with bounded Prisma connections and PgBouncer compatibility. Local/controlled Prisma migrations should continue using the already verified session/direct migration connection instead of the transaction endpoint.
- No database URL, password, token, or other credential was written to source or handoff files.

---

## 2026-07-16 Reports Responsive Live Refresh And Query Separation

### Original Task Brief

- Keep `/reports` current device/app/domain visibility responsive while reducing unnecessary database work and preserving all existing tracking, reports, access-control, deployment, Desktop Agent, and Browser Extension behaviour.

### Changed Files

- Reports API/controller and query separation: `workmap/apps/api/src/modules/reports/reports.controller.ts`, `workmap/apps/api/src/modules/reports/reports.service.ts`.
- Report query indexes: `workmap/prisma/schema.prisma`, `workmap/prisma/migrations/20260716103000_report_query_performance/migration.sql`.
- Reports client/API/types: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, `workmap/apps/web/lib/api/reportsApi.ts`, `workmap/apps/web/lib/api/apiTypes.ts`.
- Regression coverage: `workmap/apps/api/test/tracking-reports-verification.test.ts`, `workmap/apps/web/test/reports-api.test.ts`, `workmap/apps/web/test/reports-information-order.test.ts`.

### Implementation Summary

- `usage-summary` remains backward compatible by default, but can now omit inline audit and live enrichments for the primary report query. The same data still loads through dedicated calls instead of blocking the main report.
- Added authenticated `GET /reports/tracking-audit`, preserving the existing user-resolution and RBAC checks before returning desktop session, status-history, and app-timeline data. Company scope intentionally returns no per-employee audit history.
- The report page retrieves current Agent/Extension status first, polls that live state every five seconds only while the page is visible, and checks aggregate-summary revision at most every twenty seconds. Historical audit loads independently after the first summary.
- Browser live coverage queries are capped to the latest 24 hours / 500 records, and coverage counts read registered devices in one bounded query.
- Aggregate revision checks now use the already-updated app/domain summary tables rather than raw ActivityEvent and status-event scans. Seven additive database indexes support the existing report filters and bounded browser lookups.

### Behaviour And Boundaries

- No App/Domain duration calculation, activity ingestion, tenant filter, RBAC rule, Cognito flow, Agent runtime, Extension runtime, status model, API removal, or production environment setting changed.
- The data freshness contract is intentionally split: current focus/connection status normally refreshes within five seconds on a visible report tab; historical aggregate cards refresh within the next twenty-second revision check after the server accepts activity data, plus the existing client upload latency.

### Verification

- API tests passed, 17/17.
- Web tests passed, 72/72.
- API and Web typecheck, lint, and production builds passed.
- `git diff --check` and scoped source credential scan passed; Windows line-ending notices were informational only.

### Manual QA And Deployment

- Manual authenticated performance measurement was not run. Production environment, database, migration execution, Render/Vercel deployment, Desktop Agent, and Browser Extension were not changed in this round.
- The additive index migration must be applied through the established production migration process before expecting its database-level performance benefit. API and Web must then deploy together because the Web client uses the new tracking-audit endpoint.

### Remaining Risks

- Source verification cannot prove Supabase/Render network latency or a constrained production pool. If production remains slow after the index migration and matching API/Web deploy, capture endpoint duration and pool metrics before changing tracking behaviour.

---

## 2026-07-16 Browser Extension v0.4.2 Timing-Path Audit

### Original Task Brief

- Check the current Browser Extension against the Desktop Agent timing and reporting defects, using source code rather than prior design documents.

### Reviewed Runtime Paths

- MV3 lifecycle, tab/window/idle listeners, checkpoint processing, queue and retry order: `workmap/apps/browser-extension/src/background.ts`.
- Domain focus/runtime session state and 30-second idle boundary: `workmap/apps/browser-extension/src/domainState.ts`, `workmap/apps/browser-extension/src/domainTracking.ts`, and `workmap/apps/browser-extension/src/contentScript.ts`.
- Durable local queue and device credential handling: `workmap/apps/browser-extension/src/extensionStorage.ts` and `workmap/apps/browser-extension/src/credentialVault.ts`.
- API ingestion and Owner Reports current-domain enrichment: `workmap/apps/api/src/modules/activity/activity.service.ts`, `workmap/apps/api/src/modules/reports/reports.service.ts`, and `workmap/apps/web/components/reports/liveUsage.ts`.

### Findings

- The Extension has the same ordering risk that Desktop Agent had before v0.5.10: a checkpoint persists and queues finished Domain slices, then sends a heartbeat, and only then uploads that queue. `/reports` treats the heartbeat as connection freshness while current Domain comes from an already-persisted active slice. The result can be a connected Extension with a temporarily blank or stale current Domain at a checkpoint boundary.
- This is not the exact Desktop Agent numeric regression. Extension heartbeat does not carry a live Domain duration, so it cannot produce the Agent-specific `6m17s -> 6m0s` display path. Persisted Domain totals are stored through idempotent completed slices and normally remain monotonic after ingestion.
- Local persistence is present: tracker snapshot, activity queue, and status queue are written to `chrome.storage.local` before network upload. Queue items retain stable client IDs, are capped at 1,000 items / 31 days, retry with bounded exponential backoff, and are removed only after a successful API response. This prevents normal temporary network loss from discarding completed slices.
- A material collection gap remains: web-host permission is optional and dynamic content-script registration failures are swallowed in the background worker. Without granted HTTP/HTTPS host permission or with failed injection, the Extension can be paired and heartbeat-connected while recording no interaction activity. The current UI does not make this failure state explicit enough.
- Focus tracking is interaction-based and privacy-minimized. It collects no URL path, title, page body, input, or pointer coordinates. A visible, trusted interaction starts/refreshes one tab's Focus Active window; no new interaction for 30 seconds seals it exactly at the last-interaction-plus-30-second boundary. A browser focus loss, page blur, hidden tab, Chrome idle, or lock seals focus earlier.
- The implementation intentionally permits bounded parallel Focus Active windows across different tabs/domains. Same-domain open-runtime is deduplicated, but different domains can overlap for their 30-second grace periods. Therefore a sum of per-domain Focus Active seconds can exceed wall-clock online time; Reports must continue to present it as per-domain activity rather than an employee's unique total time.
- Tab changes rely primarily on the content script's `blur`/`visibilitychange` message. If that message cannot arrive, the prior tab can stay active until the bounded 30-second idle grace expires. This is a bounded overcount risk, not the observed Agent undercount path.
- The Extension only reports RUNNING, NETWORK_OFFLINE, LOCKED, SERVER_UNREACHABLE, and RECONNECTED. Browser close, disable, uninstall, or service-worker termination cannot reliably generate an explicit user-stop event, so Reports must continue to describe them as inferred signal loss rather than “stopped by user”.

### Required Follow-Up

- Do not treat Browser Extension v0.4.2 as having the Desktop Agent v0.5.10 upload-order fix. A runtime patch should upload newly completed Domain slices before the checkpoint heartbeat, with a regression test covering Reports' current-domain freshness at that boundary.
- Add explicit host-permission/injection health to options/status and Reports coverage so a paired but non-collecting Extension is diagnosable.
- No runtime code, API, schema, migration, Desktop Agent, or production environment setting changed in this audit-only round.

### Verification

- `pnpm.cmd --filter @workmap/browser-extension test`: passed, 17/17 in 0.94 seconds.
- Existing tests cover host-only extraction, minimal permissions, trusted interaction events, parallel grace windows, focus loss, idle boundary, durable queue behavior, retries, stable IDs, and MV3 lifecycle markers.
- Existing tests do not cover checkpoint upload ordering, a paired Extension without host permission, or the Owner Reports current-domain race.

### Manual QA

- Deferred by user, pending final consolidated manual QA. No browser was paired, loaded, or interacted with during this source audit.
## 2026-07-16 - Desktop Agent v0.5.9 timing-path audit (analysis only)

- Task: trace the actual Desktop Agent v0.5.9 timing path from Windows sampling through the API and `/reports`, following observed Focus Active display regressions.
- Runtime code was not changed in this round.
- Confirmed cause: `AppTrackingState` rolls an active focus segment every 10 seconds. The runtime sends a heartbeat containing the newly reset current segment before it uploads the completed previous segment. `/reports` combines persisted summary seconds with the heartbeat's current segment, so the displayed Focus Active total can temporarily fall until the queued completed segment is ingested.
- Confirmed affected paths: `apps/desktop-agent/src/trackingState.ts`, `apps/desktop-agent/src/runtime.ts`, `apps/desktop-agent/src/windowsForeground.ts`, `apps/api/src/modules/devices/devices.service.ts`, `apps/api/src/modules/activity/activity.service.ts`, `apps/api/src/modules/reports/reports.service.ts`, and `apps/web/components/reports/liveUsage.ts`.
- Verification: source-level audit completed. No automated command was required because no runtime code changed.

---

## 2026-07-16 Browser Extension v0.4.3 Tracking Reliability Fix

### Original Task Brief

- Implement the complete, detailed Browser Extension remediation for the v0.4.2 audit risks and publish a new v0.4.3 Load-unpacked build.

### Runtime Changes

- `apps/browser-extension/src/background.ts`: completed Domain slices are persisted and uploaded before the checkpoint heartbeat. This removes the connected-but-stale/current-domain race at checkpoint boundaries.
- `apps/browser-extension/src/domainState.ts`: an active tab now seals the previous active tab in the same browser window immediately. Separate browser windows retain the existing bounded parallel Focus Active behaviour. Idle/locked state prevents media signals from reviving a focus interval until a new direct user interaction occurs.
- `apps/browser-extension/src/contentScript.ts`: trusted interaction remains the primary signal. Media may renew a session only after a recent trusted interaction while the page is visible and focused; autoplay, background pages, page content, titles, URL paths, query strings, form data, and media metadata are neither collected nor uploaded.
- `apps/browser-extension/src/extensionStorage.ts` and `src/options.ts`: tracking health is persisted and shown as `ready`, website permission required, or registration failed. Pairing now reports missing HTTP/HTTPS website access instead of silently presenting a paired but non-collecting extension as healthy.
- Existing v0.4.2 tracker snapshots are read compatibly and migrate naturally to the v4 snapshot on the next write. Durable queue, stable event identity, bounded retry, and credential storage were retained.

### Reports Health Presentation

- `apps/api/src/modules/devices/devices.service.ts` records a tracking-health transition only when its state changes. Repeated retries remain deduplicated.
- Tracking-health events do not refresh a device `lastSeenAt`; only a real heartbeat/activity path can make Reports show the Extension as currently connected. This preserves upload-order correctness.
- `apps/api/src/modules/reports/reports.service.ts` and `apps/web/components/reports/ReportSummaryPanel.tsx` expose website-permission/registration failures as a tracking-access problem instead of falsely showing an empty current Domain as a healthy connection.

### Version And Artifact

- Manifest, package metadata, and client metadata: `0.4.3` / `browser-extension-mv3/0.4.3`.
- Load-unpacked artifact: `workmap/apps/browser-extension/alpha-unpacked`.
- No Desktop Agent runtime, Prisma schema, migration, credential, or deployment setting changed.

### Verification

- Browser Extension tests: passed, 20/20.
- Browser Extension typecheck, lint, and build: passed.
- API tests: passed, 18/18; typecheck, lint, and build: passed.
- Web typecheck, lint, and build: passed.
- `git diff --check` and scoped current-diff credential scan: passed.

### Manual QA And Remaining Boundary

- Deferred by user, pending final consolidated manual QA: load v0.4.3 in Chrome/Edge, grant website access, verify a same-window tab switch, two separate browser windows, permission removal/regrant, offline retry, and current Domain display in Reports.
- MV3 cannot reliably emit an explicit user-stop event for browser close, disable, uninstall, or service-worker eviction. Those remain truthfully represented as inferred signal loss rather than a false "stopped by user" event.

### Release Artifact Correction

- The GitHub Release artifact is `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.4.3.zip`, alongside the existing `0.4.2` archives. It contains the same zip-root layout as v0.4.2 and a verified `manifest.json` version `0.4.3`.

---

## 2026-07-18 Tracking Clients v2 Implementation

### Original Task Brief

- Implement the approved tracking-client plan against the existing WorkMap codebase: privacy-minimized, durable, monotonic Desktop Agent and MV3 Browser Extension tracking, unified server reconciliation, and Reports presentation that separates current focus from confirmed history.

### Changed Files

- Shared v2 contracts and deterministic single-focus engine: `workmap/packages/shared-types/src/tracking-v2.ts`, `workmap/packages/shared-types/src/single-focus-engine-v2.ts`, and `workmap/packages/shared-types/src/index.ts`.
- Server policy, durable v2 ingestion, reconciliation and report merge: `workmap/apps/api/src/modules/devices/tracking-v2-*.ts`, `workmap/apps/api/src/modules/reports/tracking-v2-reports.service.ts`, `workmap/apps/api/src/modules/reports/reports.service.ts`, and `workmap/apps/api/src/modules/activity/activity.service.ts`.
- Additive schema foundation: `workmap/prisma/schema.prisma` and `workmap/prisma/migrations/20260717090000_tracking_v2_foundation/migration.sql`.
- Desktop Agent v0.6.0 runtime, Windows helper, durable queue, migration and tests: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `desktopFocusEngineV2.ts`, `trackingV2Store.ts`, `windowsActivityHost.ts`, `trackingState.ts`, `fileStore.ts`, and related package/test files.
- Browser Extension v0.5.0 MV3 runtime, durable state, host-permission tracking health, build packaging and tests: `workmap/apps/browser-extension/src/backgroundV2.ts`, `browserFocusEngineV2.ts`, `trackingV2Store.ts`, `hostnameExclusions.ts`, `scripts/package-alpha.mjs`, and related package/test files.
- Reports v2-first presentation and Web source-module compatibility: `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`, `reportSnapshotCache.ts`, `workmap/apps/web/lib/api/reportsApi.ts`, `apiTypes.ts`, and `next.config.ts`.

### Runtime Behaviour

- Desktop Agent v0.6.0 uses the Windows native foreground adapter in its normal runtime. It records normalized application identity only, never titles, document content, screenshots, keystrokes, clipboard, or window contents.
- The Desktop v2 state engine keeps an interval's baseline stable while it remains active. Completed intervals enter a local durable queue before upload; the pre-v2 checkpoint migration clips old unpersisted state at protocol activation and fingerprints migrated legacy events to prevent a crash-window duplicate.
- Browser Extension v0.5.0 tracks active HTTP(S) tab/window state in its MV3 worker, persists v2 checkpoint and queue state through worker restarts, and uploads hostname-only Domain intervals. It has no content-body or title collection path.
- The API accepts immutable v2 intervals with idempotency/reconciliation rules. Reports prefer confirmed v2 aggregate data and use live state only as current-focus enrichment, avoiding the former reset-at-checkpoint display path.
- The additive migration has been created and Prisma schema validation passed, but no production migration was run by this task.

### Version And Build Artifacts

- Desktop Agent version: `0.6.0`; verified Windows installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.0.exe`.
- Browser Extension manifest/package version: `0.5.0`; verified Load-unpacked directory: `workmap/apps/browser-extension/alpha-unpacked`; verified release zip: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.0.zip`.
- These artifacts contain no configured production credential. Windows installation and Chrome/Edge loading were not manually performed.

### Verification

- Shared types: typecheck, lint, build passed.
- API: tests 21/21, typecheck, lint, and build passed.
- Desktop Agent: tests 48/48, typecheck, lint, and Windows release build passed.
- Browser Extension: tests 31/31, typecheck, lint, build, and `release:zip` passed.
- Web: typecheck, lint, and production build passed.
- Prisma schema validation passed using a placeholder non-production URL.
- `git diff --check` passed; Windows line-ending notices were informational only. High-confidence source credential scan passed.
- `pnpm smoke:stage4` was intentionally not run: its script creates test tenants/dev tokens/devices and deletes matching smoke records, so it is not a read-only check suitable for this workspace without a dedicated local test database and running local API.

### Manual QA And Deployment

- Deferred by user, pending final consolidated manual QA. This includes installing the Windows package, pairing it, loading the Extension unpacked, granting website access, multi-window/browser activity verification, and live Reports validation.
- No Render/Vercel/Supabase configuration, production deployment, production database migration, or production data was modified in this task.

---

## 2026-07-19 V2 Sync Correlation Diagnostics

### Original Task Brief

- Add a safe correlation path for a failed Desktop Agent `sync-v2` upload so the Agent and Render logs identify the same request without exposing credentials or activity payloads.

### Runtime Change

- The Desktop Agent generates one UUID request ID per `sync-v2` batch and sends it only in the `X-WorkMap-Request-Id` header.
- The API validates or replaces that header, returns the canonical ID on both success and handled failure, and emits one compact failure log with `requestId`, last reached stage (`parse`, `policy`, `transaction`, or `response`), interval count, safe code/status, and elapsed time.
- The Agent persists the latest sync diagnostic and up to ten recent failures in its existing local v2 state. It records only request ID, timestamps, batch count, HTTP status, and safe error code; no credential, window title, URL, or activity payload is stored in diagnostics.

### Changed Files

- API correlation and structured failure logging: `workmap/apps/api/src/modules/devices/device-client.controller.ts`, `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`, and `workmap/apps/api/test/tracking-v2-sync-request-id.test.ts`.
- Desktop request header, error parsing, and durable diagnostic state: `workmap/apps/desktop-agent/src/apiClient.ts`, `src/runtimeV2.ts`, `src/trackingV2Types.ts`, `src/trackingV2Store.ts`, `src/types.ts`, and `test/tracking-v2-store.test.ts`.
- Shared sync response contract: `workmap/packages/shared-types/src/tracking-v2.ts`.

### Verification

- Shared types typecheck passed.
- API typecheck and production build passed.
- Desktop Agent typecheck, focused/full package tests (49/49), and Windows build passed.
- The new API correlation-ID test passed (2/2).
- The full API package suite was also run: 23 tests passed and one existing report-verification fixture failed because its fixed historical activity timestamp is now older than the service's allowed ingestion window. This diagnostic change does not touch ingestion age validation.
- `git diff --check` and a high-confidence changed-diff credential scan passed. CRLF notices were informational only.

### Manual QA, Scope, And Remaining Risk

- No database migration, schema migration, deployment configuration, credential, queue/retry behavior, or tracking time-calculation rule was changed.
- A deployed API and a rebuilt Desktop Agent are required before live failures can be correlated. Failures rejected by credential authentication before the controller may retain the Agent-generated ID but cannot produce a service-stage log, by design.
- Manual live correlation is deferred until a controlled failed/successful sync can be observed after the coordinated API and Agent release.

---

## 2026-07-18 Paired Client Activation Recovery

### Original Task Brief

- Investigate paired Desktop Agent and Browser Extension clients that remained locally queued and did not become current in Owner Reports after installing the v2 releases.

### Root Cause And Runtime Change

- Pairing and v2 tracking activation were incorrectly conflated by the clients. A valid paired credential can still be blocked before activation when the current monitoring policy has no confirmed time zone, the employee has not acknowledged the policy, a source is disabled, or no current collection window is leased.
- Desktop Agent `0.6.1` now distinguishes this condition from a genuine network outage. It reports `Waiting for policy setup`, preserves its durable queue, and retries activation every 30 seconds until the policy becomes valid.
- Browser Extension `0.5.1` applies the same preflight policy check. Its MV3 alarm retries activation every 30 seconds after the policy is corrected, including after a service-worker restart.
- The Compliance page now exposes the existing Owner/Manager-only backend action for confirming the workspace IANA schedule time zone. No new backend endpoint, schema field, migration, or credential scope was introduced.

### Changed Files

- Policy setup UI/client: `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx`, `workmap/apps/web/lib/api/complianceApi.ts`, and `workmap/apps/web/lib/api/apiTypes.ts`.
- Desktop recovery/UI/version: `workmap/apps/desktop-agent/src/runtimeV2.ts`, `src/types.ts`, `renderer/app.js`, `src/version.ts`, `src/windowsActivityHost.ts`, package/release metadata, and release test.
- Browser recovery/UI/version: `workmap/apps/browser-extension/src/backgroundV2.ts`, `src/extensionStorage.ts`, `src/options.ts`, `src/trackingV2Types.ts`, manifest/package metadata, and service-worker test.

### Artifacts

- Windows installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.1.exe`.
- Desktop Alpha directory: `workmap/apps/desktop-agent/alpha-windows`.
- Load-unpacked Extension directory: `workmap/apps/browser-extension/alpha-unpacked`.
- Extension ZIP: `workmap/artifacts/browser-extension/WorkMap-Browser-Extension-0.5.1.zip`.

### Verification

- Web, Desktop Agent, and Browser Extension TypeScript checks passed.
- Desktop focused tests passed: 20/20; Desktop GUI/release tests passed: 3/3.
- Browser focused tests passed: 18/18.
- Windows native activity host and NSIS installer builds passed; extension unpacked and ZIP builds passed.
- No production database or deployment action was performed. No migration is required for this patch.

### Manual QA And Remaining Boundary

- Deferred by user, pending final consolidated manual QA. Deploy the Web change, use an Owner or Manager account to confirm the schedule time zone only if Compliance shows the setup action, then install `0.6.1` / load `0.5.1` over the existing clients. A normal in-place update preserves pairing; do not choose an uninstall option that removes WorkMap local data.
- If a client still reports a genuine API connection error after policy setup, it will accurately remain offline; the device’s `apiBaseUrl` and current Render health must then be investigated separately rather than masking that condition as policy readiness.

### Intentionally Not Changed And Risks

- Cognito, tenant/RBAC boundaries, 3CX, Teams/Email content access, and Platform Admin privacy boundaries were not changed. No Clerk dependency was introduced.
- The production migration and coordinated API/Web/client rollout remain operational steps. Existing v1 clients remain subject to their prior runtime limitations until replaced with v0.6.0/v0.5.0.

---

## 2026-07-18 Render Shared-Types Startup Fix

### Issue

- Render built `@workmap/api` successfully but could not start it: the runtime fell back to `packages/shared-types/src/index.ts` and could not resolve the new `tracking-v2.js` source-relative export.

### Fix

- `workmap/apps/api/src/load-local-env.ts` now discovers the workspace root from `pnpm-workspace.yaml`, independently from whether an `.env` file exists.
- The compiled workspace aliases now resolve from the actual workspace root when Render starts the filtered API package from `apps/api`, so `@workmap/shared-types` resolves to `apps/api/dist/packages/shared-types/src/index.js` rather than TypeScript source.

### Verification

- API typecheck and production build passed.
- A no-database Node check from `workmap/apps/api` loaded `dist/apps/api/src/load-local-env.js`, resolved `@workmap/shared-types`, and loaded the v2 runtime exports successfully.
- No database, API contract, tracking calculation, credential, or deployment environment value was changed by this source fix.

---

## 2026-07-19 Desktop Agent 0.6.2 Sync-Diagnostics Release Artifact

### Purpose

- Clarify the release boundary after adding safe v2 sync correlation diagnostics: the previous `0.6.1` installer was built before the request-ID diagnostic code and does not contain it.

### Changed Release Metadata

- `workmap/apps/desktop-agent/package.json`, `alpha-windows/package.json`, `scripts/build-alpha.mjs`, `src/version.ts`, `src/windowsActivityHost.ts`, and `test/gui-release.test.ts` now identify the Desktop Agent as `0.6.2` / `desktop-agent-windows/0.6.2`.
- The `0.6.2` installer contains the already-implemented safe diagnostic state: per-sync request ID, HTTP status, safe error code, timestamp, and batch count. It does not persist credentials or activity payloads in diagnostics.

### Artifact And Upgrade Behavior

- Windows NSIS installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.2.exe` (115,431,692 bytes).
- A normal in-place `0.6.1` to `0.6.2` upgrade preserves `%LOCALAPPDATA%\\WorkMap\\DesktopAgent\\config.json` and the protected credential. Re-pairing is not required unless the device was revoked or uninstall was explicitly told to delete WorkMap local data.
- This artifact alone is not sufficient for end-to-end request correlation: deploy the matching API diagnostics source as well. No database migration is required.

### Verification

- Focused Desktop GUI/release tests passed: 3/3.
- NSIS Windows release build completed in 82.5 seconds and the installer/blockmap were confirmed present and non-empty.
- No deployment, database, pairing, or runtime queue behavior was changed while producing this artifact.

---

## 2026-08-06 CandidGrid Web Rebrand

### Original Task Brief
- Replace user-visible WorkMap branding across the web application with CandidGrid.
- Apply the approved four-cell CandidGrid mark and add a browser tab icon.

### Changed Files
- Updated public and authenticated route presentation under `workmap/apps/web/app/`.
- Updated shared frontend presentation under `workmap/apps/web/components/`.
- Added `workmap/apps/web/components/brand/CandidGridMark.tsx`.
- Added `workmap/apps/web/public/brand/candidgrid-mark.png`, `workmap/apps/web/app/icon.png`, and `workmap/apps/web/app/apple-icon.png`.

### Implementation Summary
- Replaced user-visible WorkMap names with CandidGrid across the homepage, authentication, onboarding, reports, compliance, settings, integrations, invitations, and Virtual Office UI.
- Replaced the former letter badge with the approved CandidGrid mark in the public header/footer, authenticated shell, and Virtual Office top bar.
- Added Next.js app icon assets so browser tabs and supported saved-site surfaces display the CandidGrid mark.
- Updated the Virtual Office fallback marker from `WM` to `CG` while preserving real avatar rendering.

### Boundaries Preserved
- Frontend branding only. Backend, API contracts, database, Prisma, authentication behavior, RBAC, routing behavior, Desktop Agent, and Browser Extension were not changed.
- Internal compatibility identifiers and package names such as `@workmap/*` remain unchanged.

### Verification
- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `pnpm.cmd --filter @workmap/web build`: passed.
- User-visible WorkMap residual scans: passed.
- `git diff --check`: passed; existing Windows line-ending warnings only.

### Manual QA And Risk
- Browser manual QA was not run in this task.
- Existing browser favicon caches may require a hard refresh before the new tab icon appears.

---

## 2026-08-06 CandidGrid Logo Contrast Refinement

### Original Task Brief
- Remove the white logo container and use the approved three-white, one-mint CandidGrid mark on dark backgrounds.

### Changed Files
- `workmap/apps/web/components/brand/CandidGridMark.tsx`
- `workmap/apps/web/app/page.tsx`
- `workmap/apps/web/app/home.module.css`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/office/VirtualOfficeTopBar.tsx`

### Implementation Summary
- Replaced the bitmap-backed mark with a crisp inline four-cell SVG that supports light and dark surface variants.
- Removed the enclosing white/outlined square from the public header/footer, authenticated shell, and Virtual Office top bar.
- Dark navigation surfaces now use three off-white cells and one mint cell; light surfaces retain the navy-and-mint variant.
- No routes, handlers, backend, database, authentication, tracking clients, or deployment configuration were changed.

### Verification
- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.
- Browser manual QA and a production build were not run for this narrow style-only refinement.

---

## 2026-07-20 Tracking V2 Monday Policy-Window Recovery

### Original Task Brief

- Investigate a Monday-morning Desktop Agent diagnostic reporting `SNAPSHOT_OUTSIDE_POLICY_WINDOW` even though the configured Adelaide workday should include that time.

### Runtime Fix

- `TrackingV2PolicyService` no longer reuses a non-expired policy lease solely because its ID, policy version, and expiry match. It recomputes the expected UTC work windows for the lease lifetime and replaces a stale or malformed stored window set.
- Confirmed activity intervals remain strict: their complete start-to-end duration must stay inside an approved policy window before they can enter report totals.
- Live focus snapshots are now correctly treated as current-state data rather than confirmed duration. Their latest observation must be in an approved window, and their state start must be valid and no later than that observation. This allows a valid Monday live snapshot to recover after an earlier window ended without admitting weekend time into totals.

### Changed Files

- `workmap/apps/api/src/modules/devices/tracking-v2-policy.service.ts`
- `workmap/apps/api/src/modules/devices/tracking-v2-sync.service.ts`
- `workmap/packages/shared-types/src/tracking-v2.ts`
- `workmap/apps/api/test/tracking-v2-policy-lease.test.ts`

### Deployment And Client Behavior

- No Prisma schema, migration, credential, pairing, Desktop Agent package, or Browser Extension package change is required.
- Deploy the API source change. The next Desktop Agent policy refresh will receive a newly issued lease if its stored lease window set is inconsistent. The normal refresh interval is five minutes; restarting the Agent after deployment requests the policy immediately and preserves its existing pairing/local data.

### Verification

- Focused policy regression tests passed: 3/3, covering Adelaide Monday work hours, stale lease replacement, and recovery of a live snapshot without admitting a cross-window duration.
- `pnpm.cmd --filter @workmap/api typecheck`: passed.
- `pnpm.cmd --filter @workmap/api build`: passed.

### Manual QA And Remaining Risk

- Production deployment and Monday-window live validation have not been run in this task. After deployment, verify that a live Desktop Agent snapshot during a configured work window no longer reports `SNAPSHOT_OUTSIDE_POLICY_WINDOW`, while an interval spanning outside the window remains excluded from confirmed totals.

---

## 2026-08-10 Dashboard Virtual Office Preview

### Original Task Brief
- Replace the dashboard banner's four summary tiles with the real Virtual Office panorama, preserving all dashboard behavior and adding responsive presentation.

### Changed Files
- `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx`
- `workmap/apps/web/app/workspace-redesign.css`

### Implementation Summary
- Replaced only the banner's visual summary grid with the existing real product asset at `/marketing/workmap-virtual-office-panorama.png`.
- Preserved the dashboard copy, buttons, data loading, navigation, and all component interfaces.
- The panorama keeps its full aspect ratio without cropping, uses a restrained dark product frame, and stacks below the copy on tablet and mobile layouts.

### Verification And Boundaries
- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.
- Authenticated browser visual QA was not run.
- No backend, API, database, Prisma, authentication, deployment, Desktop Agent, or Browser Extension code changed.

## Reports App And Domain Category Label Removal

### Original Task Brief
- Remove the `uncategorised` subtitle shown below every App and Domain name in the `/reports` API Summary.
- Keep the change frontend-only.

### Changed Files
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`

### Implementation Summary
- Removed the category subtitle from the shared App/Domain summary card presentation.
- Preserved names, durations, expand controls, report data, and component interfaces.

### Verification And Boundaries
- `pnpm.cmd --filter @workmap/web lint`: passed.
- Manual browser QA was not run.
- No backend, API, database, Prisma, deployment, Desktop Agent, or Browser Extension code changed.

## Reports Browser Extension Start/Stop Presentation

### Original Task Brief
- Simplify the user-facing `/reports` Browser Extension status history so it shows useful start/stop timing instead of raw heartbeat and recovery diagnostics.
- Keep technical diagnostics available in the Browser Extension Options page.
- Do not change Browser Extension tracking or Desktop Agent behavior.

### Changed Files
- `workmap/apps/web/components/reports/ReportSummaryPanel.tsx`
- `workmap/apps/web/test/browser-connection-audit.test.ts`

### Implementation Summary
- Browser audit history now exposes confirmed `RUNNING`/`RESTARTED` transitions as `Extension started`.
- Historical lock, reconnect, request failure, and recovered heartbeat-gap rows are hidden from the user-facing report while remaining stored server-side and available through technical diagnostics.
- A currently unresolved stale connection is presented once as `Extension stopped reporting`, using the server-detected coverage-loss time.
- The UI explicitly states that the exact browser close time and cause cannot be determined.
- Chrome, Edge, and separate browser profiles remain grouped by their own device identity.
- Desktop Agent audit rendering and all Browser Extension collection, queue, policy, Focus, runtime, and upload behavior were intentionally unchanged.

### Verification And Boundaries
- Focused Browser audit tests: 6/6 passed.
- `pnpm.cmd --filter @workmap/web typecheck`: passed.
- `pnpm.cmd --filter @workmap/web lint`: passed.
- `pnpm.cmd --filter @workmap/web build`: passed, with existing Next.js/webpack cache warnings.
- Full Web test suite: 103/106 passed; the 3 failures are pre-existing/concurrent frontend expectations in the Dashboard hero tests (2) and old `WorkMap service unreachable` Desktop wording assertion (1), outside this scoped change.
- `git diff --check`: passed with Windows line-ending warnings only.
- Authenticated manual `/reports` browser QA was not run.

---

## 2026-08-12 Desktop Agent 0.6.12 Capture/Upload Decoupling

### Original Task Brief
- Fully investigate whether the Desktop Agent also needs changes for the same sustained Tracking v2 retry/HTTP 500/502 incident affecting Browser Extension and `/reports`.
- Optimise the Desktop Agent only if there is high-confidence evidence of a client reliability issue; preserve its Focus, idle, open/runtime, privacy, policy and ledger semantics.

### Evidence And Root Cause
- Local safe diagnostics contained 38 same-day retryable sync failures (31 `HTTP 500 / TRACKING_SYNC_INTERNAL`, 7 `HTTP 502`). All 38 were followed by a confirmed sync; pending peaked at 115 and later drained to zero. No same-day terminal rejection or queue-pressure loss was found.
- The SQLite outbox already uses WAL, `synchronous=FULL`, stable event IDs and acknowledgement-before-delete semantics. Normal retry/backoff therefore did not delete durable intervals.
- The structural Desktop risk was different: native Windows events, SQLite persistence and up-to-60-second sync HTTP waits shared one `eventChain`. Later foreground/input/lock/suspend events remained only in the in-memory promise queue until the request returned. Local evidence showed interval-end-to-SQLite-create delays of roughly 40–59 seconds during the incident; a crash or power loss in that window could lose the unprocessed tail.
- Periodic policy refresh also awaited remote I/O in the capture lane and had the same risk.

### Changed Files
- `workmap/apps/desktop-agent/src/runtimeV2.ts`
- `workmap/apps/desktop-agent/test/runtime-v2-boundary-serialization.test.ts`
- `workmap/apps/desktop-agent/package.json`
- `workmap/apps/desktop-agent/alpha-windows/package.json`
- `workmap/apps/desktop-agent/scripts/build-alpha.mjs`
- `workmap/apps/desktop-agent/src/version.ts`
- `workmap/apps/desktop-agent/src/windowsActivityHost.ts`
- `workmap/apps/desktop-agent/test/gui-release.test.ts`
- `workmap/apps/desktop-agent/alpha-windows/native/windows-activity-host/publish/workmap-windows-activity-host.exe` (regenerated by the normal build)

### Implementation Summary
- Updated the Desktop Agent to `desktop-agent-windows/0.6.12`.
- Tracking sync is now an independent single-flight network pump. Capture operations finish their local mutation/SQLite commit without awaiting HTTP.
- Sync success, rejection, retry, queue acknowledgement/dead-letter and UI status updates are applied only after re-entering the same serialized mutation lane; store/engine state is not mutated concurrently.
- Policy fetch is also single-flight outside the capture lane. The returned lease or failure is applied as a short serialized mutation and policy-change boundaries remain durable and non-overlapping.
- Existing bounded global backoff, 60-second request timeout, batch size, stable client event IDs, tenant/device identity, policy lease, acknowledgement, allowed windows and durable queue behaviour are preserved.
- Graceful shutdown now drains any prior response application, seals the final local boundary, records lifecycle status, makes one final sync attempt even during normal backoff, waits for its serialized application, and only then closes SQLite.
- No Desktop Focus/idle threshold, App identity, open/runtime definition, privacy boundary or Reports aggregation rule changed.

### Verification
- Desktop Agent tests: 77/77 passed, including real fake-host sequences proving that foreground, trusted input and lock boundaries persist while sync transport is deliberately unresolved, plus a slow-policy non-blocking test.
- Desktop Agent typecheck: passed.
- Desktop Agent lint: passed.
- Desktop Agent build (native Windows host, TypeScript and alpha package): passed.
- Desktop Agent `release:windows`: passed after the sandboxed first attempt was blocked from downloading an Electron Windows dependency and the approved network retry succeeded.
- Windows NSIS installer: `workmap/artifacts/desktop-agent/WorkMap-Desktop-Agent-Setup-0.6.12.exe`, 115,434,006 bytes, SHA-256 `98CA4F960E61AFA62E513F30C4A47CC2F63C7BD5F90616EAD07A5881317D0AF2`; installer file/product version `0.6.12`. Authenticode status is `NotSigned`.
- Repository `git diff --check`: passed; Windows line-ending warnings only.

### Manual QA, Boundaries And Next Steps
- The 0.6.12 NSIS installer and blockmap were generated locally, but the installer was not installed over the currently running 0.6.11 Agent. No production deployment or real Windows slow-network/crash QA was performed.
- No installer was published or uploaded. The unsigned installer may trigger Windows SmartScreen and is not a signed broad-production release until the normal code-signing process is completed.
- API transaction pressure remains the primary source of the observed 500/502 responses and must still be deployed/verified separately. The Desktop fix prevents that server latency from blocking local durability; it does not conceal or locally manufacture a successful server result.
- Normal network failure can still delay Reports until the durable queue drains. An abrupt OS/process loss can never prove time after the last local observation, but this patch removes the avoidable HTTP-sized in-memory capture backlog.
