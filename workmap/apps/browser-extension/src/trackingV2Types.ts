export const BROWSER_EXTENSION_VERSION = "browser-extension-mv3/0.5.0";
export const TRACKING_PROTOCOL_VERSION_V2 = 2 as const;
export const BROWSER_V2_QUEUE_CAPACITY = 10_000;
export const BROWSER_V2_SYNC_BATCH_SIZE = 50;
export const BROWSER_V2_IDLE_THRESHOLD_MS = 60_000;
export const BROWSER_V2_MAX_INTERVAL_MS = 30 * 60_000;
export const BROWSER_V2_POLICY_REFRESH_MS = 5 * 60_000;

export type BrowserNameV2 = "CHROME" | "EDGE";
export type TrackingCollectorStateV2 =
  | "HEALTHY"
  | "LIMITED"
  | "PAUSED"
  | "ERROR";
export type TrackingConnectionStateV2 =
  | "ONLINE"
  | "OFFLINE"
  | "AUTH_REQUIRED"
  | "UPGRADE_REQUIRED"
  | "ERROR";
export type TrackingPolicyStateV2 =
  | "ACTIVE"
  | "ACKNOWLEDGEMENT_REQUIRED"
  | "TIMEZONE_REQUIRED"
  | "EXPIRED";
export type TrackingMigrationStateV2 =
  | "V1"
  | "PREPARING_V2"
  | "DRAINING_V1"
  | "V2"
  | "ERROR";
export type TrackingHealthErrorCodeV2 =
  | "NONE"
  | "INTERACTION_PERMISSION_REQUIRED"
  | "QUEUE_PRESSURE"
  | "POLICY_UNAVAILABLE"
  | "CLOCK_UNTRUSTED"
  | "UPGRADE_REQUIRED"
  | "UNKNOWN";

export type TrackingPolicyUtcWindowV2 = {
  startsAt: string;
  endsAt: string;
};

export type DeviceTrackingPolicyV2 = {
  policyId: string;
  policyVersion: string;
  effectiveAt: string;
  policyLeaseId: string | null;
  policyLeaseIssuedAt: string | null;
  policyLeaseExpiresAt: string | null;
  serverTime: string;
  scheduleTimeZone: string | null;
  scheduleTimeZoneState: "CONFIRMED" | "TIMEZONE_REQUIRED";
  allowedUtcWindows: TrackingPolicyUtcWindowV2[];
  allowedUtcWindowsHash: string | null;
  workHoursOnly: boolean;
  workdayStart: string;
  workdayEnd: string;
  idleThresholdMs: number;
  collectAppFocus: boolean;
  collectDomainFocus: boolean;
  collectOpenRuntime: false;
  acknowledgementState: "ACKNOWLEDGED" | "REQUIRED";
  acknowledgedAt: string | null;
};

export type BrowserActivityIntervalV2 = {
  clientEventId: string;
  activitySessionId: string;
  sequenceNumber: number;
  source: "BROWSER_DOMAIN";
  stream: "FOCUS";
  metric: "FOCUS_ACTIVE" | "FOCUS_IDLE";
  subjectKey: string;
  displayName: string;
  browserName: BrowserNameV2;
  startedAt: string;
  endedAt: string;
  clockEpochId: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  durationMs: number;
  policyVersion: string;
  policyLeaseId: string;
};

export type BrowserLiveFocusSnapshotV2 = {
  snapshotSequence: number;
  activitySessionId: string | null;
  currentStateId: string | null;
  source: "BROWSER_DOMAIN";
  stream: "FOCUS";
  clockEpochId: string;
  policyVersion: string;
  policyLeaseId: string;
  subjectKey: string | null;
  displayName: string | null;
  browserName: BrowserNameV2;
  state: "ACTIVE" | "IDLE" | "NONE";
  sessionStartedAt: string | null;
  stateStartedAt: string | null;
  lastActivityEvidenceAt: string | null;
  activityEvidenceKind:
    | "FOCUS_ACQUIRED"
    | "TRUSTED_PAGE_INTERACTION"
    | null;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
  nextIntervalSequence: number;
  lastObservedAt: string;
  collectorState: TrackingCollectorStateV2;
};

export type BrowserFocusStateV2 = {
  activitySessionId: string;
  currentStateId: string;
  subject: { subjectKey: string; displayName: string };
  state: "ACTIVE" | "IDLE";
  sessionStartedAtMonotonicMs: number;
  stateStartedAtMonotonicMs: number;
  activeEvidenceAtMonotonicMs: number;
  lastActivityEvidenceKind:
    | "FOCUS_ACQUIRED"
    | "TRUSTED_PAGE_INTERACTION";
  confirmedThroughMonotonicMs: number;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
};

export type BrowserFocusCheckpointV2 = {
  version: 1;
  snapshotSequence: number;
  nextIntervalSequence: number;
  lastObservedAtMonotonicMs: number;
  collectorState: TrackingCollectorStateV2;
  current: BrowserFocusStateV2 | null;
};

export type BrowserClockEpochV2 = {
  clockEpochId: string;
  clockEpochStartedAt: string;
  clockEpochStartedMonotonicMs: number;
};

export type BrowserTrackingRuntimeStateV2 = {
  version: 5;
  migrationState: TrackingMigrationStateV2;
  activationId: string | null;
  proposedActivatedAt: string | null;
  protocolActivatedAt: string | null;
  policy: DeviceTrackingPolicyV2 | null;
  serverOffsetMs: number;
  clientInstanceId: string;
  clock: BrowserClockEpochV2 | null;
  engineCheckpoint: BrowserFocusCheckpointV2 | null;
  latestSnapshot: BrowserLiveFocusSnapshotV2 | null;
  focusedWindowId: number | null;
  activeTabId: number | null;
  activeDomain: string | null;
  systemIdle: boolean;
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: TrackingHealthErrorCodeV2;
  terminalRejections: number;
};

export type BrowserClientHealthV2 = {
  clientType: "BROWSER_EXTENSION";
  clientVersion: string;
  platform: BrowserNameV2;
  connectionState: TrackingConnectionStateV2;
  collectorState: TrackingCollectorStateV2;
  policyState: TrackingPolicyStateV2;
  migrationState: TrackingMigrationStateV2;
  queue: {
    pending: number;
    ready: number;
    deadLetter: number;
    oldestQueuedAt: string | null;
    nextRetryAt: string | null;
  };
  lastSuccessfulHeartbeatAt: string | null;
  lastSuccessfulSyncAt: string | null;
  errorCode: TrackingHealthErrorCodeV2;
};

export type BrowserTrackingSyncRequestV2 = {
  protocolVersion: typeof TRACKING_PROTOCOL_VERSION_V2;
  protocolActivatedAt: string;
  clientInstanceId: string;
  sentAt: string;
  intervals: BrowserActivityIntervalV2[];
  focusSnapshot?: BrowserLiveFocusSnapshotV2;
  health: BrowserClientHealthV2;
};

export type TrackingSyncItemResultV2 = {
  clientEventId: string;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  rejectionCode?: string;
  terminal?: boolean;
};

export type BrowserTrackingSyncResponseV2 = {
  results: TrackingSyncItemResultV2[];
  cursors: Array<{
    source: "BROWSER_DOMAIN";
    stream: "FOCUS";
    clockEpochId: string;
    contiguousThroughSequence: number;
    latestAcceptedEndedAt: string | null;
    missingRanges: Array<{ from: number; to: number }>;
    rejectedRanges: Array<{ from: number; to: number; code: string }>;
  }>;
  acceptedSnapshotSequence: number | null;
  serverTime: string;
  activePolicyVersion: string;
  activePolicyLeaseId: string | null;
};

export type ProtocolV2PrepareResponse = {
  activationId: string | null;
  state: "PREPARED" | "CONFIRMED";
  proposedActivatedAt?: string;
  protocolActivatedAt: string | null;
  serverTime: string;
  policy: DeviceTrackingPolicyV2;
};

export type ProtocolV2ConfirmResponse = {
  activationId: string;
  state: "CONFIRMED";
  protocolActivatedAt: string;
  serverTime: string;
};

export type BrowserV2QueueRecord = {
  clientEventId: string;
  clockEpochId: string;
  sequenceNumber: number;
  interval: BrowserActivityIntervalV2;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

export type BrowserV2QueueStats = {
  pending: number;
  ready: number;
  deadLetter: number;
  oldestQueuedAt: string | null;
  nextRetryAt: string | null;
};

export function createInitialBrowserTrackingV2State(): BrowserTrackingRuntimeStateV2 {
  return {
    version: 5,
    migrationState: "V1",
    activationId: null,
    proposedActivatedAt: null,
    protocolActivatedAt: null,
    policy: null,
    serverOffsetMs: 0,
    clientInstanceId: crypto.randomUUID(),
    clock: null,
    engineCheckpoint: null,
    latestSnapshot: null,
    focusedWindowId: null,
    activeTabId: null,
    activeDomain: null,
    systemIdle: false,
    lastSuccessfulSyncAt: null,
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: "NONE",
    terminalRejections: 0,
  };
}
