# Latest QA Handoff

## Deferred Final Manual QA - 2026-06-18

The user explicitly deferred the remaining manual checks until all planned functionality is complete. The consolidated checklist is stored in `docs/ai-handoff/deferred-final-manual-qa.md`. Current status: pending by decision, not passed and not failed.

## 0. Online Smoke Update - 2026-06-18

`pnpm smoke:alpha` passed against the existing public deployment:

- API liveness: HTTP 200.
- API readiness/database connectivity: HTTP 200.
- API CORS allowlist: returned exact origin `https://work-map-teal.vercel.app`.
- Frontend home: HTTP 200.
- Frontend login: HTTP 200.
- Frontend virtual office: HTTP 200.
- Frontend platform admin: HTTP 200.
- Derived realtime endpoint: `wss://workmap-api.onrender.com/virtual-office/realtime`.

Online public-route readiness now passes. Authenticated manual Cognito/Owner/Employee/invite/two-user realtime/activity/report/Platform Admin privacy checks remain outstanding before pilot approval.

## 1. Reviewed Implementation

Reviewed the merged STAGE 4 tracking/reports/runtime completion work:

- tracking ingest duplicate handling
- API tracking/report verification tests
- desktop-agent harness payload tests
- browser-extension domain helper tests
- compliance collected/not-collected copy
- report aggregation evidence after ingest
- owner/employee/cross-tenant RBAC and privacy boundaries
- Platform Admin aggregate-only/privacy boundary
- Virtual Office same-tenant wave/message/movement regression
- local route/browser render smoke
- deployment smoke readiness path

## 2. Diff Review Summary

Result: pass for local runtime readiness and tracking/report verification; online deployment smoke remains externally blocked.

The implementation produces real runtime and verification improvements:

- Exact duplicate app/domain usage submissions no longer increment activity summaries twice.
- Package-level tests verify API tracking/report behavior, desktop-agent harness payload production, and browser-extension hostname/domain payload generation.
- A local `pnpm smoke:stage4` harness verifies tracking-to-report behavior, key permission boundaries, and Virtual Office two-user realtime behavior with real local API calls and raw WebSocket events.
- Compliance UI copy now explicitly states app/domain duration collection and required non-collected sensitive categories.

No Clerk, auth migration, 3CX implementation, schema migration, persisted chat, hidden monitoring collection, production desktop tracking, or production browser-extension packaging was added.

## 3. Findings Ordered By Severity

Blocking:

- Online alpha smoke cannot be completed until real deployed Vercel/Render origins and external Cognito/Supabase/Render/Vercel configuration are provided outside chat. `pnpm smoke:alpha` exits with manual env requirements.
- Interactive Browser QA was not completed because the Browser runtime returned `Browser is not available: iab`.

Medium:

- Browser click-level QA could not be completed by Codex; HTTP route smoke and Chrome headless screenshot generation were used as fallback.
- Desktop-agent remains a harness, not production active-window tracking.
- Browser-extension remains a local MV3 scaffold, not production packaged/store-ready tracking.
- The API test uses in-memory/mock Prisma coverage; deployed DB smoke is still required before a deployed Stage 4 completion claim.
- Local API/DB smoke added marked Stage 4 verification device/activity rows to the local development database.

Low:

- Next web build still emits the existing "Next.js plugin not detected in ESLint configuration" warning.
- Virtual Office realtime remains single-process/in-memory and will need shared pub/sub before horizontal scaling.

## 4. Test / Verification Status

Automated tests:

- `pnpm --filter @workmap/api test` - passed.
  - Covers controller guard source checks, device ownership, app/domain ingestion, summary aggregation, Employee own reports, Owner company aggregate reports, Employee company-scope denial, off-tenant target denial, and Platform Admin aggregate-only boundary.
- `pnpm --filter @workmap/desktop-agent test` - passed.
  - Covers register, heartbeat, and app usage payload production with mocked API calls.
- `pnpm --filter @workmap/browser-extension test` - passed.
  - Covers hostname-only URL parsing, non-web URL ignore behavior, minimum duration gating, and domain usage payload creation.

Typecheck/lint/build:

- `node --check scripts\stage4-runtime-smoke.mjs` - passed.
- `pnpm.cmd --filter @workmap/shared-types typecheck` - passed.
- `pnpm.cmd --filter @workmap/web typecheck` - passed.
- `pnpm.cmd --filter @workmap/web lint` - passed.
- `pnpm.cmd --filter @workmap/web build` - passed with existing Next ESLint-plugin warning.
- `pnpm.cmd --filter @workmap/api typecheck` - passed.
- `pnpm.cmd --filter @workmap/api lint` - passed.
- `pnpm.cmd --filter @workmap/api build` - passed.
- `pnpm.cmd --filter @workmap/desktop-agent typecheck` - passed.
- `pnpm.cmd --filter @workmap/desktop-agent lint` - passed.
- `pnpm.cmd --filter @workmap/desktop-agent build` - passed.
- `pnpm.cmd --filter @workmap/browser-extension typecheck` - passed.
- `pnpm.cmd --filter @workmap/browser-extension lint` - passed.
- `pnpm.cmd --filter @workmap/browser-extension build` - passed.

Runtime/local smoke:

- `pnpm.cmd smoke:stage4` - passed.
- `pnpm.cmd smoke:alpha` - blocked by missing deployed URL env vars, not by code failure.
- API `/health` returned 200 on local port `3001`.
- API `/health/readiness` returned database ready.
- Web route smoke returned 200 for `/dashboard`, `/reports`, `/compliance`, and `/virtual-office`.
- `/compliance` HTML contained:
  - `Desktop app name and usage duration`
  - `Browser domain name and usage duration`
  - `Screenshots are not collected`
  - `Screen recordings are not collected`
  - `Keystrokes are not collected`
  - `Clipboard contents are not collected`
  - `Webcam or microphone data is not collected`
  - `Private message or email body content is not collected`
  - `Webpage body, form inputs, and passwords are not collected`

Repo hygiene:

- `git diff --check` - passed with LF-to-CRLF warnings only.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, build outputs, `*.tsbuildinfo`, `docs/references`, and generated/reference folders - no real secrets found; hits were documentation terms/placeholders.

## 5. Runtime Smoke Status

Passed locally against API `3001` and web `3002` where applicable; port `3000` was not used for the final Stage 4 runtime smoke.

Tracking/reporting evidence:

- App event accepted once; duplicate accepted count `0`.
- Domain event accepted once; duplicate accepted count `0`.
- Employee own report showed `120` app seconds and `120` domain seconds for just-ingested rows.
- Owner company report showed `120` app seconds and `120` domain seconds for the same rows.

Permission evidence:

- Unauthenticated activity request rejected with `401`.
- Employee company aggregate rejected with `403`.
- Employee cross-user report rejected with `403`.
- Cross-tenant report rejected with `404`.
- Cross-tenant device ingest rejected with `403`.
- Cross-user heartbeat rejected with `403`.
- Platform tenant endpoint with normal tenant token rejected with `403`.

Virtual Office evidence:

- Two same-tenant users joined the same map.
- Receiver got `teammate:wave` and `teammate:message`.
- Owner observed engineer movement state.
- Cross-tenant target did not receive teammate events; sender got an error.

Product done criteria passed locally:

- App usage event can be produced or simulated through the desktop-agent harness test.
- Domain usage event can be produced or simulated through the browser-extension scaffold helper test.
- Backend accepts valid app/domain activity events in service tests and real local HTTP smoke.
- Backend rejects unauthenticated activity POST in real local HTTP smoke.
- Backend rejects another user's device id in real local HTTP smoke and cross-tenant-style device use in automated tests.
- Owner reports show company aggregate app/domain summaries in real local HTTP smoke.
- Employee reports show own app/domain summaries in real local HTTP smoke.
- Employee cannot access company-wide report scope.
- Platform Admin does not expose employee app/domain activity by default in source/service verification.
- Compliance copy contains required collected/not-collected statements.

## 6. Manual QA Status

Partially completed with automation fallback.

- API health/readiness passed.
- Web routes `/virtual-office`, `/dashboard`, `/reports`, and `/compliance` returned 200.
- Compliance HTML copy assertions passed.
- Chrome headless generated nonzero screenshots for the four routes in the runtime round.
- Full interactive browser click QA was not completed because Browser `iab` was unavailable and Playwright/Puppeteer was not installed.
- Dev servers started during QA were stopped afterward, and temporary `.codex-run` artifacts were cleaned.

Not completed:

- Interactive Browser QA.
- Deployed Vercel/Render/Supabase/Cognito smoke.
- Real Cognito Hosted UI login/register/invite acceptance.
- Store-installed browser-extension QA.
- Production desktop active-window tracking QA.
- Full visual two-user virtual-office browser regression.

## 7. Risks

- Online deployment status is unknown until real public URLs and external env are configured.
- Cognito Hosted UI/register/invite acceptance was not smoke-tested online in this round.
- Employee invite/acceptance flow still needs deployed/manual smoke.
- Browser UI click behavior should be confirmed by a human before pilot.
- Production tracking agent/extension packaging remains a future hardening step.
- Browser-extension helper verifies hostname minimization, but production permissions review, packaging, pairing, token lifecycle, offline queueing, retry/backoff, and deployed CORS/origin hardening remain future work.
- Desktop-agent harness verifies sample app event submission, but it is not a native active-window tracker.
- Local API/DB smoke is strong local evidence but does not replace deployed authenticated smoke.

## 8. Recommendation

Recommendation: proceed to online alpha smoke preparation or human browser QA/fix, not pilot yet.

The local Stage 4 runtime path and tracking/report verification gate are strong enough to move forward with code work. WorkMap should not be presented as deployed alpha-ready until `pnpm smoke:alpha` runs against real Vercel/Render/Cognito/Supabase configuration and browser/manual checks pass.

Next round can proceed if the task is either:

- configure/run online alpha smoke with public deployed origins, or
- perform human browser QA and fix any UI regressions found.
