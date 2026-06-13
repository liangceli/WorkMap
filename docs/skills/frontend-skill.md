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
- `lib/auth/pendingInvite.ts`: pending invite token storage while Cognito Hosted UI sign-in completes.
- `lib/auth/displayName.ts`: safe display-name derivation and sanitization helpers.
- `lib/avatar/avatarProfile.ts`: compact backend layered avatar reference encode/decode helpers.
- `lib/workflow/workflowState.ts`: frontend-only demo onboarding/login state.
- `lib/theme/workmapTheme.ts`: central theme tokens.
- `lib/office/virtualOfficeMapAdapter.ts`: validates API map manifest/room/navigation/position data and derives safe fallback map config.
- `lib/office/officeNavigationConfig.ts`: derives office navigation destinations from the shared default map manifest.

## Routes Confirmed

- `/`: home/onboarding router surface.
- `/login`: pilot sign-in surface with frontend fallback.
- `/login/callback`: Cognito Hosted UI callback and WorkMap mapping surface.
- `/onboarding/company`
- `/onboarding/invite`
- `/onboarding/avatar`
- `/onboarding/device-setup`
- `/invite/[token]`
- `/dashboard`
- `/employees`
- `/employees/[id]`
- `/reports`
- `/compliance`
- `/integrations`
- `/settings`
- `/avatar-debug`
- `/virtual-office`
- `/platform-admin`

## STAGE 3 Frontend Experience Foundation

Commit `333b789` added a frontend-only product experience polish pass.

- Scope stayed under `apps/web/**`; no backend, Prisma, auth architecture, realtime protocol, map engine, deployment config, desktop-agent, browser-extension, or env behavior changed.
- `components/layout/AppShell.tsx` now uses `usePathname()` for active-route styling.
- AppShell navigation has clearer grouped labels, workspace/platform context text, role/session pill styling, and wrapping behavior.
- Navigation visibility remains UX-only; backend RBAC remains the security boundary.
- Shared page headers in `lib/theme/workmapTheme.ts` can wrap, and shared title/eyebrow styles no longer use non-zero or negative letter spacing.
- `/login` and `MockLoginPanel` distinguish deployed alpha Cognito login, pilot backend fallback, and frontend/local fallback more clearly.
- Dashboard copy reads as a workspace overview for presence, coverage, compliance, and summaries while preserving live API/fallback status.
- Reports copy emphasizes role-aware own/company summaries, aggregate-only company views, sparse-data states, and labeled example layouts.
- Compliance keeps explicit collected/not-collected privacy boundaries and improves responsive policy card layout.
- Employees directory controls/table behavior is more stable on narrower screens through wrapping controls and horizontal table scrolling.
- Virtual Office top chrome now frames the map as live team presence without changing rendering, movement, realtime, polling, People panel, contact drawer, chair interaction, or command palette behavior.
- Platform Admin copy reinforces independent platform-only context and privacy-safe tenant metadata.

Commit `60fc0ca` added role-based alpha journey hardening on top of the Round 1 polish.

- Scope remained frontend-only under `apps/web/**`; no backend, Prisma, auth architecture, realtime protocol, map engine, deployment config, desktop-agent, browser-extension, tracking, billing, chat, or map editor behavior changed.
- Dashboard now shows Owner-specific next steps such as inviting employees, opening the office, viewing reports, and reviewing compliance.
- Dashboard can present Employee workspace guidance without Owner-only CTAs.
- `/onboarding/company` explains the Owner post-create path: avatar/profile setup, compliance review, employee invites, and virtual office entry.
- `/onboarding/invite` gives Owner-only guidance before invite list/create calls and shows friendlier non-owner/forbidden states.
- `/invite/[token]` explains the Employee invite path through Cognito sign-in, workspace join, compliance, avatar/profile, device setup, and virtual office.
- Invite acceptance maps common forbidden/expired/already-used states into friendlier user-facing copy.
- Reports explain Employee own-report scope and Owner/Manager company aggregate scope without changing the API contract.
- `/platform-admin` blocked states explain that tenant roles do not grant Platform Admin access; platform access remains Cognito/platform allowlist-driven.
- AppShell no-role/unauthenticated state does not show tenant workspace navigation before a workspace role is resolved.

Commit `5d4412a` productized Dashboard, Reports, and Compliance for controlled alpha.

- Scope stayed frontend-only in Dashboard, Reports, Compliance, and page copy/state presentation.
- Dashboard now reads as a workspace management overview for Owners and a personal workspace view for Employees, not a QA/readiness panel.
- Dashboard product labels use calmer terms such as `Workspace API`, `Session`, and `Data coverage` while preserving live/fallback/sparse state honesty.
- Dashboard setup coverage and next-step guidance should stay role-aware and honest about alpha client limitations.
- Reports include role/scope explanation cards for Employee view, Owner view, and alpha data availability.
- Reports should explain own-scope rows versus company aggregate summaries and must not imply raw employee activity streams.
- Reports no-data states should describe sparse alpha setup and point toward device registration/app-domain event submission, not fake success.
- Reports example rows must remain visibly labeled as frontend examples, not real tenant data.
- Compliance page is now framed as `Transparency policy` rather than monitoring-first language.
- Compliance trust sections should explain why data exists, who can see what, alpha client limitations, and Platform Admin privacy boundary.
- Existing collected/not-collected lists and acknowledgement flow remain part of the product boundary.

## API Usage

`lib/api/apiClient.ts` supports `GET`, `POST`, and `PATCH` with optional Bearer token and default development base URL `http://localhost:3001`. In production, `NEXT_PUBLIC_WORKMAP_API_URL` must be set or API calls fall back with an error result.

Known API wrappers include auth, users, reports, integrations, compliance, and virtual office. Some pages/components still rely on mock data instead of API calls.

Local env behavior:

- `apps/web/next.config.ts` loads root `workmap/.env` for local dev/build before exporting Next config.
- Existing platform/shell env wins; root `.env` only fills missing keys.
- Restart the web dev server after changing root `.env`.

Pilot readiness API wrappers:

- `lib/api/healthApi.ts` wraps `GET /health`.
- Reports API types now match backend `/reports/usage-summary` with `apps[]` and `websites[]` rows containing active/idle seconds.
- `lib/api/tenantOnboardingApi.ts` wraps tenant onboarding status/workspace creation.
- `lib/api/invitationsApi.ts` wraps invitation list/create/accept.
- `lib/api/companiesApi.ts` wraps current company summary.
- `lib/api/usersApi.ts` wraps user directory/profile reads and current-user profile updates.
- `lib/api/realtimeApi.ts` derives virtual-office realtime WebSocket URLs from the existing API base URL, converting `http` to `ws` and `https` to `wss`.
- `lib/api/platformApi.ts` wraps the independent `/platform/*` APIs.
- `lib/api/platformAuth.ts` uses Cognito-only platform auth and `/platform/me`; it intentionally does not call tenant `/auth/me`.
- `lib/api/activityApi.ts` wraps app/domain activity ingestion.
- `lib/api/devicesApi.ts` wraps device list/register/heartbeat.

For `/virtual-office`, `components/office/useVirtualOfficeData.ts` now attempts virtual-office API loading and falls back to mock data. It asks `lib/api/apiAuth.ts` for API auth options, preferring mapped Cognito session, then stored pilot Bearer session, then development dev-token fallback, and passes any token to the map/navigation/positions calls. It validates unknown `zoneData`, `anchor`, `bounds`, player coordinates, statuses, and directions before using API data.

Map manifest behavior:

- Round 6 added a shared default virtual-office map manifest and frontend adapter.
- `useVirtualOfficeData.ts` routes API map/room/navigation/position data through `virtualOfficeMapAdapter.ts`.
- `OfficeMap.tsx` uses the active manifest for TMX path, canvas size, collision layer names, render layer order, default spawn, and safe fallback spawn.
- Invalid API map config falls back to the default manifest.
- Rooms with invalid or out-of-bounds `zoneData` are filtered out.
- Navigation destinations with invalid or out-of-bounds anchors/bounds are filtered out.
- Player positions outside active manifest bounds are ignored before rendering/restoring.
- With no saved backend position and no local movement, `OfficeMap` realigns the local player to the active manifest safe/default spawn after office data loads.
- Saved backend position restore remains authoritative when valid.
- `mockOfficeData.ts` and `officeNavigationConfig.ts` derive fallback rooms/navigation from the shared default manifest.

Pilot login/session:

- `/login` supports Cognito Hosted UI sign-in when `NEXT_PUBLIC_COGNITO_*` config is present, and remains a pilot sign-in surface with seeded pilot users, password/company slug fields, session display, open-office action, logout/session clear, and clearly labeled frontend fallback.
- `authApi.ts` exposes `createPilotSession()`.
- `pilotSession.ts` stores `workmap.pilotSession`, clears expired sessions, exposes Bearer API options, maps backend roles to workflow roles, and clears session on logout.
- `cognitoSession.ts` stores Cognito sessions under `workmap.cognitoSession` and PKCE transactions under `workmap.cognitoTransaction`.
- `/login/callback` exchanges the Cognito code, stores Cognito session, prioritizes pending invite routing, calls `/auth/me` for normal mapped users, and routes through `getNextRouteForUser(nextState)` instead of hardcoding `/virtual-office`.
- `apiAuth.ts` prefers mapped Cognito session, then pilot session, then development dev-token/dev-cache fallback.
- `AppShell` shows pilot session state, role/session context, backend Bearer messaging, and logout behavior.
- AppShell now prefers the pilot session role when present, limits fallback navigation before session/workflow setup, and links unclear/missing-session states back to `/login`.

Platform Admin:

- `/platform-admin` is a platform-level admin surface, not a tenant OWNER page.
- It requires `getWorkMapPlatformApiAuthOptions()` and `/platform/me` success.
- Independent platform admins can access it even when they do not have a tenant/company `User`.
- Tenant users who are not configured platform admins see blocked UI and do not get Platform Admin AppShell navigation.
- `/login/callback` routes configured platform admins to `/platform-admin` before tenant onboarding fallback.
- The existing Cognito continue path in `/login` mirrors platform-admin routing.
- AppShell shows Platform Admin navigation/session summary only when `/platform/me` succeeds.
- Platform Admin should display only privacy-safe tenant metadata, tenant readiness/health, and platform audit summaries.
- Tenant selector buttons should use consistent longhand border properties across active/inactive states; do not mix `border` shorthand with `borderColor`, which previously triggered a React/Next style overlay when switching tenants.

Tenant onboarding / invites:

- `/onboarding/company` creates a backend company/workspace and OWNER user when a Cognito session is present, asks the Owner to confirm/edit display name, and routes Owner to avatar setup when backend avatar is missing; demo fallback remains.
- `/onboarding/invite` lets Owners list/create copyable invite links.
- `/invite/[token]` stores a pending invite token before Cognito sign-in, uses a stable initial `Checking invitation...` render to avoid hydration mismatch, requires invited employees to enter a display name, and accepts invites after Cognito auth is available.
- After invite acceptance, the page saves frontend workflow state with `hasCompany: true` and routes with `getNextRouteForUser(nextState)`.
- Accepted employees should flow through compliance/avatar/device onboarding before `/virtual-office`.

Backend-backed profile/avatar:

- `/onboarding/avatar` requires a display name before continuing when backend profile is incomplete.
- Avatar save writes `displayName` plus encoded `layered:v2:` avatar reference through `PATCH /users/me`.
- Returning Cognito users call `/users/me`; if backend `avatarId` decodes as a complete layered avatar, frontend caches it and skips avatar recreation.
- OWNER default workflow no longer treats avatar as complete without backend avatar/profile confirmation.
- Authenticated API users should not satisfy avatar completion with local cache when backend avatar is missing/invalid.

Role-aware surfaces:

- AppShell hides Dashboard, Reports, Integrations, Settings, and Invites from employee roles where appropriate.
- AppShell should not show tenant workspace navigation when no workspace role has been resolved.
- Virtual-office command palette hides Dashboard/Integrations shortcuts from employees.
- `/employees` loads real same-tenant users from `GET /users` when API auth succeeds and labels mock directory data as fallback only.
- API-backed employee directory rows do not link real UUID users to the old mock detail route.

Dashboard and reports readiness:

- `components/dashboard/ManagerOverviewPanel.tsx` is now a pilot readiness surface for API health, auth context, virtual-office presence, compliance policy, and reports usage summary.
- Dashboard should keep live API status, fallback state, sparse data, and pilot example/sample labels visually distinct.
- Dashboard should present Owner workspace management and Employee personal workspace views with role-appropriate setup coverage and next steps.
- `components/reports/ReportSummaryPanel.tsx` loads authenticated `/reports/usage-summary` data for current-user app/domain rows.
- Reports request a conservative scope based on the resolved backend role: employees use own summaries, OWNER/MANAGER/TEAM_LEAD/HR_ADMIN can request company aggregate summaries, and IT_ADMIN is not automatically given company app/domain summaries by the frontend.
- Reports should explain sparse pilot data when API rows are empty.
- Reports should keep Employee own-scope, Owner/Manager aggregate-scope, and alpha data availability explanations visible.
- Dashboard and Reports can show tracking coverage metadata such as registered devices, active devices in 24 hours, and users with activity rows.
- `AppUsageTable.tsx` and `WebsiteUsageTable.tsx` support optional titles so API-backed rows and example rows can be labeled clearly.

Activity tracking frontend surfaces:

- `apiAuth.ts` carries resolved backend role in API auth results so reports can choose a conservative scope.
- `developmentApiAuth.ts` stores/validates role in the development auth cache.
- `ReportSummaryPanel.tsx` displays API-backed app/domain rows and device coverage metadata.
- `ManagerOverviewPanel.tsx` shows tracking coverage readiness from backend summary metadata.
- Compliance policy and acknowledgement modal copy describe app name/duration, browser domain/duration, device heartbeat, timestamps, and explicit non-collected data.
- Frontend surfaces should not imply screenshots, screen recording, keystrokes, clipboard, camera/microphone, private messages/emails, full URLs, page content, form inputs, or passwords are collected.

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

Realtime virtual-office movement:

- `components/office/useVirtualOfficeRealtime.ts` owns the browser WebSocket connection for `/virtual-office/realtime`.
- It connects only when `officeMapId` and token-backed API auth options are available.
- It sends `office:join`, throttled `player:move` snapshots, and `office:leave`.
- Visible movement sends are throttled around 110ms; hidden tabs slow to about 1000ms.
- Important stop, room, or status changes are sent promptly.
- Reconnect/fallback behavior leaves polling active so the page still has a reconciliation path.
- `OfficeMap.tsx` stores realtime remote state in refs to avoid React render storms and canvas reloads.
- Remote avatars interpolate toward latest realtime targets; large jumps and stale updates snap safely.
- Canvas contact hit testing uses rendered realtime positions so teammate clicks match where avatars appear.
- Avatar asset loading uses stable `userId:avatarId` signatures and cancellation guards.

People/Presence UI:

- `presence.ts` exposes shared status color, status label, freshness status, and freshness label helpers.
- `OfficeSidePanel.tsx` renders the current-user card, team summary, filters, source notes, empty/search states, readable room labels, and last-seen text.
- `OfficeCommandPalette.tsx` shows freshness/last-seen context and readable room labels in People results.
- `OfficeMap.tsx` passes local player and presence source to the side panel.
- `OfficeMap.tsx` stores latest remote people and selected remote id in refs so polling updates do not restart the canvas animation/image-loading effect.

## State Management

No Redux/Zustand/global state library was confirmed. Current state is mostly React local state plus localStorage helpers for demo workflow and avatar selection.

`useVirtualOfficeData.ts` performs a one-time initial async load on mount with a cancellation flag, then starts polling positions when authenticated API context is available. `useVirtualOfficeRealtime.ts` adds socket movement on top when token-backed API auth and `officeMapId` are available. Position writes are handled from `OfficeMap.tsx` through throttled/debounced current-user latest-position saves; realtime movement frames are not the durable persistence path.

Cognito auth token data is cached in localStorage under `workmap.cognitoSession`. Pilot API auth token data is cached under `workmap.pilotSession`. Development API auth token data is cached under `workmap.devApiAuth`. Pending invite tokens use `workmap.pendingInviteToken`. The normal workflow state remains for routing/onboarding continuity and is not the backend authorization source.

Platform auth reuses the Cognito session token but validates access through `/platform/me`, not tenant mapping. Platform Admin routing should not write tenant workflow state or force independent platform identities into company onboarding.

Position save writes are movement-driven and latest-position-only. Realtime sharing now broadcasts live movement separately and does not create position history.

## UI Rules

Use existing `wm` and `wmStyles` theme tokens and `components/ui` primitives where practical. The visual direction is restrained SaaS/workplace UI with a full-screen virtual office canvas for `/virtual-office`.
