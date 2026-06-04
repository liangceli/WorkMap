# Latest Implementation Handoff

## 1. Original Task Brief

Build Pilot Auth + Privacy/Compliance Boundary MVP.

Goal: complete the second large pilot cycle so WorkMap feels less like a local demo and more like a controlled 5-person pilot product.

Key requirements:

- Add a clearer pilot-ready authenticated app entry path.
- Use backend-issued JWTs where practical.
- Persist/reuse authenticated API context after login/refresh.
- Add logout/session clear behavior.
- Keep dev-token behavior development-only.
- Ensure `/virtual-office` uses authenticated current-user context when available.
- Keep current user out of remote teammates.
- Preserve position save/restore/polling behavior.
- Surface clear privacy/compliance language explaining what WorkMap shows and does not show.
- Use existing compliance policy/acknowledgement API where practical.
- Do not add websocket/SSE, production SSO/OAuth, billing, full admin, schema/migration, movement/map/chair/contact drawer changes, or new dependencies.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/apps/api/src/modules/auth/auth.controller.ts` | Added `POST /auth/pilot-login` for explicit pilot sign-in. Existing `POST /auth/dev-token` and `GET /auth/me` remain. |
| `workmap/apps/api/src/modules/auth/auth.service.ts` | Added pilot email/password verification using Node built-in PBKDF2, backend-issued JWT response reuse, production guard when pilot hash is not configured, and typed JWT role payload. |
| `workmap/.env.example` | Documented `WORKMAP_PILOT_PASSWORD_HASH` for pilot/local credential configuration. |
| `workmap/apps/web/lib/api/apiTypes.ts` | Added shared auth-user/session and compliance acknowledgement response types. |
| `workmap/apps/web/lib/api/authApi.ts` | Added frontend client wrapper for `POST /auth/pilot-login`. |
| `workmap/apps/web/lib/api/apiAuth.ts` | Added unified API auth resolver: prefer stored pilot session, then development dev-token fallback where available. |
| `workmap/apps/web/lib/auth/pilotSession.ts` | Added browser-scoped pilot session storage, expiration handling, Bearer API options, session clear, and role mapping into the existing demo workflow state. |
| `workmap/apps/web/components/login/MockLoginPanel.tsx` | Converted `/login` into a pilot sign-in surface with seeded pilot users, password/company slug fields, session display, open-office action, logout/session clear, and clearly labeled frontend fallback. |
| `workmap/apps/web/components/layout/AppShell.tsx` | Shows pilot session state, backend Bearer context messaging, role pill, and logout behavior in the app shell. |
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | Uses the unified auth resolver so `/virtual-office` API calls prefer the authenticated pilot session before dev-token fallback. |
| `workmap/apps/web/components/office/OfficeSidePanel.tsx` | Added a People-panel privacy boundary explaining visible presence/location/status/freshness and what is not shown. |
| `workmap/apps/web/app/compliance/page.tsx` | Updated top-level compliance copy from mock preview to pilot transparency boundary. |
| `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx` | Loads existing backend policy with the current API auth context, surfaces role/visibility boundary text, posts acknowledgement to the backend, stores a browser marker for refresh readability, and falls back safely when auth/API is unavailable. |
| `workmap/apps/web/components/compliance/PolicyAcknowledgementModal.tsx` | Replaced mock acknowledgement language with pilot visibility language and added busy/disabled acknowledgement handling. |
| `workmap/apps/web/lib/api/complianceApi.ts` | Uses the shared acknowledgement response type. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Workspace notes:

- `artresource.tiled-session` is a tracked dirty file that appears unrelated to this task.
- `docs/references/` is an untracked directory and was not reviewed as part of this implementation.

## 3. Implementation Summary

Pilot auth/session:

- Added `POST /auth/pilot-login`.
- Login input is email + password + optional company slug.
- The backend finds the user by email/company scope and never trusts user id from the client.
- Password verification uses Node built-in `pbkdf2Sync` and `timingSafeEqual`; no new dependencies were added.
- Password is compared against `WORKMAP_PILOT_PASSWORD_HASH`.
- In non-production, a local pilot hash is available for the seeded/demo password `workmap-pilot`.
- In production, pilot login is disabled unless `WORKMAP_PILOT_PASSWORD_HASH` is explicitly configured.
- JWT responses reuse the same bearer-token shape as the existing development token bridge.
- JWT role payload is typed as `WorkMapRole`.

Frontend login/session:

- `/login` now has a pilot sign-in path for seeded pilot users.
- Successful login stores a browser-scoped `workmap.pilotSession` entry with token, expiry, and auth user context.
- Stored sessions expire one minute before token expiry and are cleared automatically.
- Existing demo workflow state is still used for onboarding/navigation continuity, but the backend token is the preferred API auth context.
- Logout clears the pilot session and demo workflow state.
- Frontend fallback remains clearly labeled as non-API demo flow.

Virtual office auth:

- `/virtual-office` now calls `getWorkMapApiAuthOptions()`.
- The resolver prefers the stored pilot Bearer token.
- If no pilot session exists, the existing development dev-token/dev-cache flow remains available in development.
- Current-user filtering continues to use the authenticated user id, so the current user does not duplicate as a remote teammate.
- No polling cadence, websocket/SSE, movement, collision, pathfinding, chair, contact drawer, map rendering source, or assets were changed.

Privacy/compliance:

- People panel now explains that teammates can see avatar location, workspace status, and last-seen freshness.
- People panel also states that screen recording, keystroke logging, hidden webcam/microphone, and message content are not shown there.
- Compliance page now uses pilot transparency wording instead of mock-only wording.
- Compliance panel shows:
  - visible in WorkMap: presence, avatar location/room, workspace status/freshness, last seen, acknowledgement timestamp
  - not monitored: screen recording, keystroke logging, hidden webcam/microphone, private message/email content, passwords/form inputs, invisible employee spying
- Compliance acknowledgement uses existing backend endpoints:
  - `GET /compliance/policy`
  - `POST /compliance/policy/:policyId/acknowledgement`
- If auth or policy loading fails, the page shows safe read-only transparency copy and does not pretend a backend acknowledgement was recorded.

Role/visibility boundary:

- Existing roles are preserved.
- AppShell shows role/session context.
- Compliance copy says employee/manager/owner visibility is limited to where API guards actually support it.
- No fake enterprise permission model was invented.

## 4. User-Visible Changes

- `/login` has a clear pilot sign-in path using backend JWTs.
- Users can see the signed-in pilot user, role, expiry, and clear the session.
- App shell distinguishes a real pilot Bearer session from frontend demo fallback.
- `/virtual-office` uses the pilot session for API calls when available.
- People panel includes a calm privacy boundary for visible presence/freshness.
- `/compliance` can load backend policy and record acknowledgement when signed in.
- Compliance copy explains what WorkMap shows and what it does not monitor.

## 5. Technical Notes

- No Prisma schema, migration, or seed changes were made.
- No plaintext passwords are stored.
- The default local pilot credential is development/pilot only:
  - email examples are seeded/demo users such as `engineer@workmap.demo`
  - password is `workmap-pilot`
  - company slug is `workmap-demo-company`
- Production auth is not claimed complete:
  - no SSO/OAuth
  - no MFA
  - no password reset
  - no tenant admin credential lifecycle
  - no enterprise authorization overhaul
- The development token endpoint remains disabled in production.
- Compliance acknowledgement is backend-backed, but the current policy GET endpoint does not return acknowledgement status; the frontend stores a browser marker after successful backend acknowledgement so refresh behavior is understandable in the pilot.
- Manual browser QA is still recommended for layout, login flow, and virtual office regressions.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm lint
pnpm typecheck
pnpm build
```

Results:

- All commands passed.
- Web builds printed the existing warning that the Next.js plugin was not detected in ESLint config.

Local HTTP smoke verification:

- Started the freshly built API temporarily on `http://127.0.0.1:3012`, then killed it.
- `GET /health` returned `ok`.
- `POST /auth/pilot-login` succeeded for `engineer@workmap.demo` / `workmap-pilot` / `workmap-demo-company`.
- `GET /auth/me` succeeded with the returned Bearer token.
- `GET /compliance/policy` succeeded and returned policy version `v1`.
- `POST /compliance/policy/:policyId/acknowledgement` succeeded and returned `acknowledgedAt`.
- Started the freshly built API temporarily on `http://127.0.0.1:3013`, then killed it.
- With the pilot Bearer token:
  - `GET /virtual-office/map` succeeded.
  - `GET /virtual-office/navigation` succeeded and returned 6 destinations.
  - `GET /virtual-office/map/:officeMapId/positions` succeeded and returned 5 positions.

Manual/browser verification:

- After the user released the ports, the implementation chat cleared `apps/web/.next`, started API on `3001`, started web on `3000`, verified the running app, then stopped the started API/web/browser processes.
- `GET http://127.0.0.1:3000/virtual-office` returned `200` after the frontend restart.
- In-app Browser connector was unavailable (`Browser is not available: iab`), and Playwright CLI was not installed, so verification used a temporary headless Edge instance through Chrome DevTools Protocol.
- Login UI:
  - Opened `/login`.
  - Clicked `Sign in with pilot auth` for `engineer@workmap.demo`.
  - `POST /auth/pilot-login` returned `201`.
  - Browser `localStorage` contained `workmap.pilotSession` with user `engineer@workmap.demo`, role `EMPLOYEE`, and a bearer token.
  - App navigated to `/compliance`.
- Compliance UI:
  - `/compliance` loaded under the pilot session.
  - `GET /compliance/policy` included `Authorization: Bearer ...` and returned `200`.
  - Clicked `Review and acknowledge`, then `Acknowledge policy`.
  - Browser acknowledgement marker was written after backend acknowledgement.
  - Refreshing `/compliance` showed `Acknowledged`, policy version `v1`, `Visible in WorkMap`, and `Not monitored`.
  - No browser console errors/warnings were captured for the compliance flow.
- Virtual office UI:
  - Set the existing onboarding/avatar localStorage flags required to enter `/virtual-office` for browser QA.
  - `/virtual-office` loaded with a canvas and `WorkMap Office`.
  - Requests included `Authorization: Bearer ...` for:
    - `GET /virtual-office/map`
    - `GET /virtual-office/navigation`
    - `GET /virtual-office/map/:officeMapId/positions`
    - `PUT /virtual-office/map/:officeMapId/positions/me`
    - subsequent polling `GET /virtual-office/map/:officeMapId/positions`
  - People panel showed `You`, readable room labels such as `Open Office` / `Office area`, and no raw UUID text.
  - People panel showed the privacy copy: `Presence is visible in the office`.
  - Clicked `available`, `focus`, `busy`, `idle`, and `offline` filters; no browser console errors/warnings were captured.
  - The canvas element stayed stable across polling observation and filter interactions.
- Logout/session clear:
  - Clicked `Log out`.
  - Browser `localStorage` no longer contained `workmap.pilotSession` or `workmap.userSetupState`.
- Backend-off fallback:
  - Stopped API on `3001` and started only frontend on `3000`.
  - `/compliance` still rendered safe transparency copy with `Visible in WorkMap` and `Not monitored`.
  - `/virtual-office` still rendered `WorkMap Office` and canvas with backend unavailable.
  - Browser logs showed expected network `ERR_CONNECTION_REFUSED` entries for API calls, with no runtime exception crash captured.
- No long-running dev server or browser process was left running by this verification.
- The local compliance smoke test wrote/upserted one acknowledgement for the local seeded engineer user in the development database.

## 7. Manual QA Suggestions

Use frontend on:

```text
http://localhost:3000
```

Use backend on:

```text
http://localhost:3001
```

Suggested checks:

- Open `/login`.
- Sign in as `engineer@workmap.demo` with password `workmap-pilot` and company slug `workmap-demo-company`.
- Confirm a pilot session card appears with user, role, and expiry.
- Refresh and confirm the session remains understandable.
- Click clear session/logout and confirm session state is removed.
- Sign in again and open `/virtual-office`.
- Confirm network requests include `Authorization: Bearer ...`.
- Confirm current user is not duplicated in People panel/map.
- Confirm map renders, position restore/save works, remote users update through polling, People panel works, and contact drawer opens.
- Confirm backend-off or cleared-token fallback remains safe in development.
- Open `/compliance`.
- Confirm backend policy loads under a pilot session.
- Acknowledge the policy and refresh; confirm the browser marker makes acknowledgement state understandable.
- Stop backend and reload `/compliance`; confirm safe fallback text appears and no crash occurs.
- Regression test WASD/arrow movement, collision, double-click auto-walk, chair `E` interaction, room/zone status, command palette People search, desktop viewport, and narrow viewport.

## 8. Risks / Notes

- Browser/runtime QA passed for the main pilot auth, compliance acknowledgement, and virtual-office API-auth path using temporary local services on `3000`/`3001`.
- Full human visual QA is still recommended for narrow viewport layout, double-click auto-walk, chair interaction, and contact drawer ergonomics.
- This is pilot-ready auth, not production-enterprise auth.
- The shared pilot password is intentionally for seeded/demo pilot users and must not be treated as production credential management.
- In production, `WORKMAP_PILOT_PASSWORD_HASH` must be explicitly configured for pilot login to work; otherwise pilot login is disabled.
- Current compliance acknowledgement readback is not exposed by the backend policy endpoint; frontend stores a browser marker only after a successful backend acknowledgement.
- App route protection remains lightweight; AppShell exposes session/fallback state and role-based navigation visibility, but there is no full route guard/permission overhaul.
- Existing dev-token fallback remains development-only.
- `artresource.tiled-session` and `docs/references/` are pre-existing workspace changes and should not be staged unless intentionally included.

## 9. Docs Update Suggestions

- `docs/skills/project-summary.md`: record pilot auth path, backend JWT session, `/login` behavior, and compliance transparency boundary.
- `docs/skills/api-contract-skill.md`: document `POST /auth/pilot-login`, response shape, and compliance acknowledgement endpoints.
- `docs/skills/current-status.md`: record that Pilot Auth + Privacy/Compliance Boundary MVP is implemented and static/API/browser-runtime verified, with final human visual QA recommended.
- `docs/skills/backend-skill.md`: note PBKDF2 pilot password hash configuration and production-disabled behavior when no hash is configured.
- `docs/skills/deployment-skill.md`: document `WORKMAP_PILOT_PASSWORD_HASH`, frontend `localhost:3000`, backend `localhost:3001`, and avoid using long-running dev server commands as blocking verification.
