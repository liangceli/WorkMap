# Latest Implementation Handoff

## Original Task Brief

Productize the Windows Desktop Agent so an employee pairs once and it starts at every Windows sign-in; collect only foreground application product name and usage intervals, exclude background/minimized and sub-five-second activity, expose Agent interruption to Owner reports, show current/daily/7/30/90-day individual and company visual summaries, and provide TXT downloads.

## Changed Files

- Desktop Agent source, Windows adapter, queue/checkpoint/runtime, tests, installer/uninstaller/setup, Alpha template, and Windows release builder under `workmap/apps/desktop-agent/`.
- Device session endpoints and persistence in `workmap/apps/api/src/modules/devices/`.
- UTC activity splitting in `workmap/apps/api/src/modules/activity/activity.service.ts`.
- Live status, app timeline, Agent sessions, employee comparison in `workmap/apps/api/src/modules/reports/`.
- Reports and device-setup UI/API types under `workmap/apps/web/`.
- Prisma schema and `workmap/prisma/migrations/20260621210000_agent_sessions/migration.sql`.
- `.gitignore` for generated Windows runtime/release artifacts.

## Implementation Summary

- Pairing remains tenant/user/device/client-bound and one-time. The current-user installer registers `WorkMapDesktopAgent` under Windows `HKCU\...\Run`, so later sign-ins start it automatically without re-pairing.
- Default foreground sampling is one second. Windows `GetForegroundWindow`, `IsWindowVisible`, and `IsIconic` ensure only the visible, non-minimized foreground application is attributed.
- App name uses Windows executable product metadata, falling back to process name. Window titles, paths, document names, and content are not collected.
- Segments under five seconds are discarded. Idle time remains separate from active duration. UTC midnight rolls the segment immediately, and API ingestion also splits cross-midnight events deterministically.
- A five-second local checkpoint recovers the last observed foreground segment after an unclean exit, bounded by its last observation.
- Agent sessions persist start, heartbeat, graceful stop, inferred unexpected stop, current app, and current app start/observation timestamps. A stale open session is reported as interrupted after 30 seconds; a later start persists the prior unexpected stop.
- Owner individual reports poll only the lightweight live Agent endpoint every ten seconds. They show connection state, current foreground app duration, and today's total foreground-app time.
- Individual reports include app totals, daily bars, app activity timeline, and Agent start/stop/interruption history. Company reports include a per-employee app-duration bar comparison.
- Daily, 7-day, 30-day, and 90-day controls remain. TXT download includes totals, daily totals, detailed app usage intervals, Agent audit, and the privacy boundary; CSV remains available.
- `release:windows` builds `artifacts/WorkMap-Desktop-Agent-Windows-x64.zip` with a bundled Node runtime. Employees run `setup-workmap-agent.cmd`, enter one code, and the package pairs, installs, and starts the Agent.
- Device Setup exposes a download URL through `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL`; without that deployment variable it honestly shows that the release download is not configured.

## Role And Privacy Behavior

- Owner/authorized team-report roles retain existing company/employee report access. Employee Reports navigation/direct-page blocking was preserved. Platform Admin receives no employee activity through these workspace routes.
- The Agent sends app product name, foreground usage start/end, active/idle flag, device/session metadata, and heartbeat only.
- It does not collect window titles, full executable paths, screenshots, recordings, keystrokes, clipboard, camera/microphone, files, webpage content, form inputs, passwords, or message/email bodies.

## Verification

- Prisma generate and schema validation: passed.
- Local PostgreSQL migration deploy: passed; seven migrations applied, including `20260621210000_agent_sessions`.
- Desktop Agent typecheck/lint: passed. Tests: 10/10 passed when executed file-by-file because the sandbox blocks the test runner's worker spawn.
- API typecheck/lint/build: passed. Tests: 9/9 passed, including session lifecycle, tenant boundaries, cross-midnight split, ingestion/report loop, and Platform Admin privacy boundary.
- Web typecheck/lint/build: passed; 19 routes generated. Tests: 11/11 passed file-by-file.
- Windows self-contained release: built successfully, about 34 MB; archive contents and bundled-runtime `status` execution verified.
- `git diff --check`: passed. Focused secret scan: clean.

## Manual QA And External Configuration

- Authenticated visual browser QA was not run: Cognito/Supabase users were deleted and the in-app browser plugin could not initialize in this session.
- Production Supabase still needs the new migration. Local migration success does not update Supabase.
- Upload the generated ZIP to a controlled HTTPS release location and set Vercel `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` to that URL.
- A Windows code-signing certificate and CI signing secret are required before broad employee distribution. The current ZIP is unsigned and may trigger SmartScreen.
- Deploy API/migration before distributing Agent 0.4.0, then deploy Web.

## Intentionally Not Changed

- Browser domain tracking/extension was not changed in this Desktop Agent round.
- Cognito, invitation flow, Virtual Office, Notices, and existing tenant/RBAC policy were not redesigned.
- No production Supabase, Render, Vercel, or release-hosting setting was changed.

## Remaining Risks And Next Step

- Forced process termination cannot transmit an exact final packet after the process is already dead; WorkMap reports interruption from the last ten-second heartbeat and marks it after 30 seconds. This is an inherent bounded estimate, not an exact kill timestamp.
- The installer is current-user auto-start, not a privileged Windows Service, and has no signed tray UI, auto-update channel, central MDM deployment, or tamper prevention yet.
- TXT reports are generated on demand from persisted API data; no scheduled pre-generated document archive was added.
- Next: apply the production migration, upload/sign the ZIP, configure the Web download URL, deploy API/Web, then test on a genuinely separate Windows employee computer.
