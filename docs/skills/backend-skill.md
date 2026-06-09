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
- `PlatformModule`
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
- As of commit `4e09788`, persisted positions are also validated against the resolved active map manifest bounds; out-of-bounds current-user saves return controlled 400.

## Virtual Office Map Manifest

Commit `4e09788` added the safe map expansion architecture without a Prisma schema change.

- Existing `OfficeMap.mapData` JSON is the manifest storage layer.
- New owner workspaces store `WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST` in `OfficeMap.mapData`.
- Legacy or invalid `mapData` falls back to the shared default manifest at runtime.
- The shared default manifest defines schema version, map key/version, display name, TMX path, map dimensions, tile size, canvas size, default spawn, safe fallback spawn, collision layer names, render layer order, room definitions, and navigation destinations.
- `VirtualOfficeService` resolves and validates the manifest before generating navigation or validating positions.
- `/virtual-office/navigation` is generated from manifest destinations rather than hardcoded room rectangles.
- Navigation destinations can include `roomId` when a manifest destination maps to a backend `OfficeRoom`.
- Tenant onboarding now creates the default office map, rooms, and owner spawn from the shared manifest.
- No visual map editor, map-art replacement, map migration, or backend map renderer was added.

## Virtual Office Realtime

Commit `1d2836c` added native WebSocket realtime movement for `/virtual-office`.

- Endpoint: `/virtual-office/realtime`.
- Implementation: `virtual-office-realtime.gateway.ts` attaches to the Node HTTP server `upgrade` event and handles WebSocket frames directly; no `socket.io`, `ws`, or Nest WebSocket package was added.
- Provider registration: `VirtualOfficeRealtimeGateway` is registered by `VirtualOfficeModule`.
- Auth: handshake context is resolved through `RequestContextResolverService`; clients can provide a Bearer token through `Authorization` or query `token`.
- Unauthenticated handshakes are rejected with `401`.
- Origin: production deployments should configure `WORKMAP_ALLOWED_ORIGIN` or `NEXT_PUBLIC_APP_URL` to the deployed frontend origin.
- Join validation: `office:join` requires `canAccessVirtualOffice()`, a UUID-shaped `officeMapId`, and an office map that belongs to the authenticated company.
- Room isolation: room keys are backend-computed as `companyId:officeMapId`; clients cannot choose tenant/company scope.
- Movement validation: `player:move` is accepted only after a validated join, with finite coordinates, supported direction/status, and optional room id belonging to the joined office map.
- As of commit `4e09788`, join context carries resolved manifest bounds and out-of-bounds movement is rejected with `office:error`.
- Broadcast behavior: movement is broadcast only to other sockets in the same company/map room; the sender is excluded.
- Rate limiting: accepted movement snapshots are rate-limited per socket, with a minimum interval around 50ms.
- Persistence boundary: realtime movement frames are not written to Prisma. Durable latest-position save/restore remains `PUT /virtual-office/map/:officeMapId/positions/me` plus positions polling.
- Scaling boundary: the gateway is in-memory per API process. Multi-instance deployment needs shared pub/sub before horizontal scaling.

## Request Context

Most business endpoints use `RequestContextGuard`.

`AuthModule` is marked `@Global()` and exports `AuthService`, `JwtService`, `RequestContextResolverService`, `RequestContextGuard`, and `RolesGuard` so guards/providers resolve across feature modules at runtime.

Context can come from:

- Cognito Bearer JWT verified by `CognitoJwtService`.
- WorkMap Bearer JWT verified by `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

In production, Bearer token is required for HTTP APIs. WebSocket realtime movement also requires a resolved request context during handshake.

Auth priority:

1. Cognito Bearer JWT.
2. WorkMap/pilot/dev Bearer JWT.
3. Development headers outside production only.

## Platform Admin Boundary

Commit `afe65e7` added an independent platform-admin backend boundary.

Platform context is separate from tenant request context:

- Tenant context remains `RequestContext` with `companyId`, `userId`, and `role`.
- Platform context is `PlatformRequestContext` with `platformRole: "PLATFORM_ADMIN"` and Cognito identity fields.
- `CurrentPlatformContext` reads platform context from a dedicated request key.

Platform auth behavior:

- `/platform/*` routes use `PlatformContextGuard`, not `RequestContextGuard`.
- `PlatformContextGuard` verifies Cognito Bearer auth directly through the existing Cognito verifier.
- Platform access is allowed only when verified Cognito email or sub is present in backend env allowlists:
  - `WORKMAP_PLATFORM_ADMIN_EMAILS`
  - `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS`
- Missing/invalid Cognito platform credentials return `401`.
- Valid tenant users who are not configured platform admins return `403`.
- Tenant OWNER, EMPLOYEE, and IT_ADMIN roles do not imply platform access.
- Pilot/dev fallback remains tenant-scoped and does not create Platform Admin access.

Platform module:

- Routes live under `/platform`.
- `GET /platform/me` returns the platform context.
- `GET /platform/tenants` returns privacy-safe tenant metadata.
- `GET /platform/tenants/:companyId` returns tenant detail without employee activity drill-down.
- `GET /platform/tenants/:companyId/health` returns tenant readiness/health summaries.
- `GET /platform/audit` returns platform audit summaries.

Privacy boundary:

- Platform endpoints may return company id/name/slug, timestamps, owner/user/employee counts, device/invite/integration counts, policy/default map configured flags, readiness flags, latest aggregate activity timestamp, and latest aggregate virtual-office position timestamp.
- Platform endpoints must not expose employee app/domain details, browsing URLs/details, message/email content, virtual-office movement history, secrets/tokens, raw cross-tenant employee activity rows, support impersonation, tenant mutation, or billing controls.

Platform audit:

- `PlatformAuditLog` records platform reads without requiring a tenant `User`.
- Logged actions include `PLATFORM_TENANT_LIST_VIEWED`, `PLATFORM_TENANT_DETAIL_VIEWED`, `PLATFORM_TENANT_HEALTH_VIEWED`, and `PLATFORM_AUDIT_VIEWED`.
- Global platform actions have no `targetCompanyId`; tenant-targeted reads include `targetCompanyId`.
- The table intentionally has no foreign key to `Company`, so historical rows can survive tenant deletion.

## RBAC / Tenant Isolation

Commit `815df2c` added the central Round 3 capability model in `packages/auth`.

Core helpers:

- `WorkMapCapability`
- `WORKMAP_ROLE_CAPABILITIES`
- `roleHasCapability(role, capability)`
- `hasCapability(context, capability)`

Capability highlights:

- `manageCompany`: OWNER.
- `inviteEmployees`: OWNER.
- `viewEmployeeDirectory`: all roles.
- `viewEmployeeActivity`: TEAM_LEAD, MANAGER, HR_ADMIN, OWNER; own user is always allowed.
- `viewOwnReports`: all roles.
- `viewTeamReports`: TEAM_LEAD, MANAGER, HR_ADMIN, OWNER.
- `manageCompliancePolicy` / `viewComplianceStatus`: HR_ADMIN, OWNER.
- `manageIntegrations`, `viewDeviceHealth`, `accessTechnicalSettings`: IT_ADMIN, OWNER.
- `accessVirtualOffice`, `useContactLinks`: all roles.

Service-level enforcement added in Round 3:

- Invitations service enforces `canInviteEmployees()` in addition to controller `OWNER` roles guard.
- Reports verify requested `userId` belongs to `context.companyId` before cross-user report queries and enforce own/team report permissions.
- Users directory checks `canViewEmployeeDirectory()` and scopes by `context.companyId`.
- Virtual-office position reads verify `officeMapId` belongs to the requester's company before returning positions.
- Integrations settings require `canManageIntegrations()`; contact links remain same-tenant target scoped.
- Device visibility uses central capability logic: OWNER/IT_ADMIN can see company device health; others see only own devices.

Security boundary:

- Frontend role visibility is advisory UX only.
- Backend services should not trust frontend-provided `companyId`, `tenantId`, `userId`, or `role`.

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

## User Profile / Avatar

Commit `815df2c` added backend-backed display name and layered avatar profile persistence.

- Route: `PATCH /users/me`.
- Guard: `RequestContextGuard`.
- Scope: updates only `context.userId`.
- Accepted fields: `displayName`, `avatarId`.
- `displayName` is normalized whitespace and must be 2-80 characters.
- `avatarId` must be a WorkMap `layered:v2:` reference and at most 2048 characters.
- Missing update fields return `400`.
- Client-provided `userId`, `companyId`, and `role` are not accepted.
- `GET /users` and `GET /users/:userId` now include `avatarId`, `jobTitle`, and department object data where available.

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
- Virtual office service checks office map ownership before reading latest positions.
- Virtual office service validates manifests and map bounds before generating navigation or accepting persisted positions.
- User profile update validates current-user-only display name/avatar updates.

## Not Confirmed

- No shared pub/sub adapter for multi-instance realtime broadcast was confirmed.
- No persisted platform identity/admin lifecycle or platform admin console was confirmed; Round 5 uses backend env allowlists.
- No complete production account lifecycle, global identity/membership table, multi-company membership, MFA, password reset, or real email delivery implementation was confirmed.
- No background activity ingestion controller route was confirmed during intake, despite activity-related schema/module presence.
