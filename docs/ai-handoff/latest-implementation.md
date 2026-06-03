# Latest Implementation Handoff

## 1. Original Task Brief

Implement Basic Polling Presence for 5-Person Virtual Office Pilot

Goal: implement a complete basic presence sync feature for `/virtual-office` suitable for a 5-person small company pilot.

Required behavior:

- `/virtual-office` periodically refreshes backend positions.
- Other users appear/update as remote players.
- Current user remains locally controlled and must not duplicate as a remote player.
- Remote users show sensible presence freshness based on `updatedAt`.
- Backend/API failure gracefully keeps the last good state or fallback state.
- No websocket, server-sent events, complex realtime infrastructure, historical trail, arbitrary-user mutation, or production auth/session work.
- Keep movement, collision, pathfinding, chair interaction, contact drawer behavior, TMX rendering, and unrelated app surfaces unchanged.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | Added basic polling for `GET /virtual-office/map/:officeMapId/positions`, current-user filtering, remote-player updates, visibility-aware polling cadence, last-good failure behavior, and freshness mapping from `updatedAt` into existing presence statuses. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Pre-existing workspace notes:

- `docs/references/` remains untracked and was not modified for this task.

## 3. Implementation Summary

Implemented the basic polling presence layer inside `useVirtualOfficeData`.

The initial load still fetches virtual-office map, navigation, and positions. Once both authenticated API options and `officeMapId` are available, a second effect starts polling the existing positions read endpoint:

```text
GET /virtual-office/map/:officeMapId/positions
```

Polling updates only the API-derived presence data:

- `remotePlayers`
- `currentUserPosition` for restore support when available
- `source` when positions become API-backed after fallback

`OfficeMap.tsx` movement/rendering logic was not changed for this task. The local player remains controlled by local state; polling only changes `officeData.remotePlayers` and therefore updates other users.

## 4. User-Visible Changes

In local development with backend auth available, other seeded/demo users can now appear and update in `/virtual-office` without refreshing the page.

When another user's saved backend position changes, that remote player updates on the next polling cycle. The current user is filtered out of remote players, so the local player should not appear twice.

Remote users now reflect simple freshness:

- Updated within 30 seconds: keep backend status.
- Updated between 30 seconds and 5 minutes: show `idle` unless already `offline`.
- Older than 5 minutes: show `offline`.

If API positions are available but there are no other users, the remote player list becomes empty. Mock remote users are fallback only when API positions are unavailable or unsafe.

## 5. Technical Notes

Polling strategy:

- Visible tab interval: `4000ms`.
- Hidden tab interval: `15000ms`.
- Polling starts only when `officeMapId`, authenticated `apiOptions`, and `currentUserId` are all available.
- Polling uses the existing `listVirtualOfficePositions` wrapper and does not add new dependencies.

Visibility strategy:

- When the document becomes hidden, polling slows to the hidden interval.
- When the document becomes visible again, any pending timer is cleared and positions refresh promptly.

Race/failure controls:

- `inFlight` prevents overlapping polling requests.
- `requestCounter` and `latestAppliedRequest` prevent older responses from replacing newer applied data.
- Cleanup sets `cancelled`, clears the active timer, and removes the `visibilitychange` listener.
- Failed polling responses log a development-only message and keep the last good `remotePlayers`.
- If initial API positions fail before any good state exists, the existing mock fallback remains.

Current-user behavior:

- Development auth now supplies `currentUserId` from the existing auth bridge.
- Positions matching `currentUserId` are excluded from `remotePlayers`.
- The current user's polled position is exposed only as `currentUserPosition`, preserving existing restore-on-load behavior.
- Polling does not mutate local player movement state and does not overwrite in-progress local movement.

Remote-player behavior:

- Backend positions for users other than `currentUserId` are mapped into existing `RemoteOfficePlayer` shape.
- The existing status UI is reused; freshness maps stale remote users into `idle`/`offline` rather than adding a new UI surface.
- API-valid empty remote results are treated as a valid empty remote list, not a reason to show mock people.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm lint
pnpm typecheck
pnpm build
```

Results:

- All commands passed.
- `pnpm --filter @workmap/web build` and `pnpm build` emitted the existing warning that the Next.js plugin was not detected in ESLint config.

Manual/browser verification:

- Not completed in this session.
- No long-running dev server commands were run as blocking verification.
- Full browser checks for Network polling cadence, visibility behavior, multi-user update, and failure fallback remain manual QA items.

## 7. Manual QA Suggestions

Run manually:

```powershell
pnpm --filter @workmap/api dev
pnpm --filter @workmap/web dev
```

Use frontend at:

```text
http://localhost:3000/virtual-office
```

Suggested checks:

- Confirm backend `GET http://localhost:3001/health` returns `ok`.
- Complete or simulate existing demo login/onboarding.
- Open `/virtual-office`.
- Confirm initial map/navigation/positions requests include Bearer auth.
- Confirm positions polling repeats about every 4 seconds while the tab is visible.
- Confirm the current user's `userId` does not appear as a remote player.
- Update another seeded user's position through dev-token/API calls and confirm that remote player updates on the next poll.
- Confirm API-valid empty remote positions show no remote people instead of mock people.
- Confirm updated remote users show recent/backend status, 30s-5m old users show `idle`, and older-than-5m users show `offline`.
- Hide/switch away from the tab and confirm polling slows; return to the tab and confirm a prompt refresh.
- Stop or break the backend and confirm the page does not crash and keeps last good remote state or initial mock fallback.
- Re-check WASD/arrow movement, collision, double-click auto-walk, chair sit/stand, contact drawer, room/zone status, desktop layout, and narrow layout.
- Confirm current-user position save/restore still works and polling does not overwrite local movement.

## 8. Risks / Notes

- Browser-level polling/manual multi-user behavior has not yet been verified in this session.
- Freshness mapping intentionally reuses existing statuses; there is no separate "last seen" label in UI.
- Hidden-tab polling slows rather than fully pausing, so very long hidden sessions can still make occasional requests.
- API-valid empty positions now produce an empty remote list; this is intentional because mock people should only represent fallback.
- Last-good behavior is stateful only for the mounted page; a full reload with backend unavailable returns to normal mock fallback.
- `docs/references/` remains an unrelated untracked workspace change.

## 9. Docs Update Suggestions

- `docs/skills/api-contract-skill.md`: record that `/virtual-office` now relies on repeated `GET /virtual-office/map/:officeMapId/positions` for basic polling presence.
- `docs/skills/project-summary.md`: note that `/virtual-office` supports simple polling-based multi-user presence for the 5-person pilot.
- `docs/skills/current-status.md`: record current status as polling presence implemented, browser/manual QA pending.
- `docs/skills/deployment-skill.md`: record manual local verification expectations: frontend on `localhost:3000`, backend on `localhost:3001`, visible polling about every 4 seconds, hidden polling about every 15 seconds.
