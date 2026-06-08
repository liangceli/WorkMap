# Data Model Skill

Source of truth: `workmap/prisma/schema.prisma`.

## Core Models

- `Company`: tenant root; owns departments, users, invitations, devices, events, summaries, office maps, rooms, positions, policies, integrations, and audit logs.
- `Department`: company-scoped department with unique name per company.
- `User`: company user with role, status, avatar, job title, optional department, optional unique `cognitoSub`, optional backend avatar/profile reference in `avatarId`, device/activity/report/position relations.
- `Invitation`: company-scoped invite with invited email, role, SHA-256 token hash, status, inviter, expiration, and acceptance timestamp.
- `Device`: employee device with OS, hostname, agent version, last seen.
- `ActivityEvent`: raw app/browser/idle/lock/unlock/heartbeat events.
- `AppUsageSummary`, `WebsiteUsageSummary`: daily summarized usage records.
- `OfficeMap`: company map metadata, dimensions, tile size, JSON map data, default flag.
- `OfficeRoom`: room/zone metadata, `zoneData`, optional `autoStatus`.
- `VirtualOfficePosition`: latest position per user, map/room, coordinates, direction, moving flag, status.
- `MonitoringPolicy`, `PolicyAcknowledgement`: compliance policy and user acknowledgement.
- `IntegrationAccount`: company or user integration accounts.
- `AuditLog`: company-scoped audit events.
- `PlatformAuditLog`: independent platform-admin audit events that are not owned by a tenant `User`.

## Enums

Confirmed enums include user roles/statuses, invitation status, device OS, activity event type, browser name, productivity label, integration provider, avatar direction, and office room type.

Invitation statuses:

- `PENDING`
- `ACCEPTED`
- `EXPIRED`
- `REVOKED`

## Seed Data

`prisma/seed.ts` creates demo company data, users, departments, office map/rooms, virtual positions, compliance policy, acknowledgements, device rows, app/website summaries, integrations, and audit log.

## Data Model Gaps

- Office map database `mapData` exists, but current frontend canvas loads `/maps/workmap2.tmx` directly.
- Virtual office positions now support current-user latest-position restore/save through API-backed local development flows.
- `User.cognitoSub` is the current minimal Cognito identity bridge. A future global account/identity model plus `CompanyMembership` or `TenantMembership` is still recommended for multi-company membership.
- `User.avatarId` currently stores compact WorkMap layered avatar references such as `layered:v2:<encoded config>` for authenticated profile completion. A future profile/avatar table can replace this if richer profile data is needed.
- Invitation plaintext tokens are intentionally not stored; only `tokenHash` exists after creation.
- `PlatformAuditLog` intentionally has no foreign key to `Company`; tenant-targeted platform audit rows store optional `targetCompanyId` so historical rows can survive tenant deletion.
- Platform admin identity is not yet persisted as a first-class model; Round 5 uses backend env allowlists for bootstrap.
- Live realtime sync is implemented for movement, but historical trails and arbitrary-user position mutation are not implemented.
