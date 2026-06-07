# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 2: Full Tenant Onboarding + Owner/Employee Invite Flow.

Implement the local/full product foundation for:

Owner sign up / Cognito auth -> WorkMap creates company/workspace -> Owner becomes OWNER -> Owner invites employees -> employees sign in/sign up through Cognito -> employees accept invite and join the correct tenant.

Confirmed implementation boundary:

- Use the minimal safe bridge for this round.
- Continue using `Company` as tenant/workspace.
- Continue using existing `User.companyId + User.role` as the company-scoped member profile.
- Add stable Cognito mapping with `User.cognitoSub`.
- Add invitation storage with hashed invite tokens.
- Do not perform the full global identity/account + `CompanyMembership`/`TenantMembership` migration in this round.
- Keep pilot/dev fallback.
- Do not troubleshoot Render/Vercel deployment.
- Do not change virtual-office map/movement/chair/contact drawer behavior.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/prisma/schema.prisma` | Added `User.cognitoSub`, `InvitationStatus`, and `Invitation` for the minimal tenant onboarding bridge. |
| `workmap/prisma/migrations/20260606000000_stage2_onboarding_invites/migration.sql` | Adds the DB migration for Cognito subject mapping and hashed-token invitations. |
| `workmap/packages/auth/src/index.ts` | Added optional Cognito `name` claim typing. |
| `workmap/apps/api/src/app.module.ts` | Registered tenant onboarding and invitations modules. |
| `workmap/apps/api/src/modules/auth/auth.module.ts` | Registered/exported the new Cognito-only guard. |
| `workmap/apps/api/src/modules/auth/auth.service.ts` | Updated Cognito mapping to prefer `cognitoSub`, bind a unique legacy email match, and reject cross-company Cognito sub conflicts. |
| `workmap/apps/api/src/modules/auth/cognito-identity.ts` | Shared verified Cognito identity/email helper for onboarding and invite acceptance. |
| `workmap/apps/api/src/modules/auth/cognito-only.guard.ts` | Allows Cognito-authenticated users without existing WorkMap user mapping to call onboarding/invite acceptance APIs. |
| `workmap/apps/api/src/modules/auth/current-cognito.decorator.ts` | Exposes the verified Cognito payload to Cognito-only controllers. |
| `workmap/apps/api/src/modules/tenant-onboarding/**` | Adds backend status/workspace creation endpoints for Cognito users. |
| `workmap/apps/api/src/modules/invitations/**` | Adds owner-scoped invitation list/create and Cognito invite acceptance endpoints. |
| `workmap/apps/web/lib/api/apiTypes.ts` | Added tenant onboarding, company, and invitation API response types. |
| `workmap/apps/web/lib/api/companiesApi.ts` | Added frontend helper for current company summary. |
| `workmap/apps/web/lib/api/tenantOnboardingApi.ts` | Added frontend helpers for onboarding status/workspace creation. |
| `workmap/apps/web/lib/api/invitationsApi.ts` | Added frontend helpers for invitation list/create/accept. |
| `workmap/apps/web/lib/auth/pendingInvite.ts` | Stores an invite token while the employee completes Cognito sign-in. |
| `workmap/apps/web/app/login/callback/page.tsx` | Routes Cognito users to existing workspace, pending invite, or owner workspace setup. |
| `workmap/apps/web/app/onboarding/company/page.tsx` | Creates the backend company/workspace and OWNER user when a Cognito session exists; keeps demo fallback. |
| `workmap/apps/web/app/onboarding/invite/page.tsx` | Adds practical Owner invite-link UI. |
| `workmap/apps/web/app/invite/[token]/page.tsx` | Adds employee invite acceptance flow. |
| `workmap/apps/web/components/layout/AppShell.tsx` | Shows backend-resolved workspace, user, role, and session source when API auth is available; adds Owner invite nav. |
| `workmap/apps/web/components/login/MockLoginPanel.tsx` | Cognito continue flow now routes to workspace, pending invite, or workspace setup instead of assuming `/virtual-office`. |
| `workmap/apps/web/lib/auth/pilotSession.ts` | Pilot backend sessions now mark `hasCompany: true` so existing company users do not re-enter owner company setup. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified by this implementation.

## 3. Implementation Summary

Implemented the minimal safe bridge for tenant onboarding and invitations:

- `Company` remains the tenant/workspace model.
- Existing `User` remains the company-scoped member profile.
- `User.cognitoSub` is now the stable Cognito identity mapping.
- Existing email-only Cognito mapping is preserved only as a one-time compatibility bridge when exactly one legacy WorkMap user matches the verified Cognito email.
- A Cognito account is restricted to one WorkMap company user in this bridge. If the same Cognito sub or verified email points to another company, the backend rejects the flow instead of silently creating cross-company identity.
- Owner workspace creation creates a company, General department, OWNER user, default office map/rooms, default owner position, and default monitoring policy.
- Owner invite creation stores only a SHA-256 token hash in the DB and returns the plain invite link once to the UI.
- Employee invite acceptance verifies Cognito JWT, verified email, invite token hash, invite status, invite expiration, and email match before creating/binding the user in the invite's company.

## 4. User-Visible Changes

- New Cognito owner users who are not mapped to an existing WorkMap user are routed to `/onboarding/company`.
- Owner workspace creation now creates a real backend company/workspace and OWNER user instead of only local demo state.
- Owners can open `/onboarding/invite`, create invite links, and see recent tenant-scoped invitations.
- Employees can open `/invite/:token`, sign in with Cognito if needed, and accept the invite into the correct tenant.
- AppShell now shows backend-resolved company, user, role, and session source when API auth is available.
- Pilot login remains available and now treats pilot users as already belonging to their seeded company.

## 5. Technical Notes

- Minimal bridge chosen intentionally to avoid a broad/risky migration across the many existing models that directly reference `User` and `companyId`.
- Long-term architecture should introduce a global identity/account model plus `CompanyMembership` or `TenantMembership`, then gradually move tenant-scoped permissions and feature data to that model.
- This round does not send real emails. Invite links are shown/copyable in the Owner UI.
- Invite token plaintext is not stored in the database.
- New backend endpoints:
  - `GET /tenant-onboarding/status`
  - `POST /tenant-onboarding/workspace`
  - `GET /invitations`
  - `POST /invitations`
  - `POST /invitations/accept`
- `GET/POST /invitations` use `RequestContextGuard + RolesGuard` and require OWNER.
- `POST /invitations/accept` uses `CognitoOnlyGuard` so an unmapped Cognito employee can accept an invite.
- New workspace setup creates enough default virtual-office/compliance data for existing pages to keep working.
- No virtual-office movement, collision, pathfinding, TMX rendering, chair interaction, contact drawer, websocket, polling, Prisma seed, Render, or Vercel deployment code was changed.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm prisma:generate
pnpm exec prisma migrate dev --skip-seed
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
pnpm lint
pnpm typecheck
pnpm build
```

Results:

- `pnpm prisma:generate` initially failed in the sandbox because Prisma engine download/access was blocked by `ECONNREFUSED 127.0.0.1:9`.
- Existing WorkMap node dev processes were stopped because they were locking the Prisma engine DLL.
- `pnpm prisma:generate` then passed outside the sandbox.
- `pnpm exec prisma migrate dev --skip-seed` initially hit the same sandbox Prisma engine issue, then passed outside the sandbox.
- Migration `20260606000000_stage2_onboarding_invites` was applied to the local PostgreSQL `workmap` database.
- API lint/typecheck/build passed.
- Web lint/typecheck/build passed.
- Monorepo lint/typecheck/build passed.
- Web build still prints the existing warning that the Next.js plugin is not detected in the ESLint config.

Manual Cognito browser verification was not completed in this chat because it requires the human's local Cognito user/test accounts and Hosted UI interaction.

## 7. Manual QA Suggestions

Use local ports consistently:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`

Suggested checks:

1. Start API and Web locally after migration.
2. Confirm `GET /health` works.
3. Sign in with a new verified Cognito owner account.
4. Confirm the callback routes to `/onboarding/company`.
5. Create a workspace.
6. Confirm the owner lands on `/onboarding/invite`.
7. Confirm AppShell shows the new workspace/company, user, OWNER role, and Cognito session source.
8. Create an employee invite and copy the invite link.
9. Open the invite link in a clean/incognito browser.
10. Sign in/sign up with Cognito using the invited verified email.
11. Accept the invite.
12. Confirm the employee lands in the correct workspace and role.
13. Confirm a wrong verified email cannot accept the invite.
14. Confirm an expired/already accepted/invalid invite fails safely.
15. Confirm a non-OWNER cannot `POST /invitations`.
16. Confirm an Owner cannot list/manage another company's invites by changing client-side values.
17. Confirm `/virtual-office`, position save/restore, polling presence, People panel, contact drawer, dashboard, reports, compliance, and pilot login fallback still work.

## 8. Risks / Notes

- This is a minimal safe bridge, not the final SaaS identity architecture.
- Current limitation: one Cognito account temporarily maps to one WorkMap company user.
- Multi-company membership per identity is intentionally not supported yet.
- Full Strict Multi-Tenant Data Isolation + RBAC still needs a broader audit of every company/user-scoped endpoint and data model.
- No deployed Render/Vercel smoke was run; deployment troubleshooting remains postponed.
- No real email sending is implemented.
- Manual Cognito QA still needs real local Cognito users and verified emails configured outside chat.
- The local database migration was applied successfully; teammates will need to run the migration in their own local DB.
- If a Cognito email already exists in multiple company-scoped legacy users, the backend rejects mapping and requires manual cleanup.
- `docs/references/` is unrelated untracked workspace content.

## 9. Docs Update Suggestions

- `docs/skills/current-status.md`: record that STAGE 2 Round 2 now has minimal bridge tenant onboarding and invite acceptance.
- `docs/skills/backend-skill.md`: document Cognito `sub` mapping, `CognitoOnlyGuard`, and invite hash/status/expiration validation.
- `docs/skills/api-contract-skill.md`: add the new onboarding and invitation endpoint contracts.
- `docs/skills/deployment-skill.md`: note the new migration and future deployment migration step, while Render/Vercel troubleshooting remains deferred.
- `docs/skills/project-summary.md`: record the current limitation and future target architecture: global identity/account + `CompanyMembership`/`TenantMembership`.

## 10. QA Follow-up Fix: Invite Acceptance Onboarding + Hydration

Original QA findings from `docs/ai-handoff/latest-qa.md`:

- Employee invite acceptance routed directly to `/virtual-office`, bypassing the existing onboarding/avatar workflow.
- Invite acceptance page could show a Next hydration mismatch because the first render branched on Cognito session state from browser storage.

Changed files for this follow-up:

| File | Why it changed |
|---|---|
| `workmap/apps/api/src/modules/invitations/invitations.service.ts` | Changed invite acceptance advisory `onboarding.nextRoute` from `/virtual-office` to `/compliance` so the API no longer advertises direct map entry after accepting an invite. |
| `workmap/apps/web/app/invite/[token]/page.tsx` | Moved Cognito session detection out of render and into `useEffect`, added stable initial `Checking invitation...` UI, and routes accepted users through `getNextRouteForUser(nextState)` after saving workflow state. |
| `docs/ai-handoff/latest-implementation.md` | Recorded this QA follow-up fix and verification results. |

Implementation details:

- The invite page now starts with `cognitoAuth` as `null`, so server render and first client render are stable.
- After client mount, the page reads Cognito session state and switches to either sign-in or accept mode.
- After successful accept, the page creates the normal frontend workflow state from the accepted user's role, forces `hasCompany: true`, saves it, and routes with `getNextRouteForUser(nextState)`.
- For invited `EMPLOYEE`, the existing workflow sends the user to required onboarding steps instead of directly to `/virtual-office`.
- Owner onboarding, Cognito mapping, pilot fallback, virtual-office map/movement behavior, Dashboard, Reports, and Compliance were not otherwise changed.

Verification run after this follow-up:

```powershell
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
```

Results:

- API lint/typecheck/build passed.
- Web lint/typecheck passed.
- Web build initially failed once with `PageNotFoundError: Cannot find module for page: /onboarding/avatar` while collecting page data. The page file existed and was not modified by this follow-up.
- Cleared `apps/web/.next` after verifying the path was inside the repo, then reran `pnpm --filter @workmap/web build`.
- Web build passed after clearing `.next`.
- Web build still prints the existing Next ESLint plugin warning.

Manual QA suggestions for this follow-up:

- Open an invite link with no Cognito session and confirm there is no hydration overlay.
- Open an invite link with an existing Cognito session and confirm there is no hydration overlay.
- Accept an employee invite and confirm the employee is routed to the existing onboarding flow, not directly to `/virtual-office`.
- Complete the onboarding steps and confirm `/virtual-office` still works after onboarding.
- Confirm owner invite creation, pilot login fallback, Dashboard, Reports, and Compliance still render.

## 11. QA Follow-up Fix: Cognito Callback Pending Invite Routing

Original QA finding from `docs/ai-handoff/latest-qa.md`:

- `workmap/apps/web/app/login/callback/page.tsx` still routed mapped Cognito users directly to `/virtual-office`.
- This could bypass a pending invite token when the Cognito account was already mapped.
- It could also bypass local workflow routing for mapped employees in a fresh browser/session.

Changed files for this follow-up:

| File | Why it changed |
|---|---|
| `workmap/apps/web/app/login/callback/page.tsx` | Checks `getPendingInviteToken()` before mapped-user navigation, routes pending invites back to `/invite/:token`, and routes normal mapped Cognito users via `getNextRouteForUser(nextState)` after saving setup state with `hasCompany: true`. |
| `docs/ai-handoff/latest-implementation.md` | Recorded this callback routing follow-up and verification results. |

Implementation details:

- Pending invite token now has priority after Cognito redirect, even when `/auth/me` maps successfully.
- Normal mapped Cognito users now save `nextState = { ...getDefaultSetupState(toWorkflowRole(role)), hasCompany: true }`.
- Callback then routes with `getNextRouteForUser(nextState)` instead of hardcoding `/virtual-office`.
- This keeps callback behavior aligned with `MockLoginPanel.continueCognito()` and invite acceptance routing.
- No backend/API/shared code was changed in this follow-up.
- Owner onboarding, invite acceptance, pilot fallback, and virtual-office behavior were otherwise left unchanged.

Verification run after this follow-up:

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
```

Results:

- Web lint passed.
- Web typecheck passed.
- Web build passed.
- Web build still prints the existing Next ESLint plugin warning.
- `workmap/apps/web/tsconfig.tsbuildinfo` was restored after verification so it is not part of the implementation diff.

Manual QA suggestions for this follow-up:

- Start from an invite link, complete Cognito sign-in with an already mapped Cognito account, and confirm callback returns to `/invite/:token`.
- Confirm wrong-email invite acceptance reaches the invite page/backend rejection instead of silently opening an unrelated mapped workspace.
- Sign in as a mapped employee in a fresh browser/session and confirm callback follows the existing onboarding workflow route instead of directly opening `/virtual-office`.
- Reconfirm normal mapped Owner/Manager login still routes according to existing workflow state.

## 12. QA Follow-up Fix: Owner Default Spawn Collision

Original QA finding from `docs/ai-handoff/latest-qa.md`:

- After an owner created a new workspace and entered `/virtual-office`, the owner spawned in a blocked/colliding location and could not walk out.
- QA suspected the new tenant default position created by `createDefaultWorkspaceData()` at `x: 160, y: 160`.

Changed files for this follow-up:

| File | Why it changed |
|---|---|
| `workmap/apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts` | Changed new workspace owner default `VirtualOfficePosition` from `160,160` to `160,545`, matching the frontend local default player spawn. |
| `docs/ai-handoff/latest-implementation.md` | Recorded this owner spawn collision follow-up and verification results. |

Implementation details:

- Added `DEFAULT_OWNER_SPAWN = { x: 160, y: 545 }`.
- New owner workspace default position now uses that constant.
- The coordinate matches the existing `OfficeMap.tsx` local fallback player position.
- A local TMX collision check using the same collision layer names and player-radius sample points as `OfficeMap.tsx` showed:
  - `160,160` is blocked.
  - `160,545` is not blocked.
  - `500,500` is also not blocked, but `160,545` was chosen because it keeps backend-created owners aligned with the existing frontend default spawn.
- No virtual-office map assets, pathfinding, collision logic, movement code, chair interaction, contact drawer, websocket/SSE, Cognito/invite/auth flow, membership model, or deployment code was changed.

Verification run after this follow-up:

```powershell
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
```

Results:

- API lint passed.
- API typecheck passed.
- API build passed.
- Web verification was not rerun because no web code changed in this follow-up.

Manual QA suggestions for this follow-up:

- Create a fresh owner workspace.
- Complete onboarding into `/virtual-office`.
- Confirm the owner spawns at approximately `x: 160, y: 545`.
- Confirm the owner can move away with WASD/arrow keys.
- Confirm employee invite/onboarding flow still reaches `/virtual-office`.
- Confirm Dashboard, Reports, and Compliance still render.
