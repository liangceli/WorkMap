# API Contract Skill

Base URL:

- Development default for web client: `http://localhost:3001`.
- Production requires `NEXT_PUBLIC_WORKMAP_API_URL` for web-side API calls.

Authentication/context:

- Production: Cognito Bearer JWT or WorkMap Bearer JWT.
- Development: Cognito Bearer JWT, WorkMap Bearer JWT, or `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role` headers.
- Resolution priority: Cognito Bearer, WorkMap Bearer, then development headers outside production.

## Development Auth Bridge

Accepted in commit `2a4a269`: the frontend has a development-only browser helper for local API verification.

`POST /auth/dev-token` request body:

- `email: string`
- optional `companySlug: string`

Expected response type:

- `accessToken`
- `tokenType`
- `expiresAt`
- `user`: includes `id`, `companyId`, `companySlug`, `email`, `displayName`, `role`

Confirmed local request:

```http
POST http://localhost:3001/auth/dev-token
Content-Type: application/json

{"email":"engineer@workmap.demo","companySlug":"workmap-demo-company"}
```

QA confirmed this returns a Bearer token when local API and seed data are available.

Frontend behavior:

- `createDevelopmentToken()` wraps `POST /auth/dev-token`.
- `getDevelopmentApiAuthOptions()` runs only in browser development builds.
- Successful tokens are passed as Bearer auth through existing `ApiClientOptions`.
- Cached token data is stored in `localStorage` under `workmap.devApiAuth` until near expiry.
- Failures return unavailable auth; virtual-office API reads continue without token and keep mock fallback.

Default seeded identity mapping:

- `EMPLOYEE` -> `engineer@workmap.demo`
- `MANAGER` -> `manager@workmap.demo`
- `OWNER` -> `owner@workmap.demo`
- `IT_ADMIN` -> `it.admin@workmap.demo`

Development overrides:

- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL`
- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`

## Confirmed Endpoints

- `GET /health`
- `POST /auth/pilot-login`
- `POST /auth/dev-token`
- `GET /auth/me`
- `GET /platform/me`
- `GET /platform/tenants`
- `GET /platform/tenants/:companyId`
- `GET /platform/tenants/:companyId/health`
- `GET /platform/audit`
- `GET /tenant-onboarding/status`
- `POST /tenant-onboarding/workspace`
- `GET /invitations`
- `POST /invitations`
- `POST /invitations/accept`
- `GET /companies/current`
- `GET /users/me`
- `PATCH /users/me`
- `GET /users`
- `GET /users/:userId`
- `GET /devices`
- `GET /reports/usage-summary`
- `GET /reports/usage-summary?userId=:userId`
- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`
- `PUT /virtual-office/map/:officeMapId/positions/me`
- `WS /virtual-office/realtime`
- `GET /integrations`
- `GET /integrations/contact-links/:targetUserId`
- `GET /compliance/policy`
- `POST /compliance/policy/:policyId/acknowledgement`

## Health Contract

`GET /health` returns API availability for pilot readiness checks.

Expected frontend type:

- `status: "ok" | string`
- `service: string`
- `timestamp: string`

The Dashboard uses this endpoint to distinguish live API readiness from fallback/error copy.

## Reports Contract

`GET /reports/usage-summary` returns the authenticated current user's usage summary.

`GET /reports/usage-summary?userId=:userId` can request a specific user when allowed by backend context.

Frontend type:

- `userId: string`
- `apps[]`: `appName`, `category`, `productivityLabel`, `activeSeconds`, `idleSeconds`
- `websites[]`: `domain`, `category`, `productivityLabel`, `activeSeconds`, `idleSeconds`

Current reporting boundary:

- Dashboard and Reports use this route for API-backed app/domain rows.
- Department/team aggregate rows are not yet backed by a team aggregate endpoint and must remain labeled as pilot examples.
- Sparse or empty pilot seed data should be presented as sparse data, not as a broken API.
- Own reports are visible to all roles with `viewOwnReports`.
- Cross-user reports require `viewEmployeeActivity`; target user must belong to the requester's company.
- Off-tenant report targets return safe not-found behavior.

## Users Contract

`GET /users/me` returns the backend-resolved current user's profile.

`PATCH /users/me` request body:

- optional `displayName: string`, normalized and 2-80 characters
- optional `avatarId: string`, must be a valid WorkMap `layered:v2:` avatar reference

Rules:

- At least one supported field is required.
- The backend updates only `context.userId`.
- Client `userId`, `companyId`, and `role` are not accepted or trusted.

`GET /users`:

- Requires `viewEmployeeDirectory`.
- Returns same-tenant users only.
- Rows can include `id`, `displayName`, `email`, `role`, `status`, `avatarId`, `jobTitle`, and `department`.

`GET /users/:userId`:

- Target must belong to `context.companyId`.
- Users without activity visibility receive contact-only profile shape.
- Sensitive employee detail views are audited when viewing another user.

## Pilot Auth Contract

`POST /auth/pilot-login` request body:

- `email: string`
- `password: string`
- optional `companySlug: string`

Response body:

- `accessToken`
- `tokenType: "Bearer"`
- `expiresAt`
- `user`: `id`, `companyId`, `companySlug`, `email`, `displayName`, `role`

Behavior:

- Backend resolves user by email and optional company slug.
- Client does not choose `userId`.
- Invalid credentials return unauthorized without disclosing whether the user exists.
- Production requires `WORKMAP_PILOT_PASSWORD_HASH`; otherwise pilot login is disabled.

Local pilot defaults:

- Example user: `engineer@workmap.demo`.
- Password: `workmap-pilot`.
- Company slug: `workmap-demo-company`.

## Cognito Auth Contract

STAGE 2 Cognito support uses Cognito Hosted UI on the frontend and Cognito JWT verification on the backend.

Frontend public config:

- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `NEXT_PUBLIC_COGNITO_SCOPE`

Backend config:

- `WORKMAP_COGNITO_APP_CLIENT_ID`
- `WORKMAP_COGNITO_ISSUER` or `WORKMAP_COGNITO_REGION` plus `WORKMAP_COGNITO_USER_POOL_ID`
- optional `WORKMAP_COGNITO_COMPANY_SLUG`

Backend verification:

- JWT issuer must match configured issuer.
- Audience/client id must match configured app client id.
- Signature must verify through Cognito JWKS with RS256.
- Expired or not-yet-active tokens are rejected.
- `email_verified` must be true.
- Cognito `sub` maps through `User.cognitoSub` when available.
- A legacy exact verified email match can be bound to the Cognito sub when safe.
- Cross-company or ambiguous matches are rejected.

`GET /auth/me` under Cognito Bearer returns the resolved WorkMap request context from Prisma. It does not trust frontend-provided company/user/role.

## Platform Admin Contract

Commit `afe65e7` added independent platform-admin APIs.

Auth:

- Platform APIs use Cognito Bearer auth only.
- They do not use tenant `/auth/me`, tenant `RequestContextGuard`, pilot login, dev-token, development headers, or tenant role checks.
- Access requires verified Cognito identity plus backend allowlist match in `WORKMAP_PLATFORM_ADMIN_EMAILS` or `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS`.
- Missing/invalid Cognito credentials return `401`.
- Valid tenant users who are not configured platform admins return `403`.
- Tenant OWNER does not imply platform access.

`GET /platform/me` returns:

- `platformRole: "PLATFORM_ADMIN"`
- `identity`: `email`, `cognitoSub`, `displayName`
- `source: "cognito"`

`GET /platform/tenants` returns privacy-safe tenant summary rows:

- company id/name/slug
- created/updated timestamps
- owner/user/employee counts
- device/invite/integration counts
- policy/default office map configured flags
- readiness flags
- latest aggregate activity timestamp
- latest aggregate virtual-office position timestamp

`GET /platform/tenants/:companyId` returns privacy-safe tenant detail for one company.

`GET /platform/tenants/:companyId/health` returns tenant readiness/health summary.

`GET /platform/audit` returns platform audit summaries from `PlatformAuditLog`.

Privacy exclusions:

- no employee app/domain details
- no browsing URL/details
- no message/email content
- no virtual-office movement history
- no secrets/tokens
- no raw cross-tenant employee activity rows
- no support impersonation
- no tenant mutation or billing controls

## Tenant Onboarding Contract

These routes use Cognito Bearer auth through `CognitoOnlyGuard`.

`GET /tenant-onboarding/status` returns either:

- `state: "needs_workspace"` plus `cognito.sub`, `cognito.email`, `cognito.displayName`
- `state: "workspace_ready"` plus `cognito`, `context`, `user`, `company`, and `onboarding`

`POST /tenant-onboarding/workspace` request body:

- `companyName: string` between 2 and 120 characters
- `workspaceName: string` between 2 and 120 characters

Response body is `WorkMapApiWorkspaceContext`:

- `context`: `companyId`, `userId`, `role`
- `user`: `id`, `companyId`, `companySlug`, `email`, `displayName`, `role`
- `company`: `id`, `name`, `slug`
- `onboarding`: `createdWorkspace`, `acceptedInvite`, `nextRoute`

Behavior:

- Creates a real company/workspace for an unmapped verified Cognito owner.
- Creates the owner as role `OWNER` with `User.cognitoSub`.
- Creates default office map/rooms, owner position, and compliance policy.
- Existing safely matched users are returned rather than duplicated.

## Invitation Contract

`GET /invitations`:

- Auth: `RequestContextGuard + RolesGuard`, `OWNER` only.
- Service also enforces `canInviteEmployees()`.
- Returns `{ invitations }` for the authenticated owner's company.

`POST /invitations` request body:

- `email: string`
- `role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGER" | "HR_ADMIN" | "IT_ADMIN"`

`POST /invitations` response:

- `invitation`: `id`, `invitedEmail`, `role`, `status`, `invitedBy`, `expiresAt`, `acceptedAt`, `createdAt`, `updatedAt`
- `inviteLink`: full link generated from `WORKMAP_APP_URL`, `NEXT_PUBLIC_APP_URL`, or local fallback
- `token`: plaintext invite token returned once

Storage rule:

- Plain invite token is not stored.
- Database stores unique SHA-256 `tokenHash`.

`POST /invitations/accept`:

- Auth: Cognito Bearer through `CognitoOnlyGuard`.
- Request body: `token: string`
- Validates token hash, pending status, expiration, verified Cognito email match, and tenant identity conflicts.
- Returns `WorkMapApiWorkspaceContext` with `onboarding.acceptedInvite: true` and `onboarding.nextRoute: "/compliance"`.

## Integrations Contract

`GET /integrations`:

- Requires integration-management capability.
- Current allowed roles: IT_ADMIN and OWNER.
- Returns company-level integration settings for the authenticated company only.

`GET /integrations/contact-links/:targetUserId`:

- Available to roles with contact-link capability.
- Target user must belong to the authenticated company.
- Wrong-tenant targets return safe not-found behavior.

## Compliance Contract

`GET /compliance/policy` returns active policy fields such as id, name, collection flags, work hours, retention, policy version, and active date.

`POST /compliance/policy/:policyId/acknowledgement` records acknowledgement for the authenticated current user and returns:

- `id`
- `monitoringPolicyId`
- `acknowledgedAt`

Current limitation: `GET /compliance/policy` does not return acknowledgement status, so the frontend stores a browser marker after successful backend acknowledgement for pilot refresh readability.

## Virtual Office Response Shapes

`GET /virtual-office/map` returns:

- `id`, `name`, `slug`, `width`, `height`, `tileSize`, `mapData`
- `rooms[]`: `id`, `name`, `type`, `zoneData`, `autoStatus`

`GET /virtual-office/navigation` returns room-derived navigation destinations:

- `id`, `name`, `type`, `anchor`, `bounds`, `autoStatus`, `peopleCount`

`GET /virtual-office/map/:officeMapId/positions` returns:

- `userId`, `displayName`, `avatarId`, `x`, `y`, `direction`, `isMoving`, `status`, optional `roomId`, `updatedAt`
- `officeMapId` must belong to the authenticated user's company before positions are returned.

`PUT /virtual-office/map/:officeMapId/positions/me` saves the authenticated current user's latest position.

Auth rule:

- Guarded by `RequestContextGuard`.
- `companyId` and `userId` come from request context.
- Request body does not accept or trust `userId`.

Request body:

- `x: number`
- `y: number`
- `direction: "up" | "down" | "left" | "right"`
- `isMoving: boolean`
- `status: "available" | "busy" | "focus" | "idle" | "break" | "offline" | "on_call"`
- optional `roomId: string`

Response body:

- `userId`
- `x`
- `y`
- `direction`
- `isMoving`
- `status`
- optional `roomId`
- `updatedAt`

Validation:

- `officeMapId` uses UUID parsing.
- Body must be an object.
- Coordinates must be finite numbers.
- Direction/status must be supported enum values.
- `roomId`, when present, must be a string.
- Service validation ensures the map and optional room belong to the authenticated company.
- As of commit `b68dd49`, optional `roomId` must be a backend OfficeRoom UUID shape. Invalid values such as local/mock ids return a controlled `400 BadRequestException` instead of reaching Prisma.

QA-confirmed local API reads with Bearer token:

- `GET http://localhost:3001/virtual-office/map` returned 200, `Default Office Map`, width 1280, height 720, and 6 rooms.
- `GET http://localhost:3001/virtual-office/navigation` returned 200 and 6 destinations.
- `GET http://localhost:3001/virtual-office/map/:officeMapId/positions` returned 200 and 5 positions.
- Browser DevTools confirmed `/virtual-office/map` and `/virtual-office/navigation` requests included `Authorization: Bearer ...`.
- API closed-loop verification for `1a0a19f` confirmed `PUT /virtual-office/map/:officeMapId/positions/me` saved `x=333`, `y=444`, `direction=right` and a follow-up positions read returned the same values for the same user.
- Commit `effb188` reuses repeated `GET /virtual-office/map/:officeMapId/positions` calls for basic polling presence; no new backend route was added.
- Commit `b68dd49` verified invalid save `roomId=open-office-north` returns controlled 400 and omitted `roomId` save succeeds.

## Virtual Office Realtime Contract

Commit `1d2836c` added a native WebSocket contract for realtime movement.

Endpoint:

- `WS /virtual-office/realtime`

Frontend URL derivation:

- `http://` API base becomes `ws://`.
- `https://` API base becomes `wss://`.
- No new public env var was added; the socket URL is derived from the existing API base URL.

Auth:

- Handshake requires the same backend request context as guarded HTTP APIs.
- Browser clients pass the Bearer token as query `token` because native WebSocket cannot set custom `Authorization` headers.
- Server-side/non-browser callers may provide `Authorization: Bearer ...`.
- Deployed production should use WSS and avoid query-string logging.

Client-to-server events:

- `office:join`: `{ officeMapId }`
- `office:leave`
- `player:move`: `{ x, y, direction, isMoving, status, roomId? }`

Server-to-client events:

- `player:state`: `{ userId, displayName, avatarId, role, officeMapId, x, y, direction, isMoving, status, roomId?, updatedAt }`
- `office:presence`: `{ officeMapId, users: [...] }`
- `office:error`: `{ message }`

Rules:

- `office:join` validates auth, `canAccessVirtualOffice()`, UUID-shaped `officeMapId`, and same-company office map ownership.
- The backend computes room scope as `companyId:officeMapId`; clients cannot select tenant/company scope.
- `player:move` is accepted only after a valid join.
- Optional `roomId` must belong to the joined office map.
- Movement snapshots are rate-limited server-side and broadcast only to other sockets in the same company/map room.
- Movement broadcasts do not write to Prisma. Latest persisted position still uses `PUT /virtual-office/map/:officeMapId/positions/me`.

## Frontend Virtual Office Data Loader

Accepted in commit `abe673c` and updated in later commits: `/virtual-office` has a frontend data loader that asks for development auth in local browser development, then attempts:

- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`

The loader validates response shapes before adapting them into frontend rooms, navigation destinations, and remote players. It keeps `mockOfficeData.ts` fallback for failed, unauthorized, invalid, empty, or partial API responses.

Important contract assumptions:

- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must use the same pixel coordinate space as the current TMX map.
- Backend `OfficeMap.mapData` is not used for frontend canvas rendering.
- API positions do not currently include frontend role/profile-route metadata; frontend maps role to `Team member`.

## Important Gaps

- No shared pub/sub contract for multi-instance realtime broadcast has been added.
- No historical position trail or arbitrary-user position mutation contract has been added.
- No final global identity/account or tenant-membership API contract has been added.
- No persisted platform identity lifecycle, platform admin management API, tenant mutation, impersonation, or billing API has been added.
