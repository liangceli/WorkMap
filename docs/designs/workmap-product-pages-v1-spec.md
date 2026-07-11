# WorkMap Product Pages Visual Direction V1

## Scope

This design-only round applies the approved homepage identity to every remaining frontend route without changing runtime code.

Core palette:

- Ink Navy: `#080D22`
- Signal Jade: `#27E0A2`
- Civic Amber: `#F7B731`
- Reading surface: `#F6F7F2`
- Privacy exclusion: `#FF645E`

## Visual Files

| Route | Visual |
| --- | --- |
| `/login` | `workmap-product-pages-v1/login.png` |
| `/login/callback` | `workmap-product-pages-v1/callback.png` |
| `/onboarding/company` | `workmap-product-pages-v1/company.png` |
| `/onboarding/invite` | `workmap-product-pages-v1/invite-owner.png` |
| `/invite/[token]` | `workmap-product-pages-v1/invite-token.png` |
| `/onboarding/avatar` | `workmap-product-pages-v1/avatar.png` |
| `/onboarding/device-setup` | `workmap-product-pages-v1/device.png` |
| `/dashboard` | `workmap-product-pages-v1/dashboard.png` |
| `/employees` | `workmap-product-pages-v1/employees.png` |
| `/employees/[id]` | `workmap-product-pages-v1/employee-detail.png` |
| `/reports` | `workmap-product-pages-v1/reports.png` |
| `/compliance` | `workmap-product-pages-v1/compliance.png` |
| `/integrations` | `workmap-product-pages-v1/integrations.png` |
| `/settings` | `workmap-product-pages-v1/settings.png` |
| `/virtual-office` | `workmap-product-pages-v1/office.png` |
| `/platform-admin` | `workmap-product-pages-v1/platform.png` |
| `/avatar-debug` | `workmap-product-pages-v1/debug.png` |

Overview boards:

- `overview-auth-onboarding.png`
- `overview-workspace.png`
- `overview-special.png`

## Product Truth

- Dashboard, Employees, and Reports use only the repository's existing development fallback data and label it explicitly.
- Employee detail shows the real unavailable state instead of inventing a backend employee profile.
- Platform Admin shows privacy-safe empty states rather than fictional tenant metadata.
- Virtual Office uses the exact real project panorama.
- Login and Avatar use real repository-derived layered avatar composites.
- Integrations remain link launchers; 3CX remains unavailable/Coming later.

## Shared System

- Authentication and invitation routes use a split editorial composition with an Ink brand field and a focused form surface.
- Authenticated operational routes use a compact Ink sidebar, paper workspace, restrained borders, and dense tables or list rows.
- Virtual Office remains full-bleed and map-first.
- Platform Admin keeps a separate platform context and does not reuse tenant-owner presentation.
- Buttons use `4px` radius, panels use `6px`, and repeated content avoids oversized floating cards.

## Motion And Responsive Intent

- Page entry: header and primary content rise `12px` over `320ms`; no looping motion.
- Sidebar navigation: background and border transition over `160ms`.
- Table rows: subtle surface change only; layout does not shift.
- Mobile: sidebar becomes a top sheet, page actions wrap below titles, filters stack, tables use intentional horizontal scrolling, and two-column privacy/setup layouts stack.
- Virtual Office preserves map priority and hides secondary chrome before reducing map readability.
- All motion must honor `prefers-reduced-motion`.

## Implementation Boundary

Future implementation may change frontend layout and visual markup only. It must preserve routes, component contracts, auth, RBAC, tenant boundaries, data-fetching, reporting calculations, compliance behavior, realtime behavior, tracking behavior, and API structures.
