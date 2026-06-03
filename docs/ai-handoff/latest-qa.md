# Latest QA Handoff

## 1. Overall Conclusion

人工验收通过

QA review result: 本轮 “Complete 5-Person Presence & Team Experience MVP” 的 People/Presence UI diff 和三轮 follow-up fix 已完成复审。之前发现的 Prisma UUID crash、raw UUID room label、People filter style overlay、polling 导致地图明显刷新问题都已修复并完成针对性手测。代码审查和本轮手动验收未发现新的阻塞问题。

No fix request required.

Commit note: 当前 tracked diff 包含 `latest-implementation.md`、`latest-qa.md`、`OfficeCommandPalette.tsx`、`OfficeMap.tsx`、`OfficeSidePanel.tsx`、`presence.ts`、`useVirtualOfficeData.ts`、`save-position.dto.ts`、`virtual-office.service.ts`。`docs/references/` 仍是 untracked 目录，未确认属于本任务前不要误提交。

## 2. Scope Check

Original Task Brief: Complete 5-Person Presence & Team Experience MVP.

Implementation stayed within the original task brief, with justified follow-up fixes:

- Adds clearer remote member presence display in the People panel.
- Adds current-user card and keeps current user separate from remote teammates.
- Adds readable freshness / last-seen labels.
- Adds team summary counts and empty/search states.
- Adds People command palette freshness context.
- Reuses existing polling presence data and existing `GET positions` flow.
- Resolves `roomId` through known destinations and falls back to `Office area`, avoiding raw UUID display.
- Fixes filter button style conflict with consistent longhand border styles.
- Keeps canvas animation effect stable during polling by reading remote people/selected remote from refs.
- Does not add websocket, SSE, complex realtime infra, production auth/session work, Prisma migrations, deployment changes, map/avatar assets, movement/collision/pathfinding/chair/contact drawer changes, or hardcoded map-coordinate business logic.
- Backend edits are limited to existing virtual-office position save validation so invalid frontend/mock room IDs cannot crash Prisma.

## 3. File-Level Diff Review

| File | Review | Risk |
|---|---|---|
| `workmap/apps/web/components/office/presence.ts` | Adds shared `statusFromFreshness()` and `presenceFreshnessLabel()` helpers. Thresholds match prior polling freshness rules. | Low |
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | Replaces local freshness logic with shared `statusFromFreshness()`. No polling cadence or data-flow change found. | Low |
| `workmap/apps/web/components/office/OfficeSidePanel.tsx` | Adds People UX improvements, room-name mapping, and longhand border styles for filter buttons. | Low-medium; visual QA still needed. |
| `workmap/apps/web/components/office/OfficeCommandPalette.tsx` | Adds freshness labels, empty row, and room-name mapping for People search rows. | Low-medium; visual QA needed for row width/overflow. |
| `workmap/apps/web/components/office/OfficeMap.tsx` | Passes current user/source into side panel, filters non-UUID room IDs from save snapshots, and stabilizes canvas loop by using refs for polling-updated remote people/selected remote id. | Medium; browser QA should verify no polling flicker. |
| `workmap/apps/api/src/modules/virtual-office/save-position.dto.ts` | Adds controlled validation for optional `roomId` UUID shape. | Low |
| `workmap/apps/api/src/modules/virtual-office/virtual-office.service.ts` | Adds service-level UUID guard before `officeRoom.findFirst`. | Low |
| `docs/ai-handoff/latest-implementation.md` | Updated implementation handoff for this task and follow-up fixes. | Low |
| `docs/references/` | Untracked directory present in workspace. Not reviewed as part of this task. | Risk only if accidentally committed. |

## 4. Issues Found

Blocking issues:

- None found after the follow-up fixes.

Previously blocking issues now resolved:

- Current-user save no longer sends non-UUID local/mock `roomId`; backend validates invalid room IDs before Prisma.
- People panel and command palette no longer display raw backend room UUIDs.
- People filter buttons no longer mix shorthand `border` with `borderColor`.
- Polling remote presence updates should no longer restart/reload the canvas animation effect.

Non-blocking issues / notes:

- Browser visual QA for the latest filter-style and polling-canvas stability fixes has passed in targeted manual testing.
- Implementation handoff reports lint/typecheck/build and HTTP roomId checks passed; this QA pass focused on handoff + diff review and did not rerun the full command set.
- Current-user card uses a fixed `Y` avatar marker for “You”. This is acceptable for clarity, but visual QA should confirm it feels intentional.
- Freshness labels update when polling data rerenders; there is no separate minute ticker. This is acceptable for MVP and avoids extra timers.
- Filters include `available`, `focus`, `busy`, `idle`, and `offline`; `break` users remain visible under `all`/search but do not have a dedicated filter in this version.
- Current demo remote users were initially all offline, so active/idle/focus/busy filters were validated primarily through filter empty states and one manual remote-user API update.
- `docs/references/` remains untracked and should not be staged unless it belongs to a separate docs task.

## 5. Regression Risks

- People panel layout may become tight on narrow screens because remote cards now include a status column and action grid.
- Room-name mapping depends on destination IDs matching API position `roomId`; unmatched values should show `Office area`, not UUID.
- Command palette People rows now include freshness detail; long names/roles/last-seen text should be checked for overflow.
- Empty API remote state now has explicit UI copy and should be checked so it does not look like an error.
- The canvas loop now reads polling-updated people from refs; targeted manual QA confirmed polling no longer visibly refreshes the map and remote updates still arrive.
- Contact drawer and Go-to-person behavior still depend on remote people data and should be regression-tested.

## 6. Virtual Office Specific Check

- Map rendering: TMX canvas source was not modified; animation loop dependency was narrowed so polling should not restart the map loop.
- Avatar movement: unchanged; local player remains controlled by `OfficeMap`.
- Room/zone behavior: People panel and command palette map room IDs to readable destination names or `Office area`.
- Object interaction: chair `E` interaction and contact drawer logic were not changed.
- Presence/activity state: UI exposes active/idle/offline summary and readable last-seen labels.
- Current-user position save: non-UUID local/mock `roomId` values are filtered out before save; backend validates invalid `roomId` defensively.
- Timers/listeners cleanup: no new timers/listeners added in this task; polling behavior remains in existing hook.
- Desktop/mobile behavior: no structural layout change outside side panel/command palette, but visual QA is needed on narrow layout.

## 7. Backend/API/Auth Check

- Request shape: People UI adds no new backend requests; existing positions polling remains the data source.
- Save request shape: `PUT /virtual-office/map/:officeMapId/positions/me` safely omits frontend/mock non-UUID room IDs.
- Response shape: continues using existing `RemoteOfficePlayer` / `WorkMapApiPlayerPosition` mapping.
- Error handling: invalid save `roomId` returns controlled `400 BadRequestException` instead of Prisma crash.
- Validation: freshness helper safely falls back when `updatedAt` cannot be parsed; backend validates optional `roomId` UUID shape in DTO and service.
- Auth/session behavior: no production auth/session work added.
- Data persistence: no schema or migration changes; save path remains latest-position upsert.
- Security/privacy: no arbitrary-user mutation or new sharing surface added.

## 8. Performance and Stability Check

- New summary counts use `useMemo` over the remote people list.
- Room-name maps use `useMemo` over destinations in side panel and command palette.
- Freshness labels are computed during render and do not add background timers.
- No new dependencies, global state tree, websocket, SSE, or background realtime infra.
- Backend stability improved: invalid room IDs are handled before Prisma.
- Canvas stability should be improved because polling-only `officePeople` changes no longer restart the animation effect.

## 9. Verification Suggestions

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
- Follow-up `pnpm --filter @workmap/web lint/typecheck/build` passed after roomId, room-label, filter-style, and polling-canvas fixes.
- Follow-up `pnpm --filter @workmap/api lint/typecheck/build` passed after backend roomId guard.
- Direct HTTP verification passed:
  - invalid `roomId=open-office-north` returned controlled `400`
  - omitted `roomId` save succeeded
  - no Prisma UUID crash on temporary fresh API process

Manual checks completed by user:

- 后端启动。
- 前端启动并重载最新代码。
- API 请求出现并带 `Authorization: Bearer ...`。
- Current-user position save no longer sends non-UUID `roomId`; backend no longer logs Prisma UUID error for this path.
- `You` card exists and current user does not appear duplicated as remote teammate.
- People panel `You` card and remote cards no longer display UUIDs.
- Command palette People search rows no longer display UUIDs.
- People panel active / idle / offline summary numbers match the currently visible remote teammate statuses.
- Remote cards display role, readable room/area, freshness label, last-seen detail, and expected action buttons.
- `available` / `focus` / `busy` / `idle` / `offline` filters and empty states work with the current offline-heavy data.
- People filters no longer trigger the Next/React style conflict overlay.
- Observed polling for 15+ seconds; positions polling no longer causes visible full-map/canvas refresh or flashing.
- Command palette People search results show matching person context and no-result empty state correctly.
- Manual dev-token/API update of Mia Manager succeeded; latest poll updated Mia in the browser.
- Contact drawer opens correctly for remote teammates.
- Backend-off refresh fallback/demo mode works; page, map, local avatar, and local controls remain usable.

Deferred to final regression round:

- Full movement regression: WASD/arrow movement, collision, double-click auto-walk, chair `E` interaction, room/zone status.
- Full desktop/narrow layout sweep, especially People card, filter row, and command palette row overflow.
- API-valid empty remote state with a truly empty remote list was intentionally skipped to avoid mutating local dev DB; current fallback/demo mode was verified instead.

## 10. Docs/Skills Update Needs

Codex Chat 1 should later update docs/skills with:

- `docs/skills/realtime-presence-skill.md`: note that current MVP remains polling-based and now includes user-facing freshness/last-seen labels; websocket/SSE remains out of scope.
- `docs/skills/current-status.md`: record that 5-person presence/team UX is implemented and browser/manual QA is pending until completed.
- `docs/skills/project-summary.md`: record `/virtual-office` People panel improvements: current-user separation, team summary, freshness labels, empty/fallback states, command palette presence context, UUID-free room labels, and stable polling canvas behavior.
- `docs/skills/api-contract-skill.md`: note optional `roomId` on current-user position save must be a backend OfficeRoom UUID; invalid values return controlled 400.
- `docs/skills/deployment-skill.md`: keep local manual QA instructions for frontend `localhost:3000` and backend `localhost:3001`.

## 11. Fix Request for Implementation Chat

No fix request required.
