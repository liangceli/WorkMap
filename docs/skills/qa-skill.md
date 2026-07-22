# QA Skill

## Browser Extension 0.5.3 QA Baseline

- Execute identity regression: API-supported Browser `workstationId=null` passes; device or Chrome/Edge mismatch fails terminally as `DEVICE_IDENTITY_MISMATCH`.
- Same-path unpacked upgrade should retain pairing. Verify the old false `NETWORK_ERROR` count stops growing, secure heartbeat and policy/lease appear, and `/reports` gains Browser state only after real activation/sync.
- Historical pre-fix diagnostics are not auto-deleted. Judge recovery from new heartbeat, confirmed sync, request ID, and diagnostic timestamps.
- Real Edge and Chrome load-unpacked QA remains mandatory.

## Browser Extension 0.5.2 QA Baseline

- Automated Browser runtime coverage uses a controllable event/time harness for one/two windows, multi-display semantics, same/different-host tabs, Split View, trusted/untrusted/background/iframe evidence, minimization/`WINDOW_ID_NONE`, idle/lock, protected/incognito/excluded pages, SPA/navigation/reload/replace/remove, UTC rollover, restart recovery, lifecycle/clock gaps, permission registration recovery, queue/backoff/pressure, HTTP status classes, and HTTP 200 snapshot/interval rejections.
- API behavior tests must prove Browser Focus active/idle enters the ledger and Domain Reports, rejected rows do not enter totals, tombstones retain safe code/request ID, browser identity is enforced, and Chrome/Edge same-subject overlaps are unioned.
- Real Chrome and Edge load-unpacked QA remains mandatory after automated checks. Record manual work as not run unless the exact browser/version/permission/lifecycle scenario was observed.
- Current known unrelated baselines: full API `48/49` due an aged fixed-date activity fixture; full Web `79/82` due three brittle Reports source/layout assertions. Re-run focused Tracking/Reports tests even while these are open.

## Verification Commands

Run from `workmap/`:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Targeted commands:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Database setup:

- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`

## Manual QA Checklist

- `/login` creates expected demo role workflow.
- `/login` shows `Sign in with Cognito` when root `workmap/.env` provides complete `NEXT_PUBLIC_COGNITO_*` config and the web dev server has been restarted.
- `/login` shows Cognito missing-config guidance when public Cognito env is incomplete, while keeping pilot fallback available.
- `/login/callback` completes Cognito token exchange and backend `/auth/me` mapping for a verified, mapped Cognito user.
- `/login/callback` routes a configured Cognito Platform Admin to `/platform-admin` before tenant onboarding fallback.
- Unmapped Cognito users, unverified email claims, and ambiguous email mappings should fail in a controlled way.
- Clear/sign out Cognito session before verifying pilot fallback after Cognito mapping failure.
- `/login` creates a pilot session with seeded pilot credentials when the backend is running.
- AppShell session state remains clear after refresh and links missing/unclear session states back to `/login`.
- `/dashboard` renders API health, auth/session, remote presence, compliance, and reports readiness with clear live/fallback/error labels.
- `/reports` renders API-backed current-user app/domain rows when available, or clear sparse-data copy when no rows exist.
- `/reports` and `/dashboard` show backend-backed tracking coverage and role-appropriate own/company app/domain summaries when activity data exists.
- EMPLOYEE direct request to `/reports/usage-summary?scope=company` should return 403.
- `/compliance` still loads backend policy and acknowledgement flows under pilot Bearer auth.
- `/compliance` and acknowledgement modal should explain app usage, browser domain usage, device heartbeat, and explicit non-collected data.
- Onboarding routes advance in expected order.
- `/virtual-office` redirects to avatar onboarding when avatar is missing.
- `/virtual-office` loads TMX map and tileset images.
- `/virtual-office` uses the active validated map manifest for TMX path, canvas size, collision layers, render layers, rooms, navigation, and spawn.
- With backend stopped or unavailable, `/virtual-office` still renders through mock fallback without runtime crashes.
- With backend unauthorized, `/virtual-office` keeps mock fallback rather than blocking the page.
- With backend/API available, Network should show `/virtual-office/map`, `/virtual-office/navigation`, and `/virtual-office/map/:officeMapId/positions` attempts.
- In local development, Network should show `POST /auth/dev-token` before virtual-office read calls when no valid cached token exists.
- In local development with backend and seed data available, virtual-office read calls should include `Authorization: Bearer <token>`.
- Positions polling should repeat about every 4 seconds while the tab is visible.
- Positions polling should slow to about every 15 seconds while the tab is hidden and refresh promptly when visible again.
- Realtime movement should connect to `/virtual-office/realtime` when token-backed API auth and `officeMapId` are available.
- Two authenticated browsers in the same company/map should see each other move smoothly in both directions.
- Console should report `virtual-office API auth available: yes (dev-token)` or `yes (cache)` for authenticated development reads, or `no` when fallback is expected.
- Console should report `virtual-office data source: api`, `partial-api`, or `mock fallback` according to API availability and validation.
- Valid API rooms, destinations, and remote players should display safely; invalid or empty API parts should fall back safely.
- Invalid or out-of-bounds map manifest rooms, navigation anchors/bounds, and player positions should be ignored or fall back safely.
- WASD/arrow movement works and respects collision.
- Double-click auto-walk finds paths or shows `No clear path`.
- `E` near chairs sits/stands.
- Proximity/click on mock remote users opens interaction drawer.
- Command palette people and room navigation still work with API or mock data.
- Desktop and narrow viewport layouts remain usable, with no new blocking API loader.
- Dashboard/employees/reports/compliance/integrations/settings routes render.
- `/platform-admin` loads only for configured Platform Admin identities and blocks tenant-only users.
- API `GET /health` responds when backend is running.
- Dev token endpoint works against seeded demo users outside production.
- Local browser smoke should use `http://localhost:3000`, not `http://127.0.0.1:3000`, when `WORKMAP_ALLOWED_ORIGIN` is configured for localhost.

## STAGE 2 Cognito / Deployment QA

- Keep real secrets out of chat, logs, docs, and commits.
- Confirm `workmap/.env` contains local public Cognito config when testing Cognito locally; do not create `apps/web/.env.local` for the standard STAGE 2 flow.
- Stop old web dev servers after editing root `.env`.
- Start API: `pnpm --filter @workmap/api dev`.
- Start Web: `pnpm --filter @workmap/web dev`.
- Open `http://localhost:3000/login` and confirm Cognito config status.
- Confirm pilot login still succeeds with seeded user/password/company slug.
- Confirm AppShell/session source is understandable after pilot login and after refresh.
- With real Cognito configured, click `Sign in with Cognito`, complete Hosted UI sign-in, and confirm `/login/callback` maps through backend `/auth/me`.
- Confirm a mapped verified Cognito user can open `/virtual-office`.
- Confirm an unmapped Cognito user receives controlled mapping-needed guidance.
- Confirm an unverified Cognito email is rejected by the backend.
- Confirm clearing Cognito session allows pilot fallback testing again.
- Confirm `/dashboard`, `/reports`, and `/compliance` still render with fallback/sign-in guidance when unauthenticated and API-backed state when authenticated.
- Confirm backend stopped does not crash frontend pages that already have fallback behavior.
- For deployed smoke, set real Vercel, Render, Supabase, and Cognito env values directly in platform consoles and verify real callback/logout URLs.

## STAGE 2 Alpha Production Readiness QA

Use `docs/ai-handoff/alpha-production-readiness.md` as the source of truth before claiming alpha readiness.

- Keep real secrets, bearer tokens, database URLs, Cognito secrets, platform admin identities, and extension/agent tokens out of chat, docs, logs, and commits.
- Configure Vercel public env, Render server env, Supabase `DATABASE_URL`, Cognito Hosted UI callback/logout/scopes, `WORKMAP_APP_URL`, and exact `WORKMAP_ALLOWED_ORIGINS` before deployed smoke.
- Apply required Prisma migrations in order: `20260529043117_v1`, `20260606000000_stage2_onboarding_invites`, `20260607000000_platform_audit_log`, and `20260609000000_stage2_activity_source`.
- Verify deployed `GET /health` returns liveness 200.
- Verify deployed `GET /health/readiness` returns database-ready 200 after migrations and DB connectivity are correct.
- Verify a broken database readiness state returns safe 503 output without secrets or raw database details when practical.
- Confirm production CORS accepts only exact configured frontend origins and does not use `*`.
- Confirm deployed `/virtual-office/realtime` connects over WSS from the real Vercel origin after `WORKMAP_ALLOWED_ORIGINS` is configured.
- Run owner Cognito sign-in, workspace creation, invite creation, employee Cognito invite acceptance, compliance/avatar/device onboarding, virtual-office realtime/polling, reports, dashboard, employees, settings, invite, and compliance smoke.
- Run activity hardening checks for malformed/cross-tenant device ids, spoof heartbeat, bad/future/old timestamps, zero/negative/too-long durations, empty/malformed app labels, malformed/full URL domain normalization, batch size over 50, ignored client tenant/user/role fields, employee `scope=company` 403, owner aggregate-only reports, and Platform Admin privacy boundary.
- Confirm Platform Admin uses only configured backend allowlists and does not expose employee app/domain details or raw activity rows.
- Run a final secret scan before deploy/commit handoff.

## STAGE 2 Real Alpha Deployment Smoke QA

Use `docs/ai-handoff/real-alpha-deployment-smoke.md` for Round 9 deployed smoke.

- Run `pnpm smoke:alpha` from `workmap/` with `WORKMAP_SMOKE_API_URL`, `WORKMAP_SMOKE_APP_URL`, and usually `WORKMAP_SMOKE_ORIGIN` set in the shell to public deployed origins.
- Do not store real smoke values in docs unless they are intentionally public and non-sensitive; never paste bearer tokens, database URLs, JWT secrets, platform admin identities, or Cognito secrets into chat.
- Treat `WORKMAP_SMOKE_*` as public smoke helper inputs only. The helper reads process env and does not read `.env`.
- Confirm the helper checks deployed `/health`, `/health/readiness`, approved-origin CORS, frontend `/`, `/login`, `/virtual-office`, `/platform-admin`, and the derived WSS endpoint path.
- Confirm localhost is rejected by default unless `WORKMAP_SMOKE_ALLOW_LOCAL=1` is intentionally set for local testing.
- After the helper passes, complete authenticated manual smoke for Cognito Owner onboarding, invite creation, Employee invite acceptance/onboarding, two-user realtime movement, People/contact surfaces, Platform Admin privacy, device registration, app/domain sample activity, Employee own reports, Owner company aggregate reports, and Employee company-scope report block.
- Repeat deployed smoke immediately before pilot start and after any Vercel, Render, Supabase, Cognito, origin allowlist, callback/logout, migration, or deployment change.

## STAGE 3 Alpha Pilot Pack QA

Use `docs/alpha-pilot/README.md` and `docs/alpha-pilot/before-pilot-smoke-checklist.md` before inviting the controlled 5-person pilot group.

- Confirm the Owner quick start matches the accepted Owner flow: Cognito sign-in, workspace creation, profile/avatar setup, compliance review, invite creation, virtual-office entry, Dashboard, Reports, and issue reporting.
- Confirm the Employee quick start matches the accepted Employee flow: invite link, Cognito sign-in/sign-up with the invited verified email, compliance acknowledgement, profile/avatar setup, device setup, virtual-office entry, own-scope reports, and issue reporting.
- Confirm the privacy/compliance one-pager does not imply screenshots, keystrokes, camera/mic, private message/email content, passwords/form inputs, full URL paths, webpage content, employee scoring, invisible spying, or raw employee activity streams.
- Confirm known limitations still match product truth for desktop-agent harness, browser-extension scaffold, sparse activity data, in-memory realtime, copy/share invite links, placeholder Teams/Outlook/3CX/chat/scheduling/support workflows, read-only allowlist Platform Admin, and future global identity/multi-company membership.
- Complete all 30 before-pilot smoke checklist items in the deployed environment before marking the pilot ready.
- Treat `pnpm smoke:alpha` as public-route/CORS/readiness coverage only; it does not automate Cognito Hosted UI, invite acceptance, two-user realtime, device setup, activity submission, reports data creation, or Platform Admin identity checks.
- Keep real secrets, bearer tokens, database URLs, Cognito secrets, platform admin identities, customer names, and private pilot feedback out of docs, chat, and commits.
- If `docs/ai-handoff/latest-qa.md` still points to an older round, call that out in the handoff and do not treat it as Round 5 QA evidence.

## STAGE 3 Frontend Experience Visual QA

Use this after frontend product language, AppShell, dashboard, reporting, compliance, employee directory, platform admin, or virtual-office chrome changes.

- Run web typecheck, lint, and build.
- Confirm `/login` clearly distinguishes deployed alpha Cognito sign-in, pilot backend fallback, and frontend-only fallback.
- Confirm OWNER/MANAGER AppShell active nav, grouped labels, workspace context, role/session pill, wrapping behavior, and visibility of Dashboard, Reports, Employees, Compliance, Invites, Integrations, and Settings.
- Confirm EMPLOYEE AppShell hides manager/admin-only shortcuts while keeping Office, Employees, and Compliance usable.
- Confirm Dashboard reads as workspace overview while still making API-backed, fallback, and sparse-data states obvious.
- Confirm Reports language remains role-aware for own summaries versus company aggregate summaries and does not imply raw employee activity rows.
- Confirm Compliance keeps explicit collected/not-collected privacy boundaries and acknowledgement flow readability.
- Confirm Employees search/status/department controls and table horizontal scrolling work at desktop and tablet-ish widths.
- Confirm Platform Admin reads as independent platform context and only exposes privacy-safe tenant metadata.
- Confirm `/virtual-office` map rendering, movement, realtime/polling, People panel, contact drawer, chair interaction, command palette, and top chrome remain usable.
- Check 1366px, 1440px, and tablet-ish widths for text/control overlap.

## STAGE 3 Role Journey QA

Use this after Owner, Employee, invite, reports scope, AppShell navigation, onboarding guidance, or Platform Admin permission-state changes.

- Owner `/dashboard`: confirm Owner next steps show Invite employees, Open office, View reports, and Review compliance.
- Owner `/onboarding/company`: confirm workspace creation guidance explains post-create avatar/profile, compliance, invites, and virtual-office steps.
- Owner `/onboarding/invite`: confirm invite list/create still works and copy is Owner-specific.
- Non-owner `/onboarding/invite`: confirm the page shows a friendly Owner-only message and does not present a misleading create path.
- Employee invite link: confirm the page explains Cognito sign-in, workspace join, compliance, avatar/profile, device setup, and virtual-office path.
- Employee wrong-account invite acceptance: confirm a 403/forbidden response becomes helpful wrong-email or permission guidance.
- Employee direct `/dashboard`: confirm it does not show Owner-only CTAs.
- Employee `/reports`: confirm own-scope explanation is clear and company-wide summaries are described as Owner/Manager-only.
- Tenant Owner/Employee direct `/platform-admin`: confirm blocked copy explains separate Platform Admin identity and allowlist requirement.
- Platform Admin login: confirm `/platform-admin` still loads privacy-safe tenant metadata and does not regress into tenant workspace language.
- AppShell unauthenticated/no-role state: confirm tenant workspace navigation is hidden until a workspace role is resolved.
- `/virtual-office`: confirm map, movement, realtime/polling, People panel, contact drawer, chair interaction, and command palette are unchanged.

## STAGE 3 Virtual Office Interaction QA

Use this after virtual-office chrome, People panel, contact drawer, room card, dock, or local feedback changes.

- `/virtual-office` with API and realtime available: confirm top bar shows realtime connected state and visible teammate count.
- Break realtime while polling remains available: confirm top bar explains reconnecting or polling fallback and the map remains usable.
- Backend unavailable/fallback mode: confirm top bar explains demo presence and the map still renders.
- People panel: confirm filters/search, Details, Wave, Go to, Teams, Outlook, and 3CX actions show honest feedback.
- Contact drawer: confirm focus/busy/offline/available guidance changes appropriately and placeholder actions do not imply real integrations.
- Confirm Wave/reaction feedback is local-only and does not imply receiver-side delivery.
- Chair/desk interaction: confirm `E` to sit and `E` to stand still work with clearer prompts.
- Room context card: confirm Go to room, View people or Focus cue, and Copy link feedback.
- Regression: confirm WASD/arrow movement, double-click auto-walk, collision, realtime movement, polling reconciliation, command palette, contact drawer, and fallback/mock mode.
- Layout: confirm sync/status indicator at 1366px, 1440px, and tablet-ish widths does not overlap top chrome.
- Smoke unrelated pages: `/dashboard`, `/employees`, `/reports`, `/compliance`, `/onboarding/invite`, and `/platform-admin` still render.

## STAGE 3 Dashboard / Reports / Compliance QA

Use this after Dashboard, Reports, Compliance, activity summary language, sparse/empty states, privacy copy, or alpha limitation copy changes.

- Owner `/dashboard`: confirm it reads as a management overview with setup coverage, next actions, data coverage, sparse-data clarity, and no invasive monitoring claims.
- Employee `/dashboard`: confirm it focuses on own workspace, own presence, own compliance, and summary availability without Owner-only CTAs or company-management framing.
- Owner `/reports`: confirm company aggregate scope is explained and no raw employee activity detail or employee scoring is implied.
- Employee `/reports`: confirm own-scope explanation is clear and company-wide reports remain unavailable.
- Reports no-data state: confirm empty API rows are described as sparse alpha setup and point toward device/app/domain event setup.
- Reports fallback/example layout: confirm example rows are visibly labeled as frontend examples, not real tenant data.
- `/compliance`: confirm the `Transparency policy` title, privacy notice, collected/not-collected lists, and acknowledgement flow still render.
- `/compliance`: confirm why-data-exists, who-can-see-what, alpha client limitation, and Platform Admin boundary copy are clear.
- Smoke unrelated pages: `/virtual-office`, `/employees`, `/platform-admin`, `/onboarding/invite`, and `/login` still render.
- Layout: check 1366px, 1440px, and tablet-ish widths for Dashboard, Reports, and Compliance text/control overlap.
- Language review: confirm no hidden tracking, total monitoring, employee scoring, screenshots, keystrokes, private messages, full URL capture, webpage content capture, or private content tracking claims were introduced.

## STAGE 2 Tenant Onboarding / Invite QA

- Apply migration `20260606000000_stage2_onboarding_invites` before testing.
- Use real local Cognito users with verified email addresses.
- Sign in with a new verified Cognito owner and confirm callback routes to `/onboarding/company`.
- Create a workspace and confirm the owner becomes `OWNER`.
- Confirm owner enters `/onboarding/invite` and AppShell shows backend company/user/role/session source.
- Create an employee invite and copy the invite link.
- Open the invite link in a clean/incognito browser and confirm no hydration overlay appears.
- Sign in/sign up with Cognito using the invited verified email.
- Confirm callback returns to `/invite/:token` when a pending invite exists.
- Accept the invite and confirm the employee lands on `/compliance`, then `/onboarding/avatar`, then `/onboarding/device-setup`, then `/virtual-office`.
- Confirm wrong verified email, invalid invite, expired invite, and already accepted invite fail safely.
- Confirm non-OWNER cannot list or create invitations.
- Confirm Owner cannot list/manage another company's invites by changing client-side values.
- Confirm fresh owner workspace spawns in `/virtual-office` around `x=160`, `y=545` and can move away.
- Confirm owner can see employee in the same workspace; after commit `1d2836c`, same-map movement should be realtime/smooth when the socket is connected, with polling still available as fallback.
- Confirm pilot login fallback, Dashboard, Reports, Compliance, virtual-office movement/collision/chair/contact drawer, and People panel still work.

## STAGE 2 RBAC / Profile QA

- Confirm EMPLOYEE does not see Dashboard, Reports, Integrations, Settings, or Invites in AppShell.
- Confirm EMPLOYEE does not see Dashboard or Integrations in `/virtual-office` command palette.
- Confirm EMPLOYEE cannot `GET /invitations` or `POST /invitations`.
- Confirm EMPLOYEE cannot `GET /integrations`.
- Confirm wrong-tenant `officeMapId` cannot be used for `GET /virtual-office/map/:officeMapId/positions` or current-user position save.
- Confirm wrong-tenant `policyId` cannot be acknowledged.
- Confirm wrong-tenant `targetUserId` cannot be used for integration contact links.
- Confirm EMPLOYEE cannot query another user's reports with `?userId=...`.
- Confirm OWNER/MANAGER-style roles can query in-tenant report targets where expected, and off-tenant targets fail safely.
- Confirm Owner A cannot see Owner B users, invites, virtual-office positions, reports, compliance acknowledgement targets, or contact links.
- Confirm `/employees` shows real same-tenant API users when `GET /users` succeeds and mock examples only when API auth/data is unavailable.
- Confirm `PATCH /users/me` saves display name and valid `layered:v2:` avatar reference for the backend-resolved current user.
- Confirm first-time OWNER/EMPLOYEE setup requires/saves display name and backend avatar profile.
- Confirm returning OWNER/EMPLOYEE with backend avatar skips avatar recreation.
- Confirm OWNER and EMPLOYEE see each other's real layered avatars in `/virtual-office` after both have backend avatar profiles.

## STAGE 2 Platform Admin QA

- Apply migration `20260607000000_platform_audit_log` before local or deployed platform-admin testing.
- Configure a real platform admin identity through `WORKMAP_PLATFORM_ADMIN_EMAILS` and/or `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` in local/deployment env only.
- Do not paste real platform admin emails/subs/secrets into chat, logs, docs, or commits.
- Restart the API after platform admin env changes.
- Sign in with a configured Cognito Platform Admin that has no tenant/company `User`.
- Confirm `/login/callback` routes to `/platform-admin`, not tenant onboarding.
- Confirm `GET /platform/me` returns `platformRole: "PLATFORM_ADMIN"` and Cognito identity fields.
- Confirm `/platform-admin` loads tenant list, tenant detail, tenant health, and platform audit summaries.
- Confirm tenant switching updates detail/health data and does not trigger a React/Next style overlay.
- Confirm Platform Admin sees only privacy-safe metadata: tenant identity/counts/readiness, aggregate timestamps, and platform audit events.
- Confirm Platform Admin does not see employee app/domain details, browsing details, message/email content, virtual-office movement history, secrets, raw activity rows, support impersonation, tenant mutation, or billing controls.
- Sign in as tenant OWNER not in the platform allowlist and confirm no Platform Admin nav plus direct `/platform-admin` blocked UI and `/platform/*` returns 403.
- Sign in as EMPLOYEE not in the platform allowlist and confirm no Platform Admin nav plus direct `/platform-admin` blocked UI and `/platform/*` returns 403.
- Confirm tenant onboarding, invite acceptance, `/virtual-office` realtime, Dashboard, Reports, Compliance, and Employees still pass smoke after platform-admin changes.

## STAGE 2 Activity Tracking QA

- Apply migration `20260609000000_stage2_activity_source` before local or deployed activity testing.
- Restart API after migration.
- Use a real authenticated local WorkMap Bearer token without pasting it into chat or committing it.
- Register a device through `POST /devices/register`.
- Submit one app usage event through `POST /activity/app-usage` or the desktop-agent `--sample-once` harness.
- Submit one domain usage event through `POST /activity/domain-usage` or the browser-extension scaffold.
- Confirm app usage response records `DESKTOP_AGENT` / `APP`.
- Confirm domain usage response records `BROWSER_EXTENSION` / `BROWSER`.
- Confirm Employee `/reports` shows own app/domain summaries and device coverage.
- Confirm domain reports show hostname only, not full URL path, query, or fragment.
- Confirm Owner `/reports` shows company aggregate app/domain summaries without raw employee event rows.
- Confirm EMPLOYEE direct `/reports/usage-summary?scope=company` returns 403.
- Confirm Dashboard tracking coverage updates when device/activity rows exist.
- Confirm Compliance policy and acknowledgement modal list collected app name/duration, browser domain/duration, timestamps, device heartbeat, and explicitly excluded screenshots, screen recording, keystrokes, clipboard, camera/microphone, private messages/emails, page content, full URL paths/queries, form inputs, and passwords.
- Confirm Platform Admin does not expose employee-level app/domain details or raw activity rows.
- Hardening checks when time allows: cross-user/cross-tenant device id, bad timestamp, too-long duration, malformed domain, and full URL normalization.

## Local API-Backed Virtual Office Verification Loop

Use this repeatable loop after backend/local-startup changes:

- Start backend from `workmap/`: `pnpm --filter @workmap/api dev`.
- Confirm API health: `GET http://localhost:3001/health`.
- Confirm dev token: `POST http://localhost:3001/auth/dev-token` with `engineer@workmap.demo` and `workmap-demo-company`.
- Confirm Bearer-authenticated reads:
  - `GET http://localhost:3001/virtual-office/map`
  - `GET http://localhost:3001/virtual-office/navigation`
  - `GET http://localhost:3001/virtual-office/map/:officeMapId/positions`
- Confirm Bearer-authenticated current-user save:
  - `PUT http://localhost:3001/virtual-office/map/:officeMapId/positions/me`
- Start frontend from `workmap/`: `pnpm --filter @workmap/web dev`.
- Open `http://localhost:3000/virtual-office`.
- Confirm browser Network shows virtual-office API reads on backend port 3001 with Bearer authorization.
- Confirm canvas, avatar, movement, collision, double-click auto-walk, chair `E` interaction, contact drawer, desktop layout, and narrow layout still work.
- Confirm the local player uses the active manifest safe/default spawn when no backend saved position exists, and saved backend position restore still wins when present.
- Stop backend and refresh `/virtual-office`; confirm mock fallback still renders without runtime crash.

## Map Manifest Manual QA

- Start API on `http://localhost:3001` and web on `http://localhost:3000`.
- Open `/virtual-office` as Owner and confirm the current TMX map loads and looks functionally unchanged.
- Confirm the current user spawns at a valid active-manifest safe/default spawn and can move.
- With no saved current-user position and no local movement, confirm the player does not remain stuck on an old module-level default spawn after API office data loads.
- Move, wait for save, refresh, and confirm valid saved backend position restore remains authoritative.
- If practical, manually set an out-of-bounds saved position in the local DB and confirm the UI uses safe spawn instead of crashing.
- Confirm invalid/out-of-bounds `PUT /virtual-office/map/:officeMapId/positions/me` returns controlled 400.
- Confirm realtime out-of-bounds movement is rejected with `office:error` and does not broadcast unsafe coordinates.
- Confirm rooms and destination labels are readable in People panel and command palette; raw backend room UUIDs should not appear.
- Confirm double-click auto-walk, WASD/arrow movement, collision, chair `E`, and contact drawer hit testing still work.
- Confirm realtime movement still works between two users in the same map.
- Confirm polling fallback still works when websocket is unavailable.
- Create a new owner workspace and confirm default map, rooms, and owner spawn are usable.
- Confirm tenant A cannot access tenant B office map APIs.
- Confirm Dashboard, Reports, Compliance, Employees, tenant onboarding, invite flow, and Platform Admin smoke pass after map manifest changes.

## Position Persistence Manual QA

- Open `http://localhost:3000/virtual-office` with backend running on `localhost:3001`.
- Confirm initial API reads include Bearer authorization.
- Confirm the local player restores to the saved backend position when one exists.
- Confirm the current user does not appear as a duplicate remote player.
- After restore, confirm there is no immediate PUT of an old/default coordinate.
- Move with WASD/arrow keys, wait at least 2.5 seconds, and confirm `PUT /virtual-office/map/:officeMapId/positions/me` saves the current coordinate.
- Refresh `/virtual-office` and confirm the player restores to the newly saved position.
- Test chair sit/stand and room/status changes; confirm saves remain reasonable and page stays stable.
- Stop backend or break auth; confirm page still renders with mock fallback and local movement.

## Polling Presence Manual QA

- With backend and frontend running, open `http://localhost:3000/virtual-office`.
- Confirm `GET /virtual-office/map/:officeMapId/positions` repeats about every 4 seconds in a visible tab.
- Hide/switch away from the tab and confirm polling slows to about every 15 seconds.
- Return to the tab and confirm a prompt positions refresh.
- Confirm the current user's `userId` does not render as a remote player.
- Update another seeded user's position through dev-token/API calls and confirm that remote player updates on the next poll.
- Confirm API-valid empty remote positions show no remote people rather than mock people.
- Confirm freshness windows: under 30 seconds keeps backend status, 30 seconds to 5 minutes maps to `idle`, and older than 5 minutes maps to `offline`.
- Stop or break the backend and confirm the page does not crash and keeps last good remote state or initial mock fallback.
- Confirm current-user save/restore still works and polling does not overwrite local movement.

## Realtime Virtual Office Manual QA

- Start API and web from `workmap/` with token-backed auth available.
- Open `http://localhost:3000/virtual-office` in two authenticated browser sessions for users in the same company and office map.
- Confirm the browser opens `/virtual-office/realtime` with `ws://` locally or `wss://` on HTTPS deployments.
- Confirm OWNER movement is visible to EMPLOYEE smoothly and promptly.
- Confirm EMPLOYEE movement is visible to OWNER smoothly and promptly.
- Confirm direction, stop state, room/status changes, and large reposition/snap cases do not leave remote avatars drifting incorrectly.
- Confirm the current user never appears as a duplicate remote avatar.
- Confirm People panel, command palette People rows, contact drawer, and click hit testing still use the visible rendered teammate positions.
- Refresh one browser and confirm polling/read APIs reconcile display name, avatar, role, freshness, and latest durable position.
- Break or stop the socket path and confirm the page does not crash and polling/fallback behavior remains understandable.
- Confirm a wrong-company or invalid `officeMapId` cannot join and does not leak remote movement.
- Confirm invalid optional `roomId` movement is rejected and does not broadcast across rooms/maps.
- Confirm server logs or browser output do not expose real secrets. In deployment, avoid retaining full WebSocket query strings because the token is passed as query `token`.

## People / Team Experience Manual QA

- Open People panel and confirm the current user appears in a separate `You` card.
- Confirm the current user does not appear as a remote teammate in the list or map.
- Confirm active / idle / offline summary counts match visible remote teammate statuses.
- Confirm remote cards show role, readable room/area, freshness label, last-seen detail, and expected actions.
- Confirm room labels resolve to destination names or `Office area`, never raw UUIDs.
- Confirm command palette People results show readable room/area and freshness context.
- Confirm People filters (`available`, `focus`, `busy`, `idle`, `offline`) work and do not trigger React/Next style overlay errors.
- Confirm search empty states and API-valid empty remote state are clear and not presented as broken UI.
- Confirm backend-off refresh shows fallback/demo mode gracefully.
- Watch the map for at least 15 seconds with polling active and confirm remote presence updates do not cause visible full-map/canvas refresh or flashing.
- Confirm current-user position save omits non-UUID frontend/mock `roomId`; backend should return controlled 400 for invalid UUID-shaped errors instead of Prisma crashes.

## Pilot Auth / Compliance Manual QA

- Open `http://localhost:3000/login`.
- Sign in as `engineer@workmap.demo` with password `workmap-pilot` and company slug `workmap-demo-company`.
- Confirm pilot session card shows user, role, and expiry.
- Refresh and confirm session remains understandable.
- Confirm `/virtual-office` requests include `Authorization: Bearer ...`.
- Confirm current user is not duplicated in remote teammate list/map.
- Open `/compliance` and confirm backend policy loads under pilot session.
- Acknowledge policy and refresh; confirm acknowledgement state remains understandable through the browser marker.
- Click AppShell logout or login clear-session action and confirm `workmap.pilotSession` and workflow state are cleared.
- Stop backend and refresh `/compliance` and `/virtual-office`; confirm safe fallback copy and no runtime crash.
- Check desktop and narrow layouts for login panel, AppShell session area, compliance modal, and People privacy copy.

## Pilot Readiness Dashboard / Reports QA

- Clean-restart API on `localhost:3001` and web on `localhost:3000` before final smoke, especially if a stale dev process produced an unexpected 500.
- Confirm `GET http://localhost:3001/health` returns 200.
- Sign in through `/login` with seeded pilot credentials.
- Refresh and confirm AppShell still shows understandable session/role context.
- Open `/dashboard` and confirm API health, auth context, remote presence, compliance, and reports cards show status clearly.
- Confirm Dashboard reports rows and pilot example rows are labeled distinctly.
- Open `/reports` and confirm authenticated `/reports/usage-summary` data appears, or sparse pilot-data copy appears if seeded data is limited.
- Confirm Reports does not imply screenshots, keystrokes, hidden camera/mic, private messages/email content, full URL capture, export history, or team aggregate monitoring beyond implemented scope.
- Open `/compliance` and confirm transparency and acknowledgement behavior remain intact.
- Open `/virtual-office` after the clean restart and run movement, position restore/save, polling, People panel, contact drawer, command palette, WASD/collision, auto-walk, chair interaction, room labels, and desktop/narrow layout regressions.
- Use `docs/ai-handoff/pilot-release-checklist.md` as the detailed pilot pre-release checklist.

## Test Gaps

- No automated test files were found during intake.
- Pathfinding, API contracts, auth guard, and onboarding routing should be prioritized for tests.
- Add coverage for `useVirtualOfficeData.ts` adapters/fallback behavior when a frontend test harness is introduced.

## Latest Verification Notes

For commit `9815b7a`, implementation handoff reports:

- STAGE 3 Round 5 added a docs-only alpha pilot readiness pack under `docs/alpha-pilot/`.
- `git diff --check` passed with only LF-to-CRLF warning noise for `docs/ai-handoff/latest-implementation.md`.
- A secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `tsbuildinfo`, and `docs/references` found no matches.
- A trailing-whitespace scan over `docs/alpha-pilot/*` and `docs/ai-handoff/latest-implementation.md` passed.
- Web/API typecheck, lint, build, Prisma, and browser QA were not run because no runtime code changed.
- The available `docs/ai-handoff/latest-qa.md` still describes STAGE 3 Round 4, so Round 5 needs a matching QA handoff before it is treated as independently QA-accepted.

For commit `5d4412a`, handoff/QA reports:

- Web typecheck passed.
- Web lint passed.
- Web build passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Web build still prints the existing warning that the Next.js ESLint plugin is not detected.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches for the current scan scope.
- Diff review confirmed changes were scoped to Dashboard, Reports, Compliance, and handoff docs.
- No backend, Prisma schema/migration, seed, auth architecture, Cognito flow, tenant onboarding, invite flow, RBAC, Platform Admin backend, activity ingestion API, reports API contract, compliance acknowledgement API, deployment config, desktop-agent, browser-extension, virtual office, realtime, map, tracking categories, billing, analytics/BI system, or integrations changed.
- Browser/manual QA was not run by design; user is deferring STAGE 3 manual testing until a combined manual pass.
- Manual QA focus: Owner/Employee Dashboard, Owner/Employee Reports, Reports no-data/example labels, Compliance transparency/trust copy, Platform Admin privacy boundary wording, unrelated page smoke, layout overlap, and no scary monitoring language.

For commit `5db7e8d`, handoff/QA reports:

- Web typecheck passed.
- Web lint passed.
- Web build passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Web build still prints the existing warning that the Next.js ESLint plugin is not detected.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches for the current scan scope.
- Diff review confirmed changes were scoped to `apps/web/components/office/**` plus handoff docs.
- No backend, Prisma schema/migration, seed, auth architecture, realtime protocol, polling cadence, WebSocket reconnect behavior, map assets, TMX art, movement/collision/pathfinding, chair mechanics, deployment config, desktop-agent, browser-extension, tracking, chat/history, or production integration code changed.
- Browser/manual QA was not run by design; user is deferring STAGE 3 manual testing until later.
- Manual QA focus: sync/status indicator, realtime reconnecting/polling fallback clarity, People/contact placeholder actions, chair prompt clarity, room context feedback, map/realtime/polling regression, and top-chrome overlap checks.

For commit `60fc0ca`, handoff/QA reports:

- Web typecheck passed.
- Web lint passed.
- Web build passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Web build still prints the existing warning that the Next.js ESLint plugin is not detected in the current ESLint config.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches for the current scan scope.
- Diff review confirmed changes were frontend-only under `apps/web/**` plus handoff docs.
- No backend, Prisma schema/migration, seed, auth architecture, realtime protocol, map engine, movement/collision, chair interaction, contact drawer API, desktop-agent, browser-extension, deployment config, env, billing, chat, or map editor files changed.
- Browser/manual visual QA was not run during QA and remains recommended because the workspace includes broad visual styling changes plus targeted Round 2 role-flow copy/states.
- QA focus for manual smoke: Owner dashboard/onboarding/invite journey, Employee dashboard/invite/reports journey, Platform Admin blocked state, AppShell unauthenticated navigation, and `/virtual-office` regression.

For commit `333b789`, handoff/QA reports:

- Web typecheck passed.
- Web lint passed.
- Web build passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Web build still prints the existing warning that the Next.js ESLint plugin is not detected in the current ESLint config.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches for the current diff/repo scan scope.
- Diff review confirmed changes were frontend-only under `apps/web/**` plus handoff docs.
- No backend, Prisma schema/migration, auth architecture, realtime protocol, map engine, movement/collision/chair interaction, desktop-agent, browser-extension, deployment config, or env files changed.
- Browser/manual visual QA was not run during QA and remains recommended before commit/broader pilot use because this round is primarily UI/product-experience work.

For commit `20feb27`, handoff/QA reports:

- Smoke helper syntax check passed with `node --check scripts/real-alpha-smoke.mjs`.
- `pnpm smoke:alpha` without deployed env returned Manual Action Required as expected and did not pretend smoke passed.
- API, web, desktop-agent, and browser-extension typecheck/lint/build commands passed; desktop build passed after rerun outside the sandbox due to a Windows `dist` permission issue.
- `pnpm prisma:generate` passed after rerun outside the sandbox when Prisma binary checksum access was blocked/redirected in the sandbox.
- `git diff --check` passed with CRLF normalization warnings only.
- `git check-ignore -v workmap/pnpm-lock.yaml` returned no ignore rule, confirming the lockfile can be committed for Vercel installs.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` found no high-confidence secrets.
- Human-reported deployed smoke passed on 2026-06-13 for Supabase migrations, Render health/readiness, Vercel frontend, Cognito Hosted UI callback/logout, `pnpm smoke:alpha` against deployed public URLs, approved-origin CORS, two-user WSS/virtual-office, Owner onboarding/invite, Employee invite acceptance/onboarding, Platform Admin privacy boundary, device registration, app/domain sample activity, Employee own report, Owner company aggregate report, and Employee company-scope report block.
- QA conclusion: WorkMap is an Alpha Ready Candidate for a controlled 5-person pilot, not full production readiness.
- Future hardening: automated negative tests for cross-user/cross-tenant device ids, malformed/future timestamps, overlong durations, malformed domains, URL minimization, batch-size limits, and unapproved-origin CORS.

For commit `8719f5d`, handoff/QA reports:

- API and web typecheck, lint, and build passed.
- Desktop-agent and browser-extension typecheck, lint, and build passed; desktop build passed after rerun outside the sandbox due to a Windows `dist` permission issue.
- `pnpm prisma:generate` passed after local Node processes locking Prisma files were stopped.
- `git diff --check` passed with CRLF normalization warnings only.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` found no high-confidence matches.
- Code review confirmed shared HTTP CORS/WebSocket origin allowlist behavior, preferred `WORKMAP_ALLOWED_ORIGINS`, production browser-origin rejection when no allowlist is configured, local-only localhost origins, safe missing-origin server-to-server behavior, `/health/readiness` DB readiness without secrets, and alpha deployment documentation.
- No real deployed Vercel/Render/Supabase/Cognito smoke was run.
- No live browser alpha smoke or live invalid-input activity hardening requests were run.
- QA recommendation at the time: code/docs could proceed toward controlled alpha deployment preparation, while deployed alpha readiness still required external setup and smoke. This was superseded by Round 9 commit `20feb27`, which records human-reported deployed smoke pass.

For commit `abe673c`, the implementation handoff reports these passed from `workmap/`:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Local HTTP check for `/virtual-office` returned 200. Browser-based interaction QA in the implementation chat was not completed due to local browser/navigation timeout behavior, but the QA handoff records user-confirmed manual testing passed.

For commit `2a4a269`, the handoff reports these passed from `workmap/`:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Additional QA notes for `2a4a269`:

- `GET http://localhost:3000/virtual-office` returned 200 while the frontend dev server was running.
- User-confirmed visual/interaction checks passed for canvas, movement, auto-walk, chair interaction, contact drawer, desktop layout, and narrow layout.
- Fallback was verified when `localhost:3001` was unavailable: `POST /auth/dev-token`, `/virtual-office/map`, and `/virtual-office/navigation` were attempted and failed with connection refused while the page stayed on mock fallback.
- Authenticated API success path remains blocked until the backend listens on `http://localhost:3001`.

For commit `d7152dd`, QA reports these passed:

- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`
- `pnpm --filter @workmap/api dev` started API successfully on `localhost:3001`.
- `GET http://localhost:3001/health` returned 200.
- `POST http://localhost:3001/auth/dev-token` returned 201 with Bearer token.
- Authenticated virtual-office map/navigation/positions reads returned 200.
- Browser `/virtual-office` with backend running showed API-backed state.
- Browser `/virtual-office` after backend stopped showed fallback state.
- User browser QA confirmed `/virtual-office/map` and `/virtual-office/navigation` returned 200 and included Bearer authorization headers.

For commit `1a0a19f`, implementation verification reports:

- API/web lint, typecheck, and build commands passed.
- Root `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- API closed-loop test passed: dev token, PUT current-user position, and GET positions readback returned matching `x=333`, `y=444`, `direction=right` for the same user.
- Follow-up web lint/typecheck/build passed after the restore/save guard fix.
- Browser movement/save/restore remains a manual QA item because browser automation was unavailable and local web startup probe timed out.

For commit `effb188`, implementation verification reports:

- API/web lint, typecheck, and build commands passed.
- Root `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- User manual QA passed for visible 4s polling, hidden 15s polling, prompt visible refresh, current-user filtering, remote update after another user's API position changes, existing virtual-office regressions, and current-user save/restore not being overwritten.

For commit `b68dd49`, handoff/QA reports:

- Web/API lint, typecheck, and build passed.
- Direct HTTP verification passed: invalid `roomId=open-office-north` returned controlled 400; omitted `roomId` save succeeded.
- User manual QA passed for current-user card, no duplicate current user, UUID-free room labels, People summary/filters/empty states, command palette People context, contact drawer, backend-off fallback, remote update after API change, and no visible canvas refresh during polling.
- Full final regression remains recommended for movement, collision, auto-walk, chair interaction, room/zone status, and narrow layout overflow.

For commit `14fb706`, handoff/QA reports:

- Web/API lint, typecheck, and build passed.
- HTTP smoke passed for `/health`, `POST /auth/pilot-login`, `/auth/me`, `/compliance/policy`, compliance acknowledgement, and authenticated virtual-office map/navigation/positions.
- Browser/runtime QA passed for pilot login, pilot session storage, compliance acknowledgement marker, virtual-office Bearer requests, People privacy copy, logout clear, and backend-off fallback.
- User manual acceptance passed for login, session refresh readability, virtual-office Bearer requests, compliance acknowledgement, logout/session clear, backend-off fallback, and desktop/narrow layout checks.

For commit `79ac906`, handoff/QA reports:

- Web/API and root lint, typecheck, and build passed.
- HTTP smoke passed for API `/health` and web `/dashboard`, `/reports`, and `/compliance`.
- An initial `/virtual-office` smoke returned 500 from an already-running stale Next process; user clean-restarted backend/frontend and confirmed `/virtual-office` worked normally.
- User manual acceptance passed for pilot login, AppShell session refresh clarity, Dashboard readiness cards, Reports API/sparse-data states, Compliance policy/acknowledgement continuity, and full `/virtual-office` regression checks.

For commit `c2c7d76`, handoff/QA reports:

- Web lint, typecheck, and build passed after root `.env` loading was added to `apps/web/next.config.ts`.
- Full STAGE 2 baseline verification passed for web/API lint, typecheck, and build.
- Secret/key review found no real committed secrets; `.env.example` values are local examples/placeholders.
- API smoke passed for `GET /health` and `POST /auth/pilot-login`.
- Clean local web smoke passed for `/login`, `/dashboard`, `/reports`, `/compliance`, and `/virtual-office`.
- `/login` showed `Sign in with Cognito` in the local environment, confirming root `.env` public Cognito config was visible to the web dev server without printing env values.
- User manual progress confirmed local `/login`, pilot login, basic `/virtual-office` entry, `/dashboard`, `/reports`, `/compliance`, Supabase manual migration SQL, and minimal seed insertion.
- Render/Vercel deployed smoke is deferred until after deployed env/callback/logout URLs are configured; an earlier Render failure was from an older `main` commit and should not be treated as this implementation failing.

For commit `e5d4882`, handoff/QA reports:

- `pnpm prisma:generate` passed after Prisma engine lock/sandbox issues were cleared.
- `pnpm exec prisma migrate dev --skip-seed` passed and applied migration `20260606000000_stage2_onboarding_invites` locally.
- API lint/typecheck/build passed.
- Web lint/typecheck/build passed after clearing a stale `.next` build cache once.
- Monorepo lint/typecheck/build passed.
- Follow-up API lint/typecheck/build passed after the owner spawn fix.
- Secret scan found no real AWS/Cognito/Supabase/Render/Vercel/private key/database secret in reviewed files.
- Manual QA passed for owner workspace creation, invite creation, invite link in InPrivate without hydration overlay, Cognito invite callback routing, employee acceptance through compliance/avatar/device onboarding, wrong-email rejection, invalid/already accepted invite handling, non-OWNER invite denial, pilot fallback, Dashboard, Reports, Compliance, and virtual-office rendering.
- Owner spawn fix sets new workspaces to `x=160`, `y=545`; existing test workspaces with older `160,160` position may need cleanup/recreate.

For commit `815df2c`, handoff/QA reports:

- API and web typecheck, lint, and build passed.
- No Prisma migration command was run because no schema/migration changed.
- Secret scan found no real AWS/Cognito/Supabase/Render/Vercel/private key/database secret in reviewed files.
- Final manual QA passed for OWNER backend avatar completion: fresh Owner routed through avatar setup, backend avatar saved, fresh login skipped avatar recreation, employee saw Owner's real layered avatar, and Owner still saw employee's real layered avatar.
- Previously completed Round 3 checks passed for employee hidden navigation/command actions, employee directory, display-name handling, avatar persistence, two-user virtual-office avatar consistency, tenant onboarding, invite acceptance, Dashboard, Reports, Compliance, pilot login, and dev-token fallback.

For commit `1d2836c`, handoff/QA reports:

- API lint, typecheck, and build passed.
- Web lint, typecheck, and build passed.
- No Prisma migration command was run because no schema/migration changed.
- Secret review found no real committed secrets in reviewed files; `.env` stayed excluded and was not read.
- Code review confirmed WebSocket auth, tenant/map room isolation, same-room broadcast only, sender exclusion, movement validation/rate limiting, and no per-frame Prisma writes.
- User manual QA passed for OWNER and EMPLOYEE in separate browsers seeing each other's realtime movement smoothly in both directions.
- User smoke found no blocking regression for virtual-office movement/contact/presence or Dashboard/Reports/Compliance/Employees.
- Remaining QA risk: deployed WSS smoke and multi-instance/pub-sub behavior are still unverified.

For commit `afe65e7`, handoff/QA reports:

- `pnpm prisma:generate` passed during implementation after clearing a local Windows Prisma engine DLL lock.
- API typecheck, lint, and build passed.
- Web typecheck, lint, and build passed.
- Follow-up web typecheck, lint, and build passed after the `/platform-admin` tenant button style fix.
- QA review commands passed for API/web typecheck, API/web lint, API build, and web build from `apps/web`; root `pnpm build` also passed after clearing a transient `.next` `PageNotFoundError`.
- Secret scans excluding `.env`, `node_modules`, `.next`, and `*.tsbuildinfo` found no high-confidence secrets; platform admin env placeholders remained blank.
- User manual QA passed after applying the local `PlatformAuditLog` migration: independent Cognito Platform Admin loaded `/platform-admin`, tenant list/detail/health/audit rendered, tenant switching worked without style overlay, tenant OWNER/EMPLOYEE were blocked, tenant onboarding/invites passed, `/virtual-office` realtime passed, and Dashboard/Reports/Compliance/Employees smoke passed.
- Remaining deployment action: apply `20260607000000_platform_audit_log` and configure platform admin allowlists in deployed API env before deployed platform-admin testing.

For commit `4e09788`, handoff/QA reports:

- API typecheck, web typecheck, API lint, web lint, API build, and web build passed from `workmap/`.
- `git diff --check` passed with only CRLF normalization warnings.
- No Prisma migration or `prisma:generate` was needed because schema did not change.
- Secret review found no real secrets in reviewed implementation files; one broad scan false positive was in unrelated untracked `docs/references/SkyOffice/yarn.lock`.
- Code review confirmed manifest validation, frontend fallback, room/navigation/position bounds filtering, owner workspace manifest creation, backend navigation generation from manifest, current-user save bounds 400, realtime bounds `office:error`, readable room mapping, and active-manifest spawn follow-up.
- User manual QA passed for current TMX map rendering, active-manifest safe spawn, saved-position restore, movement/collision/auto-walk/chair/contact drawer, readable room labels, two-user realtime movement, polling refresh/restore, new owner workspace default map/rooms/spawn, and Dashboard/Employees/Reports/Compliance/Settings/Invite/Platform Admin smoke.
- Manual DB mutation for invalid/out-of-bounds saved position was skipped; this remains covered by code review and machine verification.
- Non-blocking UX notes: saved-position restore may briefly show default spawn before jumping to saved backend position; chair interaction has no dedicated sitting pose/animation yet.

For commit `ec1b6d1`, handoff/QA reports:

- `pnpm prisma:generate` passed after a sandbox/network retry outside the sandbox.
- API, web, desktop-agent, and browser-extension typecheck/lint/build commands passed.
- `git diff --check` passed with only CRLF normalization warnings.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches.
- Code review confirmed guarded app/domain activity ingestion, tenant/user-scoped device binding, batch/timestamp/duration/label/domain validation, app/domain summary updates, role-aware reports scope, privacy-minimized hostname storage, compliance copy, and scaffold-only desktop/browser clients.
- User manual QA passed for local migration, API restart, Employee device registration, app usage ingestion, domain usage ingestion, Employee own reports, hostname-only report output, Owner company aggregate reports, Employee 403 for `scope=company`, Dashboard tracking coverage, Compliance copy/modal boundaries, and Platform Admin privacy boundary.
- Skipped checks: optional invalid-input hardening for cross-user/cross-tenant device id, bad timestamp, too-long duration, malformed domain; broad regression smoke for `/virtual-office`, Employees, tenant onboarding, invites, and other non-activity flows.
