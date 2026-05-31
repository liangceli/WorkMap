# Current Backend Endpoint Map

Status: current implementation summary  
Date: 2026-05-31  
Scope: `apps/api`

This map documents the current NestJS API surface for frontend integration. It is not a full public API contract and does not approve new persistence, schema changes, Microsoft Graph, Socket.IO, Redis/BullMQ, chat/calendar/notices storage, or private monitoring fields.

## Auth And Request Context

Protected endpoints use `RequestContextGuard`.

- Preferred auth: `Authorization: Bearer <jwt>`.
- JWT: HS256 signed with `WORKMAP_JWT_SECRET`.
- Claims used: `sub` as user id and `companyId`.
- Trusted role: loaded from the database by `AuthService`, not trusted from the frontend.
- Non-production fallback: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`; fallback now verifies the user/company/role against the database and is disabled in production.

## Endpoint Table

| Endpoint | Method | Controller / Service | Auth required? | Roles allowed? | Company-scoped? | Audit logged? | Response purpose | Frontend surface supported | Privacy notes | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/health` | GET | `HealthController` | No | Public | No tenant data | No | Service liveness | Devops/local check | No sensitive data | No readiness/dependency health yet |
| `/auth/dev-token` | POST | `AuthController` / `AuthService` | No, non-production only | Existing seed/demo user email | Yes, via user lookup and optional company slug | No | Issue 8-hour local/demo Bearer token | Local API/frontend integration | Not production auth; disabled in production | No password, SSO, refresh, revocation, or rate limiting |
| `/auth/me` | GET | `AuthController` | Yes | Any authenticated role | Yes, from request context | No | Return `companyId`, `userId`, `role` | Frontend API bootstrap | Role is database-derived for JWT | Minimal context only |
| `/companies/current` | GET | `CompaniesController` / `CompaniesService` | Yes | Any authenticated role | Yes | No | Current company and departments | Filters, shell context, onboarding display | No monitoring data | No settings/preferences yet |
| `/users/me` | GET | `UsersController` / `UsersService` | Yes | Any authenticated role | Yes | No for self | Current user profile, self summaries may be included | Profile/self view | Self data only; no full URLs | Uses current `getUserProfile` shape, not office-specific DTO |
| `/users` | GET | `UsersController` / `UsersService` | Yes | Any authenticated role | Yes | No | Company user directory | People panel, employee directory | Safe contact fields only; no app/domain summaries | No local time, current room, contact availability |
| `/users/:userId` | GET | `UsersController` / `UsersService` | Yes | Any authenticated role; sensitive summaries only self or manager-capable roles | Yes | Yes when actor views another user with sensitive summary access | Contact profile or manager/self summary | Employee detail/profile card | Normal employees get contact-only data for others; manager reads are audited | Office shell should not show manager summaries in ordinary people cards |
| `/devices` | GET | `DevicesController` / `DevicesService` | Yes | Any authenticated role; company device visibility for IT admin, owner, manager | Yes | No | Device health/status list | Device setup/admin health surfaces | IT/device health does not automatically expose productivity summaries | No device management actions yet |
| `/virtual-office/map` | GET | `VirtualOfficeController` / `VirtualOfficeService` | Yes | Any authenticated role | Yes | No | Default map metadata and rooms | Rooms panel, room context source, map setup | No monitoring metrics | Rooms are raw map rooms; no normalized navigation DTO |
| `/virtual-office/navigation` | GET | `VirtualOfficeController` / `VirtualOfficeService` | Yes | Any authenticated role | Yes | No | Computed office destinations from existing rooms/positions | Search, Go to room, RoomContextCard | Only room bounds/anchors/status/peopleCount; no activity metrics | Derived from `zoneData`; missing bounds fall back to map center anchor |
| `/virtual-office/map/:officeMapId/positions` | GET | `VirtualOfficeController` / `VirtualOfficeService` | Yes | Any authenticated role | Yes | No | Latest avatar positions for a map | Go to person, initial presence display | Player state contains no app/domain/idle details | No realtime Socket.IO; no movement validation endpoint |
| `/compliance/policy` | GET | `ComplianceController` / `ComplianceService` | Yes | Any authenticated role | Yes | No | Active monitoring policy | Compliance page/onboarding notice | Explicit collected/not-collected policy fields | No policy admin API yet |
| `/compliance/policy/:policyId/acknowledgement` | POST | `ComplianceController` / `ComplianceService` | Yes | Any authenticated role | Yes | No audit service call; writes acknowledgement row | Policy acknowledgement | Uses authenticated user; no body content | Route param only; no DTO body |
| `/integrations` | GET | `IntegrationsController` / `IntegrationsService` | Yes | Any authenticated role | Yes | No | Company integration connection state | Integrations/settings page | No OAuth scopes, no content access | Link/status only |
| `/integrations/contact-links/:targetUserId` | GET | `IntegrationsController` / `IntegrationsService` | Yes | Any authenticated role | Yes, validates target user in company | No | Teams/Outlook/3CX link launchers | Contact buttons, coworker drawer | Link-based only; no Graph, no Teams/Outlook body, no call recording | Uses email-based deep links; provider availability is currently always enabled |
| `/reports/usage-summary?userId=...` | GET | `ReportsController` / `ReportsService` | Yes | Self or manager-capable roles via `canViewEmployeeActivity` | Yes | Yes when actor views another user's report | Aggregated app/domain summaries from summary tables | Dashboard/reports, not office shell | Domains only, no full URLs; summary rows only | No date range/filter DTO yet |

## RBAC And Company-Scope Review

- JWT request context verifies user membership in the claimed company.
- Development header fallback is disabled in production and now also verifies user/company/role against the database.
- Protected service queries include `companyId` filters.
- Contact links validate `targetUserId` belongs to the current company.
- Report summaries enforce self/manager-capable access before querying.
- User detail returns contact-only fields for normal employees viewing others.
- Manager-sensitive user detail and report reads call `AuditService.logSensitiveAction`.
- Device visibility is separated from productivity data: IT admin/owner/manager can see devices, but that does not grant report access unless role helpers allow it.
- Report API queries summary tables, not raw `activity_events`.

## Privacy Review

Current endpoints do not return:

- full URLs
- window titles
- screenshots
- keystrokes
- form inputs
- passwords
- Teams message bodies
- Outlook email bodies
- camera or microphone data

Virtual office endpoints must continue to avoid private monitoring data. Normal office shell people cards, room cards, quick interactions, notices, and movement payloads should not include app/domain summaries or idle details.

## Known Gaps

- No production login, password, SSO, refresh token, or session revocation.
- No DTO validation library; current validation is built-in pipes plus manual checks.
- No `POST /activity/batch` implementation.
- No Redis/BullMQ queue.
- No Socket.IO gateway.
- No Microsoft Graph.
- No chat/calendar/notices persistence.
- No avatar persistence.
- No rate limiting.
