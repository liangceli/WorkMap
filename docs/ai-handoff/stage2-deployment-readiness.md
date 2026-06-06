# STAGE 2 Deployment Readiness

## Platform Direction

- Frontend: Vercel
- Backend: Render
- Database: Supabase Postgres
- Auth: AWS Cognito Hosted UI / Amplify-compatible configuration

This document is a readiness checklist. It does not mean deployment has already been performed.

## Vercel Frontend

Build settings:

- Root directory: `workmap`
- Install command: `pnpm install`
- Build command: `pnpm --filter @workmap/web build`
- Output: managed by Next.js/Vercel

Required public environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WORKMAP_API_URL`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `NEXT_PUBLIC_COGNITO_SCOPE`

Manual action required:

- Set real Vercel project URL or production domain in `NEXT_PUBLIC_APP_URL`.
- Set Render API URL in `NEXT_PUBLIC_WORKMAP_API_URL`.
- Set Cognito callback URL to `https://<vercel-domain>/login/callback`.
- Set Cognito logout URL to `https://<vercel-domain>/login`.

## Render Backend

Build/start settings:

- Root directory: `workmap`
- Build command: `pnpm install && pnpm --filter @workmap/api build`
- Start command: `pnpm --filter @workmap/api start`
- Health check path: `/health`

Required server environment variables:

- `DATABASE_URL`
- `WORKMAP_ALLOWED_ORIGIN`
- `WORKMAP_JWT_SECRET`
- `WORKMAP_PILOT_PASSWORD_HASH` while pilot fallback remains enabled
- `WORKMAP_COGNITO_REGION`
- `WORKMAP_COGNITO_USER_POOL_ID`
- `WORKMAP_COGNITO_APP_CLIENT_ID`
- `WORKMAP_COGNITO_ISSUER` if not deriving issuer from region/user pool
- `WORKMAP_COGNITO_COMPANY_SLUG` for the temporary STAGE 2 email mapping when needed

Manual action required:

- Set `WORKMAP_ALLOWED_ORIGIN` to the Vercel frontend origin.
- Do not put `NEXT_PUBLIC_*` values in place of server-only secrets.
- Render may provide `PORT`; WorkMap still supports `API_PORT` for local runs.

## Supabase Postgres

Use Supabase's Postgres connection string as `DATABASE_URL`.

Manual action required:

- Use the direct connection string for migrations when possible.
- If using Supabase pooler URLs for runtime, verify Prisma compatibility before switching.
- Run Prisma generate/migrate/seed against the intended database:

```powershell
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

Notes:

- No Supabase RLS policy work is included in this round.
- No multi-tenant schema migration is included in this round.
- Do not paste database passwords into chat; set them directly in Supabase/Render environment variables.

## Cognito Setup

Manual action required in AWS:

- Create or choose a Cognito User Pool.
- Create an app client suitable for browser-based auth code + PKCE.
- Configure Hosted UI domain.
- Add callback URL:
  - Local: `http://localhost:3000/login/callback`
  - Deployment: `https://<vercel-domain>/login/callback`
- Add logout URL:
  - Local: `http://localhost:3000/login`
  - Deployment: `https://<vercel-domain>/login`
- Enable scopes: `openid`, `email`, `profile`.

Frontend uses Cognito Hosted UI without adding Amplify UI packages in this round. This keeps the baseline small and can coexist with a later Amplify library/UI integration.

Backend verification:

- Verifies Cognito JWT issuer.
- Verifies app client audience/client id.
- Verifies token expiry.
- Verifies RS256 signature against Cognito JWKS.
- Does not trust frontend-provided user/company/role.

## Cognito User To WorkMap User Mapping

Preferred stable identity:

- Cognito `sub` should become the stable identity in a future schema-backed mapping.

Temporary STAGE 2 mapping:

- Backend reads Cognito `sub` and `email` from the verified token.
- Backend maps the verified email to an existing WorkMap `User`.
- If `WORKMAP_COGNITO_COMPANY_SLUG` is configured, lookup is scoped to that company.
- If no company slug is configured and the email maps to multiple WorkMap companies, the request is rejected.
- WorkMap `companyId`, `userId`, and `role` come from the database only.

Next multi-tenant round should decide:

- Whether to add a `cognitoSub` field or identity table.
- How company/tenant membership is provisioned.
- How invite/onboarding works.
- How to migrate pilot users to Cognito identities.

## Smoke Test

Local:

- Start API on `localhost:3001`.
- Start web on `localhost:3000`.
- Confirm `GET /health`.
- Confirm pilot login still works.
- Confirm `/login` shows Cognito configuration status.
- Confirm `/virtual-office`, `/dashboard`, `/reports`, and `/compliance` still work with pilot auth.

With Cognito configured:

- Click `Sign in with Cognito`.
- Complete Hosted UI sign-in.
- Confirm `/login/callback` exchanges the code.
- Confirm backend `/auth/me` accepts the Cognito token.
- Confirm `/virtual-office` requests include the Cognito bearer token.

Failure checks:

- Missing Cognito env should show configuration guidance and preserve pilot fallback.
- Unmapped Cognito user should receive a controlled unauthorized/mapping-needed response.
- Backend stopped should not crash frontend pages that already have fallback behavior.
