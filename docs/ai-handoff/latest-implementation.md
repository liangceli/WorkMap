# Latest Implementation Handoff

## Original Task Brief

Replace Cognito Hosted UI sign-up/sign-in with a WorkMap-owned interface while keeping Cognito as the identity provider, and make an employee invitation email truly read-only throughout account creation and sign-in.

## Changed Files

- `workmap/apps/web/components/login/CognitoAuthForm.tsx`
- `workmap/apps/web/components/login/CognitoLoginPanel.tsx`
- `workmap/apps/web/lib/auth/cognitoUserPoolAuth.ts`
- `workmap/apps/web/lib/auth/cognitoSession.ts`
- `workmap/apps/web/app/invite/[token]/page.tsx`
- `workmap/apps/web/app/login/page.tsx`
- `workmap/apps/web/app/page.tsx`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/package.json`
- `workmap/pnpm-lock.yaml`

## Implementation Summary

- Added a custom WorkMap Cognito form using Amplify v6 modular Auth for sign-up, email confirmation, sign-in, password reset, supported MFA codes, new-password challenge, session restore, and sign-out.
- Owner entry now opens the custom form instead of Cognito Hosted UI.
- Employee invite entry locks the previewed invitation email in both create-account and sign-in modes. Cognito receives that exact email as the username, and backend invitation acceptance remains the final exact-email authority.
- A missing invitation preview API now blocks account creation because the client cannot safely determine the locked email.
- Existing Hosted UI callback helpers remain only for compatibility; the normal entry flow no longer uses them.

## Role And Access Behavior

- New public registration is presented as Owner account creation.
- Employee account creation is available from a valid pending invitation and is bound to the Owner-invited email.
- After Cognito authentication, existing backend context still decides Owner, Employee, Platform Admin, tenant, and onboarding routes.

## Verification

- `pnpm --filter @workmap/web typecheck`: passed.
- `pnpm --filter @workmap/web lint`: passed.
- `pnpm --filter @workmap/web build`: passed; existing Next.js ESLint-plugin warning remains.
- Manual local QA: Owner create-account and sign-in views rendered and switched successfully at `http://127.0.0.1:3002/login`; no Cognito credentials were submitted.
- Invitation browser QA: the supplied old token returned API 400 against the current local database, so a valid-invitation browser pass remains pending.

## Intentionally Not Changed And Risks

- No backend, schema, RBAC, tenant boundary, Cognito AWS setting, Vercel setting, or secret changed.
- Cognito must allow self-service sign-up, use a browser app client without a secret, enable SRP auth, and deliver verification email before the live flow can pass.
- This is build-verified and partially browser-verified, not claimed production-ready. Run matching-email, existing-account, wrong-account, reset-password, and session-restore browser smoke tests after deployment.
