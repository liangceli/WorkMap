# Director Update

## 1. Completed Task

Pilot Auth + Privacy/Compliance Boundary MVP was implemented.

## 2. Accepted Changes

- Added `POST /auth/pilot-login` with PBKDF2 password verification and backend-issued JWT response.
- Added `WORKMAP_PILOT_PASSWORD_HASH` documentation.
- Added browser pilot session storage under `workmap.pilotSession`.
- Added unified API auth resolver: pilot session first, development dev-token fallback second.
- Converted `/login` into a pilot sign-in surface with session display and logout/session clear.
- AppShell now shows pilot session/role context and logout.
- `/virtual-office` now prefers pilot Bearer auth while preserving save/restore/polling behavior.
- Compliance page/panel now use pilot transparency language and existing backend policy/acknowledgement APIs.
- People panel and compliance copy explain visible presence/location/status/freshness and what WorkMap does not monitor.

## 3. Verification Summary

Reported passing from `workmap/`:

- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api build`

Verification passed: web/API lint, typecheck, and build; HTTP smoke for pilot login, `/auth/me`, compliance policy, compliance acknowledgement, and authenticated virtual-office reads; browser/runtime QA for login, session localStorage, compliance acknowledgement marker, virtual-office Bearer requests, People privacy copy, logout clear, and backend-off fallback. User manual acceptance passed.

## 4. Remaining Risks

- Pilot auth is not production SSO/OAuth/MFA/password reset or tenant credential lifecycle.
- Production pilot login requires `WORKMAP_PILOT_PASSWORD_HASH`.
- Compliance policy endpoint does not return acknowledgement status; frontend stores a browser marker after successful acknowledgement.
- App route protection remains lightweight; no full route guard/permission overhaul was added.
- `artresource.tiled-session` and `docs/references/` are unrelated workspace changes.

## 5. Updated Docs

- `docs/skills/current-status.md`
- `docs/skills/api-contract-skill.md`
- `docs/skills/auth-skill.md`
- `docs/skills/backend-skill.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/frontend-skill.md`
- `docs/skills/ui-ux-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/project-summary.md`
- `docs/skills/decision-log.md`
- `docs/ai-handoff/director-update.md`

## 6. Recommended Next Tasks

- Decide production auth roadmap: SSO/OAuth, MFA, password reset, tenant credential lifecycle, route guards.
- Consider adding acknowledgement status to `GET /compliance/policy`.
- Add automated tests for pilot login, session expiry/clear, auth resolver priority, compliance acknowledgement fallback, and virtual-office Bearer auth path.
- Keep final narrow-layout and interaction regression in future release checks.
