# Latest QA Handoff

## Reviewed Implementation

Reviewed desktop and MV3 active/idle state transitions, lock/blur behavior, queue identity, credential at-rest handling, activity ingestion, UTC range validation, daily aggregation, device coverage, company/department/user RBAC, audit behavior, CSV safety, report navigation, generated Alpha packages, and privacy boundaries.

## Findings

- High: none found in local automated review.
- Fixed: idle time is now emitted by both tracking clients instead of always reporting zero.
- Fixed: app and domain totals are displayed separately to avoid counting browser time twice.
- Fixed: reports now support date ranges, daily trends, department/member views, and CSV export.
- Fixed: Employee/IT Admin Reports navigation now matches own-report API permission.
- Fixed: extension credentials are no longer newly persisted as plaintext; legacy config migrates to an encrypted envelope.
- Remaining external: deployed end-to-end tracking loop, visual browser QA, code signing, and browser distribution.

## Test And Verification Status

- Desktop Agent: 8/8 tests passed; typecheck, lint, build passed.
- Browser Extension: 9/9 tests passed; typecheck, lint, build passed.
- API: 8/8 tests passed; typecheck, lint, build passed.
- Web: 7/7 tests passed; typecheck and production build passed. The build completed integrated lint/type validation and all 19 routes.
- Diff check, scoped secret scan, and prohibited-collection scan passed.
- Automated browser QA was not run because the in-app browser connection lacked required sandbox metadata.

## Manual QA List

1. Deploy API/Web, apply no new migration, and confirm `/health/readiness` reaches the intended Supabase database.
2. Sign in as Employee, open Reports from top navigation, and confirm only `My activity` is available.
3. Pair Desktop Agent 0.3.0, use two apps for at least 30 seconds each, wait past the configured idle threshold, resume, and confirm active plus idle app time appears.
4. Run `install-workmap-agent.ps1 -StartNow`, sign out/in to Windows, and confirm agent heartbeat resumes automatically. Test uninstall without and with `-RemoveLocalData` on a non-production test profile.
5. Load MV3 Extension 0.3.0, pair it, use two domains, remain browser-idle for over one minute, resume, and confirm domain active plus idle time appears without paths/query strings.
6. Inspect extension local storage and confirm it contains ciphertext/IV/version rather than a `wmdev_...` credential. Restart the browser and confirm tracking resumes.
7. Sign in as Owner, confirm the default view is Company aggregate, then test 7/30/90-day presets and a custom UTC range.
8. Select a department and then an employee; confirm rows/trends change and the employee read creates an audit entry.
9. Export CSV and verify app/domain rows, scope, dates, active seconds, and idle seconds. Confirm no full URL or private content appears.
10. Sign in as Employee and directly request company scope or another user through DevTools; confirm 403. Try a user/department from another tenant; confirm no data is returned.
11. Sign in as Platform Admin and confirm tenant health contains counts/readiness only, with no app names, domains, or employee rows.
12. At desktop and mobile widths, check Reports controls, trend rows, long app/domain names, empty state, API error state, disabled department state, and CSV button for overlap or clipping.

## Risks And Recommendation

Local code gate passes and the project can proceed to deployed manual QA. Do not claim production readiness until the deployed two-role tracking/report loop and external distribution/signing items pass.
