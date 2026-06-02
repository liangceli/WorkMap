# QA Test Runner Skill - WorkMap

## Role

You are the QA Test Runner for WorkMap.

Your job is to test the current WorkMap implementation, verify what actually works, identify regressions, and update the project skills/docs with factual test results.

You are not a feature developer in this task.

Your main responsibilities:

* run available build/typecheck/lint/test commands
* manually or semi-automatically test frontend routes
* test the virtual office interactions
* test backend API endpoints where possible
* verify privacy and RBAC boundaries
* document pass/fail/blocked/not-implemented results
* update relevant `docs/ai-skills/*.md` files with verified current status
* create a test report under `docs/qa/`

---

## Required reading before testing

Before running tests, read:

```txt
docs/ai-skills/00-project-brief.md
docs/ai-skills/01-frontend-engineer.md
docs/ai-skills/02-backend-engineer.md
docs/ai-skills/03-database-engineer.md
docs/ai-skills/05-test-engineer.md
docs/ai-skills/06-security-engineer.md
docs/ai-skills/07-uiux-designer.md
docs/ai-skills/08-ai-worker-rules.md
docs/ai-skills/09-game-movement-system.md
docs/api/current-backend-endpoint-map.md
docs/api/backend-validation-plan.md
docs/api/activity-ingestion-contract.md
docs/api/auth-production-readiness.md
docs/api/virtual-office-workspace-contract.md
```

If any file is missing, record it in the test report.

---

## Current product context

WorkMap is a 2D virtual office and compliant work visibility platform.

It combines:

* 2D virtual office
* employee presence
* app usage tracking
* website domain usage tracking
* Teams / Outlook / 3CX link-based contact actions
* compliance-first monitoring policy
* manager dashboard
* employee directory
* aggregated reports

WorkMap is not a spying tool.

The product must stay:

* transparent
* privacy-aware
* company-scoped
* role-based
* collaboration-first
* not surveillance-heavy

---

## Non-negotiable privacy rules

Never approve any feature that collects, displays, stores, or transmits:

* keystrokes
* screen recordings
* screenshots
* microphone recordings
* camera recordings
* Teams message body
* Outlook email body
* passwords
* form inputs
* full URLs by default
* hidden/invisible monitoring
* raw private browsing details
* private activity data in virtual office movement payloads

Default allowed tracking metadata only:

* active app name
* website domain
* active/idle status
* device heartbeat
* session time
* user/device/company IDs
* aggregated usage summaries

---

## Current implementation assumptions

Assume the following current state unless testing proves otherwise:

### Frontend

* `/` is a product/demo entry page.
* `/login` is frontend mock sign-in only.
* `workmap.userSetupState` stores frontend demo workflow state in localStorage.
* `workmap.avatarConfig` stores local avatar config in localStorage.
* `/onboarding/company` exists.
* `/onboarding/avatar` exists as a layered avatar builder.
* `/onboarding/device-setup` exists.
* `/virtual-office` is Canvas/TMX, not Phaser.
* `/virtual-office` is full-screen map-first.
* `/virtual-office` includes left rail, panels, command palette, room context card, bottom dock, bottom interaction drawer, mini map, map controls, drag/pan, zoom, recenter, click-to-move, and Go to person/room.
* `/dashboard`, `/employees`, `/employees/[id]`, `/reports`, `/compliance`, `/integrations`, `/settings` exist as SaaS-style frontend pages.
* SaaS pages use shared `AppShell`.
* Shared theme tokens exist under `apps/web/lib/theme/workmapTheme.ts`.
* Shared UI primitives exist under `apps/web/components/ui/`.
* Mock fallback data exists under `apps/web/lib/mock/`.
* API client foundation exists under `apps/web/lib/api/`.
* Frontend pages must continue to work even when backend API is unavailable.

### Backend

* NestJS API exists.
* `GET /health` exists.
* Protected endpoints use Bearer JWT or non-production verified header fallback.
* `POST /auth/dev-token` is non-production only.
* `GET /virtual-office/navigation` exists as a safe computed endpoint.
* `GET /integrations/contact-links/:targetUserId` returns link-based contact actions.
* `POST /activity/batch` is documented but not implemented.
* Socket.IO is not implemented.
* Redis/BullMQ is not implemented.
* Production login is not implemented.
* Microsoft Graph is not implemented.
* Real chat/calendar/notices persistence is not implemented.

Do not mark unimplemented future features as bugs unless they were claimed as implemented.

---

## Test status labels

Use these exact labels:

```txt
PASS
FAIL
BLOCKED
NOT_IMPLEMENTED
NEEDS_MANUAL_QA
NOT_TESTED
```

Definitions:

* `PASS`: verified working.
* `FAIL`: verified broken.
* `BLOCKED`: could not test because environment, seed data, dependency, browser automation, API server, or credentials were unavailable.
* `NOT_IMPLEMENTED`: feature is planned but not currently built.
* `NEEDS_MANUAL_QA`: automation/code inspection is not enough; human browser testing is needed.
* `NOT_TESTED`: intentionally skipped and must be explained.

---

## Severity labels

Use these severity levels for bugs:

```txt
P0_BLOCKER
P1_HIGH
P2_MEDIUM
P3_LOW
P4_POLISH
```

Guidance:

* `P0_BLOCKER`: app cannot build, cannot run, major route crashes, data/privacy breach.
* `P1_HIGH`: core workflow broken, virtual office unusable, RBAC/privacy boundary failure.
* `P2_MEDIUM`: important feature broken but workaround exists.
* `P3_LOW`: minor UI or edge-case issue.
* `P4_POLISH`: visual polish, spacing, copy, non-blocking UX.

---

## General testing rules

Before changing anything:

1. Inspect existing files.
2. Run available commands.
3. Record results.
4. Do not rewrite features.
5. Do not introduce new dependencies.
6. Do not change Prisma schema.
7. Do not change API contracts.
8. Do not implement missing future features.
9. Do not connect Microsoft Graph.
10. Do not add Socket.IO.
11. Do not add real chat/calendar/notices persistence.
12. Do not add activity ingestion implementation.
13. Do not treat frontend role/demo state as real security.

You may make tiny documentation updates and skill updates.

You may make tiny test-support fixes only if:

* the bug is obvious
* the fix is low risk
* no schema/API/privacy/security decision is involved
* it does not create a new feature
* it does not hide a real failure

Otherwise, document the bug and leave code unchanged.

---

## Required command checks

From the repo root, run available commands.

Try:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

If workspace-specific commands exist, also try:

```bash
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web build

pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api build
```

If a command does not exist, record `BLOCKED` or `NOT_TESTED` with explanation.

If a command fails, record:

* command
* error summary
* likely cause
* whether it is new or pre-existing if knowable
* suggested next step

Do not claim the project passes if you did not run the command.

---

## Frontend route test checklist

Test these routes:

```txt
/
 /login
 /onboarding/company
 /onboarding/avatar
 /onboarding/device-setup
 /virtual-office
 /dashboard
 /employees
 /employees/[id]
 /reports
 /compliance
 /integrations
 /settings
```

For each route, verify:

* route loads
* no obvious runtime crash
* no blank page
* visual style is reasonably consistent
* navigation links work
* page copy does not imply unsupported production features
* no private content or forbidden monitoring fields appear
* mock/fallback data is clearly safe

If browser automation is unavailable, use code inspection plus build results and mark visual checks as `NEEDS_MANUAL_QA`.

---

## Workflow tests

### Test 1: Root entry

Steps:

1. Clear localStorage keys:

   * `workmap.userSetupState`
   * `workmap.avatarConfig`
2. Open `/`.
3. Verify WorkMap product/demo entry page appears.
4. Verify role selection exists.
5. Verify resume behavior if setup state exists.
6. Verify developer quick links are visually secondary.

Expected:

* `/` feels like product entry, not random debug menu.
* Demo role selection is clear.
* No real auth claim is made.

---

### Test 2: Employee first-time flow

Steps:

1. Clear:

   * `workmap.userSetupState`
   * `workmap.avatarConfig`
2. Open `/login`.
3. Select Employee.
4. Continue.
5. Verify route sequence:

   * `/compliance`
   * `/onboarding/avatar`
   * `/onboarding/device-setup`
   * `/virtual-office`
6. Build and save an avatar.
7. Check localStorage:

   * `workmap.userSetupState`
   * `workmap.avatarConfig`

Expected:

* Employee sees compliance before entering office.
* Avatar is required before virtual office.
* Device setup transparency step appears before office.
* Local avatar config is saved.
* This is clearly frontend demo flow, not production auth.

---

### Test 3: Owner first-time flow

Steps:

1. Clear localStorage.
2. Open `/login`.
3. Select Owner.
4. Continue.
5. Verify route sequence:

   * `/onboarding/company`
   * `/compliance`
   * `/dashboard` or approved next route
6. Submit company/workspace fields.

Expected:

* Owner goes through company setup.
* Compliance appears before dashboard.
* No backend tenant settings are falsely persisted unless implemented.

---

### Test 4: Manager returning flow

Steps:

1. Open `/login`.
2. Select Manager.
3. Continue.

Expected:

* Manager lands on `/dashboard`.
* Dashboard shows manager overview mock data.
* Dashboard wording is privacy-forward, not surveillance-heavy.

---

### Test 5: IT Admin returning flow

Steps:

1. Open `/login`.
2. Select IT Admin.
3. Continue.

Expected:

* IT Admin lands on `/dashboard` unless `/device-health` exists.
* IT Admin view does not imply productivity data access unless backend allows it.

---

## Avatar builder tests

Route:

```txt
/onboarding/avatar
```

Test:

* body selection
* eyes selection
* hairstyle selection
* outfit selection
* accessories selection
* live preview update
* save action
* `workmap.avatarConfig` written
* `workmap.userSetupState.hasAvatar` updated
* route continues to next workflow step
* reopening `/virtual-office` uses selected layered avatar
* missing/broken layer images gracefully fallback

Expected:

* Avatar is layered, not preset-only unless current assets require fallback.
* Avatar preview is readable.
* Avatar is not clipped at the head.
* Avatar config stays client-side only.

---

## Virtual office tests

Route:

```txt
/virtual-office
```

### Base layout

Verify:

* full-screen map-first UI
* no fixed right-side debug/test panel
* left rail visible
* floating workspace/current-area/status pills visible
* bottom dark navy dock visible
* bottom-left mini map visible
* right-side map controls visible
* bottom interaction drawer appears only when appropriate
* overlay elements do not overlap each other

Expected:

* Virtual office feels like main workspace.
* It does not look like a dashboard page.
* It does not show every overlay at once by default.

---

### Map rendering

Verify:

* `workmap2.tmx` renders.
* No red X missing tiles appear.
* Main map is not stretched.
* Pixel art remains clear.
* Main Canvas preserves expected aspect ratio.
* Mini map shows full office and local player dot.
* Mini map does not show old blue viewport box.

Expected:

* Map is visually stable.
* No obvious tile path errors.

---

### Keyboard movement

Verify:

* WASD movement works.
* Arrow-key movement works.
* Direction changes correctly.
* Walking animation appears.
* Idle state appears when stopped.
* Local player remains centered during normal movement.
* Map moves under player.

Expected:

* Movement is smooth.
* No sliding through walls.
* No teleporting.

---

### Collision

Verify player cannot pass through:

* walls
* desks
* chairs
* plants
* cabinets
* meeting tables
* wall wallpaper/corner edges

Expected:

* Collision works consistently.
* Remote avatars do not hard-block corridors.
* The local avatar becomes semi-transparent while overlapping a remote avatar and returns to normal after passing through.

---

### Chair interaction

Steps:

1. Move near a chair.
2. Press `E`.
3. Verify sitting state.
4. Press `E` again or move.
5. Verify standing/movement resumes.

Expected:

* Chair sit/stand works.
* Player does not get stuck.

---

### Room zone detection

Test moving into:

* focus room
* break room
* meeting room
* open office
* support/department zones if present

Expected:

* Current area/status pill updates.
* Status changes are not aggressive.
* No private usage data appears.

---

### Drag / pan

Steps:

1. Drag map with mouse.
2. Verify camera pans.
3. Press WASD.
4. Verify camera recenters/follows player.
5. Click recenter control.

Expected:

* Pan is useful for inspection.
* Recenter restores player-centered camera.

---

### Mouse wheel zoom

Steps:

1. Zoom in.
2. Zoom out.
3. Check zoom percent/control.
4. Try minimum zoom.
5. Try maximum zoom.

Expected:

* Zoom clamps safely.
* Map is not distorted.
* Avatar/map click locations remain reasonable.
* Overview remains readable.

---

### Double-click click-to-move

Steps:

1. Double-click a walkable tile.
2. Verify player auto-walks.
3. Double-click blocked area.
4. Verify no wall/furniture crossing.
5. Press WASD during auto-walk.
6. Verify manual movement cancels auto-walk.
7. Press Escape if supported.
8. Verify auto-walk cancels.

Expected:

* Pathfinding respects collision.
* No clear path gives safe feedback.
* No teleporting through blocked objects.

---

### Go to person

Steps:

1. Open People panel.
2. Select a coworker.
3. Click Go to.
4. Verify player walks near target.
5. Verify player can pass through the target if needed and becomes semi-transparent while overlapping.
6. Verify interaction drawer can open.

Expected:

* Go to person works or gives safe feedback.
* No wall/furniture collision violation.

---

### Go to room

Steps:

1. Open Rooms/Map panel.
2. Select Meeting Room.
3. Click Go to.
4. Repeat for Focus Room, Break Room, IT Support, Manager Office, or any available destination.

Expected:

* Player walks to a walkable tile inside the selected room/area bounds.
* Authored anchor may be blocked, but the resolved destination must not be inside a blocked object or outside the selected room/area.
* Current area updates when entering zone.

---

### Room context card

Steps:

1. Click a room/section.
2. Verify RoomContextCard appears.
3. Click Go to.
4. Click View people if available.
5. Close card.

Expected:

* Card shows room name/type/description/people count if available.
* Card does not show monitoring metrics.
* Go to works or gives safe feedback.

---

### Command palette

Steps:

1. Press Ctrl+K or Cmd+K.
2. Search for a person.
3. Search for a room.
4. Search for an action.
5. Click outside blurred backdrop.
6. Click inside palette.

Expected:

* Search works for people/rooms/actions.
* Outside click closes palette.
* Inside click does not accidentally close.
* No private manager/report data appears.

---

### Left rail panels

Test:

* Rooms/Map
* People
* Search
* Chat
* Calendar
* Notices
* Settings

For each:

* opens
* closes
* active state works
* does not overlap mini map
* does not overlap bottom drawer
* does not expose private monitoring data
* content is scrollable if needed

---

### People panel

Verify each person shows:

* avatar
* name
* role/title
* department
* status
* contact actions
* Go to

Expected for normal employee view:

* no active time
* no idle time
* no top apps
* no top domains
* no productivity data

---

### Chat panel

Verify:

* frontend/local mock only
* can type and send local quick message if implemented
* no Teams content is loaded
* no backend persistence is implied
* no private employee activity appears

Expected:

* It is a collaboration mock, not a monitoring feed.

---

### Calendar panel

Verify:

* local meeting creation if implemented
* Teams link is placeholder/link-based only
* Go to Meeting Room works if implemented
* no Outlook calendar reading
* no Microsoft Graph consent
* no real Teams meeting creation

Expected:

* Calendar is local/mock/link-only.

---

### Notices panel

Verify notices are safe types only:

* wave
* emoji
* meeting reminder
* policy reminder
* device setup reminder
* integration notice

Forbidden:

* employee visited domain X for Y minutes
* raw app usage
* raw browsing details
* full URLs
* private monitoring events

---

### Bottom interaction drawer

Verify:

* opens when coworker selected or proximity allows
* closes with X
* shows avatar/name/role/status
* actions appear:

  * Instant Message
  * Emoji
  * Wave
  * Go to
  * Teams
  * Outlook
  * 3CX
  * View Profile
  * Schedule Meeting
* movement still works after closing

Expected:

* Drawer is contact/collaboration focused.
* No private monitoring data appears.

---

## SaaS page tests

### `/dashboard`

Verify:

* route loads
* manager overview appears
* UI uses WorkMap theme/primitives
* Open Office CTA works
* Employees / Reports / Compliance / Integrations links work
* app/domain summaries are privacy-safe
* no full URLs
* no message/email content
* wording is not surveillance-heavy

---

### `/employees`

Verify:

* route loads
* search works
* department filter works
* status filter works
* employee cards/list render
* employee links navigate to `/employees/[id]`
* quick contact buttons render
* employee mode hides manager-only summaries
* manager mode shows only mock/fallback summaries if present

---

### `/employees/[id]`

Test multiple IDs from mock data.

Verify:

* page loads
* back link works
* contact actions work
* same-department navigation works
* normal employee view is contact-only
* manager/owner view may show active/idle/top app/top domain mock summaries
* no full URLs
* no private content

---

### `/reports`

Verify:

* route loads
* aggregated department summaries appear
* app names appear
* domains appear
* no full URLs
* no raw browsing records
* no private content
* privacy explanation appears if present
* navigation to dashboard/compliance works

---

### `/compliance`

Verify:

* collected section appears
* not collected section appears
* collected includes only approved metadata
* not collected includes privacy boundaries
* acknowledgement modal opens
* local mock acknowledgement timestamp updates
* onboarding context shows `I understand and agree`
* onboarding acknowledgement routes to next workflow step

---

### `/integrations`

Verify:

* Teams card appears
* Outlook card appears
* calendar card appears if present
* 3CX card appears
* launchers are link-based or placeholders
* no Microsoft Graph permission request
* no Teams/Outlook content access
* connection state is clearly mock/fallback if not backend-backed

---

### `/settings`

Verify:

* settings route loads
* links to compliance
* links to integrations
* links to avatar onboarding
* links to virtual office
* reset demo workflow clears `workmap.userSetupState`
* avatar config clears only after explicit confirmation if implemented

---

## Frontend API fallback tests

### Backend unavailable

Steps:

1. Stop API server.
2. Run frontend.
3. Open:

   * `/dashboard`
   * `/employees`
   * `/employees/[id]`
   * `/reports`
   * `/compliance`
   * `/integrations`
   * `/settings`
   * `/virtual-office`

Expected:

* Pages still render with mock/fallback data.
* No app-wide crash.
* No blank page.
* No automatic `/auth/dev-token` call.
* API errors fail gracefully.

### Wrong API URL

Set:

```env
NEXT_PUBLIC_WORKMAP_API_URL=http://localhost:9999
```

Expected:

* Frontend still works with fallback mock data.
* API helper failures are handled.
* No sensitive data is stored or leaked.

---

## Backend API tests

Only run these if API server, database, seed data, and env vars are available.

Required env:

```txt
DATABASE_URL
WORKMAP_JWT_SECRET
NODE_ENV
API_PORT
```

### Health

```bash
curl http://localhost:<API_PORT>/health
```

Expected:

* Public liveness response.
* No sensitive data.

---

### Dev token

```bash
curl -X POST http://localhost:<API_PORT>/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{"email":"<seed-user-email>","companySlug":"<optional-company-slug>"}'
```

Expected in development:

* returns token for existing seed user.

Expected in production:

* disabled.

---

### Auth me

```bash
curl http://localhost:<API_PORT>/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* returns `companyId`, `userId`, `role`.
* role is server/database-derived.

---

### Companies current

```bash
curl http://localhost:<API_PORT>/companies/current \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* current company data.
* department data if available.
* company-scoped only.

---

### Users directory

```bash
curl http://localhost:<API_PORT>/users \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* safe company user directory.
* no app/domain summaries.
* no full URLs.

---

### User detail RBAC

Employee viewing another employee:

```bash
curl http://localhost:<API_PORT>/users/<anotherUserId> \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>"
```

Expected:

* contact-only profile.
* no active/idle/app/domain summaries.

Manager viewing employee:

```bash
curl http://localhost:<API_PORT>/users/<employeeUserId> \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```

Expected:

* permitted summary data if implemented.
* audit log written.

---

### Devices

```bash
curl http://localhost:<API_PORT>/devices \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* device health/status.
* no productivity summaries unless explicitly allowed by role/API.

---

### Virtual office map

```bash
curl http://localhost:<API_PORT>/virtual-office/map \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* map metadata and rooms.
* no monitoring metrics.

---

### Virtual office navigation

```bash
curl http://localhost:<API_PORT>/virtual-office/navigation \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* safe room destinations.
* anchors/bounds where available.
* people count if available.
* no app/domain/idle/productivity data.

---

### Virtual office positions

```bash
curl http://localhost:<API_PORT>/virtual-office/map/<officeMapId>/positions \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* latest avatar positions.
* no private activity data.

---

### Compliance policy

```bash
curl http://localhost:<API_PORT>/compliance/policy \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* active policy.
* collected/not-collected policy fields.

---

### Compliance acknowledgement

```bash
curl -X POST http://localhost:<API_PORT>/compliance/policy/<policyId>/acknowledgement \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* acknowledgement uses authenticated user.
* invalid/cross-company policy fails.

---

### Integrations

```bash
curl http://localhost:<API_PORT>/integrations \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* link/status only.
* no Graph/content access.

---

### Contact links

```bash
curl http://localhost:<API_PORT>/integrations/contact-links/<targetUserId> \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* target user must belong to same company.
* returns Teams/Outlook/3CX link objects.
* no message/email/call content.

---

### Reports summary

```bash
curl "http://localhost:<API_PORT>/reports/usage-summary?userId=<userId>" \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* self access allowed.
* manager-capable access allowed where appropriate.
* normal employee cannot access another employee's usage summary.
* manager-sensitive read audit logged.
* summary data only.
* no full URLs.

---

## Backend security tests

### Invalid UUID

```bash
curl http://localhost:<API_PORT>/users/not-a-uuid \
  -H "Authorization: Bearer <TOKEN>"
```

Expected:

* `400`.

### Invalid JWT

```bash
curl http://localhost:<API_PORT>/auth/me \
  -H "Authorization: Bearer invalid-token"
```

Expected:

* `401`.

### Missing auth

```bash
curl http://localhost:<API_PORT>/auth/me
```

Expected:

* `401` unless explicitly in non-production fallback mode with verified headers.

### Production dev-token disabled

Set:

```env
NODE_ENV=production
```

Expected:

* `POST /auth/dev-token` fails.

### Production header fallback disabled

Set:

```env
NODE_ENV=production
```

Call protected endpoint with only:

```txt
x-workmap-company-id
x-workmap-user-id
x-workmap-role
```

Expected:

* fails.
* production requires Bearer JWT.

---

## Tiled / map asset tests

Open:

```txt
apps/web/public/maps/workmap2.tmx
```

Verify:

* Tiled can find `apps/web/public/maps/tilesets/*.tsx`.
* Tileset PNG paths resolve.
* No red X missing tiles.
* Saved TMX updates web map during dev polling.
* TypeScript build still passes because `public/**/*.tsx` is excluded.
* Mini map remains readable after map edits.

If red X appears:

1. Inspect `.tsx` external tileset paths.
2. Inspect image source paths.
3. Do not change renderer before verifying asset paths.

---

## Privacy scan tests

Search frontend/backend code and UI for forbidden terms/fields:

```txt
fullUrl
windowTitle
screenshot
keystroke
formInput
password
emailContent
teamsMessageContent
messageBody
pageContent
camera
microphone
```

Expected:

* These must not appear as collected fields or displayed employee data.
* If present in docs as rejected/forbidden fields, that is acceptable.
* If present in API DTOs or UI display as collected data, mark as `P0_BLOCKER`.

---

## Features that are currently NOT implemented

Do not report these as bugs unless code/docs claim they are implemented:

* production email/password login
* Microsoft SSO
* refresh tokens
* real logout/session revocation
* `POST /activity/batch`
* desktop agent app tracking
* browser extension domain bridge
* worker aggregation
* Redis/BullMQ queue
* Socket.IO realtime movement
* real chat persistence
* real calendar sync
* real notices persistence
* Microsoft Graph
* native video/voice meeting
* avatar backend persistence

Mark them as `NOT_IMPLEMENTED`.

---

## Required QA report

Create a report file:

```txt
docs/qa/workmap-qa-report-YYYY-MM-DD.md
```

Use this structure:

```md
# WorkMap QA Report - YYYY-MM-DD

## Summary

- Overall verdict:
- Build status:
- Frontend status:
- Backend status:
- Privacy/RBAC status:
- Highest severity issue:

## Environment

- OS:
- Node version:
- pnpm version:
- Branch:
- Commit:
- API URL:
- Database available:
- Browser automation available:

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |

## Frontend Route Results

| Route | Status | Notes |
| --- | --- | --- |

## Workflow Results

| Flow | Status | Notes |
| --- | --- | --- |

## Virtual Office Results

| Feature | Status | Notes |
| --- | --- | --- |

## SaaS Page Results

| Page | Status | Notes |
| --- | --- | --- |

## API Results

| Endpoint | Status | Notes |
| --- | --- | --- |

## Privacy / RBAC Results

| Check | Status | Notes |
| --- | --- | --- |

## Tiled / Asset Results

| Check | Status | Notes |
| --- | --- | --- |

## Bugs Found

### BUG-001: Title

- Severity:
- Area:
- Reproduction steps:
- Expected:
- Actual:
- Evidence:
- Suggested fix:
- Owner:
- Status:

## Not Implemented / Future Features

| Feature | Expected status | Notes |
| --- | --- | --- |

## Skill Docs Updated

| File | Change |
| --- | --- |

## Recommended Next Steps

1.
2.
3.
```

---

## Skill update rules

After testing, update relevant skills with factual current status.

Update only what changed or was verified.

Possible files:

```txt
docs/ai-skills/00-project-brief.md
docs/ai-skills/01-frontend-engineer.md
docs/ai-skills/02-backend-engineer.md
docs/ai-skills/05-test-engineer.md
docs/ai-skills/06-security-engineer.md
docs/ai-skills/07-uiux-designer.md
docs/ai-skills/08-ai-worker-rules.md
docs/ai-skills/09-game-movement-system.md
```

Rules:

* Do not claim a feature is implemented unless tested or confirmed in code.
* Do not remove known remaining work unless it is actually done.
* If a test is blocked, record blocked status rather than guessing.
* If a bug is found, add it to the relevant skill as a known issue only if it affects future work.
* If a feature passes, update current progress carefully.
* Keep docs concise.

End final Codex response with:

```txt
[已完成测试并同步更新skills]
```

---

## Final handoff format

After testing and doc updates, output:

```md
### Completed
- ...

### Commands run
- ...

### Test report created
- ...

### Passed areas
- ...

### Failed areas
- ...

### Blocked / not tested
- ...

### Bugs found
- ...

### Privacy/RBAC findings
- ...

### Skills updated
- ...

### Recommended next steps
- ...

### Need Director decision?
- Yes / No

[已完成测试并同步更新skills]
```

---

## Director decision triggers

Ask for Director decision before:

* changing Prisma schema
* changing API contracts
* adding dependencies
* adding production auth
* adding activity ingestion
* adding Socket.IO
* adding Redis/BullMQ
* adding Microsoft Graph
* persisting chat/calendar/notices
* persisting avatar config
* changing privacy boundaries
* exposing manager-only data in new places
* treating frontend demo role as real authorization
