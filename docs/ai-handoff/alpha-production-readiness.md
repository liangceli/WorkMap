# Alpha Production Readiness Guide

Status: STAGE 2 Round 9 external alpha deployment preparation.

This guide prepares WorkMap for a controlled 5-person alpha pilot. It is not a claim that the desktop agent or browser extension are fully production-distributed products.

Round 9 adds `docs/ai-handoff/real-alpha-deployment-smoke.md` and the non-secret helper command `pnpm smoke:alpha`. Current external status remains Needs Manual External Setup until Vercel, Render, Supabase, and Cognito are configured and deployed smoke passes.

## 1. Deployment Targets

- Frontend: Vercel, root directory `workmap`.
- Backend: Render, root directory `workmap`.
- Database: Supabase Postgres through Prisma.
- Auth: AWS Cognito Hosted UI with PKCE.

Do not commit real secrets. Put secrets directly into Vercel, Render, Supabase, AWS, or local `.env`.

## 2. Vercel Frontend Env

Public config, safe to expose in the browser:

| Env | Required | Notes |
|---|---:|---|
| `NEXT_PUBLIC_APP_URL` | Yes | Deployed Vercel origin, for example `https://<app>.vercel.app`. |
| `NEXT_PUBLIC_WORKMAP_API_URL` | Yes | Deployed Render API origin, for example `https://<api>.onrender.com`. |
| `NEXT_PUBLIC_COGNITO_REGION` | Yes | AWS region. |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Yes | Cognito user pool id. |
| `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` | Yes | Cognito browser app client id. |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Yes | Hosted UI domain. |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI` | Yes | `https://<vercel-app>/login/callback`. |
| `NEXT_PUBLIC_COGNITO_LOGOUT_URI` | Yes | `https://<vercel-app>/login`. |
| `NEXT_PUBLIC_COGNITO_SCOPE` | Yes | Use `openid email profile`. |

Vercel commands:

- Install: `pnpm install`
- Build: `pnpm --filter @workmap/web build`

## 3. Render Backend Env

Secret/server-only config:

| Env | Required | Secret | Notes |
|---|---:|---:|---|
| `DATABASE_URL` | Yes | Yes | Supabase Postgres connection string. |
| `WORKMAP_JWT_SECRET` | Yes | Yes | Required for pilot/dev JWT compatibility. Use a long random value. |
| `WORKMAP_PILOT_PASSWORD_HASH` | Yes for pilot fallback | Yes | Keep pilot login disabled unless explicitly needed. |
| `WORKMAP_COGNITO_ISSUER` | Yes | No | Can be derived from region/user pool, but set explicitly for clarity. |
| `WORKMAP_COGNITO_REGION` | Yes | No | AWS region. |
| `WORKMAP_COGNITO_USER_POOL_ID` | Yes | No | Cognito user pool id. |
| `WORKMAP_COGNITO_APP_CLIENT_ID` | Yes | No | Cognito app client id. |
| `WORKMAP_COGNITO_COMPANY_SLUG` | Conditional | No | Use only if needed for temporary email mapping ambiguity. |
| `WORKMAP_ALLOWED_ORIGINS` | Yes | No | Comma-separated exact Vercel origin(s). Do not use `*`. |
| `WORKMAP_APP_URL` | Yes | No | Deployed Vercel app URL for invite links. |
| `WORKMAP_PLATFORM_ADMIN_EMAILS` | Required for platform admin | Sensitive | Comma-separated verified Cognito emails. |
| `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` | Optional | Sensitive | Comma-separated Cognito sub allowlist. |

Render usually provides `PORT`; local `API_PORT` remains supported.

Render commands:

- Build: `pnpm install && pnpm --filter @workmap/api build`
- Start: `pnpm --filter @workmap/api start`
- Health path: `/health`
- Readiness path: `/health/readiness`

## 4. Cognito Setup

Configure Cognito Hosted UI:

1. Create or reuse a Cognito user pool.
2. Create a browser/public app client suitable for PKCE.
3. Configure Hosted UI domain.
4. Allowed callback URL: `https://<vercel-app>/login/callback`.
5. Allowed logout URL: `https://<vercel-app>/login`.
6. Scopes: `openid email profile`.
7. Ensure pilot users have verified email.

Backend requirements:

- Backend verifies issuer, audience/client id, expiry/nbf, RS256 JWKS, and verified email.
- Platform Admin is independent from tenant OWNER and requires explicit backend allowlist env.
- Dev-token/dev-header auth must not be available in production.

## 5. Supabase / Prisma Migration Sequence

Run from `workmap/` against the target database:

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

Seed guidance:

- For a fresh local demo DB, run `pnpm prisma:seed`.
- For production alpha, seed only if you intentionally want demo/sample users and data. Real tenant onboarding can create the owner workspace.

Verify migration success:

- `GET /health` returns `200` with `status: ok`.
- `GET /health/readiness` returns `200` with `status: ready` and `database: ok`.
- Owner workspace creation works for a verified Cognito user.
- Activity ingestion accepts a registered same-user device and rejects invalid device ids.

## 6. Realtime / WSS Deployment

- Frontend derives `ws://` or `wss://` from `NEXT_PUBLIC_WORKMAP_API_URL`.
- HTTPS Render API URLs should produce WSS automatically.
- `WORKMAP_ALLOWED_ORIGINS` must include the exact Vercel origin so WebSocket origin checks pass.
- Native WebSocket sends auth token in the query string because browsers cannot set `Authorization` headers on WebSocket. Use WSS and avoid logging full query strings.
- Current realtime gateway is in-memory and single-instance. Multi-instance API deployment needs shared pub/sub before production scaling.

## 7. Activity Tracking Hardening Checklist

Expected backend behavior:

- malformed `deviceId`: controlled 400.
- cross-user or cross-tenant `deviceId`: controlled 403.
- device heartbeat for another user's device: controlled 403.
- missing/invalid `startedAt`: controlled 400.
- future timestamp beyond 5 minutes: controlled 400.
- event older than 31 days: controlled 400.
- zero/negative duration: controlled 400.
- duration over 12 hours: controlled 400.
- empty/malformed app name: controlled 400.
- malformed domain: controlled 400.
- full URL with path/query/fragment: backend reduces to hostname and stores only domain.
- batch size over 50: controlled 400.
- client-supplied `companyId`, `tenantId`, `userId`, or `role`: ignored.
- Employee `GET /reports/usage-summary?scope=company`: controlled 403.
- Owner company summary: aggregate rows only, same tenant only.
- Platform Admin: no employee-level app/domain details by default.

Manual test body examples should use local bearer tokens directly in the tester's shell or browser devtools. Do not paste bearer tokens into chat.

## 8. Alpha Smoke Checklist

Run after Vercel/Render/Supabase/Cognito env setup:

Optional public smoke helper:

```powershell
$env:WORKMAP_SMOKE_API_URL="https://<render-api>"
$env:WORKMAP_SMOKE_APP_URL="https://<vercel-app>"
$env:WORKMAP_SMOKE_ORIGIN="https://<vercel-app>"
pnpm smoke:alpha
```

This helper checks public health/readiness/CORS/page availability only. Authenticated Cognito, invite, activity, reports, and Platform Admin smoke still require manual testing with real users/tokens handled outside chat.

1. `GET <api>/health` returns ok.
2. `GET <api>/health/readiness` returns ready.
3. Owner signs in through Cognito.
4. Owner creates workspace.
5. Owner creates invite.
6. Employee signs in through Cognito and accepts invite.
7. Employee completes compliance/avatar/device setup as required.
8. Owner and Employee both open `/virtual-office`.
9. Realtime movement works both directions.
10. Polling fallback still reconciles after refresh or socket disruption.
11. People panel shows readable names/rooms.
12. Contact drawer works.
13. Employee registers a device.
14. Employee submits sample app usage.
15. Employee submits sample domain usage.
16. Employee sees own reports.
17. Owner sees allowed company aggregate reports.
18. Employee cannot access company aggregate reports.
19. Platform Admin accesses `/platform-admin`.
20. Platform Admin sees tenant metadata/health/audit only, no employee app/domain details.
21. Compliance page and modal accurately explain collected and non-collected data.
22. Dashboard loads with clear live/empty states.
23. Reports loads with clear live/empty states.
24. Employees page loads with same-tenant directory data.
25. Settings and invite pages load.
26. Cross-tenant API access attempts fail safely.
27. Secret scan finds no committed secrets.

## 9. Alpha Release Blocker Checklist

| Item | Status | Notes |
|---|---|---|
| Cognito configured | Needs manual setup | Configure Hosted UI and callback/logout URLs in AWS. |
| Supabase DB configured | Needs manual setup | Set `DATABASE_URL` in Render/Supabase. |
| Prisma migrations applied | Needs manual setup | Apply all four migrations in order. |
| Render backend deployed | Needs manual setup | Use documented build/start commands. |
| Vercel frontend deployed | Needs manual setup | Use documented build command and public env. |
| CORS configured | Needs manual setup | Set `WORKMAP_ALLOWED_ORIGINS` exactly to Vercel origin(s). |
| Callback/logout URLs configured | Needs manual setup | Must match Vercel deployment URLs. |
| Platform admin allowlist configured | Needs manual setup | Backend env only; do not commit real identities. |
| Owner onboarding smoke | Needs manual setup | Requires deployed Cognito/backend/frontend. |
| Invite smoke | Needs manual setup | Requires deployed app URL and backend. |
| Virtual-office realtime smoke | Needs manual setup | Requires deployed WSS support and two users. |
| Activity ingestion smoke | Needs manual setup | Requires registered device and bearer token. |
| Reports smoke | Needs manual setup | Requires summary rows from activity ingestion. |
| Compliance smoke | Ready for QA | Copy is implemented; verify deployed page/modal. |
| Tenant isolation smoke | Needs manual setup | Exercise wrong tenant/user ids. |
| Secret scan | Ready | Run before commit/deploy. |
| Agent status | Needs later production hardening | Harness only, not native production tracker. |
| Extension status | Needs later production hardening | Local unpacked scaffold only. |
| Offline queue/retry | Needs later production hardening | Not implemented. |
| Multi-instance realtime | Needs later production hardening | Current gateway is single-instance/in-memory. |

Current alpha recommendation:

- Codebase can proceed to controlled alpha deployment preparation after manual platform setup.
- Alpha is still blocked on external service configuration and deployed smoke.
- Desktop agent and browser extension should be positioned as explicit alpha harness/scaffold capabilities.
