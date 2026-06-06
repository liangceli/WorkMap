# Latest Implementation Handoff

## 1. Original Task Brief

Fix local env loading so STAGE 2 local development can use only `workmap/.env` and no longer needs `apps/web/.env.local`.

Goals:

- Local API and Web should both read `workmap/.env`.
- `/login` should see root `.env` `NEXT_PUBLIC_COGNITO_*` values and stop incorrectly showing Cognito missing config.
- Do not commit or print real secrets.
- Do not ask the user to paste secrets into chat.
- Preserve Cognito auth priority, backend `email_verified` enforcement, pilot auth fallback, and development-only dev-token behavior.
- Do not change Prisma schema/migrations or virtual-office map/movement/chair/contact drawer behavior.

## 2. Changed Files

This follow-up task changed:

| File | Why it changed |
|---|---|
| `workmap/apps/web/next.config.ts` | Loads the monorepo workspace root `workmap/.env` before Next config export so `pnpm --filter @workmap/web dev` and `pnpm --filter @workmap/web build` can see root `NEXT_PUBLIC_*` env values. Existing platform/shell env values are not overwritten. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Current workspace still also contains the prior STAGE 2 Cognito/deployment baseline diff:

- `workmap/.env.example`
- `workmap/apps/api/package.json`
- `workmap/apps/api/src/main.ts`
- `workmap/apps/api/src/modules/auth/**`
- `workmap/apps/web/app/login/callback/**`
- `workmap/apps/web/components/layout/AppShell.tsx`
- `workmap/apps/web/components/login/MockLoginPanel.tsx`
- `workmap/apps/web/lib/api/**`
- `workmap/apps/web/lib/auth/cognitoSession.ts`
- `workmap/apps/web/package.json`
- `workmap/packages/auth/src/index.ts`
- `docs/ai-handoff/stage2-deployment-readiness.md`

Workspace notes:

- `docs/ai-handoff/latest-qa.md` was written by the review chat and remains modified in the workspace.
- `docs/references/` remains unrelated untracked workspace content.
- No real `.env` contents were read into the handoff or copied into code.

## 3. Implementation Summary

API env loading:

- Inspected `workmap/apps/api/src/load-local-env.ts`.
- API already searches upward from `process.cwd()` for the nearest `.env`, then loads it without overriding existing `process.env`.
- This preserves API support for `workmap/.env`.
- No API code change was needed for this follow-up.

Web env loading:

- Added a root env loader to `workmap/apps/web/next.config.ts`.
- The loader finds the monorepo root by walking upward until `pnpm-workspace.yaml` is found.
- It then loads `workmap/.env` if present.
- It skips comments and blank lines.
- It supports simple quoted values.
- It only sets keys that are not already present in `process.env`.

Vercel behavior:

- Vercel/platform env vars remain first priority because the loader does not overwrite existing environment variables.
- In Vercel, real env values should still be set through the Vercel dashboard.
- If no committed root `.env` exists in deployment, the loader safely does nothing.

Auth behavior:

- Cognito auth priority was not changed.
- Backend `email_verified` enforcement was not changed.
- Pilot auth fallback was not changed.
- Dev-token fallback remains development-only.

## 4. User-Visible Changes

- Local web dev/build can now consume root `workmap/.env`.
- When `NEXT_PUBLIC_COGNITO_*` values are set in `workmap/.env`, `/login` should show the Cognito sign-in path instead of missing-config guidance after restarting the web dev server.
- No additional `apps/web/.env.local` file is required for local STAGE 2 Cognito testing.

## 5. Technical Notes

- The loader intentionally does not print env keys or values.
- The loader does not override platform/shell env values.
- The loader is limited to Next config startup and is meant for local monorepo developer ergonomics.
- No new package dependency was added. `@next/env` was checked but not directly resolvable from the app package, so a small local loader was used instead.
- No secrets were committed.
- No `.env` content was copied into docs or code.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
```

Results:

- All commands passed.
- Web build printed the existing warning that the Next.js plugin was not detected in ESLint config.
- `workmap/apps/web/tsconfig.tsbuildinfo` was restored after verification so it is not part of the implementation diff.

API verification:

- No API files were changed for this follow-up.
- API loading was inspected and already supports root `.env`.

Manual/browser verification still recommended:

- Restart `pnpm --filter @workmap/web dev` after root `.env` changes.
- Open `/login`.
- Confirm Cognito no longer shows missing-config guidance when root `.env` contains the required non-secret public Cognito config.
- Do not paste or screenshot real secrets into chat.

## 7. Manual QA Suggestions

- Ensure `workmap/.env` has the local `NEXT_PUBLIC_COGNITO_*` values set.
- Stop any old web dev server.
- Start `pnpm --filter @workmap/web dev`.
- Open `http://localhost:3000/login`.
- Confirm the Cognito section shows `Sign in with Cognito`.
- Confirm pilot login still works.
- Confirm AppShell still identifies session source correctly.
- Confirm `/virtual-office`, `/dashboard`, `/reports`, and `/compliance` still work with pilot auth.

## 8. Risks / Notes

- Next must be restarted after editing `.env`; already-running dev servers will not automatically pick up the root env change.
- If both platform/shell env and `workmap/.env` define the same key, the platform/shell env wins.
- This does not perform real Cognito sign-in or external deployment.
- This does not replace the need to set env vars directly in Vercel/Render for deployed environments.
- `apps/web/.env.local` is no longer needed for this STAGE 2 local flow, but if someone creates one later, Next's own env behavior may still load it.

## 9. Docs Update Suggestions

- `docs/skills/deployment-skill.md`: record that local WorkMap web now loads root `workmap/.env` via `apps/web/next.config.ts`.
- `docs/skills/current-status.md`: record that local STAGE 2 Cognito testing should use root `.env` and restart the web server after changes.
- `docs/skills/project-summary.md`: note that API and Web now share root `.env` for local development.
