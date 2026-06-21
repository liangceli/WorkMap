# Latest QA Handoff

## Reviewed Implementation

Reviewed the ten requested login-shell, onboarding, Notices, realtime interaction, map restoration, room-focus, disabled-control, privacy, email-delivery, and Platform Admin items.

## Findings

- High: none found in code verification.
- Medium, remaining: visual two-user browser QA could not run because the browser runtime failed before connecting.
- External, remaining: Cognito verification-email inbox placement cannot be guaranteed by application code; SES/domain authentication must be configured and tested.
- Fixed: Notices are persistent and tenant-scoped, unread state clears on view, reaction choices animate above avatars, and realtime events refresh recipients.
- Fixed: map state restores before API refresh, stale presence is not shown as live, the active room alone remains highlighted, room links are hidden, scheduling is disabled, and avatar name validation is explicit.

## Test And Verification Status

- API: typecheck, lint, build, and 8/8 tests passed.
- Web: typecheck, lint, and production build passed.
- Shared types: typecheck and build passed.
- HTTP: health 200 and unauthenticated Notices 401.
- Supabase migration: reported complete by the user.
- Diff and secret checks: passed.

## Manual QA Status

Not run automatically. Required deployment smoke: two authenticated users exchange message/wave/reaction, verify unread badge and read clearing, refresh/navigate away and back, and enter/leave rooms.

## Recommendation

Code gate passes and the next deployment/smoke round can proceed. Do not claim production readiness until the two-user browser smoke and SES-delivered Cognito verification-email test pass.
