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
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Database setup:

- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`

## Manual QA Checklist

- `/login` creates expected demo role workflow.
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
