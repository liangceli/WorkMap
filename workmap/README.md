# WorkMap

WorkMap is a 2D virtual office and compliant work visibility platform for hybrid teams.

This repository is a pnpm + Turborepo monorepo scaffold. It currently contains only project structure and base configuration.

## Workspace layout

- `apps/web` - Next.js frontend
- `apps/api` - NestJS API
- `apps/desktop-agent` - future Electron desktop agent
- `apps/browser-extension` - future Chrome/Edge extension
- `apps/worker` - future background worker
- `packages/shared-types` - shared TypeScript types
- `packages/ui` - shared UI package
- `packages/config` - shared configuration helpers
- `packages/domain-utils` - shared domain utilities
- `packages/auth` - shared auth helpers
- `prisma` - Prisma schema and migrations
- `docs` - architecture, API, database, security, testing, handoff, and references

## SkyOffice reference policy

SkyOffice is reference material only. It may be used to study ideas such as Phaser scenes, Tiled maps, player movement, item interaction, proximity interaction, and remote player smoothing.

Do not directly copy SkyOffice code, assets, UI, Redux/Phaser singleton coupling, client-authoritative movement model, PeerJS/video/screen sharing, or password-only private room model into WorkMap.

## How to install

```bash
pnpm install
```

## How to run

```bash
pnpm dev
```

## Useful commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
```
