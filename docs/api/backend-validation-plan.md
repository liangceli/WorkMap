# Backend Validation Plan

Status: implementation plan  
Date: 2026-05-31  
Scope: `apps/api`

## Current Dependency Reality

The API currently has Nest core/platform-express, Prisma client, reflect-metadata, rxjs, `@workmap/auth`, and `@workmap/shared-types`.

No validation library is currently installed:

- no `class-validator`
- no `class-transformer`
- no `zod`

Do not add validation dependencies until the Director approves the dependency/API strategy.

## Current Safe Validation Already Present

- UUID route params use Nest `ParseUUIDPipe` for:
  - `GET /users/:userId`
  - `GET /virtual-office/map/:officeMapId/positions`
  - `POST /compliance/policy/:policyId/acknowledgement`
  - `GET /integrations/contact-links/:targetUserId`
- Optional report query validation uses `OptionalUuidPipe` for:
  - `GET /reports/usage-summary?userId=...`
- `POST /auth/dev-token` uses manual checks:
  - disabled in production
  - email must be valid enough for local/demo use
  - optional company slug must match the expected slug pattern
  - user must exist in the selected company before token issuance
- JWT validation checks:
  - Bearer format
  - HS256 algorithm
  - signature
  - required `sub` and `companyId`
  - `exp`
  - database user/company membership

## Recommended Validation Library Strategy

Short term:

- Continue using Nest built-in pipes for simple route params and query scalars.
- Use narrow manual type guards for the few existing request bodies.
- Avoid broad ad hoc validation helpers that become a second framework.

Production/API-contract phase:

- Prefer `class-validator` + `class-transformer` for Nest controllers if DTO classes are the desired local pattern.
- Consider `zod` only if shared frontend/backend schema validation becomes a stated goal.
- Enable a global `ValidationPipe` with:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
  - clear max-length constraints on strings

## Endpoints That Need DTOs First

Priority 1:

- `POST /auth/dev-token`
  - Replace manual checks with `CreateDevelopmentTokenDto` if DTO library is approved.
  - Keep disabled in production.

Priority 2:

- Future `POST /activity/batch`
  - Must not be implemented until payload, queue, retention, and validation contracts are approved.
  - Requires strict array length limits, enum validation, timestamp validation, duration rules, and rejected-field checks.

Priority 3:

- Future production login/token issuance endpoint.
- Future Socket.IO auth/movement payloads.
- Future settings/admin mutation endpoints.
- Future compliance/admin policy mutation endpoints.

## Current Endpoints With No Body

These are lower validation risk because they are GET/route-param only:

- `GET /auth/me`
- `GET /companies/current`
- `GET /users/me`
- `GET /users`
- `GET /users/:userId`
- `GET /devices`
- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`
- `GET /compliance/policy`
- `GET /integrations`
- `GET /integrations/contact-links/:targetUserId`
- `GET /reports/usage-summary?userId=...`

## Block Before Activity Ingestion

Do not implement `POST /activity/batch` until all of the following are approved:

- Final payload contract.
- Device authentication or agent trust model.
- Device-user-company membership validation.
- Queue strategy: Redis/BullMQ or direct write for MVP.
- Batch size limits.
- Timestamp skew rules.
- Maximum duration rules.
- Deduplication strategy.
- Retention strategy.
- Monitoring policy enforcement.
- DTO validation dependency or equivalent strict manual validator.

## Block Before Production Deployment

- Remove or hard-disable non-production header fallback.
- Keep `POST /auth/dev-token` disabled in production.
- Decide production login/SSO strategy.
- Add rate limiting for token and ingestion endpoints.
- Add DTO validation library and global validation pipe.
- Add structured error response policy.
- Add request logging with sensitive data redaction.
- Confirm secrets are environment-only.
- Confirm CORS origins are deployment-specific.

## Rejected Fields For Future Activity/Event DTOs

The API should reject or ignore with a hard validation error:

- `fullUrl`
- `windowTitle`
- `screenshotUrl`
- `keystrokes`
- `keystrokeData`
- `formInput`
- `password`
- `emailContent`
- `teamsMessageContent`
- `camera`
- `microphone`
- arbitrary page content

## Testing Suggestions

- Invalid UUID route params return 400.
- Normal employee requesting another user's report returns 403.
- Normal employee requesting another user detail receives contact-only response.
- Manager requesting another user detail writes audit log.
- Production `NODE_ENV=production` rejects header fallback.
- Production `NODE_ENV=production` rejects `POST /auth/dev-token`.
- Invalid JWT signature returns 401.
- Expired JWT returns 401.
- JWT with valid signature but non-member `companyId` returns 401.
