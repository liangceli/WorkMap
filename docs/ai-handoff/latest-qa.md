# Latest QA Handoff

## 1. Overall Conclusion

人工验收通过

QA review result: 本轮 “Build Pilot Auth + Privacy/Compliance Boundary MVP” 已按 workflow 读取 `docs/ai-handoff/latest-implementation.md`，并检查 `git status`、`git diff --stat`、`git diff --name-only`、`git diff`。Diff 与 handoff 基本一致，未发现阻塞级实现问题。用户已完成手动验收，未反馈需要返工的问题。

No fix request required.

## 2. Scope Check

实现整体符合原 Task Brief：

- 新增 pilot-ready `/login` 登录入口，并通过后端 `POST /auth/pilot-login` 获取 JWT。
- 前端持久化并复用 `workmap.pilotSession`，`/virtual-office` 优先使用 pilot Bearer token。
- 保留 development-only dev-token fallback。
- 新增 logout/session clear 行为。
- `/virtual-office` 未引入 websocket/SSE、生产 SSO/OAuth、billing、admin、schema/migration、movement/map/chair/contact drawer 改动。
- People panel 与 compliance 页面补充隐私/合规边界说明。
- Compliance acknowledgement 复用现有 backend policy/acknowledgement API。

Scope notes:

- `artresource.tiled-session` 是 tracked dirty file，看起来与本任务无关，不建议随本轮提交。
- `docs/references/` 是 untracked directory，本轮 QA 未审查，不建议误提交。
- `workmap/apps/web/lib/api/apiAuth.ts` 和 `workmap/apps/web/lib/auth/` 是本轮核心新增文件，提交时需要包含。

## 3. File-Level Diff Review

| File | Review | Risk |
|---|---|---|
| `workmap/apps/api/src/modules/auth/auth.controller.ts` | 新增 `POST /auth/pilot-login`，未破坏现有 `dev-token` / `me` endpoint。 | Low |
| `workmap/apps/api/src/modules/auth/auth.service.ts` | 新增 PBKDF2 pilot password verification、JWT response 复用、production hash guard。未引入新依赖。 | Low-medium；pilot auth 不是完整生产认证。 |
| `workmap/.env.example` | 记录 `WORKMAP_PILOT_PASSWORD_HASH`。 | Low |
| `workmap/apps/web/lib/api/apiTypes.ts` | 新增 auth session/user 和 policy acknowledgement 类型。 | Low |
| `workmap/apps/web/lib/api/authApi.ts` | 新增 `createPilotSession()` wrapper，复用现有 API client。 | Low |
| `workmap/apps/web/lib/api/apiAuth.ts` | 新增统一 API auth resolver：pilot session 优先，dev-token fallback 其次。 | Low |
| `workmap/apps/web/lib/auth/pilotSession.ts` | 新增 session storage、过期清理、Bearer options、role mapping，并保存 workflow state。 | Low-medium；依赖 localStorage，符合 pilot MVP。 |
| `workmap/apps/web/components/login/MockLoginPanel.tsx` | `/login` 转为 pilot sign-in，同时保留 frontend fallback。 | Medium；需人工确认失败登录、刷新、清 session UX。 |
| `workmap/apps/web/components/layout/AppShell.tsx` | 显示 pilot session/role/logout，并区分 demo fallback。 | Low-medium；logout 清 session 但不强制跳转，需人工确认体验。 |
| `workmap/apps/web/components/office/useVirtualOfficeData.ts` | `/virtual-office` 改用 unified auth resolver。 | Low |
| `workmap/apps/web/components/office/OfficeSidePanel.tsx` | 新增 People panel privacy boundary。 | Low |
| `workmap/apps/web/app/compliance/page.tsx` | compliance copy 从 mock preview 改为 pilot transparency boundary。 | Low |
| `workmap/apps/web/components/compliance/CompliancePolicyPanel.tsx` | 使用当前 API auth 加载 policy、提交 acknowledgement，失败时显示安全 fallback copy。 | Low-medium；ack 状态读回依赖浏览器 marker。 |
| `workmap/apps/web/components/compliance/PolicyAcknowledgementModal.tsx` | 更新 policy wording，并增加 busy/disabled acknowledgement 状态。 | Low |
| `workmap/apps/web/lib/api/complianceApi.ts` | 使用共享 acknowledgement response type。 | Low |
| `docs/ai-handoff/latest-implementation.md` | 本轮 implementation handoff。 | Low |
| `artresource.tiled-session` | Tiled session/view state 变化，与任务无关。 | 不建议提交。 |
| `docs/references/` | Untracked directory，未纳入本轮 review。 | 不建议提交，除非确认属于单独 docs 任务。 |

## 4. Issues Found

Blocking issues:

- None found.

Non-blocking issues / notes:

- Pilot login 是 MVP/pilot auth，不是生产级 SSO/OAuth/MFA/password reset。
- Production 环境如果没有配置 `WORKMAP_PILOT_PASSWORD_HASH`，pilot login 会按预期禁用。
- `AppShell` logout 会清除 pilot session 和 workflow state，但不会强制跳转到 `/login`；人工验收时确认当前页面状态是否符合预期。
- Compliance backend policy endpoint 目前不返回 acknowledgement status；前端只在 backend acknowledgement 成功后写 browser marker，刷新可读性依赖 localStorage。
- Login failure path显示通用错误文案，不泄露用户是否存在；这是合理的。
- `artresource.tiled-session` 和 `docs/references/` 不应随本任务误提交。

## 5. Regression Risks

- `/login` 从 mock login 改为 pilot auth surface，可能影响旧的 frontend-only demo onboarding 习惯。
- Pilot session localStorage 过期/清除后，AppShell 和子页面状态需要人工确认无残留混乱。
- `/virtual-office` auth source 切换后，要确认 current user 不会在 remote teammates 中重复出现。
- Compliance acknowledgement 失败时应保持 read-only transparency copy，不应假装已记录。
- Backend off / unauthorized / expired token 情况下，virtual-office 和 compliance 应继续安全 fallback，不应 crash。
- Narrow viewport 下 login/compliance modal/AppShell session pill 可能有布局拥挤风险。

## 6. Virtual Office Specific Check

- Map rendering: 未修改 TMX/canvas source，仍使用既有 map rendering path。
- Avatar movement: 未修改 movement/collision/pathfinding 逻辑。
- Room/zone behavior: 本轮不改变 room/zone mapping，只改变 API auth 来源。
- Object interaction: chair `E`、contact drawer、double-click auto-walk 未在本轮改动。
- Presence/activity state: 继续使用现有 positions polling；pilot Bearer token 优先用于 API calls。
- Current-user boundary: unified auth result 提供 `userId`，应继续过滤 current user，避免自我重复显示为 remote teammate。
- Timers/listeners cleanup: 本轮未新增 websocket/SSE/timer；保持原 polling 行为。
- Desktop/mobile behavior: 需要人工确认 AppShell session UI、People privacy copy 在桌面和窄屏下不遮挡主要地图。

## 7. Backend/API/Auth Check

- Request shape: `POST /auth/pilot-login` 接收 email/password/companySlug；不信任 client user id。
- Response shape: 返回 `accessToken`、`tokenType: Bearer`、`expiresAt`、`user`，与 dev-token response shape 对齐。
- Error handling: API client 会把 backend unavailable / non-2xx 包装为 `ok:false`，前端走 fallback/status 文案。
- Validation: email、companySlug、password 都有基础校验；pilot password hash 格式和最低 iteration 有 guard。
- Auth/session behavior: pilot session 存在时优先使用 Bearer；无 session 时才进入 development dev-token fallback。
- Data persistence: 无 Prisma schema/migration；compliance acknowledgement 使用现有 backend API。
- Security/privacy: 不新增 hidden monitoring；合规文案明确说明不采集 screen/keystroke/camera/mic/private content。

## 8. Performance and Stability Check

- 没有新增依赖、websocket、SSE 或额外后台轮询。
- PBKDF2 verification 在 login 请求上执行，符合 pilot auth 成本范围。
- `getWorkMapApiAuthOptions()` 只在需要 API context 时解析 session/dev-token。
- Compliance load effect 有 `cancelled` guard，避免 unmounted 后继续 setState。
- Virtual-office polling cadence 未改变。
- Browser localStorage session parse 有 try/catch 和 expiry guard。

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
- HTTP smoke for `/health`, `POST /auth/pilot-login`, `/auth/me`, `/compliance/policy`, compliance acknowledgement, `/virtual-office/map`, `/virtual-office/navigation`, `/virtual-office/map/:officeMapId/positions`
- Browser/headless verification for login, session localStorage, compliance acknowledgement marker, virtual-office Bearer requests, People privacy copy, logout clear, backend-off fallback

Manual acceptance completed by user:

- 已确认 backend 在 `http://localhost:3001`，frontend 在 `http://localhost:3000`，端口和浏览器地址一致。
- 已打开 `/login` 并使用 `engineer@workmap.demo` / `workmap-pilot` / `workmap-demo-company` 完成 pilot 登录。
- 已确认 pilot session card 显示用户、role、expiry。
- 已刷新页面并确认 session 仍可读。
- 已在 DevTools Network 检查 `/virtual-office` 请求包含 `Authorization: Bearer ...`。
- 已打开 `/virtual-office` 并确认 canvas、local avatar、remote teammates、People panel 正常。
- 已确认 current user 不重复出现在 remote teammate 列表里。
- 已回归 WASD/方向键、collision、double-click auto-walk、chair `E`、contact drawer、room/zone status。
- 已打开 `/compliance`，确认 policy 能加载，并能完成 acknowledgement。
- 已在 acknowledgement 后刷新 `/compliance`，确认页面显示已确认状态。
- 已点击 AppShell logout / login clear session，确认 `workmap.pilotSession` 和 workflow state 被清掉。
- 已在后端关闭时刷新 `/compliance` 和 `/virtual-office`，确认页面 fallback 安全且无 runtime crash。
- 已检查桌面和窄屏布局，尤其是 login panel、AppShell session area、compliance modal、People privacy copy。

## 10. Docs/Skills Update Needs

Codex Chat 1 should later update:

- `docs/skills/project-summary.md`: 记录 Pilot Auth + Privacy/Compliance Boundary MVP 已实现。
- `docs/skills/api-contract-skill.md`: 记录 `POST /auth/pilot-login` request/response、JWT session shape、compliance acknowledgement endpoints。
- `docs/skills/current-status.md`: 记录 pilot auth、backend Bearer session、virtual-office auth resolver、compliance acknowledgement 状态。
- `docs/skills/backend-skill.md`: 记录 PBKDF2 pilot password hash、production 缺少 `WORKMAP_PILOT_PASSWORD_HASH` 时禁用 pilot login。
- `docs/skills/deployment-skill.md`: 记录本地验收端口必须统一为 frontend `3000`、backend `3001`，以及 production env 需要配置 `WORKMAP_PILOT_PASSWORD_HASH`。

## 11. Fix Request for Implementation Chat

No fix request required.
