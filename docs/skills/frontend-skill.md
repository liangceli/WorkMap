# Frontend Skill

## Structure

Frontend app: `workmap/apps/web`.

Important areas:

- `app/`: Next.js App Router pages.
- `components/layout`: app shell navigation.
- `components/ui`: WorkMap UI primitives.
- `components/dashboard`, `components/employees`, `components/reports`, `components/compliance`, `components/integrations`: product surfaces.
- `components/office`: virtual office UI and canvas implementation.
- `components/avatar`, `lib/avatar`: avatar preview, storage, layer assets, frame maps.
- `lib/api`: frontend API client and endpoint wrappers.
- `lib/auth/pilotSession.ts`: browser pilot session storage and API auth options.
- `lib/auth/cognitoSession.ts`: Cognito Hosted UI config, PKCE transaction, token exchange, session storage, and logout URL handling.
- `lib/workflow/workflowState.ts`: frontend-only demo onboarding/login state.
- `lib/theme/workmapTheme.ts`: central theme tokens.

## Routes Confirmed

- `/`: home/onboarding router surface.
- `/login`: pilot sign-in surface with frontend fallback.
- `/login/callback`: Cognito Hosted UI callback and WorkMap mapping surface.
- `/onboarding/company`
- `/onboarding/avatar`
- `/onboarding/device-setup`
- `/dashboard`
- `/employees`
- `/employees/[id]`
- `/reports`
- `/compliance`
- `/integrations`
- `/settings`
- `/avatar-debug`
- `/virtual-office`

## API Usage

`lib/api/apiClient.ts` supports `GET` and `POST` with optional Bearer token and default development base URL `http://localhost:3001`. In production, `NEXT_PUBLIC_WORKMAP_API_URL` must be set or API calls fall back with an error result.

Known API wrappers include auth, users, reports, integrations, compliance, and virtual office. Some pages/components still rely on mock data instead of API calls.

Local env behavior:

- `apps/web/next.config.ts` loads root `workmap/.env` for local dev/build before exporting Next config.
- Existing platform/shell env wins; root `.env` only fills missing keys.
- Restart the web dev server after changing root `.env`.

Pilot readiness API wrappers:

- `lib/api/healthApi.ts` wraps `GET /health`.
- Reports API types now match backend `/reports/usage-summary` with `apps[]` and `websites[]` rows containing active/idle seconds.

For `/virtual-office`, `components/office/useVirtualOfficeData.ts` now attempts virtual-office API loading and falls back to mock data. It asks `lib/api/apiAuth.ts` for API auth options, preferring stored pilot Bearer session before development dev-token fallback, then passes any token to the map/navigation/positions calls. It validates unknown `zoneData`, `anchor`, `bounds`, player coordinates, statuses, and directions before using API data.

Pilot login/session:

- `/login` supports Cognito Hosted UI sign-in when `NEXT_PUBLIC_COGNITO_*` config is present, and remains a pilot sign-in surface with seeded pilot users, password/company slug fields, session display, open-office action, logout/session clear, and clearly labeled frontend fallback.
- `authApi.ts` exposes `createPilotSession()`.
- `pilotSession.ts` stores `workmap.pilotSession`, clears expired sessions, exposes Bearer API options, maps backend roles to workflow roles, and clears session on logout.
- `cognitoSession.ts` stores Cognito sessions under `workmap.cognitoSession` and PKCE transactions under `workmap.cognitoTransaction`.
- `/login/callback` exchanges the Cognito code, stores Cognito session, calls `/auth/me` with the Cognito id token, and maps the returned WorkMap role into workflow state before opening `/virtual-office`.
- `apiAuth.ts` prefers mapped Cognito session, then pilot session, then development dev-token/dev-cache fallback.
- `AppShell` shows pilot session state, role/session context, backend Bearer messaging, and logout behavior.
- AppShell now prefers the pilot session role when present, limits fallback navigation before session/workflow setup, and links unclear/missing-session states back to `/login`.

Dashboard and reports readiness:

- `components/dashboard/ManagerOverviewPanel.tsx` is now a pilot readiness surface for API health, auth context, virtual-office presence, compliance policy, and reports usage summary.
- Dashboard should keep live API status, fallback state, sparse data, and pilot example/sample labels visually distinct.
- `components/reports/ReportSummaryPanel.tsx` loads authenticated `/reports/usage-summary` data for current-user app/domain rows.
- Reports should explain sparse pilot data when API rows are empty and keep department/team rows labeled as pilot examples until a backend aggregate endpoint exists.
- `AppUsageTable.tsx` and `WebsiteUsageTable.tsx` support optional titles so API-backed rows and example rows can be labeled clearly.

Current-user position persistence:

- `apiClient.ts` includes `workMapApiPut`.
- `virtualOfficeApi.ts` exposes `saveCurrentVirtualOfficePosition`.
- `useVirtualOfficeData.ts` exposes `officeMapId`, authenticated `apiOptions`, and `currentUserPosition`; it filters the current user out of remote players.
- `OfficeMap.tsx` restores the local player once from the current user's saved API position when available and local movement/interactions have not already touched the player.
- `OfficeMap.tsx` saves meaningful local changes with throttled/debounced PUT calls.
- Restore/save guard logic prevents stale default position snapshots from overwriting a just-restored backend position.

Basic polling presence:

- `useVirtualOfficeData.ts` polls positions after authenticated API setup.
- Visible interval is about 4 seconds; hidden interval is about 15 seconds.
- Polling updates `remotePlayers` and `currentUserPosition`, not local movement state.
- `document.visibilityState`, an in-flight guard, request counters, timeout cleanup, and a `visibilitychange` listener manage cadence and stale responses.
- Failed polling responses keep the last good state or fallback.
- API-valid empty remote results are treated as an empty remote list rather than reverting to mock remote people.
- Remote freshness maps `updatedAt` to existing statuses: recent keeps backend status, 30 seconds to 5 minutes maps to `idle`, and older than 5 minutes maps to `offline`.

People/Presence UI:

- `presence.ts` exposes shared status color, status label, freshness status, and freshness label helpers.
- `OfficeSidePanel.tsx` renders the current-user card, team summary, filters, source notes, empty/search states, readable room labels, and last-seen text.
- `OfficeCommandPalette.tsx` shows freshness/last-seen context and readable room labels in People results.
- `OfficeMap.tsx` passes local player and presence source to the side panel.
- `OfficeMap.tsx` stores latest remote people and selected remote id in refs so polling updates do not restart the canvas animation/image-loading effect.

## State Management

No Redux/Zustand/global state library was confirmed. Current state is mostly React local state plus localStorage helpers for demo workflow and avatar selection.

`useVirtualOfficeData.ts` performs a one-time initial async load on mount with a cancellation flag, then starts polling positions when authenticated API context is available. Position writes are handled from `OfficeMap.tsx` through throttled/debounced current-user latest-position saves; no websocket listeners were added.

Pilot API auth token data is cached in localStorage under `workmap.pilotSession`. Development API auth token data is cached under `workmap.devApiAuth`. The normal login/onboarding workflow remains for continuity and fallback, not production authorization.

Position save writes are movement-driven and latest-position-only. They are not realtime sharing and do not create position history.

## UI Rules

Use existing `wm` and `wmStyles` theme tokens and `components/ui` primitives where practical. The visual direction is restrained SaaS/workplace UI with a full-screen virtual office canvas for `/virtual-office`.
