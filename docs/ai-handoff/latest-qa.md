# Latest QA Handoff

## 1. Overall Conclusion

QA review result: STAGE 2 Round 3 final QA passes.

This pass reviewed:

- `docs/ai-handoff/latest-implementation.md`
- current `git status --short`
- current `git diff --stat`
- current tracked implementation diff
- untracked implementation files:
  - `workmap/apps/web/lib/auth/displayName.ts`
  - `workmap/apps/web/lib/avatar/avatarProfile.ts`

The final OWNER avatar asymmetry appears addressed in code:

1. OWNER default workflow no longer treats avatar as complete without backend avatar/profile confirmation.
2. Fresh OWNER workspace creation routes to `/onboarding/avatar` when backend `User.avatarId` has no valid `layered:v2:` avatar reference.
3. OWNER re-login / Cognito Continue reads `/users/me`; if backend avatar exists, it is cached and avatar onboarding is skipped.
4. `OfficeMap` decodes backend avatar references for current user and remote players, so EMPLOYEE can see OWNER's real layered avatar once OWNER has completed backend avatar/profile setup and saved/appeared in office position data.
5. OWNER still sees EMPLOYEE's real layered avatar through the same backend-backed `avatarId` path.

No new blocking code issue was found in this QA pass.

Final manual browser retest was completed by the user and passed for the final OWNER avatar/profile scenario.

## 2. Current Workspace Snapshot

Tracked implementation files reviewed:

- `docs/ai-handoff/latest-implementation.md`
- `workmap/packages/auth/src/index.ts`
- `workmap/apps/api/src/modules/integrations/integrations.service.ts`
- `workmap/apps/api/src/modules/invitations/invitations.service.ts`
- `workmap/apps/api/src/modules/reports/reports.service.ts`
- `workmap/apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts`
- `workmap/apps/api/src/modules/users/users.controller.ts`
- `workmap/apps/api/src/modules/users/users.service.ts`
- `workmap/apps/api/src/modules/virtual-office/virtual-office.service.ts`
- `workmap/apps/web/app/employees/page.tsx`
- `workmap/apps/web/app/invite/[token]/page.tsx`
- `workmap/apps/web/app/login/callback/page.tsx`
- `workmap/apps/web/app/onboarding/avatar/page.tsx`
- `workmap/apps/web/app/onboarding/company/page.tsx`
- `workmap/apps/web/components/employees/EmployeeDirectory.tsx`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/login/MockLoginPanel.tsx`
- `workmap/apps/web/components/office/OfficeCommandPalette.tsx`
- `workmap/apps/web/components/office/OfficeMap.tsx`
- `workmap/apps/web/components/office/useVirtualOfficeData.ts`
- `workmap/apps/web/lib/api/apiClient.ts`
- `workmap/apps/web/lib/api/apiTypes.ts`
- `workmap/apps/web/lib/api/invitationsApi.ts`
- `workmap/apps/web/lib/api/tenantOnboardingApi.ts`
- `workmap/apps/web/lib/api/usersApi.ts`
- `workmap/apps/web/lib/workflow/workflowState.ts`

Workspace notes:

- `docs/references/` remains unrelated untracked workspace content. Do not stage it unless explicitly intended.
- `.env` was not read during this QA pass.
- No Prisma schema or migration file changed for this follow-up.
- `workmap/apps/web/tsconfig.tsbuildinfo` was restored after web build verification and should not be included in commit.

## 3. Secret / Sensitive Data Review

Result: no real secret found in reviewed files.

Secret scan covered:

- AWS-style access keys.
- Private key headers.
- AWS secret/access token naming.
- Supabase key/secret/token naming.
- Cognito secret/token naming.
- Render/Vercel token naming.
- Postgres connection URLs.

Excluded from scan:

- `workmap/.env`
- `workmap/node_modules/**`
- `workmap/apps/web/.next/**`
- `**/*.tsbuildinfo`

Result:

- No matches.

## 4. OWNER Backend Avatar Completion Review

Status: code-review passed; manual retest required.

Reviewed behavior:

- `getDefaultSetupState("OWNER").hasAvatar` is now `false`.
- `/onboarding/company` creates the owner workspace, inspects returned `user.avatarId`, and routes to `/onboarding/avatar` when no valid backend avatar exists.
- If backend avatar exists, `/onboarding/company` caches it locally and preserves the backend next route.
- `/login/callback` reads `/users/me` after `GET /auth/me`.
- Login page Cognito Continue reads `/users/me` after `GET /auth/me`.
- For OWNER without backend avatar, both mapped login paths route to `/onboarding/avatar`.
- For OWNER with backend avatar, both mapped login paths cache the layered avatar locally and skip avatar recreation.
- `/onboarding/avatar` lets non-EMPLOYEE users, including OWNER, confirm existing backend display name while choosing/saving avatar.
- Avatar save uses `PATCH /users/me` with `displayName` and encoded `avatarId`.

Conclusion:

- Fresh OWNER workspace creation should no longer enter the product with only local/fallback avatar state.
- OWNER re-login should no longer recreate avatar after backend `User.avatarId` contains a valid `layered:v2:` reference.

## 5. Virtual-Office Avatar Consistency Review

Status: code-review passed; manual retest required.

Reviewed behavior:

- `VirtualOfficeController.listPositions()` returns `position.user.avatarId ?? "default"`.
- `useVirtualOfficeData()` maps position `avatarId` into current and remote player state.
- `OfficeMap` decodes backend avatar references for the current user and remote users.
- Remote avatar assets are keyed by a stable `userId:avatarId` signature so ordinary 4-second polling does not constantly reload avatar assets.
- If a remote user has valid backend `layered:v2:` avatar data in position response, canvas drawing uses that layered avatar instead of fallback `WM`.

Expected manual result:

- EMPLOYEE should see OWNER's real layered avatar after OWNER has completed backend avatar/profile setup and is present in the office.
- OWNER should continue seeing EMPLOYEE's real layered avatar.

Residual watch item:

- If an authenticated API user has local avatar cache but no backend avatar and also has no current virtual-office position yet, direct `/virtual-office` access may still have edge behavior that depends on login routing and API load timing. The intended supported flow is now protected by workspace creation and login callback/Continue routing through `/users/me`.

## 6. Display Name / Employee Avatar Review

Status: code-review passed; previously tested by user before final OWNER-avatar fix.

Reviewed behavior remains intact:

- New EMPLOYEE invite acceptance display-name field starts blank and is required.
- New EMPLOYEE avatar/profile setup display-name field starts blank and is required when no backend avatar exists.
- Employee avatar/profile save persists `displayName` plus encoded `avatarId`.
- Returning employee with backend avatar should skip avatar recreation.
- `/employees` decodes backend `avatarId` and renders real layered avatar when available.

## 7. RBAC / Tenant Isolation Review

Status: passed by code review.

Reviewed safeguards remain intact:

- Central `WorkMapCapability` / `WORKMAP_ROLE_CAPABILITIES` model remains in `workmap/packages/auth/src/index.ts`.
- Invite list/create has service-level `canInviteEmployees()` enforcement.
- Reports verify target user tenancy before cross-user report access.
- Users directory checks `canViewEmployeeDirectory()` and scopes by backend `context.companyId`.
- Virtual-office position reads verify the office map belongs to the requester's company.
- Integration settings require integration-management capability.
- Contact links remain same-tenant target scoped.
- No reviewed endpoint newly trusts frontend-provided `companyId`, `tenantId`, `userId`, or `role`.

Non-blocking limitations:

- Frontend role visibility remains advisory UX; backend service checks are the security boundary.
- Frontend workflow roles are still coarser than backend roles; `TEAM_LEAD` / `HR_ADMIN` are manager-style in the current frontend bridge.
- Department/team-level RBAC remains future work because the data model does not yet encode team membership boundaries.

## 8. Regression Risk Review

Passed or unchanged:

- Cognito, pilot auth, and dev-token fallback remain distinct backend-resolved paths.
- No real secret or external platform credential was added.
- No schema/migration change was introduced.
- No desktop agent, browser extension, websocket/SSE, map expansion, deployment troubleshooting, billing, or full membership migration was introduced.
- `/virtual-office` remains polling-based; realtime walking animation remains future work.
- Dashboard, Reports, Compliance, invite flow, owner onboarding, and employee onboarding remain in scope only where needed for profile/RBAC integration.

Watch items for manual QA:

- Fresh OWNER should be forced through avatar setup once.
- OWNER backend `avatarId` should populate after avatar save.
- OWNER fresh login/browser should skip avatar setup after backend avatar exists.
- EMPLOYEE should see OWNER's real layered avatar, not `WM`.
- OWNER should still see EMPLOYEE's real layered avatar.
- Direct URL access to frontend-only hidden employee routes can still render page shells, but backend data/actions must stay permissioned.

## 9. Verification Results

Commands run from `C:\Users\lilia\WorkMap\workmap`:

```powershell
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web lint
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
```

Results:

- API typecheck passed.
- Web typecheck passed.
- API lint passed.
- Web lint passed.
- API build passed.
- Web build passed.
- Web build still prints the existing warning that the Next.js plugin was not detected in the ESLint config.
- `workmap/apps/web/tsconfig.tsbuildinfo` was restored after build verification.

Secret scan:

```powershell
rg -n "AKIA|ASIA|BEGIN (RSA |EC |OPENSSH |PRIVATE )?KEY|aws_secret|aws_access|secret_access|SUPABASE.*(KEY|SECRET|TOKEN)|COGNITO.*(SECRET|TOKEN)|VERCEL.*TOKEN|RENDER.*TOKEN|postgres://|postgresql://" --glob '!workmap/node_modules/**' --glob '!workmap/apps/web/.next/**' --glob '!workmap/.env' --glob '!**/*.tsbuildinfo'
```

Result:

- No matches.

Not run:

- No Prisma migration command was run because no schema/migration changed.
- No deployed Vercel/Render smoke test was run in this QA pass.
- Browser/manual retest was completed by the user after this QA pass using real local Cognito/browser sessions.

## 10. Manual QA Results

Use local ports consistently:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`

Final OWNER avatar scenario:

1. Fresh OWNER workspace creation routed OWNER through avatar/profile setup when backend avatar was missing.
2. OWNER avatar/profile saved successfully.
3. OWNER re-login / fresh browser did not force avatar recreation after backend avatar existed.
4. EMPLOYEE saw OWNER's real layered avatar in `/virtual-office`, not the `WM` fallback marker.
5. OWNER still saw EMPLOYEE's real layered avatar in `/virtual-office`.

Previously completed Round 3 RBAC/isolation checks:

6. EMPLOYEE did not see Dashboard, Reports, Integrations, Settings, or Invites in AppShell.
7. EMPLOYEE did not see Dashboard or Integrations in `/virtual-office` command palette.
8. Employee directory, display-name, avatar persistence, and two-user virtual-office avatar consistency checks passed.
9. Existing tenant onboarding, invite acceptance, `/virtual-office`, Dashboard, Reports, Compliance, pilot login, and dev-token fallback had no blocking regression reported.

## 11. Final Recommendation

- QA review: passed.
- Return to Codex Chat 2: not required based on this review.
- Can proceed to human manual testing: final required manual pass is complete.
- Suggested commit: yes, recommended.
- Do not stage `docs/references/`.
