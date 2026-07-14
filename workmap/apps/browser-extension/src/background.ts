import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import { readDomainFromUrl } from "./domainTracking.js";
import { DomainTrackingState, type OpenDomainTab } from "./domainState.js";
import { ExtensionApiError, sendDomainUsage, sendExtensionHeartbeat, sendExtensionStatus } from "./extensionApi.js";
import {
  enqueueDomainEvents,
  enqueueStatusEvent,
  normalizeQueue,
  normalizeStatusQueue,
  readStoredState,
  resolveStoredConfig,
  retryDomainEvents,
  retryStatusEvents,
  writeStoredState,
  type ExtensionConfig,
  type ExtensionDeviceStatusEvent,
  type ExtensionDeviceStatusName,
  type ExtensionDeviceStatusReason,
  type ExtensionStatus,
} from "./extensionStorage.js";

type ChromeTab = { id?: number; url?: string; active?: boolean; windowId?: number };
type RuntimeMessage = {
  type?: string;
  activityAt?: number;
  lastInputAt?: number;
  idleAt?: number;
  observedAt?: number;
};
type MessageSender = { tab?: ChromeTab; frameId?: number };
type ChromeApi = {
  runtime: {
    onInstalled: Event<() => void>;
    onStartup: Event<() => void>;
    onMessage: Event<(message: RuntimeMessage, sender: MessageSender) => void>;
  };
  tabs: {
    onActivated: Event<(info: { tabId: number; windowId: number }) => void>;
    onCreated: Event<(tab: ChromeTab) => void>;
    onUpdated: Event<(tabId: number, change: { url?: string }, tab: ChromeTab) => void>;
    onRemoved: Event<(tabId: number) => void>;
    onReplaced: Event<(addedTabId: number, removedTabId: number) => void>;
    query(query: Record<string, unknown>, callback: (tabs: ChromeTab[]) => void): void;
  };
  windows: {
    WINDOW_ID_NONE: number;
    onFocusChanged: Event<(windowId: number) => void>;
  };
  idle: {
    onStateChanged: Event<(state: "active" | "idle" | "locked") => void>;
    setDetectionInterval(seconds: number): void;
  };
  alarms: {
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm: Event<(alarm: { name: string }) => void>;
  };
  permissions: { onAdded: Event<() => void> };
};
type Event<T> = { addListener(listener: T): void };
declare const chrome: ChromeApi;

const ALARM_NAME = "workmap-domain-runtime";
const HEARTBEAT_INTERVAL_MS = 10_000;
const STATUS_UPLOAD_BATCH_SIZE = 20;
let operation = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => { void schedule(initialize); });
chrome.runtime.onStartup.addListener(() => { void schedule(initialize); });
chrome.permissions.onAdded.addListener(() => { void schedule(registerContentScript); });
chrome.tabs.onCreated.addListener(() => { void schedule(reconcileOpenTabs); });
chrome.tabs.onUpdated.addListener((_tabId, change) => { if (change.url) void schedule(reconcileOpenTabs); });
chrome.tabs.onRemoved.addListener((tabId) => {
  void schedule(() => mutateTracker((tracker, config, now) => tracker.observeTab(tabId, null, now, config.deviceId, config.browserName)));
});
chrome.tabs.onReplaced.addListener((_addedTabId, removedTabId) => {
  void schedule(() => mutateTracker((tracker, config, now) => tracker.observeTab(removedTabId, null, now, config.deviceId, config.browserName)));
  void schedule(reconcileOpenTabs);
});
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void schedule(() => mutateTracker((tracker, config, now) => tracker.activateTab(tabId, now, config.deviceId, config.browserName, windowId)));
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    void schedule(stopFocusedDomains);
  } else {
    void schedule(() => mutateTracker((tracker, config, now) => tracker.setFocusedWindow(windowId, now, config.deviceId, config.browserName)));
  }
});
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "locked") {
    void schedule(async () => {
      await stopFocusedDomains();
      await transitionDeviceStatus("LOCKED", "SYSTEM_LOCK", { operation: "chrome-idle-locked" });
    });
  } else if (state === "idle") {
    void schedule(stopFocusedDomains);
  } else {
    void schedule(resumeAfterUnlock);
  }
});
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) void schedule(onAlarm); });
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "workmap:extension-paired") {
    void schedule(initialize);
    return;
  }
  if (!message?.type || !sender.tab?.id) return;
  const tabId = sender.tab.id;
  const domain = readDomainFromUrl(sender.tab.url);
  if (message.type === "workmap:domain-activity" && domain) {
    void schedule(() => mutateTracker((tracker, config) => tracker.recordInteraction(
      tabId,
      domain,
      safeObservedAt(message.activityAt),
      config.deviceId,
      config.browserName,
      sender.tab?.windowId,
    )));
  } else if (message.type === "workmap:domain-idle" && Number.isFinite(message.lastInputAt) && Number.isFinite(message.idleAt)) {
    void schedule(() => mutateTracker((tracker, config) => tracker.markIdle(
      tabId,
      safeObservedAt(message.lastInputAt),
      safeObservedAt(message.idleAt),
      config.deviceId,
      config.browserName,
    )));
  } else if (message.type === "workmap:domain-blur" && sender.frameId === 0) {
    void schedule(() => mutateTracker((tracker, config) => tracker.blurTab(
      tabId,
      safeObservedAt(message.observedAt),
      config.deviceId,
      config.browserName,
    )));
  } else if (message.type === "workmap:domain-checkpoint" && sender.frameId === 0) {
    void schedule(() => mutateTracker((tracker, config) => tracker.checkpoint(
      safeObservedAt(message.observedAt),
      config.deviceId,
      config.browserName,
    )));
  }
});

void schedule(initialize);

function schedule(task: () => Promise<void>) {
  operation = operation.then(task, task);
  return operation;
}

async function initialize() {
  chrome.idle.setDetectionInterval(30);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  await registerContentScript();
  await reconcileOpenTabs(true);
}

async function registerContentScript() {
  try {
    // Dynamic registrations apply to future navigations. Re-injecting the
    // guarded script into existing web tabs closes the otherwise silent gap
    // after a service-worker or browser restart; the page marker makes this
    // idempotent and no URL/content is read by the script.
    await ensureDomainContentScriptRegistered(true);
  } catch {
    // Pairing/options reports permission errors; registration retries on startup and permission changes.
  }
}

async function reconcileOpenTabs(forceHeartbeat = false) {
  const tabs = await queryTabs();
  const openDomains: OpenDomainTab[] = tabs.flatMap((tab) => {
    const domain = readDomainFromUrl(tab.url);
    return tab.id !== undefined && domain ? [{ tabId: tab.id, domain, windowId: tab.windowId }] : [];
  });
  await mutateTracker(
    (tracker, config, now) => tracker.reconcileTabs(openDomains, now, config.deviceId, config.browserName),
    forceHeartbeat,
  );
}

async function stopFocusedDomains() {
  await mutateTracker((tracker, config, now) => tracker.stopFocus(now, config.deviceId, config.browserName));
}

async function onAlarm() {
  const tabs = await queryTabs();
  const openDomains = tabs.flatMap((tab) => {
    const domain = readDomainFromUrl(tab.url);
    return tab.id !== undefined && domain ? [{ tabId: tab.id, domain, windowId: tab.windowId }] : [];
  });
  await mutateTracker((tracker, config, now) => [
    ...tracker.reconcileTabs(openDomains, now, config.deviceId, config.browserName),
    ...tracker.checkpoint(now, config.deviceId, config.browserName),
  ], true);
}

async function mutateTracker(
  task: (tracker: DomainTrackingState, config: ExtensionConfig, nowMs: number) => ReturnType<DomainTrackingState["checkpoint"]>,
  forceHeartbeat = false,
) {
  const stored = await readStoredState(storageKeys);
  const config = await resolveRuntimeConfig(stored.workmapConfig, stored.workmapQueue?.length ?? 0, stored.workmapStatusQueue?.length ?? 0);
  if (!config) return;

  const now = Date.now();
  const tracker = new DomainTrackingState(stored.workmapTracker);
  const events = task(tracker, config, now);
  const queue = enqueueDomainEvents(normalizeQueue(stored.workmapQueue, now), events, now);
  const initialStatus = ensureInitialRunningStatus(
    statusWithQueues(stored.workmapStatus, queue.length, stored.workmapStatusQueue?.length ?? 0, config),
    normalizeStatusQueue(stored.workmapStatusQueue, now),
    config,
    now,
  );
  await writeStoredState({
    workmapTracker: tracker.snapshot(),
    workmapQueue: queue,
    workmapStatusQueue: initialStatus.queue,
    workmapStatus: statusWithQueues(initialStatus.status, queue.length, initialStatus.queue.length, config),
  });

  if (forceHeartbeat || heartbeatDue(initialStatus.status, now)) await heartbeat(config);
  if (events.length > 0 || queue.some((item) => item.nextAttemptAtMs <= now)) await flushActivityQueue(config);
  await flushStatusQueue(config);
}

function heartbeatDue(status: ExtensionStatus | undefined, nowMs: number) {
  const previous = status?.lastHeartbeatAt ? Date.parse(status.lastHeartbeatAt) : 0;
  return !Number.isFinite(previous) || nowMs - previous >= HEARTBEAT_INTERVAL_MS;
}

async function heartbeat(config: ExtensionConfig) {
  const stored = await readStoredState(storageKeys);
  const previous = stored.workmapStatus;
  const activityQueue = normalizeQueue(stored.workmapQueue);
  let statusQueue = normalizeStatusQueue(stored.workmapStatusQueue);
  try {
    await sendExtensionHeartbeat(config);
    let nextStatus = statusWithQueues(previous, activityQueue.length, statusQueue.length, config);
    if (
      previous?.lastHeartbeatAt
      && previous.state !== "connected"
      && previous.deviceStatus !== "LOCKED"
      && (previous.deviceStatus === "NETWORK_OFFLINE" || previous.deviceStatus === "SERVER_UNREACHABLE")
    ) {
      statusQueue = enqueueStatusEvent(
        statusQueue,
        createStatusEvent(config, "RECONNECTED", "SYSTEM_UNLOCK", Date.now(), { operation: "heartbeat-recovered" }),
      );
      nextStatus = { ...nextStatus, deviceStatus: "RECONNECTED" };
    }
    await writeStoredState({
      workmapStatusQueue: statusQueue,
      workmapStatus: {
        ...statusWithQueues(nextStatus, activityQueue.length, statusQueue.length, config),
        state: "connected",
        lastHeartbeatAt: new Date().toISOString(),
        error: undefined,
      },
    });
  } catch (error) {
    await recordHeartbeatFailure(config, error);
  }
}

async function flushActivityQueue(config: ExtensionConfig) {
  const stored = await readStoredState(storageKeys);
  if (stored.workmapStatus?.state === "auth_required") return;
  const queue = normalizeQueue(stored.workmapQueue);
  const statusQueue = normalizeStatusQueue(stored.workmapStatusQueue);
  const ready = queue.filter((item) => item.nextAttemptAtMs <= Date.now()).slice(0, 50);
  if (ready.length === 0) return;
  const ids = new Set(ready.map((item) => item.event.clientEventId));
  try {
    await sendDomainUsage(config, ready.map((item) => item.event));
    const remaining = queue.filter((item) => !ids.has(item.event.clientEventId));
    await writeStoredState({
      workmapQueue: remaining,
      workmapStatus: {
        ...statusWithQueues(stored.workmapStatus, remaining.length, statusQueue.length, config),
        state: "connected",
        lastUploadAt: new Date().toISOString(),
        error: undefined,
      },
    });
  } catch (error) {
    if (isAuthenticationError(error)) {
      await writeStoredState({
        workmapStatus: {
          ...statusWithQueues(stored.workmapStatus, queue.length, statusQueue.length, config),
          state: "auth_required",
          error: safeError(error),
        },
      });
    } else if (isPermanentPayloadError(error)) {
      const remaining = queue.filter((item) => !ids.has(item.event.clientEventId));
      await writeStoredState({
        workmapQueue: remaining,
        workmapStatus: {
          ...statusWithQueues(stored.workmapStatus, remaining.length, statusQueue.length, config),
          state: "error",
          error: safeError(error),
        },
      });
    } else {
      const retried = retryDomainEvents(queue, ids);
      await writeStoredState({ workmapQueue: retried });
      await recordConnectivityFailure(config, error);
    }
  }
}

async function flushStatusQueue(config: ExtensionConfig) {
  const stored = await readStoredState(storageKeys);
  if (stored.workmapStatus?.state === "auth_required") return;
  let queue = normalizeStatusQueue(stored.workmapStatusQueue);
  const activityQueue = normalizeQueue(stored.workmapQueue);
  const ready = queue.filter((item) => item.nextAttemptAtMs <= Date.now()).slice(0, STATUS_UPLOAD_BATCH_SIZE);
  if (ready.length === 0) return;

  const acknowledged = new Set<string>();
  try {
    for (const item of ready) {
      await sendExtensionStatus(config, item.event);
      acknowledged.add(item.event.clientEventId);
    }
    queue = queue.filter((item) => !acknowledged.has(item.event.clientEventId));
    await writeStoredState({
      workmapStatusQueue: queue,
      workmapStatus: {
        ...statusWithQueues(stored.workmapStatus, activityQueue.length, queue.length, config),
        state: "connected",
        lastStatusUploadAt: new Date().toISOString(),
        error: undefined,
      },
    });
  } catch (error) {
    queue = queue.filter((item) => !acknowledged.has(item.event.clientEventId));
    if (isAuthenticationError(error)) {
      await writeStoredState({
        workmapStatusQueue: queue,
        workmapStatus: {
          ...statusWithQueues(stored.workmapStatus, activityQueue.length, queue.length, config),
          state: "auth_required",
          error: safeError(error),
        },
      });
    } else if (isPermanentPayloadError(error)) {
      const failedId = ready.find((item) => !acknowledged.has(item.event.clientEventId))?.event.clientEventId;
      queue = queue.filter((item) => item.event.clientEventId !== failedId);
      await writeStoredState({
        workmapStatusQueue: queue,
        workmapStatus: {
          ...statusWithQueues(stored.workmapStatus, activityQueue.length, queue.length, config),
          state: "error",
          error: safeError(error),
        },
      });
    } else {
      const retryIds = new Set(ready.filter((item) => !acknowledged.has(item.event.clientEventId)).map((item) => item.event.clientEventId));
      queue = retryStatusEvents(queue, retryIds);
      await writeStoredState({
        workmapStatusQueue: queue,
        workmapStatus: {
          ...statusWithQueues(stored.workmapStatus, activityQueue.length, queue.length, config),
          state: "offline",
          error: safeError(error),
        },
      });
    }
  }
}

async function recordHeartbeatFailure(config: ExtensionConfig, error: unknown) {
  if (isAuthenticationError(error)) {
    const stored = await readStoredState(storageKeys);
    await writeStoredState({
      workmapStatus: {
        ...statusWithQueues(stored.workmapStatus, stored.workmapQueue?.length ?? 0, stored.workmapStatusQueue?.length ?? 0, config),
        state: "auth_required",
        error: safeError(error),
      },
    });
    return;
  }
  if (isPermanentPayloadError(error)) {
    const stored = await readStoredState(storageKeys);
    await writeStoredState({
      workmapStatus: {
        ...statusWithQueues(stored.workmapStatus, stored.workmapQueue?.length ?? 0, stored.workmapStatusQueue?.length ?? 0, config),
        state: "error",
        error: safeError(error),
      },
    });
    return;
  }
  await recordConnectivityFailure(config, error);
}

async function recordConnectivityFailure(config: ExtensionConfig, error: unknown) {
  const stored = await readStoredState(storageKeys);
  const activityQueue = normalizeQueue(stored.workmapQueue);
  let statusQueue = normalizeStatusQueue(stored.workmapStatusQueue);
  const { status, reason, networkState } = connectionFailureStatus();
  const current = statusWithQueues(stored.workmapStatus, activityQueue.length, statusQueue.length, config);
  const nextStatus = { ...current, state: "offline" as const, error: safeError(error) };
  if (current.deviceStatus !== status) {
    statusQueue = enqueueStatusEvent(
      statusQueue,
      createStatusEvent(config, status, reason, Date.now(), { operation: "request-failed", networkState }),
    );
    nextStatus.deviceStatus = status;
  }
  await writeStoredState({
    workmapStatusQueue: statusQueue,
    workmapStatus: statusWithQueues(nextStatus, activityQueue.length, statusQueue.length, config),
  });
}

async function transitionDeviceStatus(
  status: ExtensionDeviceStatusName,
  reason: ExtensionDeviceStatusReason,
  metadata?: ExtensionDeviceStatusEvent["metadata"],
) {
  const stored = await readStoredState(storageKeys);
  const config = await resolveRuntimeConfig(stored.workmapConfig, stored.workmapQueue?.length ?? 0, stored.workmapStatusQueue?.length ?? 0);
  if (!config || stored.workmapStatus?.state === "auth_required") return;
  const activityQueue = normalizeQueue(stored.workmapQueue);
  let statusQueue = normalizeStatusQueue(stored.workmapStatusQueue);
  const current = statusWithQueues(stored.workmapStatus, activityQueue.length, statusQueue.length, config);
  if (current.deviceStatus === status) return;
  statusQueue = enqueueStatusEvent(statusQueue, createStatusEvent(config, status, reason, Date.now(), metadata));
  await writeStoredState({
    workmapStatusQueue: statusQueue,
    workmapStatus: statusWithQueues({ ...current, deviceStatus: status }, activityQueue.length, statusQueue.length, config),
  });
  await flushStatusQueue(config);
}

async function resumeAfterUnlock() {
  const stored = await readStoredState(storageKeys);
  if (stored.workmapStatus?.deviceStatus !== "LOCKED") return;
  await transitionDeviceStatus("RECONNECTED", "SYSTEM_UNLOCK", { operation: "chrome-idle-active" });
}

function ensureInitialRunningStatus(status: ExtensionStatus, queue: ReturnType<typeof normalizeStatusQueue>, config: ExtensionConfig, nowMs: number) {
  if (status.deviceStatus) return { status, queue };
  const nextQueue = enqueueStatusEvent(queue, createStatusEvent(config, "RUNNING", "AGENT_STARTED", nowMs, { operation: "extension-start" }), nowMs);
  return { status: { ...status, deviceStatus: "RUNNING" as const }, queue: nextQueue };
}

function createStatusEvent(
  config: ExtensionConfig,
  status: ExtensionDeviceStatusName,
  reason: ExtensionDeviceStatusReason,
  nowMs: number,
  metadata?: ExtensionDeviceStatusEvent["metadata"],
): ExtensionDeviceStatusEvent {
  const timestamp = new Date(nowMs).toISOString();
  return {
    clientEventId: crypto.randomUUID(),
    deviceId: config.deviceId,
    status,
    reason,
    startedAt: timestamp,
    recordedAt: timestamp,
    lastHeartbeatAt: status === "RUNNING" || status === "RECONNECTED" ? timestamp : undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    confidence: "CONFIRMED",
    metadata: { ...metadata, agentVersion: "browser-extension-mv3/0.4.2" },
  };
}

function connectionFailureStatus() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "NETWORK_OFFLINE" as const, reason: "NETWORK_UNAVAILABLE" as const, networkState: "offline" };
  }
  return { status: "SERVER_UNREACHABLE" as const, reason: "SERVER_REQUEST_FAILED" as const, networkState: "server_unreachable" };
}

function statusWithQueues(
  status: ExtensionStatus | undefined,
  queuedEvents: number,
  queuedStatusEvents: number,
  config?: ExtensionConfig | null,
): ExtensionStatus {
  return {
    ...status,
    state: config ? status?.state ?? "offline" : "unpaired",
    queuedEvents,
    queuedStatusEvents,
  };
}

function isAuthenticationError(error: unknown) {
  return error instanceof ExtensionApiError && (error.status === 401 || error.status === 403);
}

function isPermanentPayloadError(error: unknown) {
  return error instanceof ExtensionApiError && Boolean(error.status && error.status < 500 && error.status !== 401 && error.status !== 403);
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown error";
}

async function resolveRuntimeConfig(
  config: Parameters<typeof resolveStoredConfig>[0],
  queuedEvents: number,
  queuedStatusEvents: number,
) {
  try {
    return await resolveStoredConfig(config);
  } catch {
    await writeStoredState({
      workmapStatus: {
        state: "auth_required",
        queuedEvents,
        queuedStatusEvents,
        error: "Device credential vault could not be opened. Pair this extension again.",
      },
    });
    return null;
  }
}

function safeObservedAt(value: number | undefined) {
  const now = Date.now();
  if (!Number.isFinite(value)) return now;
  return Math.max(now - 60_000, Math.min(now + 1_000, value!));
}

function queryTabs() {
  return new Promise<ChromeTab[]>((resolve) => chrome.tabs.query({}, resolve));
}

const storageKeys = ["workmapConfig", "workmapTracker", "workmapQueue", "workmapStatusQueue", "workmapStatus"] as const;
