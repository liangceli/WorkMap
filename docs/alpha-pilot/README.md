# Alpha Pilot Readiness Pack

This pack is for a controlled 5-person WorkMap alpha pilot. It is meant to help the Owner, invited employees, and the operator running the pilot understand what is ready, what is limited, and how to report feedback without overstating the current product.

## Use This Pack Before Inviting Pilot Users

1. Read the Owner and Employee quick-start guides.
2. Review the privacy/compliance one-pager with the pilot team.
3. Review known limitations before presenting the product as ready.
4. Complete the before-pilot smoke checklist.
5. Share the feedback and bug report templates with pilot users.

## Documents

- [Owner Quick Start](owner-quick-start.md)
- [Employee Quick Start](employee-quick-start.md)
- [Privacy and Compliance One-Pager](privacy-compliance-one-pager.md)
- [Known Limitations](known-limitations.md)
- [Before-Pilot Smoke Checklist](before-pilot-smoke-checklist.md)
- [Pilot Feedback Template](pilot-feedback-template.md)
- [Bug Report Template](bug-report-template.md)

## Alpha-Ready Areas

- Cognito sign-in for the deployed alpha.
- Owner workspace creation.
- Employee invite acceptance.
- Backend-backed display name and layered avatar setup.
- Virtual office map, movement, People panel, contact drawer, chairs, polling, and same-map realtime movement.
- Dashboard workspace overview.
- Reports with role-aware own/company aggregate summaries.
- Compliance transparency policy and acknowledgement flow.
- Platform Admin privacy-safe tenant metadata surface.
- Deployed smoke helper for public frontend/API route checks.

## Scaffolded or Limited Areas

- Desktop agent is a local harness, not production active-window tracking.
- Browser extension is a local scaffold, not a packaged production extension.
- Activity data is sparse unless the pilot manually runs the harness/scaffold flows.
- Realtime movement is in-memory per API process and needs shared pub/sub before horizontal scaling.
- Invite links are copy/share only; no real email sending is implemented yet.
- Teams, Outlook, 3CX, chat, scheduling, and support workflows are placeholders or out of scope.
- Platform Admin is read-only and allowlist-driven.
- Global identity plus multi-company membership architecture is future work.

## Setup Checklist Summary

- Confirm Vercel, Render, Supabase, and Cognito deployed settings are current.
- Confirm required Prisma migrations are applied in the target database.
- Confirm Cognito callback/logout URLs match the active Vercel domain.
- Confirm Render `WORKMAP_ALLOWED_ORIGINS` and `WORKMAP_APP_URL` match the active Vercel domain.
- Run the smoke checklist in this pack before the pilot begins.
- Do not paste or store real secrets, bearer tokens, database URLs, or platform admin identities in docs or chat.
