# Known Limitations

Review these limitations before inviting alpha pilot users.

## Product Scope Limitations

- Desktop agent is a Node/TypeScript harness, not a production active-window tracking client.
- Browser extension is a Manifest V3 scaffold, not packaged or store-ready.
- Activity data may be sparse unless device/app/domain sample flows are run.
- Reports show aggregate summaries and own-scope summaries, not raw employee activity streams.
- Compliance acknowledgement readback may rely on frontend state where backend readback is not exposed.
- Invite links are copied manually; real email sending is not implemented.
- Teams, Outlook, 3CX, chat, scheduling, billing, enquiry modules, and support workflows are not implemented.
- Platform Admin is read-only and privacy-safe; it does not support impersonation, tenant mutation, billing, or support actions.

## Architecture Limitations

- One Cognito account currently maps to one WorkMap company user.
- Full global identity plus CompanyMembership/TenantMembership architecture is future work.
- Department/team-level RBAC remains coarse where the data model lacks team membership boundaries.
- Realtime virtual office movement is in-memory per API process. Horizontal scaling needs shared pub/sub first.
- Saved virtual-office positions do not yet store map version metadata.
- Future map replacement should include automated manifest-vs-TMX validation.

## Deployment and Operations Limitations

- Every target database must have required Prisma migrations applied before smoke testing.
- Cognito callback/logout URLs must match the active Vercel domain.
- Render CORS and WebSocket origin allowlists must match the active Vercel origin.
- Platform Admin bootstrap uses secure deployment env allowlists, not a persisted admin lifecycle.
- Real secrets, bearer tokens, database URLs, and platform admin identities must stay out of docs, chat, and commits.

## Manual QA Still Required

- Owner sign-in and workspace creation.
- Employee invite acceptance and first-time onboarding.
- Two-user realtime movement in the virtual office.
- Reports and dashboard after sample activity.
- Platform Admin privacy boundary.
- Responsive visual checks for primary product routes.
