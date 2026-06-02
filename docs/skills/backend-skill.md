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

## Request Context

Most business endpoints use `RequestContextGuard`.

`AuthModule` is marked `@Global()` and exports `AuthService`, `JwtService`, `RequestContextGuard`, and `RolesGuard` so guards/providers resolve across feature modules at runtime.

Context can come from:

- Bearer JWT verified by `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

In production, Bearer token is required.

## Error Handling / Validation

- UUID route params use `ParseUUIDPipe`.
- Optional UUID query params use `OptionalUuidPipe`.
- Auth service validates dev token email and company slug inputs.
- Virtual office service checks office map and room ownership before persisting positions.

## Not Confirmed

- No websocket gateway was found.
- No production OAuth/password login implementation was confirmed.
- No background activity ingestion controller route was confirmed during intake, despite activity-related schema/module presence.
