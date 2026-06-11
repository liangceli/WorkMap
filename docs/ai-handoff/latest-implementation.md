# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 7: Desktop Agent + Browser Extension Domain Tracking + Reports/Compliance Full Loop.

Implement the full WorkMap activity tracking loop for app usage and browser domain usage:

- Desktop Agent tracks active desktop app usage time and sends tenant/user/device-scoped activity events.
- Browser Extension tracks active browser tab domain usage time and sends tenant/user/device-scoped domain events.
- Backend validates, stores, and aggregates activity.
- Reports, Dashboard, and Compliance show transparent, role-aware summaries.

WorkMap must remain a transparent work visibility platform, not secret spyware. Do not implement screenshots, screen recording, keystroke logging, clipboard logging, webcam/microphone monitoring, private message/email reading, full URL/page-content capture, deployment troubleshooting, billing, map expansion, or virtual-office rewrites.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/prisma/schema.prisma` | Added `ActivityEventSource` and `ActivityEvent.source` so persisted events explicitly distinguish desktop-agent vs browser-extension source. |
| `workmap/prisma/migrations/20260609000000_stage2_activity_source/migration.sql` | Adds the source enum/column/index and backfills existing `BROWSER` rows as `BROWSER_EXTENSION`. |
| `workmap/apps/api/src/modules/activity/activity.controller.ts` | Added authenticated ingestion endpoints for app and domain usage. |
| `workmap/apps/api/src/modules/activity/activity.service.ts` | Validates device binding, app/domain labels, timestamps, durations, idle flags, and writes events plus usage summaries. |
| `workmap/apps/api/src/modules/activity/activity.module.ts` | Registers the activity controller/service. |
| `workmap/apps/api/src/modules/devices/devices.controller.ts` | Added `POST /devices/register` and `POST /devices/heartbeat`. |
| `workmap/apps/api/src/modules/devices/devices.service.ts` | Added tenant/user-scoped device registration, binding checks, heartbeat update, and input sanitization. |
| `workmap/apps/api/src/modules/reports/reports.controller.ts` | Added `scope` query support for usage summary. |
| `workmap/apps/api/src/modules/reports/reports.service.ts` | Added own/user/company aggregate summary behavior with RBAC and device coverage metadata. |
| `workmap/apps/web/lib/api/apiTypes.ts` | Added activity/device response types and extended usage summary shape. |
| `workmap/apps/web/lib/api/activityApi.ts` | New frontend API wrapper for app/domain usage ingestion. |
| `workmap/apps/web/lib/api/devicesApi.ts` | New frontend API wrapper for device list/register/heartbeat. |
| `workmap/apps/web/lib/api/reportsApi.ts` | Added `scope=user/company` query support. |
| `workmap/apps/web/lib/api/apiAuth.ts` | Carries resolved role in API auth result so frontend can request conservative report scope. |
| `workmap/apps/web/lib/api/developmentApiAuth.ts` | Stores/validates role in development auth cache. |
| `workmap/apps/web/components/reports/ReportSummaryPanel.tsx` | Requests role-aware report scope and shows API-backed app/domain/device coverage summaries. |
| `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx` | Requests role-aware report scope and shows tracking coverage readiness. |
| `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx` | Updated transparency copy for app usage, domain usage, device heartbeat, and non-collected data. |
| `workmap/apps/web/components/compliance/PolicyAcknowledgementModal.tsx` | Updated acknowledgement modal to match app/domain/device tracking boundaries. |
| `workmap/apps/desktop-agent/src/index.ts` | Replaced placeholder with a no-dependency desktop-agent harness for registering a device, heartbeating, and submitting one sample app usage event. |
| `workmap/apps/browser-extension/manifest.json` | Added Manifest V3 scaffold for domain-duration tracking. |
| `workmap/apps/browser-extension/src/background.ts` | Added active-tab hostname duration tracking scaffold; stores domains only and posts batches when configured. |
| `workmap/.env.example` | Added blank local harness placeholders and browser extension storage key notes. No real secrets were added. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified.

## 3. Implementation Summary

Implemented the Round 7 safe first activity tracking loop using existing WorkMap architecture.

Core behavior:

- Backend now accepts authenticated app usage events at `POST /activity/app-usage`.
- Backend now accepts authenticated browser domain usage events at `POST /activity/domain-usage`.
- Backend now supports `POST /devices/register` and `POST /devices/heartbeat`.
- Activity writes always resolve `companyId` and `userId` from `RequestContextGuard`.
- Client-supplied `companyId`, `tenantId`, `userId`, and `role` are not trusted.
- Device IDs are accepted only as binding keys and must belong to the authenticated user and tenant.
- Events are persisted in `ActivityEvent` and increment `AppUsageSummary` / `WebsiteUsageSummary`.
- Reports can return own/user summaries or role-allowed company aggregate summaries.
- Dashboard and Reports use backend-backed summaries where available.
- Compliance copy now accurately describes app/domain/device tracking and explicit non-tracking boundaries.

No screenshots, screen recording, keystrokes, clipboard, webcam/microphone, private message/email content, full URL paths/queries, page body content, billing, deployment troubleshooting, or virtual-office rewrite was added.

## 4. Data Model / Migration Changes

Existing models were reused:

- `Device`
- `ActivityEvent`
- `AppUsageSummary`
- `WebsiteUsageSummary`

Minimal schema addition:

- `ActivityEventSource`
  - `DESKTOP_AGENT`
  - `BROWSER_EXTENSION`
- `ActivityEvent.source`
  - default `DESKTOP_AGENT`
  - indexed by `[companyId, source, startedAt]`

Migration:

- `workmap/prisma/migrations/20260609000000_stage2_activity_source/migration.sql`

Migration notes:

- Run the repo's normal migration flow before manual QA against a database.
- `pnpm prisma:generate` was run and passed after clearing local Prisma DLL locks.
- No seed change was made.

## 5. Backend Ingestion / Device Binding

Device endpoints:

- `POST /devices/register`
  - body: optional `deviceId`, `os`, `hostname`, `agentVersion`
  - backend writes authenticated `companyId` and `userId`
  - rejects a supplied `deviceId` if it already belongs to another tenant/user
- `POST /devices/heartbeat`
  - body: `deviceId`, optional `agentVersion`
  - updates `lastSeenAt` only for the authenticated user's own device

Activity endpoints:

- `POST /activity/app-usage`
  - body: one event or `{ events: [...] }`
  - fields include `deviceId`, `appName`, `startedAt`, `endedAt` or duration, optional `isIdle`
  - source persisted as `DESKTOP_AGENT`
  - event type persisted as `APP`
- `POST /activity/domain-usage`
  - body: one event or `{ events: [...] }`
  - fields include `deviceId`, `domain`, `browserName`, `startedAt`, `endedAt` or duration, optional `isIdle`
  - source persisted as `BROWSER_EXTENSION`
  - event type persisted as `BROWSER`

Validation:

- batch size max 50 events
- device must be registered to current authenticated user and company
- duration must be positive and <= 12 hours
- timestamps cannot be older than 31 days or more than 5 minutes in the future
- app labels are sanitized and capped
- domain input is normalized to hostname only
- full URL paths, query strings, fragments, and page content are not stored

## 6. Reports / Dashboard / Compliance

Reports:

- `GET /reports/usage-summary`
  - default/user scope returns current user's own data or an explicitly requested same-tenant user if RBAC allows
  - `scope=company` returns tenant aggregate app/domain rows only when `canViewTeamReports()` allows it
  - company scope does not return raw employee activity rows
  - device coverage metadata is included: registered devices, active devices in 24h, users with activity rows

Frontend behavior:

- Employees request own usage summaries.
- OWNER / MANAGER / TEAM_LEAD / HR_ADMIN request company aggregate summaries.
- IT_ADMIN remains conservative and does not automatically get company app/domain summaries from the frontend.
- Dashboard shows tracking coverage readiness using backend summary metadata.
- Reports show app names and domains only, with device coverage where available.

Compliance:

- Visible collection now explicitly includes active desktop app name/duration, browser domain/duration, timestamps for summaries, device heartbeat, presence/avatar context, and acknowledgement timestamp.
- Non-collected list explicitly includes screenshots, screen recording, keystrokes, clipboard, webcam/microphone, private messages/emails, page body content, full URL paths/queries, form inputs, and passwords.

## 7. Desktop Agent / Browser Extension Status

Desktop Agent:

- Existing `apps/desktop-agent` package existed.
- No Electron/Tauri/native packaging framework was introduced.
- No active-window dependency was added.
- Implemented a no-dependency Node/TypeScript harness:
  - reads `WORKMAP_API_BASE_URL`
  - reads `WORKMAP_AGENT_TOKEN`
  - optionally reads `WORKMAP_AGENT_DEVICE_ID`
  - registers device
  - records heartbeat
  - submits one sample app usage event with `--sample-once`
- This is honest/testable scaffolding, not a production active-window collector.

Browser Extension:

- Existing `apps/browser-extension` package existed.
- Added a Manifest V3 scaffold.
- Background script tracks active tab hostname duration while browser window is focused.
- It stores and posts hostname/domain only, not full URLs or page content.
- Config is read from `chrome.storage.local`:
  - `workmapApiBaseUrl`
  - `workmapAuthToken`
  - `workmapDeviceId`
  - `workmapBrowserName`
- Extension API CORS/origin setup remains a manual/local configuration concern for later hardening.

## 8. Privacy / RBAC / Tenant Isolation Safeguards

- All new backend endpoints use `RequestContextGuard`.
- Backend resolves tenant/user/role from authenticated request context.
- `companyId`, `tenantId`, `userId`, and `role` from clients are ignored.
- Device binding is tenant/user scoped.
- Cross-tenant device reuse is rejected.
- Cross-tenant report target lookup returns not found/forbidden through existing same-tenant checks.
- Employee can see own reports.
- Owner/manager/team/HR roles can see aggregate tenant summaries where `canViewTeamReports()` allows.
- Platform Admin endpoints were not changed and still do not expose employee-level app/domain rows by default.

## 9. Verification Results

Commands run from `workmap/`:

```powershell
pnpm prisma:generate
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/desktop-agent typecheck
pnpm --filter @workmap/browser-extension typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/desktop-agent lint
pnpm --filter @workmap/browser-extension lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
pnpm --filter @workmap/desktop-agent build
pnpm --filter @workmap/browser-extension build
git diff --check
```

Results:

- `pnpm prisma:generate` passed after stopping local WorkMap API/Web node processes that were locking the Prisma Client DLL.
- API typecheck passed.
- Web typecheck passed.
- Desktop-agent typecheck passed.
- Browser-extension typecheck passed.
- API lint passed.
- Web lint passed.
- Desktop-agent lint passed.
- Browser-extension lint passed.
- API build passed.
- Web build passed.
- Desktop-agent build passed after rerunning outside the sandbox because the sandbox returned EPERM creating generated `dist/`.
- Browser-extension build passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan excluding `.env`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` found no high-confidence secret matches.
- Web build still prints the existing Next.js ESLint plugin warning.

Not run:

- The new migration was not applied to a live database in this chat.
- No browser manual QA was run in this chat.
- No deployed Render/Vercel smoke was run, per task scope.

## 10. Manual QA Suggestions

Use local ports consistently:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`

Before manual QA:

1. Apply the new Prisma migration using the repo's normal local migration flow.
2. Restart API after migration.
3. Use an authenticated WorkMap bearer token locally for the desktop-agent/browser-extension harnesses.
4. Do not paste real tokens into chat.

Manual checks:

1. Login as Employee.
2. Register a device with `POST /devices/register`.
3. Submit app usage through `POST /activity/app-usage` or the desktop-agent `--sample-once` harness.
4. Submit domain usage through `POST /activity/domain-usage` or the extension scaffold.
5. Confirm Employee `/reports` shows own app/domain summaries.
6. Login as Owner.
7. Confirm Owner `/reports` shows company aggregate app/domain summaries without raw employee rows.
8. Confirm Owner cannot request another tenant's user report.
9. Confirm non-authorized roles cannot use `scope=company`.
10. Confirm `/dashboard` tracking coverage updates when device/activity rows exist.
11. Confirm `/compliance` and acknowledgement modal explain what is collected and not collected.
12. Confirm Platform Admin does not expose employee-level app/domain details.
13. Confirm invalid `deviceId`, cross-tenant device IDs, bad timestamps, long durations, full URL paths/queries, and malformed domains fail safely.
14. Confirm `/virtual-office`, realtime movement, polling fallback, Employees, tenant onboarding, invites, Reports, Dashboard, Compliance, and Platform Admin smoke pass.

## 11. Risks / Notes

- Desktop-agent is a harness/scaffold, not production active-window tracking.
- Browser extension is a Manifest V3 scaffold; packaging, permissions review, pairing UX, CORS/origin setup, and store distribution remain future work.
- No offline durable queue was added. The harnesses submit directly and should be hardened later.
- No native OS active-window dependency was added, so real app detection remains future work.
- Reports use query-time aggregation from summary tables; no background aggregation worker was added.
- Company aggregate report rows intentionally avoid raw employee-level details.
- No deployed smoke was run.
- WorkMap dev API/Web node processes were stopped to unlock Prisma Client generation and were not restarted automatically.
- `docs/references/` remains unrelated untracked content and should not be staged.

## 12. Docs Update Suggestions

- `docs/skills/backend-skill.md`: document activity ingestion endpoints, device binding, validation bounds, and summary update behavior.
- `docs/skills/api-contract-skill.md`: document `/devices/register`, `/devices/heartbeat`, `/activity/app-usage`, `/activity/domain-usage`, and `scope=company` reports.
- `docs/skills/frontend-skill.md`: document role-aware reports scope and tracking coverage UI.
- `docs/skills/deployment-skill.md`: document future CORS/origin needs for browser extension and secure token/pairing setup.
- `docs/skills/current-status.md`: record Round 7 backend loop, harness/scaffold limitations, and remaining production tracking hardening.

## 13. Next Chat Input

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
