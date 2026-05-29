# AI Worker Rules for WorkMap

You are working on WorkMap, a 2D virtual office and compliant work visibility platform.

## Core product direction

WorkMap is not a spying tool. It is a virtual office + work visibility + communication launcher.

The system combines:

1. 2D virtual office
2. Employee presence
3. Desktop app usage tracking
4. Chrome/Edge domain usage tracking
5. Teams / Outlook / 3CX quick contact actions
6. Compliance-first monitoring policy

## Non-negotiable privacy rules

Never implement:

- keystroke logging
- screen recording
- screenshots
- microphone recording
- camera recording
- email body collection
- Teams message collection
- full URL tracking by default
- password or form input collection
- hidden or invisible monitoring

Default tracking must only collect:

- active app name
- website domain
- active/idle status
- device heartbeat
- session time
- user/device/company IDs
- aggregated usage summaries

## Engineering rules

Before coding:

1. Read `/docs/ai-skills/00-project-brief.md`
2. Read your role-specific skill file
3. Inspect the existing file structure
4. Reuse existing components, types, services, and patterns
5. Do not create duplicate systems
6. Do not change database schema without Director approval
7. Do not change API contracts without Director approval
8. Make the smallest working change
9. Prefer modular files over large files
10. Keep TypeScript strict and typed

## Token-saving rules

To reduce Codex usage:

1. Do not explain basic concepts unless asked.
2. Do not rewrite full files unless necessary.
3. Prefer patches/diffs or changed sections.
4. Before editing, list the exact files that need changes.
5. After editing, provide a short handoff summary.
6. Avoid broad refactors.
7. Do not search the entire repo repeatedly if file paths are already known.
8. Use existing shared types from `packages/shared-types`.
9. Use existing UI components from `packages/ui` or `apps/web/components`.
10. Ask the Director only when the decision affects architecture, schema, privacy, or security.

## Handoff summary format

After every task, output:

### Completed
- ...

### Files changed
- ...

### How to test
- ...

### Risks / notes
- ...

### Need Director decision?
- Yes / No