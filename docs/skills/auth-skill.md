# Auth Skill

## Backend Auth

Backend auth is centered on `RequestContextGuard`.

Supported context sources:

- Bearer JWT, verified by backend `JwtService`.
- Development-only headers: `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role`.

`POST /auth/dev-token` creates an 8-hour development Bearer token for seeded users when not in production.

`GET /auth/me` returns the resolved request context.

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

- Production session handling and frontend token storage are not confirmed.
- Frontend route access is demo-state-based, not backend-auth-based.
- Authenticated virtual-office API success depends on the local backend listening on `localhost:3001`, `WORKMAP_JWT_SECRET` being configured, and demo seed data existing.
