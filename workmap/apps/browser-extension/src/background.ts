import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import { readDomainFromUrl } from "./domainTracking.js";
import { DomainTrackingState, type OpenDomainTab } from "./domainState.js";
import { ExtensionApiError, sendDomainUsage, sendExtensionHeartbeat } from "./extensionApi.js";
import {
  enqueueDomainEvents,
  normalizeQueue,
  readStoredState,
  resolveStoredConfig,
  retryDomainEvents,
  writeStoredState,
  type ExtensionConfig,
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
    get(tabId: number, callback: (tab: ChromeTab) => void): void;
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
let operation = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => { void schedule(initialize); });
chrome.runtime.onStartup.addListener(() => { void schedule(initialize); });
chrome.permissions.onAdded.addListener(() => { void schedule(registerContentScript); });
chrome.tabs.onCreated.addListener(() => { void schedule(reconcileOpenTabs); });
chrome.tabs.onUpdated.addListener((_tabId, change) => { if (change.url) void schedule(reconcileOpenTabs); });
chrome.tabs.onRemoved.addListener(() => { void schedule(reconcileOpenTabs); });
chrome.tabs.onReplaced.addListener(() => { void schedule(reconcileOpenTabs); });
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void schedule(() => mutateTracker((tracker, config, now) => tracker.activateTab(tabId, now, config.deviceId, config.browserName)));
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) void schedule(stopFocusedDomain);
});
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "locked") void schedule(stopFocusedDomain);
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
    await ensureDomainContentScriptRegistered();
  } catch {
    // Pairing/options shows permission errors; background registration retries on startup/permission changes.
  }
}

async function reconcileOpenTabs(forceHeartbeat = false) {
  const tabs = await queryTabs();
  const openDomains: OpenDomainTab[] = tabs.flatMap((tab) => {
    const domain = readDomainFromUrl(tab.url);
    return tab.id !== undefined && domain ? [{ tabId: tab.id, domain }] : [];
  });
  await mutateTracker(
    (tracker, config, now) => tracker.reconcileTabs(openDomains, now, config.deviceId, config.browserName),
    forceHeartbeat,
  );
}

async function stopFocusedDomain() {
  await mutateTracker((tracker, config, now) => tracker.stopFocus(now, config.deviceId, config.browserName));
}

async function onAlarm() {
  const tabs = await queryTabs();
  const openDomains = tabs.flatMap((tab) => {
    const domain = readDomainFromUrl(tab.url);
    return tab.id !== undefined && domain ? [{ tabId: tab.id, domain }] : [];
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
  const stored = await readStoredState(["workmapConfig", "workmapTracker", "workmapQueue", "workmapStatus"]);
  const config = await resolveRuntimeConfig(stored.workmapConfig, stored.workmapStatus?.queuedEvents ?? 0);
  if (!config) return;
  const now = Date.now();
  const tracker = new DomainTrackingState(stored.workmapTracker);
  const events = task(tracker, config, now);
  const queue = enqueueDomainEvents(normalizeQueue(stored.workmapQueue, now), events, now);
  await writeStoredState({
    workmapTracker: tracker.snapshot(),
    workmapQueue: queue,
    workmapStatus: statusWithQueue(stored.workmapStatus, queue.length, config),
  });
  if (forceHeartbeat || heartbeatDue(stored.workmapStatus, now)) await heartbeat(config, stored.workmapStatus);
  if (events.length > 0 || queue.some((item) => item.nextAttemptAtMs <= now)) await flushQueue(config);
}

function heartbeatDue(status: ExtensionStatus | undefined, nowMs: number) {
  const previous = status?.lastHeartbeatAt ? Date.parse(status.lastHeartbeatAt) : 0;
  return !Number.isFinite(previous) || nowMs - previous >= HEARTBEAT_INTERVAL_MS;
}

async function heartbeat(config: ExtensionConfig, previous?: ExtensionStatus) {
  try {
    await sendExtensionHeartbeat(config);
    await writeStoredState({
      workmapStatus: {
        ...statusWithQueue(previous, previous?.queuedEvents ?? 0, config),
        state: "connected",
        lastHeartbeatAt: new Date().toISOString(),
        error: undefined,
      },
    });
  } catch (error) {
    await storeFailure(error, previous, previous?.queuedEvents ?? 0);
  }
}

async function flushQueue(config: ExtensionConfig) {
  const stored = await readStoredState(["workmapQueue", "workmapStatus"]);
  if (stored.workmapStatus?.state === "auth_required") return;
  const queue = normalizeQueue(stored.workmapQueue);
  const ready = queue.filter((item) => item.nextAttemptAtMs <= Date.now()).slice(0, 50);
  if (ready.length === 0) return;
  const ids = new Set(ready.map((item) => item.event.clientEventId));
  try {
    await sendDomainUsage(config, ready.map((item) => item.event));
    const remaining = queue.filter((item) => !ids.has(item.event.clientEventId));
    await writeStoredState({
      workmapQueue: remaining,
      workmapStatus: {
        ...stored.workmapStatus,
        state: "connected",
        queuedEvents: remaining.length,
        lastUploadAt: new Date().toISOString(),
        error: undefined,
      },
    });
  } catch (error) {
    if (error instanceof ExtensionApiError && (error.status === 401 || error.status === 403)) {
      await writeStoredState({ workmapStatus: { ...stored.workmapStatus, state: "auth_required", queuedEvents: queue.length, error: error.message } });
    } else if (error instanceof ExtensionApiError && error.status && error.status < 500) {
      const remaining = queue.filter((item) => !ids.has(item.event.clientEventId));
      await writeStoredState({ workmapQueue: remaining, workmapStatus: { ...stored.workmapStatus, state: "error", queuedEvents: remaining.length, error: error.message } });
    } else {
      const retried = retryDomainEvents(queue, ids);
      await writeStoredState({ workmapQueue: retried, workmapStatus: { ...stored.workmapStatus, state: "offline", queuedEvents: retried.length, error: safeError(error) } });
    }
  }
}

async function storeFailure(error: unknown, previous: ExtensionStatus | undefined, queuedEvents: number) {
  const auth = error instanceof ExtensionApiError && (error.status === 401 || error.status === 403);
  await writeStoredState({ workmapStatus: { ...previous, state: auth ? "auth_required" : "offline", queuedEvents, error: safeError(error) } });
}

function statusWithQueue(status: ExtensionStatus | undefined, queuedEvents: number, config?: ExtensionConfig | null): ExtensionStatus {
  return { ...status, state: config ? status?.state ?? "offline" : "unpaired", queuedEvents };
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown error";
}

async function resolveRuntimeConfig(config: Parameters<typeof resolveStoredConfig>[0], queuedEvents: number) {
  try {
    return await resolveStoredConfig(config);
  } catch {
    await writeStoredState({ workmapStatus: { state: "auth_required", queuedEvents, error: "Device credential vault could not be opened. Pair this extension again." } });
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
