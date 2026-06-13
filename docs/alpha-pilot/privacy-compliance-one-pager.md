# Privacy and Compliance One-Pager

WorkMap alpha is designed around transparency. Pilot users should know what is collected, who can see it, and what is explicitly out of scope before the pilot begins.

## What May Be Collected in the Alpha

Depending on which alpha flows are used, WorkMap may collect:

- Account identity needed for sign-in, workspace membership, role, display name, and avatar.
- Workspace/company membership and invitation status.
- Virtual office presence, avatar location, room/status, and last-seen freshness.
- Device registration and heartbeat metadata from the alpha harness.
- App name and active/idle duration from the desktop-agent harness.
- Browser hostname/domain and active duration from the browser-extension scaffold.
- Compliance policy acknowledgement status.
- Aggregate app/domain summary rows used by Dashboard and Reports.
- Platform Admin audit events for privacy-safe platform operations.

## What Is Not Collected

WorkMap alpha does not collect:

- Screenshots.
- Screen recordings.
- Keystrokes.
- Clipboard content.
- Webcam or microphone data.
- Private messages or email body content.
- Passwords or form input contents.
- Full webpage content.
- Full URL paths, queries, or fragments by default.
- Raw cross-tenant employee activity in Platform Admin.

## Who Can See What

Employees can see their own workspace presence, directory context, compliance guidance, and own-scope report summaries where data exists.

Owners can see same-tenant directory entries, virtual office presence, workspace setup state, compliance surfaces, and company aggregate summaries where data exists. Owners should not see raw private content or hidden monitoring data.

Platform Admins are independent platform identities. They can see privacy-safe tenant metadata, readiness/health summaries, and platform audit summaries only. Tenant Owner status does not grant Platform Admin access.

## Alpha Client Limitation

The desktop agent and browser extension are alpha harness/scaffold clients. They are useful for smoke testing the reporting loop, but they are not production packaged tracking clients. Production rollout needs pairing, packaging, permissions review, offline queueing, revocation, and additional security hardening.

## Employee Notice

Before the pilot starts, the Owner should tell employees:

- Why WorkMap is being tested.
- Which data surfaces will be reviewed.
- Which data is explicitly not collected.
- How to report privacy concerns or incorrect data.
- That the pilot is limited and may have sparse data.
