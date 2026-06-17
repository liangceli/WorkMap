# WorkMap Codex Workflow

This repository is the WorkMap / AI office app workspace. Treat this file as the long-lived operating guide for Codex sessions in this repo.

## Scope

- Work only on the WorkMap / AI office app repository rooted at this directory.
- Do not mix personal, company, or customer projects into this repo.
- Do not modify parent or unrelated repositories.
- Do not delete or revert user changes unless explicitly asked.
- Do not commit real secrets, bearer tokens, database URLs, private pilot feedback, customer names, or platform admin identities.
- Do not describe scaffolded features as production-ready.

## Required Start Of Every Round

Before making changes:

1. Locate the true git/project root.
2. Run `git status --short`.
3. Read these files if they exist:
   - `AGENTS.md`
   - `docs/ai-handoff/director-update.md`
   - `docs/ai-handoff/latest-implementation.md`
   - `docs/ai-handoff/latest-qa.md`
   - `docs/skills/current-status.md`
   - `docs/skills/project-summary.md`
   - `docs/skills/frontend-skill.md`
   - `docs/skills/api-contract-skill.md`
   - `docs/skills/qa-skill.md`
   - `docs/skills/deployment-skill.md`
   - `docs/skills/virtual-office-skill.md`
   - `docs/skills/realtime-presence-skill.md`
4. Report a short Chinese execution plan.
5. Then implement the requested task.

Repo files are the source of long-term memory. Do not depend on previous chat memory.

## Execution Responsibilities

Each task round should cover:

1. Read current project state.
2. Understand the task brief.
3. Make a short plan.
4. Implement scoped code or documentation changes.
5. Run relevant verification.
6. Fix failures caused by the current change.
7. Perform basic QA / diff review.
8. Update handoff files.
9. Report in Chinese whether the project can proceed to the next round.

## Technical Boundaries

- Prefer existing architecture, components, packages, and style.
- Avoid broad refactors and heavy new dependencies.
- Do not change auth, schema, backend, deployment, RBAC, tenant isolation, or Platform Admin boundaries unless the task explicitly requires it.
- Do not hardcode localhost into production paths or commit production secrets.
- Keep fake/demo/example data labeled honestly.
- Preserve Owner / Employee / Platform Admin permission boundaries.
- Desktop agent is currently a harness/scaffold unless updated by a specific task.
- Browser extension is currently a local MV3 scaffold unless updated by a specific task.
- Teams, 3CX, Outlook, chat, scheduling, and support actions are placeholders unless a specific integration task implements them.

## Verification Defaults

Run the narrowest relevant checks first.

Frontend changes:

- `pnpm --filter @workmap/web typecheck`
- `pnpm --filter @workmap/web lint`
- `pnpm --filter @workmap/web build`

Backend changes:

- `pnpm --filter @workmap/api typecheck`
- `pnpm --filter @workmap/api lint`
- `pnpm --filter @workmap/api build`

Shared package changes:

- Run the affected package typecheck/build and impacted app checks.

Every round should try to run:

- `git diff --check`
- Secret scan excluding `.env`, `.env.*`, `node_modules`, `.next`, `dist`, `*.tsbuildinfo`, `docs/references`, and other generated/reference-only directories.

If verification fails:

1. Determine whether the current change caused it.
2. Fix current-change failures.
3. Re-run verification.
4. If unrelated, document it as an existing issue and do not silently broaden scope.

## Handoff Rules

Every round must update:

- `docs/ai-handoff/latest-implementation.md`

If the round includes QA, review, or verification beyond a trivial docs note, also update:

- `docs/ai-handoff/latest-qa.md`

Only update these when explicitly required by the task:

- `docs/ai-handoff/director-update.md`
- `docs/skills/current-status.md`

`latest-implementation.md` must include:

- Original task brief.
- Changed files.
- Implementation summary.
- Role/access behavior if relevant.
- Verification commands and results.
- Manual QA results or not run.
- What was intentionally not changed.
- Remaining risks.
- Suggested next steps.

`latest-qa.md` must include:

- Reviewed implementation.
- Diff review summary.
- Findings ordered by severity.
- Test/verification status.
- Manual QA status.
- Risks.
- Pass/fail recommendation.
- Whether the next round can proceed.

## Final Report Format

Final responses should be in Chinese and include:

- Changed files.
- What was completed.
- Key behavior changes.
- Verification results.
- Whether manual QA was run.
- What was not changed.
- Remaining risks.
- Whether the next round should proceed.
