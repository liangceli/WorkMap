export type AgentConfig = {
  apiBaseUrl: string;
  credential: string;
  deviceId: string;
  agentVersion: string;
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
};

export type QueuedEvent = {
  event: AppUsageEvent;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

export type AgentStatus = {
  state: "unpaired" | "pairing" | "connected" | "offline" | "auth_required" | "error";
  deviceId?: string;
  lastHeartbeatAt?: string;
  lastUploadAt?: string;
  sessionId?: string;
  currentActivity?: CurrentAppActivity | null;
  queuedEvents: number;
  error?: string;
};
