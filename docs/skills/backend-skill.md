# Backend Skill

## Structure

Backend app: `workmap/apps/api`.

Runtime: NestJS 11, Prisma Client 6, TypeScript.

Modules confirmed in `AppModule`:

- `PrismaModule`
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
- `HealthController`

Runtime/local startup notes:

- `apps/api/src/main.ts` imports `load-local-env.js` before `AppModule`.
- `load-local-env.ts` loads the nearest `.env` without overwriting existing environment variables.
- It also registers compiled local aliases for `@workmap/auth` and `@workmap/shared-types` so the nested Nest build output can run locally.
- The API `dev` script is `nest build && node dist/apps/api/src/main.js`.

## Virtual Office Persistence

Current-user latest-position persistence was added in commit `1a0a19f`.

- Route: `PUT /virtual-office/map/:officeMapId/positions/me`.
- Guard: `RequestContextGuard`.
- Scope: authenticated `context.companyId` and `context.userId`; body `userId` is not accepted.
- Body parser: `save-position.dto.ts` validates finite `x`/`y`, supported direction/status, boolean `isMoving`, and optional string `roomId`.
- As of commit `b68dd49`, optional `roomId` must be UUID-shaped before persistence. DTO validation returns controlled 400 for invalid values, and service-level guard prevents invalid room ids from reaching Prisma if a future caller bypasses the DTO.
- Service path: existing `VirtualOfficeService.persistLatestPosition`.
- Persistence behavior: upserts one latest `VirtualOfficePosition` row for the authenticated user.
- Validation: existing service checks map/company ownership and optional room/map/company consistency.

## Request Context

Most business endpoints use `RequestContextGuard`.

`AuthModule` is marked `@Global()` and exports `AuthService`, `JwtService`, `RequestContextGuard`, and `RolesGuard` so guards/providers resolve across feature modules at runtime.

Context can come from:

- Bearer JWT verified by `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

In production, Bearer token is required.

## Pilot Auth

Commit `14fb706` added `POST /auth/pilot-login`.

- Input: email, password, optional company slug.
- User lookup is email/company scoped; client user id is not trusted.
- Password verification uses Node `pbkdf2Sync` with SHA-256 and `timingSafeEqual`.
- Password hash format is `pbkdf2-sha256$iterations$salt$hash`.
- Minimum accepted iterations: `100000`.
- Env: `WORKMAP_PILOT_PASSWORD_HASH`.
- Non-production can use the default local pilot hash for seeded password `workmap-pilot`.
- Production pilot login is disabled unless `WORKMAP_PILOT_PASSWORD_HASH` is configured.
- Successful response uses the same 8-hour Bearer JWT response shape as dev-token.

## Error Handling / Validation

- UUID route params use `ParseUUIDPipe`.
- Optional UUID query params use `OptionalUuidPipe`.
- Auth service validates dev token email and company slug inputs.
- Auth service validates pilot login email, password presence, company slug, and pilot hash configuration.
- Virtual office service checks office map and room ownership before persisting positions.

## Not Confirmed

- No websocket gateway was found.
- No production OAuth/password login implementation was confirmed.
- No background activity ingestion controller route was confirmed during intake, despite activity-related schema/module presence.
