# Director Update

## 1. Completed Task

STAGE 2 Round 2 Tenant Onboarding + Owner/Employee Invite Flow was completed and accepted in commit `e5d4882` (`feat: add stage 2 tenant onboarding and invites`).

## 2. Accepted Changes

- Added `User.cognitoSub`, `InvitationStatus`, and `Invitation` with hashed invite-token storage.
- Added migration `20260606000000_stage2_onboarding_invites`.
- Added Cognito-only guard/decorator/identity helper for verified Cognito users without existing WorkMap mapping.
- Added tenant onboarding APIs for status and owner workspace creation.
- Owner workspace creation now creates company, General department, OWNER user, default office map/rooms, owner position, and default monitoring policy.
- Added owner-scoped invite list/create APIs and Cognito-only invite acceptance.
- Invite acceptance validates token hash, status, expiration, verified email match, and cross-tenant identity conflicts.
- Added frontend owner workspace creation, owner invite UI, employee invite acceptance page, pending invite token storage, and API helpers.
- Fixed QA findings: invite acceptance routes through onboarding, invite page avoids hydration mismatch, callback preserves pending invite routing, and new owner spawn uses non-blocked `x=160`, `y=545`.

## 3. Verification Summary

Reported passing from `workmap/`:

- `pnpm prisma:generate`
- `pnpm exec prisma migrate dev --skip-seed`
- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

QA reports secret scan passed with no real committed secrets.

Manual QA passed for owner workspace creation, invite creation/listing, fresh invite link in InPrivate without hydration overlay, Cognito invite callback routing, employee invite acceptance through compliance/avatar/device onboarding, wrong-email rejection, invalid/already accepted invite handling, non-OWNER invite denial, pilot login fallback, Dashboard, Reports, Compliance, and virtual-office rendering.

Owner default spawn was verified at approximately `x=160`, `y=545` and movable.

## 4. Remaining Risks

- This is a minimal bridge, not the final SaaS identity/membership architecture.
- One Cognito account maps to one WorkMap company user; multi-company membership is not supported yet.
- No real invite email sending exists; invite links are shown/copyable in the Owner UI.
- `WORKMAP_APP_URL` should be set server-side in deployment so invite links do not fall back to localhost.
- Existing test workspaces created before the spawn fix may still need cleanup/recreation.
- Remote users still update through polling and may appear as position jumps; no websocket/SSE was added.
- Backend avatar/profile sync is not implemented, so remote Cognito users can show fallback markers.
- Real Vercel/Render/Cognito deployed smoke remains pending.
- `docs/references/` remains unrelated untracked reference material.

## 5. Updated Docs

- `docs/skills/current-status.md`
- `docs/skills/backend-skill.md`
- `docs/skills/api-contract-skill.md`
- `docs/skills/auth-skill.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/frontend-skill.md`
- `docs/skills/data-model-skill.md`
- `docs/skills/realtime-presence-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/project-summary.md`
- `docs/skills/decision-log.md`
- `docs/ai-handoff/director-update.md`

## 6. Recommended Next Tasks

- Design global identity/account plus `CompanyMembership` or `TenantMembership` migration.
- Add real invitation email delivery, resend, and revoke flows.
- Add backend avatar/profile persistence for remote user rendering.
- Add strict multi-tenant/RBAC automated tests around onboarding, invites, reports, compliance, virtual office, and integrations.
- Configure deployed env values and run Vercel/Render/Cognito smoke.
