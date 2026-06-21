# Latest QA Handoff

## Reviewed Implementation

Reviewed the invitation email-lock implementation and the deployed 404 compatibility fix for staggered web/API releases.

## Diff Review Summary

Only the invite page changed in this follow-up. A 404 from the preview endpoint is treated as an unavailable route version, while every other preview error remains blocked. The final authenticated accept request and backend exact-email enforcement are unchanged.

## Findings Ordered By Severity

- Blocking: none in automated verification.
- Medium: the deployed API shown in user evidence does not yet expose the preview route and should be redeployed.
- Low: in the 404 compatibility state the frontend cannot display or prefill the invited email because old invite links contain only the token; it clearly asks for the original email and relies on backend enforcement.

## Test And Verification Status

- API tests: passed, 5 tests including invitation preview and wrong verified Cognito email rejection.
- Web typecheck: passed.
- Web lint: passed.
- Web build: passed with existing Next.js ESLint-plugin warning.
- `git diff --check`: passed with CRLF warnings only.
- Generated TypeScript build metadata was restored.

## Manual QA Status

Pre-fix deployed 404 was confirmed by user screenshot. Post-fix live browser QA is pending deployment.

## Risks

- Web-only deployment removes the dead end but does not provide the read-only invited email until the API preview route is deployed.
- Cognito Hosted UI visual field immutability still depends on AWS/custom UI behavior; backend accept-time exact-email enforcement is the security boundary.

## Recommendation

Automated gate: PASS. Proceed to deploy API plus web, then run matching-email and wrong-email Incognito acceptance smoke before calling the flow accepted.
