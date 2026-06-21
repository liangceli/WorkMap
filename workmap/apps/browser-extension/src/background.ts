import { readDomainFromUrl } from "./domainTracking.js";
import { DomainTrackingState } from "./domainState.js";
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
type ChromeApi = {
  runtime: { onInstalled: Event<() => void>; onStartup: Event<() => void> };
  tabs: {
    onActivated: Event<(info: { tabId: number; windowId: number }) => void>;
    onUpdated: Event<(tabId: number, change: { url?: string }, tab: ChromeTab) => void>;
    get(tabId: number, callback: (tab: ChromeTab) => void): void;
    query(query: { active: boolean; lastFocusedWindow: boolean }, callback: (tabs: ChromeTab[]) => void): void;
  };
  windows: {
    WINDOW_ID_NONE: number;
    onFocusChanged: Event<(windowId: number) => void>;
    getLastFocused(callback: (window: { focused?: boolean }) => void): void;
  };
  idle: { onStateChanged: Event<(state: "active" | "idle" | "locked") => void>; queryState(seconds: number, callback: (state: "active" | "idle" | "locked") => void): void; setDetectionInterval(seconds: number): void };
  alarms: { create(name: string, info: { periodInMinutes: number }): void; onAlarm: Event<(alarm: { name: string }) => void> };
};
type Event<T> = { addListener(listener: T): void };
declare const chrome: ChromeApi;

const ALARM_NAME = "workmap-runtime";
let focused = true;
let idleState: "active" | "idle" | "locked" = "active";
let operation = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => { chrome.idle.setDetectionInterval(60); chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 }); void schedule(reconcileActiveTab); });
chrome.runtime.onStartup.addListener(() => { chrome.idle.setDetectionInterval(60); chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 }); void schedule(reconcileActiveTab); });
chrome.tabs.onActivated.addListener(({ tabId }) => { void schedule(() => switchToTab(tabId)); });
chrome.tabs.onUpdated.addListener((tabId, change, tab) => { if (change.url && tab.active) void schedule(() => switchToTab(tabId)); });
chrome.windows.onFocusChanged.addListener((windowId) => { focused = windowId !== chrome.windows.WINDOW_ID_NONE; void schedule(focused ? reconcileActiveTab : stopTracking); });
chrome.idle.onStateChanged.addListener((state) => { idleState = state; void schedule(state === "locked" ? stopTracking : reconcileActiveTab); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) void schedule(onAlarm); });

void schedule(async () => {
  chrome.idle.setDetectionInterval(60);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  idleState = await queryIdleState();
  focused = await queryWindowFocus();
  await reconcileActiveTab();
});

function schedule(task: () => Promise<void>) {
  operation = operation.then(task, task);
  return operation;
}

async function switchToTab(tabId: number) {
  const tab = await getTab(tabId);
  await updateTracking(readDomainFromUrl(tab.url));
}

async function reconcileActiveTab() {
  if (!focused || idleState === "locked") return stopTracking();
  const tabs = await queryTabs();
  await updateTracking(readDomainFromUrl(tabs[0]?.url));
}

async function stopTracking() { await updateTracking(null); }

async function updateTracking(domain: string | null, checkpoint = false) {
  const stored = await readStoredState(["workmapConfig", "workmapTracker", "workmapQueue", "workmapStatus"]);
  const config = await resolveRuntimeConfig(stored.workmapConfig, stored.workmapStatus?.queuedEvents ?? 0);
  const now = Date.now();
  const tracker = new DomainTrackingState(stored.workmapTracker);
  const events = config
    ? checkpoint
      ? tracker.checkpoint(now, config.deviceId, config.browserName)
      : tracker.observe(domain, !focused || idleState === "locked" ? "stopped" : idleState, now, config.deviceId, config.browserName)
    : [];
  const queue = enqueueDomainEvents(normalizeQueue(stored.workmapQueue, now), events, now);
  await writeStoredState({ workmapTracker: tracker.snapshot(), workmapQueue: queue, workmapStatus: statusWithQueue(stored.workmapStatus, queue.length, config) });
}

async function onAlarm() {
  focused = await queryWindowFocus();
  idleState = await queryIdleState();
  await reconcileActiveTab();
  await updateTracking((await activeDomain()), true);
  const stored = await readStoredState(["workmapConfig", "workmapQueue", "workmapStatus"]);
  const config = await resolveRuntimeConfig(stored.workmapConfig, stored.workmapStatus?.queuedEvents ?? 0);
  if (!config) return;
  await heartbeat(config, stored.workmapStatus);
  await flushQueue(config);
}

async function heartbeat(config: ExtensionConfig, previous?: ExtensionStatus) {
  try {
    await sendExtensionHeartbeat(config);
    await writeStoredState({ workmapStatus: { ...statusWithQueue(previous, previous?.queuedEvents ?? 0, config), state: "connected", lastHeartbeatAt: new Date().toISOString(), error: undefined } });
  } catch (error) { await storeFailure(error, previous?.queuedEvents ?? 0); }
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
    await writeStoredState({ workmapQueue: remaining, workmapStatus: { ...stored.workmapStatus, state: "connected", queuedEvents: remaining.length, lastUploadAt: new Date().toISOString(), error: undefined } });
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

async function storeFailure(error: unknown, queuedEvents: number) {
  const auth = error instanceof ExtensionApiError && (error.status === 401 || error.status === 403);
  await writeStoredState({ workmapStatus: { state: auth ? "auth_required" : "offline", queuedEvents, error: safeError(error) } });
}

function statusWithQueue(status: ExtensionStatus | undefined, queuedEvents: number, config?: ExtensionConfig | null): ExtensionStatus {
  return { ...status, state: config ? status?.state ?? "connected" : "unpaired", queuedEvents };
}

function safeError(error: unknown) { return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown error"; }
async function resolveRuntimeConfig(config: Parameters<typeof resolveStoredConfig>[0], queuedEvents: number) {
  try {
    return await resolveStoredConfig(config);
  } catch {
    await writeStoredState({ workmapStatus: { state: "auth_required", queuedEvents, error: "Device credential vault could not be opened. Pair this extension again." } });
    return null;
  }
}
async function activeDomain() { return readDomainFromUrl((await queryTabs())[0]?.url); }
function getTab(id: number) { return new Promise<ChromeTab>((resolve) => chrome.tabs.get(id, resolve)); }
function queryTabs() { return new Promise<ChromeTab[]>((resolve) => chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve)); }
function queryIdleState() { return new Promise<"active" | "idle" | "locked">((resolve) => chrome.idle.queryState(60, resolve)); }
function queryWindowFocus() { return new Promise<boolean>((resolve) => chrome.windows.getLastFocused((window) => resolve(window.focused === true))); }
