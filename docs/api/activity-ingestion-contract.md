# Activity Ingestion Contract

Status: proposed contract only, not implemented  
Date: 2026-05-31  
Future endpoint: `POST /activity/batch`

This document defines the intended MVP contract for desktop-agent/browser-extension activity ingestion. It does not approve implementation, queue setup, Redis/BullMQ, schema changes, retention policy, or production rollout.

## Purpose

Accept batched activity metadata from a trusted WorkMap Desktop Agent, validate it, store approved raw events, and enqueue future aggregation into daily app/domain summaries.

This endpoint must not collect private content. WorkMap is a transparent work visibility product, not hidden monitoring.

## Auth Requirement

Future implementation must require authenticated ingestion. The final strategy needs Director approval.

Options:

- User JWT plus registered device id.
- Device-bound token issued after login/device enrollment.
- Agent session token with rotation.

Minimum checks:

- Resolve `companyId` server-side.
- Resolve or verify `userId` server-side.
- Verify `deviceId` belongs to the user and company.
- Reject events for other companies or users.
- Reject disabled/unregistered devices.

## Request Shape

```ts
type ActivityBatchRequest = {
  deviceId: string;
  events: ActivityEventInput[];
};

type ActivityEventInput = {
  eventType: "APP" | "BROWSER" | "IDLE" | "LOCK" | "UNLOCK" | "HEARTBEAT";
  appName?: string;
  browserName?: "CHROME" | "EDGE" | "FIREFOX" | "SAFARI" | "UNKNOWN";
  domain?: string;
  isIdle?: boolean;
  isActiveWindow?: boolean;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
};
```

Server-derived fields:

- `companyId`
- `userId`
- trust/ingestion identity

Client-provided `companyId`, `userId`, or `role` should be ignored or rejected unless the final device auth contract explicitly requires them and verifies them.

## Event Rules

### APP

Allowed:

- `appName`
- `isIdle`
- `isActiveWindow`
- `startedAt`
- `endedAt`
- `durationSeconds`

Rules:

- `appName` is required.
- `isActiveWindow: true` means the event is for the foreground/focused app. Non-idle foreground seconds count toward focus-active usage; idle foreground seconds count toward focused-idle usage.
- `isActiveWindow: false` with `isIdle: false` means the app/window was open or running but was not the focused active window. It may contribute to open/runtime reporting and must not increment active or idle app summaries.
- Do not accept `windowTitle`.
- Do not accept document names or content.

### BROWSER

Allowed:

- `browserName`
- `domain`
- `isIdle`
- `isActiveWindow`
- `startedAt`
- `endedAt`
- `durationSeconds`

Rules:

- `domain` is required.
- Domain only, no full URL.
- Normalize casing.
- Reject paths, query strings, fragments, and protocols if sent in `domain`.

### IDLE / LOCK / UNLOCK

Allowed:

- `isIdle`
- `startedAt`
- `endedAt`
- `durationSeconds`

Rules:

- These events should not include app/domain details unless specifically approved.

### HEARTBEAT

Allowed:

- `startedAt`

Rules:

- Used for device health and last-seen updates.
- Should not include app/domain details.

## Timestamp And Duration Validation

Required:

- `startedAt` must be valid ISO datetime.
- `endedAt`, when present, must be valid ISO datetime and greater than or equal to `startedAt`.
- `durationSeconds`, when present, must be non-negative.
- If `endedAt` and `durationSeconds` are both present, they must agree within an approved tolerance.
- Reject future timestamps beyond an approved clock-skew window.
- Reject extremely old timestamps outside retention/offline sync policy.

Suggested MVP limits pending Director approval:

- Maximum single event duration: 12 hours.
- Maximum future skew: 5 minutes.
- Maximum offline age: 14 days.
- Maximum batch size: 500 events.
- Maximum request body size: deployment-configured.

## Rejected Fields

The endpoint must reject:

- `fullUrl`
- `url`
- `windowTitle`
- `documentTitle`
- `screenshotUrl`
- `screenshot`
- `keystrokes`
- `keystrokeData`
- `formInput`
- `password`
- `emailContent`
- `teamsMessageContent`
- `messageBody`
- `pageContent`
- `camera`
- `microphone`
- audio/video recordings

## Deduplication Idea

Future implementation should consider an idempotency key per event:

```ts
type ActivityEventInput = {
  clientEventId?: string;
  // other fields...
};
```

If added, uniqueness should be scoped to:

- company
- device
- clientEventId

Do not add this field or index without Director approval.

## Future Queue / Worker Behavior

Target architecture:

1. API validates batch.
2. API verifies device-user-company membership.
3. API stores accepted raw events.
4. API enqueues aggregation job.
5. Worker aggregates into:
   - `app_usage_summary`
   - `website_usage_summary`
6. Dashboard/report APIs query summary tables, not raw events.

Redis/BullMQ is not wired yet and must not be added without approval.

## Privacy Boundaries

Default collection only:

- app name
- browser domain
- active/idle state
- active window flag
- timestamps
- duration
- device id
- event type

Never collect:

- full URLs by default
- screen images
- keystrokes
- camera
- microphone
- Teams message content
- email content
- form inputs
- passwords
- page content

## Audit And Security Notes

- Ingestion itself may not need per-event audit logs because volume is high.
- Security-relevant ingestion failures should be observable via operational logs.
- Manager reads of employee activity summaries must remain audit logged where appropriate.
- Rate limit ingestion by device/company once infrastructure is approved.
- Reject cross-company device spoofing.
- Reject events for devices not assigned to the authenticated user/company.

## Test Cases

- Valid APP event is accepted.
- Valid BROWSER event with `domain: "github.com"` is accepted.
- BROWSER event with `fullUrl` is rejected.
- BROWSER event with `domain: "https://github.com/path"` is rejected.
- APP event with `windowTitle` is rejected.
- Event with negative `durationSeconds` is rejected.
- Event where `endedAt < startedAt` is rejected.
- Event far in the future is rejected.
- Batch exceeding max event count is rejected.
- Device not belonging to user/company is rejected.
- Cross-company device id is rejected.
- HEARTBEAT updates device health without app/domain content.
- Report APIs still read summaries, not raw events.
