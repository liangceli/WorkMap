# Data Model Skill

Source of truth: `workmap/prisma/schema.prisma`.

## Core Models

- `Company`: tenant root; owns departments, users, devices, events, summaries, office maps, rooms, positions, policies, integrations, and audit logs.
- `Department`: company-scoped department with unique name per company.
- `User`: company user with role, status, avatar, job title, optional department, device/activity/report/position relations.
- `Device`: employee device with OS, hostname, agent version, last seen.
- `ActivityEvent`: raw app/browser/idle/lock/unlock/heartbeat events.
- `AppUsageSummary`, `WebsiteUsageSummary`: daily summarized usage records.
- `OfficeMap`: company map metadata, dimensions, tile size, JSON map data, default flag.
- `OfficeRoom`: room/zone metadata, `zoneData`, optional `autoStatus`.
- `VirtualOfficePosition`: latest position per user, map/room, coordinates, direction, moving flag, status.
- `MonitoringPolicy`, `PolicyAcknowledgement`: compliance policy and user acknowledgement.
- `IntegrationAccount`: company or user integration accounts.
- `AuditLog`: company-scoped audit events.

## Enums

Confirmed enums include user roles/statuses, device OS, activity event type, browser name, productivity label, integration provider, avatar direction, and office room type.

## Seed Data

`prisma/seed.ts` creates demo company data, users, departments, office map/rooms, virtual positions, compliance policy, acknowledgements, device rows, app/website summaries, integrations, and audit log.

## Data Model Gaps

- Office map database `mapData` exists, but current frontend canvas loads `/maps/workmap2.tmx` directly.
- Virtual office positions now support current-user latest-position restore/save through API-backed local development flows.
- Live realtime sync, historical trails, and arbitrary-user position mutation are not implemented.
