# QA Skill

## Verification Commands

Run from `workmap/`:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Targeted commands:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Database setup:

- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm prisma:seed`

## Manual QA Checklist

- `/login` creates expected demo role workflow.
- Onboarding routes advance in expected order.
- `/virtual-office` redirects to avatar onboarding when avatar is missing.
- `/virtual-office` loads TMX map and tileset images.
- With backend stopped or unavailable, `/virtual-office` still renders through mock fallback without runtime crashes.
- With backend unauthorized, `/virtual-office` keeps mock fallback rather than blocking the page.
- With backend/API available, Network should show `/virtual-office/map`, `/virtual-office/navigation`, and `/virtual-office/map/:officeMapId/positions` attempts.
- Valid API rooms, destinations, and remote players should display safely; invalid or empty API parts should fall back safely.
- WASD/arrow movement works and respects collision.
- Double-click auto-walk finds paths or shows `No clear path`.
- `E` near chairs sits/stands.
- Proximity/click on mock remote users opens interaction drawer.
- Command palette people and room navigation still work with API or mock data.
- Desktop and narrow viewport layouts remain usable, with no new blocking API loader.
- Dashboard/employees/reports/compliance/integrations/settings routes render.
- API `GET /health` responds when backend is running.
- Dev token endpoint works against seeded demo users outside production.

## Test Gaps

- No automated test files were found during intake.
- Pathfinding, API contracts, auth guard, and onboarding routing should be prioritized for tests.
- Add coverage for `useVirtualOfficeData.ts` adapters/fallback behavior when a frontend test harness is introduced.

## Latest Verification Notes

For commit `abe673c`, the implementation handoff reports these passed from `workmap/`:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Local HTTP check for `/virtual-office` returned 200. Browser-based interaction QA in the implementation chat was not completed due to local browser/navigation timeout behavior, but the QA handoff records user-confirmed manual testing passed.
