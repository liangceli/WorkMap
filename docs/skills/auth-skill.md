# Auth Skill

## Backend Auth

Backend auth is centered on `RequestContextGuard` for HTTP and `RequestContextResolverService` for reusable HTTP/WebSocket context resolution.

Supported context sources:

- Cognito Bearer JWT, verified by backend `CognitoJwtService`.
- WorkMap Bearer JWT, verified by backend `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

`POST /auth/dev-token` creates an 8-hour development Bearer token for seeded users when not in production.

`POST /auth/pilot-login` creates an 8-hour pilot Bearer token for seeded/pilot users when credentials are valid.

`GET /auth/me` returns the resolved request context.

Auth priority as of commit `c2c7d76` and preserved in `e5d4882`:

1. Cognito Bearer JWT.
2. WorkMap/pilot/dev Bearer JWT.
3. Development headers, only when `NODE_ENV !== "production"`.

WebSocket realtime auth:

- `/virtual-office/realtime` resolves handshake context through `RequestContextResolverService`.
- Browser clients pass the Bearer token as query `token` because native WebSocket cannot set custom `Authorization` headers.
- Server-side/non-browser callers may provide `Authorization: Bearer ...`.
- Development headers remain an HTTP-only fallback outside production; sockets should use token-backed auth.
- The gateway does not trust client-provided company/user/role scope. Tenant room scope is computed from the resolved backend context and validated office map.

## Capabilities / RBAC

Commit `815df2c` added the central capability model in `packages/auth`.

Capabilities include:

- `manageCompany`
- `inviteEmployees`
- `viewEmployeeDirectory`
- `viewEmployeeActivity`
- `viewOwnReports`
- `viewTeamReports`
- `manageCompliancePolicy`
- `viewComplianceStatus`
- `manageIntegrations`
- `viewDeviceHealth`
- `accessTechnicalSettings`
- `accessVirtualOffice`
- `useContactLinks`

Key role boundaries:

- EMPLOYEE can view directory, own reports, virtual office, and contact links.
- TEAM_LEAD/MANAGER/HR_ADMIN can view team reports/activity at company-level for the current bridge.
- HR_ADMIN can manage compliance policy/status.
- IT_ADMIN can manage integrations, device health, and technical settings.
- OWNER has all listed capabilities.

Backend service checks are the security boundary. Frontend navigation/command visibility is advisory.

## Cognito Auth

Commit `c2c7d76` added the STAGE 2 Cognito deployment baseline. Commit `e5d4882` added stable Cognito `sub` mapping and Cognito-only onboarding/invite flows.

Backend behavior:

- `CognitoJwtService` verifies Cognito JWTs against issuer JWKS using RS256.
- Required backend config: `WORKMAP_COGNITO_APP_CLIENT_ID` plus either `WORKMAP_COGNITO_ISSUER` or `WORKMAP_COGNITO_REGION` and `WORKMAP_COGNITO_USER_POOL_ID`.
- Verification checks issuer, audience/client id, expiry, `nbf`, and signature.
- `AuthService.resolveCognitoContext()` requires a Cognito subject and verified email.
- `email_verified` must be boolean `true` or string `"true"`.
- Backend prefers `User.cognitoSub` for stable Cognito mapping.
- A single legacy verified email match can be bound to the Cognito sub as a compatibility bridge.
- If the same email maps to multiple companies, or a Cognito sub/email conflict crosses companies, the request is rejected.
- WorkMap `companyId`, `userId`, and `role` come from Prisma, not frontend claims.
- `CognitoOnlyGuard` allows verified Cognito users without an existing WorkMap user mapping to call tenant onboarding and invite acceptance endpoints only.

Frontend behavior:

- `lib/auth/cognitoSession.ts` manages Hosted UI config, PKCE transaction state, token exchange, session storage, and logout URL generation.
- Cognito session storage key: `workmap.cognitoSession`.
- Cognito transaction storage key: `workmap.cognitoTransaction`.
- `/login/callback` completes the code exchange, checks pending invite token first, calls backend `/auth/me` for normal mapped users, saves workflow role state with `hasCompany: true`, and routes through `getNextRouteForUser(nextState)`.
- Pending invite token storage key: `workmap.pendingInviteToken`.
- `getWorkMapApiAuthOptions()` uses a mapped Cognito session before pilot or dev-token auth.
- If a Cognito session exists but backend mapping fails, API auth returns unavailable rather than silently using pilot fallback. Clear/sign out Cognito session before testing pilot fallback again.

Tenant onboarding / invites:

- New unmapped verified Cognito owners can create a workspace through `POST /tenant-onboarding/workspace`.
- Owner invite list/create requires mapped WorkMap auth and `OWNER`.
- Employee invite acceptance uses Cognito-only auth, verified email, and hashed invite token validation.

## Pilot Auth

Commit `14fb706` added pilot-ready auth for the 5-person pilot.

Backend behavior:

- Endpoint: `POST /auth/pilot-login`.
- Request body: `email`, `password`, optional `companySlug`.
- Backend finds the user by email/company scope and does not trust a client user id.
- Password verification uses Node built-in PBKDF2 SHA-256 and `timingSafeEqual`; no new dependency was added.
- Password hash env: `WORKMAP_PILOT_PASSWORD_HASH`.
- In non-production, a local pilot hash supports seeded/demo password `workmap-pilot`.
- In production, pilot login is disabled unless `WORKMAP_PILOT_PASSWORD_HASH` is explicitly configured.
- Successful response matches the Bearer token shape used by dev-token.

Frontend behavior:

- Pilot session storage key: `workmap.pilotSession`.
- Stored data includes Bearer token, expiry, and auth user context.
- Sessions expire one minute before token expiry and are cleared automatically.
- `getWorkMapApiAuthOptions()` prefers pilot session, then falls back to development dev-token/dev-cache when available.
- After `c2c7d76`, pilot session is second priority behind a mapped Cognito session.
- Logout/session clear removes pilot session and demo workflow state.
- Existing demo workflow state remains for onboarding/navigation continuity, not production authorization.

## Frontend Auth Boundary

The current frontend login/onboarding flow uses localStorage-backed demo workflow state in `lib/workflow/workflowState.ts`. The file explicitly says it is not authentication, authorization, or backend RBAC.

## Development API Auth Bridge

Commit `2a4a269` added a frontend-only local development bridge for `/virtual-office` API verification.

Confirmed behavior:

- `lib/api/authApi.ts` exposes `createDevelopmentToken()` for the existing backend `POST /auth/dev-token`.
- `lib/api/developmentApiAuth.ts` exposes `getDevelopmentApiAuthOptions()`.
- The helper no-ops outside `NODE_ENV === "development"` and requires browser `localStorage`.
- It stores cached token data under `workmap.devApiAuth`.
- As of commit `1a0a19f`, cached/result auth data includes the current `userId` so `/virtual-office` can identify the current user's saved position without adding production session state.
- It chooses seeded demo users from frontend demo workflow role:
  - `EMPLOYEE`: `engineer@workmap.demo`
  - `MANAGER`: `manager@workmap.demo`
  - `OWNER`: `owner@workmap.demo`
  - `IT_ADMIN`: `it.admin@workmap.demo`
- Default company slug is `workmap-demo-company`.
- Optional overrides are `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL` and `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`.

This bridge is not production auth. It exists only to let local development verify backend-backed virtual-office reads.

Local verification status:

- Commit `d7152dd` confirmed dev-token issuance against `http://localhost:3001/auth/dev-token` when `WORKMAP_JWT_SECRET` and seed data are available.
- Browser QA confirmed virtual-office read requests can include `Authorization: Bearer ...`.

## Roles

Prisma roles include:

- `EMPLOYEE`
- `TEAM_LEAD`
- `MANAGER`
- `HR_ADMIN`
- `IT_ADMIN`
- `OWNER`

Frontend demo workflow role union currently includes only `EMPLOYEE`, `MANAGER`, `OWNER`, and `IT_ADMIN`.

## Risks

- STAGE 2 Cognito is a deployment/auth baseline, not a complete enterprise identity lifecycle.
- `User.cognitoSub` is now the minimal stable mapping, but global identity/account tables, multi-company membership, invite emails, MFA policy, password reset UX, and route guard overhaul remain future work.
- Frontend route visibility is role-aware but not the security boundary.
- Department/team-level RBAC remains coarse until team membership boundaries exist in the data model.
- Authenticated virtual-office API success depends on the local backend listening on `localhost:3001`, `WORKMAP_JWT_SECRET` being configured, and demo seed data existing.
- Pilot auth is not SSO/OAuth/MFA/password-reset-ready production auth.
- WebSocket token query auth should be used only over WSS in deployed environments, and platform logging should avoid persisting socket query strings.
