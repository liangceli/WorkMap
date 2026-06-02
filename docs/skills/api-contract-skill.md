# API Contract Skill

Base URL:

- Development default for web client: `http://localhost:3001`.
- Production requires `NEXT_PUBLIC_WORKMAP_API_URL` for web-side API calls.

Authentication/context:

- Production: Bearer JWT.
- Development: Bearer JWT or `x-workmap-company-id`, `x-workmap-user-id`, `x-workmap-role` headers.

## Development Auth Bridge

Accepted in commit `2a4a269`: the frontend has a development-only browser helper for local API verification.

`POST /auth/dev-token` request body:

- `email: string`
- optional `companySlug: string`

Expected response type:

- `accessToken`
- `tokenType`
- `expiresAt`
- `user`: includes `id`, `companyId`, `companySlug`, `email`, `displayName`, `role`

Frontend behavior:

- `createDevelopmentToken()` wraps `POST /auth/dev-token`.
- `getDevelopmentApiAuthOptions()` runs only in browser development builds.
- Successful tokens are passed as Bearer auth through existing `ApiClientOptions`.
- Cached token data is stored in `localStorage` under `workmap.devApiAuth` until near expiry.
- Failures return unavailable auth; virtual-office API reads continue without token and keep mock fallback.

Default seeded identity mapping:

- `EMPLOYEE` -> `engineer@workmap.demo`
- `MANAGER` -> `manager@workmap.demo`
- `OWNER` -> `owner@workmap.demo`
- `IT_ADMIN` -> `it.admin@workmap.demo`

Development overrides:

- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL`
- `NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG`

## Confirmed Endpoints

- `GET /health`
- `POST /auth/dev-token`
- `GET /auth/me`
- `GET /companies/current`
- `GET /users/me`
- `GET /users`
- `GET /users/:userId`
- `GET /devices`
- `GET /reports/usage-summary`
- `GET /reports/usage-summary?userId=:userId`
- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`
- `GET /integrations`
- `GET /integrations/contact-links/:targetUserId`
- `GET /compliance/policy`
- `POST /compliance/policy/:policyId/acknowledgement`

## Virtual Office Response Shapes

`GET /virtual-office/map` returns:

- `id`, `name`, `slug`, `width`, `height`, `tileSize`, `mapData`
- `rooms[]`: `id`, `name`, `type`, `zoneData`, `autoStatus`

`GET /virtual-office/navigation` returns room-derived navigation destinations:

- `id`, `name`, `type`, `anchor`, `bounds`, `autoStatus`, `peopleCount`

`GET /virtual-office/map/:officeMapId/positions` returns:

- `userId`, `displayName`, `avatarId`, `x`, `y`, `direction`, `isMoving`, `status`, optional `roomId`, `updatedAt`

## Frontend Virtual Office Read Loader

Accepted in commit `abe673c` and updated in `2a4a269`: `/virtual-office` now has a read-only frontend loader that asks for development auth in local browser development, then attempts:

- `GET /virtual-office/map`
- `GET /virtual-office/navigation`
- `GET /virtual-office/map/:officeMapId/positions`

The loader validates response shapes before adapting them into frontend rooms, navigation destinations, and remote players. It keeps `mockOfficeData.ts` fallback for failed, unauthorized, invalid, empty, or partial API responses.

Important contract assumptions:

- Backend `zoneData`, navigation `anchor`, and navigation `bounds` must use the same pixel coordinate space as the current TMX map.
- Backend `OfficeMap.mapData` is not used for frontend canvas rendering.
- API positions do not currently include frontend role/profile-route metadata; frontend maps role to `Team member`.

## Important Gaps

- No public controller route currently exposes `persistLatestPosition`.
- No write, polling, websocket, or realtime position sync contract has been added.
