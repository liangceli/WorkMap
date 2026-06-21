# Latest Implementation Handoff

## Original Task Brief

Finish the previously blocked invitation email-lock verification and fix the deployed invite page showing `WorkMap API returned 404` when the web deployment reaches the new invitation preview route before the API deployment does.

## Changed Files

- `workmap/apps/web/app/invite/[token]/page.tsx`

The prior commit already contains the invitation preview API, Cognito `login_hint`, backend verified-email enforcement, and `invitation-email-lock.test.ts`.

## Implementation Summary

- Completed the previously blocked API test run; the invitation preview and wrong-email rejection test passed.
- Added a deployment-order fallback for `GET /invitations/preview/:token` returning 404.
- A preview-route 404 no longer marks the invitation unavailable. The page keeps the pending token, allows Cognito sign-up, and explains that the exact invited email must be used.
- Invalid, expired, accepted, and other non-404 preview failures still remain blocked.
- Invitation acceptance still calls the Cognito-only backend endpoint, which rejects any verified Cognito email different from the invitation email.

## Role And Access Behavior

- Owner invitation behavior is unchanged.
- Employee can continue sign-up during a staggered web/API deployment instead of being trapped by a preview-route 404.
- The fallback does not grant workspace access; backend invitation token, status, expiry, Cognito verification, and exact email matching remain authoritative.

## Verification Commands And Results

- `pnpm --filter @workmap/api test`: passed, 5 tests.
- `pnpm --filter @workmap/web typecheck`: passed.
- `pnpm --filter @workmap/web lint`: passed.
- `pnpm --filter @workmap/web build`: passed with the existing Next.js ESLint-plugin warning.
- `git diff --check`: passed with CRLF conversion warnings only.
- Generated `workmap/apps/web/tsconfig.tsbuildinfo` was restored and is not part of the source diff.

## Manual QA

The user supplied deployed-browser evidence of the 404 state. The new fallback was code-reviewed and build-verified, but has not yet been deployed for live browser recheck.

## Intentionally Not Changed

- No AWS Cognito, Vercel, Render, database, CORS, callback URL, or secret configuration changed.
- No schema or invitation token format changed.

## Remaining Risks

- The deployed API should still be upgraded to include `GET /invitations/preview/:token`; the fallback is compatibility protection, not a replacement for deployment.
- Existing token-only links cannot prefill the invite email while the old API is serving 404, but the backend accept route still prevents wrong-email workspace access.

## Suggested Next Steps

Deploy API commit `edd19c2` before or together with the new web fallback, then reopen the invite link in Incognito and verify the invited email display, Cognito sign-up, wrong-email rejection, and successful matching-email acceptance.
