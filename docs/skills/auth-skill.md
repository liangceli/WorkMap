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
