# Latest Implementation Handoff

## Original Task Brief

Make the Notices badge update immediately for incoming WorkMap activity and reduce the perceived delay when sending wave, message, or reaction interactions.

## Changed Files

- `workmap/apps/web/components/office/OfficeMap.tsx`

## Implementation Summary

- Incoming realtime wave, message, and reaction events increment the unread badge synchronously when Notices is closed.
- Realtime events schedule database reconciliation at 300ms and 1200ms so the Notice list catches up after persistence.
- Request generations prevent stale polling/fetch responses from overwriting newer unread state.
- An optimistic unread floor prevents a poll from briefly dropping the new badge before the database row is visible.
- While Notices is open, the badge remains zero and unread backend rows are marked read without UI flicker.
- Outgoing wave/message/reaction now sends WebSocket feedback and local animation before waiting for Notice persistence. Persistence failures remain visible and honest.

## Role And Access Behavior

No auth, RBAC, tenant, Platform Admin, Notice API, or database behavior changed. The badge represents incoming unread activity; sent activity updates the sender's Notice list after persistence.

## Verification

- `pnpm --filter @workmap/web typecheck`: passed.
- `pnpm --filter @workmap/web lint`: passed.
- `pnpm --filter @workmap/web build`: passed with the existing Next.js ESLint-plugin warning.
- `git diff --check`: passed; scoped secret scan: no matches.
- Manual two-user browser QA: not run in this environment.

## Intentionally Not Changed And Risks

- No WebSocket protocol, API, Prisma schema, Supabase migration, map, or interaction visuals changed.
- A deployed two-user smoke is still required to measure real network latency and reconnect fallback behavior.

## Suggested Next Step

Deploy Web only, then verify one user sends wave/message/reaction while a second user watches the badge with Notices closed and open.
