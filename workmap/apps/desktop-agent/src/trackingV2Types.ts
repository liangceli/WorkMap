export const TRACKING_PROTOCOL_VERSION_V2 = 2 as const;
export const DESKTOP_V2_QUEUE_CAPACITY = 50_000;
export const DESKTOP_V2_SYNC_BATCH_SIZE = 50;
export const DESKTOP_V2_SETTLEMENT_MS = 15_000;
export const DESKTOP_V2_HEALTH_SYNC_MS = 10_000;
export const DESKTOP_V2_POLICY_REFRESH_MS = 5 * 60_000;
export const DESKTOP_V2_IDLE_THRESHOLD_MS = 60_000;
export const DESKTOP_V2_MAX_INTERVAL_MS = 30 * 60_000;

export type TrackingCollectorStateV2 = "HEALTHY" | "LIMITED" | "PAUSED" | "ERROR";
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
  | "NATIVE_HELPER_UNAVAILABLE"
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

export type ActivityIntervalV2 = {
  clientEventId: string;
  activitySessionId: string;
  sequenceNumber: number;
  source: "DESKTOP_APP";
  stream: "FOCUS";
  metric: "FOCUS_ACTIVE" | "FOCUS_IDLE";
  subjectKey: string;
  displayName: string;
  startedAt: string;
  endedAt: string;
  clockEpochId: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  durationMs: number;
  policyVersion: string;
  policyLeaseId: string;
};

export type FocusEvidenceKindV2 =
  | "FOCUS_ACQUIRED"
  | "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND";

export type LiveFocusSnapshotV2 = {
  snapshotSequence: number;
  activitySessionId: string | null;
  currentStateId: string | null;
  source: "DESKTOP_APP";
  stream: "FOCUS";
  clockEpochId: string;
  policyVersion: string;
  policyLeaseId: string;
  subjectKey: string | null;
  displayName: string | null;
  state: "ACTIVE" | "IDLE" | "NONE";
  sessionStartedAt: string | null;
  stateStartedAt: string | null;
  lastActivityEvidenceAt: string | null;
  activityEvidenceKind: FocusEvidenceKindV2 | null;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
  nextIntervalSequence: number;
  lastObservedAt: string;
  collectorState: TrackingCollectorStateV2;
};

export type ClientHealthV2 = {
  clientType: "DESKTOP_AGENT";
  clientVersion: string;
  platform: "WINDOWS";
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

export type TrackingSyncRequestV2 = {
  protocolVersion: typeof TRACKING_PROTOCOL_VERSION_V2;
  protocolActivatedAt: string;
  clientInstanceId: string;
  sentAt: string;
  intervals: ActivityIntervalV2[];
  focusSnapshot?: LiveFocusSnapshotV2;
  health: ClientHealthV2;
};

export type TrackingSyncItemResultV2 = {
  clientEventId: string;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  rejectionCode?: string;
  terminal?: boolean;
};

export type TrackingSyncCursorV2 = {
  source: "DESKTOP_APP";
  stream: "FOCUS";
  clockEpochId: string;
  contiguousThroughSequence: number;
  latestAcceptedEndedAt: string | null;
  missingRanges: Array<{ from: number; to: number }>;
  rejectedRanges: Array<{ from: number; to: number; code: string }>;
};

export type TrackingSyncResponseV2 = {
  results: TrackingSyncItemResultV2[];
  cursors: TrackingSyncCursorV2[];
  acceptedSnapshotSequence: number | null;
  focusSnapshotResult:
    | {
        status: "ACCEPTED";
        acceptedSnapshotSequence: number;
      }
    | {
        status: "REJECTED";
        rejectionCode:
          | "SNAPSHOT_POLICY_LEASE_INVALID"
          | "SNAPSHOT_OBSERVATION_TIME_INVALID"
          | "SNAPSHOT_OUTSIDE_POLICY_WINDOW";
        message: string;
      }
    | null;
  serverTime: string;
  activePolicyVersion: string;
  activePolicyLeaseId: string | null;
  requestId: string;
};

export type TrackingSyncDiagnosticV2 = {
  requestId: string;
  attemptedAt: string;
  completedAt: string;
  intervalCount: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage?: string | null;
  remediation?: string | null;
  retryable?: boolean | null;
  failureStage?: "parse" | "policy" | "transaction" | "response" | null;
  outcome: "CONFIRMED" | "CONFIRMED_WITH_WARNING" | "FAILED";
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

export type DesktopFocusSubjectV2 = {
  subjectKey: string;
  displayName: string;
};

export type DesktopFocusStateV2 = {
  activitySessionId: string;
  currentStateId: string;
  subject: DesktopFocusSubjectV2;
  state: "ACTIVE" | "IDLE";
  sessionStartedAtMonotonicMs: number;
  stateStartedAtMonotonicMs: number;
  activeEvidenceAtMonotonicMs: number;
  lastActivityEvidenceKind: FocusEvidenceKindV2;
  confirmedThroughMonotonicMs: number;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
};

export type DesktopFocusCheckpointV2 = {
  version: 1;
  snapshotSequence: number;
  nextIntervalSequence: number;
  lastObservedAtMonotonicMs: number;
  collectorState: TrackingCollectorStateV2;
  current: DesktopFocusStateV2 | null;
};

export type DesktopClockEpochV2 = {
  clockEpochId: string;
  clockEpochStartedAt: string;
  clockEpochStartedMonotonicMs: number;
};

export type DesktopTrackingRuntimeStateV2 = {
  version: 1;
  migrationState: TrackingMigrationStateV2;
  activationId: string | null;
  proposedActivatedAt: string | null;
  protocolActivatedAt: string | null;
  policy: DeviceTrackingPolicyV2 | null;
  serverOffsetMs: number;
  clientInstanceId: string;
  clock: DesktopClockEpochV2 | null;
  engineCheckpoint: DesktopFocusCheckpointV2 | null;
  latestSnapshot: LiveFocusSnapshotV2 | null;
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: TrackingHealthErrorCodeV2;
  lastSyncDiagnostic: TrackingSyncDiagnosticV2 | null;
  recentSyncFailures: TrackingSyncDiagnosticV2[];
};

export type DesktopV2QueueStats = {
  pending: number;
  ready: number;
  deadLetter: number;
  oldestQueuedAt: string | null;
  nextRetryAt: string | null;
};
