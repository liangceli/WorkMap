import type { TrackingMigrationStateV2, TrackingSyncDiagnosticV2 } from "./trackingV2Types.js";

export type AgentConfig = {
  apiBaseUrl: string;
  credential: string;
  deviceId: string;
  agentVersion: string;
};

export type DeviceStatusName =
  | "RUNNING"
  | "STOPPED_BY_USER"
  | "NETWORK_OFFLINE"
  | "DEVICE_SHUTDOWN"
  | "SLEEPING"
  | "LOCKED"
  | "AGENT_CRASHED"
  | "AGENT_TERMINATED"
  | "SERVER_UNREACHABLE"
  | "UNKNOWN_INTERRUPTED"
  | "RECONNECTED"
  | "RESTARTED";

export type DeviceStatusReason =
  | "AGENT_STARTED"
  | "USER_STOP"
  | "SYSTEM_SHUTDOWN"
  | "SYSTEM_SUSPEND"
  | "SYSTEM_RESUME"
  | "SYSTEM_LOCK"
  | "SYSTEM_UNLOCK"
  | "NETWORK_UNAVAILABLE"
  | "SERVER_REQUEST_FAILED"
  | "PROCESS_CRASH"
  | "PROCESS_TERMINATED"
  | "HEARTBEAT_TIMEOUT"
  | "AGENT_RESTART"
  | "UNKNOWN";

export type DeviceStatusEvent = {
  protocolVersion?: 1 | 2;
  clientEventId: string;
  deviceId: string;
  sessionId?: string;
  status: DeviceStatusName;
  reason: DeviceStatusReason;
  startedAt: string;
  endedAt?: string;
  lastHeartbeatAt?: string;
  recordedAt: string;
  timeZone?: string;
  confidence?: "CONFIRMED" | "INFERRED";
  metadata?: { operation?: string; networkState?: string; agentVersion?: string };
};

export type ForegroundSample = {
  appName: string | null;
  openAppNames?: string[];
  isIdle: boolean;
  isLocked: boolean;
  observedAtMs: number;
  lastInputAtMs?: number;
  idleStartedAtMs?: number;
};

export type CurrentAppActivity = {
  appName: string;
  startedAt: string;
  lastObservedAt: string;
  activeSeconds: number;
  isIdle: boolean;
};

export type TrackingCheckpoint = {
  appName: string;
  isIdle: boolean;
  startedAtMs: number;
  lastObservedAtMs: number;
  lastInputAtMs?: number;
  focusSegments?: Array<{
    appName: string;
    startedAtMs: number;
    lastObservedAtMs: number;
    lastInputAtMs: number;
  }>;
  currentForegroundApp?: string | null;
};

export type AppUsageEvent = {
  clientEventId: string;
  deviceId: string;
  appName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  isIdle: boolean;
  isActiveWindow: boolean;
  agentSessionId?: string;
  clientInstanceId?: string;
  sequenceNumber?: number;
  clientMonotonicMs?: number;
  timeZone?: string;
};

export type QueuedEvent = {
  event: AppUsageEvent;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

export type QueuedStatusEvent = {
  event: DeviceStatusEvent;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

export type AgentStatus = {
  state: "unpaired" | "pairing" | "connected" | "paused" | "policy_required" | "offline" | "server_unreachable" | "auth_required" | "upgrade_required" | "error";
  deviceId?: string;
  lastHeartbeatAt?: string;
  lastUploadAt?: string;
  sessionId?: string;
  clientSessionId?: string;
  currentActivity?: CurrentAppActivity | null;
  /** Pending Tracking v2 activity intervals only. */
  queuedEvents: number;
  queuedStatusEvents?: number;
  /** Retained v1 records that are being retried through the compatibility path. */
  queuedLegacyEvents?: number;
  trackingMigrationState?: TrackingMigrationStateV2;
  lastStatusUploadAt?: string;
  deviceStatus?: DeviceStatusName;
  lastSyncDiagnostic?: TrackingSyncDiagnosticV2 | null;
  recentSyncFailureCount?: number;
  error?: string;
};
