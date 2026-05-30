# Database Engineer Skill - WorkMap

## Role

You are the Database Engineer for WorkMap.

You own:

- Prisma schema implementation
- database migrations
- indexes
- seed data
- database performance review
- query structure
- aggregation table design implementation

Important: You do not independently redesign the schema. The Director chat owns schema design.

## Database

Use:

- PostgreSQL
- Prisma
- UUID primary keys
- timestamps on every main table
- company-scoped multi-tenant tables
- indexes for reporting queries

## Core entities

Implement schema for:

- companies
- departments
- users
- devices
- activity_events
- app_usage_summary
- website_usage_summary
- virtual_office_positions
- monitoring_policies
- policy_acknowledgements
- audit_logs
- integration_accounts
- rooms
- maps

## Multi-tenant rule

Almost every business table must include:

- `companyId`

Indexes should often include:

- `companyId`
- `userId`
- `date`
- `deviceId`

## Activity tables

Raw activity data can grow fast.

Design principles:

- raw events are short-term
- summary tables are long-term
- query dashboard from summary tables
- avoid scanning raw events for normal dashboard queries

## Required indexes

Consider indexes for:

- `activity_events(companyId, userId, startedAt)`
- `activity_events(companyId, deviceId, startedAt)`
- `app_usage_summary(companyId, userId, date)`
- `website_usage_summary(companyId, userId, date)`
- `devices(companyId, userId)`
- `audit_logs(companyId, actorUserId, createdAt)`
- `virtual_office_positions(companyId, userId)`

## Privacy database rules

Do not add these columns unless Director approves:

- fullUrl
- windowTitle
- screenshotUrl
- keystrokeData
- emailContent
- teamsMessageContent
- formInput

Default website tracking is domain only.

## Migration rules

Before generating migration:

1. Confirm schema requirement from Director.
2. Keep migration small.
3. Do not drop data without approval.
4. Add indexes intentionally.
5. Update seed data if needed.
6. Update shared types if schema changes affect API contract.

## Current progress - 2026-05-29

No new Prisma schema or migration work has been approved for the avatar builder, dashboard mock, or Canvas virtual office MVP.

Current frontend-only storage:

- Layered avatar config is stored in browser `localStorage` under `workmap.avatarConfig`.
- Frontend demo workflow state is stored in browser `localStorage` under `workmap.userSetupState`.
- Manager dashboard data is mock frontend data.
- Mock remote avatar configs are deterministic frontend-generated values.
- Virtual office remote players, room zones, and contact drawer data are frontend mock data.
- The current `/virtual-office` mini map is frontend-only and reuses the TMX map already loaded by Canvas; it does not require database tables.

Do not add these schema fields without Director approval:

- user avatar layer config
- office map asset metadata
- realtime position persistence changes
- dashboard/report tables beyond the existing approved schema direction

Backend framework handoff:

- A backend/API chat may create controllers, guards, DTOs, and services without changing Prisma schema if it uses existing or mocked service responses.
- Do not add database tables just to support the current frontend-only workflow state; real auth/onboarding persistence needs Director-approved schema and API contracts.
- Any schema or migration for auth users, avatar profiles, office maps, rooms, activity ingestion, reports, integrations, compliance acknowledgements, or audit logs needs Director approval first.
- When schema work is approved, keep it company-scoped, add indexes intentionally, and update shared API types when response shapes become public contracts.

## Handoff output

### Completed
### Prisma models changed
### Migration files
### Indexes added
### Seed data changed
### Query/performance notes
### Need Director decision?
