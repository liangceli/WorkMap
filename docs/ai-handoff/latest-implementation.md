# Latest Implementation Handoff

## 1. Original Task Brief

STAGE 2 Round 4: Realtime Virtual Office Movement + Smooth Remote Avatars.

Implement real-time multi-user movement for `/virtual-office` so authenticated users in the same company/workspace/office map can see each other move through WebSocket updates. The backend must authenticate sockets, enforce company/officeMap isolation, broadcast only within the same tenant room, avoid database writes on every movement frame, preserve existing polling and durable position save/restore, and keep remote avatars visually smooth through interpolation.

Explicitly out of scope: Render/Vercel troubleshooting, desktop agent, browser extension, app/domain tracking, map expansion, billing, full membership migration, Prisma schema changes unless unavoidable, TMX/map asset changes, movement/collision/pathfinding rewrites, and chair/contact drawer redesign.

## 2. Changed Files

| File | Why it changed |
|---|---|
| `workmap/packages/shared-types/src/index.ts` | Added shared virtual-office realtime event and payload types for join, move, player state, presence, and errors. |
| `workmap/apps/api/src/modules/auth/request-context-resolver.service.ts` | New reusable auth resolver for Cognito Bearer, WorkMap/pilot Bearer, and existing development headers for HTTP guard reuse. |
| `workmap/apps/api/src/modules/auth/auth.module.ts` | Registered/exported the shared request context resolver. |
| `workmap/apps/api/src/modules/auth/request-context.guard.ts` | Reused the resolver so HTTP request context behavior stays aligned with WebSocket auth logic. |
| `workmap/apps/api/src/modules/virtual-office/virtual-office.service.ts` | Added realtime join context lookup: validates officeMap ownership, loads current user profile/avatar/status/role, and returns valid room IDs for move validation. |
| `workmap/apps/api/src/modules/virtual-office/virtual-office-realtime.gateway.ts` | New native WebSocket gateway attached to `/virtual-office/realtime`; authenticates handshake, manages tenant-scoped rooms, validates movement, rate-limits broadcasts, and sends presence/error events. |
| `workmap/apps/api/src/modules/virtual-office/virtual-office.module.ts` | Registered the realtime gateway provider. |
| `workmap/apps/web/lib/api/realtimeApi.ts` | Added API-base-derived realtime URL helper; `http` becomes `ws`, `https` becomes `wss`, and no new env is required. |
| `workmap/apps/web/components/office/useVirtualOfficeRealtime.ts` | New frontend hook for socket connection, join, reconnect, throttled movement sends, fallback state, and remote player-state handling. |
| `workmap/apps/web/components/office/OfficeMap.tsx` | Wired realtime movement into the existing animation loop, added remote interpolation refs, preserved polling reconciliation, and used rendered remote positions for canvas hit testing/contact navigation. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for Diff Review & QA and Project Context & Docs. |

Pre-existing workspace note:

- `docs/references/` remains unrelated untracked workspace content and was not modified.

## 3. Implementation Summary

Implemented Round 4 realtime movement without adding dependencies, changing Prisma schema, or replacing existing polling/persistence.

Backend:

- Added a native WebSocket gateway on the existing Nest HTTP server via the Node `upgrade` event.
- Endpoint: `/virtual-office/realtime`.
- Authenticates during handshake using the same Cognito/WorkMap JWT resolution path as HTTP APIs.
- Uses room key `companyId:officeMapId`.
- Validates `officeMapId` belongs to the authenticated user's company before joining.
- Validates optional `roomId` against rooms belonging to the joined office map.
- Broadcasts movement only to other sockets in the same company/map room.
- Does not write WebSocket movement frames to the database.

Frontend:

- Connects only when API auth options and `officeMapId` are available.
- Joins the current office map room.
- Sends local movement snapshots at a throttled cadence.
- Keeps polling presence active as fallback/reconciliation.
- Stores remote realtime targets in refs to avoid React re-render storms.
- Interpolates canvas-rendered remote avatars toward their latest realtime target positions.

## 4. User-Visible Changes

- Same-company users in the same `/virtual-office` map should see each other move in near real time.
- Remote avatars should glide toward new positions instead of waiting for 4-second polling jumps.
- Existing local movement, collision, double-click auto-walk, chair interaction, contact drawer, People panel, position save/restore, and polling fallback are preserved.
- In development console, `/virtual-office` logs realtime connection state such as `fallback`, `connecting`, `connected`, or `reconnecting`.

## 5. Technical Notes

### WebSocket Architecture

- Backend gateway file: `workmap/apps/api/src/modules/virtual-office/virtual-office-realtime.gateway.ts`.
- It uses Node's native HTTP upgrade + WebSocket frame handling instead of adding `socket.io`, `ws`, or Nest WebSocket packages.
- Reason: no existing WebSocket dependency was present, and the required protocol surface is intentionally narrow.
- No package or lockfile changes were made.

### Auth Handshake

- Browser connects to:
  - `ws://<api-host>/virtual-office/realtime?token=<accessToken>` locally
  - `wss://<api-host>/virtual-office/realtime?token=<accessToken>` when API base URL is HTTPS
- The backend converts the query token into Bearer auth during handshake.
- Auth resolution order is the existing order:
  - Cognito Bearer token
  - WorkMap/pilot Bearer token
  - development headers only for HTTP guard outside production
- WebSocket uses Bearer tokens from the frontend auth bridge; it does not trust client-provided `companyId`, `userId`, `role`, or tenant data.
- Origin check uses existing env patterns: `WORKMAP_ALLOWED_ORIGIN`, `NEXT_PUBLIC_APP_URL`, or local `http://localhost:3000` defaults.

### Tenant Room Isolation

- Room key is computed only on the backend as `companyId:officeMapId`.
- On `office:join`, backend verifies:
  - authenticated context exists
  - role has `canAccessVirtualOffice`
  - `officeMapId` is a valid UUID
  - office map belongs to `context.companyId`
- On `player:move`, backend verifies:
  - socket already joined a validated room
  - x/y are finite numbers
  - direction/status/isMoving are valid
  - optional `roomId` is a UUID and belongs to the joined office map
- Broadcast excludes the sender and is limited to the same backend room set.

### Event Names / Payloads

Client to server:

- `office:join`: `{ officeMapId }`
- `office:leave`
- `player:move`: `{ x, y, direction, isMoving, status, roomId? }`

Server to client:

- `player:state`: `{ userId, displayName, avatarId, role, officeMapId, x, y, direction, isMoving, status, roomId?, updatedAt }`
- `office:presence`: `{ officeMapId, users: [...] }`
- `office:error`: `{ message }`

### Movement Throttle Strategy

- Frontend sends at roughly 110ms while visible.
- Hidden tabs slow to roughly 1000ms.
- Important changes such as stop, room change, or status change send promptly.
- Server also rate-limits accepted movement per socket to a minimum 50ms interval.
- Existing `PUT /virtual-office/map/:officeMapId/positions/me` remains the durable latest-position persistence path and is still throttled separately.

### Remote Interpolation Strategy

- `OfficeMap` keeps realtime remote state in refs, not React state.
- Each remote has rendered `x/y`, target `x/y`, direction, status, and `lastRealtimeAt`.
- Each canvas frame interpolates rendered position toward target using a fixed interpolation rate.
- Large jumps over 260px or stale realtime states snap safely instead of sliding unrealistically.
- Realtime avatar signature only changes when remote `userId:avatarId` changes, so normal movement does not reload avatar assets or restart the TMX loop.
- A cancellation guard was added to the map asset loading effect so old async loads cannot start duplicate animation loops after dependency changes.

### Fallback / Polling Behavior

- Existing `useVirtualOfficeData()` polling remains active.
- Polling still reconciles remote players and current-user position.
- If WebSocket auth/connect fails, the page remains usable with polling/mock fallback.
- If a realtime remote becomes stale, the interpolation ref is dropped and polling becomes the source of truth again.

## 6. Verification Results

Commands run from `workmap/`:

```powershell
pnpm --filter @workmap/api lint
pnpm --filter @workmap/api typecheck
pnpm --filter @workmap/api build
pnpm --filter @workmap/web lint
pnpm --filter @workmap/web typecheck
pnpm --filter @workmap/web build
```

Results:

- API lint passed.
- API typecheck passed.
- API build passed.
- Web lint passed.
- Web typecheck passed.
- Web build passed.
- Web build still prints the existing warning that the Next.js plugin was not detected in the ESLint config.
- `workmap/apps/web/tsconfig.tsbuildinfo` was restored after build verification.

Not run:

- No Prisma migration command was run because no schema/migration changed.
- No local browser realtime two-user manual QA was run in this chat.
- No deployed Render/Vercel smoke was run, per task scope.

## 7. Manual QA Suggestions

Use local ports consistently:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`

Realtime QA:

1. Start API and web.
2. Log in as OWNER in browser A.
3. Log in as EMPLOYEE in browser B or InPrivate.
4. Confirm both users are in the same company/workspace.
5. Open `/virtual-office` in both browsers.
6. Move OWNER and confirm EMPLOYEE sees OWNER move smoothly.
7. Move EMPLOYEE and confirm OWNER sees EMPLOYEE move smoothly.
8. Confirm direction and walking/stop state look reasonable.
9. Confirm current user is not duplicated as a remote player.
10. Confirm People panel and contact drawer still work.
11. Refresh one browser and confirm latest position restore still works.
12. Stop/restart API or block socket if practical and confirm polling/fallback remains safe.

Tenant isolation QA:

1. Use or create two different companies.
2. Open `/virtual-office` as users from different companies.
3. Confirm they do not receive each other's realtime movement.
4. Try invalid or wrong-company `officeMapId` join if practical.
5. Confirm join fails safely and no cross-tenant events are received.

Regression QA:

1. WASD/arrow movement.
2. Collision.
3. Double-click auto-walk.
4. Chair `E` interaction.
5. Room/zone status.
6. Contact drawer.
7. Dashboard.
8. Reports.
9. Compliance.
10. Employees page.

## 8. Risks / Notes

- This is an in-memory realtime gateway. Multiple API instances would need a shared pub/sub adapter before scaled deployment can provide cross-instance realtime rooms.
- The browser passes the access token in the WebSocket URL query because native `WebSocket` cannot set custom Authorization headers. This should be WSS in deployed HTTPS environments.
- `office:presence` is emitted by the backend, but the current frontend uses `player:state` plus existing polling for rendered positions and People panel stability.
- The gateway intentionally does not persist every move; latest-position durability still depends on the existing throttled HTTP save path.
- Existing minimal bridge limitations remain: `Company` is the tenant root and `User.companyId + User.role` is still the current membership model.
- No full `CompanyMembership` / `TenantMembership` migration was introduced.
- No secrets or real `.env` values were read or committed.
- `docs/references/` remains unrelated untracked content.

## 9. Docs Update Suggestions

- `docs/skills/realtime-presence-skill.md`: record native WebSocket endpoint, event names, room model, throttling, interpolation, and polling fallback.
- `docs/skills/backend-skill.md`: document `RequestContextResolverService`, WebSocket auth reuse, tenant room isolation, and no-per-frame-DB-write rule.
- `docs/skills/api-contract-skill.md`: document `/virtual-office/realtime` event payloads and failure behavior for unauthenticated/invalid officeMap joins.
- `docs/skills/current-status.md`: update status from polling-only to WebSocket movement plus polling reconciliation.
- `docs/skills/project-summary.md`: note remaining deployment scaling risk for multi-instance realtime pub/sub.

## 10. Next Chat Input

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
