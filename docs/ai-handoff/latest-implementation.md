# Latest Implementation Handoff

## Original Task Brief

Investigate why Employee `Create account` displayed `Email or password is incorrect`, verify whether it was incorrectly calling sign-in, and fix the real behavior.

## Changed Files

- `workmap/apps/web/components/login/CognitoAuthForm.tsx`
- `workmap/apps/web/lib/auth/cognitoPrimaryAction.ts`
- `workmap/apps/web/lib/auth/cognitoUserPoolAuth.ts`
- `workmap/apps/web/test/cognito-primary-action.test.ts`
- `workmap/apps/web/package.json`

## Implementation Summary

- Confirmed the create-account branch called Cognito `signUp`, but a `NotAuthorizedException` from registration was incorrectly rendered as a sign-in password error.
- Added an explicit, tested primary-action dispatcher: create account calls only `createCognitoAccount`; sign-in calls only `signInCognitoAccount`.
- Removed automatic sign-in from the create-account and email-confirmation submissions. A successful registration or confirmation now moves to the explicit sign-in screen.
- Added registration-specific errors for disabled self-service sign-up, an app client secret, and other Cognito registration rejection.

## Role And Access Behavior

Employee invitation email locking and backend exact-email enforcement are unchanged. Owner, Employee, Platform Admin, tenant, and onboarding routing are unchanged.

## Verification

- `pnpm --filter @workmap/web test`: passed, 3 tests.
- `pnpm --filter @workmap/web typecheck`: passed.
- `pnpm --filter @workmap/web lint`: passed.
- `pnpm --filter @workmap/web build`: passed with the existing Next.js ESLint-plugin warning.
- Manual live Cognito registration: not run because it would create an external account and current user-pool configuration must first be checked.

## Intentionally Not Changed And Risks

- No backend, schema, RBAC, tenant boundary, invitation security, AWS setting, deployment setting, or secret changed.
- If the new UI reports disabled registration, enable Cognito self-service sign-up. If it reports a client secret, use a public browser app client without a secret.
- Deploy the web change before repeating the Employee invitation registration smoke.
