# WorkMap QA Report - 2026-05-31

## Summary

- Overall verdict: PASS_WITH_BLOCKERS
- Build status: PASS
- Frontend status: PASS for build and HTTP route smoke; NEEDS_MANUAL_QA for visual and interaction testing because browser automation was unavailable.
- Backend status: PASS for typecheck/lint/build; BLOCKED for runtime endpoint QA because the API dev/start commands did not expose a listening server.
- Privacy/RBAC status: PASS by code/privacy scan for current frontend/backend surfaces; API RBAC endpoint behavior BLOCKED by API runtime startup.
- Highest severity issue: P1_HIGH - API runtime scripts did not start a reachable Nest server for endpoint QA.

## Environment

- OS: Windows, PowerShell
- Node version: v24.15.0
- pnpm version: 9.15.0
- Branch: main
- Commit: d9257bf97641adce965c9eaaa904f285803e764b
- API URL: attempted `http://127.0.0.1:4010`, `4013`, and `4015`; no server reachable
- Database available: NOT_TESTED; `DATABASE_URL` exists in `.env`, but API runtime did not bind a port
- Browser automation available: BLOCKED; in-app browser returned `Browser is not available: iab`

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install` | BLOCKED | Returned at interactive reinstall prompt; existing `node_modules` were used for the rest of QA. |
| `pnpm typecheck` | PASS | Turbo ran 10 package checks successfully. |
| `pnpm lint` | PASS | Turbo ran 10 package lint checks successfully. |
| `pnpm build` | PASS | Turbo build passed; Next generated 24 static pages. |
| `pnpm --filter @workmap/web typecheck` | PASS | `tsc --noEmit` passed. |
| `pnpm --filter @workmap/web lint` | PASS | `eslint .` passed. |
| `pnpm --filter @workmap/web build` | PASS | Next build passed. |
| `pnpm --filter @workmap/api typecheck` | PASS | `tsc --noEmit` passed. |
| `pnpm --filter @workmap/api lint` | PASS | `eslint .` passed. |
| `pnpm --filter @workmap/api build` | PASS | `nest build` passed. |
| `npm run dev -- --port 3010` from `apps/web` | PASS | Fresh frontend dev server served all required routes with HTTP 200. |
| `npm run dev` from `apps/api` with `API_PORT=4010` | BLOCKED | Watch compilation succeeded but no listener appeared on port 4010. |
| `pnpm --filter @workmap/api dev` with `API_PORT=4013` | BLOCKED | Command timed out and no listener appeared on port 4013. |
| `pnpm --filter @workmap/api exec nest start --debug` with `API_PORT=4015` | FAIL | Command exited without a reachable server. |
| `node apps/api/dist/apps/api/src/main.js` | FAIL | Runtime failed with `Cannot find module '@workmap/auth'`; direct built entrypoint is not usable without workspace package resolution. |

## Frontend Route Results

Fresh dev server: `http://127.0.0.1:3010`.

| Route | Status | Notes |
| --- | --- | --- |
| `/` | PASS | HTTP 200; source confirms product/demo entry, role selection, resume behavior, secondary developer links, and privacy copy. |
| `/login` | PASS | HTTP 200; source confirms frontend mock sign-in and no production auth claim. |
| `/onboarding/company` | PASS | HTTP 200. |
| `/onboarding/avatar` | PASS | HTTP 200; source confirms layered body/eyes/hairstyle/outfit/accessory builder and save to localStorage. |
| `/onboarding/device-setup` | PASS | HTTP 200. |
| `/virtual-office` | PASS | HTTP 200; visual/canvas interaction checks need manual QA. |
| `/dashboard` | PASS | HTTP 200. |
| `/employees` | PASS | HTTP 200. |
| `/employees/[id]` | PASS | `/employees/mia` returned HTTP 200. |
| `/reports` | PASS | HTTP 200. |
| `/compliance` | PASS | HTTP 200. |
| `/integrations` | PASS | HTTP 200. |
| `/settings` | PASS | HTTP 200. |

## Workflow Results

| Flow | Status | Notes |
| --- | --- | --- |
| Root entry | PASS | Code inspection confirms role selection, resume behavior, and localStorage workflow state. Browser click-through NEEDS_MANUAL_QA. |
| Employee first-time flow | PASS | `getDefaultSetupState("EMPLOYEE")` routes login -> compliance -> avatar -> device setup -> virtual office as expected. Browser click-through NEEDS_MANUAL_QA. |
| Owner first-time flow | PASS | `getDefaultSetupState("OWNER")` routes to company onboarding, then compliance, then dashboard after setup. Browser click-through NEEDS_MANUAL_QA. |
| Manager returning flow | PASS | Manager default state routes to `/dashboard`. |
| IT Admin returning flow | PASS | IT Admin default state routes to `/dashboard`. |
| Avatar builder save | PASS | Source confirms `workmap.avatarConfig` write and `hasAvatar = true`; browser localStorage verification NEEDS_MANUAL_QA. |

## Virtual Office Results

| Feature | Status | Notes |
| --- | --- | --- |
| Route load | PASS | `/virtual-office` returned HTTP 200 on fresh dev server. |
| Full-screen map-first shell | NEEDS_MANUAL_QA | Source includes shell, left rail, panels, dock, mini map, controls, drawer, command palette, and room context card. Visual overlap cannot be verified without browser. |
| Map rendering / missing tiles | NEEDS_MANUAL_QA | TMX and tileset paths exist; visual red-X check requires Tiled/browser. |
| Keyboard movement | NEEDS_MANUAL_QA | Source includes keydown/keyup handlers; movement feel/collision require browser. |
| Collision | NEEDS_MANUAL_QA | Source/pathfinding references exist; wall/furniture/player collision requires browser. |
| Chair interaction | NEEDS_MANUAL_QA | Requires browser interaction. |
| Room zone detection | NEEDS_MANUAL_QA | Requires browser movement. |
| Drag / pan | NEEDS_MANUAL_QA | Source includes pointer/mouse camera offsets; interaction requires browser. |
| Mouse wheel zoom | NEEDS_MANUAL_QA | Source includes wheel handling; visual verification requires browser. |
| Double-click click-to-move | NEEDS_MANUAL_QA | Source includes click-to-move/pathfinding; behavior requires browser. |
| Go to person / room | NEEDS_MANUAL_QA | Source includes Go to actions; behavior requires browser. |
| Command palette | NEEDS_MANUAL_QA | Source includes Ctrl/Cmd+K handling and outside click close; behavior requires browser. |
| Left rail panels | NEEDS_MANUAL_QA | Source includes Rooms, People, Search, Chat, Calendar, Notices, Settings panels; visual scroll/overlap requires browser. |
| Private data in office UI | PASS | Code/privacy scan found no app/domain/idle summary exposure in office shell surfaces. |

## SaaS Page Results

| Page | Status | Notes |
| --- | --- | --- |
| `/dashboard` | PASS | Route loads; uses `AppShell` and `ManagerOverviewPanel`; privacy wording remains mock/fallback-oriented. |
| `/employees` | PASS | Route loads; source confirms search/filter directory component and privacy notice. Browser filter interaction NEEDS_MANUAL_QA. |
| `/employees/[id]` | PASS | `/employees/mia` loads. Multi-ID navigation NEEDS_MANUAL_QA. |
| `/reports` | PASS | Route loads; source says aggregated app names/domains only and no full URLs/private content. |
| `/compliance` | PASS | Route loads; source confirms onboarding acknowledgement CTA and local workflow update. Modal interaction NEEDS_MANUAL_QA. |
| `/integrations` | PASS | Route loads; code/mock scan indicates link-based integration surfaces only. |
| `/settings` | PASS | Route loads; reset workflow interaction NEEDS_MANUAL_QA. |

## API Results

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /health` | BLOCKED | API runtime did not expose a reachable server. |
| `POST /auth/dev-token` | BLOCKED | API runtime blocked. Code/docs confirm non-production intent. |
| `GET /auth/me` | BLOCKED | API runtime blocked. |
| `GET /companies/current` | BLOCKED | API runtime blocked. |
| `GET /users` | BLOCKED | API runtime blocked. |
| `GET /users/:userId` | BLOCKED | API runtime blocked. |
| `GET /devices` | BLOCKED | API runtime blocked. |
| `GET /virtual-office/map` | BLOCKED | API runtime blocked. |
| `GET /virtual-office/navigation` | BLOCKED | API runtime blocked. |
| `GET /virtual-office/map/:officeMapId/positions` | BLOCKED | API runtime blocked. |
| `GET /compliance/policy` | BLOCKED | API runtime blocked. |
| `POST /compliance/policy/:policyId/acknowledgement` | BLOCKED | API runtime blocked. |
| `GET /integrations` | BLOCKED | API runtime blocked. |
| `GET /integrations/contact-links/:targetUserId` | BLOCKED | API runtime blocked. |
| `GET /reports/usage-summary?userId=...` | BLOCKED | API runtime blocked. |
| `POST /activity/batch` | NOT_IMPLEMENTED | Documented future endpoint only. |

## Privacy / RBAC Results

| Check | Status | Notes |
| --- | --- | --- |
| Forbidden term scan | PASS | Matches were limited to "not collected" UI/docs or benign `cameraOffset` variable names. No collected/displayed forbidden employee data found. |
| Frontend no `/auth/dev-token` auto-call | PASS | `apps/web` contains no dev-token call; API client is fallback-safe. |
| Frontend mock role boundary | PASS | Login/root copy and workflow helper explicitly mark localStorage role state as frontend-only, not auth/RBAC. |
| Employee office people data | PASS | Code inspection found contact/collaboration data only in office people/contact surfaces. |
| Backend UUID validation | PASS | Code inspection confirms `ParseUUIDPipe` and `OptionalUuidPipe` usage. Runtime 400 checks BLOCKED. |
| Employee vs manager API RBAC | BLOCKED | Requires running API server and seed data. |
| Invalid JWT / missing auth | BLOCKED | Requires running API server. |
| Production dev-token/header fallback disabled | BLOCKED | Requires running API server with production env. |

## Tiled / Asset Results

| Check | Status | Notes |
| --- | --- | --- |
| `workmap2.tmx` exists | PASS | Found at `apps/web/public/maps/workmap2.tmx`. |
| External `.tsx` tilesets exist | PASS | Found all referenced tilesets under `apps/web/public/maps/tilesets/`. |
| Tileset PNG paths resolve | PASS | Referenced PNG files exist under `apps/web/public/modern-office/`. |
| TypeScript excludes public `.tsx` Tiled files | PASS | Web build/typecheck pass with current `.tsx` tileset files. |
| Tiled red-X visual check | NEEDS_MANUAL_QA | Requires Tiled or browser visual inspection. |
| Mini map visual readability | NEEDS_MANUAL_QA | Requires browser visual inspection. |

## Bugs Found

### BUG-001: API start commands do not expose a reachable server

- Severity: P1_HIGH
- Area: Backend API runtime / local QA
- Reproduction steps:
  1. Set `API_PORT=4010` and `WORKMAP_JWT_SECRET=qa-local-secret`.
  2. Run `npm run dev` from `apps/api`.
  3. Request `http://127.0.0.1:4010/health`.
  4. Repeat with `pnpm --filter @workmap/api dev` and `pnpm --filter @workmap/api exec nest start --debug`.
- Expected: Nest API listens on the configured port and `GET /health` returns liveness JSON.
- Actual: Watch compilation succeeds or command exits, but no tested API port is reachable. Direct built nested entrypoint also fails module resolution for `@workmap/auth`.
- Evidence: `Get-NetTCPConnection` showed no listener on attempted API ports; `Invoke-WebRequest /health` failed to connect; direct Node run returned `Cannot find module '@workmap/auth'`.
- Suggested fix: Add/verify Nest CLI configuration or package start path so `apps/api` starts the real compiled `src/main.ts` entrypoint with workspace package resolution.
- Owner: Backend
- Status: Open

## Not Implemented / Future Features

| Feature | Expected status | Notes |
| --- | --- | --- |
| Production email/password login | NOT_IMPLEMENTED | Planned only. |
| Microsoft SSO | NOT_IMPLEMENTED | Planned only. |
| Refresh tokens/session revocation | NOT_IMPLEMENTED | Planned only. |
| `POST /activity/batch` | NOT_IMPLEMENTED | Contract document exists; endpoint not implemented. |
| Desktop agent app tracking production flow | NOT_IMPLEMENTED | Future/partial package scaffolding only. |
| Browser extension domain bridge production flow | NOT_IMPLEMENTED | Future/partial package scaffolding only. |
| Worker aggregation | NOT_IMPLEMENTED | Future/partial package scaffolding only. |
| Redis/BullMQ queue | NOT_IMPLEMENTED | Not wired. |
| Socket.IO realtime movement | NOT_IMPLEMENTED | Not wired. |
| Real chat persistence | NOT_IMPLEMENTED | Frontend mock only. |
| Real calendar sync | NOT_IMPLEMENTED | Frontend mock/link-only. |
| Real notices persistence | NOT_IMPLEMENTED | Frontend mock only. |
| Microsoft Graph | NOT_IMPLEMENTED | Not implemented. |
| Native video/voice meeting | NOT_IMPLEMENTED | Not implemented. |
| Avatar backend persistence | NOT_IMPLEMENTED | LocalStorage only. |

## Skill Docs Updated

| File | Change |
| --- | --- |
| `docs/ai-skills/01-frontend-engineer.md` | Added verified QA status for build, route smoke, browser automation block, and manual QA needs. |
| `docs/ai-skills/02-backend-engineer.md` | Added verified QA status for command pass and API runtime startup blocker. |
| `docs/ai-skills/05-test-engineer.md` | Added current QA pass results and known blockers. |
| `docs/ai-skills/06-security-engineer.md` | Added privacy scan/RBAC verification status and API runtime block. |
| `docs/ai-skills/09-game-movement-system.md` | Added movement QA status: source/build/route pass, interaction visual checks need manual QA. |

## Recommended Next Steps

1. Fix the API runtime start path/configuration, then rerun the protected endpoint, RBAC, invalid UUID/JWT, and production fallback tests.
2. Run browser/manual QA for virtual-office movement, collision, click-to-move, zoom/pan, command palette, panels, and drawer behavior.
3. Run manual Tiled/browser visual QA for missing red-X tiles, mini map readability, and overlay overlap.
