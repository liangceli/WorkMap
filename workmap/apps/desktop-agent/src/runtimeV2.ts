import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  AgentApiError,
  confirmProtocolV2,
  getDeviceClientStatus,
  getTrackingPolicyV2,
  isUpgradeRequiredError,
  prepareProtocolV2,
  sendAppUsage,
  sendDeviceStatus,
  syncTrackingV2,
} from "./apiClient.js";
import { DesktopFocusEngineV2, type DesktopFocusEngineUpdateV2 } from "./desktopFocusEngineV2.js";
import {
  FileEventQueue,
  FileStatusEventQueue,
  readTrackingCheckpoint,
  writeAgentStatus,
  writeTrackingCheckpoint,
} from "./fileStore.js";
import { recoverTrackingCheckpointAtProtocolActivation } from "./trackingState.js";
import {
  createInitialDesktopTrackingV2State,
  DesktopTrackingV2Store,
  V2QueuePressureError,
} from "./trackingV2Store.js";
import {
  DESKTOP_V2_HEALTH_SYNC_MS,
  DESKTOP_V2_POLICY_REFRESH_MS,
  DESKTOP_V2_SETTLEMENT_MS,
  DESKTOP_V2_SYNC_BATCH_SIZE,
  TRACKING_PROTOCOL_VERSION_V2,
  type ClientHealthV2,
  type DesktopTrackingRuntimeStateV2,
  type DeviceTrackingPolicyV2,
  type TrackingCollectorStateV2,
  type TrackingConnectionStateV2,
  type TrackingHealthErrorCodeV2,
  type TrackingPolicyStateV2,
  type TrackingSyncRequestV2,
} from "./trackingV2Types.js";
import type {
  AgentConfig,
  AgentStatus,
  DeviceStatusName,
  DeviceStatusReason,
  TrackingCheckpoint,
} from "./types.js";
import {
  WindowsActivityHostAdapterV2,
  type WindowsActivityAppIdentityV2,
  type WindowsActivityHostEventV2,
} from "./windowsActivityHost.js";

type ShutdownReason =
  | "USER_STOP"
  | "DEVICE_SHUTDOWN"
  | "SUSPENDED"
  | "AGENT_CRASHED"
  | "AGENT_TERMINATED"
  | "UNKNOWN_INTERRUPTED"
  | undefined;

type RuntimeV2Options = {
  host?: WindowsActivityHostAdapterV2;
  store?: DesktopTrackingV2Store;
  legacyQueue?: FileEventQueue;
  statusQueue?: FileStatusEventQueue;
  statusWriter?: (status: AgentStatus) => Promise<unknown>;
};

export class DesktopAgentRuntimeV2 {
  private readonly host: WindowsActivityHostAdapterV2;
  private readonly store: DesktopTrackingV2Store;
  private readonly legacyQueue: FileEventQueue;
  private readonly statusQueue: FileStatusEventQueue;
  private readonly statusWriter: (status: AgentStatus) => Promise<unknown>;
  private state: DesktopTrackingRuntimeStateV2;
  private engine: DesktopFocusEngineV2 | null = null;
  private currentHostApp: WindowsActivityAppIdentityV2 | null = null;
  private latestHostMonotonicMs: number | null = null;
  private helperToNodeMonotonicOffsetMs: number | null = null;
  private eventChain = Promise.resolve();
  private runPromise: Promise<void> | null = null;
  private stopped = false;
  private finalized = false;
  private syncInFlight: Promise<void> | null = null;
  private syncAgain = false;
  private lastSettlementAtMs = 0;
  private lastHealthSyncAtMs = 0;
  private lastPolicyRefreshAtMs = 0;
  private connectionState: TrackingConnectionStateV2 = "OFFLINE";
  private collectorState: TrackingCollectorStateV2 = "PAUSED";
  private lastErrorCode: TrackingHealthErrorCodeV2 = "NONE";
  private shutdownReason: ShutdownReason;
  private queuesInitialized = false;
  private legacyCheckpoint: TrackingCheckpoint | null = null;

  constructor(
    private readonly config: AgentConfig,
    options: RuntimeV2Options = {},
  ) {
    this.host = options.host ?? new WindowsActivityHostAdapterV2();
    this.store = options.store ?? new DesktopTrackingV2Store();
    this.legacyQueue = options.legacyQueue ?? new FileEventQueue();
    this.statusQueue = options.statusQueue ?? new FileStatusEventQueue();
    this.statusWriter = options.statusWriter ?? writeAgentStatus;
    this.state = this.store.readRuntimeState() ?? createInitialDesktopTrackingV2State();
  }

  async run() {
    if (!this.runPromise) this.runPromise = this.runLoop();
    await this.runPromise;
  }

  async shutdown(reason: ShutdownReason = "USER_STOP") {
    this.shutdownReason = reason;
    this.stopped = true;
    if (this.runPromise) return this.runPromise;
    await this.initializeQueues();
    await this.finalize();
  }

  async reportDeviceStatus(
    status: DeviceStatusName,
    reason: DeviceStatusReason,
    metadata?: { operation?: string; networkState?: string; agentVersion?: string },
  ) {
    if (status === "SLEEPING" || status === "LOCKED" || status === "DEVICE_SHUTDOWN") {
      await this.enqueueHostBoundary(currentMonotonic(this), true);
    }
    await this.enqueueLifecycle(status, reason, metadata);
    await this.flushStatusQueue();
  }

  private async runLoop() {
    await this.initializeQueues();
    await this.updateUiStatus();
    try {
      const activated = await this.ensureProtocolV2();
      if (!activated) {
        await this.updateUiStatus();
        return;
      }
      await this.closeRecoveredV2Tail();
      this.startHost();
      await this.enqueueLifecycle("RUNNING", "AGENT_STARTED", {
        operation: "protocol-v2-start",
        agentVersion: this.config.agentVersion,
      });
      await this.flushStatusQueue();

      while (!this.stopped) {
        await delay(1_000);
        await this.eventChain;
        const monotonicMs = currentMonotonic(this);
        if (monotonicMs !== null) {
          await this.tick(monotonicMs);
        }
        await this.flushLegacyQueue();
        await this.flushStatusQueue();
      }
    } catch (error) {
      await this.applyFailure(error);
    } finally {
      await this.finalize();
    }
  }

  private async initializeQueues() {
    if (this.queuesInitialized) return;
    await this.legacyQueue.loadPreservingExisting();
    await this.statusQueue.load();
    if (this.state.migrationState === "V1" || this.state.migrationState === "PREPARING_V2") {
      this.legacyCheckpoint = await readTrackingCheckpoint();
    }
    this.queuesInitialized = true;
  }

  private async ensureProtocolV2() {
    try {
      const identity = await getDeviceClientStatus(this.config);
      if (
        identity.clientType !== "DESKTOP_AGENT" ||
        identity.deviceId !== this.config.deviceId ||
        !identity.workstationId ||
        identity.browserName !== null
      ) {
        throw new Error("The paired Desktop device identity is incomplete.");
      }
      const prepared = await prepareProtocolV2(this.config);
      this.applyServerClock(prepared.serverTime);
      this.state.policy = prepared.policy;

      const activationBoundary = prepared.state === "CONFIRMED"
        ? prepared.protocolActivatedAt
        : prepared.proposedActivatedAt;
      if (!activationBoundary) {
        throw new Error("The server did not return a complete v2 activation boundary.");
      }
      if (this.state.migrationState !== "V2") {
        this.state = {
          ...this.state,
          migrationState: "PREPARING_V2",
          activationId: prepared.activationId ?? this.state.activationId,
          proposedActivatedAt: activationBoundary,
          policy: prepared.policy,
        };
        this.store.writeRuntimeState(this.state);
      }
      await this.closeLegacyCheckpointAt(activationBoundary);

      let activatedAt = prepared.protocolActivatedAt;
      if (prepared.state !== "CONFIRMED") {
        if (!prepared.activationId || !prepared.proposedActivatedAt) {
          throw new Error("The server did not return a complete v2 activation boundary.");
        }
        this.state = {
          ...this.state,
          migrationState: "PREPARING_V2",
          activationId: prepared.activationId,
          proposedActivatedAt: prepared.proposedActivatedAt,
          policy: prepared.policy,
        };
        this.store.writeRuntimeState(this.state);
        const confirmed = await confirmProtocolV2(
          this.config,
          prepared.activationId,
          prepared.proposedActivatedAt,
        );
        this.applyServerClock(confirmed.serverTime);
        activatedAt = confirmed.protocolActivatedAt;
      }
      if (!activatedAt) throw new Error("Protocol v2 activation was not confirmed.");

      this.state = {
        ...this.state,
        protocolActivatedAt: activatedAt,
        proposedActivatedAt: activatedAt,
        migrationState: this.legacyQueue.size() > 0 ? "DRAINING_V1" : "V2",
        lastErrorCode: "NONE",
      };
      this.store.writeRuntimeState(this.state);
      this.connectionState = "ONLINE";
      this.collectorState = policyCollectorState(
        prepared.policy,
        serverNow(this.state),
      );
      this.lastErrorCode = "NONE";
      this.lastPolicyRefreshAtMs = Date.now();
      return this.collectorState !== "ERROR";
    } catch (error) {
      const cachedPolicy = this.state.policy;
      if (
        this.state.protocolActivatedAt &&
        cachedPolicy &&
        policyLeaseValid(cachedPolicy, serverNow(this.state))
      ) {
        this.connectionState = "OFFLINE";
        this.collectorState = policyCollectorState(
          cachedPolicy,
          serverNow(this.state),
        );
        this.lastErrorCode = "POLICY_UNAVAILABLE";
        return true;
      }
      await this.applyFailure(error);
      return false;
    }
  }

  private async closeLegacyCheckpointAt(protocolActivatedAt: string) {
    const recovered = recoverTrackingCheckpointAtProtocolActivation(
      this.legacyCheckpoint,
      this.config.deviceId,
      protocolActivatedAt,
    );
    if (recovered.length > 0) {
      await this.legacyQueue.enqueueMany(recovered);
    }
    if (this.legacyCheckpoint) {
      await writeTrackingCheckpoint(null);
      this.legacyCheckpoint = null;
    }
  }

  private async closeRecoveredV2Tail() {
    if (!this.state.clock || !this.state.engineCheckpoint || !this.state.policy) return;
    const recoveredEngine = new DesktopFocusEngineV2(
      this.state.clock,
      this.state.policy,
      this.state.engineCheckpoint,
    );
    const boundary = this.state.engineCheckpoint.lastObservedAtMonotonicMs;
    const update = recoveredEngine.clearFocus(boundary);
    this.state = {
      ...this.state,
      engineCheckpoint: recoveredEngine.checkpoint(),
      latestSnapshot: update.snapshot,
    };
    this.store.persistEngineUpdate(update.intervals, this.state, update.snapshot);
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      latestSnapshot: null,
    };
    this.store.writeRuntimeState(this.state);
  }

  private startHost() {
    this.host.start((event) => {
      this.eventChain = this.eventChain
        .then(() => this.processHostEvent(event))
        .catch((error) => this.applyFailure(error));
    });
  }

  private async processHostEvent(event: WindowsActivityHostEventV2) {
    this.latestHostMonotonicMs = event.monotonicMs;
    this.helperToNodeMonotonicOffsetMs = event.monotonicMs - performance.now();
    if (event.eventType === "foreground_changed") {
      this.currentHostApp = event.app;
      if (!event.app) {
        await this.enqueueHostBoundary(event.monotonicMs, true);
      } else if (this.captureAllowedAt(event.monotonicMs)) {
        this.ensureEngine(event.monotonicMs);
        await this.persistUpdate(
          this.engine!.acquireFocus(event.app, event.monotonicMs),
          true,
        );
      }
      return;
    }
    if (event.eventType === "interaction_pulse") {
      if (this.engine && this.currentHostApp && this.captureAllowedAt(event.monotonicMs)) {
        await this.persistUpdate(this.engine.recordSessionInput(event.monotonicMs), true);
      }
      return;
    }
    if (
      event.eventType === "session_locked" ||
      event.eventType === "session_disconnected" ||
      event.eventType === "suspend" ||
      (event.eventType === "desktop_switched" && !event.inputDesktopAvailable)
    ) {
      await this.enqueueHostBoundary(event.monotonicMs, true);
      this.collectorState = "PAUSED";
      return;
    }
    if (
      event.eventType === "session_unlocked" ||
      event.eventType === "session_connected" ||
      event.eventType === "resume" ||
      (event.eventType === "desktop_switched" && event.inputDesktopAvailable)
    ) {
      this.collectorState = this.state.policy
        ? policyCollectorState(this.state.policy, serverNow(this.state))
        : "PAUSED";
      return;
    }
    if (event.eventType === "health") {
      if (event.state === "ERROR") {
        this.collectorState = "ERROR";
        this.lastErrorCode = "NATIVE_HELPER_UNAVAILABLE";
        await this.enqueueHostBoundary(event.monotonicMs, true);
      } else if (event.state === "LIMITED") {
        this.collectorState = "LIMITED";
        this.lastErrorCode =
          event.errorCode === "INPUT_CLOCK_UNTRUSTED"
            ? "CLOCK_UNTRUSTED"
            : "UNKNOWN";
      } else {
        this.collectorState = this.state.policy
          ? policyCollectorState(this.state.policy, serverNow(this.state))
          : "PAUSED";
        this.lastErrorCode = "NONE";
      }
      await this.requestSync();
    }
  }

  private async tick(monotonicMs: number) {
    const nowMs = Date.now();
    if (nowMs - this.lastPolicyRefreshAtMs >= DESKTOP_V2_POLICY_REFRESH_MS) {
      await this.refreshPolicy(monotonicMs);
    }
    if (!this.captureAllowedAt(monotonicMs)) {
      await this.enqueueHostBoundary(monotonicMs, false);
    } else if (this.currentHostApp && !this.engine && this.collectorState === "HEALTHY") {
      this.ensureEngine(monotonicMs);
      await this.persistUpdate(
        this.engine!.acquireFocus(this.currentHostApp, monotonicMs),
        true,
      );
    } else if (this.engine) {
      const shouldSettle = nowMs - this.lastSettlementAtMs >= DESKTOP_V2_SETTLEMENT_MS;
      await this.persistUpdate(
        shouldSettle ? this.engine.settle(monotonicMs) : this.engine.observe(monotonicMs),
        shouldSettle,
      );
      if (shouldSettle) this.lastSettlementAtMs = nowMs;
    }
    if (nowMs - this.lastHealthSyncAtMs >= DESKTOP_V2_HEALTH_SYNC_MS) {
      await this.requestSync();
      this.lastHealthSyncAtMs = nowMs;
    }
  }

  private ensureEngine(atMonotonicMs: number) {
    if (this.engine) return;
    const policy = this.state.policy;
    if (!policy?.policyLeaseId) throw new Error("A valid policy lease is required.");
    const anchorUtcMs = Math.max(
      serverNow(this.state),
      Date.parse(this.state.protocolActivatedAt ?? ""),
    );
    this.state.clock = {
      clockEpochId: randomUUID(),
      clockEpochStartedAt: new Date(anchorUtcMs).toISOString(),
      clockEpochStartedMonotonicMs: atMonotonicMs,
    };
    this.engine = new DesktopFocusEngineV2(this.state.clock, policy);
  }

  private async persistUpdate(
    update: DesktopFocusEngineUpdateV2,
    immediateSync: boolean,
  ) {
    if (!this.engine) return false;
    const durableState = this.state;
    const nextState: DesktopTrackingRuntimeStateV2 = {
      ...durableState,
      engineCheckpoint: this.engine.checkpoint(),
      latestSnapshot: update.snapshot,
      lastErrorCode: this.lastErrorCode,
    };
    try {
      this.store.persistEngineUpdate(update.intervals, nextState, update.snapshot);
      this.state = nextState;
    } catch (error) {
      if (error instanceof V2QueuePressureError) {
        this.collectorState = "PAUSED";
        this.lastErrorCode = "QUEUE_PRESSURE";
        this.engine = null;
        this.state = {
          ...durableState,
          clock: null,
          engineCheckpoint: null,
          latestSnapshot: null,
          lastErrorCode: "QUEUE_PRESSURE",
        };
        this.store.writeRuntimeState(this.state);
        await this.updateUiStatus(error.message);
        await this.requestSync();
        return false;
      } else {
        throw error;
      }
    }
    await this.updateUiStatus();
    if (immediateSync || update.intervals.length > 0) await this.requestSync();
    return true;
  }

  private async enqueueHostBoundary(monotonicMs: number | null, immediateSync: boolean) {
    if (!this.engine || monotonicMs === null) return;
    const update = this.engine.clearFocus(monotonicMs);
    const persisted = await this.persistUpdate(update, immediateSync);
    if (!persisted) return;
    this.engine = null;
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      latestSnapshot: update.snapshot,
    };
    this.store.writeRuntimeState(this.state);
  }

  private async requestSync() {
    if (!this.state.protocolActivatedAt) return;
    if (this.connectionState === "AUTH_REQUIRED" || this.connectionState === "UPGRADE_REQUIRED") return;
    if (this.syncInFlight) {
      this.syncAgain = true;
      return this.syncInFlight;
    }
    this.syncInFlight = this.performSync().finally(() => {
      this.syncInFlight = null;
    });
    await this.syncInFlight;
    if (this.syncAgain) {
      this.syncAgain = false;
      await this.requestSync();
    }
  }

  private async performSync() {
    const intervals = this.store.listReady(
      Date.now(),
      DESKTOP_V2_SYNC_BATCH_SIZE,
    );
    const request: TrackingSyncRequestV2 = {
      protocolVersion: TRACKING_PROTOCOL_VERSION_V2,
      protocolActivatedAt: this.state.protocolActivatedAt!,
      clientInstanceId: this.state.clientInstanceId,
      sentAt: new Date(serverNow(this.state)).toISOString(),
      intervals,
      health: this.buildHealth(),
      ...(this.state.latestSnapshot
        ? { focusSnapshot: this.state.latestSnapshot }
        : {}),
    };
    try {
      const response = await syncTrackingV2(this.config, request);
      this.applyServerClock(response.serverTime);
      const acknowledged = response.results
        .filter((result) => result.status === "ACCEPTED" || result.status === "DUPLICATE")
        .map((result) => result.clientEventId);
      const deadLetter = response.results.flatMap((result) =>
        result.status === "REJECTED" && result.terminal !== false
          ? [{ clientEventId: result.clientEventId, code: result.rejectionCode ?? "REJECTED" }]
          : [],
      );
      const retry = response.results
        .filter((result) => result.status === "REJECTED" && result.terminal === false)
        .map((result) => result.clientEventId);
      this.store.acknowledge(acknowledged);
      this.store.deadLetter(deadLetter);
      this.store.retry(retry);
      this.connectionState = "ONLINE";
      if (
        this.lastErrorCode === "QUEUE_PRESSURE" &&
        this.store.hasCapacity()
      ) {
        this.collectorState = this.state.policy
          ? policyCollectorState(this.state.policy, serverNow(this.state))
          : "PAUSED";
      }
      this.lastErrorCode =
        this.collectorState === "PAUSED" &&
        this.lastErrorCode === "QUEUE_PRESSURE"
          ? "QUEUE_PRESSURE"
          : "NONE";
      const syncedAt = new Date(serverNow(this.state)).toISOString();
      this.state = {
        ...this.state,
        lastSuccessfulSyncAt: syncedAt,
        lastSuccessfulHeartbeatAt: syncedAt,
        lastErrorCode: "NONE",
      };
      this.store.writeRuntimeState(this.state);
    } catch (error) {
      const ids = intervals.map((interval) => interval.clientEventId);
      if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
        this.connectionState = "AUTH_REQUIRED";
      } else if (isUpgradeRequiredError(error)) {
        this.connectionState = "UPGRADE_REQUIRED";
        this.lastErrorCode = "UPGRADE_REQUIRED";
      } else if (
        error instanceof AgentApiError &&
        error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        this.store.deadLetter(ids.map((clientEventId) => ({
          clientEventId,
          code: error.responseCode ?? `HTTP_${error.status}`,
        })));
        this.connectionState = "ERROR";
      } else {
        this.store.retry(ids, Date.now(), error instanceof AgentApiError ? error.retryAfterMs : undefined);
        this.connectionState = "OFFLINE";
      }
      await this.applyFailure(error, false);
    }
    await this.updateUiStatus();
  }

  private async flushLegacyQueue() {
    const ready = this.legacyQueue.listReady(Date.now(), DESKTOP_V2_SYNC_BATCH_SIZE);
    if (ready.length === 0) {
      if (this.state.migrationState === "DRAINING_V1" && this.legacyQueue.size() === 0) {
        this.state = { ...this.state, migrationState: "V2" };
        this.store.writeRuntimeState(this.state);
      }
      return;
    }
    const ids = ready.map((item) => item.event.clientEventId);
    try {
      await sendAppUsage(this.config, ready.map((item) => item.event));
      await this.legacyQueue.acknowledge(ids);
    } catch (error) {
      if (
        error instanceof AgentApiError &&
        error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        await this.legacyQueue.discard(ids);
      } else {
        await this.legacyQueue.retry(ids);
      }
    }
  }

  private async refreshPolicy(monotonicMs: number) {
    this.lastPolicyRefreshAtMs = Date.now();
    try {
      const next = await getTrackingPolicyV2(this.config);
      this.applyServerClock(next.serverTime);
      const changed =
        next.policyVersion !== this.state.policy?.policyVersion ||
        next.policyLeaseId !== this.state.policy?.policyLeaseId;
      if (changed) {
        await this.enqueueHostBoundary(monotonicMs, true);
        this.state = {
          ...this.state,
          policy: next,
          clock: null,
          engineCheckpoint: null,
        };
      } else {
        this.state = { ...this.state, policy: next };
      }
      this.collectorState = policyCollectorState(next, serverNow(this.state));
      this.store.writeRuntimeState(this.state);
    } catch (error) {
      if (!this.state.policy || !policyLeaseValid(this.state.policy, serverNow(this.state))) {
        this.collectorState = "PAUSED";
        this.lastErrorCode = "POLICY_UNAVAILABLE";
        await this.enqueueHostBoundary(monotonicMs, true);
      }
      await this.applyFailure(error, false);
    }
  }

  private captureAllowedAt(monotonicMs: number) {
    const policy = this.state.policy;
    if (
      !policy ||
      this.collectorState !== "HEALTHY" ||
      !policy.collectAppFocus ||
      !policy.policyLeaseId
    ) {
      return false;
    }
    const instant = this.monotonicToUtcMs(monotonicMs);
    return (
      policyLeaseValid(policy, instant) &&
      policy.allowedUtcWindows.some(
        (window) =>
          Date.parse(window.startsAt) <= instant &&
          instant < Date.parse(window.endsAt),
      )
    );
  }

  private monotonicToUtcMs(monotonicMs: number) {
    if (this.state.clock) {
      return (
        Date.parse(this.state.clock.clockEpochStartedAt) +
        (monotonicMs - this.state.clock.clockEpochStartedMonotonicMs)
      );
    }
    return serverNow(this.state);
  }

  private buildHealth(): ClientHealthV2 {
    return {
      clientType: "DESKTOP_AGENT",
      clientVersion: this.config.agentVersion,
      platform: "WINDOWS",
      connectionState: this.connectionState,
      collectorState: this.collectorState,
      policyState: policyState(this.state.policy, serverNow(this.state)),
      migrationState: this.state.migrationState,
      queue: this.store.stats(),
      lastSuccessfulHeartbeatAt: this.state.lastSuccessfulHeartbeatAt,
      lastSuccessfulSyncAt: this.state.lastSuccessfulSyncAt,
      errorCode: this.lastErrorCode,
    };
  }

  private async enqueueLifecycle(
    status: DeviceStatusName,
    reason: DeviceStatusReason,
    metadata?: { operation?: string; networkState?: string; agentVersion?: string },
  ) {
    await this.statusQueue.enqueue({
      protocolVersion: 2,
      clientEventId: randomUUID(),
      deviceId: this.config.deviceId,
      status,
      reason,
      startedAt: new Date(serverNow(this.state)).toISOString(),
      recordedAt: new Date(serverNow(this.state)).toISOString(),
      timeZone: resolveTimeZone(),
      confidence: "CONFIRMED",
      metadata,
    });
  }

  private async flushStatusQueue() {
    if (!this.state.protocolActivatedAt) return;
    const ready = this.statusQueue.listReady();
    for (const item of ready) {
      try {
        await sendDeviceStatus(this.config, item.event);
        await this.statusQueue.acknowledge([item.event.clientEventId]);
      } catch (error) {
        if (
          error instanceof AgentApiError &&
          error.status &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          await this.statusQueue.discard([item.event.clientEventId]);
        } else {
          await this.statusQueue.retry([item.event.clientEventId]);
        }
      }
    }
  }

  private async applyFailure(error: unknown, updateStatus = true) {
    if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
      this.connectionState = "AUTH_REQUIRED";
    } else if (isUpgradeRequiredError(error)) {
      this.connectionState = "UPGRADE_REQUIRED";
      this.lastErrorCode = "UPGRADE_REQUIRED";
    } else {
      this.connectionState = "OFFLINE";
      if (this.lastErrorCode === "NONE") this.lastErrorCode = "UNKNOWN";
    }
    this.state = { ...this.state, lastErrorCode: this.lastErrorCode };
    this.store.writeRuntimeState(this.state);
    if (updateStatus) await this.updateUiStatus(safeError(error));
  }

  private async updateUiStatus(error?: string) {
    const snapshot = this.state.latestSnapshot;
    const stats = this.store.stats();
    const state: AgentStatus["state"] =
      this.connectionState === "ONLINE"
        ? this.collectorState === "PAUSED" ? "paused" : "connected"
        : this.connectionState === "AUTH_REQUIRED"
          ? "auth_required"
          : this.connectionState === "UPGRADE_REQUIRED"
            ? "upgrade_required"
            : this.connectionState === "ERROR"
              ? "error"
              : "offline";
    await this.statusWriter({
      state,
      deviceId: this.config.deviceId,
      lastHeartbeatAt: this.state.lastSuccessfulHeartbeatAt ?? undefined,
      lastUploadAt: this.state.lastSuccessfulSyncAt ?? undefined,
      currentActivity:
        snapshot?.state !== "NONE" && snapshot?.displayName && snapshot.stateStartedAt
          ? {
              appName: snapshot.displayName,
              startedAt: snapshot.stateStartedAt,
              lastObservedAt: snapshot.lastObservedAt,
              activeSeconds:
                snapshot.state === "ACTIVE"
                  ? Math.max(
                      0,
                      Math.floor(
                        (Date.parse(snapshot.lastObservedAt) -
                          Date.parse(snapshot.stateStartedAt)) /
                          1_000,
                      ),
                    )
                  : 0,
              isIdle: snapshot.state === "IDLE",
            }
          : null,
      queuedEvents: stats.pending + this.legacyQueue.size(),
      queuedStatusEvents: this.statusQueue.size(),
      error,
    });
  }

  private applyServerClock(serverTime: string) {
    const serverMs = Date.parse(serverTime);
    if (Number.isFinite(serverMs)) {
      this.state = { ...this.state, serverOffsetMs: serverMs - Date.now() };
    }
  }

  private async finalize() {
    if (this.finalized) return;
    this.finalized = true;
    this.host.stop();
    await this.eventChain;
    const monotonicMs = currentMonotonic(this);
    if (this.engine && monotonicMs !== null) {
      await this.persistUpdate(this.engine.clearFocus(monotonicMs), true);
      this.engine = null;
    }
    if (this.state.protocolActivatedAt) {
      const lifecycle = shutdownLifecycle(this.shutdownReason);
      await this.enqueueLifecycle(lifecycle.status, lifecycle.reason, {
        operation: "agent-shutdown",
        agentVersion: this.config.agentVersion,
      });
      await this.flushStatusQueue();
      await this.requestSync();
    }
    this.connectionState = "OFFLINE";
    await this.updateUiStatus();
    this.store.close();
  }
}

function currentMonotonic(runtime: DesktopAgentRuntimeV2) {
  const state = runtime as unknown as {
    helperToNodeMonotonicOffsetMs: number | null;
    latestHostMonotonicMs: number | null;
  };
  if (state.helperToNodeMonotonicOffsetMs === null) return state.latestHostMonotonicMs;
  return Math.max(
    state.latestHostMonotonicMs ?? 0,
    performance.now() + state.helperToNodeMonotonicOffsetMs,
  );
}

function policyCollectorState(
  policy: DeviceTrackingPolicyV2,
  nowMs: number,
): TrackingCollectorStateV2 {
  if (
    policy.acknowledgementState !== "ACKNOWLEDGED" ||
    policy.scheduleTimeZoneState !== "CONFIRMED" ||
    !policy.policyLeaseId ||
    !policy.collectAppFocus
  ) {
    return "PAUSED";
  }
  return policyLeaseValid(policy, nowMs) ? "HEALTHY" : "PAUSED";
}

function policyState(
  policy: DeviceTrackingPolicyV2 | null,
  nowMs: number,
): TrackingPolicyStateV2 {
  if (!policy) return "EXPIRED";
  if (policy.acknowledgementState !== "ACKNOWLEDGED") return "ACKNOWLEDGEMENT_REQUIRED";
  if (policy.scheduleTimeZoneState !== "CONFIRMED") return "TIMEZONE_REQUIRED";
  return policyLeaseValid(policy, nowMs) ? "ACTIVE" : "EXPIRED";
}

function policyLeaseValid(policy: DeviceTrackingPolicyV2, nowMs: number) {
  const issuedAt = Date.parse(policy.policyLeaseIssuedAt ?? "");
  const expiresAt = Date.parse(policy.policyLeaseExpiresAt ?? "");
  return (
    Boolean(policy.policyLeaseId) &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= nowMs &&
    nowMs < expiresAt
  );
}

function serverNow(state: DesktopTrackingRuntimeStateV2) {
  return Date.now() + state.serverOffsetMs;
}

function shutdownLifecycle(reason: ShutdownReason): {
  status: DeviceStatusName;
  reason: DeviceStatusReason;
} {
  if (reason === "USER_STOP") return { status: "STOPPED_BY_USER", reason: "USER_STOP" };
  if (reason === "DEVICE_SHUTDOWN") return { status: "DEVICE_SHUTDOWN", reason: "SYSTEM_SHUTDOWN" };
  if (reason === "SUSPENDED") return { status: "SLEEPING", reason: "SYSTEM_SUSPEND" };
  if (reason === "AGENT_CRASHED") return { status: "AGENT_CRASHED", reason: "PROCESS_CRASH" };
  if (reason === "AGENT_TERMINATED") return { status: "AGENT_TERMINATED", reason: "PROCESS_TERMINATED" };
  return { status: "UNKNOWN_INTERRUPTED", reason: "UNKNOWN" };
}

function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]").slice(0, 300)
    : "Unknown runtime failure";
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
