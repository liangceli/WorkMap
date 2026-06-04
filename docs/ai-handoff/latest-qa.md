# Latest QA Handoff

## 1. Overall Conclusion

人工验收通过

QA review result: 本轮 “Pilot Deployment + Dashboard/Reports/Compliance QA Pass” 已按 workflow 读取 `docs/ai-handoff/latest-implementation.md`，并检查 `git status`、`git diff --stat`、`git diff --name-only`、`git diff`。当前 diff 与 handoff 基本一致，未发现明确代码级阻塞问题。用户已完成手动验收，未反馈需要返工的问题。

Important QA gate resolved: implementation handoff 记录旧的已运行 Next 进程里 `/virtual-office` 返回过 `500`。本轮人工验收已在干净重启的 `3000`/`3001` 上确认 `/virtual-office` 正常，不再复现该问题。

No fix request required.

## 2. Scope Check

实现整体符合原 Task Brief：

- Clarify pilot deployment/startup readiness and minimum env/config.
- Improve local production-like startup checks without doing real deployment.
- Make session failure states clearer.
- Make Dashboard, Reports, and Compliance more honest/useful for a 5-person pilot.
- Preserve virtual-office auth/fallback/save/restore/polling/People panel/movement/collision/auto-walk/chair/contact drawer behavior by not editing those core files.
- Add a 5-user pilot QA checklist.
- No backend code, Prisma schema/migration, websocket/SSE, production auth provider, billing, desktop/browser agent, map/assets/movement broad redesign was added.

Scope notes:

- `docs/references/` remains an unrelated untracked directory and was not reviewed as part of this task.
- `workmap/apps/web/lib/api/healthApi.ts` and `docs/ai-handoff/pilot-release-checklist.md` are new task files and should be included if committing this task.

## 3. File-Level Diff Review

| File | Review | Risk |
|---|---|---|
| `workmap/.env.example` | Adds local/deployment minimum config comments, `NEXT_PUBLIC_WORKMAP_API_URL`, ports, JWT secret, and pilot hash guidance. | Low |
| `workmap/apps/web/lib/api/apiTypes.ts` | Adds `WorkMapApiHealth` and aligns `WorkMapApiUsageSummary` to backend `/reports/usage-summary` shape. Verified against `reports.service.ts`. | Low |
| `workmap/apps/web/lib/api/healthApi.ts` | Small wrapper for `GET /health`, reuses existing API client. | Low |
| `workmap/apps/web/components/layout/AppShell.tsx` | Improves missing-session state, derives role from pilot session, limits nav when no active role, adds sign-in link. | Low-medium; manual UX check needed. |
| `workmap/apps/web/components/dashboard/ManagerOverviewPanel.tsx` | Reworks dashboard into pilot readiness surface loading health, auth, office positions, compliance policy, and reports summary with fallback/errors. | Medium; needs browser QA for loading/error/layout states. |
| `workmap/apps/web/components/dashboard/AppUsageTable.tsx` | Adds optional title prop. | Low |
| `workmap/apps/web/components/dashboard/WebsiteUsageTable.tsx` | Adds optional title prop. | Low |
| `workmap/apps/web/app/reports/page.tsx` | Updates report boundary wording to API-backed pilot summary language. | Low |
| `workmap/apps/web/components/reports/ReportSummaryPanel.tsx` | Loads reports API via current auth, displays API rows or sparse/fallback explanation, clarifies privacy boundary. | Medium; needs browser QA for sparse/error/overflow states. |
| `docs/ai-handoff/pilot-release-checklist.md` | Adds startup, 5-user pilot QA, and virtual-office regression checklist. | Low |
| `docs/ai-handoff/latest-implementation.md` | Updated implementation handoff for this task. | Low |
| `docs/references/` | Untracked directory, not reviewed. | Do not stage unless intentionally part of another docs task. |

## 4. Issues Found

Blocking issues:

- None found in code review.

Resolved acceptance gate:

- `/virtual-office` returned `500` in implementation smoke against an already-running Next process. User confirmed clean-restart manual QA on frontend `3000` and backend `3001` passes, so this is treated as stale-process/port-state smoke noise rather than a current implementation blocker.

Non-blocking issues / notes:

- Dashboard and Reports now make multiple client-side API calls on mount; failures are displayed rather than crashing.
- Dashboard uses sample people/apps/domains when backend data is missing or sparse, but labels them as pilot examples.
- Reports are current-user scoped only; team aggregate report rows remain labeled frontend examples.
- Compliance acknowledgement readback still depends on browser marker because backend policy GET does not include acknowledgement state.
- AppShell still does not implement full route protection; it improves session clarity and nav visibility only.

## 5. Regression Risks

- Dashboard could show mixed API/sample states; manual QA should confirm labels are clear and not misleading.
- Reports table rows may overflow on narrow viewports because API rows include app/domain names and duration columns.
- AppShell no-session nav is intentionally limited; verify it does not hide a route needed for QA.
- Backend-off state should not crash Dashboard/Reports/Compliance/Virtual Office.
- `/virtual-office` must be rechecked after clean restart because of the recorded stale-process `500`.
- Usage summary shape is now stricter in frontend types; if backend response changes, Reports/Dashboard could silently fall back or render empty states.

## 6. Virtual Office Specific Check

- Map rendering: no TMX/canvas source changes in this diff.
- Avatar movement: no movement/collision/pathfinding code changed.
- Room/zone behavior: no virtual-office room/zone code changed.
- Object interaction: chair `E`, contact drawer, and double-click auto-walk were not changed.
- Presence/activity state: Dashboard reads virtual-office map/positions for readiness display; core polling cadence was not changed.
- Current-user boundary: Dashboard filters positions by authenticated `auth.userId` so manager snapshot excludes the current user.
- Timers/listeners cleanup: no new virtual-office timers/listeners; Dashboard/Reports effects use cancellation guards.
- Desktop/mobile behavior: Dashboard/Reports/AppShell layouts need manual desktop and narrow viewport checks.

## 7. Backend/API/Auth Check

- Request shape: `GET /health` is unauthenticated; Reports and virtual-office readiness calls use `getWorkMapApiAuthOptions()`.
- Response shape: `WorkMapApiUsageSummary` matches backend `reports.service.ts`: `userId`, `apps`, `websites`, `activeSeconds`, `idleSeconds`.
- Error handling: API client returns `ok:false`; Dashboard/Reports collect/display fallback states.
- Validation: Reports optional `userId` remains guarded by existing backend `OptionalUuidPipe`; no backend changes in this task.
- Auth/session behavior: AppShell derives role from pilot session if present, otherwise workflow state, otherwise no-session state.
- Data persistence: no new persistence, no Prisma schema/migration/seed changes.
- Security/privacy: copy avoids claiming screenshots, keystrokes, camera, microphone, messages, full URL history, or full enterprise monitoring.

## 8. Performance and Stability Check

- No new dependencies, websocket, SSE, or background realtime infrastructure.
- Dashboard mount performs health + auth + map/policy/reports calls; acceptable for pilot readiness page but should be checked for noisy error output.
- Reports mount performs auth + usage-summary call.
- Effects use local `cancelled` guards before state updates after async calls.
- Virtual-office core polling/rendering was not changed.
- No server-side rendering data fetch was introduced; new API work runs client-side.

## 9. Verification Suggestions

Implementation handoff reported already passed:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Implementation smoke reported:

- `GET /health` on `127.0.0.1:3001` returned `status: ok`.
- `/dashboard`, `/reports`, `/compliance` on `127.0.0.1:3000` returned `200`.
- `/virtual-office` on the already-running Next process returned `500`; clean restart verification later passed in manual QA.

Manual acceptance completed by user:

- 已干净重启 backend 在 `http://localhost:3001`，frontend 在 `http://localhost:3000`，未混用旧端口或旧进程。
- 已打开 `http://localhost:3001/health`，确认返回 `status: ok`。
- 已打开 `/login`，使用 pilot auth 登录。
- 已刷新页面，确认 AppShell 显示 pilot session；logout/no-session notice 和 `/login` 链接清楚。
- 已打开 `/dashboard`，确认 API health、API auth、Remote presence、Compliance 四个 readiness card 文案清楚。
- 已在 `/dashboard` 确认 Reports API rows 和 pilot example rows 标注不会混淆。
- 已打开 `/reports`，确认 Reports API rows 或 sparse-data explanation 清楚。
- 已打开 `/compliance`，确认 policy/transparency copy 和 acknowledgement 行为仍正常。
- 已重点打开 `/virtual-office`，确认干净重启后不再出现 `500`。
- 已回归 `/virtual-office`：map render、local avatar、position restore/save、polling、People panel、contact drawer、WASD/方向键、collision、double-click auto-walk、chair `E`、room/zone label。
- 已检查桌面和窄屏布局，尤其是 AppShell notice、Dashboard status panel、Reports table/API rows。

## 10. Docs/Skills Update Needs

Codex Chat 1 should later update:

- `docs/skills/project-summary.md`: record pilot readiness Dashboard/Reports/Compliance pass.
- `docs/skills/current-status.md`: record Dashboard health/auth/presence/report readiness behavior and Reports sparse-data boundary.
- `docs/skills/deployment-skill.md`: record required env vars, recommended ports `3000`/`3001`, Prisma setup steps, and that API dev is long-running.
- `docs/skills/api-contract-skill.md`: record `GET /health` and `/reports/usage-summary` response shape.
- `docs/skills/realtime-presence-skill.md`: record that this task preserved polling-only presence and did not add websocket/SSE.

## 11. Fix Request for Implementation Chat

No fix request required.
