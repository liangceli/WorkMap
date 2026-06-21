# Latest QA Handoff

## Reviewed Implementation

Reviewed Windows foreground/minimized/idle behavior, minimum segment duration, crash checkpoint recovery, UTC rollover, device credential binding, Agent session start/heartbeat/stop/interruption, live Owner access, detailed TXT generation, company employee bars, installer auto-start, release contents, RBAC, tenant isolation, and privacy-field exclusions.

## Findings

- High, external blocker: production Supabase does not yet have `AgentSession`; API 0.4.0 must not be deployed without `20260621210000_agent_sessions`.
- High, external blocker: the Windows ZIP is not code-signed or hosted, and `NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL` is not configured.
- Medium, accepted boundary: force-kill/offline end time is bounded by the last ten-second heartbeat and shown interrupted after 30 seconds; exact post-mortem termination time is technically unavailable.
- Medium, production gap: current-user auto-start can be stopped by the employee. WorkMap records the resulting heartbeat interruption, but this is not a tamper-resistant Windows Service.
- Medium, production gap: no auto-update, tray status UI, MDM deployment, or signed installer exists yet.
- Low: authenticated visual QA was blocked by deleted users and unavailable in-app browser initialization.
- Fixed during review: live polling now uses a lightweight Agent-status endpoint instead of reloading a full 90-day timeline every ten seconds.
- Fixed during review: duration formatting now shows seconds and no longer creates confusing independently rounded minute totals.

## Test And Verification Status

- Prisma schema validation: pass.
- Local migration deploy: pass.
- Desktop Agent: typecheck pass, lint pass, 10 tests pass, self-contained Windows ZIP build pass, archive/runtime smoke pass.
- API: typecheck pass, lint pass, build pass, 9 tests pass.
- Web: typecheck pass, lint pass, build pass, 11 tests pass.
- Diff check and focused secret scan: pass.
- Browser visual/manual QA: not run.

## Required Manual QA

1. Apply the migration to production Supabase and deploy API before installing Agent 0.4.0.
2. Create a new Owner and Employee, complete compliance, and generate an Employee Desktop Agent code.
3. On a genuinely separate Windows employee computer, download/unzip the release and run `setup-workmap-agent.cmd` once.
4. Restart/sign out and back in; confirm Agent starts without another pairing code.
5. Foreground App A for at least ten seconds, minimize it, use App B, briefly open App C for under five seconds, then lock/unlock Windows.
6. Confirm Owner live status changes within about ten seconds; App C is absent, minimized/background time is excluded, and full product names are displayed.
7. End the Agent normally and confirm a stopped session; force-stop it and confirm interrupted status within 30 seconds.
8. Reopen Agent and confirm the previous unexpected stop is persisted and the checkpointed final foreground segment appears.
9. Download Daily, 7-day, 30-day, and 90-day TXT reports; verify app totals, interval timestamps, Agent audit, and privacy text.
10. Confirm company view displays per-employee app-duration bars and Employee/Platform Admin cannot access company or employee-level reports.

## Recommendation

Local implementation gate passes. Do not call it production-ready until production migration, signing/hosting, deployment, and the separate-computer manual checklist pass. The next round can proceed to those external deployment and acceptance steps.
