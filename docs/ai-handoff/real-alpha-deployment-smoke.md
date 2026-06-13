# Real Alpha Deployment Smoke

Status: Alpha Ready Candidate.

Last updated: 2026-06-13.

This document is the Round 9 external deployment smoke runbook for WorkMap. It does not contain real secrets, real platform admin identities, or real deployment URLs.

## 1. Current External Env Availability

Codex checked only the current process environment for required variable names and did not read or print `workmap/.env`.

Result:

- No deployed Vercel frontend URL was available in the current process environment.
- No deployed Render API URL was available in the current process environment.
- No Cognito Hosted UI public config was available in the current process environment.
- No Supabase/Render backend database env was available in the current process environment.
- No platform admin allowlist env was available in the current process environment.

Round 9 follow-up deployed smoke was run manually by the human tester on 2026-06-13 after external Vercel, Render, Supabase, and Cognito setup. Results are recorded below as human-reported pass evidence without secrets.

## 2. Manual Action Required

Do not paste secrets into chat. Enter secrets only in the relevant platform env settings.

| Platform | Value needed | Secret? | Where to enter it |
|---|---|---:|---|
| Supabase | Postgres connection string for `DATABASE_URL` | Yes | Render backend environment |
| Render | Backend service URL | No | Vercel `NEXT_PUBLIC_WORKMAP_API_URL`; local shell only for smoke |
| Render | `WORKMAP_JWT_SECRET` | Yes | Render backend environment |
| Render | `WORKMAP_PILOT_PASSWORD_HASH` if pilot fallback is allowed | Yes | Render backend environment |
| Render | `WORKMAP_ALLOWED_ORIGINS` exact Vercel origin(s) | No | Render backend environment |
| Render | `WORKMAP_APP_URL` exact Vercel origin | No | Render backend environment |
| Render | `WORKMAP_COGNITO_*` backend verification env | Mixed | Render backend environment |
| Render | `WORKMAP_PLATFORM_ADMIN_EMAILS` / `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` | Sensitive | Render backend environment only |
| Vercel | `NEXT_PUBLIC_APP_URL` | No | Vercel frontend environment |
| Vercel | `NEXT_PUBLIC_WORKMAP_API_URL` | No | Vercel frontend environment |
| Vercel | `NEXT_PUBLIC_COGNITO_*` public browser config | No | Vercel frontend environment |
| AWS Cognito | Hosted UI domain | No | Cognito app integration settings |
| AWS Cognito | callback URL `https://<vercel-app>/login/callback` | No | Cognito app client settings |
| AWS Cognito | logout URL `https://<vercel-app>/login` | No | Cognito app client settings |

## 3. Deployment Setup Checklist

### Supabase Postgres

1. Create or choose the alpha Postgres database.
2. Copy the Supabase pooled or direct Postgres connection string into Render as `DATABASE_URL`.
3. Ensure SSL requirements are satisfied by the chosen Supabase connection string.
4. From `workmap/`, run Prisma generation and migration against the target DB from a secure environment:

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
```

Required migrations in order:

1. `20260529043117_v1`
2. `20260606000000_stage2_onboarding_invites`
3. `20260607000000_platform_audit_log`
4. `20260609000000_stage2_activity_source`

Production alpha should not run demo seed unless sample/demo data is intentionally desired.

### Render Backend

Recommended settings:

- Root directory: `workmap`
- Build command: `pnpm install && pnpm --filter @workmap/api build`
- Start command: `pnpm --filter @workmap/api start`
- Health check path: `/health`
- Readiness path: `/health/readiness`

Required backend env:

- `DATABASE_URL`
- `WORKMAP_JWT_SECRET`
- `WORKMAP_ALLOWED_ORIGINS`
- `WORKMAP_APP_URL`
- `WORKMAP_COGNITO_REGION`
- `WORKMAP_COGNITO_USER_POOL_ID`
- `WORKMAP_COGNITO_APP_CLIENT_ID`
- `WORKMAP_COGNITO_ISSUER` if not deriving from region/user pool
- `WORKMAP_PLATFORM_ADMIN_EMAILS` and/or `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` for Platform Admin
- `WORKMAP_PILOT_PASSWORD_HASH` only if pilot fallback is intentionally enabled

Success signs:

- `GET https://<render-api>/health` returns `status: ok`.
- `GET https://<render-api>/health/readiness` returns `status: ready` and `checks.database: ok`.
- Browser requests from the deployed Vercel origin receive the expected CORS allow origin header.

Failure signs:

- `/health/readiness` returns `503`, meaning DB readiness is not available.
- Browser console shows CORS errors, usually because `WORKMAP_ALLOWED_ORIGINS` does not exactly match the Vercel origin.
- Invite links point to localhost, usually because `WORKMAP_APP_URL` is missing.

### Vercel Frontend

Recommended settings:

- Root directory: `workmap`
- Install command: `pnpm install`
- Build command: `pnpm --filter @workmap/web build`

Required public env:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WORKMAP_API_URL`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `NEXT_PUBLIC_COGNITO_SCOPE`

Check these routes after deploy:

- `/login`
- `/login/callback`
- `/onboarding/company`
- `/invite/<token>`
- `/virtual-office`
- `/platform-admin`
- `/dashboard`
- `/reports`
- `/employees`
- `/compliance`

### AWS Cognito

Required app client setup:

- Hosted UI domain is configured.
- Browser/public app client uses OAuth authorization code + PKCE.
- Callback URL: `https://<vercel-app>/login/callback`.
- Logout URL: `https://<vercel-app>/login`.
- Scopes: `openid email profile`.
- Email verification is required for WorkMap backend mapping.

Platform Admin:

- Platform Admin is not a tenant OWNER.
- Add the platform admin's verified Cognito email and/or Cognito `sub` only to backend env allowlists.
- Do not commit or paste the real email/sub into chat.

### WebSocket / WSS

- Frontend derives `wss://<render-api>/virtual-office/realtime` from `NEXT_PUBLIC_WORKMAP_API_URL` when the API URL is HTTPS.
- Render must support WebSocket upgrade.
- `WORKMAP_ALLOWED_ORIGINS` must include the exact Vercel origin.
- Current realtime is single-instance/in-memory. Use one API instance for alpha until shared pub/sub exists.
- Browser WebSocket auth uses a query `token`; use WSS and avoid retaining full query-string logs.

## 4. Smoke Helper

Round 9 adds a non-secret smoke helper:

```powershell
$env:WORKMAP_SMOKE_API_URL="https://<render-api>"
$env:WORKMAP_SMOKE_APP_URL="https://<vercel-app>"
$env:WORKMAP_SMOKE_ORIGIN="https://<vercel-app>"
pnpm smoke:alpha
```

The helper checks:

- API `/health`
- API `/health/readiness`
- CORS allowlist response for the configured app origin
- frontend `/`
- frontend `/login`
- frontend `/virtual-office`
- frontend `/platform-admin`
- derived WSS endpoint path

The helper intentionally does not perform authenticated Cognito, invite, activity, report, or Platform Admin browser flows because those require real users/tokens and must stay out of chat.

## 5. Real Alpha Smoke Checklist

Current status: human-reported pass for external alpha smoke.

| Check | Status |
|---|---|
| Backend `/health` | Passed |
| Backend `/health/readiness` | Passed |
| Frontend loads | Passed |
| Cognito login redirects correctly | Passed |
| Cognito callback completes | Passed |
| Owner creates workspace | Passed |
| Owner creates invite | Passed |
| Employee accepts invite | Passed |
| Employee login works | Passed |
| Owner and Employee open `/virtual-office` | Passed |
| Realtime movement works | Passed |
| Polling fallback is acceptable if socket is unavailable | Passed |
| People panel works | Passed |
| Contact drawer works | Passed |
| Platform Admin login works | Passed |
| Tenant Owner is blocked from Platform Admin | Passed |
| Employee is blocked from Platform Admin | Passed |
| Employee registers device | Passed |
| Employee submits sample app usage | Passed |
| Employee submits sample domain usage | Passed |
| Employee sees own report | Passed |
| Owner sees allowed company aggregate report | Passed |
| Employee `scope=company` is blocked | Passed |
| Platform Admin does not see employee-level app/domain data | Passed |
| Compliance copy/modal is accurate | Passed |
| Dashboard loads | Passed |
| Reports loads | Passed |
| Employees page loads | Passed |
| Settings/invite flow loads | Passed |
| Cross-tenant access attempts fail safely where practical | Passed |
| No real secrets are present in committed files or public client bundle | Local scan passed before deployment prep; final platform secret review remains operational discipline |
| Production CORS blocks unapproved browser origins | Approved-origin CORS passed through `pnpm smoke:alpha`; unapproved-origin negative check remains recommended |
| WSS works from approved frontend origin | Passed |

## 6. Activity Hardening Live Checks

These must be run against the deployed API using real authenticated sessions/tokens handled only in the tester's browser/devtools or local shell:

- cross-user device id rejection
- cross-tenant device id rejection
- malformed device id
- future timestamp
- zero or negative duration
- too-long duration
- malformed domain
- full URL path/query sanitization to hostname only
- batch size limit
- employee blocked from company report scope
- owner same-tenant aggregate scope only

Current status: human-reported deployed checks passed for the alpha smoke path. Broader automated negative-test coverage remains future hardening.

## 7. Secret / Client Bundle Safety

Local code posture:

- `.env` is not committed and should not be read into handoff docs.
- `.env.example` contains placeholders/local defaults only.
- Platform admin allowlists are backend-only env values.
- Backend secrets must remain in Render/Supabase/AWS settings.
- Frontend exposes only `NEXT_PUBLIC_*` public config.

Before declaring alpha-ready:

1. Run the repo secret scan.
2. Inspect Vercel client bundle/env output for accidental server secret exposure.
3. Confirm `DATABASE_URL`, JWT/pilot secrets, platform admin allowlists, and bearer tokens are not in client code or public logs.

## 8. Release Blocker Checklist

Overall status: Alpha Ready Candidate.

| Item | Status | Notes |
|---|---|---|
| Supabase DB configured | Passed | Existing DB was migrated to current schema through Prisma migration baseline/deploy. |
| Prisma migrations applied | Passed | All four required migrations are recorded in deployed DB. |
| Render backend deployed | Passed | API liveness/readiness passed. |
| Vercel frontend deployed | Passed | Frontend public routes passed smoke. |
| Cognito Hosted UI configured | Passed | Callback/logout deployed URLs were configured and login smoke passed. |
| Production CORS/WSS allowlist | Passed | Approved-origin CORS and two-user realtime smoke passed. |
| Platform Admin allowlist | Passed | Platform Admin privacy boundary passed manual smoke. |
| Public smoke helper | Passed | `pnpm smoke:alpha` passed against deployed public URLs. |
| Full authenticated alpha smoke | Passed | Owner onboarding, invite, employee onboarding, virtual-office, reports, and platform-admin checks passed manually. |
| Activity hardening live checks | Passed for alpha smoke | Device registration, app/domain submission, employee own report, owner aggregate report, and employee company-scope block passed. |
| Secret/client bundle safety | Passed for repo scan | No committed real secrets found in repo scan; continue keeping platform secrets in provider env settings only. |

Recommendation:

- WorkMap is an Alpha Ready Candidate for a controlled 5-person pilot.
- This does not mean full production readiness: desktop-agent and browser-extension remain alpha harness/scaffold paths, realtime remains single-instance/in-memory, and broader automated negative security tests remain future hardening.
