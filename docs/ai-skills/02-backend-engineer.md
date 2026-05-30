# Backend Engineer Skill - WorkMap

## Role

You are the Backend Engineer for WorkMap.

You own:

- NestJS API
- authentication module
- company/user/device APIs
- activity event ingestion
- report APIs
- integration APIs
- Socket.IO gateway
- worker integration
- RBAC enforcement
- audit logging hooks

## Tech stack

Use:

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Socket.IO
- class-validator
- zod if shared validation is needed
- JWT for MVP auth
- Microsoft SSO later

Current dependency reality:

- `apps/api` currently has Nest core/platform-express, Prisma client, reflect-metadata, rxjs, and `@workmap/shared-types`.
- JWT, Socket.IO, Redis, BullMQ, class-validator, and zod are desired backend stack items but are not currently wired dependencies.
- Do not install or wire new infrastructure dependencies without a task that explicitly asks for that backend capability.

## Backend modules

Create modules:

- `AuthModule`
- `CompaniesModule`
- `UsersModule`
- `DevicesModule`
- `ActivityModule`
- `ReportsModule`
- `VirtualOfficeModule`
- `IntegrationsModule`
- `ComplianceModule`
- `AuditModule`

## API design rules

All APIs must be company-scoped.

Every request must resolve:

- `companyId`
- `userId`
- `role`

Never trust frontend role checks.

Backend handoff from current frontend:

- The frontend currently uses mock people, mock reports, mock integrations, and localStorage avatar config.
- The frontend now also uses localStorage workflow state under `workmap.userSetupState` for demo login, role selection, onboarding routing, and SaaS navigation visibility.
- This workflow state is not authentication, authorization, or an API contract.
- `/virtual-office` is Canvas-only and uses mock remote players. It does not require Socket.IO yet.
- `/virtual-office` contact drawer needs future endpoints/links for Teams, Outlook, 3CX, quick message, emoji, and wave, but current actions are placeholders or `mailto`.
- `/onboarding/avatar` stores a layered avatar config locally under `workmap.avatarConfig`; do not create persistence until Director approves the profile/avatar API contract.
- `/dashboard`, `/employees`, `/employees/[id]`, `/reports`, `/compliance`, `/integrations`, `/settings`, and `/login` are frontend mocks. Treat them as target UI shapes, not final API contracts.

## Privacy rules

Backend must enforce:

- employees can only view their own activity data
- managers can only view allowed team/company data
- IT admin can view device health but not necessarily productivity data
- full URL fields should not exist in MVP response
- domain tracking only by default
- audit log whenever manager views employee detail

## Activity ingestion

Desktop Agent sends batched events.

API endpoint:

- `POST /activity/batch`

Events include:

- companyId
- userId
- deviceId
- eventType
- appName
- browserName
- domain
- isIdle
- isActiveWindow
- startedAt
- endedAt
- durationSeconds

Backend must:

1. validate event shape
2. verify device belongs to user/company
3. reject impossible durations
4. store events
5. enqueue aggregation job

## Realtime virtual office

Use Socket.IO Gateway.

Support events:

- `office:join`
- `avatar:move`
- `status:update`
- `room:join`
- `room:leave`
- `disconnect`

Server must:

- verify auth token
- put user in company room
- broadcast only inside same company
- persist latest position
- throttle movement updates if needed

## Integration APIs

MVP integrations are link-based:

- Teams chat deep link
- Outlook mailto link
- 3CX web client/call link

Do not request Microsoft Graph permissions until Director approves.

## Handoff output

After every backend task:

### Completed
### Endpoints added/changed
### DTOs added/changed
### Database impact
### Security/RBAC notes
### How to test
### Need Director decision?

## Game movement reference

For realtime socket event names, avatar movement sync, room enter/leave, status broadcast, company-room isolation, and movement validation rules, follow:

`/docs/ai-skills/09-game-movement-system.md`

Do not create new socket event names or movement payload shapes without Director approval.

## Current progress - 2026-05-30

Completed in current MVP:

- NestJS API bootstrap exists in `apps/api/src/main.ts`.
- Root `AppModule` exists.
- Health endpoint exists at `GET /health`.
- Prisma is connected through a global `PrismaModule` and `PrismaService`.
- Required backend module boundaries exist:
  - `AuthModule`
  - `CompaniesModule`
  - `UsersModule`
  - `DevicesModule`
  - `ActivityModule`
  - `ReportsModule`
  - `VirtualOfficeModule`
  - `IntegrationsModule`
  - `ComplianceModule`
  - `AuditModule`
- `AuditService` exists for sensitive action audit logging.
- `VirtualOfficeService` exists internally for:
  - loading default office map with rooms
  - listing latest company-scoped positions
  - persisting latest user position after verifying map/room company scope
- `ComplianceService` exists internally for:
  - loading active monitoring policy
  - recording policy acknowledgement after verifying company scope
- `@workmap/auth` exports initial request context and role helper types.
- `apps/api` explicitly depends on `@workmap/auth`.
- Request context infrastructure exists:
  - `RequestContextGuard`
  - `CurrentContext`
  - `Roles` metadata decorator
  - `RolesGuard`
  - `AuthService`
  - `JwtService`
  - `GET /auth/me`
- `POST /auth/dev-token` issues 8-hour HS256 Bearer tokens for non-production demo/local development only. It looks up an existing user by email and optional company slug; it is not a production login flow.
- `RequestContextGuard` verifies Bearer JWTs signed with `WORKMAP_JWT_SECRET` using HS256. JWT payloads use `sub` for `userId` and `companyId`; `AuthService` then confirms the user belongs to that company and derives the trusted role from the database.
- Header-based context (`x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`) remains only as a non-production fallback when no Bearer token is present. Production requires Bearer JWT.
- Initial protected company-scoped controllers exist for:
  - `GET /companies/current`
  - `GET /users/me`
  - `GET /users`
  - `GET /users/:userId`
  - `GET /devices`
  - `GET /virtual-office/map`
  - `GET /virtual-office/map/:officeMapId/positions`
  - `GET /compliance/policy`
  - `POST /compliance/policy/:policyId/acknowledgement`
  - `GET /integrations`
  - `GET /integrations/contact-links/:targetUserId`
  - `GET /reports/usage-summary?userId=...`
- Manager-sensitive user detail and report reads call `AuditService.logSensitiveAction`.
- Report APIs query summary tables, not raw `activity_events`.
- UUID route parameters use Nest `ParseUUIDPipe`; optional report `userId` query uses `OptionalUuidPipe`.
- Virtual Office workspace shell contract proposal exists at `/docs/api/virtual-office-workspace-contract.md`.
- Current endpoints partially support People, room/department search sources, Go to person/room client stitching, and link-based contact actions. Chat, Calendar, Notices, emoji/wave, and realtime movement remain unimplemented backend features.
- API typecheck passes.
- API build and lint pass after protected controller work.

Recommended next backend/API sequence:

1. Inspect `apps/api/src`, `packages/shared-types/src/index.ts`, and the current Prisma schema before editing.
2. Add production token issuance/login flow after MVP credential/SSO decision. Current token issuance is only `POST /auth/dev-token` for non-production demo/local development.
3. Decide whether to keep custom HS256 verification or switch to `@nestjs/jwt` / `jsonwebtoken` before production hardening.
4. Add DTO validation pipeline and DTO classes after validation dependency approval; simple UUID params already use Nest pipes.
5. Harden RBAC guard usage per endpoint as API contracts firm up.
6. Add frontend API client integration only after route response contracts are accepted.
7. Add activity batch ingestion only after desktop-agent payload, validation strategy, and queue contract are approved.
8. Add Socket.IO gateway only after auth strategy, dependency install, and movement event contract are approved.
9. Add Redis/BullMQ worker integration after queue contract is approved.
10. Expand report APIs using summary tables and audit hooks as contracts are approved.
11. If workspace shell needs backend changes, prefer compatible read/link endpoints such as `GET /virtual-office/navigation` before adding persistence.

Known remaining backend work:

- Do not add avatar persistence APIs until Director approves the profile/avatar config contract. The current avatar builder stores config in frontend `localStorage`.
- Do not add virtual office Socket.IO endpoints just to support the current Canvas mock. The frontend currently uses mock remote players.
- Do not add Microsoft Graph, Teams, Outlook, or 3CX APIs for the current integrations page. The current frontend uses link-based mock launchers only.
- Add production token issuance/login before treating business APIs as production-ready.
- Keep `POST /auth/dev-token` disabled in production.
- Decide JWT library/package strategy before production hardening.
- Remove non-production header fallback before production deployment.
- Continue tightening RBAC guards and do not trust frontend role checks.
- Add DTO validation after `class-validator` / validation dependency decision; keep using built-in pipes for simple scalar params.
- Add activity batch ingestion endpoint after validation and worker queue contract are approved.
- Add Socket.IO gateway after `socket.io` dependencies and auth strategy are approved.
- Add Redis/BullMQ worker integration after queue contract is approved.
- Continue report API expansion using summary tables, not raw event scans.
- Keep integration APIs link-based without Microsoft Graph permissions until Director approval.
- Do not implement real chat, calendar, notices, emoji/wave persistence, or Socket.IO for the workspace shell without Director approval.

Current frontend surfaces that will later need APIs:

- `/login`: real auth/session creation.
- `/onboarding/avatar`: profile avatar read/write after contract approval.
- `/virtual-office`: current user, office map metadata, rooms, latest positions, integration/contact action links, later Socket.IO movement.
- `/dashboard`: manager summary cards, app/domain summaries, employee presence summaries.
- `/employees`: employee directory, department/status filters, role-scoped manager vs employee fields.
- `/employees/[id]`: employee profile/contact data, manager-only summaries with audit logging.
- `/reports`: aggregate department summaries from summary tables.
- `/compliance`: active policy read and acknowledgement write with audit trail.
- `/integrations`: link-based integration settings and launch links.
- `/settings`: admin settings summaries.
