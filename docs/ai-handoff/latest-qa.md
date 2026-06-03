# Latest QA Handoff

## 1. Overall Conclusion

人工验收通过

QA review result: 本轮 “Implement Basic Polling Presence for 5-Person Virtual Office Pilot” 的实现范围集中在 `useVirtualOfficeData.ts`，代码审查未发现阻塞问题。实现使用现有 `GET /virtual-office/map/:officeMapId/positions` read API 做基础 polling presence，保留本地玩家控制，不新增 websocket/SSE/realtime 基建。人工测试已通过。

No fix request required.

Commit note: 当前 diff 中只有 `docs/ai-handoff/latest-implementation.md` 和 `workmap/apps/web/components/office/useVirtualOfficeData.ts` 被修改。`docs/references/` 仍是 untracked 目录，未确认属于本任务前不要误提交。

## 2. Scope Check

Original Task Brief: Implement Basic Polling Presence for 5-Person Virtual Office Pilot.

Implementation stayed within the original task brief:

- `/virtual-office` now periodically refreshes backend positions through the existing positions read endpoint.
- Remote users are mapped into existing `RemoteOfficePlayer` shape.
- Current user is filtered out by `currentUserId`, so the local player should not duplicate as a remote player.
- Remote presence freshness is derived from `updatedAt` using existing statuses.
- Polling failure keeps last good state or existing fallback state.
- No websocket, server-sent events, complex realtime infra, arbitrary-user mutation, historical trail, backend route change, Prisma/auth/login/onboarding change, TMX rendering change, asset change, or unrelated route change was found.

Scope note: this task intentionally introduces polling. Manual browser QA has verified request cadence and hidden-tab behavior.

## 3. File-Level Diff Review

| File | Review | Risk |
|---|---|---|
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | Adds polling constants, `currentUserId`, shared positions parsing, current-user filtering, freshness status mapping, visible/hidden polling cadence, in-flight guard, stale-response guard, failure logging, last-good behavior, and cleanup for timer/listener. Manual browser polling checks passed. | Low-medium |
| `docs/ai-handoff/latest-implementation.md` | Updated implementation handoff for this polling presence task. | Low |
| `docs/references/` | Untracked directory present in workspace. Not reviewed as part of this task. | Risk only if accidentally committed. |

## 4. Issues Found

Blocking issues:

- None found.

Non-blocking issues / notes:

- Browser-level polling, multi-user update, hidden-tab cadence, and core virtual-office regression checks were manually verified by the user and passed.
- Implementation handoff reports lint/typecheck/build passed, but this QA pass focused on handoff + diff review and did not rerun the full command set.
- Hidden tabs still poll every 15 seconds rather than pausing entirely. This matches the implementation handoff, but should be accepted as an intentional product/performance tradeoff.
- API-valid empty positions now produce an empty remote-player list instead of mock remote people. This is intentional behavior and should be remembered for future QA.
- `docs/references/` remains untracked and should not be staged unless it belongs to a separate docs task.

## 5. Regression Risks

- Polling depends on `officeMapId`, authenticated `apiOptions`, and `currentUserId`; if dev auth is unavailable, mock/fallback behavior should remain stable.
- Repeated `setData` updates can re-render the office UI every polling cycle, especially when remote positions change frequently.
- Freshness mapping uses client time and `Date.parse(updatedAt)`; clock skew or invalid timestamps could affect displayed remote status.
- If positions API returns an empty but valid list, mock remote users disappear. This is desired but should be checked against pilot expectations.
- Polling updates `currentUserPosition` in hook state, but `OfficeMap.tsx` should still preserve local movement because restore is guarded by existing one-time/local-touch logic.
- Failure handling keeps last good mounted state; a full page reload with backend down will still return to normal mock fallback.

## 6. Virtual Office Specific Check

- Map rendering: unchanged; TMX canvas source was not modified.
- Avatar movement: unchanged in `OfficeMap.tsx`; local player remains locally controlled.
- Room/zone behavior: no direct changes; remote status/freshness may affect displayed people/status only.
- Object interaction: chair `E` interaction and contact drawer were not modified, but should be regression-tested because remote player data updates over time.
- Presence/activity state: basic polling presence added for remote players; stale users map to `idle` after 30 seconds and `offline` after 5 minutes.
- Timers/listeners cleanup: polling effect clears active timeout and removes `visibilitychange` listener on cleanup.
- Desktop/mobile behavior: no layout changes found.

## 7. Backend/API/Auth Check

- Request shape: reuses existing `GET /virtual-office/map/:officeMapId/positions`.
- Response shape: expects an array compatible with existing `WorkMapApiPlayerPosition`.
- Error handling: invalid/failing positions response returns `ok: false`; polling logs in development and keeps existing state.
- Validation: frontend mapping remains conservative through existing `toPlayerState` / `toRemoteOfficePlayer` parsing.
- Auth/session behavior: polling starts only when dev auth provides `apiOptions` and `currentUserId`.
- Data persistence: none added in this task; read-only polling only.
- Security/privacy: no arbitrary-user mutation or broader write route was added.

## 8. Performance and Stability Check

- Visible polling interval: about 4 seconds.
- Hidden polling interval: about 15 seconds.
- Overlap prevention: `inFlight` prevents concurrent polling requests.
- Stale response handling: `requestCounter` / `latestAppliedRequest` prevent older responses from replacing newer applied data.
- Timer cleanup: timeout cleared on cleanup and when visibility changes.
- Listener cleanup: `visibilitychange` listener removed on cleanup.
- API over-fetching: acceptable for 5-person pilot, but should be monitored if the pilot grows.
- Stability: failed polling should not crash page or erase last good remote players.

## 9. Verification Results

Already reported by implementation handoff:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Manual checks completed by user:

- 前后端端口统一：浏览器打开 `http://localhost:3000/virtual-office`，API 请求打到 `http://localhost:3001`。
- `GET http://localhost:3001/health` 返回 `ok`。
- DevTools Network 确认初始 `map`、`navigation`、`positions` 请求带 `Authorization: Bearer ...`。
- `GET /virtual-office/map/:officeMapId/positions` 在可见 tab 下约每 4 秒重复一次。
- 隐藏页面后 polling 降到约每 15 秒；切回可见后会尽快刷新一次。
- 当前用户不会作为 remote player 重复出现。
- 通过 dev-token/API 更新另一个 demo 用户位置后，远程 avatar 在下一次 poll 后更新。
- 核心页面与交互回归通过，包括地图 canvas、avatar、WASD/方向键、碰撞、双击 auto-walk、椅子 `E` 交互、contact drawer、房间/zone 状态、桌面和窄屏布局。
- Current-user position save/restore 仍正常，polling 未覆盖本地正在移动的玩家。

Remaining optional checks for future regression rounds:

- API-valid empty positions should show no remote people rather than mock people.
- Different `updatedAt` freshness windows should map to expected statuses: 30 秒内保留原 status，30 秒到 5 分钟显示 `idle`，超过 5 分钟显示 `offline`。
- 后端断开时页面应不崩溃，并保留 last good remote state 或初始 mock fallback。

## 10. Docs/Skills Update Needs

Codex Chat 1 should later update docs/skills with:

- `docs/skills/api-contract-skill.md`: `/virtual-office` now uses repeated `GET /virtual-office/map/:officeMapId/positions` for basic polling presence.
- `docs/skills/project-summary.md`: `/virtual-office` supports simple polling-based multi-user presence for the 5-person pilot.
- `docs/skills/current-status.md`: current status should mention polling presence implemented and manual QA passed.
- `docs/skills/deployment-skill.md`: local verification should keep frontend on `localhost:3000`, backend on `localhost:3001`, visible polling around 4 seconds, hidden polling around 15 seconds.

## 11. Fix Request for Implementation Chat

No fix request required.
