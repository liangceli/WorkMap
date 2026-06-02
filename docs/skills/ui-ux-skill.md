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

## UX Boundaries

- Many workflow surfaces are demo-oriented and use mock/localStorage state.
- Compliance/privacy messaging is a product requirement and should not be removed casually.
- Keep operational product surfaces dense and scannable; avoid turning dashboard/admin pages into marketing layouts.
