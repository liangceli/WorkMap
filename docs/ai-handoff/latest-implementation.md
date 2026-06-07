# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 3: Strict Multi-Tenant Data Isolation + RBAC Core.

Implement the strict multi-tenant data isolation and role-based access control foundation for WorkMap while preserving the previous minimal safe bridge:

- `Company` remains the tenant/workspace model.
- `User.companyId + User.role` remains the temporary company member profile.
- `User.cognitoSub` remains the stable Cognito identity mapping.
- Invitation, owner onboarding, employee invite acceptance, pilot/dev fallback, virtual office, dashboard, reports, and compliance must keep working.
- Do not implement deployment troubleshooting, desktop/browser tracking, websocket/SSE, map expansion, product redesign, billing, or a full membership migration in this round.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/packages/auth/src/index.ts` | Formalized the central RBAC/capability model and kept existing helper names backed by the new matrix. |
| `workmap/apps/api/src/modules/invitations/invitations.service.ts` | Added service-level invite management permission enforcement in addition to the existing controller roles guard. |
| `workmap/apps/api/src/modules/reports/reports.service.ts` | Added target-user tenant verification before cross-user reports and centralized own/team report permission checks. |
| `workmap/apps/api/src/modules/users/users.service.ts` | Added explicit employee directory capability enforcement before tenant-scoped user listing. |
| `workmap/apps/api/src/modules/virtual-office/virtual-office.service.ts` | Added office map tenant verification before reading map positions by `officeMapId`. |
| `workmap/apps/api/src/modules/integrations/integrations.service.ts` | Restricted tenant integration settings to OWNER/IT_ADMIN while preserving same-tenant contact links. |
| `workmap/apps/web/components/layout/AppShell.tsx` | Hid obvious admin/report/settings navigation from employee roles and updated role-boundary copy. |
| `workmap/apps/web/components/office/OfficeCommandPalette.tsx` | Filtered command-palette actions by current workflow role so employee users do not see dashboard/integration shortcuts. |
| `workmap/apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts` | Follow-up: owner workspace creation now accepts a confirmed display name, falling back to verified Cognito identity; workspace responses now include `avatarId` when available. |
| `workmap/apps/api/src/modules/users/users.controller.ts` | Follow-up: added `PATCH /users/me` for current-user display-name updates. |
| `workmap/apps/api/src/modules/users/users.service.ts` | Follow-up: validates and saves current user's `displayName` and backend-backed layered avatar reference without trusting client user/company/role. |
| `workmap/apps/web/app/employees/page.tsx` | Follow-up: loads real same-tenant users from `GET /users` when API auth is available and uses mock data only as explicit fallback. |
| `workmap/apps/web/app/invite/[token]/page.tsx` | Follow-up: employee invite acceptance now requires an explicit blank-start display name and respects backend avatar completion for existing users. |
| `workmap/apps/web/app/login/callback/page.tsx` | Follow-up: mapped Cognito callback now reads `/users/me` so backend avatar completion controls the next onboarding route; OWNER without backend avatar is routed to avatar setup. |
| `workmap/apps/web/app/onboarding/avatar/page.tsx` | Follow-up: avatar onboarding now requires explicit display name entry, saves display name plus layered avatar reference through `PATCH /users/me`, reloads completed backend profile state, and lets non-employee users confirm their existing profile name while choosing an avatar. |
| `workmap/apps/web/app/onboarding/company/page.tsx` | Follow-up: owner workspace setup now asks the owner to confirm/edit display name before creating the tenant user and routes OWNER through avatar setup when backend `avatarId` is missing. |
| `workmap/apps/web/components/employees/EmployeeDirectory.tsx` | Follow-up: supports API-backed directory rows, locks employees to contact-only mode, and hides mock detail links for real API users. |
| `workmap/apps/web/components/office/OfficeMap.tsx` | Follow-up: restored API current-user position now also restores backend display name/avatar id; authenticated API users can no longer satisfy avatar completion with local cache when backend avatar is missing. |
| `workmap/apps/web/components/login/MockLoginPanel.tsx` | Follow-up: Cognito Continue path now uses backend avatar completion when routing existing mapped users. |
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | Follow-up: exposes initial virtual-office API load completion so avatar routing can wait for backend profile data before falling back to local setup. |
| `workmap/apps/web/lib/api/apiClient.ts` | Follow-up: added `PATCH` helper for profile updates. |
| `workmap/apps/web/lib/api/apiTypes.ts` | Follow-up: aligned `WorkMapApiUser.department` and profile fields with backend response shape. |
| `workmap/apps/web/lib/api/invitationsApi.ts` | Follow-up: invite acceptance request now includes display name. |
| `workmap/apps/web/lib/api/tenantOnboardingApi.ts` | Follow-up: owner workspace creation request now includes display name. |
| `workmap/apps/web/lib/api/usersApi.ts` | Follow-up: `updateCurrentUserProfile()` now accepts display name and avatar reference updates. |
| `workmap/apps/web/lib/auth/displayName.ts` | Follow-up: added safe frontend display-name derivation/sanitization helpers. |
| `workmap/apps/web/lib/avatar/avatarProfile.ts` | Follow-up: added compact `layered:v2:` avatar reference encode/decode helpers for backend persistence through `User.avatarId`. |
| `workmap/apps/web/lib/workflow/workflowState.ts` | Final follow-up: OWNER default workflow state no longer treats avatar as complete without backend avatar/profile confirmation. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified.

## 3. Implementation Summary

Implemented the Round 3 RBAC/isolation hardening without schema changes.

Schema audit conclusion:

- Current `User.companyId + User.role` bridge is enough for this round.
- No `CompanyMembership` / `TenantMembership` migration was required for this limited hardening pass.
- Tenant-scoped models already carrying `companyId`: `Department`, `User`, `Invitation`, `Device`, `ActivityEvent`, `AppUsageSummary`, `WebsiteUsageSummary`, `OfficeMap`, `OfficeRoom`, `VirtualOfficePosition`, `MonitoringPolicy`, `PolicyAcknowledgement`, `IntegrationAccount`, and `AuditLog`.
- `Company` is the tenant root and does not carry `companyId`.

Central RBAC model:

- Added `WorkMapCapability` and `WORKMAP_ROLE_CAPABILITIES`.
- Added generic helpers `roleHasCapability()` and `hasCapability()`.
- Preserved existing helper names such as `canViewEmployeeActivity()`, `canManageCompliance()`, `canManageIntegrations()`, and `canViewDeviceHealth()`.

Implemented capability boundaries:

| Capability | Roles |
|---|---|
| `manageCompany` | OWNER |
| `inviteEmployees` | OWNER |
| `viewEmployeeDirectory` | EMPLOYEE, TEAM_LEAD, MANAGER, HR_ADMIN, IT_ADMIN, OWNER |
| `viewEmployeeActivity` | TEAM_LEAD, MANAGER, HR_ADMIN, OWNER; always own user by `userId` |
| `viewOwnReports` | all roles |
| `viewTeamReports` | TEAM_LEAD, MANAGER, HR_ADMIN, OWNER |
| `manageCompliancePolicy` | HR_ADMIN, OWNER |
| `viewComplianceStatus` | HR_ADMIN, OWNER |
| `manageIntegrations` | IT_ADMIN, OWNER |
| `viewDeviceHealth` | IT_ADMIN, OWNER |
| `accessTechnicalSettings` | IT_ADMIN, OWNER |
| `accessVirtualOffice` | all roles |
| `useContactLinks` | all roles |

## 4. User-Visible Changes

- Employees no longer see Dashboard, Reports, Integrations, or Settings in the main AppShell navigation.
- Employees no longer see Dashboard or Integrations actions in the `/virtual-office` command palette.
- IT admins keep Integrations/Settings visibility, but Dashboard is no longer shown as a manager-style shortcut.
- Compliance remains visible to EMPLOYEE, MANAGER-style roles, OWNER, and IT_ADMIN in the frontend workflow.
- Existing `/virtual-office` behavior, map rendering, movement, collision, chair interaction, contact drawer, polling presence, dashboard rendering, reports rendering, and compliance acknowledgement UI were not intentionally changed.

## 5. Technical Notes

Endpoints audited:

- `GET /auth/me`: uses `RequestContextGuard`; Cognito, WorkMap JWT, and dev context resolve through backend auth. Dev headers are disabled in production and are rechecked against the database.
- `POST /auth/pilot-login`, `POST /auth/dev-token`: still DB-resolved and scoped to a real user/company; dev-token remains disabled in production.
- `GET /tenant-onboarding/status`, `POST /tenant-onboarding/workspace`: Cognito-only onboarding endpoints preserved; no frontend-provided tenant/user/role is trusted.
- `GET /companies/current`: uses backend `context.companyId`.
- `GET /users`, `GET /users/me`, `GET /users/:userId`: tenant-scoped by `context.companyId`; directory now explicitly checks capability; cross-tenant user IDs return not found.
- `GET /invitations`, `POST /invitations`: existing OWNER controller guard remains; service now also enforces `canInviteEmployees()`.
- `POST /invitations/accept`: existing Cognito-only invite acceptance validation preserved.
- `GET /virtual-office/map`, `GET /virtual-office/navigation`: use backend `context.companyId`.
- `GET /virtual-office/map/:officeMapId/positions`: now verifies `officeMapId` belongs to requester company before returning positions.
- `PUT /virtual-office/map/:officeMapId/positions/me`: already verifies map/room tenant ownership and uses `context.userId`.
- `GET /reports/usage-summary`: now verifies requested `userId` belongs to requester company before cross-user report queries.
- `GET /compliance/policy`: policy lookup remains tenant-scoped by `context.companyId`.
- `POST /compliance/policy/:policyId/acknowledgement`: already verifies `policyId` belongs to requester company and uses `context.userId`.
- `GET /integrations`: now requires integration management capability.
- `GET /integrations/contact-links/:targetUserId`: remains same-tenant target scoped and preserves contact drawer behavior.
- `GET /devices`: still tenant-scoped; central capability now limits company device visibility to OWNER/IT_ADMIN, otherwise users see only their own devices.
- `activity` has no exposed controller in this pass.
- `GET /health` remains public.

Tenant isolation safeguards:

- No endpoint added trust in frontend-provided `companyId`, `tenantId`, `userId`, or `role`.
- New checks rely on backend `RequestContext`.
- Cross-tenant `officeMapId` position reads now fail before returning data.
- Cross-tenant report target IDs now fail with safe not found behavior.
- Integration settings are no longer visible to employees through the API.
- Invite management is enforced in the service layer as well as controller guard.

No Prisma schema or migration changes were made.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm --filter @workmap/web build
```

Results:

- Web lint passed.
- Web typecheck passed.
- API lint passed.
- API typecheck passed.
- API build passed.
- Web build passed.
- Web build still prints the existing warning that the Next.js plugin was not detected in the ESLint config.
- `apps/web/tsconfig.tsbuildinfo` was restored after build verification so it is not part of this implementation diff.

No migration commands were run because no schema/migration changed.

Manual browser QA was not run in this chat.

## 7. Manual QA Suggestions

Use local ports consistently:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`

Suggested checks:

1. Login as OWNER and confirm workspace, AppShell role summary, invite list/create, dashboard, reports, compliance, and `/virtual-office` still work.
2. Login/accept invite as EMPLOYEE and confirm the employee can access `/virtual-office`, compliance acknowledgement, employee directory/contact drawer, and own reports.
3. Confirm EMPLOYEE does not see Dashboard, Reports, Integrations, Settings, or Invites in AppShell.
4. Confirm EMPLOYEE does not see Dashboard or Integrations in the `/virtual-office` command palette.
5. Confirm EMPLOYEE cannot `GET /invitations` or `POST /invitations`.
6. Confirm EMPLOYEE cannot `GET /integrations`.
7. Confirm wrong-tenant `officeMapId` cannot be used for `GET /virtual-office/map/:officeMapId/positions`.
8. Confirm wrong-tenant `officeMapId` cannot be used for position save.
9. Confirm wrong-tenant `policyId` cannot be acknowledged.
10. Confirm wrong-tenant `targetUserId` cannot be used for integration contact links.
11. Confirm an EMPLOYEE cannot query another user's report with `?userId=...`.
12. Confirm OWNER/MANAGER can query an in-tenant target user's report where expected.
13. Confirm OWNER/MANAGER using an off-tenant `userId` receives a safe not found response.
14. Create or use two companies and confirm Owner A cannot see Owner B users, invites, virtual-office positions, reports, compliance acknowledgement targets, or contact links.
15. Reconfirm tenant onboarding and invite acceptance still work.
16. Reconfirm pilot login and dev-token fallback still work outside production.

## 8. Risks / Notes

- This remains the minimal bridge architecture, not the final SaaS identity model.
- Current limitation remains: one Cognito account maps to one WorkMap company user.
- Future architecture should introduce global identity/account plus `CompanyMembership` or `TenantMembership`.
- Department/team-level RBAC is not mature yet. TEAM_LEAD/MANAGER/HR_ADMIN are currently implemented as company-level report/activity visibility roles where the data model lacks team membership boundaries.
- Frontend role visibility is advisory UX only; backend service checks are the security boundary.
- Direct URL access to some frontend-only mock pages may still render static content, but protected backend data/actions are constrained by API permissions.
- No Render/Vercel troubleshooting or deployed smoke was done in this round.
- No secrets or real `.env` values were read or committed.
- `docs/references/` remains unrelated untracked content.

## 9. Docs Update Suggestions

- `docs/skills/current-status.md`: record that STAGE 2 Round 3 added central RBAC/capability helpers and core tenant-isolation hardening.
- `docs/skills/backend-skill.md`: document `WORKMAP_ROLE_CAPABILITIES`, report target tenant verification, invitation service-level permission checks, and virtual-office map ownership checks.
- `docs/skills/api-contract-skill.md`: document expected 403/404 behavior for unauthorized report targets, integration settings, invites, and wrong-tenant office map IDs.
- `docs/skills/realtime-presence-skill.md`: no realtime change this round; note virtual-office remains polling-based.
- `docs/skills/project-summary.md`: keep the future architecture note: global identity/account plus `CompanyMembership`/`TenantMembership` and stricter department/team RBAC remain future work.

## 10. QA Follow-up Fix: Employees API Directory + Display Name Handling

Original QA findings from `docs/ai-handoff/latest-qa.md`:

- `/employees` rendered mock `employeeDirectoryRows` instead of same-tenant backend users from `GET /users`.
- Owner and employee onboarding did not clearly let users confirm/edit a human-readable display name, so product surfaces could fall back to session/email-derived labels.

Implementation:

- `/employees` is now API-first:
  - Uses `getWorkMapApiAuthOptions()` and `listUsers()`.
  - When API auth and `GET /users` succeed, the directory renders only real same-tenant API users.
  - Mock data is used only when API auth is unavailable or `GET /users` fails, and the page copy explicitly labels it as an example fallback.
  - API-backed rows hide the old mock-only `/employees/:id` detail link so UUID-backed real users are not sent to the static mock detail page.
- Employee directory RBAC UX was tightened:
  - Employee workflow users are locked to contact-only view.
  - Manager/Owner-style users can still switch between manager and employee display modes.
  - Employee page header hides Dashboard for employee and IT roles, matching AppShell boundaries.
- Display-name handling now uses the existing `User.displayName` field; no schema/migration was needed.
- Backend profile endpoint added:
  - `PATCH /users/me`
  - Uses `RequestContextGuard`.
  - Only updates the current backend-resolved user.
  - Validates `displayName` length 2-80 characters.
  - Does not accept client `userId`, `companyId`, or `role`.
- Owner workspace creation:
  - `/onboarding/company` derives a default from verified Cognito `name` / username / email local-part.
  - Owner can edit display name before creating workspace.
  - `POST /tenant-onboarding/workspace` stores the confirmed name; if omitted by an older client, backend falls back to verified Cognito identity.
- Employee invite acceptance:
  - `/invite/:token` derives a default from Cognito session.
  - Employee can edit display name before accepting invite.
  - `POST /invitations/accept` stores/updates the display name for the accepted tenant user.
- Avatar onboarding:
  - Adds a display-name confirmation field.
  - Loads current backend user display name when API auth is available.
  - Saves edits through `PATCH /users/me` before continuing.
- Virtual office:
  - Current-user API position restore now also restores backend `displayName` and `avatarId`, so local office labels can use the same backend profile name where applicable.

Verification run after this follow-up:

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
- Web build still prints the existing Next ESLint plugin warning.
- `apps/web/tsconfig.tsbuildinfo` was restored after build verification.

Manual QA required after this follow-up:

1. OWNER `/employees` shows the real invited EMPLOYEE from `GET /users`.
2. EMPLOYEE `/employees` shows real same-tenant directory/contact entries.
3. Mock employees are not shown when authenticated `GET /users` succeeds.
4. Mock directory is clearly labeled only when API auth or API response is unavailable.
5. OWNER confirms display name during workspace creation and sees that name in AppShell, `/employees`, and virtual-office labels where applicable.
6. EMPLOYEE confirms display name during invite acceptance/avatar onboarding and sees that name in AppShell, `/employees`, and virtual-office labels/contact drawer where applicable.
7. EMPLOYEE remains contact-only in `/employees` and does not get manager summary controls.
8. Existing invite flow, `/virtual-office`, Dashboard, Reports, Compliance, pilot fallback, and dev-token fallback still work.

Remaining limitation:

- The static `/employees/:id` detail route remains mock-backed in this round. API-backed directory rows intentionally hide that mock detail link until a real backend-backed employee detail route is implemented.

## 11. QA Follow-up Fix: Backend Avatar/Profile Persistence

Original QA findings from `docs/ai-handoff/latest-qa.md`:

- Avatar/profile completion was still local-only through `workmap.userSetupState.hasAvatar` and `workmap.avatarConfig`.
- OWNER `/employees` could show real backend users, but employee avatar art still came from fallback/mock data instead of the employee's created layered avatar.
- A returning employee in a fresh browser/session could be sent back to `/onboarding/avatar` even when the account already had a completed profile.
- New employee avatar/profile setup prefilled a Cognito/email-derived display name such as `employee 001`; the field should start blank and be required.

Implementation:

- Reused existing `User.avatarId`; no Prisma schema or migration was needed.
- Added a compact backend avatar reference format:
  - `layered:v2:<encoded layered avatar config>`
  - Implemented in `workmap/apps/web/lib/avatar/avatarProfile.ts`.
  - The stored value can reconstruct the same `LayeredAvatarConfig` across sessions and users.
- Extended `PATCH /users/me`:
  - Now accepts `displayName` and/or `avatarId`.
  - Still uses backend `RequestContextGuard` and only updates `context.userId`.
  - Rejects missing updates, invalid display names, and avatar references that are not WorkMap `layered:v2:` values.
  - Still does not accept client `userId`, `companyId`, or `role`.
- Updated avatar onboarding:
  - First-time display-name input starts blank.
  - Display name is required before continuing.
  - When backend profile already has a valid layered avatar reference, the page loads that avatar and display name as an edit state.
  - Saving writes both display name and avatar reference to `PATCH /users/me`, then caches the avatar locally.
- Updated login routing:
  - Cognito `/login/callback` and Login page `Continue` now call `/users/me` after `/auth/me`.
  - If backend `avatarId` decodes to a complete layered avatar, `hasAvatar` is set in workflow state and the avatar is cached locally.
  - Fresh browser sessions should no longer force returning employees to recreate an avatar when backend profile is complete.
- Updated invite acceptance:
  - Authenticated invite page now starts display name blank and requires explicit entry before accept.
  - Existing accepted users with a backend avatar reference keep `hasAvatar: true` after invite acceptance.
- Updated `/employees`:
  - API-backed rows decode `user.avatarId` and render the real layered avatar when present.
  - Fallback/mock avatar art is used only when a backend avatar reference is absent or invalid.
- Updated virtual office:
  - Initial avatar routing waits for virtual-office API load completion before deciding local setup is missing.
  - If `currentUserPosition.avatarId` contains a valid backend layered avatar, it is used and cached.
  - Remote players decode their backend `avatarId` values for canvas rendering.
  - Remote avatar asset loading depends on a stable `userId:avatarId` signature, not every 4-second position poll, to avoid reintroducing visible map refresh from ordinary presence polling.
- Tenant onboarding and invitation workspace responses now include `avatarId` when available for frontend routing compatibility.

Verification run after this follow-up:

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
- Web build still prints the existing Next ESLint plugin warning.
- `apps/web/tsconfig.tsbuildinfo` was restored after build verification.

Manual QA required after this follow-up:

1. New employee first-time setup shows a blank required display-name field.
2. Employee creates avatar once and the save calls `PATCH /users/me` with both `displayName` and `avatarId`.
3. Employee logs out/in or uses a fresh browser session and is not forced to recreate avatar if backend `User.avatarId` has a valid `layered:v2:` profile reference.
4. OWNER `/employees` shows the employee's real layered avatar from `GET /users`, not fallback/mock art.
5. EMPLOYEE `/employees` shows same-tenant real directory/contact entries with consistent display name and avatar.
6. `/virtual-office` uses backend-backed display names and layered avatars for remote players where `avatarId` is present.
7. Contact drawer still shows the selected teammate's backend display name.
8. Existing invite flow, `/virtual-office`, Dashboard, Reports, Compliance, pilot fallback, and dev-token fallback still work.

Remaining limitations:

- This intentionally remains the minimal bridge architecture using `User.companyId + User.role` and `User.avatarId`; it does not introduce `CompanyMembership` / `TenantMembership`.
- `User.avatarId` stores a compact serialized WorkMap layered avatar reference for this MVP. A future profile service can migrate this to a richer profile/avatar table if needed.
- Users created before this follow-up who do not have a valid backend `layered:v2:` avatar reference will still need to complete avatar setup once.
- Local `workmap.avatarConfig` remains as a cache only; backend `User.avatarId` is now the completion source for authenticated users.

## 12. Final QA Follow-up Fix: OWNER Backend Avatar Completion

Original QA finding from `docs/ai-handoff/latest-qa.md`:

- OWNER could see EMPLOYEE's real layered avatar in `/virtual-office`.
- EMPLOYEE could see OWNER presence, but OWNER rendered as the fallback `WM` marker.
- Likely cause: OWNER workflow still treated avatar as complete by default, so OWNER could enter the office without ever saving a backend `User.avatarId`.

Implementation:

- OWNER default workflow state no longer marks avatar as complete:
  - `getDefaultSetupState("OWNER").hasAvatar` is now `false`.
  - Real OWNER completion must come from backend `User.avatarId` containing a valid `layered:v2:` reference.
- Owner workspace setup now checks the backend avatar returned by the workspace response:
  - If a valid backend avatar exists, it is cached locally and the existing backend `nextRoute` is preserved.
  - If no valid backend avatar exists, the OWNER is routed to `/onboarding/avatar` immediately after workspace creation.
- Cognito callback and Login page `Continue` now route mapped OWNER users without backend avatar directly to `/onboarding/avatar`.
- Avatar onboarding still saves the same backend-backed `displayName + avatarId` payload through `PATCH /users/me`.
- Avatar onboarding now lets non-employee users, including OWNER, confirm their existing backend display name while choosing the avatar. Employee first-time setup remains blank and required.
- `/virtual-office` now refuses to treat local `workmap.avatarConfig` as completion for authenticated API current users when API position data exists but backend `avatarId` is missing/invalid.
  - This prevents OWNER from entering with only local avatar cache while other users still see `WM`.
  - Mock/fallback mode can still use local avatar cache when API data is unavailable.
- No backend schema, Prisma migration, websocket/SSE, realtime presence, map, desktop, extension, billing, deployment, or membership model changes were made.

Verification run after this final follow-up:

```powershell
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/web lint
pnpm --filter @workmap/api lint
pnpm --filter @workmap/web build
pnpm --filter @workmap/api build
```

Results:

- Web typecheck passed.
- API typecheck passed.
- Web lint passed.
- API lint passed.
- Web build passed.
- API build passed.
- Web build still prints the existing Next ESLint plugin warning.
- `apps/web/tsconfig.tsbuildinfo` was restored after build verification.

Manual QA required after this final follow-up:

1. Fresh OWNER creates workspace and is routed through avatar/profile setup if backend `User.avatarId` has no valid `layered:v2:` reference.
2. OWNER saves avatar/profile once and backend `User.avatarId` becomes a valid `layered:v2:` reference.
3. OWNER re-login or fresh browser skips avatar recreation after backend avatar exists.
4. EMPLOYEE in the same office sees OWNER's real layered avatar, not `WM`.
5. OWNER still sees EMPLOYEE's real layered avatar.
6. Direct `/virtual-office` access as authenticated OWNER without backend avatar redirects to avatar setup instead of using local-only avatar cache.

## 13. Next Chat Input

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
