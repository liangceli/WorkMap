# Deployment Skill

## Runtime / Tooling

Root project: `workmap/`.

Package manager: `pnpm@9.15.0`.

Monorepo tooling: Turborepo.

Primary commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`

App-specific commands:

- Web: `pnpm --filter @workmap/web dev`, `build`, `lint`, `typecheck`.
- API: `pnpm --filter @workmap/api dev`, `build`, `lint`, `typecheck`.

API local development note:

- As of commit `d7152dd`, `pnpm --filter @workmap/api dev` runs `nest build && node dist/apps/api/src/main.js`.
- This is a reliable build-then-run local startup path for `http://localhost:3001`.
- It is not a watch/hot-reload process.
- The compiled API entry imports `load-local-env.js` before `AppModule` so local `.env` values and compiled workspace package aliases are available.

## Environment Variables

From `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_APP_URL`
- `API_PORT`
- `WORKMAP_JWT_SECRET`

Frontend API client also uses:

- `NEXT_PUBLIC_WORKMAP_API_URL`

Development-only virtual-office API verification can also use:

- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL`
- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`

These override the seeded demo identity used by the frontend development auth bridge for `POST /auth/dev-token`.

## Local API Verification Loop

1. Ensure local `.env` contains `DATABASE_URL`, `API_PORT="3001"`, `NEXT_PUBLIC_APP_URL="http://localhost:3000"`, and `WORKMAP_JWT_SECRET`.
2. Start API from `workmap/`: `pnpm --filter @workmap/api dev`.
3. Confirm `GET http://localhost:3001/health` returns 200.
4. Start web from `workmap/`: `pnpm --filter @workmap/web dev`.
5. Open `http://localhost:3000/virtual-office`.
6. Confirm development auth and virtual-office read requests target backend port 3001.
7. For position persistence QA, confirm `PUT /virtual-office/map/:officeMapId/positions/me` targets backend port 3001 and uses Bearer authorization.
8. For polling presence QA, confirm `GET /virtual-office/map/:officeMapId/positions` repeats about every 4 seconds while visible and about every 15 seconds while hidden.
9. For People/Presence MVP QA, verify People panel, command palette, and backend-off fallback in the browser at `http://localhost:3000/virtual-office` while API runs on `http://localhost:3001`.

## Deployment Caution

`load-local-env.ts` is imported by the API main entry and registers compiled workspace aliases when the compiled local paths exist. It does not overwrite existing environment variables. Production/deployed startup should provide required env vars explicitly and should be reviewed if deployment uses the same compiled entry path.

## Deployment Unknowns

- No concrete hosting target was confirmed.
- Redis is listed in env example but no confirmed runtime usage was found during intake.
- Desktop agent, browser extension, and worker are currently placeholder scaffolds.
