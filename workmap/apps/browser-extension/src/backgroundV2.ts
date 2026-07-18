import { BrowserFocusEngineV2 } from "./browserFocusEngineV2.js";
import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import { DomainTrackingState } from "./domainState.js";
import { readDomainFromUrl, type DomainUsageEvent } from "./domainTracking.js";
import {
  ExtensionApiError,
  confirmProtocolV2,
  getDeviceClientStatus,
  getTrackingPolicyV2,
  isUpgradeRequiredError,
  prepareProtocolV2,
  sendDomainUsage,
  syncTrackingV2,
} from "./extensionApi.js";
import {
  readStoredState,
  removeStoredState,
  resolveStoredConfig,
  writeStoredState,
  type ExtensionConfig,
  type ExtensionStatus,
  type QueuedDomainEvent,
} from "./extensionStorage.js";
import {
  BrowserTrackingV2Store,
  BrowserV2QueuePressureError,
} from "./trackingV2Store.js";
import { isExcludedHostname } from "./hostnameExclusions.js";
import {
  BROWSER_EXTENSION_VERSION,
  BROWSER_V2_POLICY_REFRESH_MS,
  BROWSER_V2_SYNC_BATCH_SIZE,
  TRACKING_PROTOCOL_VERSION_V2,
  type BrowserClientHealthV2,
  type BrowserNameV2,
  type BrowserTrackingRuntimeStateV2,
  type DeviceTrackingPolicyV2,
  type TrackingCollectorStateV2,
  type TrackingConnectionStateV2,
  type TrackingHealthErrorCodeV2,
  type TrackingPolicyStateV2,
} from "./trackingV2Types.js";

type ChromeTab = {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
};
type ChromeWindow = {
  id?: number;
  focused?: boolean;
};
type RuntimeMessage = {
  type?: string;
  activityAt?: number;
  lastInputAt?: number;
  idleAt?: number;
  observedAt?: number;
};
type MessageSender = { tab?: ChromeTab; frameId?: number };
type ChromeEvent<T> = { addListener(listener: T): void };

type ChromeApi = {
  runtime: {
    onInstalled: ChromeEvent<() => void>;
    onStartup: ChromeEvent<() => void>;
    onMessage: ChromeEvent<
      (message: RuntimeMessage, sender: MessageSender) => void
    >;
    lastError?: { message?: string };
  };
  tabs: {
    onActivated: ChromeEvent<
      (info: { tabId: number; windowId: number }) => void
    >;
    onUpdated: ChromeEvent<
      (
        tabId: number,
        change: { url?: string; status?: string },
        tab: ChromeTab,
      ) => void
    >;
    onRemoved: ChromeEvent<(tabId: number) => void>;
    onReplaced: ChromeEvent<
      (addedTabId: number, removedTabId: number) => void
    >;
    query(
      query: Record<string, unknown>,
      callback: (tabs: ChromeTab[]) => void,
    ): void;
  };
  windows: {
    WINDOW_ID_NONE: number;
    onFocusChanged: ChromeEvent<(windowId: number) => void>;
    getLastFocused(
      options: { populate: false },
      callback: (window: ChromeWindow) => void,
    ): void;
  };
  idle: {
    onStateChanged: ChromeEvent<
      (state: "active" | "idle" | "locked") => void
    >;
    setDetectionInterval(seconds: number): void;
    queryState(
      seconds: number,
      callback: (state: "active" | "idle" | "locked") => void,
    ): void;
  };
  alarms: {
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm: ChromeEvent<(alarm: { name: string }) => void>;
  };
  permissions: {
    onAdded: ChromeEvent<() => void>;
    onRemoved: ChromeEvent<() => void>;
  };
};

declare const chrome: ChromeApi;

const ALARM_NAME = "workmap-tracking-v2";
const LEGACY_BATCH_SIZE = 50;
const INTERACTION_SYNC_THROTTLE_MS = 1_000;

let operation = Promise.resolve();

function schedule(task: () => Promise<void>) {
  operation = operation.then(task, task);
  return operation;
}

export class BrowserExtensionRuntimeV2 {
  private readonly store = new BrowserTrackingV2Store();
  private config: ExtensionConfig | null = null;
  private browserName: BrowserNameV2 | null = null;
  private state: BrowserTrackingRuntimeStateV2 | null = null;
  private engine: BrowserFocusEngineV2 | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private connectionState: TrackingConnectionStateV2 = "OFFLINE";
  private collectorState: TrackingCollectorStateV2 = "PAUSED";
  private errorCode: TrackingHealthErrorCodeV2 = "NONE";
  private lastPolicyRefreshAtMs = 0;
  private lastSyncAttemptAtMs = 0;
  private syncTimer: number | null = null;

  constructor(private readonly chromeApi: ChromeApi) {}

  async initialize() {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeInternal().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  async resetAfterPairing() {
    if (this.syncTimer !== null) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    await this.store.reset();
    this.config = null;
    this.browserName = null;
    this.state = null;
    this.engine = null;
    this.initialized = false;
    await this.initialize();
  }

  async handlePermissionChange() {
    await this.ensureInitialized();
    if (!this.config) return;
    const registered = await this.registerContentScript();
    if (!registered) {
      await this.pauseCollector(
        "INTERACTION_PERMISSION_REQUIRED",
        "Website tracking access is required.",
      );
      return;
    }
    await this.restoreCollectorIfAllowed();
    await this.reconcileBrowserReality(true);
  }

  async handleExclusionsUpdated() {
    const stored = await readStoredState(["workmapConfig"]);
    this.config = await resolveRuntimeConfig(stored.workmapConfig);
    if (
      this.state?.activeDomain &&
      isExcludedHostname(
        this.state.activeDomain,
        this.config?.excludedHostnames,
      )
    ) {
      await this.clearFocus(true);
    }
    await this.reconcileBrowserReality(true);
  }

  async handleTabActivated(tabId: number, windowId: number) {
    await this.ensureInitialized();
    if (!this.state || this.state.systemIdle) return;
    if (this.state.focusedWindowId !== windowId) return;
    const [tab] = await queryTabs(this.chromeApi, {
      active: true,
      windowId,
    });
    if (!tab || tab.id !== tabId) return;
    await this.activateTab(tab, true);
  }

  async handleTabUpdated(tabId: number, tab: ChromeTab) {
    await this.ensureInitialized();
    if (!this.state || tabId !== this.state.activeTabId) return;
    if (tab.windowId !== this.state.focusedWindowId) return;
    const domain = readDomainFromUrl(tab.url);
    if (!domain) {
      await this.clearFocus(true);
      return;
    }
    if (domain !== this.state.activeDomain) {
      await this.activateTab(tab, true);
    }
  }

  async handleTabRemoved(tabId: number) {
    await this.ensureInitialized();
    if (!this.state || tabId !== this.state.activeTabId) return;
    await this.clearFocus(true);
    await this.reconcileBrowserReality(true);
  }

  async handleTabReplaced(addedTabId: number, removedTabId: number) {
    await this.ensureInitialized();
    if (!this.state || removedTabId !== this.state.activeTabId) return;
    await this.clearFocus(true);
    if (this.state.focusedWindowId === null) return;
    const [tab] = await queryTabs(this.chromeApi, {
      active: true,
      windowId: this.state.focusedWindowId,
    });
    if (tab?.id === addedTabId) await this.activateTab(tab, true);
  }

  async handleWindowFocus(windowId: number) {
    await this.ensureInitialized();
    if (!this.state) return;
    if (windowId === this.chromeApi.windows.WINDOW_ID_NONE) {
      this.state = {
        ...this.state,
        focusedWindowId: null,
        activeTabId: null,
        activeDomain: null,
      };
      await this.clearFocus(true);
      return;
    }
    this.state = { ...this.state, focusedWindowId: windowId };
    await this.store.writeRuntimeState(this.state);
    if (this.state.systemIdle) return;
    const [tab] = await queryTabs(this.chromeApi, {
      active: true,
      windowId,
    });
    if (tab) await this.activateTab(tab, true);
    else await this.clearFocus(true);
  }

  async handleIdleState(state: "active" | "idle" | "locked") {
    await this.ensureInitialized();
    if (!this.state) return;
    const isIdle = state !== "active";
    this.state = { ...this.state, systemIdle: isIdle };
    if (isIdle) {
      this.collectorState = "PAUSED";
      await this.clearFocus(true);
      await this.store.writeRuntimeState(this.state);
      await this.requestSync(true);
      return;
    }
    await this.restoreCollectorIfAllowed();
    await this.reconcileBrowserReality(true);
  }

  async handleMessage(message: RuntimeMessage, sender: MessageSender) {
    await this.ensureInitialized();
    if (!this.state || !this.engine || sender.tab?.id === undefined) return;
    if (
      sender.tab.id !== this.state.activeTabId ||
      sender.tab.windowId !== this.state.focusedWindowId
    ) {
      return;
    }
    const domain = readDomainFromUrl(sender.tab.url);
    if (!domain || domain !== this.state.activeDomain) return;

    if (message.type === "workmap:domain-activity") {
      const monotonicMs = this.mapPageTimeToMonotonic(message.activityAt);
      await this.persistUpdate(
        this.engine.recordTrustedInteraction(monotonicMs),
        false,
      );
      await this.requestSync(false);
      return;
    }
    if (message.type === "workmap:domain-blur" && sender.frameId === 0) {
      await this.clearFocus(true);
      return;
    }
    if (
      message.type === "workmap:domain-checkpoint" &&
      sender.frameId === 0
    ) {
      await this.reconcileBrowserReality(false);
    }
  }

  async handleAlarm() {
    await this.ensureInitialized();
    if (!this.state) return;
    await this.refreshPolicyIfDue();
    if (this.engine) {
      await this.persistUpdate(this.engine.settle(performance.now()), true);
    }
    await this.reconcileBrowserReality(false);
    await this.flushLegacyQueue();
    await this.requestSync(true);
    await this.restoreAfterQueuePressure();
  }

  private async initializeInternal() {
    this.chromeApi.idle.setDetectionInterval(60);
    this.chromeApi.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    const stored = await readStoredState([
      "workmapConfig",
      "workmapStatus",
      "workmapQueue",
      "workmapTracker",
    ]);
    this.config = await resolveRuntimeConfig(stored.workmapConfig);
    if (!this.config) {
      await writeStoredState({
        workmapStatus: {
          state: "unpaired",
          queuedEvents: stored.workmapQueue?.length ?? 0,
          queuedStatusEvents: 0,
        },
      });
      this.initialized = true;
      return;
    }
    this.browserName = normalizeBrowserName(this.config.browserName);
    this.state = await this.store.readRuntimeState();

    const registered = await this.registerContentScript();
    if (!registered) {
      this.collectorState = "PAUSED";
      this.errorCode = "INTERACTION_PERMISSION_REQUIRED";
    }
    const activated = await this.ensureProtocolV2(stored);
    if (!activated) {
      this.initialized = true;
      await this.updateVisibleStatus();
      return;
    }

    await this.flushLegacyQueue();
    await this.closeRecoveredV2Tail();
    const idleState = await queryIdleState(this.chromeApi, 60);
    this.state = { ...this.state!, systemIdle: idleState !== "active" };
    if (this.state.systemIdle) this.collectorState = "PAUSED";
    await this.store.writeRuntimeState(this.state);
    this.initialized = true;
    await this.reconcileBrowserReality(true);
    await this.requestSync(true);
  }

  private async ensureProtocolV2(
    stored: Awaited<ReturnType<typeof readStoredState>>,
  ) {
    if (!this.config || !this.browserName || !this.state) return false;
    try {
      const identity = await getDeviceClientStatus(this.config);
      if (
        identity.clientType !== "BROWSER_EXTENSION" ||
        identity.deviceId !== this.config.deviceId ||
        !identity.workstationId ||
        identity.browserName !== this.browserName
      ) {
        throw new Error(
          "The paired Browser Extension identity is incomplete or does not match this browser.",
        );
      }
      const prepared = await prepareProtocolV2(this.config);
      this.applyServerClock(prepared.serverTime);
      let activatedAt = prepared.protocolActivatedAt;
      const boundary =
        prepared.proposedActivatedAt ?? prepared.protocolActivatedAt;
      if (!boundary) {
        throw new Error(
          "The server did not return a protocol activation boundary.",
        );
      }

      if (
        this.state.migrationState === "V1" ||
        this.state.migrationState === "PREPARING_V2"
      ) {
        await this.closeLegacyTrackerAt(stored, boundary);
      }

      if (prepared.state !== "CONFIRMED") {
        if (!prepared.activationId || !prepared.proposedActivatedAt) {
          throw new Error(
            "The server did not return a complete v2 activation handshake.",
          );
        }
        this.state = {
          ...this.state,
          migrationState: "PREPARING_V2",
          activationId: prepared.activationId,
          proposedActivatedAt: prepared.proposedActivatedAt,
          policy: prepared.policy,
        };
        await this.store.writeRuntimeState(this.state);
        const confirmed = await confirmProtocolV2(
          this.config,
          prepared.activationId,
          prepared.proposedActivatedAt,
        );
        this.applyServerClock(confirmed.serverTime);
        activatedAt = confirmed.protocolActivatedAt;
      }
      if (!activatedAt) {
        throw new Error("Protocol v2 activation was not confirmed.");
      }

      const legacy = await readStoredState(["workmapQueue"]);
      this.state = {
        ...this.state,
        protocolActivatedAt: activatedAt,
        proposedActivatedAt: activatedAt,
        policy: prepared.policy,
        migrationState:
          (legacy.workmapQueue?.length ?? 0) > 0 ? "DRAINING_V1" : "V2",
        lastErrorCode: "NONE",
      };
      await this.store.writeRuntimeState(this.state);
      this.connectionState = "ONLINE";
      this.collectorState = collectorStateForPolicy(
        prepared.policy,
        serverNow(this.state),
      );
      this.errorCode = "NONE";
      this.lastPolicyRefreshAtMs = Date.now();
      return true;
    } catch (error) {
      if (
        this.state.protocolActivatedAt &&
        this.state.policy &&
        policyLeaseValid(this.state.policy, serverNow(this.state))
      ) {
        this.connectionState = "OFFLINE";
        this.collectorState = collectorStateForPolicy(
          this.state.policy,
          serverNow(this.state),
        );
        this.errorCode = "POLICY_UNAVAILABLE";
        return true;
      }
      await this.applyFailure(error);
      return false;
    }
  }

  private async closeLegacyTrackerAt(
    stored: Awaited<ReturnType<typeof readStoredState>>,
    boundary: string,
  ) {
    if (!this.config || !stored.workmapTracker) return;
    const boundaryMs = Date.parse(boundary);
    if (!Number.isFinite(boundaryMs)) {
      throw new Error("Protocol activation boundary is invalid.");
    }
    const tracker = new DomainTrackingState(stored.workmapTracker);
    const events = [
      ...tracker.stopFocus(
        boundaryMs,
        this.config.deviceId,
        this.config.browserName,
      ),
      ...tracker.reconcileTabs(
        [],
        boundaryMs,
        this.config.deviceId,
        this.config.browserName,
      ),
    ];
    const queue = appendLegacyEvents(stored.workmapQueue ?? [], events);
    if (
      queue.some(
        (item) => Date.parse(item.event.endedAt) > boundaryMs,
      )
    ) {
      throw new Error(
        "A retained legacy domain event extends beyond the v2 activation boundary.",
      );
    }
    await writeStoredState({
      workmapTracker: tracker.snapshot(),
      workmapQueue: queue,
    });
  }

  private async closeRecoveredV2Tail() {
    if (
      !this.state?.clock ||
      !this.state.engineCheckpoint ||
      !this.state.policy ||
      !this.browserName
    ) {
      return;
    }
    const recovered = new BrowserFocusEngineV2(
      this.state.clock,
      this.state.policy,
      this.browserName,
      this.state.engineCheckpoint,
    );
    const boundary = this.state.engineCheckpoint.lastObservedAtMonotonicMs;
    const update = recovered.clearFocus(boundary);
    const recoveredState = {
      ...this.state,
      engineCheckpoint: recovered.checkpoint(),
      latestSnapshot: update.snapshot,
    };
    try {
      await this.store.persistEngineUpdate(
        update.intervals,
        recoveredState,
        update.snapshot,
      );
    } catch (error) {
      if (error instanceof BrowserV2QueuePressureError) {
        await this.pauseCollector("QUEUE_PRESSURE", error.message);
        await this.requestSync(true);
        return;
      }
      throw error;
    }
    this.state = {
      ...recoveredState,
      clock: null,
      engineCheckpoint: null,
      activeTabId: null,
      activeDomain: null,
    };
    this.engine = null;
    await this.store.writeRuntimeState(this.state);
  }

  private async activateTab(tab: ChromeTab, immediateSync: boolean) {
    if (
      !this.state ||
      !this.browserName ||
      tab.id === undefined ||
      tab.windowId !== this.state.focusedWindowId
    ) {
      return;
    }
    const domain = readDomainFromUrl(tab.url);
    if (
      !domain ||
      isExcludedHostname(domain, this.config?.excludedHostnames) ||
      !this.captureAllowed()
    ) {
      await this.clearFocus(immediateSync);
      return;
    }
    this.ensureEngine(performance.now());
    this.state = {
      ...this.state,
      activeTabId: tab.id,
      activeDomain: domain,
    };
    await this.persistUpdate(
      this.engine!.acquireFocus(
        { subjectKey: domain, displayName: domain },
        performance.now(),
      ),
      immediateSync,
    );
    if (immediateSync) await this.requestSync(true);
  }

  private async clearFocus(immediateSync: boolean) {
    if (!this.state) return;
    if (this.engine) {
      await this.persistUpdate(
        this.engine.clearFocus(performance.now()),
        immediateSync,
      );
    }
    this.engine = null;
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      activeTabId: null,
      activeDomain: null,
    };
    await this.store.writeRuntimeState(this.state);
    if (immediateSync) await this.requestSync(true);
  }

  private ensureEngine(atMonotonicMs: number) {
    if (this.engine || !this.state || !this.browserName) return;
    const policy = this.state.policy;
    if (!policy?.policyLeaseId) {
      throw new Error("A valid browser tracking policy lease is required.");
    }
    const anchorUtcMs = Math.max(
      serverNow(this.state),
      Date.parse(this.state.protocolActivatedAt ?? ""),
    );
    const clock = {
      clockEpochId: crypto.randomUUID(),
      clockEpochStartedAt: new Date(anchorUtcMs).toISOString(),
      clockEpochStartedMonotonicMs: atMonotonicMs,
    };
    this.state = {
      ...this.state,
      clock,
    };
    this.engine = new BrowserFocusEngineV2(
      clock,
      policy,
      this.browserName,
    );
  }

  private async persistUpdate(
    update: ReturnType<BrowserFocusEngineV2["observe"]>,
    immediateSync: boolean,
  ) {
    if (!this.engine || !this.state) return false;
    const durableState = this.state;
    const nextState: BrowserTrackingRuntimeStateV2 = {
      ...durableState,
      engineCheckpoint: this.engine.checkpoint(),
      latestSnapshot: update.snapshot,
      lastErrorCode: this.errorCode,
    };
    try {
      await this.store.persistEngineUpdate(
        update.intervals,
        nextState,
        update.snapshot,
      );
      this.state = nextState;
    } catch (error) {
      if (error instanceof BrowserV2QueuePressureError) {
        this.engine = null;
        this.state = {
          ...durableState,
          lastErrorCode: "QUEUE_PRESSURE",
        };
        await this.store.writeRuntimeState(this.state);
        await this.pauseCollector("QUEUE_PRESSURE", error.message);
        await this.requestSync(true);
        return false;
      }
      throw error;
    }
    await this.updateVisibleStatus();
    if (immediateSync || update.intervals.length > 0) {
      await this.requestSync(immediateSync);
    }
    return true;
  }

  private async requestSync(immediate: boolean) {
    if (!this.config || !this.state?.protocolActivatedAt) return;
    if (
      this.connectionState === "AUTH_REQUIRED" ||
      this.connectionState === "UPGRADE_REQUIRED"
    ) {
      return;
    }
    const sinceLastAttempt = Date.now() - this.lastSyncAttemptAtMs;
    if (!immediate && sinceLastAttempt < INTERACTION_SYNC_THROTTLE_MS) {
      if (this.syncTimer === null) {
        this.syncTimer = setTimeout(() => {
          this.syncTimer = null;
          void schedule(() => this.performSync());
        }, INTERACTION_SYNC_THROTTLE_MS - sinceLastAttempt) as unknown as number;
      }
      return;
    }
    await this.performSync();
  }

  private async performSync() {
    if (!this.config || !this.state?.protocolActivatedAt || !this.browserName) {
      return;
    }
    this.lastSyncAttemptAtMs = Date.now();
    const ready = await this.store.readReadyIntervals(
      BROWSER_V2_SYNC_BATCH_SIZE,
    );
    const health = await this.createHealth();
    try {
      const response = await syncTrackingV2(this.config, {
        protocolVersion: TRACKING_PROTOCOL_VERSION_V2,
        protocolActivatedAt: this.state.protocolActivatedAt,
        clientInstanceId: this.state.clientInstanceId,
        sentAt: new Date(serverNow(this.state)).toISOString(),
        intervals: ready.map((row) => row.interval),
        ...(this.state.latestSnapshot
          ? { focusSnapshot: this.state.latestSnapshot }
          : {}),
        health,
      });
      await this.store.applySyncResults(response.results);
      this.applyServerClock(response.serverTime);
      const now = new Date().toISOString();
      this.state = {
        ...this.state,
        lastSuccessfulSyncAt: now,
        lastSuccessfulHeartbeatAt: now,
        lastErrorCode: "NONE",
      };
      this.connectionState = "ONLINE";
      this.errorCode = "NONE";
      await this.store.writeRuntimeState(this.state);
      await this.updateVisibleStatus();
    } catch (error) {
      if (ready.length > 0 && isRetryableError(error)) {
        await this.store.retry(
          ready.map((row) => row.clientEventId),
        );
      }
      await this.applyFailure(error);
    }
  }

  private async flushLegacyQueue() {
    if (!this.config || !this.state?.protocolActivatedAt) return;
    const stored = await readStoredState(["workmapQueue"]);
    let queue = stored.workmapQueue ?? [];
    if (queue.length === 0) {
      if (this.state.migrationState === "DRAINING_V1") {
        this.state = { ...this.state, migrationState: "V2" };
        await this.store.writeRuntimeState(this.state);
        await removeStoredState(["workmapTracker", "workmapQueue"]);
      }
      return;
    }
    const boundaryMs = Date.parse(this.state.protocolActivatedAt);
    const invalid = queue.filter(
      (item) => Date.parse(item.event.endedAt) > boundaryMs,
    );
    if (invalid.length > 0) {
      const invalidIds = new Set(
        invalid.map((item) => item.event.clientEventId),
      );
      queue = queue.filter(
        (item) => !invalidIds.has(item.event.clientEventId),
      );
      this.state = {
        ...this.state,
        terminalRejections:
          this.state.terminalRejections + invalid.length,
      };
      await this.store.writeRuntimeState(this.state);
      await writeStoredState({ workmapQueue: queue });
    }
    const ready = queue
      .filter((item) => item.nextAttemptAtMs <= Date.now())
      .slice(0, LEGACY_BATCH_SIZE);
    if (ready.length === 0) return;
    const ids = new Set(ready.map((item) => item.event.clientEventId));
    try {
      await sendDomainUsage(
        this.config,
        ready.map((item) => item.event),
      );
      queue = queue.filter(
        (item) => !ids.has(item.event.clientEventId),
      );
      await writeStoredState({ workmapQueue: queue });
      if (queue.length === 0) {
        this.state = { ...this.state, migrationState: "V2" };
        await this.store.writeRuntimeState(this.state);
        await removeStoredState(["workmapTracker", "workmapQueue"]);
      }
    } catch (error) {
      if (isRetryableError(error)) {
        queue = queue.map((item) => {
          if (!ids.has(item.event.clientEventId)) return item;
          const attempts = item.attempts + 1;
          return {
            ...item,
            attempts,
            nextAttemptAtMs:
              Date.now() +
              Math.min(
                5 * 60_000,
                5_000 * 2 ** Math.min(attempts, 6),
              ),
          };
        });
        await writeStoredState({ workmapQueue: queue });
      }
      await this.applyFailure(error);
    }
  }

  private async reconcileBrowserReality(freshFocusProof: boolean) {
    if (!this.state) return;
    const window = await getLastFocusedWindow(this.chromeApi);
    if (!window.focused || window.id === undefined) {
      if (this.state.focusedWindowId !== null || this.engine) {
        this.state = { ...this.state, focusedWindowId: null };
        await this.clearFocus(true);
      }
      return;
    }
    const focusedWindowChanged =
      this.state.focusedWindowId !== window.id;
    this.state = { ...this.state, focusedWindowId: window.id };
    await this.store.writeRuntimeState(this.state);
    if (this.state.systemIdle) return;
    const [tab] = await queryTabs(this.chromeApi, {
      active: true,
      windowId: window.id,
    });
    const domain = readDomainFromUrl(tab?.url);
    if (!tab || !domain) {
      await this.clearFocus(true);
      return;
    }
    const subjectChanged =
      tab.id !== this.state.activeTabId ||
      domain !== this.state.activeDomain;
    if (freshFocusProof || focusedWindowChanged || subjectChanged) {
      await this.activateTab(tab, true);
    } else if (this.engine) {
      await this.persistUpdate(
        this.engine.observe(performance.now()),
        false,
      );
    }
  }

  private async refreshPolicyIfDue() {
    if (
      !this.config ||
      !this.state ||
      Date.now() - this.lastPolicyRefreshAtMs <
        BROWSER_V2_POLICY_REFRESH_MS
    ) {
      return;
    }
    try {
      const policy = await getTrackingPolicyV2(this.config);
      this.applyServerClock(policy.serverTime);
      const changed =
        this.state.policy?.policyLeaseId !== policy.policyLeaseId ||
        this.state.policy?.policyVersion !== policy.policyVersion;
      if (changed) await this.clearFocus(true);
      this.state = { ...this.state, policy };
      this.collectorState = collectorStateForPolicy(
        policy,
        serverNow(this.state),
      );
      this.errorCode = "NONE";
      this.lastPolicyRefreshAtMs = Date.now();
      await this.store.writeRuntimeState(this.state);
    } catch (error) {
      if (!policyLeaseValid(this.state.policy, serverNow(this.state))) {
        await this.pauseCollector(
          "POLICY_UNAVAILABLE",
          safeError(error),
        );
      }
    }
  }

  private async restoreCollectorIfAllowed() {
    if (!this.state?.policy) return;
    const next = collectorStateForPolicy(
      this.state.policy,
      serverNow(this.state),
    );
    if (next === "HEALTHY" && (await this.store.hasCapacity())) {
      this.collectorState = "HEALTHY";
      this.errorCode = "NONE";
      await this.updateVisibleStatus();
    }
  }

  private async restoreAfterQueuePressure() {
    if (this.errorCode !== "QUEUE_PRESSURE") return;
    if (!(await this.store.hasCapacity())) return;
    this.errorCode = "NONE";
    await this.restoreCollectorIfAllowed();
    await this.closeRecoveredV2Tail();
    await this.reconcileBrowserReality(true);
  }

  private async pauseCollector(
    errorCode: TrackingHealthErrorCodeV2,
    message: string,
  ) {
    this.collectorState = "PAUSED";
    this.errorCode = errorCode;
    if (this.state) {
      this.state = { ...this.state, lastErrorCode: errorCode };
      await this.store.writeRuntimeState(this.state);
    }
    await this.updateVisibleStatus(message);
  }

  private captureAllowed() {
    return (
      this.state !== null &&
      !this.state.systemIdle &&
      this.collectorState === "HEALTHY" &&
      this.state.policy !== null &&
      collectorStateForPolicy(
        this.state.policy,
        serverNow(this.state),
      ) === "HEALTHY"
    );
  }

  private async createHealth(): Promise<BrowserClientHealthV2> {
    const stats = await this.store.stats();
    return {
      clientType: "BROWSER_EXTENSION",
      clientVersion: BROWSER_EXTENSION_VERSION,
      platform: this.browserName!,
      connectionState: this.connectionState,
      collectorState: this.collectorState,
      policyState: policyState(
        this.state?.policy ?? null,
        this.state ? serverNow(this.state) : Date.now(),
      ),
      migrationState: this.state?.migrationState ?? "V1",
      queue: stats,
      lastSuccessfulHeartbeatAt:
        this.state?.lastSuccessfulHeartbeatAt ?? null,
      lastSuccessfulSyncAt:
        this.state?.lastSuccessfulSyncAt ?? null,
      errorCode: this.errorCode,
    };
  }

  private async updateVisibleStatus(error?: string) {
    if (!this.state) return;
    const stats = await this.store.stats();
    const legacy = await readStoredState(["workmapQueue"]);
    const statusState: ExtensionStatus["state"] =
      this.connectionState === "AUTH_REQUIRED"
        ? "auth_required"
        : this.connectionState === "UPGRADE_REQUIRED"
          ? "upgrade_required"
          : this.collectorState === "PAUSED"
            ? "paused"
            : this.connectionState === "ONLINE"
              ? "connected"
              : this.connectionState === "ERROR"
                ? "error"
                : "offline";
    await writeStoredState({
      workmapStatus: {
        state: statusState,
        lastHeartbeatAt:
          this.state.lastSuccessfulHeartbeatAt ?? undefined,
        lastUploadAt: this.state.lastSuccessfulSyncAt ?? undefined,
        queuedEvents:
          stats.pending + (legacy.workmapQueue?.length ?? 0),
        queuedStatusEvents: 0,
        trackingState:
          this.errorCode === "INTERACTION_PERMISSION_REQUIRED"
            ? "permission_required"
            : "ready",
        error,
      },
    });
  }

  private async registerContentScript() {
    if (!this.config) return false;
    try {
      return await ensureDomainContentScriptRegistered(true);
    } catch {
      return false;
    }
  }

  private applyServerClock(serverTime: string) {
    if (!this.state) return;
    const serverMs = Date.parse(serverTime);
    if (!Number.isFinite(serverMs)) return;
    this.state = {
      ...this.state,
      serverOffsetMs: serverMs - Date.now(),
    };
  }

  private mapPageTimeToMonotonic(value: number | undefined) {
    const nowUtcMs = Date.now();
    const nowMonotonicMs = performance.now();
    const observedUtcMs = Number.isFinite(value)
      ? Math.max(nowUtcMs - 60_000, Math.min(nowUtcMs + 1_000, value!))
      : nowUtcMs;
    const mapped = nowMonotonicMs - (nowUtcMs - observedUtcMs);
    return Math.max(
      this.state?.clock?.clockEpochStartedMonotonicMs ?? 0,
      mapped,
    );
  }

  private async applyFailure(error: unknown) {
    if (
      error instanceof ExtensionApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      this.connectionState = "AUTH_REQUIRED";
    } else if (isUpgradeRequiredError(error)) {
      this.connectionState = "UPGRADE_REQUIRED";
      this.errorCode = "UPGRADE_REQUIRED";
      this.collectorState = "PAUSED";
    } else if (
      error instanceof ExtensionApiError &&
      error.status !== undefined &&
      error.status < 500
    ) {
      this.connectionState = "ERROR";
      this.collectorState = "ERROR";
      this.errorCode = "UNKNOWN";
    } else {
      this.connectionState = "OFFLINE";
      if (
        !this.state?.policy ||
        !policyLeaseValid(
          this.state.policy,
          serverNow(this.state),
        )
      ) {
        this.collectorState = "PAUSED";
        this.errorCode = "POLICY_UNAVAILABLE";
      }
    }
    await this.updateVisibleStatus(safeError(error));
  }

  private async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }
}

function appendLegacyEvents(
  queue: QueuedDomainEvent[],
  events: DomainUsageEvent[],
) {
  const ids = new Set(queue.map((item) => item.event.clientEventId));
  const nowMs = Date.now();
  const result = [...queue];
  for (const event of events) {
    if (ids.has(event.clientEventId)) continue;
    result.push({
      event,
      attempts: 0,
      nextAttemptAtMs: nowMs,
      createdAtMs: nowMs,
    });
    ids.add(event.clientEventId);
  }
  return result;
}

function normalizeBrowserName(value: string): BrowserNameV2 {
  return value.toUpperCase().includes("EDGE") ? "EDGE" : "CHROME";
}

function collectorStateForPolicy(
  policy: DeviceTrackingPolicyV2,
  nowMs: number,
): TrackingCollectorStateV2 {
  if (
    !policy.policyLeaseId ||
    !policy.collectDomainFocus ||
    policy.acknowledgementState !== "ACKNOWLEDGED" ||
    policy.scheduleTimeZoneState !== "CONFIRMED"
  ) {
    return "PAUSED";
  }
  if (!policyLeaseValid(policy, nowMs)) return "PAUSED";
  return policy.allowedUtcWindows.some((window) => {
    const startsAt = Date.parse(window.startsAt);
    const endsAt = Date.parse(window.endsAt);
    return startsAt <= nowMs && nowMs < endsAt;
  })
    ? "HEALTHY"
    : "PAUSED";
}

function policyLeaseValid(
  policy: DeviceTrackingPolicyV2 | null,
  nowMs: number,
) {
  if (!policy?.policyLeaseId || !policy.policyLeaseExpiresAt) return false;
  const expiresAt = Date.parse(policy.policyLeaseExpiresAt);
  return Number.isFinite(expiresAt) && nowMs < expiresAt;
}

function policyState(
  policy: DeviceTrackingPolicyV2 | null,
  nowMs: number,
): TrackingPolicyStateV2 {
  if (!policy || policy.scheduleTimeZoneState !== "CONFIRMED") {
    return "TIMEZONE_REQUIRED";
  }
  if (policy.acknowledgementState !== "ACKNOWLEDGED") {
    return "ACKNOWLEDGEMENT_REQUIRED";
  }
  return policyLeaseValid(policy, nowMs) ? "ACTIVE" : "EXPIRED";
}

function serverNow(state: BrowserTrackingRuntimeStateV2) {
  return Date.now() + state.serverOffsetMs;
}

function isRetryableError(error: unknown) {
  return (
    !(error instanceof ExtensionApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429
  );
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message
        .replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]")
        .slice(0, 240)
    : "Unknown extension error.";
}

async function resolveRuntimeConfig(
  config: Parameters<typeof resolveStoredConfig>[0],
) {
  try {
    return await resolveStoredConfig(config);
  } catch {
    await writeStoredState({
      workmapStatus: {
        state: "auth_required",
        queuedEvents: 0,
        queuedStatusEvents: 0,
        error:
          "Device credential vault could not be opened. Pair this extension again.",
      },
    });
    return null;
  }
}

function queryTabs(api: ChromeApi, query: Record<string, unknown>) {
  return new Promise<ChromeTab[]>((resolve, reject) => {
    api.tabs.query(query, (tabs) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Tab query failed."));
      else resolve(tabs);
    });
  });
}

function getLastFocusedWindow(api: ChromeApi) {
  return new Promise<ChromeWindow>((resolve, reject) => {
    api.windows.getLastFocused({ populate: false }, (window) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Window query failed."));
      else resolve(window);
    });
  });
}

function queryIdleState(api: ChromeApi, seconds: number) {
  return new Promise<"active" | "idle" | "locked">((resolve, reject) => {
    api.idle.queryState(seconds, (state) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Idle query failed."));
      else resolve(state);
    });
  });
}

function installRuntimeListeners(api: ChromeApi) {
  const runtime = new BrowserExtensionRuntimeV2(api);
  api.runtime.onInstalled.addListener(() => {
    void schedule(() => runtime.initialize());
  });
  api.runtime.onStartup.addListener(() => {
    void schedule(() => runtime.initialize());
  });
  api.permissions.onAdded.addListener(() => {
    void schedule(() => runtime.handlePermissionChange());
  });
  api.permissions.onRemoved.addListener(() => {
    void schedule(() => runtime.handlePermissionChange());
  });
  api.tabs.onActivated.addListener(({ tabId, windowId }) => {
    void schedule(() => runtime.handleTabActivated(tabId, windowId));
  });
  api.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url || change.status === "complete") {
      void schedule(() => runtime.handleTabUpdated(tabId, tab));
    }
  });
  api.tabs.onRemoved.addListener((tabId) => {
    void schedule(() => runtime.handleTabRemoved(tabId));
  });
  api.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    void schedule(() => runtime.handleTabReplaced(addedTabId, removedTabId));
  });
  api.windows.onFocusChanged.addListener((windowId) => {
    void schedule(() => runtime.handleWindowFocus(windowId));
  });
  api.idle.onStateChanged.addListener((state) => {
    void schedule(() => runtime.handleIdleState(state));
  });
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      void schedule(() => runtime.handleAlarm());
    }
  });
  api.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "workmap:extension-paired") {
      void schedule(() => runtime.resetAfterPairing());
      return;
    }
    if (message?.type === "workmap:exclusions-updated") {
      void schedule(() => runtime.handleExclusionsUpdated());
      return;
    }
    void schedule(() => runtime.handleMessage(message, sender));
  });
  void schedule(() => runtime.initialize());
}

installRuntimeListeners(chrome);
