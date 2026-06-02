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

## Environment Variables

From `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_APP_URL`
- `API_PORT`

Frontend API client also uses:

- `NEXT_PUBLIC_WORKMAP_API_URL`

Development-only virtual-office API verification can also use:

- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL`
- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`

These override the seeded demo identity used by the frontend development auth bridge for `POST /auth/dev-token`.

## Deployment Unknowns

- No concrete hosting target was confirmed.
- Redis is listed in env example but no confirmed runtime usage was found during intake.
- Desktop agent, browser extension, and worker are currently placeholder scaffolds.
