# Auth Production Readiness

Status: readiness plan  
Date: 2026-05-31  
Scope: WorkMap API auth

## Current State

Current API auth supports:

- HS256 Bearer JWT verification with `WORKMAP_JWT_SECRET`.
- JWT `sub` as user id.
- JWT `companyId` as tenant id.
- Database lookup to confirm user-company membership.
- Database-derived role for trusted request context.
- Non-production `POST /auth/dev-token` for local/demo token issuance.
- Non-production header fallback for local tooling, verified against the database.

This is enough for local API/frontend integration. It is not production-ready auth.

## Why `POST /auth/dev-token` Is Non-Production Only

`POST /auth/dev-token` issues a token for an existing user by email and optional company slug. It has no password, SSO proof, magic link proof, MFA, rate limiting, or account lockout.

It exists only to support local/demo development with seed users. It must remain disabled when `NODE_ENV=production`.

## Why Header Fallback Must Be Disabled In Production

Header fallback is a local developer convenience. Although it now verifies user/company/role against the database, any caller that can reach production should not be able to assert identity through plain headers.

Production must require Bearer JWT or another approved authenticated session mechanism.

## Current HS256 Custom JWT Approach

Current implementation uses Node `crypto` to:

- verify HS256 signatures
- check `alg`
- decode payload
- enforce `exp`
- sign local/demo tokens

Before production, decide whether to:

1. Keep this small custom HS256 implementation and add more tests.
2. Switch to `@nestjs/jwt` / `jsonwebtoken` for standard ecosystem support.
3. Move to Microsoft SSO/OIDC tokens and server-side session issuing.

## Production Auth Options

### Option 1: Email/password MVP

Pros:

- Fastest production-style login.
- Works without Microsoft tenant setup.

Cons:

- Requires password hashing, password reset, account lockout, rate limiting, and storage.
- Requires Prisma schema/migration for password credentials or auth accounts.

Recommended hashing:

- Use Node `crypto.scrypt` or `crypto.pbkdf2` if avoiding new dependencies.
- Prefer a vetted password hashing dependency only after dependency approval.

Director decisions needed:

- Credential schema.
- Password policy.
- Reset flow.
- Session/refresh token strategy.

### Option 2: Email magic link

Pros:

- Avoids password storage.
- Good for MVP if email delivery is approved.

Cons:

- Requires email provider, one-time token storage, expiry, replay protection, and rate limiting.

Director decisions needed:

- Email provider.
- Magic token schema.
- Link expiry.
- Tenant discovery by email.

### Option 3: Microsoft SSO later

Pros:

- Best enterprise fit.
- Aligns with Teams/Outlook ecosystem.

Cons:

- Requires OAuth/OIDC configuration, tenant consent, callback handling, account linking, and deployment configuration.
- Does not automatically approve Microsoft Graph data access.

Director decisions needed:

- SSO provider strategy.
- Tenant model.
- OIDC scopes.
- Account provisioning.
- Domain/tenant verification.

## Recommended Short-Term Option

Keep current JWT verification for API integration and use `POST /auth/dev-token` only in local/demo environments.

For production MVP, choose either:

1. Email/password if speed matters most.
2. Microsoft SSO if enterprise fit matters most.

Do not add password fields, auth account tables, magic-link tables, or SSO account linking without Director approval.

## Required Schema/API Decisions

Potential schema changes depending on chosen option:

- password credential table or password fields
- refresh token/session table
- password reset token table
- magic link token table
- external identity/account table
- audit logs for login/security events

Potential API contracts:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `GET /auth/sso/microsoft/start`
- `GET /auth/sso/microsoft/callback`

## Migration Implications

Any production auth option likely requires Prisma schema changes. These must be approved by the Director and shipped as small migrations.

Do not retrofit credentials into existing user rows without a schema/security review.

## Security Checklist Before Production

- Disable `POST /auth/dev-token` in production.
- Disable header fallback in production.
- Configure `WORKMAP_JWT_SECRET` with a strong secret outside source control.
- Decide access token expiry.
- Decide refresh/session invalidation strategy.
- Add rate limiting to login/token endpoints.
- Add DTO validation and global validation pipe.
- Add CORS origin allowlist per deployment.
- Add security logging for failed login/token verification.
- Add tests for invalid signature, expired token, wrong company, deleted user, and role changes.
- Ensure role is always database-derived.
- Ensure manager-sensitive reads are audited.
- Ensure secrets are not logged.

## Environment Variables

Current:

- `WORKMAP_JWT_SECRET`: required for Bearer JWT verification and dev token signing.
- `NODE_ENV`: production disables dev-token and header fallback.
- `API_PORT`: API port.
- `NEXT_PUBLIC_APP_URL`: current CORS origin default.
- `DATABASE_URL`: Prisma database connection.

Future:

- `JWT_ACCESS_TOKEN_TTL`
- `JWT_REFRESH_TOKEN_TTL`
- Microsoft OAuth client id/secret/tenant/callback URL
- email provider credentials if magic link/reset is used

## Token Expiry And Refresh Strategy

Current local/demo token:

- 8-hour access token.
- No refresh token.
- No server-side revocation.

Production needs one of:

- short-lived access token plus refresh token/session storage
- server-side session
- SSO-backed session with app-issued token

Logout requires either:

- client-side token discard only, for low-risk MVP
- refresh token revocation
- session invalidation table
- token version or invalid-after timestamp

## Director Decisions Needed

- Production auth option.
- JWT library/package strategy.
- Credential/session schema.
- Refresh/logout behavior.
- Rate limiting approach.
- SSO timing and Microsoft tenant configuration.
