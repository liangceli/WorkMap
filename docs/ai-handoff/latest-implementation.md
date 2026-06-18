# Latest Implementation Handoff

## Original Task Brief

Complete the final Stage 4 development work: real Windows foreground-app tracking, real MV3 active-domain tracking, secure one-time device pairing, restricted/revocable device credentials, bounded persistent queues, retry/backoff, report-loop verification, and runnable Alpha builds. Preserve Cognito, tenant/RBAC boundaries, Platform Admin privacy, Virtual Office behavior, and all stated data-minimisation rules.

## Changed Files

- `workmap/apps/api/src/modules/activity/activity.service.ts`: retry-safe client event identity and concurrent duplicate handling.
- `workmap/apps/api/src/modules/devices/*`: pairing codes, device credential guard, client-scoped endpoints, pairing status, and revoke behavior.
- `workmap/prisma/schema.prisma` and `workmap/prisma/migrations/20260618000000_stage4_device_pairing/migration.sql`: hash-only pairing/credential persistence, revoke fields, and event idempotency key.
- `workmap/apps/desktop-agent/*`: Windows native foreground/idle/lock adapter, tracking state machine, DPAPI credential storage, persistent queue, heartbeat/upload runtime, status command, and Alpha build.
- `workmap/apps/browser-extension/*`: MV3 service worker, active tab/window/idle tracking, storage/alarms recovery, persistent queue, pairing options UI, dynamic API-origin permission, and load-unpacked build.
- `workmap/apps/web/app/onboarding/device-setup/page.tsx` and `workmap/apps/web/lib/api/*`: authenticated code creation plus pending/paired/expired status UI.
- `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx` and `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx`: copy aligned with the implemented clients and privacy boundary.
- `workmap/apps/{api,desktop-agent,browser-extension}/test/*` and `workmap/scripts/stage4-runtime-smoke.mjs`: unit and integration coverage.

## Implementation Summary

- Desktop runtime now samples the real Windows foreground process through User32 P/Invoke, checks last input and locked desktop state, normalizes only the process/app name, and never reads window titles or content.
- App/domain state machines close segments on switch, idle, lock, focus loss, invalid target, checkpoint, or shutdown; short segments are filtered and delayed samples are capped.
- Both clients use stable UUID event identities, persistent queues capped at 1,000 items and 31 days, exponential backoff capped at five minutes, 4xx discard rules, and distinct 401/403 re-pair state.
- Web creates a ten-minute, single-use, tenant/user/client-bound pairing code. The API returns a device credential once, stores only hashes, and limits that credential to its device heartbeat and matching app/domain ingest endpoint.
- Device revoke invalidates the device and every credential. Report endpoints remain on the existing user auth guard and reject device credentials.
- API idempotency uses `(companyId, source, clientEventId)` and treats concurrent unique conflicts as duplicate acknowledgements without increasing summaries.
- Extension stores hostname only and ignores non-HTTP(S) URLs. It has no content script and requests only storage, tabs, idle, alarms, plus an optional user-approved API origin.

## Role And Access Behavior

- Cognito/current Bearer auth remains unchanged for users.
- Pairing creation/status requires the current authenticated tenant user.
- Credentials are bound to tenant, user, device, and client type; cross-client, cross-user, cross-tenant, report, and company-report access is rejected.
- Device owners and existing authorised device-health roles can revoke visible tenant devices. Revoked credentials return 401.
- Platform Admin privacy boundaries are unchanged.

## Verification Commands And Results

- API, Desktop Agent, and Browser Extension tests: passed (4, 7, and 7 tests).
- `pnpm.cmd --filter @workmap/shared-types typecheck`: passed.
- Web/API/Desktop Agent/Browser Extension typecheck: passed.
- Web/API/Desktop Agent/Browser Extension lint: passed.
- Web/API/Desktop Agent/Browser Extension build: passed.
- `prisma validate`: passed.
- `prisma migrate status`: passed; all 5 migrations applied locally.
- `pnpm.cmd smoke:stage4` against a fresh API process on port 3011: passed.
- Artifact existence/non-empty checks: passed.
- `git diff --check`: passed with CRLF conversion warnings only.
- Source and artifact secret scans: passed.

The runtime smoke proved paired Desktop and Extension ingest, duplicate replay accepted as zero, Employee own report readback, Owner company aggregation, cross-user/cross-tenant rejection, client-type scope, revoke-to-401, and Virtual Office wave/message/movement regression.

## Manual QA

Deferred by user, pending final consolidated manual QA. Real Windows use, Chrome/Edge load-unpacked use, authenticated UI interaction, and final visual/runtime checks were not claimed as passed or failed.

## Intentionally Not Changed

- No Clerk, auth-provider migration, 3CX, persisted chat, content reading, screenshot/recording, keystroke, clipboard, camera/microphone, macOS/Linux agent, store publishing, cloud deployment, or large UI redesign.
- No existing public cloud environment was changed.

## Remaining Risks

- The Windows build requires a supported Node.js runtime and has not yet been exercised in the deferred interactive installation session.
- The MV3 build has not yet been manually loaded in Chrome/Edge.
- Any defects found during consolidated manual QA still require fixes before final deployment.

## Suggested Next Steps

Run the already-deferred consolidated manual QA, fix only defects found there, then perform final deployment and online acceptance.
