# Latest QA Handoff

## Reviewed Implementation

Reviewed the custom Cognito owner/employee auth flow, invitation email locking, session restoration, logout, and post-auth backend routing.

## Findings

- Blocking code findings: none.
- Medium: live Cognito verification is pending external user-pool settings and deployment.
- Low: legacy Hosted UI callback code remains for compatibility but is not used by normal entry actions.

## Verification Status

- Web typecheck: passed.
- Web lint: passed.
- Web production build: passed with the existing Next.js ESLint-plugin warning.
- Manual browser QA: custom Owner sign-up/sign-in rendering and mode switching passed locally. No external Cognito form submission was made.
- Valid invitation browser QA: pending because the supplied old token returned API 400 in the current local database.

## Risks And Recommendation

The invitation email is read-only in the UI, is used directly as the Cognito username, and is independently enforced by the backend accept endpoint. Automated gate passes; proceed to deployment/configuration smoke testing, but do not call the auth flow production-ready until real Cognito sign-up, confirmation, sign-in, and invite acceptance complete successfully.
