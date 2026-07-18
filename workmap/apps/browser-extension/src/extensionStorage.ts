import type { DomainUsageEvent } from "./domainTracking.js";
import type { DomainTrackerSnapshot } from "./domainState.js";
import { protectCredential, unprotectCredential, type ProtectedCredential } from "./credentialVault.js";
import { normalizeExcludedHostnames } from "./hostnameExclusions.js";

type ExtensionConfigMetadata = {
  apiBaseUrl: string;
  deviceId: string;
  browserName: string;
  excludedHostnames?: string[];
};

export type ExtensionConfig = ExtensionConfigMetadata & { credential: string };
export type PersistedExtensionConfig = ExtensionConfigMetadata & Partial<ProtectedCredential> & { credential?: string };

export type ExtensionStatus = {
  state:
    | "unpaired"
    | "pairing"
    | "connected"
    | "offline"
    | "paused"
    | "policy_required"
    | "auth_required"
    | "upgrade_required"
    | "error";
  lastHeartbeatAt?: string;
  lastUploadAt?: string;
  lastStatusUploadAt?: string;
  queuedEvents: number;
  queuedStatusEvents?: number;
  deviceStatus?: ExtensionDeviceStatusName;
  trackingState?: "ready" | "permission_required" | "registration_failed";
  trackingError?: string;
  error?: string;
};

export type QueuedDomainEvent = { event: DomainUsageEvent; attempts: number; nextAttemptAtMs: number; createdAtMs: number };

export type ExtensionDeviceStatusName =
  | "RUNNING"
  | "NETWORK_OFFLINE"
  | "LOCKED"
  | "SERVER_UNREACHABLE"
  | "RECONNECTED";

export type ExtensionDeviceStatusReason =
  | "AGENT_STARTED"
  | "NETWORK_UNAVAILABLE"
  | "SYSTEM_LOCK"
  | "SYSTEM_UNLOCK"
  | "SERVER_REQUEST_FAILED"
  | "UNKNOWN";

export type ExtensionDeviceStatusEvent = {
  clientEventId: string;
  deviceId: string;
  status: ExtensionDeviceStatusName;
  reason: ExtensionDeviceStatusReason;
  startedAt: string;
  recordedAt: string;
  lastHeartbeatAt?: string;
  timeZone: string;
  confidence: "CONFIRMED" | "INFERRED";
  metadata?: {
    operation?: string;
    networkState?: string;
    agentVersion?: string;
    trackingState?: "ready" | "permission_required" | "registration_failed";
  };
};

export type QueuedExtensionStatusEvent = {
  event: ExtensionDeviceStatusEvent;
  attempts: number;
  nextAttemptAtMs: number;
  createdAtMs: number;
};

type StoredState = {
  workmapConfig?: PersistedExtensionConfig;
  workmapStatus?: ExtensionStatus;
  workmapTracker?: DomainTrackerSnapshot;
  workmapQueue?: QueuedDomainEvent[];
  workmapStatusQueue?: QueuedExtensionStatusEvent[];
};

declare const chrome: {
  storage: {
    local: {
      get(keys: string[] | string, callback: (items: StoredState) => void): void;
      set(items: StoredState, callback?: () => void): void;
      remove(keys: string[] | string, callback?: () => void): void;
    };
  };
};

export function readStoredState(keys: readonly (keyof StoredState)[]) {
  return new Promise<StoredState>((resolve) => chrome.storage.local.get(keys as string[], resolve));
}

export function writeStoredState(value: StoredState) {
  return new Promise<void>((resolve) => chrome.storage.local.set(value, resolve));
}

export function removeStoredState(keys: readonly (keyof StoredState)[]) {
  return new Promise<void>((resolve) =>
    chrome.storage.local.remove(keys as string[], resolve),
  );
}

export async function savePairedConfig(config: ExtensionConfig) {
  const protectedCredential = await protectCredential(config.credential);
  const metadata: ExtensionConfigMetadata = {
    apiBaseUrl: config.apiBaseUrl,
    deviceId: config.deviceId,
    browserName: config.browserName,
    excludedHostnames: normalizeExcludedHostnames(
      config.excludedHostnames ?? [],
    ),
  };
  await writeStoredState({ workmapConfig: { ...metadata, ...protectedCredential } });
}

export async function resolveStoredConfig(config: PersistedExtensionConfig | undefined): Promise<ExtensionConfig | null> {
  if (!config) return null;

  const {
    apiBaseUrl,
    deviceId,
    browserName,
    excludedHostnames,
  } = config;
  if (config.credentialCiphertext && config.credentialIv && config.credentialVersion === 1) {
    const credential = await unprotectCredential(config as PersistedExtensionConfig & ProtectedCredential);
    return {
      apiBaseUrl,
      deviceId,
      browserName,
      credential,
      excludedHostnames: normalizeExcludedHostnames(
        excludedHostnames ?? [],
      ),
    };
  }

  if (config.credential) {
    const runtimeConfig = {
      apiBaseUrl,
      deviceId,
      browserName,
      credential: config.credential,
      excludedHostnames: normalizeExcludedHostnames(
        excludedHostnames ?? [],
      ),
    };
    await savePairedConfig(runtimeConfig);
    return runtimeConfig;
  }

  return null;
}

export const MAX_EXTENSION_QUEUE = 1_000;
export const MAX_EXTENSION_QUEUE_AGE_MS = 31 * 24 * 60 * 60 * 1000;

export function normalizeQueue(queue: QueuedDomainEvent[] | undefined, nowMs = Date.now()) {
  return (queue ?? []).filter((item) => item.createdAtMs >= nowMs - MAX_EXTENSION_QUEUE_AGE_MS).slice(-MAX_EXTENSION_QUEUE);
}

export function enqueueDomainEvents(queue: QueuedDomainEvent[], events: DomainUsageEvent[], nowMs = Date.now()) {
  const ids = new Set(queue.map((item) => item.event.clientEventId));
  for (const event of events) {
    if (!ids.has(event.clientEventId)) {
      queue.push({ event, attempts: 0, nextAttemptAtMs: nowMs, createdAtMs: nowMs });
      ids.add(event.clientEventId);
    }
  }
  return queue.slice(-MAX_EXTENSION_QUEUE);
}

export function retryDomainEvents(queue: QueuedDomainEvent[], ids: Set<string>, nowMs = Date.now()) {
  return queue.map((item) => {
    if (!ids.has(item.event.clientEventId)) return item;
    const attempts = item.attempts + 1;
    return { ...item, attempts, nextAttemptAtMs: nowMs + Math.min(5 * 60_000, 5_000 * 2 ** Math.min(attempts, 6)) };
  });
}

export function normalizeStatusQueue(queue: QueuedExtensionStatusEvent[] | undefined, nowMs = Date.now()) {
  return (queue ?? []).filter((item) => item.createdAtMs >= nowMs - MAX_EXTENSION_QUEUE_AGE_MS).slice(-MAX_EXTENSION_QUEUE);
}

export function enqueueStatusEvent(
  queue: QueuedExtensionStatusEvent[],
  event: ExtensionDeviceStatusEvent,
  nowMs = Date.now(),
) {
  if (!queue.some((item) => item.event.clientEventId === event.clientEventId)) {
    queue.push({ event, attempts: 0, nextAttemptAtMs: nowMs, createdAtMs: nowMs });
  }
  return queue.slice(-MAX_EXTENSION_QUEUE);
}

export function retryStatusEvents(queue: QueuedExtensionStatusEvent[], ids: Set<string>, nowMs = Date.now()) {
  return queue.map((item) => {
    if (!ids.has(item.event.clientEventId)) return item;
    const attempts = item.attempts + 1;
    return { ...item, attempts, nextAttemptAtMs: nowMs + Math.min(5 * 60_000, 5_000 * 2 ** Math.min(attempts, 6)) };
  });
}
