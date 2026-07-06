# Codex Project Takeover Baseline

Date: 2026-07-04  
Scope: repository and documentation onboarding only

## Repository Boundary

- True Git root: `C:\Users\lilia\WorkMap`.
- Active pnpm/Turborepo monorepo: `C:\Users\lilia\WorkMap\workmap`.
- Root-level TMX/TSX files are WorkMap map-authoring assets; they are not a separate project.
- Existing modified and untracked files belong to the user and must not be reverted, deleted, or folded into unrelated changes.

## Documents Reviewed

- All files under `docs/ai-handoff/`.
- All files under `docs/ai-skills/`.
- All files under `docs/api/`.
- Required current operating references under `docs/skills/`, including project status, frontend, API contracts, QA, deployment, Virtual Office, and realtime presence.
- Root `AGENTS.md`.

## Source-Of-Truth Order

Some documentation describes different project eras. Use this order when facts conflict:

1. Current repository code, Prisma schema, package scripts, Git history, and working-tree state.
2. Latest `docs/ai-handoff/` implementation and QA evidence.
3. `docs/skills/current-status.md` and relevant domain skills, after checking their update date.
4. `docs/ai-skills/` and proposal/status documents under `docs/api/` as historical constraints and design context.

The May 2026 `docs/ai-skills/` and several `docs/api/` files still describe activity ingestion, realtime, authentication, and client packaging as future or scaffold work. They remain valuable for privacy and architecture intent, but they must not override the newer implementation or Git evidence.

## Current Product Understanding

WorkMap is a privacy-conscious 2D virtual office and work-visibility platform for hybrid teams.

Primary runtime areas:

- `apps/web`: Next.js 15 / React 19 frontend with Cognito and pilot auth paths, onboarding/invitations, role-aware SaaS pages, Canvas/TMX Virtual Office, realtime presence, reports, compliance, and Platform Admin surfaces.
- `apps/api`: NestJS 11 API with Prisma/Postgres, tenant request context, RBAC, Cognito/pilot/dev auth paths, invitations, devices, activity ingestion, reports, Virtual Office HTTP/WebSocket behavior, compliance, audit logging, and independent Platform Admin boundaries.
- `apps/desktop-agent`: Electron-based Windows Agent version `0.5.0`, Windows foreground/idle/lock collection, pairing, protected credentials, bounded offline queue/retry, tray/auto-start behavior, and NSIS packaging.
- `apps/browser-extension`: local Manifest V3 Chrome/Edge client for hostname-duration tracking with pairing/credential and recovery logic; distribution/store readiness remains separate work.
- `apps/worker`: placeholder; current summary writes are not evidence of a mature background aggregation platform.
- `packages/*`: shared types, auth context, configuration, UI, and domain utilities.

The Prisma model currently includes companies, departments, users, invitations, devices, pairing codes, device credentials, Agent sessions, activity events and summaries, office maps/rooms/positions, monitoring policy acknowledgements, integrations, notices, and tenant/platform audit logs.

## Security, Privacy, And Access Boundaries

- Never collect screenshots, screen recordings, keystrokes, clipboard data, microphone/camera data, full URLs, page bodies, form/password content, email bodies, or private Teams/message content.
- Tracking is limited to approved app/domain-duration, activity/session, heartbeat, device, and tenant/user identity metadata.
- Browser data is hostname/domain only; URL paths, queries, fragments, and page content stay out of scope.
- Backend-derived identity, tenant, role, and device ownership are authoritative. Frontend role visibility is UX, not security.
- Preserve Owner / Employee / Platform Admin separation. Platform Admin is independent from tenant OWNER and does not receive employee-level activity details by default.
- Manager/Owner sensitive reads must remain scoped and audited.
- Demo/fallback/example data must remain clearly labelled and must never be represented as live production data.
- The new deferred activity-monitoring compliance framework in the working tree is policy guidance, not implemented runtime behavior or legal advice.

## Deployment And Release Understanding

- Intended platform: Vercel frontend, Render API, Supabase Postgres, AWS Cognito Hosted UI/JWT.
- Public alpha smoke has historical pass evidence, but environment/provider changes require the smoke and authenticated manual flows to be repeated.
- Realtime is single-process/in-memory until shared pub/sub is implemented; use one API instance for this architecture.
- Secrets, bearer tokens, database URLs, pilot identities, and platform-admin identities must remain outside repository documents and chat.
- The latest Desktop Agent release still requires external publication/deployment wiring, Windows code signing, and separate-computer manual QA before broad production claims.
- A browser can download the installer but cannot automatically launch it; user initiation remains required.

## Known Documentation Drift

- `docs/skills/current-status.md` is dated 2026-06-17 and predates the 2026-06-21/22 Desktop Agent, Agent Session, report, and browser-extension commits.
- `docs/skills/project-summary.md` still calls the Desktop Agent and extension scaffolds, while newer code/handoffs show substantial alpha implementations.
- Several `docs/api/` files dated 2026-05-30/31 are proposals or pre-implementation maps and no longer enumerate the complete API surface.
- `docs/ai-handoff/latest-qa.md` contains strong local release evidence but still records external Desktop Agent publication, signing, and separate-machine QA as outstanding.
- The user currently has an uncommitted documentation-only compliance framework. It must be preserved and must not be described as implemented.

## Working Tree At Takeover

The takeover began with these pre-existing user changes:

- Modified: `docs/ai-handoff/latest-implementation.md`.
- Modified: `docs/skills/README.md`.
- Untracked: `docs/skills/activity-monitoring-compliance-skill.md`.
- Untracked: `docs/references/`.

This onboarding round adds only takeover/handoff documentation and does not change application code, API behavior, schema, auth, RBAC, deployment, or runtime tracking.

## Operating Plan For Future Rounds

1. Start every round with the root/status/required-doc checks in `AGENTS.md`.
2. Inspect the relevant implementation before trusting an older status statement.
3. Keep changes narrowly scoped and preserve unrelated user work.
4. Run the smallest relevant package checks, then `git diff --check` and a scoped secret scan.
5. Update handoff files with exact commands, outcomes, manual-QA status, limitations, and next-step readiness.
6. Never call scaffolded, unsigned, unpublished, externally unverified, or placeholder behavior production-ready.

## Takeover Recommendation

Codex can formally proceed as the implementation and QA collaborator for the next WorkMap round. The immediate prerequisite is not more onboarding; it is a concrete task brief. For release work, the next gate remains external Desktop Agent publication/configuration plus separate-Windows-machine manual QA. For product work, the deferred compliance framework should remain dormant until monitoring optimization is explicitly resumed.
