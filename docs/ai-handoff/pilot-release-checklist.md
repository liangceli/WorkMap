# Pilot Release Checklist

## Local Startup

Use these ports for pilot QA unless a human intentionally changes them:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

Minimum environment:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WORKMAP_API_URL`
- `API_PORT`
- `WORKMAP_JWT_SECRET`
- `WORKMAP_PILOT_PASSWORD_HASH`

Setup commands from `workmap/`:

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

Manual startup commands from `workmap/`:

```powershell
pnpm --filter @workmap/api dev
pnpm --filter @workmap/web dev
```

Notes:

- The current API `dev` script builds and then starts the compiled API process. It is a long-running server command, not a verification command that exits by itself.
- Keep frontend on `3000` and backend on `3001` for QA consistency.
- For automated verification, use lint/typecheck/build commands rather than blocking dev server commands.

Startup smoke checks:

- `GET http://localhost:3001/health` returns `status: ok`.
- `/login` can create a pilot session.
- `/virtual-office` loads with Bearer API requests when signed in.
- `/dashboard` shows API health/auth/presence readiness or clear fallback state.
- `/reports` shows Reports API usage rows or a sparse-data explanation.
- `/compliance` loads policy copy and acknowledgement state safely.

## 5-User Pilot QA

Use seeded/demo pilot accounts where available.

- Confirm five pilot users can be represented through seeded users, pilot auth, or API/dev-token setup.
- Log in and log out.
- Refresh after login and confirm session state remains understandable.
- Open `/virtual-office` with multiple users represented in positions.
- Move the current user and confirm remote/polling updates remain visible.
- Refresh and confirm current-user position restore/save still works.
- Confirm the current user is not duplicated as a remote teammate.
- Confirm People panel cards use readable room/area labels and never raw UUID labels.
- Confirm People panel filters and command palette still work.
- Confirm privacy/compliance copy explains visible presence/location/status/freshness and what WorkMap does not monitor.
- Acknowledge compliance policy and refresh to confirm browser acknowledgement marker behavior.
- Open `/dashboard` and confirm health/auth/presence/compliance/report readiness states are clear.
- Open `/reports` and confirm available API data or sparse pilot limitation is clear.
- Open `/compliance` and confirm policy/transparency copy and acknowledgement action are understandable.
- Stop the backend and confirm `/virtual-office`, `/dashboard`, `/reports`, and `/compliance` do not crash.
- Check desktop and narrow viewport layouts for AppShell, virtual office side panels, dashboard, reports, and compliance.

## Virtual Office Regression

Do not accept the pilot unless these still work:

- Pilot Bearer auth on virtual-office read/save calls.
- Backend-off mock fallback.
- Map rendering.
- Current-user restore/save.
- Positions polling.
- People panel.
- Contact drawer.
- WASD and arrow-key movement.
- Collision.
- Double-click auto-walk.
- Chair `E` interaction.
- Room/zone labels remain readable and do not depend on hardcoded UUIDs.
