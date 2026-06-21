# Latest QA Handoff

## Current Diagnostic: leo314 App Usage

- CSV evidence: header only; no app/domain rows for the selected UTC date.
- Initial local evidence: Desktop Agent data/status/config directory was missing.
- Deployed API evidence: liveness and database readiness pass; protected activity routes are present.
- Pair/install evidence: one-time pairing completed; DPAPI config, status, and queue files now exist.
- Runtime evidence: Agent process is live, state is `connected`, deployed heartbeat succeeded, and queue count is zero.
- Fixed during QA: installer incorrectly copied from the parent package directory and could not find `run-workmap-agent.cmd`; source path is corrected and covered by regression test.
- Remaining action: produce one real foreground app switch, then confirm the event appears in leo314's UTC date report.

## Reviewed Implementation

Reviewed Reports navigation filtering, direct-route Employee handling, authenticated role resolution, pop-up reservation timing, Outlook protocol conversion, HTTPS web fallback behavior, invalid scheme rejection, error cleanup, and current-page preservation.

## Findings

- High: none found.
- Fixed: Employee no longer sees Reports in top navigation.
- Fixed: Employee direct `/reports` access redirects to `/virtual-office`.
- Fixed: Email no longer assigns `window.location.href` on the WorkMap page.
- Fixed: `mailto:` is converted to Outlook's application protocol instead of using the machine's default email handler.
- Fixed: Outlook Web links stay in the separately reserved tab.

## Test And Verification Status

- Web tests: 10/10 passed.
- Web typecheck, lint, and production build: passed.
- Diff check: passed.
- Manual authenticated browser QA: not run.

## Manual QA List

1. Sign in as Employee and confirm Reports is absent from the top navigation.
2. As Employee, enter `/reports` directly and confirm WorkMap returns to `/virtual-office` without showing report data.
3. As Owner/Manager/IT Admin, confirm Reports remains available as intended.
4. In Virtual Office, open a teammate and click Email; confirm the map page remains open at the same URL.
5. Accept the browser external-protocol prompt if shown and confirm Outlook opens a compose window addressed to the teammate.
6. Temporarily block pop-ups and confirm WorkMap shows the retry/allow-pop-ups message without leaving the map.
7. With an HTTPS Outlook Web contact link, confirm it opens in a new tab instead of replacing WorkMap.

## Recommendation

Local code gate passes. The project can proceed to Web deployment and the two-session manual checks above.
