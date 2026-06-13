# Latest QA Handoff

## 1. Overall Conclusion

QA review result: STAGE 2 Round 9 deployed alpha smoke updates pass final QA review.

Final Round 9 conclusion:

- WorkMap is an Alpha Ready Candidate for a controlled 5-person pilot.
- This conclusion is based on code review, machine verification, non-secret smoke helper checks, and human-reported deployed smoke pass on 2026-06-13.
- This is not full production readiness.

No blocking issue requiring Codex Chat 2 was found.

## 2. Reviewed Inputs

This pass reviewed:

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/real-alpha-deployment-smoke.md`
- current `git status --short`
- current `git diff --stat`
- current implementation diff
- `workmap/scripts/real-alpha-smoke.mjs`
- `workmap/package.json`
- `workmap/.env.example`
- `docs/ai-handoff/alpha-production-readiness.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/current-status.md`

Workspace notes:

- `.env` was not read.
- `docs/references/` remains unrelated untracked workspace content. Do not stage it unless explicitly intended.
- `workmap/pnpm-lock.yaml` exists, is tracked, and `git check-ignore -v workmap/pnpm-lock.yaml` returns no ignore rule.
- `workmap/apps/web/tsconfig.tsbuildinfo` was modified by Web build and restored.

## 3. Diff Review

Result: passed.

Smoke helper:

- `pnpm smoke:alpha` is wired to `node scripts/real-alpha-smoke.mjs`.
- Helper reads only process environment variables and does not read `.env`.
- Helper requires `WORKMAP_SMOKE_API_URL` and `WORKMAP_SMOKE_APP_URL`.
- Helper optionally accepts `WORKMAP_SMOKE_ORIGIN`.
- Helper rejects localhost/127.0.0.1/::1 by default unless `WORKMAP_SMOKE_ALLOW_LOCAL=1`.
- Helper checks API `/health`.
- Helper checks API `/health/readiness`.
- Helper checks CORS response for the configured browser Origin.
- Helper checks frontend `/`, `/login`, `/virtual-office`, and `/platform-admin`.
- Helper derives `/virtual-office/realtime` as WSS for HTTPS API origins.
- Helper does not automate or print Cognito credentials, bearer tokens, invite tokens, tenant secrets, activity secrets, or Platform Admin identifiers.

Docs/runbook:

- `docs/ai-handoff/real-alpha-deployment-smoke.md` now records status as Alpha Ready Candidate.
- Deployed smoke pass is recorded as human-reported evidence without real URLs, tokens, or admin identities.
- Supabase, Render, Vercel, Cognito, CORS/WSS, Platform Admin, activity, reports, and compliance smoke statuses are documented.
- Remaining future hardening is clearly separated from alpha-blocking status.
- `docs/skills/current-status.md` now reflects the 2026-06-13 deployed smoke pass.
- `docs/skills/deployment-skill.md` documents `pnpm smoke:alpha` and `WORKMAP_SMOKE_*` usage.
- `docs/ai-handoff/alpha-production-readiness.md` links to the Round 9 smoke helper/runbook.

Scope control:

- No backend controllers/services were changed in this Round 9 smoke diff.
- No frontend product flows were changed.
- No Prisma schema or migration was added.
- No auth/realtime/activity logic was changed.
- No desktop-agent or browser-extension behavior was changed.

## 4. Deployed Smoke Evidence

Accepted human-reported deployed smoke pass on 2026-06-13:

- Supabase DB configured and migrated.
- Prisma deployed migrations applied.
- Render API deployed.
- Render `/health` passed.
- Render `/health/readiness` passed.
- Vercel frontend deployed.
- Cognito Hosted UI callback/logout configured for deployed domain.
- `pnpm smoke:alpha` passed against deployed public URLs.
- Approved-origin CORS passed.
- Two-user WSS/virtual-office smoke passed.
- Owner onboarding passed.
- Owner invite creation passed.
- Employee Cognito accept/onboarding passed.
- People/contact surfaces passed.
- Platform Admin privacy boundary passed.
- Tenant OWNER and EMPLOYEE were blocked from Platform Admin.
- Employee device registration passed.
- Employee app/domain sample activity submission passed.
- Employee own report passed.
- Owner company aggregate report passed.
- Employee company-scope report block passed.

Deployed smoke items still best treated as future hardening, not current blockers:

- Automated negative tests for cross-user/cross-tenant device ids.
- Automated malformed/future timestamp checks.
- Automated overlong duration checks.
- Automated malformed domain and full URL minimization checks.
- Automated batch-size limit checks.
- Automated unapproved-origin CORS negative check.

## 5. Security / Secret Review

Result: passed.

- No real secret was found in reviewed implementation files.
- `.env.example` adds only blank/public `WORKMAP_SMOKE_*` placeholders.
- No AWS, Cognito, Supabase, Render, Vercel, database, JWT, platform admin, bearer, desktop-agent, or browser-extension secret was hardcoded.
- Smoke helper does not ask for or print bearer tokens.
- Smoke helper output examples use placeholders such as `https://<api>.onrender.com` and `https://<app>.vercel.app`.
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, and `docs/references/` returned no matches.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
node --check scripts/real-alpha-smoke.mjs
pnpm smoke:alpha
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/desktop-agent typecheck
pnpm --filter @workmap/browser-extension typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/desktop-agent lint
pnpm --filter @workmap/browser-extension lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
pnpm --filter @workmap/desktop-agent build
pnpm --filter @workmap/browser-extension build
pnpm prisma:generate
git diff --check
git check-ignore -v workmap/pnpm-lock.yaml
```

Results:

- Smoke helper syntax check passed.
- `pnpm smoke:alpha` with no current-process deployed env returned Manual Action Required as expected and did not pretend smoke passed.
- API typecheck passed.
- Web typecheck passed.
- Desktop-agent typecheck passed.
- Browser-extension typecheck passed.
- API lint passed.
- Web lint passed.
- Desktop-agent lint passed.
- Browser-extension lint passed.
- API build passed.
- Web build passed; existing Next.js ESLint plugin warning remains.
- Browser-extension build passed.
- Desktop-agent build initially failed inside the sandbox with Windows `EPERM` writing `apps/desktop-agent/dist/index.js`; rerun outside the sandbox passed.
- `pnpm prisma:generate` initially failed inside the sandbox because Prisma binary checksum access was blocked/redirected to `127.0.0.1:9`; rerun outside the sandbox passed.
- `git diff --check` passed with CRLF normalization warnings only.
- `git check-ignore -v workmap/pnpm-lock.yaml` returned no ignore rule, as expected.

## 7. Manual Action / Operational Follow-Up

Current alpha status:

- No code-blocking Manual Action Required remains for Round 9.
- Operational discipline is still required: keep `DATABASE_URL`, JWT/pilot secrets, bearer tokens, platform admin emails/subs, and provider credentials only in provider/local secret stores.

Before inviting the full 5-person pilot:

1. Confirm current deployed Render/Vercel env values still match the latest deployment.
2. Confirm Cognito callback/logout URLs remain aligned with the deployed Vercel production URL.
3. Confirm Render `WORKMAP_ALLOWED_ORIGINS` exactly matches the approved Vercel origin(s).
4. Run `pnpm smoke:alpha` once more immediately before pilot start.
5. Keep an eye on Render logs for WSS query-token logging and avoid retaining full socket query strings.

## 8. Residual Risks / Notes

- Alpha Ready Candidate does not mean full production readiness.
- Desktop-agent remains a harness/scaffold, not a production active-window app.
- Browser extension remains a local MV3 scaffold, not store-ready.
- Realtime gateway remains single-instance/in-memory.
- No durable offline queue, retry/backoff, token revocation, secure production pairing UX, or multi-instance realtime pub/sub was added.
- Smoke helper does not enforce HTTPS for non-local remote URLs; deployed alpha smoke must use HTTPS/WSS platform URLs.
- Broader automated negative security tests remain future hardening.
- `docs/references/` remains unrelated untracked content and should not be staged.

## 9. Final Recommendation

- QA review: passed for final Round 9 deployed alpha smoke updates.
- Return to Codex Chat 2: not required.
- Can proceed to controlled 5-person alpha pilot: yes.
- Suggested commit: yes for the Round 9 smoke helper/runbook/final QA docs.
