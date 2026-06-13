# Owner Quick Start

This guide is for the pilot Owner who creates the WorkMap workspace, invites employees, and reviews workspace-level summaries.

## What WorkMap Is

WorkMap is a transparent virtual office and workplace visibility tool. In the alpha, it helps a small team see who is present, where teammates are in the office map, whether basic activity summaries are available, and whether transparency/compliance guidance has been reviewed.

WorkMap is not hidden surveillance. The alpha does not collect screenshots, keystrokes, webcam/microphone data, clipboard content, private messages, email bodies, passwords, form inputs, or full webpage content.

## Sign In

1. Open the deployed WorkMap app.
2. Choose Cognito sign-in.
3. Complete sign-in with a verified email address.
4. If this is your first Owner account, WorkMap should send you to workspace creation.

If Cognito or API configuration is unavailable, stop the pilot setup and ask the operator to fix deployment settings before inviting employees.

## Create Your Workspace

1. Enter the company name.
2. Enter the workspace name.
3. Confirm or edit your display name.
4. Create the workspace.
5. Complete avatar/profile setup when prompted.
6. Review compliance/transparency guidance.
7. Continue to the virtual office.

Your Owner role is assigned by the backend. Do not rely on client-side values for role or workspace membership.

## Invite Employees

1. Open the invite page from the app navigation.
2. Enter the employee email address.
3. Select the intended role, usually Employee for the alpha.
4. Create the invitation.
5. Copy the invite link and send it through your normal communication channel.

No real email delivery is implemented in this alpha. The Owner must copy and share invite links manually.

## Use the Virtual Office

- Move with WASD or arrow keys.
- Double-click a walkable location to auto-walk.
- Use the People panel to see current teammate presence.
- Click a teammate or use Details to open the contact drawer.
- Press E near supported chairs to sit or stand.
- Treat Wave, Teams, Outlook, and 3CX actions as local or placeholder feedback unless a future integration is added.

If realtime movement is connected, teammates in the same workspace/map should see one another move. Polling remains the fallback path.

## Dashboard

The dashboard is a workspace overview. Use it to check setup coverage, session state, data coverage, presence, compliance, and available summaries. Sparse data is expected early in the alpha.

## Reports

Owner reports show company-level aggregate summaries where activity data exists. They should not show raw employee activity rows, employee scoring, screenshots, full URLs, page content, or private content.

If reports are empty, the likely cause is that desktop-agent/browser-extension scaffold activity has not been submitted yet.

## Compliance

Use the compliance page to review what the alpha says it collects and what it does not collect. Ask employees to review the same page before pilot activity begins.

## What Owners Can See

Owners may see:

- Workspace and tenant metadata.
- Employee directory entries for the same company.
- Virtual office presence, avatar location, status, and last-seen freshness.
- Company aggregate app/domain summaries when scaffold activity has been submitted.
- Device coverage counts and compliance acknowledgement surfaces where available.

Owners should not see:

- Screenshots or screen recordings.
- Keystrokes or clipboard content.
- Webcam or microphone data.
- Private messages, email bodies, passwords, or form inputs.
- Full URL paths, queries, fragments, or page content.
- Platform-level cross-tenant employee activity.

## Report Issues

Use the [Bug Report Template](bug-report-template.md) for bugs and the [Pilot Feedback Template](pilot-feedback-template.md) for product feedback.
