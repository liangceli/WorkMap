# Deferred Final Manual QA

Status: deferred by user on 2026-06-18.

Run this checklist together after the remaining product work is complete. Until then, these items are pending and must not be reported as manually passed.

## Cognito And Tenant Flow

- Owner signs in through the deployed Cognito Hosted UI.
- Owner can create or enter the intended WorkMap workspace.
- Owner can create an Employee invitation.
- Invited Employee signs in with the invited Cognito identity and accepts the invitation.
- Wrong-account, expired, already-used, and unauthorized invitation states remain safely blocked.

## Tracking And Reports

- A real configured tracking client submits one app usage event and one browser-domain usage event.
- Employee Reports show only the Employee's own app/domain summaries.
- Owner Reports show company aggregate app/domain summaries.
- Employee cannot access company-wide report scope.
- Duplicate submissions do not inflate report totals.
- Dashboard tracking coverage and Compliance collected/not-collected explanations match actual behavior.

## Virtual Office And Interaction

- Two authenticated users in the same tenant/map see each other's movement smoothly.
- Map remains clear, fills the viewport at minimum zoom, and has no known missing/misaligned tiles.
- Movement, collision, click-to-move, chair interaction, and saved-position restore remain functional.
- People panel and contact drawer target the correct teammate.
- Wave is delivered to the selected online teammate.
- Ephemeral 1:1 Message is delivered to the selected online teammate.
- Cross-tenant users do not receive movement, Wave, or Message events.
- Teams and Email launchers open the expected destination.
- 3CX remains visibly disabled and is not presented as integrated.

## Platform Admin And Privacy

- Allowlisted Cognito Platform Admin can open `/platform-admin`.
- Normal tenant Owner/Employee users cannot gain Platform Admin access.
- Platform Admin views remain aggregate/privacy-safe and do not expose employee app/domain details.
- The product does not claim to collect screenshots, recordings, keystrokes, clipboard, webcam/microphone, webpage body, form inputs, passwords, or private message/email bodies.

## Deployment Regression

- Re-run `pnpm smoke:alpha` against the public Vercel and Render origins.
- Confirm API `/health` and `/health/readiness` return 200.
- Confirm CORS allows only the intended deployed frontend origin.
- Confirm deployed realtime uses WSS and two-user movement works.
- Smoke `/dashboard`, `/reports`, `/compliance`, `/virtual-office`, `/login`, invite flow, and `/platform-admin`.

## Current Product Limitations To Preserve In Sign-Off

- Desktop agent is still a harness/scaffold unless a later task upgrades and packages it.
- Browser extension is still a local MV3 scaffold unless a later task packages and deploys it.
- 1:1 Message is ephemeral, not persisted, and not queued for offline delivery.
- Realtime is currently single API instance/in-memory until shared pub/sub is implemented.
- 3CX is not implemented.

## Completion Rule

Mark this checklist complete only after every applicable item is manually executed in the final deployed environment. Record failures and fixes in `latest-qa.md`; do not infer a pass from automated tests alone.
