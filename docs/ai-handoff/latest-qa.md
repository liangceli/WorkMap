# Latest QA Handoff

## 1. Overall Conclusion

QA review result: STAGE 2 Round 8 alpha production readiness passes code review and machine verification.

This pass reviewed:

- `docs/ai-handoff/latest-implementation.md`
- current `git status --short`
- current `git diff --stat`
- current implementation diff
- API CORS allowlist hardening
- WebSocket origin allowlist hardening
- `/health` and `/health/readiness`
- alpha deployment documentation
- `.env.example` secret posture
- desktop-agent/browser-extension alpha harness build health

No blocking issue requiring Codex Chat 2 was found.

Important readiness distinction:

- Code/docs are ready to proceed toward controlled alpha deployment preparation.
- Deployed alpha readiness is not yet proven until Vercel, Render, Supabase, and Cognito are manually configured and the deployed smoke checklist passes.

## 2. Workspace Notes

Reviewed tracked files include:

- `docs/ai-handoff/latest-implementation.md`
- `docs/skills/current-status.md`
- `docs/skills/deployment-skill.md`
- `workmap/.env.example`
- `workmap/apps/api/src/main.ts`
- `workmap/apps/api/src/modules/health/health.controller.ts`
- `workmap/apps/api/src/modules/virtual-office/virtual-office-realtime.gateway.ts`

Reviewed untracked implementation files include:

- `docs/ai-handoff/alpha-production-readiness.md`
- `workmap/apps/api/src/config/allowed-origins.ts`

Workspace notes:

- `docs/references/` remains unrelated untracked workspace content. Do not stage it unless explicitly intended.
- `.env` was not read.
- `pnpm prisma:generate` printed that env vars were loaded, but no values were output.
- `workmap/apps/web/tsconfig.tsbuildinfo` was modified by Web build and restored.
- Desktop/browser extension build outputs did not appear in `git status`.

## 3. Diff Review

Result: passed.

HTTP CORS:

- `workmap/apps/api/src/config/allowed-origins.ts` centralizes allowed origin parsing.
- Preferred env is `WORKMAP_ALLOWED_ORIGINS`.
- `WORKMAP_ALLOWED_ORIGIN` remains a backward-compatible fallback.
- `NEXT_PUBLIC_APP_URL` is only a final backend fallback.
- Localhost origins are auto-added only outside production.
- In production, configured browser origins are required; otherwise browser origins are rejected.
- Missing `Origin` remains allowed for non-browser/server-to-server style requests such as health checks.

WebSocket origin checks:

- `virtual-office-realtime.gateway.ts` now uses the shared `isAllowedOrigin` helper.
- Browser WebSocket origins must match the same production allowlist as HTTP CORS.
- Existing token, room, position, and polling/reconciliation logic was not rewritten.

Health/readiness:

- `GET /health` remains a lightweight liveness endpoint.
- `GET /health/readiness` runs a Prisma `SELECT 1`.
- Readiness returns safe status/check fields only.
- DB failure returns `503 ServiceUnavailableException`.
- No connection string, database host, token, or secret value is returned.
- `PrismaService` injection is valid because `PrismaModule` is imported by `AppModule` and marked global.

Deployment docs:

- `docs/ai-handoff/alpha-production-readiness.md` covers Vercel, Render, Supabase, Cognito, migration order, WSS, activity hardening, alpha smoke, and release blockers.
- `docs/skills/deployment-skill.md` now points to the alpha readiness guide and includes `/health/readiness`, `WORKMAP_ALLOWED_ORIGINS`, and migration-order guidance.
- `docs/skills/current-status.md` accurately marks external setup and deployed smoke as Manual Action Required.

Scope control:

- No billing, map expansion, production desktop tracker, browser extension store packaging, durable queueing, multi-instance realtime, or product redesign was added.
- Round 8 did not add a Prisma migration.

## 4. Security / Secret Review

Result: passed.

- No real secret was found in reviewed implementation files.
- `.env.example` uses placeholders, localhost values, blank harness variables, and sample/local-only values.
- No AWS, Cognito, Supabase, Render, Vercel, WorkMap agent token, or browser extension auth token was hardcoded.
- `WORKMAP_PLATFORM_ADMIN_EMAILS` and `WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS` remain blank in `.env.example`.
- Production CORS documentation says to use exact origins and not `*`.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches.

## 5. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
pnpm --filter @workmap/desktop-agent typecheck
pnpm --filter @workmap/browser-extension typecheck
pnpm --filter @workmap/desktop-agent lint
pnpm --filter @workmap/browser-extension lint
pnpm --filter @workmap/desktop-agent build
pnpm --filter @workmap/browser-extension build
pnpm prisma:generate
git diff --check
```

Results:

- API typecheck passed.
- Web typecheck passed.
- API lint passed.
- Web lint passed.
- API build passed.
- Web build passed.
- Desktop-agent typecheck passed.
- Browser-extension typecheck passed.
- Desktop-agent lint passed.
- Browser-extension lint passed.
- Desktop-agent build initially failed inside the sandbox with Windows `EPERM` writing `dist/index.js`; rerun outside the sandbox passed.
- Browser-extension build passed.
- `pnpm prisma:generate` initially failed inside the sandbox because Prisma binary checksum access was blocked/redirected to `127.0.0.1:9`; rerun outside the sandbox passed.
- `git diff --check` passed with CRLF normalization warnings only.
- Web build still prints the existing Next.js ESLint plugin warning.

Not run:

- No real deployed Vercel/Render/Supabase/Cognito smoke.
- No live deployed `/health` or `/health/readiness` smoke.
- No live deployed Cognito owner/invite/employee/platform-admin flow.
- No live deployed WSS smoke.
- No live invalid-input activity hardening requests in this QA chat.

## 6. Manual Action Required

Before claiming deployed alpha readiness:

1. Configure Supabase Postgres and set `DATABASE_URL` securely in Render.
2. Apply Prisma migrations in the documented order:
   `20260529043117_v1`,
   `20260606000000_stage2_onboarding_invites`,
   `20260607000000_platform_audit_log`,
   `20260609000000_stage2_activity_source`.
3. Configure AWS Cognito Hosted UI, PKCE app client, callback URL, logout URL, and scopes.
4. Configure Vercel public env values.
5. Configure Render backend env values.
6. Set `WORKMAP_ALLOWED_ORIGINS` to exact Vercel origin(s).
7. Set `WORKMAP_APP_URL` to the deployed frontend URL.
8. Configure platform admin allowlist env values in backend platform settings only.
9. Verify deployed `GET /health`.
10. Verify deployed `GET /health/readiness`.
11. Run the full alpha smoke checklist in `docs/ai-handoff/alpha-production-readiness.md`.
12. Run a final secret scan before commit/deploy.

Do not guess external platform values and do not paste real tokens into chat.

## 7. Manual QA Guidance

Use `docs/ai-handoff/alpha-production-readiness.md` as the source of truth.

Minimum deployed alpha smoke:

1. API `/health` returns ok.
2. API `/health/readiness` returns ready.
3. Owner signs in through Cognito.
4. Owner creates workspace.
5. Owner creates invite.
6. Employee signs in through Cognito and accepts invite.
7. Employee completes compliance/avatar/device setup as required.
8. Owner and Employee both open `/virtual-office`.
9. Realtime movement works both directions.
10. Polling fallback reconciles after refresh or socket disruption.
11. Employee registers a device and submits sample app/domain usage.
12. Employee sees own reports.
13. Owner sees allowed company aggregate reports.
14. Employee is blocked from company aggregate reports.
15. Platform Admin sees tenant metadata/health/audit only.
16. Compliance page/modal accurately explain collected and non-collected data.
17. Dashboard, Reports, Employees, Settings, Invites, and Integrations load.
18. Cross-tenant and invalid activity requests fail safely.

## 8. Residual Risks / Notes

- Alpha deployment remains blocked on external service configuration and deployed smoke.
- Desktop-agent is still a harness/scaffold, not production active-window tracking.
- Browser extension is a local Manifest V3 scaffold, not packaged/store-ready.
- No durable offline queue, retry/backoff, token revocation flow, or native installer was added.
- Realtime gateway is still in-memory and single-instance.
- Missing-origin WebSocket/server requests are allowed by the shared origin helper; browser-origin requests are still checked. Keep WSS enabled and avoid logging query-token URLs.
- Production `WORKMAP_ALLOWED_ORIGINS` must be configured exactly or browser HTTP/WSS access will fail.
- `docs/references/` remains unrelated untracked content and should not be staged.

## 9. Final Recommendation

- QA review: passed for Round 8 code/docs.
- Return to Codex Chat 2: not required.
- Can proceed to human/manual testing: yes, specifically deployed alpha smoke and external platform setup.
- Suggested commit: yes for the Round 8 readiness code/docs after reviewing the QA notes; do not claim deployed alpha readiness until Manual Action Required items pass.
