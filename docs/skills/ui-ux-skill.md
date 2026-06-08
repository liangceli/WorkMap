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
- Backend-off compliance fallback should remain transparent and should not pretend acknowledgement was recorded.

Dashboard/reports pilot UX:

- Dashboard readiness cards should clearly separate API health, auth/session, remote presence, compliance, and reports status.
- Reports surfaces should label API-backed rows separately from pilot example/sample rows.
- Empty current-user usage summaries should read as sparse pilot data, not as product failure.
- Do not imply full monitoring, screenshots, keystrokes, camera/mic, private message capture, export history, or full URL tracking unless those features are actually implemented and accepted.

Role/profile UX:

- Employee roles should not see obvious admin/report/settings/dashboard/integration shortcuts in AppShell or the virtual-office command palette.
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
