# Latest QA Handoff

## Reviewed Implementation

Reviewed the invitation email-lock change: public invite preview by token, frontend read-only invited-email display, Cognito `login_hint`, mismatch UI block, and backend accept-time verified-email enforcement.

## Diff Review Summary

The security boundary remains backend-owned. The new preview route does not authenticate a user but requires possession of the high-entropy invite token and returns only the invite metadata needed before Cognito sign-up. The accept route still rejects wrong verified Cognito emails before user creation or workspace joining.

## Findings Ordered By Severity

- Blocking: API test execution is not complete because sandboxed Node test runner failed with `spawn EPERM` and elevated rerun was rejected by the environment usage-limit approval error.
- Medium: Cognito Hosted UI can be prefilled with `login_hint`, but WorkMap cannot guarantee the hosted email input is visually immutable without Cognito/custom Hosted UI configuration.
- Low: `workmap/apps/web/tsconfig.tsbuildinfo` remains modified by `next build` because escalated `git restore` was also blocked by the usage-limit approval error.

## Test And Verification Status

- API typecheck: passed.
- Web typecheck: passed.
- API lint: passed.
- API build: passed.
- Web lint: passed.
- Web build: passed, with existing Next.js ESLint-plugin warning.
- API tests: not completed due environment approval limit after sandbox `spawn EPERM`.
- `git diff --check`: passed with CRLF warnings only.
- Secret scan excluding env/generated/reference directories: passed.

## Manual QA Status

Not run. Needs a real Cognito invite-flow browser check.

## Risks

- Wrong-email workspace access is protected by backend accept enforcement.
- Visual non-editability inside Cognito itself depends on AWS Hosted UI/custom UI behavior; the current app-level improvement is prefill plus backend lock.
- Build artifact cleanup remains pending for `workmap/apps/web/tsconfig.tsbuildinfo`.

## Recommendation

Code gate: typecheck/lint/build PASS. Full QA gate: HOLD until API tests can run and the generated `tsconfig.tsbuildinfo` file is restored.
