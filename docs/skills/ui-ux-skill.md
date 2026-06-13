# UI/UX Skill

## Visual Direction

WorkMap uses a restrained workplace SaaS visual style with a full-screen pixel-art virtual office experience.

Central theme file:

- `workmap/apps/web/lib/theme/workmapTheme.ts`

UI primitives:

- `WorkMapButton`
- `WorkMapCard`
- `WorkMapBadge`
- `WorkMapEmptyState`
- `WorkMapPageHeader`
- `WorkMapPrivacyNotice`
- `WorkMapStatusDot`

## STAGE 3 Product Experience Direction

Commit `333b789` established the first frontend product polish baseline after alpha deployment smoke. Commit `60fc0ca` extended this into role-based journey hardening.

- Use calm SaaS/workspace language rather than QA/readiness language on primary product surfaces.
- Keep API-backed, sparse-data, fallback, and example states explicit so polish does not hide missing data.
- AppShell should show clear workspace or platform context, grouped navigation, active-route state, role/session source, and readable wrapping at narrower widths.
- Login should position Cognito as deployed alpha sign-in, pilot backend auth as fallback, and frontend-only demo state as clearly non-production.
- Dashboard should read as a workspace overview for presence, coverage, compliance, and summaries while still exposing live/fallback health.
- Reports should describe role-aware own/company summaries and aggregate-only company views without implying raw employee monitoring.
- Compliance should preserve explicit collected/not-collected data boundaries while staying responsive.
- Employees should prioritize scan-friendly filters/table behavior and tolerate narrower desktop/tablet widths.
- Platform Admin should remain a quiet, independent, platform-only operational surface with privacy-safe tenant metadata only.
- Virtual Office chrome should frame the map as live team presence without obscuring or changing map movement, People, contact, chair, realtime, or polling behavior.
- Owner journeys should explain concrete next steps: create workspace, finish avatar/profile, review compliance, invite employees, open the office, and review reports.
- Employee journeys should explain invite acceptance, compliance/avatar/device setup, virtual-office entry, own-report scope, and why company-wide summaries are not available.
- Permission-denied or unavailable states should be written in plain language before or alongside technical API failures.
- Platform Admin blocked states should explain that tenant OWNER/EMPLOYEE/IT_ADMIN roles do not grant platform access.
- Do not show tenant workspace navigation before a workspace role is resolved; unclear states should guide users back to sign-in or onboarding.

## Virtual Office UX

The virtual office is designed as the primary first-screen experience for `/virtual-office`, not a marketing page. It uses full viewport canvas rendering with overlay chrome: top bar, left rail, side panels, minimap, bottom dock, and command palette.

People/Presence UX added for the 5-person pilot:

- Keep current user visually separate from remote teammates.
- Use `You` labeling for the local player context.
- Show team summary counts for active, idle, and offline states.
- Show readable freshness labels and last-seen detail instead of raw timestamps.
- Show readable room/destination names or `Office area`; never show raw backend UUIDs as user-facing room labels.
- Show explicit empty/search/fallback states so API-empty, mock fallback, and search-empty cases do not look broken.
- Command palette People rows should carry the same presence context as People panel cards.
- Presence UI should not depend on fixed map coordinates or unfinished TMX decorations.

Pilot auth and compliance UX:

- `/login` should show Cognito Hosted UI sign-in when configured, clear missing-config guidance when not configured, and preserve pilot fallback.
- `/login/callback` should make Cognito token exchange and WorkMap mapping status understandable, including mapping-needed failures.
- `/login` should clearly distinguish pilot backend auth from frontend-only demo fallback.
- App shell should make pilot Bearer session state, role, and logout action understandable.
- Missing or unclear session states should point users back to `/login` instead of exposing the full role navigation by default.
- Compliance surfaces should explain what WorkMap shows and what it does not monitor.
- Privacy copy should explicitly exclude screen recording, keystroke logging, hidden camera/mic, private message/email content, passwords/form inputs, and invisible employee spying.
- After Round 7, privacy copy may explicitly include active desktop app name/duration, browser domain/duration, timestamps for summaries, and device heartbeat.
- Browser usage UI should say domain/hostname, not full URL, page content, query string, form input, or private message content.
- Backend-off compliance fallback should remain transparent and should not pretend acknowledgement was recorded.

Dashboard/reports pilot UX:

- Dashboard readiness cards should clearly separate API health, auth/session, remote presence, compliance, and reports status.
- Reports surfaces should label API-backed rows separately from pilot example/sample rows.
- Empty current-user usage summaries should read as sparse pilot data, not as product failure.
- Do not imply full monitoring, screenshots, keystrokes, camera/mic, private message capture, export history, or full URL tracking unless those features are actually implemented and accepted.

Role/profile UX:

- Employee roles should not see obvious admin/report/settings/dashboard/integration shortcuts in AppShell or the virtual-office command palette.
- Employee dashboards and reports should avoid Owner-only CTAs and should explain own-scope reporting.
- Owner invite management should clearly indicate that only workspace Owners can create/manage invitations.
- `/employees` should clearly distinguish API-backed same-tenant users from mock/example fallback data.
- New owner and invited employee setup should ask for a human-readable display name before relying on Cognito/email-derived fallback labels.
- Authenticated users should complete backend-backed avatar/profile setup once; returning users with backend `layered:v2:` avatar references should not be forced to recreate avatars.

Platform Admin UX:

- `/platform-admin` should feel like a quiet operational admin surface, not a tenant owner dashboard or marketing page.
- Platform Admin UI should show only privacy-safe tenant metadata, readiness/health summaries, and platform audit summaries.
- Clearly block tenant-only users from Platform Admin surfaces; tenant OWNER is not platform admin.
- Platform Admin navigation/session UI should appear only after `/platform/me` succeeds.
- Tenant switching controls should keep styling stable across active/inactive states. Use consistent longhand border properties; avoid mixing `border` shorthand with `borderColor`, which previously caused a React/Next style overlay.

## UX Boundaries

- Many workflow surfaces are demo-oriented and use mock/localStorage state.
- Compliance/privacy messaging is a product requirement and should not be removed casually.
- Keep operational product surfaces dense and scannable; avoid turning dashboard/admin pages into marketing layouts.
