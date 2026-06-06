# Latest QA Handoff

## 1. QA 结论

结论：通过 QA review，可以进入人工测试。

本轮 QA 接手 STAGE 2 Round 1: Online Deployment + Cognito Auth Baseline，已读取：

- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`（原文件内容存在乱码，本次已重写为干净中文 QA 报告）
- `docs/ai-handoff/director-update.md`

已检查：

- `git status --short`
- `git diff --stat`
- `git diff`
- 关键 auth/deployment 文件
- lint/typecheck/build
- 本地 API/Web smoke
- secret 文本扫描

未发现阻塞级代码问题。无需回 Codex Chat 2 返工。

## 2. 当前工作区状态

当前 diff 包含 STAGE 2 Cognito/deployment baseline 与后续 root `.env` local loading follow-up。

主要变更范围：

- `workmap/.env.example`
- `workmap/apps/api/package.json`
- `workmap/apps/api/src/main.ts`
- `workmap/apps/api/src/modules/auth/*`
- `workmap/apps/web/app/login/callback/page.tsx`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/login/MockLoginPanel.tsx`
- `workmap/apps/web/lib/api/*`
- `workmap/apps/web/lib/auth/cognitoSession.ts`
- `workmap/apps/web/next.config.ts`
- `workmap/apps/web/package.json`
- `workmap/packages/auth/src/index.ts`
- `docs/ai-handoff/stage2-deployment-readiness.md`
- `docs/ai-handoff/latest-implementation.md`
- `docs/ai-handoff/latest-qa.md`

Untracked note:

- `docs/references/` 仍是无关 untracked 内容，本轮未审查，不建议随本任务 stage/commit。

## 3. Secret / Key Review

结果：未发现真实 secret 被提交。

已检查内容包括 AWS key pattern、private key marker、常见 token prefix、JWT-looking value、Supabase URL、Postgres URL。

扫描命中：

- `workmap/.env.example` 中的本地示例 `DATABASE_URL="postgresql://workmap:workmap@localhost:5432/workmap?schema=public"`，这是 localhost 示例，不是真实 Supabase secret。
- `WORKMAP_PILOT_PASSWORD_HASH` 示例 hash 与代码里的 local fallback hash 一致，文档明确标注不要作为生产密码复用。

未发现：

- AWS access key / secret access key
- Cognito 真实 user pool/app client secret
- Supabase 真实连接串
- Render/Vercel secret
- 私钥 PEM
- OpenAI/slack-style token

注意：本轮没有读取或复制真实 `workmap/.env` 内容。浏览器 smoke 只观察到 `/login` 是否显示 Cognito 配置状态，没有输出任何实际 env 值。

## 4. Auth / Session Review

通过点：

- 后端 Cognito JWT 验证独立在 `CognitoJwtService`，配置缺失时返回 `null`，不会阻断原有 pilot JWT。
- `RequestContextGuard` 的优先级是 Cognito bearer -> WorkMap JWT -> development header fallback。
- Cognito token 验证检查 issuer、audience/client id、expiry、nbf、RS256 signature/JWKS。
- Cognito 到 WorkMap 映射不信任前端 company/user/role；`companyId`、`userId`、`role` 来自 Prisma。
- `email_verified` 必须是 boolean `true` 或 string `"true"`，未验证邮箱会被拒绝。
- 临时 STAGE 2 email mapping 支持 `WORKMAP_COGNITO_COMPANY_SLUG` 缩小公司范围；同邮箱跨公司歧义会被拒绝。
- pilot login 仍存在，API 级 smoke 成功返回 backend-issued Bearer token。
- dev-token fallback 仍限制在 `NODE_ENV !== "production"`。

风险 / 注意：

- 前端 `getWorkMapApiAuthOptions()` 如果发现本地 Cognito session 但后端 mapping 失败，会返回 unavailable，不会继续自动尝试 pilot session。这个选择符合“Cognito 优先且 mapping 失败要显式暴露”的安全倾向，但人工测试时需要确认“清除 Cognito session 后 pilot fallback 可恢复”。
- Cognito callback 在 token exchange 成功后会先保存 Cognito session，再调用 `/auth/me` mapping。如果 mapping 失败，用户需要回 `/login` sign out/clear session，或清理浏览器 storage 后再用 pilot auth。

## 5. Deployment Readiness Review

通过点：

- `.env.example` 明确分出 frontend public env、backend/server env、Cognito backend JWT config、pilot fallback config。
- `docs/ai-handoff/stage2-deployment-readiness.md` 覆盖 Vercel、Render、Supabase、Cognito 手动配置。
- Vercel frontend build command: `pnpm --filter @workmap/web build`。
- Render backend start command: `pnpm --filter @workmap/api start`，且 `apps/api/package.json` 已新增 `start`。
- API CORS 从 `WORKMAP_ALLOWED_ORIGIN` / `NEXT_PUBLIC_APP_URL` 读取。
- Web `next.config.ts` 会在 local dev/build 时读取 workspace root `workmap/.env`，且不覆盖已有 platform/shell env。

Manual Action Required：

- 在 Vercel 设置真实 `NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_WORKMAP_API_URL`、`NEXT_PUBLIC_COGNITO_*`。
- 在 Render 设置真实 `DATABASE_URL`、`WORKMAP_ALLOWED_ORIGIN`、`WORKMAP_JWT_SECRET`、`WORKMAP_PILOT_PASSWORD_HASH`、`WORKMAP_COGNITO_*`。
- 在 Supabase 创建/选择 Postgres，使用真实连接串运行 Prisma generate/migrate/seed。
- 在 AWS Cognito 创建/选择 User Pool、Hosted UI domain、browser PKCE app client、callback/logout URL、scopes。
- Cognito 用户必须有 verified email，并且该 email 必须能映射到现有 WorkMap user。
- 部署后必须用真实 Vercel/Render URL 做 smoke；本轮未执行真实外部部署。

## 6. Scope Guard Review

未发现越界实现：

- 未新增 Prisma schema/migration。
- 未实现 multi-tenant schema 或 tenant provisioning。
- 未实现 desktop agent。
- 未实现 browser extension。
- 未新增 websocket/SSE/realtime transport。
- 未扩展 virtual-office map/assets/movement/chair/contact drawer。
- 未新增 production account lifecycle、MFA、password reset、tenant admin。

文档中提到 multi-tenant / Cognito sub mapping 仅作为 future round 决策项，不是本轮实现。

## 7. Regression Review

Virtual Office：

- 本轮 diff 未改 virtual-office map/movement/collision/pathfinding/chair/contact drawer 核心文件。
- `pnpm --filter @workmap/web build` 成功构建 `/virtual-office`。
- 干净启动后 HTTP `GET /virtual-office` 返回 `200 OK`。
- 浏览器 smoke 访问 `/virtual-office` 后按当前缺头像状态跳到 `/onboarding/avatar`，页面可渲染且有 avatar builder 内容。
- 仍需要人工完成完整 virtual-office 交互回归：地图加载、本地 avatar、save/restore、polling、People panel、contact drawer、WASD/collision、auto-walk、chair `E`、room labels、desktop/narrow layouts。

Dashboard / Reports / Compliance：

- 本轮 diff 未改 dashboard/reports/compliance 核心组件。
- 浏览器 smoke 可打开 `/dashboard`、`/reports`、`/compliance`，没有可见应用错误。
- 未登录状态显示 fallback / sign-in guidance，符合 pilot QA 边界。
- 仍需要人工以 pilot session 进入后确认 API-backed 状态和 compliance acknowledgement 行为。

Pilot Login：

- API 级 `POST /auth/pilot-login` 使用 seeded user `engineer@workmap.demo`、`workmap-pilot`、`workmap-demo-company` 成功，返回 Bearer token、EMPLOYEE role、companySlug。
- 浏览器用 `127.0.0.1:3000` 测 pilot login 会受 CORS origin 影响，不应作为失败判定；文档推荐 URL 是 `http://localhost:3000`。
- 浏览器点击 pilot login 时有一次工具侧超时，未能完整确认 UI session card；人工测试需优先覆盖。

## 8. Verification Results

从 `C:\Users\lilia\WorkMap\workmap` 运行：

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
```

结果：

- 全部通过。
- Web build 仍有既有 warning：Next.js plugin was not detected in ESLint configuration。

本地 smoke：

- API `GET http://127.0.0.1:3001/health` 返回 `status: ok`。
- API `POST /auth/pilot-login` 返回有效 pilot Bearer token。
- 干净启动后 Web `/login`、`/dashboard`、`/reports`、`/compliance`、`/virtual-office` HTTP/page smoke 通过。
- `/login` 在当前本地环境显示 `Sign in with Cognito`，说明 root `.env` public Cognito config 能被 Web dev server 读取；未输出实际 Cognito env 值。

## 9. Fix Request for Codex Chat 2

无必须返工项。

可选改进，不阻塞本轮：

- 如果产品期望“存在 Cognito session 但 mapping 失败时仍自动使用 pilot session”，需要 Codex Chat 2 调整前端 auth fallback 策略；当前实现选择显式暴露 Cognito mapping failure。
- 可考虑在文档中更醒目标注 local browser smoke 应使用 `http://localhost:3000`，不要用 `http://127.0.0.1:3000`，否则 CORS origin 可能不匹配。

## 10. Manual Test Checklist

建议你人工测试：

- 使用 `http://localhost:3000`，不要用 `127.0.0.1`。
- 启动 API：`pnpm --filter @workmap/api dev`。
- 启动 Web：`pnpm --filter @workmap/web dev`。
- 打开 `/login`，确认 Cognito 区域在配置完整时显示 `Sign in with Cognito`。
- pilot login：选择 seeded user，输入 seeded password，确认 session card / AppShell session source / open office。
- 清除/退出 Cognito session 后，确认 pilot login fallback 仍可用。
- Cognito verified user 登录，确认 `/login/callback` 能完成 token exchange，`/auth/me` mapping 成功。
- Cognito unmapped user，确认显示 controlled mapping failure。
- Cognito unverified email，确认后端拒绝。
- `/virtual-office`：地图、avatar、save/restore、People panel、contact drawer、WASD/collision、auto-walk、chair `E`。
- `/dashboard`：API health/auth/presence/compliance/report readiness 状态。
- `/reports`：API usage summary 或 sparse-data explanation。
- `/compliance`：policy load、acknowledgement、刷新后的 browser marker 行为。
- backend stopped 时 Dashboard/Reports/Compliance/Virtual Office 不应崩溃。

## 11. Final Recommendation

- 是否通过 QA review：通过。
- 是否需要回 Codex Chat 2 返工：不需要。
- 是否可以进入人工测试：可以。
- 是否建议 commit：建议在人工测试通过后 commit；commit 时不要包含 `docs/references/`，除非另有明确意图。

## 12. Manual Test Progress Update

本轮人工测试后续进展：

- Local `/login` 打开正常。
- Pilot login 使用 seeded user / seeded password 通过。
- `/virtual-office` 基础进入流程通过。
- `/dashboard`、`/reports`、`/compliance` 本地手测未发现阻塞问题。
- Supabase 手动执行 Prisma migration SQL 通过。
- Supabase 手动插入最小 seed 数据通过。

外部部署状态：

- Render 初次部署失败发生在 GitHub `main` commit `42eb0bca555962f080c0b8e7dbd9dfdd075675c5`。
- 当前 STAGE 2 代码仍在本地工作区，尚未 commit/push，因此 Render 部署的是旧代码。
- 该 Render 失败不应视为本轮实现缺陷。
- Render/Vercel deployed smoke 延后到 commit/push 之后的下一轮 deployment review。

下一步建议：

- 收口本轮 QA。
- 确认 commit scope，排除 `docs/references/`。
- Commit/push STAGE 2 代码。
- 下一轮重新执行 Render deploy、Vercel deploy、Cognito callback/logout URL 更新、deployed smoke。
