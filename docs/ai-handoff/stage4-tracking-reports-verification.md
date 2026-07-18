# STAGE 4 Tracking + Reports Verification

> Historical verification document. Its harness/scaffold descriptions no longer
> represent the current client code. Use
> [`docs/designs/workmap-tracking-clients-final-implementation-plan.md`](../designs/workmap-tracking-clients-final-implementation-plan.md)
> as the implementation source of truth.

This document adds the tracking/report verification gate to STAGE 4. STAGE 4 is not complete unless the activity summary loop is verified without overstating the desktop-agent or browser-extension scaffolds as production-ready tracking.

## Scope

Verify:

- Desktop-agent app usage harness.
- Browser-extension domain usage scaffold.
- Authenticated activity event ingestion API.
- Device registration and heartbeat.
- App usage summaries.
- Domain usage summaries.
- Owner company aggregate reports.
- Employee own reports.
- Compliance explanation.
- Tenant/user access boundaries and Platform Admin privacy boundary.

## Current Client Reality

Desktop agent:

- Package: `apps/desktop-agent`.
- Current state: no-dependency Node/TypeScript harness.
- Can register a device, send heartbeat, and submit one or more sample app usage events to the API when configured with `WORKMAP_API_BASE_URL` and `WORKMAP_AGENT_TOKEN`.
- It is not production active-window tracking. It has no native active-window collector, pairing UX, durable offline queue, retry/backoff, packaging, revocation flow, or installer.

Browser extension:

- Package: `apps/browser-extension`.
- Current state: local MV3 scaffold.
- Can track focused active-tab hostname duration and submit domain usage to the API when local extension storage contains API URL, auth token, and optional device id.
- It stores hostnames only through the helper path. It is not production packaged/store-ready tracking and lacks production pairing, token lifecycle, offline queueing, retry/backoff, permissions review, CORS/origin hardening, and deployed extension QA.

## Automated Verification Commands

Run from `workmap/`:

- `pnpm --filter @workmap/desktop-agent test`
- `pnpm --filter @workmap/desktop-agent typecheck`
- `pnpm --filter @workmap/desktop-agent lint`
- `pnpm --filter @workmap/desktop-agent build`
- `pnpm --filter @workmap/browser-extension test`
- `pnpm --filter @workmap/browser-extension typecheck`
- `pnpm --filter @workmap/browser-extension lint`
- `pnpm --filter @workmap/browser-extension build`
- `pnpm --filter @workmap/api test`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api build`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web build`
- `git diff --check`
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, build outputs, `*.tsbuildinfo`, `docs/references`, and reference-only/generated folders.

## Local API Closed-Loop Verification

When a local database, migrations, seed data, and API env are available:

1. Ensure migration `20260609000000_stage2_activity_source` is applied.
2. Start API from `workmap/`: `pnpm --filter @workmap/api dev`.
3. Get an owner token and an employee token through `POST /auth/dev-token` or pilot login. Do not paste real bearer tokens into chat or docs.
4. As employee, call `POST /devices/register`.
5. As employee, call `POST /devices/heartbeat`.
6. As employee, call `POST /activity/app-usage` with one desktop-app event.
7. As employee, call `POST /activity/domain-usage` with one browser-domain event.
8. Confirm `GET /reports/usage-summary` returns own app/domain rows for the employee.
9. Confirm `GET /reports/usage-summary?scope=company` returns `403` for the employee.
10. Confirm owner `GET /reports/usage-summary?scope=company` returns aggregate app/domain rows and device coverage.
11. Confirm unauthenticated activity/report/device requests return unauthorized through `RequestContextGuard`.
12. Confirm Platform Admin pages/endpoints show only tenant metadata/health/audit summaries and do not expose employee app/domain details by default.

## Acceptance Matrix

| Requirement | Verification expectation |
|---|---|
| App usage event can be produced or simulated | `@workmap/desktop-agent` test proves harness posts register, heartbeat, and app usage payloads; live loop can be run with configured local token. |
| Domain usage event can be produced or simulated | `@workmap/browser-extension` test proves hostname-only extraction and domain usage event payload generation. |
| Backend accepts valid activity event | `@workmap/api` test verifies valid app/domain ingest writes events and summary rows through service-level loop. |
| Backend rejects unauthenticated activity access | Source-level guard check verifies activity/devices/reports controllers use `RequestContextGuard`; live API smoke should confirm 401/403. |
| Backend rejects cross-tenant activity access | `@workmap/api` test verifies device heartbeat/reuse and activity ingestion reject devices outside authenticated tenant/user. |
| Owner reports show company aggregates | `@workmap/api` test verifies owner `scope=company` summary aggregates app/domain rows. |
| Employee reports show own summaries | `@workmap/api` test verifies employee default summary returns own app/domain rows. |
| Employee cannot access company reports | `@workmap/api` test verifies employee `scope=company` throws forbidden. |
| Platform Admin does not see employee activity by default | `@workmap/api` test verifies platform tenant health returns counts/latest timestamp only and does not expose app/domain details. |
| Compliance explanation is explicit | `/compliance` copy and acknowledgement modal state collected app/domain duration and explicitly exclude screenshots, screen recordings, keystrokes, clipboard, webcam/microphone, private message/email body, webpage body/form inputs/passwords. |

## Production Gaps To Keep Honest

- Desktop-agent remains a harness, not production active-window tracking.
- Browser extension remains a local MV3 scaffold, not production extension distribution.
- Local service tests do not replace deployed Vercel/Render/Supabase/Cognito authenticated smoke.
- Live API/DB loop requires local or deployed env, migrated database, seeded/test users, and bearer tokens handled outside chat/docs.
- Platform Admin remains read-only and privacy-safe; it does not provide employee activity drill-down by default.
