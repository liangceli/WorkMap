# Virtual Office Workspace API Contract Proposal

Status: proposal only  
Date: 2026-05-30  
Owner: Backend/API Contract

This document evaluates backend support for the new WorkMap virtual office workspace shell and proposes safe future API contracts. It does not approve schema changes, Socket.IO, Microsoft Graph, chat persistence, calendar persistence, notices persistence, or private monitoring data exposure.

## Current Endpoint Support Map

| Frontend need | Existing endpoint | Sufficient? | Gap |
| --- | --- | --- | --- |
| Current authenticated context | `GET /auth/me` | Yes for context | Requires Bearer JWT or non-production fallback; frontend should not derive role itself. |
| Demo/local token for development | `POST /auth/dev-token` | Yes for local demo only | Not a production login flow. |
| Company/departments for shell filters | `GET /companies/current` | Yes | Only company and departments; no office-specific settings yet. |
| People panel list | `GET /users` | Mostly yes | No local time, current room/area, or contact availability yet. Does not include private activity data. |
| Current user profile | `GET /users/me` | Yes with caution | May include own summary data; safe for self view. |
| Person profile/contact card | `GET /users/:userId` | Partial | Normal employees receive contact-only fields; manager-capable roles may receive app/domain summaries and trigger audit logging. Office shell should avoid showing summaries in contact cards unless explicitly in manager/report UI. |
| Device status/setup reminders | `GET /devices` | Partial | Useful for IT/admin/device-health surfaces; not needed in normal office shell people cards. |
| Office map and rooms | `GET /virtual-office/map` | Partial | Provides map metadata and rooms with `zoneData`; no normalized navigation destination DTO or room descriptions. |
| Latest avatar positions | `GET /virtual-office/map/:officeMapId/positions` | Partial | Safe presence state for current map; no realtime movement, no click-to-move persistence contract, no private monitoring data. |
| Teams/Outlook/3CX contact buttons | `GET /integrations/contact-links/:targetUserId` | Mostly yes | Current fields are flat URLs; future contract should wrap each provider with label/enabled/href. Link-based only. |
| Integration status panel | `GET /integrations` | Partial | Company-level connection state only; no OAuth scopes or Graph operations. |
| Manager/self usage summary | `GET /reports/usage-summary?userId=...` | Not for office shell contact UI | Summary endpoint exists and is audited for manager-sensitive reads; should stay out of normal virtual office payloads. |
| Compliance policy display | `GET /compliance/policy` | Yes | Shows policy transparency fields. |
| Policy acknowledgement | `POST /compliance/policy/:policyId/acknowledgement` | Yes | Uses authenticated context and company scope. |
| Chat panel | None | No | Frontend-only mock for MVP. Message persistence requires Director approval. |
| Calendar panel / schedule meeting | None | No | Frontend-only mock/link launchers for MVP. Graph/OAuth required for real calendar writes. |
| Notices/activity panel | None | No | Frontend-only mock for MVP. Persistence and safe notice taxonomy need approval. |
| Emoji / wave quick interactions | None | No | Future ephemeral Socket.IO event or API; no persistence by default. |
| Go to room / room search | `GET /virtual-office/map` | Partial | Existing rooms can seed search; future normalized `GET /virtual-office/navigation` is recommended. |
| Go to person | `GET /users` + `GET /virtual-office/map/:officeMapId/positions` | Partial | Frontend can join directory and positions by `userId`; future composed endpoint may reduce client stitching. |

## 1. People Directory For Office Shell

Purpose: support the left People panel and global workspace search.

Current endpoints:

- `GET /users`
- `GET /users/:userId`

Current safe `GET /users` fields:

```ts
type CurrentUserDirectoryItem = {
  id: string;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGER" | "HR_ADMIN" | "IT_ADMIN" | "OWNER";
  status: "available" | "busy" | "focus" | "idle" | "break" | "offline" | "on_call";
  avatarId: string | null;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
};
```

Recommended future office-shell DTO:

```ts
type OfficePersonDto = {
  userId: string;
  displayName: string;
  role: string;
  jobTitle?: string;
  department?: { id: string; name: string };
  status: "available" | "busy" | "focus" | "idle" | "break" | "offline" | "on_call";
  localTime?: string;
  avatarId?: string;
  currentRoomId?: string;
  currentRoomName?: string;
  contactAvailability?: {
    teams: boolean;
    outlook: boolean;
    threeCx: boolean;
  };
};
```

Rules:

- Do not include app usage, website/domain usage, idle duration details, full URLs, productivity labels, raw activity events, or manager-only summaries in the office shell people list.
- Backend must derive role from JWT/database, never from frontend state.
- Manager-sensitive `GET /users/:userId` reads are already audited when summaries are returned.

## 2. Office Navigation / Room Directory

Purpose: support Search, RoomContextCard, Go to room, and map navigation.

Current endpoint:

- `GET /virtual-office/map`

Current response includes map `id`, `name`, `slug`, `width`, `height`, `tileSize`, `mapData`, and rooms with `id`, `name`, `type`, `zoneData`, and `autoStatus`.

Recommended future endpoint:

- `GET /virtual-office/navigation`

```ts
type OfficeDestinationDto = {
  id: string;
  name: string;
  type: "department" | "room" | "common_area" | "desk_area" | "support";
  description?: string;
  anchor: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
  autoStatus?: "available" | "focus" | "busy" | "break" | "on_call";
  peopleCount?: number;
};
```

Mapping guidance from existing data:

- `OfficeRoom.type = DEPARTMENT_ZONE` maps to `department`.
- `OPEN_OFFICE` maps to `common_area`.
- `FOCUS`, `BREAK`, `MEETING`, and `OTHER` map to `room`.
- `zoneData` may provide bounds if it has a rectangle shape.
- `anchor` can be computed from bounds center when bounds exist.

Rules:

- Do not expose private monitoring metrics in navigation responses.
- `peopleCount` should count latest positions only inside the same company and room, not active time or productivity.
- Do not persist new room metadata without Director approval.

## 3. Contact Links

Purpose: support Teams, Outlook, and 3CX buttons.

Current endpoint:

- `GET /integrations/contact-links/:targetUserId`

Current response:

```ts
type CurrentContactLinksDto = {
  targetUserId: string;
  displayName: string;
  teamsChatUrl: string;
  outlookMailtoUrl: string;
  threeCxUrl: string;
};
```

Recommended future compatible DTO:

```ts
type ContactLinksDto = {
  targetUserId: string;
  displayName: string;
  teams?: { label: string; href: string; enabled: boolean };
  outlook?: { label: string; href: string; enabled: boolean };
  threeCx?: { label: string; href: string; enabled: boolean };
};
```

Rules:

- Link-based only for MVP.
- No Microsoft Graph.
- No Teams message body access.
- No Outlook email body access.
- No call recording.
- Contact links must remain company-scoped.

## 4. Quick Interactions: Emoji / Wave

Current MVP: frontend-only mock.

Future options:

- Socket.IO ephemeral event later.
- No persistence by default.
- No database schema until Director approval.

Proposed future payload:

```ts
type QuickInteractionPayload = {
  targetUserId: string;
  type: "wave" | "emoji";
  emoji?: string;
};
```

Future rules:

- Authenticated.
- Company-scoped.
- Rate-limited.
- No private monitoring data.
- No cross-company delivery.
- Reject invalid `targetUserId`.

Blocked until Director approval:

- Persisted reactions.
- Reaction history.
- Analytics around emoji/wave usage.

## 5. Internal Quick Messages

Current MVP: frontend-only mock.

Message content is sensitive. Do not implement message persistence now.

Future requires Director decisions:

- Whether WorkMap stores messages at all.
- Retention policy.
- Encryption and key ownership.
- Audit/privacy wording.
- Whether message content is in-scope.
- Whether messages are ephemeral only.

Blocked until Director approval:

```ts
type QuickMessageDraft = {
  targetUserId: string;
  body: string;
};
```

Rules if approved later:

- Authenticated and company-scoped.
- Strong DTO validation.
- No hidden monitoring.
- Clear user-facing privacy wording.
- Do not mix message content with activity/report APIs.

## 6. Calendar / Schedule Meeting

Current MVP:

- Frontend mock only.
- Link-based Teams/Outlook launcher only.
- No Microsoft Graph.

Future options:

- Generate Teams/Outlook deep links.
- Create calendar event only after Graph/OAuth approval.

Safe future scheduling proposal:

```ts
type MeetingDraftDto = {
  title: string;
  attendeeUserIds: string[];
  startsAt: string;
  endsAt: string;
  roomId?: string;
  teamsJoinUrl?: string;
};
```

Rules:

- No calendar reading without explicit permission.
- No message/email body access.
- No meeting recording.
- No microphone/camera access.
- Validate attendees are in the same company.
- Validate `roomId` belongs to the same company if provided.

Blocked until Director approval:

- Microsoft Graph scopes.
- Calendar event persistence.
- Meeting history.
- Availability/free-busy reads.

## 7. Notices / Activity Panel

Current MVP: frontend-only mock.

Future safe notice types:

- `user_waved`
- `emoji_received`
- `meeting_reminder`
- `device_setup_reminder`
- `policy_acknowledgement_reminder`
- `integration_status_notice`

Unsafe notice types:

- "Employee spent X minutes on domain".
- Raw app usage.
- Raw browsing details.
- Full URLs.
- Private tracking events.
- Keystrokes, screenshots, camera, microphone, message/email bodies.

Proposed future DTO:

```ts
type WorkspaceNoticeDto = {
  id: string;
  type:
    | "user_waved"
    | "emoji_received"
    | "meeting_reminder"
    | "device_setup_reminder"
    | "policy_acknowledgement_reminder"
    | "integration_status_notice";
  title: string;
  createdAt: string;
  actorUserId?: string;
  targetUserId?: string;
  actionHref?: string;
  readAt?: string;
};
```

Do not implement notice persistence now.

## Search Contract Proposal

Purpose: support searching people, rooms, departments, and actions.

Current approach:

- People: `GET /users`
- Departments: `GET /companies/current`
- Rooms: `GET /virtual-office/map`
- Actions: frontend-owned static registry for now

Recommended future endpoint:

- `GET /virtual-office/search?q=...`

```ts
type OfficeSearchResultDto =
  | {
      type: "person";
      id: string;
      label: string;
      subtitle?: string;
      userId: string;
      status?: string;
    }
  | {
      type: "room" | "department";
      id: string;
      label: string;
      subtitle?: string;
      destinationId: string;
      anchor?: { x: number; y: number };
    }
  | {
      type: "action";
      id: string;
      label: string;
      action: "open_chat" | "open_calendar" | "open_notices" | "open_people";
    };
```

Rules:

- Search results must be company-scoped.
- Search must not include private report/activity data.
- Action results can remain frontend-only for MVP.

## Click-To-Move And Map Controls

Current MVP:

- Drag, zoom, and click-to-move can be frontend-only.
- `GET /virtual-office/map/:officeMapId/positions` provides latest known positions.

Future realtime:

- Use the socket event names and movement payloads from `docs/ai-skills/09-game-movement-system.md`.
- Do not implement Socket.IO until auth strategy, dependency, and movement validation are approved.
- Do not send app usage, website usage, idle duration detail, reports, or tracking events through movement payloads.

## Security And Privacy Requirements

Required:

- Authenticate protected routes.
- Derive `companyId`, `userId`, and role server-side.
- Enforce company isolation in every query.
- Keep contact links company-scoped.
- Audit manager-sensitive reads.
- Validate UUID route/query inputs.

Forbidden:

- Full URL tracking by default.
- Teams/Outlook content access.
- Message/email body collection.
- Keystrokes.
- Screenshots.
- Camera/microphone.
- Raw app/domain activity in virtual office movement or notices.
- Cross-company quick interactions.

## Safe Implementation Decision For This Task

No backend code changes are required for this proposal. Current endpoints are enough for initial frontend shell scaffolding if the frontend treats:

- Chat as frontend-only mock.
- Calendar as frontend-only mock/link launcher.
- Notices as frontend-only mock.
- Emoji/wave as frontend-only mock until Socket.IO approval.
- Room navigation as derived from `GET /virtual-office/map`.
- Go to person as client-side join of `GET /users` and `GET /virtual-office/map/:officeMapId/positions`.

Recommended future small compatible improvements:

1. Add wrapped provider objects to `GET /integrations/contact-links/:targetUserId` while keeping current flat URL fields.
2. Add a dedicated `GET /virtual-office/navigation` endpoint that computes `OfficeDestinationDto` from existing `OfficeRoom.zoneData`.
3. Add `currentRoomId/currentRoomName` to a future office-specific people endpoint, not the general `GET /users`, to avoid broadening existing contracts.

## Director Decisions Needed

- Production login/token issuance strategy.
- Whether to use custom HS256 verification or a JWT library before production hardening.
- Whether WorkMap stores internal quick messages.
- Message retention/encryption/privacy policy.
- Whether calendar creation uses Microsoft Graph/OAuth.
- Whether notices are persisted or ephemeral.
- Socket.IO dependency and movement gateway implementation.
- Any new schema for room navigation metadata, messages, meetings, notices, or avatar persistence.
