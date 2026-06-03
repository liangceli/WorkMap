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
- `lib/workflow/workflowState.ts`: frontend-only demo onboarding/login state.
- `lib/theme/workmapTheme.ts`: central theme tokens.

## Routes Confirmed

- `/`: home/onboarding router surface.
- `/login`: mock login panel.
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

For `/virtual-office`, `components/office/useVirtualOfficeData.ts` now attempts virtual-office API loading and falls back to mock data. It first asks `lib/api/developmentApiAuth.ts` for browser-only development auth options, then passes any token to the map/navigation/positions calls. It validates unknown `zoneData`, `anchor`, `bounds`, player coordinates, statuses, and directions before using API data.

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

Development API auth token data is cached in localStorage under `workmap.devApiAuth`. The normal login/onboarding workflow remains demo-only and is not production auth.

Position save writes are movement-driven and latest-position-only. They are not realtime sharing and do not create position history.

## UI Rules

Use existing `wm` and `wmStyles` theme tokens and `components/ui` primitives where practical. The visual direction is restrained SaaS/workplace UI with a full-screen virtual office canvas for `/virtual-office`.
