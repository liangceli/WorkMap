import { BrowserFocusEngineV2 } from "./browserFocusEngineV2.js";
import {
  chooseSingleActiveTab,
  eligibleDomainForTab,
  isUsableFocusedWindow,
  messageCanOwnFocus,
  type BrowserTabObservationV2,
  type BrowserWindowObservationV2,
} from "./browserEligibilityV2.js";
import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import { DomainTrackingState } from "./domainState.js";
import { type DomainUsageEvent } from "./domainTracking.js";
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
  BROWSER_V2_DIAGNOSTIC_CAPACITY,
  BROWSER_V2_DIAGNOSTIC_RETENTION_MS,
  BROWSER_V2_POLICY_REFRESH_MS,
  BROWSER_V2_SYNC_BATCH_SIZE,
  TRACKING_PROTOCOL_VERSION_V2,
  type BrowserClientHealthV2,
  type BrowserNameV2,
  type BrowserTrackingRuntimeStateV2,
  type BrowserTrackingDiagnosticV2,
  type BrowserTrackingSyncResponseV2,
  type DeviceTrackingPolicyV2,
  type TrackingSyncItemResultV2,
  type TrackingCollectorStateV2,
  type TrackingConnectionStateV2,
  type TrackingHealthErrorCodeV2,
  type TrackingPolicyStateV2,
} from "./trackingV2Types.js";

type ChromeTab = BrowserTabObservationV2;
type ChromeWindow = BrowserWindowObservationV2;
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
    get(tabId: number, callback: (tab: ChromeTab) => void): void;
    sendMessage(
      tabId: number,
      message: Record<string, unknown>,
      callback: (response?: Record<string, unknown>) => void,
    ): void;
  };
  windows: {
    WINDOW_ID_NONE: number;
    onFocusChanged: ChromeEvent<(windowId: number) => void>;
    onBoundsChanged: ChromeEvent<(window: ChromeWindow) => void>;
    onRemoved: ChromeEvent<(windowId: number) => void>;
    getLastFocused(
      options: { populate: false },
      callback: (window: ChromeWindow) => void,
    ): void;
    get(
      windowId: number,
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
const LIFECYCLE_MAX_UNOBSERVED_MS = 45_000;
const CLOCK_DIVERGENCE_TOLERANCE_MS = 10_000;

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
  private policySetupMessage: string | null = null;
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
    const tabs = await queryTabs(this.chromeApi, {
      active: true,
      windowId,
    });
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    await this.prepareTab(tab, true);
  }

  async handleTabUpdated(
    tabId: number,
    change: { url?: string; status?: string },
    tab: ChromeTab,
  ) {
    await this.ensureInitialized();
    if (!this.state || tabId !== this.state.activeTabId) return;
    if (tab.windowId !== this.state.focusedWindowId) return;
    const domain = eligibleDomainForTab(
      tab,
      this.config?.excludedHostnames,
    );
    if (!domain) {
      await this.clearFocus(true);
      return;
    }
    const domainChanged = domain !== this.state.activeDomain;
    if (domainChanged || tab.id !== this.state.activeTabId) {
      await this.prepareTab(tab, true, true);
    } else if (change.status === "loading") {
      // A real document navigation needs fresh content-script proof even when
      // the hostname is unchanged. SPA path/query changes do not have this
      // loading boundary and therefore keep one Domain identity.
      await this.prepareTab(tab, true, true);
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
    const tabs = await queryTabs(this.chromeApi, {
      active: true,
      windowId: this.state.focusedWindowId,
    });
    const tab = tabs.find((candidate) => candidate.id === addedTabId);
    if (tab?.id === addedTabId) await this.prepareTab(tab, true);
  }

  async handleWindowFocus(windowId: number) {
    await this.ensureInitialized();
    if (!this.state) return;
    await this.guardLifecycleContinuity();
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
    const focusedWindow = await getWindow(this.chromeApi, windowId);
    if (!isUsableFocusedWindow(focusedWindow)) {
      this.state = { ...this.state, focusedWindowId: null };
      await this.clearFocus(true);
      return;
    }
    this.state = { ...this.state, focusedWindowId: windowId };
    await this.store.writeRuntimeState(this.state);
    if (this.state.systemIdle) return;
    const activeTabs = await queryTabs(this.chromeApi, {
      active: true,
      windowId,
    });
    const tab = chooseSingleActiveTab(activeTabs, this.state.activeTabId);
    if (tab) await this.prepareTab(tab, true);
    else await this.clearFocus(true);
  }

  async handleWindowBoundsChanged(window: ChromeWindow) {
    await this.ensureInitialized();
    if (!this.state || window.id !== this.state.focusedWindowId) return;
    if (!isUsableFocusedWindow(window)) {
      this.state = { ...this.state, focusedWindowId: null };
      await this.clearFocus(true);
      return;
    }
    await this.reconcileBrowserReality(true);
  }

  async handleWindowRemoved(windowId: number) {
    await this.ensureInitialized();
    if (!this.state || windowId !== this.state.focusedWindowId) return;
    await this.clearFocus(true);
    await this.reconcileBrowserReality(true);
  }

  async handleIdleState(state: "active" | "idle" | "locked") {
    await this.ensureInitialized();
    if (!this.state) return;
    await this.guardLifecycleContinuity();
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
    if (
      !this.state ||
      this.state.focusedWindowId === null ||
      sender.tab?.id === undefined
    ) return;
    const discontinuity = await this.guardLifecycleContinuity();
    const activeTabs = await queryTabs(this.chromeApi, {
      active: true,
      windowId: this.state.focusedWindowId,
    });
    const messageOwnsFocus = messageCanOwnFocus({
      senderTab: sender.tab,
      focusedWindowId: this.state.focusedWindowId,
      activeTabs,
    });
    const domain = eligibleDomainForTab(
      sender.tab,
      this.config?.excludedHostnames,
    );
    if (!domain || !messageOwnsFocus || !this.captureAllowed()) return;

    if (message.type === "workmap:domain-activity") {
      const monotonicMs = this.mapPageTimeToMonotonic(message.activityAt);
      await this.acquireMessageFocus(sender.tab, domain, monotonicMs);
      if (!this.engine) return;
      await this.persistUpdate(
        this.engine.recordTrustedInteraction(monotonicMs),
        false,
      );
      await this.requestSync(false);
      return;
    }
    if (
      message.type === "workmap:domain-blur" &&
      sender.frameId === 0 &&
      sender.tab.id === this.state.activeTabId
    ) {
      await this.clearFocus(
        true,
        this.mapPageTimeToMonotonic(message.observedAt),
      );
      return;
    }
    if (
      message.type === "workmap:domain-checkpoint" &&
      sender.frameId === 0
    ) {
      const monotonicMs = this.mapPageTimeToMonotonic(message.observedAt);
      await this.acquireMessageFocus(sender.tab, domain, monotonicMs);
      if (discontinuity) await this.requestSync(true);
    }
  }

  async handleAlarm() {
    await this.ensureInitialized();
    if (!this.state) return;
    const discontinuity = await this.guardLifecycleContinuity();
    if (!this.state.protocolActivatedAt) {
      const stored = await readStoredState([
        "workmapConfig",
        "workmapStatus",
        "workmapQueue",
        "workmapTracker",
      ]);
      const activated = await this.ensureProtocolV2(stored);
      if (!activated) return;
      await this.startTrackingAfterActivation();
      return;
    }
    await this.refreshPolicyIfDue();
    if (!this.captureAllowed()) {
      await this.closeAtPolicyBoundary();
    } else if (this.engine && !discontinuity) {
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

    this.initialized = true;
    await this.startTrackingAfterActivation();
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
      const policy = await getTrackingPolicyV2(this.config);
      this.applyServerClock(policy.serverTime);
      this.state = { ...this.state, policy };
      await this.store.writeRuntimeState(this.state);
      const policyRequirement = describeBrowserPolicyRequirement(policy);
      if (policyRequirement) {
        this.connectionState = "ONLINE";
        this.collectorState = "PAUSED";
        this.errorCode = "POLICY_UNAVAILABLE";
        this.policySetupMessage = policyRequirement;
        this.state = { ...this.state, lastErrorCode: this.errorCode };
        await this.store.writeRuntimeState(this.state);
        await this.updateVisibleStatus(policyRequirement);
        return false;
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
      this.policySetupMessage = null;
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

  private async startTrackingAfterActivation() {
    if (!this.state?.protocolActivatedAt) return;
    await this.flushLegacyQueue();
    await this.closeRecoveredV2Tail();
    const idleState = await queryIdleState(this.chromeApi, 60);
    if (!this.state) return;
    this.state = { ...this.state, systemIdle: idleState !== "active" };
    if (this.state.systemIdle) this.collectorState = "PAUSED";
    await this.store.writeRuntimeState(this.state);
    await this.reconcileBrowserReality(true);
    await this.requestSync(true);
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
      snapshotConfirmation: {
        state: "LOCAL_PENDING" as const,
        snapshotSequence: update.snapshot.snapshotSequence,
        observedAt: update.snapshot.lastObservedAt,
        confirmedAt: null,
        rejectionCode: null,
        requestId: null,
      },
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

  private async prepareTab(
    tab: ChromeTab,
    immediateSync: boolean,
    forcePageProof = false,
  ) {
    if (
      !this.state ||
      !this.browserName ||
      tab.id === undefined ||
      tab.windowId !== this.state.focusedWindowId
    ) {
      return;
    }
    const domain = eligibleDomainForTab(
      tab,
      this.config?.excludedHostnames,
    );
    if (!domain || !this.captureAllowed()) {
      await this.clearFocus(immediateSync);
      return;
    }

    const subjectChanged =
      tab.id !== this.state.activeTabId || domain !== this.state.activeDomain;
    if ((subjectChanged || forcePageProof) && this.engine) {
      await this.clearFocus(immediateSync);
    }
    this.state = {
      ...this.state,
      activeTabId: tab.id,
      activeDomain: domain,
    };
    await this.store.writeRuntimeState(this.state);

    // An active tab alone does not prove that ordinary page content is
    // accessible. The probe succeeds only when the hostname-only content
    // script is running in the visible, focused top-level document. Protected
    // pages and inaccessible browser PDF viewers therefore remain NONE.
    const proof = await probeTab(this.chromeApi, tab.id);
    if (proof?.visible && proof.focused) {
      await this.acquireMessageFocus(tab, domain, performance.now());
      if (immediateSync) await this.requestSync(true);
    } else {
      await this.updateVisibleStatus();
    }
  }

  private async acquireMessageFocus(
    tab: ChromeTab,
    domain: string,
    atMonotonicMs: number,
  ) {
    if (!this.state || tab.id === undefined || !this.captureAllowed()) return;
    if (
      this.engine &&
      (tab.id !== this.state.activeTabId || domain !== this.state.activeDomain)
    ) {
      await this.clearFocus(false);
    }
    this.ensureEngine(atMonotonicMs);
    this.state = {
      ...this.state,
      activeTabId: tab.id,
      activeDomain: domain,
    };
    await this.persistUpdate(
      this.engine!.acquireFocus(
        { subjectKey: domain, displayName: domain },
        atMonotonicMs,
      ),
      false,
    );
  }

  private async clearFocus(
    immediateSync: boolean,
    atMonotonicMs = performance.now(),
  ) {
    if (!this.state) return;
    if (this.engine) {
      await this.persistUpdate(
        this.engine.clearFocus(atMonotonicMs),
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

  private async guardLifecycleContinuity() {
    if (!this.state) return false;
    const current = {
      wallClockMs: Date.now(),
      monotonicMs: performance.now(),
    };
    const previous = this.state.lastLifecycleObservation;
    if (!previous) {
      this.state = { ...this.state, lastLifecycleObservation: current };
      await this.store.writeRuntimeState(this.state);
      return false;
    }
    const wallDelta = current.wallClockMs - previous.wallClockMs;
    const discontinuity = hasLifecycleDiscontinuity(previous, current);
    if (!discontinuity) {
      this.state = { ...this.state, lastLifecycleObservation: current };
      await this.store.writeRuntimeState(this.state);
      return false;
    }

    if (this.engine && this.state.engineCheckpoint) {
      await this.persistUpdate(
        this.engine.clearFocus(
          this.state.engineCheckpoint.lastObservedAtMonotonicMs,
        ),
        false,
      );
    }
    this.engine = null;
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      activeTabId: null,
      activeDomain: null,
      lastLifecycleObservation: current,
      diagnostics: appendDiagnostic(this.state.diagnostics, {
        stage: "LIFECYCLE",
        outcome: "LIMITED",
        code: wallDelta < 0 ? "CLOCK_JUMP" : "UNOBSERVED_GAP",
        requestId: null,
        retryable: false,
        terminal: false,
        count: 1,
        remediation:
          "Focus was sealed at the last durable observation. WorkMap did not backfill the unobserved sleep, restart, or clock-change gap.",
      }),
    };
    await this.store.writeRuntimeState(this.state);
    await this.updateVisibleStatus();
    return true;
  }

  private async closeAtPolicyBoundary() {
    if (!this.state) return;
    this.collectorState = "PAUSED";
    if (this.engine && this.state.clock && this.state.engineCheckpoint) {
      const nowMonotonicMs = performance.now();
      const nowServerMs = serverNow(this.state);
      const latestWindowEnd = (this.state.policy?.allowedUtcWindows ?? [])
        .map((window) => Date.parse(window.endsAt))
        .filter((value) => Number.isFinite(value) && value <= nowServerMs)
        .sort((left, right) => right - left)[0];
      const projectedBoundary = latestWindowEnd === undefined
        ? this.state.engineCheckpoint.lastObservedAtMonotonicMs
        : this.state.clock.clockEpochStartedMonotonicMs +
          (latestWindowEnd - Date.parse(this.state.clock.clockEpochStartedAt));
      const boundary = Math.min(
        nowMonotonicMs,
        Math.max(
          this.state.engineCheckpoint.lastObservedAtMonotonicMs,
          projectedBoundary,
        ),
      );
      await this.persistUpdate(
        this.engine.setCollectorState("PAUSED", boundary),
        false,
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
    await this.updateVisibleStatus();
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
      snapshotConfirmation: {
        state: "LOCAL_PENDING",
        snapshotSequence: update.snapshot.snapshotSequence,
        observedAt: update.snapshot.lastObservedAt,
        confirmedAt: null,
        rejectionCode: null,
        requestId: null,
      },
      lastLifecycleObservation: {
        wallClockMs: Date.now(),
        monotonicMs: performance.now(),
      },
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
    const requestId = crypto.randomUUID();
    const sentSnapshot = this.state.latestSnapshot;
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
      }, requestId);
      const confirmedAt = response.serverTime;
      const confirmedRequestId = safeRequestId(response.requestId)
        ? response.requestId
        : requestId;
      await this.store.applySyncResults(
        response.results,
        confirmedRequestId,
      );
      this.state = await this.store.readRuntimeState();
      this.applyServerClock(response.serverTime);
      const intervalUpload = summarizeIntervalUpload(
        response.results,
        confirmedRequestId,
        confirmedAt,
      );
      const snapshotConfirmation = snapshotConfirmationFromResponse(
        sentSnapshot,
        response.focusSnapshotResult,
        confirmedRequestId,
        confirmedAt,
      );
      const diagnostics = appendSyncDiagnostics(
        this.state.diagnostics,
        response.results,
        response.focusSnapshotResult,
        confirmedRequestId,
        confirmedAt,
      );
      this.state = {
        ...this.state,
        lastSuccessfulSyncAt: confirmedAt,
        lastSuccessfulHeartbeatAt: confirmedAt,
        snapshotConfirmation:
          snapshotConfirmation ?? this.state.snapshotConfirmation,
        lastIntervalUpload:
          intervalUpload ?? this.state.lastIntervalUpload,
        confirmedIntervalThrough: latestConfirmedThrough(
          response.cursors,
          this.state.confirmedIntervalThrough,
        ),
        lastRequestId: confirmedRequestId,
        diagnostics,
        lastErrorCode: "NONE",
      };
      this.connectionState = "ONLINE";
      this.errorCode = "NONE";
      await this.store.writeRuntimeState(this.state);
      await this.updateVisibleStatus();

      if (response.focusSnapshotResult?.status === "REJECTED") {
        const rejectedConfirmation = this.state.snapshotConfirmation;
        if (
          response.focusSnapshotResult.rejectionCode ===
          "SNAPSHOT_OUTSIDE_POLICY_WINDOW"
        ) {
          this.collectorState = "PAUSED";
        }
        if (
          response.focusSnapshotResult.rejectionCode ===
          "SNAPSHOT_POLICY_LEASE_INVALID"
        ) {
          this.lastPolicyRefreshAtMs = 0;
          this.collectorState = "PAUSED";
        }
        await this.clearFocus(false);
        if (this.state) {
          this.state = {
            ...this.state,
            snapshotConfirmation: rejectedConfirmation,
          };
          await this.store.writeRuntimeState(this.state);
          await this.updateVisibleStatus();
        }
      }
    } catch (error) {
      if (ready.length > 0 && isRetryableError(error)) {
        await this.store.retry(
          ready.map((row) => row.clientEventId),
        );
      }
      await this.applyFailure(error, requestId);
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
    if (!isUsableFocusedWindow(window)) {
      if (this.state.focusedWindowId !== null || this.engine) {
        this.state = { ...this.state, focusedWindowId: null };
        await this.clearFocus(true);
      }
      return;
    }
    const windowId = window.id!;
    const focusedWindowChanged =
      this.state.focusedWindowId !== windowId;
    const state = { ...this.state, focusedWindowId: windowId };
    this.state = state;
    await this.store.writeRuntimeState(state);
    if (state.systemIdle) return;
    const activeTabs = await queryTabs(this.chromeApi, {
      active: true,
      windowId,
    });
    const selectedTab = chooseSingleActiveTab(
      activeTabs,
      state.activeTabId,
    );
    let currentSplitPeer: ChromeTab | null = null;
    if (state.activeTabId !== null) {
      currentSplitPeer = await getTab(
        this.chromeApi,
        state.activeTabId,
      ).catch(() => null);
      if (
        currentSplitPeer &&
        !messageCanOwnFocus({
          senderTab: currentSplitPeer,
          focusedWindowId: windowId,
          activeTabs,
        })
      ) {
        currentSplitPeer = null;
      }
    }
    const candidate = currentSplitPeer ?? selectedTab;
    const domain = eligibleDomainForTab(
      candidate,
      this.config?.excludedHostnames,
    );
    if (!candidate || !domain) {
      await this.clearFocus(true);
      return;
    }
    const subjectChanged =
      candidate.id !== state.activeTabId ||
      domain !== state.activeDomain;
    if (freshFocusProof || focusedWindowChanged || subjectChanged) {
      await this.prepareTab(candidate, true);
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
      queue: {
        pending: stats.pending,
        ready: stats.ready,
        deadLetter: stats.deadLetter,
        oldestQueuedAt: stats.oldestQueuedAt,
        nextRetryAt: stats.nextRetryAt,
      },
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
      this.policySetupMessage
        ? "policy_required"
        : this.connectionState === "AUTH_REQUIRED"
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
          this.state.trackingAccess.contentRegistration === "FAILED"
            ? "registration_failed"
            : this.errorCode === "INTERACTION_PERMISSION_REQUIRED"
            ? "permission_required"
            : "ready",
        trackingError:
          this.state.trackingAccess.error ?? undefined,
        error: error ?? this.policySetupMessage ?? undefined,
      },
    });
  }

  private async registerContentScript() {
    if (!this.config) return false;
    try {
      const registered = await ensureDomainContentScriptRegistered(true);
      if (this.state) {
        this.state = {
          ...this.state,
          trackingAccess: {
            hostPermission: registered ? "GRANTED" : "REQUIRED",
            contentRegistration: registered ? "REGISTERED" : "UNKNOWN",
            checkedAt: new Date().toISOString(),
            error: null,
          },
          diagnostics: registered
            ? this.state.diagnostics
            : appendDiagnostic(this.state.diagnostics, {
                stage: "PERMISSION",
                outcome: "LIMITED",
                code: "HOST_PERMISSION_REQUIRED",
                requestId: null,
                retryable: false,
                terminal: false,
                count: 1,
                remediation:
                  "Grant WorkMap access to HTTP/HTTPS websites, then reload the Options page.",
              }),
        };
        await this.store.writeRuntimeState(this.state);
      }
      return registered;
    } catch (error) {
      if (this.state) {
        const message = safeError(error);
        this.state = {
          ...this.state,
          trackingAccess: {
            hostPermission: "GRANTED",
            contentRegistration: "FAILED",
            checkedAt: new Date().toISOString(),
            error: message,
          },
          diagnostics: appendDiagnostic(this.state.diagnostics, {
            stage: "PERMISSION",
            outcome: "LIMITED",
            code: "CONTENT_REGISTRATION_FAILED",
            requestId: null,
            retryable: true,
            terminal: false,
            count: 1,
            remediation:
              "Reload the extension. WorkMap will retry content-script registration without collecting protected pages.",
          }),
        };
        await this.store.writeRuntimeState(this.state);
      }
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

  private async applyFailure(
    error: unknown,
    fallbackRequestId?: string,
  ) {
    this.policySetupMessage = null;
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
    if (this.state) {
      const requestId =
        error instanceof ExtensionApiError
          ? error.detail.requestId ?? fallbackRequestId ?? null
          : fallbackRequestId ?? null;
      const retryable = isRetryableError(error);
      const statusCode =
        error instanceof ExtensionApiError && error.status
          ? `HTTP_${error.status}`
          : "NETWORK_ERROR";
      this.state = {
        ...this.state,
        lastRequestId: requestId,
        diagnostics: appendDiagnostic(this.state.diagnostics, {
          stage: "REQUEST",
          outcome: retryable ? "RETRYING" : "REJECTED",
          code:
            error instanceof ExtensionApiError
              ? error.detail.reasonCode ?? statusCode
              : statusCode,
          requestId,
          retryable,
          terminal: !retryable,
          count: 1,
          remediation:
            error instanceof ExtensionApiError && error.detail.remediation
              ? error.detail.remediation
              : retryable
                ? "The extension will retry automatically with bounded backoff."
                : "Review the safe reason code and request ID, then pair again or update the extension if requested.",
        }),
      };
      await this.store.writeRuntimeState(this.state);
    }
    await this.updateVisibleStatus(safeError(error));
  }

  private async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }
}

type DiagnosticInput = Omit<
  BrowserTrackingDiagnosticV2,
  "id" | "occurredAt"
> & { occurredAt?: string };

function appendDiagnostic(
  existing: BrowserTrackingDiagnosticV2[],
  input: DiagnosticInput,
) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const cutoff = Date.parse(occurredAt) - BROWSER_V2_DIAGNOSTIC_RETENTION_MS;
  const retained = existing.filter(
    (item) => Date.parse(item.occurredAt) >= cutoff,
  );
  const latest = retained.at(-1);
  if (
    latest &&
    latest.stage === input.stage &&
    latest.code === safeDiagnosticCode(input.code) &&
    latest.requestId === input.requestId &&
    latest.outcome === input.outcome
  ) {
    latest.count += input.count;
    latest.occurredAt = occurredAt;
    return retained.slice(-BROWSER_V2_DIAGNOSTIC_CAPACITY);
  }
  retained.push({
    ...input,
    id: crypto.randomUUID(),
    occurredAt,
    code: safeDiagnosticCode(input.code),
    remediation: input.remediation.replace(/\s+/g, " ").slice(0, 240),
  });
  return retained.slice(-BROWSER_V2_DIAGNOSTIC_CAPACITY);
}

export function appendSyncDiagnostics(
  diagnostics: BrowserTrackingDiagnosticV2[],
  results: TrackingSyncItemResultV2[],
  snapshotResult: BrowserTrackingSyncResponseV2["focusSnapshotResult"],
  requestId: string,
  occurredAt: string,
) {
  let next = diagnostics;
  if (snapshotResult?.status === "REJECTED") {
    next = appendDiagnostic(next, {
      occurredAt,
      stage: "SNAPSHOT",
      outcome: "REJECTED",
      code: snapshotResult.rejectionCode,
      requestId,
      retryable: false,
      terminal: true,
      count: 1,
      remediation: snapshotRemediation(snapshotResult.rejectionCode),
    });
  }
  const groups = new Map<string, { count: number; terminal: boolean }>();
  for (const result of results) {
    if (result.status !== "REJECTED") continue;
    const code = safeDiagnosticCode(result.rejectionCode ?? "REJECTED");
    const group = groups.get(code) ?? { count: 0, terminal: true };
    group.count += 1;
    group.terminal = group.terminal && result.terminal === true;
    groups.set(code, group);
  }
  for (const [code, group] of groups) {
    next = appendDiagnostic(next, {
      occurredAt,
      stage: "INTERVAL",
      outcome: group.terminal ? "REJECTED" : "RETRYING",
      code,
      requestId,
      retryable: !group.terminal,
      terminal: group.terminal,
      count: group.count,
      remediation: group.terminal
        ? "This interval is retained as a safe dead-letter diagnostic and is not counted in Reports. Review the code and request ID."
        : "The interval remains in the durable queue and will retry with bounded backoff.",
    });
  }
  return next;
}

export function summarizeIntervalUpload(
  results: TrackingSyncItemResultV2[],
  requestId: string,
  occurredAt: string,
) {
  if (results.length === 0) return null;
  const accepted = results.filter((item) => item.status === "ACCEPTED").length;
  const duplicate = results.filter((item) => item.status === "DUPLICATE").length;
  const rejectedRows = results.filter((item) => item.status === "REJECTED");
  const rejectionCodes: Record<string, number> = {};
  for (const row of rejectedRows) {
    const code = safeDiagnosticCode(row.rejectionCode ?? "REJECTED");
    rejectionCodes[code] = (rejectionCodes[code] ?? 0) + 1;
  }
  return {
    status: rejectedRows.length > 0
      ? "REJECTED" as const
      : accepted > 0
        ? "ACCEPTED" as const
        : "DUPLICATE" as const,
    occurredAt,
    requestId,
    accepted,
    duplicate,
    rejected: rejectedRows.length,
    rejectionCodes,
  };
}

export function snapshotConfirmationFromResponse(
  snapshot: BrowserTrackingRuntimeStateV2["latestSnapshot"],
  result: BrowserTrackingSyncResponseV2["focusSnapshotResult"],
  requestId: string,
  confirmedAt: string,
): BrowserTrackingRuntimeStateV2["snapshotConfirmation"] | null {
  if (!snapshot || !result) return null;
  if (result.status === "ACCEPTED") {
    return {
      state: "CONFIRMED",
      snapshotSequence: result.acceptedSnapshotSequence,
      observedAt: snapshot.lastObservedAt,
      confirmedAt,
      rejectionCode: null,
      requestId,
    };
  }
  return {
    state: "REJECTED",
    snapshotSequence: snapshot.snapshotSequence,
    observedAt: snapshot.lastObservedAt,
    confirmedAt,
    rejectionCode: result.rejectionCode,
    requestId,
  };
}

function latestConfirmedThrough(
  cursors: BrowserTrackingSyncResponseV2["cursors"],
  previous: string | null,
) {
  return cursors.reduce<string | null>((latest, cursor) => {
    const candidate = cursor.latestAcceptedEndedAt;
    if (!candidate) return latest;
    if (!latest || Date.parse(candidate) > Date.parse(latest)) return candidate;
    return latest;
  }, previous);
}

function snapshotRemediation(code: string) {
  if (code === "SNAPSHOT_POLICY_LEASE_INVALID") {
    return "Refresh the current policy lease before starting a new Domain snapshot.";
  }
  if (code === "SNAPSHOT_OUTSIDE_POLICY_WINDOW") {
    return "Keep collection paused until the next server-issued allowed UTC window.";
  }
  return "Start a new clock epoch from the next durable browser observation; do not backfill the rejected time.";
}

function safeRequestId(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function safeDiagnosticCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_]{1,80}$/.test(normalized)
    ? normalized
    : "UNKNOWN";
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

export function hasLifecycleDiscontinuity(
  previous: { wallClockMs: number; monotonicMs: number },
  current: { wallClockMs: number; monotonicMs: number },
) {
  const wallDelta = current.wallClockMs - previous.wallClockMs;
  const monotonicDelta = current.monotonicMs - previous.monotonicMs;
  return (
    wallDelta < 0 ||
    monotonicDelta < 0 ||
    Math.max(wallDelta, monotonicDelta) > LIFECYCLE_MAX_UNOBSERVED_MS ||
    Math.abs(wallDelta - monotonicDelta) > CLOCK_DIVERGENCE_TOLERANCE_MS
  );
}

function describeBrowserPolicyRequirement(policy: DeviceTrackingPolicyV2) {
  if (policy.scheduleTimeZoneState !== "CONFIRMED") {
    return "Tracking is waiting for the workspace Owner or Manager to confirm the policy time zone in WorkMap Compliance.";
  }
  if (policy.acknowledgementState !== "ACKNOWLEDGED") {
    return "Tracking is waiting for this employee to review and acknowledge the current WorkMap policy.";
  }
  if (!policy.collectDomainFocus) {
    return "Browser domain tracking is disabled by the current WorkMap policy.";
  }
  if (!policy.policyLeaseId || policy.allowedUtcWindows.length === 0) {
    return "Tracking is waiting for a valid policy collection window. It will retry automatically.";
  }
  return null;
}

export function collectorStateForPolicy(
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

function getWindow(api: ChromeApi, windowId: number) {
  return new Promise<ChromeWindow>((resolve, reject) => {
    api.windows.get(windowId, { populate: false }, (window) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Window query failed."));
      else resolve(window);
    });
  });
}

function getTab(api: ChromeApi, tabId: number) {
  return new Promise<ChromeTab>((resolve, reject) => {
    api.tabs.get(tabId, (tab) => {
      const error = api.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Tab query failed."));
      else resolve(tab);
    });
  });
}

function probeTab(api: ChromeApi, tabId: number) {
  return new Promise<{ visible: boolean; focused: boolean } | null>(
    (resolve) => {
      api.tabs.sendMessage(
        tabId,
        { type: "workmap:domain-probe" },
        (response) => {
          if (api.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(
            response?.type === "workmap:domain-probe-result" &&
              typeof response.visible === "boolean" &&
              typeof response.focused === "boolean"
              ? {
                  visible: response.visible,
                  focused: response.focused,
                }
              : null,
          );
        },
      );
    },
  );
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
    if (
      change.url ||
      change.status === "loading" ||
      change.status === "complete"
    ) {
      void schedule(() => runtime.handleTabUpdated(tabId, change, tab));
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
  api.windows.onBoundsChanged.addListener((window) => {
    void schedule(() => runtime.handleWindowBoundsChanged(window));
  });
  api.windows.onRemoved.addListener((windowId) => {
    void schedule(() => runtime.handleWindowRemoved(windowId));
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

if (typeof chrome !== "undefined") installRuntimeListeners(chrome);
