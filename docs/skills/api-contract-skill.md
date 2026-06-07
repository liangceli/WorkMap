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
- `GET /tenant-onboarding/status`
- `POST /tenant-onboarding/workspace`
- `GET /invitations`
- `POST /invitations`
- `POST /invitations/accept`
- `GET /companies/current`
- `GET /users/me`
- `GET /users`
- `GET /users/:userId`
- `GET /devices`
- `GET /reports/usage-summary`
- `GET /reports/usage-summary?userId=:userId`
- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`
- `PUT /virtual-office/map/:officeMapId/positions/me`
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

- No websocket/SSE realtime position sync, historical position trail, or arbitrary-user position mutation contract has been added.
