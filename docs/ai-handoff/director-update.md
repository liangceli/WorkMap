# Director Update

## 1. Completed Task

Basic polling presence sync was implemented for `/virtual-office`.

## 2. Accepted Changes

- Added polling of existing `GET /virtual-office/map/:officeMapId/positions`.
- Polling starts only when `officeMapId`, authenticated API options, and `currentUserId` are available.
- Visible tabs poll about every 4 seconds; hidden tabs poll about every 15 seconds.
- Returning to a visible tab triggers a prompt refresh.
- Remote players update from backend positions while the current user remains locally controlled and filtered out.
- Remote freshness maps `updatedAt` to existing statuses: recent keeps backend status, 30s-5m maps to `idle`, and older than 5m maps to `offline`.
- Failed polls keep last good mounted state or initial fallback.
- No websocket/SSE, historical trail, arbitrary-user mutation, backend route, Prisma, auth, TMX, movement, or unrelated UI changes were added.

## 3. Verification Summary

Reported passing from `workmap/`:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Manual QA passed for polling cadence and core regressions: visible polling around 4 seconds, hidden polling around 15 seconds, prompt refresh on visibility return, current-user filtering, remote update after another demo user's API position changed, existing virtual-office interactions, and current-user save/restore not being overwritten.

## 4. Remaining Risks

- Hidden tabs still poll every 15 seconds rather than fully pausing.
- API-valid empty positions now show no remote people instead of mock people.
- Freshness mapping uses client time and `Date.parse(updatedAt)`, so clock skew or invalid timestamps can affect displayed remote status.
- Repeated polling can re-render office UI every polling cycle, especially when positions change frequently.
- No websocket/SSE, complex realtime infrastructure, historical trail, arbitrary-user mutation, or production auth work was added.

## 5. Updated Docs

- `docs/skills/current-status.md`
- `docs/skills/api-contract-skill.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/virtual-office-skill.md`
- `docs/skills/frontend-skill.md`
- `docs/skills/realtime-presence-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/project-summary.md`
- `docs/skills/decision-log.md`
- `docs/ai-handoff/director-update.md`

## 6. Recommended Next Tasks

- Decide whether polling is sufficient for MVP or whether websocket/SSE is needed later.
- Monitor polling load if pilot grows beyond the 5-person target.
- Consider whether the UI needs explicit last-seen labels instead of only status remapping.
- Decide the real production auth/session path separately.
- Add automated tests for polling cadence/failure behavior, current-user filtering, empty remote lists, and freshness mapping.
