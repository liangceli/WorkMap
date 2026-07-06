# WorkMap Project Skills

This folder is the stable project context layer for WorkMap / Virtual Office work.

Use these files before starting implementation tasks:

- `project-summary.md` for the stable product and architecture overview.
- `current-status.md` for latest status, known issues, blockers, and next tasks.
- Domain skill files for targeted work, such as frontend, backend, API contracts, virtual office, map, movement, interactions, presence, auth, deployment, UI/UX, QA, and the deferred activity-monitoring compliance framework.
- `activity-monitoring-compliance-skill.md` for the privacy, employee-control, reporting, legal-review, and production-release rules that apply when monitoring work resumes.
- `decision-log.md` for technical decisions that should survive across chats.

Rules:

- Treat code as the source of truth.
- Do not assume a feature exists unless it is confirmed in the repository.
- Clearly preserve mock/demo vs production-ready boundaries.
- Update only the affected skill files after each accepted implementation.
- Do not modify application behavior from this documentation workflow.
