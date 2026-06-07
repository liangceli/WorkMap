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
- `TenantOnboardingModule`
- `InvitationsModule`
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

- Cognito Bearer JWT verified by `CognitoJwtService`.
- WorkMap Bearer JWT verified by `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

In production, Bearer token is required.

Auth priority:

1. Cognito Bearer JWT.
2. WorkMap/pilot/dev Bearer JWT.
3. Development headers outside production only.

## Cognito Backend Baseline

Commit `c2c7d76` added STAGE 2 Cognito request-context support. Commit `e5d4882` extended it into tenant onboarding and invite acceptance.

- `CognitoJwtService` verifies Cognito JWTs with JWKS, RS256, issuer, audience/client id, expiry, and `nbf`.
- JWKS are cached for about one hour per issuer.
- Cognito config is read from `WORKMAP_COGNITO_ISSUER` or derived from `WORKMAP_COGNITO_REGION` and `WORKMAP_COGNITO_USER_POOL_ID`, plus `WORKMAP_COGNITO_APP_CLIENT_ID`.
- `AuthService.resolveCognitoContext()` now prefers `User.cognitoSub`.
- Legacy email mapping remains as a one-time compatibility bridge when exactly one verified email match exists; it can bind `cognitoSub` to that user.
- Ambiguous same-email cross-company matches and cross-company Cognito sub conflicts are rejected.
- `CognitoOnlyGuard` allows verified Cognito users without existing WorkMap mapping to call only onboarding/invite acceptance endpoints.
- `getVerifiedCognitoIdentity()` centralizes verified email, Cognito subject, and display-name extraction.

## Tenant Onboarding / Invitations

Commit `e5d4882` added the minimal safe bridge for tenant onboarding and invites.

Tenant onboarding:

- Routes: `GET /tenant-onboarding/status`, `POST /tenant-onboarding/workspace`.
- Guard: `CognitoOnlyGuard`.
- `GET /tenant-onboarding/status` returns `needs_workspace` for an unmapped verified Cognito user or `workspace_ready` for an existing mapped user.
- `POST /tenant-onboarding/workspace` creates a real `Company`, General department, OWNER user with `cognitoSub`, default office map/rooms, owner virtual-office position, and default monitoring policy.
- New owner default spawn is `x=160`, `y=545`, aligned with the frontend local player spawn and verified as non-blocked.

Invitations:

- Routes: `GET /invitations`, `POST /invitations`, `POST /invitations/accept`.
- `GET` and `POST /invitations` use `RequestContextGuard + RolesGuard` and require `OWNER`.
- `POST /invitations/accept` uses `CognitoOnlyGuard` so an unmapped Cognito employee can accept an invite.
- Invitable roles are `EMPLOYEE`, `TEAM_LEAD`, `MANAGER`, `HR_ADMIN`, and `IT_ADMIN`; `OWNER` is not invitable through this flow.
- Invite tokens are generated with `randomBytes(32).toString("base64url")`.
- Only SHA-256 `tokenHash` is stored in the database; the plain token/link is returned once on creation.
- Invite TTL is 7 days.
- Acceptance validates token length, token hash lookup, pending status, expiration, verified email match, same-company constraints, and Cognito sub/email conflicts.
- Accepted employees receive onboarding advisory `nextRoute: "/compliance"` so they do not bypass compliance/avatar/device onboarding.

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
- No complete production account lifecycle, global identity/membership table, multi-company membership, MFA, password reset, or real email delivery implementation was confirmed.
- No background activity ingestion controller route was confirmed during intake, despite activity-related schema/module presence.
