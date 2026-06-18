export type AgentConfig = {
  apiBaseUrl: string;
  credential: string;
  deviceId: string;
  agentVersion: string;
};

export type ForegroundSample = {
  appName: string | null;
  isIdle: boolean;
  isLocked: boolean;
  observedAtMs: number;
};

export type AppUsageEvent = {
  clientEventId: string;
  deviceId: string;
  appName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  isIdle: false;
};

export type QueuedEvent = {
  event: AppUsageEvent;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

export type AgentStatus = {
  state: "unpaired" | "connected" | "offline" | "auth_required" | "error";
  deviceId?: string;
  lastHeartbeatAt?: string;
  lastUploadAt?: string;
  queuedEvents: number;
  error?: string;
};
