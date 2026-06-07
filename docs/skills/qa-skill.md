# QA Skill

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
- Unmapped Cognito users, unverified email claims, and ambiguous email mappings should fail in a controlled way.
- Clear/sign out Cognito session before verifying pilot fallback after Cognito mapping failure.
- `/login` creates a pilot session with seeded pilot credentials when the backend is running.
- AppShell session state remains clear after refresh and links missing/unclear session states back to `/login`.
- `/dashboard` renders API health, auth/session, remote presence, compliance, and reports readiness with clear live/fallback/error labels.
- `/reports` renders API-backed current-user app/domain rows when available, or clear sparse-data copy when no rows exist.
- `/reports` and `/dashboard` keep department/team aggregate rows labeled as pilot examples until a backend aggregate endpoint exists.
- `/compliance` still loads backend policy and acknowledgement flows under pilot Bearer auth.
- Onboarding routes advance in expected order.
- `/virtual-office` redirects to avatar onboarding when avatar is missing.
- `/virtual-office` loads TMX map and tileset images.
- With backend stopped or unavailable, `/virtual-office` still renders through mock fallback without runtime crashes.
- With backend unauthorized, `/virtual-office` keeps mock fallback rather than blocking the page.
- With backend/API available, Network should show `/virtual-office/map`, `/virtual-office/navigation`, and `/virtual-office/map/:officeMapId/positions` attempts.
- In local development, Network should show `POST /auth/dev-token` before virtual-office read calls when no valid cached token exists.
- In local development with backend and seed data available, virtual-office read calls should include `Authorization: Bearer <token>`.
- Positions polling should repeat about every 4 seconds while the tab is visible.
- Positions polling should slow to about every 15 seconds while the tab is hidden and refresh promptly when visible again.
- Console should report `virtual-office API auth available: yes (dev-token)` or `yes (cache)` for authenticated development reads, or `no` when fallback is expected.
- Console should report `virtual-office data source: api`, `partial-api`, or `mock fallback` according to API availability and validation.
- Valid API rooms, destinations, and remote players should display safely; invalid or empty API parts should fall back safely.
- WASD/arrow movement works and respects collision.
- Double-click auto-walk finds paths or shows `No clear path`.
- `E` near chairs sits/stands.
- Proximity/click on mock remote users opens interaction drawer.
- Command palette people and room navigation still work with API or mock data.
- Desktop and narrow viewport layouts remain usable, with no new blocking API loader.
- Dashboard/employees/reports/compliance/integrations/settings routes render.
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
- Confirm owner can see employee in the same workspace, accepting polling-based position jumps as current scope.
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
- Stop backend and refresh `/virtual-office`; confirm mock fallback still renders without runtime crash.

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
