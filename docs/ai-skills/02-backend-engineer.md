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

## Current progress - 2026-05-29

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
- API typecheck passes.

Known remaining backend work:

- Add real Auth/JWT module before exposing business APIs.
- Add request context resolution for every API request: `companyId`, `userId`, `role`.
- Add RBAC guards and do not trust frontend role checks.
- Add DTO validation after `class-validator` / validation dependency decision.
- Add controller endpoints for virtual office only after auth/context guard exists.
- Add activity batch ingestion endpoint after validation and worker queue contract are approved.
- Add Socket.IO gateway after `socket.io` dependencies and auth strategy are approved.
- Add Redis/BullMQ worker integration after queue contract is approved.
- Add report APIs using summary tables, not raw event scans.
- Add integration link APIs without Microsoft Graph permissions until Director approval.
