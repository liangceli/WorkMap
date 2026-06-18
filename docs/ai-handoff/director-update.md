# Director Update

## Stage 4 Development Status

The final pure development scope is complete locally as of 2026-06-18.

Users can now create a short-lived one-time pairing code in authenticated WorkMap, pair either a Windows Desktop Agent or MV3 Browser Extension without embedding a Cognito token, collect privacy-minimised app/domain duration, survive bounded offline periods, retry safely without double-counting, view the data through Employee/Owner reports, and revoke a device credential.

Delivered:

- Real Windows foreground process, idle, and lock adapter using User32 P/Invoke.
- Tested app tracking state machine and shutdown flush.
- Real MV3 tab/window-focus/idle service worker with storage and alarms recovery.
- Tenant/user/device/client-bound hash-only credentials and revoke closure.
- Persistent capped queues, retry backoff, auth-expired states, and stable event identity.
- Runnable Windows Alpha directory and Chrome/Edge load-unpacked directory.
- Automated unit, package, migration, tracking/report, RBAC, revoke, and Virtual Office regression verification.

The existing public route smoke previously passed and is not blocked. No public deployment was changed in this round.

## Boundaries Preserved

- Cognito/current WorkMap auth remains in place.
- No Clerk was added.
- No 3CX implementation was added.
- No screenshot, recording, title, full URL, path/query/fragment, page body, form, password, keystroke, clipboard, camera, microphone, email, Teams, or private-message collection was added.
- Platform Admin and tenant/RBAC privacy boundaries remain intact.

## Remaining Work

Deferred by user, pending final consolidated manual QA. After that single QA pass, fix discovered defects and perform final deployment/online acceptance. These are not reported as passed yet.
