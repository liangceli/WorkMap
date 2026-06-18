import type { DomainUsageEvent } from "./domainTracking.js";
import type { DomainTrackerSnapshot } from "./domainState.js";

export type ExtensionConfig = {
  apiBaseUrl: string;
  credential: string;
  deviceId: string;
  browserName: string;
};

export type ExtensionStatus = {
  state: "unpaired" | "connected" | "offline" | "auth_required" | "error";
  lastHeartbeatAt?: string;
  lastUploadAt?: string;
  queuedEvents: number;
  error?: string;
};

export type QueuedDomainEvent = { event: DomainUsageEvent; attempts: number; nextAttemptAtMs: number; createdAtMs: number };

type StoredState = {
  workmapConfig?: ExtensionConfig;
  workmapStatus?: ExtensionStatus;
  workmapTracker?: DomainTrackerSnapshot;
  workmapQueue?: QueuedDomainEvent[];
};

declare const chrome: {
  storage: { local: { get(keys: string[] | string, callback: (items: StoredState) => void): void; set(items: StoredState, callback?: () => void): void } };
};

export function readStoredState(keys: (keyof StoredState)[]) {
  return new Promise<StoredState>((resolve) => chrome.storage.local.get(keys as string[], resolve));
}

export function writeStoredState(value: StoredState) {
  return new Promise<void>((resolve) => chrome.storage.local.set(value, resolve));
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
