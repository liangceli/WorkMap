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
  DesktopOpenRuntimeEngineV2,
  type DesktopOpenRuntimeEngineUpdateV2,
} from "./desktopOpenRuntimeEngineV2.js";
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
  AgentDiagnosticLog,
  type AgentDiagnosticsBundle,
} from "./diagnosticLog.js";
import {
  DESKTOP_V2_HEALTH_SYNC_MS,
  DESKTOP_V2_POLICY_REFRESH_MS,
  DESKTOP_V2_SETTLEMENT_MS,
  DESKTOP_V2_SYNC_BATCH_SIZE,
  TRACKING_PROTOCOL_VERSION_V2,
  type ActivityIntervalV2,
  type ClientHealthV2,
  type DesktopClockEpochV2,
  type DesktopFocusCheckpointV2,
  type DesktopOpenRuntimeCheckpointV2,
  type DesktopTrackingRuntimeStateV2,
  type DeviceTrackingPolicyV2,
  type TrackingCollectorStateV2,
  type TrackingConnectionStateV2,
  type TrackingHealthErrorCodeV2,
  type TrackingPolicyStateV2,
  type TrackingSyncDiagnosticV2,
  type TrackingSyncItemResultV2,
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

export type DesktopTimelineStreamV2 = "FOCUS" | "OPEN_RUNTIME";

type RuntimeV2Options = {
  host?: WindowsActivityHostAdapterV2;
  store?: DesktopTrackingV2Store;
  legacyQueue?: FileEventQueue;
  statusQueue?: FileStatusEventQueue;
  statusWriter?: (status: AgentStatus) => Promise<unknown>;
  diagnosticLog?: AgentDiagnosticLog;
};

export class DesktopAgentRuntimeV2 {
  private readonly host: WindowsActivityHostAdapterV2;
  private readonly store: DesktopTrackingV2Store;
  private readonly legacyQueue: FileEventQueue;
  private readonly statusQueue: FileStatusEventQueue;
  private readonly statusWriter: (status: AgentStatus) => Promise<unknown>;
  private readonly diagnosticLog: AgentDiagnosticLog;
  private state: DesktopTrackingRuntimeStateV2;
  private engine: DesktopFocusEngineV2 | null = null;
  private openRuntimeEngine: DesktopOpenRuntimeEngineV2 | null = null;
  private currentHostApp: WindowsActivityAppIdentityV2 | null = null;
  private currentVisibleApps: WindowsActivityAppIdentityV2[] = [];
  private latestHostMonotonicMs: number | null = null;
  private helperToNodeMonotonicOffsetMs: number | null = null;
  private eventChain = Promise.resolve();
  private runPromise: Promise<void> | null = null;
  private stopped = false;
  private finalized = false;
  private syncInFlight: Promise<void> | null = null;
  private syncAgain = false;
  private syncRetryTimer: NodeJS.Timeout | null = null;
  private syncRetryNotBeforeMs = 0;
  private consecutiveRetryableSyncFailures = 0;
  private lastSettlementAtMs = 0;
  private lastOpenRuntimeSettlementAtMs = 0;
  private lastHealthSyncAtMs = 0;
  private lastPolicyRefreshAtMs = 0;
  private connectionState: TrackingConnectionStateV2 = "OFFLINE";
  private collectorState: TrackingCollectorStateV2 = "PAUSED";
  private lastErrorCode: TrackingHealthErrorCodeV2 = "NONE";
  private policySetupMessage: string | null = null;
  private uiError: string | undefined;
  private shutdownReason: ShutdownReason;
  private queuesInitialized = false;
  private legacyCheckpoint: TrackingCheckpoint | null = null;
  private readonly recoveredPolicy: DeviceTrackingPolicyV2 | null;

  constructor(
    private readonly config: AgentConfig,
    options: RuntimeV2Options = {},
  ) {
    this.host = options.host ?? new WindowsActivityHostAdapterV2();
    this.store = options.store ?? new DesktopTrackingV2Store();
    this.legacyQueue = options.legacyQueue ?? new FileEventQueue();
    this.statusQueue = options.statusQueue ?? new FileStatusEventQueue();
    this.statusWriter = options.statusWriter ?? writeAgentStatus;
    this.diagnosticLog = options.diagnosticLog ?? new AgentDiagnosticLog();
    const persistedState = this.store.readRuntimeState();
    this.recoveredPolicy = persistedState?.policy?.policyLeaseId
      ? {
          ...persistedState.policy,
          allowedUtcWindows: persistedState.policy.allowedUtcWindows.map(
            (window) => ({ ...window }),
          ),
        }
      : null;
    this.state = {
      ...createInitialDesktopTrackingV2State(),
      ...persistedState,
      lastSyncDiagnostic: persistedState?.lastSyncDiagnostic ?? null,
      recentSyncFailures: Array.isArray(persistedState?.recentSyncFailures)
        ? persistedState.recentSyncFailures.slice(0, 10)
        : [],
      lastSnapshotSyncStatus:
        persistedState?.lastSnapshotSyncStatus ?? null,
      lastIntervalUploadStatus:
        persistedState?.lastIntervalUploadStatus ?? null,
    };
  }

  async run() {
    if (!this.runPromise) this.runPromise = this.runLoop();
    await this.runPromise;
  }

  getDiagnosticsBundle(): AgentDiagnosticsBundle {
    const queue = this.store.stats();
    return {
      generatedAt: new Date().toISOString(),
      agentVersion: this.config.agentVersion,
      deviceId: this.config.deviceId,
      logDirectory: this.diagnosticLog.getDirectory(),
      connectionState: this.connectionState,
      collectorState: this.collectorState,
      connection: {
        state: this.connectionState,
        lastSuccessfulHeartbeatAt: this.state.lastSuccessfulHeartbeatAt,
        lastSuccessfulSyncAt: this.state.lastSuccessfulSyncAt,
      },
      queue: {
        pending: queue.pending,
        ready: queue.ready,
        deadLetter: queue.deadLetter,
        deadLetterByCode: this.store.deadLetterSummary(),
      },
      policy: {
        version: this.state.policy?.policyVersion ?? null,
        leasePresent: Boolean(this.state.policy?.policyLeaseId),
        leaseIssuedAt: this.state.policy?.policyLeaseIssuedAt ?? null,
        leaseExpiresAt: this.state.policy?.policyLeaseExpiresAt ?? null,
        scheduleTimeZone: this.state.policy?.scheduleTimeZone ?? null,
        scheduleTimeZoneState:
          this.state.policy?.scheduleTimeZoneState ?? null,
        workHoursOnly: this.state.policy?.workHoursOnly ?? null,
        workdayStart: this.state.policy?.workdayStart ?? null,
        workdayEnd: this.state.policy?.workdayEnd ?? null,
        collectAppFocus: this.state.policy?.collectAppFocus ?? null,
        collectOpenRuntime: this.state.policy?.collectOpenRuntime ?? null,
        allowedUtcWindows:
          this.state.policy?.allowedUtcWindows.map((window) => ({
            startsAt: window.startsAt,
            endsAt: window.endsAt,
          })) ?? [],
        acknowledgementState:
          this.state.policy?.acknowledgementState ?? null,
      },
      snapshot: {
        localState: this.state.latestSnapshot?.state ?? null,
        localObservedAt: this.state.latestSnapshot?.lastObservedAt ?? null,
        syncStatus: snapshotDiagnosticStatus(
          this.state.latestSnapshot,
          this.state.lastSnapshotSyncStatus,
        ),
        lastServerResult: this.state.lastSnapshotSyncStatus,
      },
      intervalUpload: this.state.lastIntervalUploadStatus,
      lastSuccessfulSyncAt: this.state.lastSuccessfulSyncAt,
      lastSuccessfulHeartbeatAt: this.state.lastSuccessfulHeartbeatAt,
      lastSyncDiagnostic: this.state.lastSyncDiagnostic,
      recentSyncFailures: this.state.recentSyncFailures,
    };
  }

  getUiStatus(): AgentStatus {
    const stats = this.store.stats();
    return buildDesktopAgentUiStatusV2({
      deviceId: this.config.deviceId,
      runtimeState: this.state,
      connectionState: this.connectionState,
      collectorState: this.collectorState,
      policySetupMessage: this.policySetupMessage,
      queuePending: stats.pending,
      queuedStatusEvents: this.statusQueue.size(),
      queuedLegacyEvents: this.legacyQueue.size(),
      error: this.uiError,
    });
  }

  exportDiagnostics(filePath: string) {
    return this.diagnosticLog.exportBundle(filePath, this.getDiagnosticsBundle());
  }

  getDiagnosticsDirectory() {
    return this.diagnosticLog.getDirectory();
  }

  async shutdown(reason: ShutdownReason = "USER_STOP") {
    this.shutdownReason = reason;
    this.stopped = true;
    this.clearScheduledSyncRetry();
    if (this.runPromise) return this.runPromise;
    await this.initializeQueues();
    await this.finalize();
  }

  async reportDeviceStatus(
    status: DeviceStatusName,
    reason: DeviceStatusReason,
    metadata?: { operation?: string; networkState?: string; agentVersion?: string },
  ) {
    const observedAtMonotonicMs = currentMonotonic(this);
    await this.enqueueRuntimeMutation(async () => {
      if (status === "SLEEPING" || status === "LOCKED" || status === "DEVICE_SHUTDOWN") {
        await this.enqueueHostBoundary(observedAtMonotonicMs, true);
      }
      await this.enqueueLifecycle(status, reason, metadata);
    });
    await this.flushStatusQueue();
  }

  private async runLoop() {
    await this.initializeQueues();
    await this.diagnosticLog.write({
      operation: "lifecycle",
      outcome: "starting",
      queuePending: this.store.stats().pending,
    });
    await this.updateUiStatus();
    try {
      let activated = false;
      while (!this.stopped && !activated) {
        activated = await this.ensureProtocolV2();
        if (!activated && !this.stopped) await this.waitForActivationRetry();
      }
      if (!activated) return;
      await this.closeRecoveredV2Tail();
      this.startHost();
      await this.enqueueLifecycle("RUNNING", "AGENT_STARTED", {
        operation: "protocol-v2-start",
        agentVersion: this.config.agentVersion,
      });
      await this.flushStatusQueue();
      await this.diagnosticLog.write({
        operation: "lifecycle",
        outcome: "started",
        policyVersion: this.state.policy?.policyVersion ?? null,
        policyLeaseExpiresAt: this.state.policy?.policyLeaseExpiresAt ?? null,
      });

      while (!this.stopped) {
        await delay(1_000);
        const monotonicMs = currentMonotonic(this);
        if (monotonicMs !== null) {
          await this.enqueueRuntimeMutation(() => this.tick(monotonicMs));
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
      const policy = await getTrackingPolicyV2(this.config);
      this.applyServerClock(policy.serverTime);
      this.state = { ...this.state, policy };
      this.store.writeRuntimeState(this.state);
      const policyRequirement = describeDesktopPolicyRequirement(policy);
      if (policyRequirement) {
        this.connectionState = "ONLINE";
        this.collectorState = "PAUSED";
        this.lastErrorCode = "POLICY_UNAVAILABLE";
        this.policySetupMessage = policyRequirement;
        this.state = { ...this.state, lastErrorCode: this.lastErrorCode };
        this.store.writeRuntimeState(this.state);
        await this.updateUiStatus(policyRequirement);
        return false;
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
      this.policySetupMessage = null;
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
    const policy = this.state.policy;
    if (policy && this.state.clock && this.state.engineCheckpoint) {
      const decision = recoveredTailPolicyDecisionV2({
        recoveredPolicy: this.recoveredPolicy,
        stream: "FOCUS",
        clock: this.state.clock,
        ranges: focusRecoveryRangesV2(this.state.engineCheckpoint),
      });
      if (decision.recover) {
        const recoveredEngine = new DesktopFocusEngineV2(
          this.state.clock,
          this.recoveredPolicy!,
          this.state.engineCheckpoint,
        );
        const boundary = this.state.engineCheckpoint.lastObservedAtMonotonicMs;
        const update = recoveredEngine.clearFocus(boundary);
        this.state = {
          ...this.state,
          engineCheckpoint: recoveredEngine.checkpoint(),
          focusTimelineThroughAt: latestTimelineThroughAtV2(
            this.state.focusTimelineThroughAt,
            update.intervals,
            "FOCUS",
          ),
          latestSnapshot: update.snapshot,
        };
        this.store.persistEngineUpdate(update.intervals, this.state, update.snapshot);
      } else {
        await this.logDiscardedRecoveredTail("FOCUS", decision.reasonCode);
      }
    }
    if (
      this.recoveredPolicy?.collectOpenRuntime &&
      this.state.openRuntimeClock &&
      this.state.openRuntimeCheckpoint
    ) {
      const decision = recoveredTailPolicyDecisionV2({
        recoveredPolicy: this.recoveredPolicy,
        stream: "OPEN_RUNTIME",
        clock: this.state.openRuntimeClock,
        ranges: openRuntimeRecoveryRangesV2(this.state.openRuntimeCheckpoint),
      });
      if (decision.recover) {
        const recoveredRuntime = new DesktopOpenRuntimeEngineV2(
          this.state.openRuntimeClock,
          this.recoveredPolicy!,
          this.state.openRuntimeCheckpoint,
        );
        const boundary = this.state.openRuntimeCheckpoint.lastObservedAtMonotonicMs;
        const update = recoveredRuntime.clear(boundary);
        this.state = {
          ...this.state,
          openRuntimeCheckpoint: recoveredRuntime.checkpoint(),
          openRuntimeTimelineThroughAt: latestTimelineThroughAtV2(
            this.state.openRuntimeTimelineThroughAt,
            update.intervals,
            "OPEN_RUNTIME",
          ),
        };
        this.store.persistRuntimeUpdate(update.intervals, this.state);
      } else {
        await this.logDiscardedRecoveredTail(
          "OPEN_RUNTIME",
          decision.reasonCode,
        );
      }
    }
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      openRuntimeClock: null,
      openRuntimeCheckpoint: null,
      latestSnapshot: null,
    };
    this.store.writeRuntimeState(this.state);
  }

  private logDiscardedRecoveredTail(
    stream: DesktopTimelineStreamV2,
    reasonCode: string | null,
  ) {
    return this.diagnosticLog.write({
      operation: "policy",
      outcome: "recovery-tail-discarded",
      reasonCode,
      reasonMessage: `An unconfirmed ${stream} recovery tail could not be verified against its original authorised policy lease and was not queued.`,
      retryable: false,
      policyVersion: this.state.policy?.policyVersion ?? null,
      policyLeaseExpiresAt: this.state.policy?.policyLeaseExpiresAt ?? null,
    });
  }

  private startHost() {
    this.host.start((event) => {
      // Anchor the helper clock when stdout delivers the event, before any
      // earlier HTTP-bound event finishes on the serialized processing lane.
      // Updating this offset only when processing begins makes an old queued
      // event look current and recreates overlapping UTC projections.
      this.latestHostMonotonicMs = Math.max(
        this.latestHostMonotonicMs ?? 0,
        event.monotonicMs,
      );
      this.helperToNodeMonotonicOffsetMs =
        event.monotonicMs - performance.now();
      void this.enqueueRuntimeMutation(() => this.processHostEvent(event));
    });
  }

  private enqueueRuntimeMutation(operation: () => Promise<void>) {
    this.eventChain = this.eventChain
      .then(operation)
      .catch((error) => this.applyFailure(error));
    return this.eventChain;
  }

  private async processHostEvent(event: WindowsActivityHostEventV2) {
    if (event.eventType === "foreground_changed") {
      if (this.eventPredatesTimeline(event.monotonicMs, "FOCUS")) return;
      this.currentHostApp = event.app;
      if (!event.app) {
        await this.clearForegroundFocus(event.monotonicMs, true);
      } else if (this.focusCaptureAllowedAt(event.monotonicMs)) {
        this.ensureEngine(event.monotonicMs);
        await this.persistUpdate(
          this.engine!.acquireFocus(event.app, event.monotonicMs),
          true,
        );
      }
      return;
    }
    if (event.eventType === "visible_apps_changed") {
      if (this.eventPredatesTimeline(event.monotonicMs, "OPEN_RUNTIME")) return;
      this.currentVisibleApps = event.apps;
      if (this.openRuntimeCaptureAllowedAt(event.monotonicMs)) {
        if (event.apps.length === 0 && !this.openRuntimeEngine) return;
        this.ensureOpenRuntimeEngine(event.monotonicMs);
        await this.persistOpenRuntimeUpdate(
          this.openRuntimeEngine!.observeVisibleApps(
            event.apps,
            event.monotonicMs,
          ),
          true,
        );
      }
      return;
    }
    if (event.eventType === "interaction_pulse") {
      if (this.eventPredatesTimeline(event.monotonicMs, "FOCUS")) return;
      if (this.engine && this.currentHostApp && this.focusCaptureAllowedAt(event.monotonicMs)) {
        // Input can arrive up to ten times per second. It must advance the
        // durable local clock precisely, but waiting for one HTTP round trip
        // per pulse makes the serialized host-event lane fall progressively
        // behind real time on a normal network. The regular health cadence,
        // settlements, and foreground transitions still trigger sync.
        await this.persistUpdate(
          this.engine.recordSessionInput(event.monotonicMs),
          shouldImmediatelySyncHostEventV2(event.eventType),
        );
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
      this.currentVisibleApps = [];
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
      await this.diagnosticLog.write({
        operation: "native-host",
        outcome: event.state.toLowerCase(),
        reasonCode: event.errorCode ?? null,
        reasonMessage: event.detail ?? null,
        queuePending: this.store.stats().pending,
      });
      await this.requestSync();
    }
  }

  private async tick(monotonicMs: number) {
    const nowMs = Date.now();
    if (nowMs - this.lastPolicyRefreshAtMs >= DESKTOP_V2_POLICY_REFRESH_MS) {
      await this.refreshPolicy(monotonicMs);
    }
    const focusAllowed = this.focusCaptureAllowedAt(monotonicMs);
    const openRuntimeAllowed = this.openRuntimeCaptureAllowedAt(monotonicMs);
    if (!focusAllowed && !openRuntimeAllowed) {
      await this.enqueueHostBoundary(monotonicMs, false);
    } else {
      if (
        focusAllowed &&
        this.currentHostApp &&
        !this.engine
      ) {
        this.ensureEngine(monotonicMs);
        await this.persistUpdate(
          this.engine!.acquireFocus(this.currentHostApp, monotonicMs),
          true,
        );
      } else if (this.engine && focusAllowed) {
        const shouldSettle =
          nowMs - this.lastSettlementAtMs >= DESKTOP_V2_SETTLEMENT_MS;
        await this.persistUpdate(
          shouldSettle
            ? this.engine.settle(monotonicMs)
            : this.engine.observe(monotonicMs),
          shouldSettle,
        );
        if (shouldSettle) this.lastSettlementAtMs = nowMs;
      } else if (this.engine) {
        await this.closeFocusTimeline(monotonicMs);
      }

      if (
        openRuntimeAllowed &&
        this.currentVisibleApps.length > 0 &&
        !this.openRuntimeEngine
      ) {
        this.ensureOpenRuntimeEngine(monotonicMs);
        await this.persistOpenRuntimeUpdate(
          this.openRuntimeEngine!.observeVisibleApps(
            this.currentVisibleApps,
            monotonicMs,
          ),
          false,
        );
      } else if (this.openRuntimeEngine && openRuntimeAllowed) {
        const shouldSettle =
          nowMs - this.lastOpenRuntimeSettlementAtMs >=
          DESKTOP_V2_SETTLEMENT_MS;
        if (shouldSettle) {
          await this.persistOpenRuntimeUpdate(
            this.openRuntimeEngine.settle(monotonicMs),
            true,
          );
          this.lastOpenRuntimeSettlementAtMs = nowMs;
        }
      } else if (this.openRuntimeEngine) {
        await this.closeOpenRuntimeTimeline(monotonicMs);
      }
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
    this.state.clock = this.createClockEpoch(atMonotonicMs, "FOCUS");
    this.engine = new DesktopFocusEngineV2(this.state.clock, policy);
  }

  private ensureOpenRuntimeEngine(atMonotonicMs: number) {
    if (this.openRuntimeEngine) return;
    const policy = this.state.policy;
    if (!policy?.policyLeaseId || !policy.collectOpenRuntime) {
      throw new Error("An authorised App open/runtime policy lease is required.");
    }
    this.state.openRuntimeClock = this.createClockEpoch(
      atMonotonicMs,
      "OPEN_RUNTIME",
    );
    this.openRuntimeEngine = new DesktopOpenRuntimeEngineV2(
      this.state.openRuntimeClock,
      policy,
    );
  }

  private createClockEpoch(
    atMonotonicMs: number,
    stream: DesktopTimelineStreamV2,
  ) {
    const current = currentMonotonic(this) ?? atMonotonicMs;
    const activationMs = Date.parse(this.state.protocolActivatedAt ?? "");
    const projectedEventUtcMs = eventClockAnchorUtcMsV2({
      serverNowMs: serverNow(this.state),
      currentMonotonicMs: current,
      eventMonotonicMs: atMonotonicMs,
      protocolActivatedAtMs:
        Number.isFinite(activationMs) ? activationMs : 0,
    });
    const watermarkMs = this.timelineWatermarkMs(stream);
    const leaseIssuedAtMs = Date.parse(
      this.state.policy?.policyLeaseIssuedAt ?? "",
    );
    const activeWindow = this.state.policy?.allowedUtcWindows.find(
      (window) =>
        Date.parse(window.startsAt) <= projectedEventUtcMs &&
        projectedEventUtcMs < Date.parse(window.endsAt),
    );
    const anchorUtcMs = Math.max(
      projectedEventUtcMs,
      watermarkMs ?? 0,
      Number.isFinite(leaseIssuedAtMs) ? leaseIssuedAtMs : 0,
      activeWindow ? Date.parse(activeWindow.startsAt) : 0,
    );
    return {
      clockEpochId: randomUUID(),
      clockEpochStartedAt: new Date(anchorUtcMs).toISOString(),
      clockEpochStartedMonotonicMs: atMonotonicMs,
    };
  }

  private async persistUpdate(
    update: DesktopFocusEngineUpdateV2,
    immediateSync: boolean,
    syncWhenIntervals = true,
  ) {
    if (!this.engine) return false;
    const durableState = this.state;
    const nextState: DesktopTrackingRuntimeStateV2 = {
      ...durableState,
      engineCheckpoint: this.engine.checkpoint(),
      focusTimelineThroughAt: latestTimelineThroughAtV2(
        durableState.focusTimelineThroughAt,
        update.intervals,
        "FOCUS",
      ),
      latestSnapshot: update.snapshot,
      lastErrorCode: this.lastErrorCode,
    };
    try {
      this.store.persistEngineUpdate(update.intervals, nextState, update.snapshot);
      this.state = nextState;
    } catch (error) {
      if (error instanceof V2QueuePressureError) {
        await this.pauseForQueuePressure(durableState, error);
        return false;
      } else {
        throw error;
      }
    }
    await this.updateUiStatus();
    if (immediateSync || (syncWhenIntervals && update.intervals.length > 0)) {
      await this.requestSync();
    }
    return true;
  }

  private async persistOpenRuntimeUpdate(
    update: DesktopOpenRuntimeEngineUpdateV2,
    immediateSync: boolean,
    syncWhenIntervals = true,
  ) {
    if (!this.openRuntimeEngine) return false;
    const durableState = this.state;
    const nextState: DesktopTrackingRuntimeStateV2 = {
      ...durableState,
      openRuntimeCheckpoint: this.openRuntimeEngine.checkpoint(),
      openRuntimeTimelineThroughAt: latestTimelineThroughAtV2(
        durableState.openRuntimeTimelineThroughAt,
        update.intervals,
        "OPEN_RUNTIME",
      ),
      lastErrorCode: this.lastErrorCode,
    };
    try {
      this.store.persistRuntimeUpdate(update.intervals, nextState);
      this.state = nextState;
    } catch (error) {
      if (error instanceof V2QueuePressureError) {
        await this.pauseForQueuePressure(durableState, error);
        return false;
      }
      throw error;
    }
    await this.updateUiStatus();
    if (immediateSync || (syncWhenIntervals && update.intervals.length > 0)) {
      await this.requestSync();
    }
    return true;
  }

  private async pauseForQueuePressure(
    durableState: DesktopTrackingRuntimeStateV2,
    error: V2QueuePressureError,
  ) {
    this.collectorState = "PAUSED";
    this.lastErrorCode = "QUEUE_PRESSURE";
    this.engine = null;
    this.openRuntimeEngine = null;
    this.state = {
      ...durableState,
      clock: null,
      engineCheckpoint: null,
      openRuntimeClock: null,
      openRuntimeCheckpoint: null,
      latestSnapshot: null,
      lastErrorCode: "QUEUE_PRESSURE",
    };
    this.store.writeRuntimeState(this.state);
    await this.updateUiStatus(error.message);
    await this.requestSync();
  }

  private async clearForegroundFocus(
    monotonicMs: number,
    immediateSync: boolean,
  ) {
    if (!this.engine) return;
    const boundary = this.boundaryMonotonicMs(monotonicMs, "FOCUS");
    if (boundary === null) return;
    // A transient null foreground identity ends the current Focus segment but
    // does not create a new clock epoch. Keeping the same monotonic projection
    // prevents network-delayed foreground events from overlapping prior time.
    const update = this.engine.clearFocus(boundary);
    const snapshotAllowed = this.focusSnapshotAllowedAtBoundary(boundary);
    const persisted = await this.persistUpdate(update, false, false);
    if (!persisted) return;
    if (!snapshotAllowed) {
      this.state = { ...this.state, latestSnapshot: null };
      this.store.writeRuntimeState(this.state);
    }
    if (immediateSync || update.intervals.length > 0) await this.requestSync();
  }

  private async enqueueHostBoundary(
    monotonicMs: number | null,
    immediateSync: boolean,
    syncWhenIntervals = true,
  ) {
    if (monotonicMs === null) return;
    let createdIntervals = false;
    let closedFocus = false;
    let closedOpenRuntime = false;
    let retainFocusSnapshot = true;
    if (this.engine) {
      const boundary = this.boundaryMonotonicMs(monotonicMs, "FOCUS");
      if (boundary !== null) {
        const update = this.engine.clearFocus(boundary);
        const persisted = await this.persistUpdate(update, false, false);
        if (!persisted) return;
        createdIntervals ||= update.intervals.length > 0;
        closedFocus = true;
        retainFocusSnapshot = this.focusSnapshotAllowedAtBoundary(boundary);
      }
    }
    if (this.openRuntimeEngine) {
      const boundary = this.boundaryMonotonicMs(
        monotonicMs,
        "OPEN_RUNTIME",
      );
      if (boundary !== null) {
        const update = this.openRuntimeEngine.clear(boundary);
        const persisted = await this.persistOpenRuntimeUpdate(
          update,
          false,
          false,
        );
        if (!persisted) return;
        createdIntervals ||= update.intervals.length > 0;
        closedOpenRuntime = true;
      }
    }
    if (!closedFocus && !closedOpenRuntime) return;
    if (closedFocus) this.engine = null;
    if (closedOpenRuntime) this.openRuntimeEngine = null;
    this.state = {
      ...this.state,
      ...(closedFocus ? { clock: null, engineCheckpoint: null } : {}),
      ...(closedFocus && !retainFocusSnapshot ? { latestSnapshot: null } : {}),
      ...(closedOpenRuntime
        ? { openRuntimeClock: null, openRuntimeCheckpoint: null }
        : {}),
    };
    this.store.writeRuntimeState(this.state);
    if (immediateSync || (syncWhenIntervals && createdIntervals)) {
      await this.requestSync();
    }
  }

  private async closeFocusTimeline(monotonicMs: number) {
    if (!this.engine) return;
    const boundary = this.boundaryMonotonicMs(monotonicMs, "FOCUS");
    if (boundary === null) return;
    const update = this.engine.clearFocus(boundary);
    const retainSnapshot = this.focusSnapshotAllowedAtBoundary(boundary);
    const persisted = await this.persistUpdate(update, false, false);
    if (!persisted) return;
    this.engine = null;
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      latestSnapshot: retainSnapshot ? update.snapshot : null,
    };
    this.store.writeRuntimeState(this.state);
    if (update.intervals.length > 0) await this.requestSync();
  }

  private async closeOpenRuntimeTimeline(monotonicMs: number) {
    if (!this.openRuntimeEngine) return;
    const boundary = this.boundaryMonotonicMs(
      monotonicMs,
      "OPEN_RUNTIME",
    );
    if (boundary === null) return;
    const update = this.openRuntimeEngine.clear(boundary);
    const persisted = await this.persistOpenRuntimeUpdate(
      update,
      false,
      false,
    );
    if (!persisted) return;
    this.openRuntimeEngine = null;
    this.state = {
      ...this.state,
      openRuntimeClock: null,
      openRuntimeCheckpoint: null,
    };
    this.store.writeRuntimeState(this.state);
    if (update.intervals.length > 0) await this.requestSync();
  }

  private async requestSync() {
    if (!this.state.protocolActivatedAt) return;
    if (this.connectionState === "AUTH_REQUIRED" || this.connectionState === "UPGRADE_REQUIRED") return;
    if (Date.now() < this.syncRetryNotBeforeMs) {
      this.syncAgain = true;
      this.scheduleSyncRetry();
      return;
    }
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
    const startedAtMs = Date.now();
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
    const requestId = randomUUID();
    const attemptedAt = new Date(serverNow(this.state)).toISOString();
    await this.diagnosticLog.write({
      operation: "sync-v2",
      outcome: "attempted",
      requestId,
      intervalCount: intervals.length,
      snapshotState: request.focusSnapshot?.state ?? null,
      queuePending: this.store.stats().pending,
      policyVersion: this.state.policy?.policyVersion ?? null,
      policyLeaseExpiresAt: this.state.policy?.policyLeaseExpiresAt ?? null,
    });
    try {
      const response = await syncTrackingV2(this.config, request, requestId);
      this.applyServerClock(response.serverTime);
      const snapshotResult = response.focusSnapshotResult ?? null;
      const intervalRejectionCodes = summarizeIntervalRejections(
        response.results,
      );
      const intervalRejected = intervalRejectionCodes.reduce(
        (total, item) => total + item.count,
        0,
      );
      const syncHasWarning = shouldRecordConfirmedSyncWarningV2(
        snapshotResult,
        intervalRejected,
      );
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
      this.resetSyncBackoff();
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
      const snapshotSyncStatus = request.focusSnapshot && snapshotResult
        ? {
            status:
              snapshotResult.status === "ACCEPTED"
                ? "CONFIRMED" as const
                : "REJECTED" as const,
            requestId: response.requestId ?? requestId,
            completedAt: syncedAt,
            snapshotState: request.focusSnapshot.state,
            observedAt: request.focusSnapshot.lastObservedAt,
            reasonCode:
              snapshotResult.status === "REJECTED"
                ? snapshotResult.rejectionCode
                : null,
          }
        : this.state.lastSnapshotSyncStatus;
      const intervalUploadStatus = intervals.length > 0
        ? {
            status:
              response.results.some((result) => result.status === "REJECTED")
                ? "CONFIRMED_WITH_REJECTIONS" as const
                : "CONFIRMED" as const,
            requestId: response.requestId ?? requestId,
            completedAt: syncedAt,
            accepted: response.results.filter(
              (result) => result.status === "ACCEPTED",
            ).length,
            duplicate: response.results.filter(
              (result) => result.status === "DUPLICATE",
            ).length,
            rejected: response.results.filter(
              (result) => result.status === "REJECTED",
            ).length,
            latestAcceptedEndedAt: latestCursorAcceptedAt(response.cursors),
          }
        : this.state.lastIntervalUploadStatus;
      const syncDiagnostic: TrackingSyncDiagnosticV2 = {
        requestId: response.requestId ?? requestId,
        attemptedAt,
        completedAt: syncedAt,
        intervalCount: intervals.length,
        httpStatus: 200,
        errorCode:
          intervalRejected > 0
            ? intervalRejectionCodes.length === 1
              ? intervalRejectionCodes[0]!.code
              : "INTERVAL_REJECTED"
            : snapshotResult?.status === "REJECTED"
              ? snapshotResult.rejectionCode
              : null,
        errorMessage:
          intervalRejected > 0
            ? intervalRejectionMessage(intervalRejectionCodes)
            : snapshotResult?.status === "REJECTED"
              ? snapshotResult.message
              : null,
        remediation:
          intervalRejected > 0
            ? intervalRejectionRemediation(intervalRejectionCodes)
            : snapshotResult?.status === "REJECTED"
              ? snapshotRejectionRemediation(snapshotResult.rejectionCode)
              : null,
        retryable:
          intervalRejected > 0
            ? intervalRejectionCodes.some((item) => !item.terminal)
            : snapshotResult?.status === "REJECTED"
              ? snapshotRejectionRetryable(snapshotResult.rejectionCode)
              : null,
        failureStage:
          intervalRejected > 0
            ? "interval"
            : snapshotResult?.status === "REJECTED"
              ? "policy"
              : null,
        intervalRejected,
        intervalRejectionCodes,
        outcome:
          syncHasWarning
            ? "CONFIRMED_WITH_WARNING"
            : "CONFIRMED",
      };
      this.state = {
        ...this.state,
        focusTimelineThroughAt: latestIsoTimestampV2(
          this.state.focusTimelineThroughAt,
          latestCursorAcceptedAt(
            response.cursors.filter((cursor) => cursor.stream === "FOCUS"),
          ),
        ),
        openRuntimeTimelineThroughAt: latestIsoTimestampV2(
          this.state.openRuntimeTimelineThroughAt,
          latestCursorAcceptedAt(
            response.cursors.filter(
              (cursor) => cursor.stream === "OPEN_RUNTIME",
            ),
          ),
        ),
        lastSuccessfulSyncAt: syncedAt,
        lastSuccessfulHeartbeatAt: syncedAt,
        lastErrorCode: "NONE",
        lastSyncDiagnostic: syncDiagnostic,
        recentSyncFailures:
          syncHasWarning
            ? prependDiagnostic(this.state.recentSyncFailures, syncDiagnostic)
            : this.state.recentSyncFailures,
        lastSnapshotSyncStatus: snapshotSyncStatus,
        lastIntervalUploadStatus: intervalUploadStatus,
      };
      this.store.writeRuntimeState(this.state);
      await this.diagnosticLog.write({
        operation: "sync-v2",
        outcome:
          syncHasWarning
            ? "confirmed-with-warning"
            : "confirmed",
        requestId: response.requestId ?? requestId,
        intervalCount: intervals.length,
        snapshotState: request.focusSnapshot?.state ?? null,
        queuePending: this.store.stats().pending,
        queueDeadLetter: this.store.stats().deadLetter,
        httpStatus: 200,
        reasonCode:
          syncDiagnostic.errorCode,
        reasonMessage:
          syncDiagnostic.errorMessage,
        remediation:
          syncDiagnostic.remediation,
        retryable:
          syncDiagnostic.retryable,
        intervalRejected,
        intervalRejectionCodes,
        durationMs: Date.now() - startedAtMs,
      });
      if (snapshotResult?.status === "REJECTED") {
        await this.recoverRejectedSnapshot(snapshotResult.rejectionCode);
      }
    } catch (error) {
      const legacySnapshotPolicyFailure = isLegacySnapshotPolicyFailure(
        error,
        request.focusSnapshot !== undefined,
      );
      const diagnostic: TrackingSyncDiagnosticV2 = {
        requestId: error instanceof AgentApiError ? error.requestId ?? requestId : requestId,
        attemptedAt,
        completedAt: new Date(serverNow(this.state)).toISOString(),
        intervalCount: intervals.length,
        httpStatus: error instanceof AgentApiError ? error.status ?? null : null,
        errorCode: syncFailureCode(error),
        errorMessage: syncFailureMessage(error),
        remediation: syncFailureRemediation(error),
        retryable: syncFailureRetryable(error),
        failureStage: error instanceof AgentApiError ? error.responseStage ?? null : null,
        outcome: "FAILED",
      };
      this.recordSyncFailure(diagnostic);
      await this.diagnosticLog.write({
        operation: "sync-v2",
        outcome: "failed",
        requestId: diagnostic.requestId,
        intervalCount: intervals.length,
        snapshotState: request.focusSnapshot?.state ?? null,
        queuePending: this.store.stats().pending,
        queueDeadLetter: this.store.stats().deadLetter,
        httpStatus: diagnostic.httpStatus,
        reasonCode: diagnostic.errorCode,
        reasonMessage: diagnostic.errorMessage,
        remediation: diagnostic.remediation,
        retryable: diagnostic.retryable,
        retryAt: this.store.stats().nextRetryAt,
        durationMs: Date.now() - startedAtMs,
      });
      const ids = intervals.map((interval) => interval.clientEventId);
      if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
        this.connectionState = "AUTH_REQUIRED";
      } else if (isUpgradeRequiredError(error)) {
        this.connectionState = "UPGRADE_REQUIRED";
        this.lastErrorCode = "UPGRADE_REQUIRED";
      } else if (legacySnapshotPolicyFailure) {
        this.store.retry(
          ids,
          Date.now(),
          error instanceof AgentApiError ? error.retryAfterMs : undefined,
        );
        this.connectionState = "ONLINE";
        await this.recoverRejectedSnapshot("SNAPSHOT_POLICY_LEASE_INVALID");
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
        this.deferRetryableSync(error);
        this.connectionState = "OFFLINE";
      }
      if (!legacySnapshotPolicyFailure) await this.applyFailure(error, false);
    }
    await this.updateUiStatus();
  }

  private deferRetryableSync(error: unknown) {
    this.consecutiveRetryableSyncFailures += 1;
    const retryAfterMs =
      error instanceof AgentApiError ? error.retryAfterMs ?? 0 : 0;
    const localDelayMs = trackingSyncBackoffDelayV2(
      this.consecutiveRetryableSyncFailures,
    );
    this.syncRetryNotBeforeMs = Math.max(
      this.syncRetryNotBeforeMs,
      Date.now() + Math.max(retryAfterMs, localDelayMs),
    );
    this.scheduleSyncRetry();
  }

  private resetSyncBackoff() {
    this.consecutiveRetryableSyncFailures = 0;
    this.syncRetryNotBeforeMs = 0;
    this.clearScheduledSyncRetry();
  }

  private scheduleSyncRetry() {
    if (this.stopped || this.syncRetryTimer) return;
    const delayMs = Math.max(0, this.syncRetryNotBeforeMs - Date.now());
    this.syncRetryTimer = setTimeout(() => {
      this.syncRetryTimer = null;
      this.syncAgain = false;
      void this.requestSync();
    }, delayMs);
    this.syncRetryTimer.unref();
  }

  private clearScheduledSyncRetry() {
    if (this.syncRetryTimer) clearTimeout(this.syncRetryTimer);
    this.syncRetryTimer = null;
  }

  private recordSyncFailure(diagnostic: TrackingSyncDiagnosticV2) {
    this.state = {
      ...this.state,
      lastSyncDiagnostic: diagnostic,
      recentSyncFailures: [
        diagnostic,
        ...this.state.recentSyncFailures.filter(
          (existing) => existing.requestId !== diagnostic.requestId,
        ),
      ].slice(0, 10),
    };
    this.store.writeRuntimeState(this.state);
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

  private async refreshPolicy(monotonicMs: number, deferSync = false) {
    this.lastPolicyRefreshAtMs = Date.now();
    try {
      const next = await getTrackingPolicyV2(this.config);
      this.applyServerClock(next.serverTime);
      const changed =
        next.policyVersion !== this.state.policy?.policyVersion ||
        next.policyLeaseId !== this.state.policy?.policyLeaseId;
      if (changed) {
        await this.enqueueHostBoundary(
          monotonicMs,
          !deferSync,
          !deferSync,
        );
        this.state = {
          ...this.state,
          policy: next,
          clock: null,
          engineCheckpoint: null,
          openRuntimeClock: null,
          openRuntimeCheckpoint: null,
          latestSnapshot: null,
        };
      } else {
        this.state = { ...this.state, policy: next };
      }
      this.collectorState = policyCollectorState(next, serverNow(this.state));
      this.store.writeRuntimeState(this.state);
      await this.diagnosticLog.write({
        operation: "policy",
        outcome: changed ? "refreshed" : "confirmed",
        policyVersion: next.policyVersion,
        policyLeaseExpiresAt: next.policyLeaseExpiresAt,
        reasonCode: changed ? "POLICY_LEASE_CHANGED" : null,
      });
    } catch (error) {
      if (!this.state.policy || !policyLeaseValid(this.state.policy, serverNow(this.state))) {
        this.collectorState = "PAUSED";
        this.lastErrorCode = "POLICY_UNAVAILABLE";
        await this.enqueueHostBoundary(
          monotonicMs,
          !deferSync,
          !deferSync,
        );
      }
      await this.applyFailure(error, false);
    }
  }

  private focusCaptureAllowedAt(monotonicMs: number) {
    const policy = this.state.policy;
    if (
      !policy ||
      this.collectorState !== "HEALTHY" ||
      !policy.collectAppFocus ||
      !policy.policyLeaseId
    ) {
      return false;
    }
    return this.policyWindowAllowsAt(monotonicMs, "FOCUS");
  }

  private openRuntimeCaptureAllowedAt(monotonicMs: number) {
    const policy = this.state.policy;
    if (
      !policy ||
      this.collectorState !== "HEALTHY" ||
      !policy.collectOpenRuntime ||
      !policy.policyLeaseId
    ) {
      return false;
    }
    return this.policyWindowAllowsAt(monotonicMs, "OPEN_RUNTIME");
  }

  private policyWindowAllowsAt(
    monotonicMs: number,
    stream: DesktopTimelineStreamV2,
  ) {
    const policy = this.state.policy;
    if (!policy || this.collectorState !== "HEALTHY") return false;
    const instant = this.streamMonotonicToUtcMs(monotonicMs, stream);
    const watermark = this.timelineWatermarkMs(stream);
    return timelineCaptureAllowedAtV2(policy, instant, watermark);
  }

  private streamMonotonicToUtcMs(
    monotonicMs: number,
    stream: DesktopTimelineStreamV2,
  ) {
    const clock = stream === "FOCUS"
      ? this.state.clock
      : this.state.openRuntimeClock;
    if (clock) {
      return projectMonotonicUtcMsV2(clock, monotonicMs);
    }
    const current = currentMonotonic(this) ?? monotonicMs;
    return eventObservedUtcMsV2({
      serverNowMs: serverNow(this.state),
      currentMonotonicMs: current,
      eventMonotonicMs: monotonicMs,
    });
  }

  private timelineWatermarkMs(stream: DesktopTimelineStreamV2) {
    const value = stream === "FOCUS"
      ? this.state.focusTimelineThroughAt
      : this.state.openRuntimeTimelineThroughAt;
    const parsed = Date.parse(value ?? "");
    return Number.isFinite(parsed) ? parsed : null;
  }

  private eventPredatesTimeline(
    monotonicMs: number,
    stream: DesktopTimelineStreamV2,
  ) {
    const watermark = this.timelineWatermarkMs(stream);
    return watermark !== null &&
      this.streamMonotonicToUtcMs(monotonicMs, stream) < watermark;
  }

  private boundaryMonotonicMs(
    requestedMonotonicMs: number,
    stream: DesktopTimelineStreamV2,
  ) {
    const clock = stream === "FOCUS"
      ? this.state.clock
      : this.state.openRuntimeClock;
    const checkpointObservedAt = stream === "FOCUS"
      ? this.state.engineCheckpoint?.lastObservedAtMonotonicMs
      : this.state.openRuntimeCheckpoint?.lastObservedAtMonotonicMs;
    if (!clock) return requestedMonotonicMs;
    if (
      requestedMonotonicMs < clock.clockEpochStartedMonotonicMs ||
      (checkpointObservedAt !== undefined &&
        requestedMonotonicMs < checkpointObservedAt)
    ) {
      return null;
    }
    const policy = this.state.policy;
    if (!policy) return requestedMonotonicMs;
    return clampMonotonicToPolicyEndV2({
      clock,
      requestedMonotonicMs,
      policy,
    });
  }

  private focusSnapshotAllowedAtBoundary(monotonicMs: number) {
    const policy = this.state.policy;
    const clock = this.state.clock;
    if (!policy || !clock) return false;
    return timelineCaptureAllowedAtV2(
      policy,
      projectMonotonicUtcMsV2(clock, monotonicMs),
      null,
    );
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
    this.policySetupMessage = null;
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

  private async recoverRejectedSnapshot(
    reasonCode:
      | "SNAPSHOT_POLICY_LEASE_INVALID"
      | "SNAPSHOT_OBSERVATION_TIME_INVALID"
      | "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  ) {
    const monotonicMs = currentMonotonic(this);
    if (this.engine && monotonicMs !== null) {
      const boundary = this.boundaryMonotonicMs(monotonicMs, "FOCUS");
      if (boundary !== null) {
        await this.persistUpdate(
          this.engine.clearFocus(boundary),
          false,
          false,
        );
      }
    }
    this.engine = null;
    this.state = {
      ...this.state,
      clock: null,
      engineCheckpoint: null,
      latestSnapshot: null,
    };
    this.store.writeRuntimeState(this.state);
    await this.diagnosticLog.write({
      operation: "policy",
      outcome: "snapshot-reset",
      reasonCode,
      queuePending: this.store.stats().pending,
      policyVersion: this.state.policy?.policyVersion ?? null,
      policyLeaseExpiresAt: this.state.policy?.policyLeaseExpiresAt ?? null,
    });
    if (monotonicMs !== null) {
      await this.refreshPolicy(monotonicMs, true);
      this.syncAgain = true;
    }
  }

  private async updateUiStatus(error?: string) {
    this.uiError = error;
    await this.statusWriter(this.getUiStatus());
  }

  private async waitForActivationRetry() {
    for (let second = 0; second < 30 && !this.stopped; second += 1) {
      await delay(1_000);
    }
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
    if ((this.engine || this.openRuntimeEngine) && monotonicMs !== null) {
      await this.enqueueHostBoundary(monotonicMs, true);
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
    await this.diagnosticLog.write({
      operation: "lifecycle",
      outcome: "stopped",
      reasonCode: this.shutdownReason ?? "UNKNOWN_INTERRUPTED",
      queuePending: this.store.stats().pending,
    });
    this.store.close();
  }
}

export function buildDesktopAgentUiStatusV2(input: {
  deviceId: string;
  runtimeState: DesktopTrackingRuntimeStateV2;
  connectionState: TrackingConnectionStateV2;
  collectorState: TrackingCollectorStateV2;
  policySetupMessage: string | null;
  queuePending: number;
  queuedStatusEvents: number;
  queuedLegacyEvents: number;
  error?: string;
}): AgentStatus {
  const snapshot = input.runtimeState.latestSnapshot;
  const state: AgentStatus["state"] = input.policySetupMessage
    ? "policy_required"
    : input.connectionState === "ONLINE"
      ? input.collectorState === "PAUSED"
        ? "paused"
        : "connected"
      : input.connectionState === "AUTH_REQUIRED"
        ? "auth_required"
        : input.connectionState === "UPGRADE_REQUIRED"
          ? "upgrade_required"
          : input.connectionState === "ERROR"
            ? "error"
            : "offline";
  return {
    state,
    deviceId: input.deviceId,
    lastHeartbeatAt:
      input.runtimeState.lastSuccessfulHeartbeatAt ?? undefined,
    lastUploadAt: input.runtimeState.lastSuccessfulSyncAt ?? undefined,
    serverOffsetMs: input.runtimeState.serverOffsetMs,
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
    // Keep the durable v2 queue separate from retained v1 compatibility
    // records. Mixing the counts made an old queue.json look like a v2 sync
    // failure in the desktop UI.
    queuedEvents: input.queuePending,
    queuedStatusEvents: input.queuedStatusEvents,
    queuedLegacyEvents: input.queuedLegacyEvents,
    trackingMigrationState: input.runtimeState.migrationState,
    lastSyncDiagnostic: input.runtimeState.lastSyncDiagnostic,
    recentSyncFailureCount: input.runtimeState.recentSyncFailures.length,
    error: input.error,
  };
}

export function shouldImmediatelySyncHostEventV2(
  eventType: WindowsActivityHostEventV2["eventType"],
) {
  return eventType !== "interaction_pulse";
}

export function trackingSyncBackoffDelayV2(consecutiveFailures: number) {
  const scheduleMs = [5_000, 15_000, 30_000, 60_000] as const;
  const index = Math.max(
    0,
    Math.min(Math.floor(consecutiveFailures) - 1, scheduleMs.length - 1),
  );
  return scheduleMs[index] ?? scheduleMs[0];
}

export function eventClockAnchorUtcMsV2(input: {
  serverNowMs: number;
  currentMonotonicMs: number;
  eventMonotonicMs: number;
  protocolActivatedAtMs: number;
}) {
  return Math.max(
    eventObservedUtcMsV2(input),
    input.protocolActivatedAtMs,
  );
}

type RecoveredTailRangeV2 = {
  startsAtMonotonicMs: number;
  endsAtMonotonicMs: number;
};

export function recoveredTailPolicyDecisionV2(input: {
  recoveredPolicy: DeviceTrackingPolicyV2 | null;
  stream: DesktopTimelineStreamV2;
  clock: DesktopClockEpochV2;
  ranges: RecoveredTailRangeV2[];
}): { recover: true; reasonCode: null } | { recover: false; reasonCode: string } {
  const ranges = input.ranges.filter(
    (range) => range.endsAtMonotonicMs > range.startsAtMonotonicMs,
  );
  const recoveredPolicy = input.recoveredPolicy;
  if (!recoveredPolicy?.policyLeaseId) {
    return { recover: false, reasonCode: "RECOVERY_POLICY_IDENTITY_MISSING" };
  }
  if (
    (input.stream === "FOCUS" && !recoveredPolicy.collectAppFocus) ||
    (input.stream === "OPEN_RUNTIME" && !recoveredPolicy.collectOpenRuntime)
  ) {
    return { recover: false, reasonCode: "RECOVERY_STREAM_NOT_AUTHORISED" };
  }
  if (ranges.length === 0) return { recover: true, reasonCode: null };
  const leaseIssuedAtMs = Date.parse(recoveredPolicy.policyLeaseIssuedAt ?? "");
  const leaseExpiresAtMs = Date.parse(recoveredPolicy.policyLeaseExpiresAt ?? "");
  if (!Number.isFinite(leaseIssuedAtMs) || !Number.isFinite(leaseExpiresAtMs)) {
    return { recover: false, reasonCode: "RECOVERY_POLICY_LEASE_INVALID" };
  }
  const allRangesAuthorised = ranges.every((range) => {
    const startsAtMs = projectMonotonicUtcMsV2(
      input.clock,
      range.startsAtMonotonicMs,
    );
    const endsAtMs = projectMonotonicUtcMsV2(
      input.clock,
      range.endsAtMonotonicMs,
    );
    if (
      !Number.isFinite(startsAtMs) ||
      !Number.isFinite(endsAtMs) ||
      startsAtMs < leaseIssuedAtMs ||
      endsAtMs > leaseExpiresAtMs
    ) {
      return false;
    }
    return recoveredPolicy.allowedUtcWindows.some((window) =>
      Date.parse(window.startsAt) <= startsAtMs &&
      endsAtMs <= Date.parse(window.endsAt));
  });
  return allRangesAuthorised
    ? { recover: true, reasonCode: null }
    : { recover: false, reasonCode: "RECOVERY_OUTSIDE_POLICY_WINDOW" };
}

function focusRecoveryRangesV2(
  checkpoint: DesktopFocusCheckpointV2,
): RecoveredTailRangeV2[] {
  if (!checkpoint.current) return [];
  return [{
    startsAtMonotonicMs: checkpoint.current.confirmedThroughMonotonicMs,
    endsAtMonotonicMs: checkpoint.lastObservedAtMonotonicMs,
  }];
}

function openRuntimeRecoveryRangesV2(
  checkpoint: DesktopOpenRuntimeCheckpointV2,
): RecoveredTailRangeV2[] {
  return checkpoint.current.map((current) => ({
    startsAtMonotonicMs: current.confirmedThroughMonotonicMs,
    endsAtMonotonicMs: checkpoint.lastObservedAtMonotonicMs,
  }));
}

export function eventObservedUtcMsV2(input: {
  serverNowMs: number;
  currentMonotonicMs: number;
  eventMonotonicMs: number;
}) {
  const eventLagMs = Math.max(
    0,
    input.currentMonotonicMs - input.eventMonotonicMs,
  );
  return input.serverNowMs - eventLagMs;
}

export function projectMonotonicUtcMsV2(
  clock: DesktopClockEpochV2,
  monotonicMs: number,
) {
  return Date.parse(clock.clockEpochStartedAt) +
    (monotonicMs - clock.clockEpochStartedMonotonicMs);
}

export function clampMonotonicToPolicyEndV2(input: {
  clock: DesktopClockEpochV2;
  requestedMonotonicMs: number;
  policy: DeviceTrackingPolicyV2;
}) {
  const epochStartedAtMs = Date.parse(input.clock.clockEpochStartedAt);
  const requestedAtMs = projectMonotonicUtcMsV2(
    input.clock,
    input.requestedMonotonicMs,
  );
  const activeWindow = input.policy.allowedUtcWindows.find((window) => {
    const startsAtMs = Date.parse(window.startsAt);
    const endsAtMs = Date.parse(window.endsAt);
    return startsAtMs <= epochStartedAtMs && epochStartedAtMs < endsAtMs;
  });
  if (!activeWindow) return input.requestedMonotonicMs;
  const leaseExpiresAtMs = Date.parse(input.policy.policyLeaseExpiresAt ?? "");
  const windowEndsAtMs = Date.parse(activeWindow.endsAt);
  const captureEndsAtMs = Number.isFinite(leaseExpiresAtMs)
    ? Math.min(windowEndsAtMs, leaseExpiresAtMs)
    : windowEndsAtMs;
  if (requestedAtMs <= captureEndsAtMs) return input.requestedMonotonicMs;
  return input.clock.clockEpochStartedMonotonicMs +
    Math.max(0, captureEndsAtMs - epochStartedAtMs);
}

export function timelineCaptureAllowedAtV2(
  policy: DeviceTrackingPolicyV2,
  instantMs: number,
  timelineThroughMs: number | null,
) {
  if (timelineThroughMs !== null && instantMs < timelineThroughMs) return false;
  return policyLeaseValid(policy, instantMs) &&
    policy.allowedUtcWindows.some((window) =>
      Date.parse(window.startsAt) <= instantMs &&
      instantMs < Date.parse(window.endsAt));
}

export function latestTimelineThroughAtV2(
  current: string | null,
  intervals: ActivityIntervalV2[],
  stream: DesktopTimelineStreamV2,
) {
  let latestMs = Date.parse(current ?? "");
  for (const interval of intervals) {
    if (interval.stream !== stream) continue;
    const endedAtMs = Date.parse(interval.endedAt);
    if (Number.isFinite(endedAtMs) &&
      (!Number.isFinite(latestMs) || endedAtMs > latestMs)) {
      latestMs = endedAtMs;
    }
  }
  return Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null;
}

function describeDesktopPolicyRequirement(policy: DeviceTrackingPolicyV2) {
  if (policy.scheduleTimeZoneState !== "CONFIRMED") {
    return "Tracking is waiting for the workspace Owner or Manager to confirm the policy time zone in WorkMap Compliance.";
  }
  if (policy.acknowledgementState !== "ACKNOWLEDGED") {
    return "Tracking is waiting for this employee to review and acknowledge the current WorkMap policy.";
  }
  if (!policy.collectAppFocus) {
    return "Desktop app tracking is disabled by the current WorkMap policy.";
  }
  if (!policy.policyLeaseId || policy.allowedUtcWindows.length === 0) {
    return "Tracking is waiting for a valid policy collection window. It will retry automatically.";
  }
  return null;
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

function syncFailureCode(error: unknown) {
  if (error instanceof AgentApiError) {
    return error.responseCode ?? (error.status ? `HTTP_${error.status}` : "NETWORK_ERROR");
  }
  return "UNKNOWN";
}

function syncFailureMessage(error: unknown) {
  if (error instanceof AgentApiError) {
    return error.responseMessage
      ? error.responseMessage.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]").slice(0, 240)
      : null;
  }
  return null;
}

function syncFailureRemediation(error: unknown) {
  return error instanceof AgentApiError
    ? error.responseRemediation?.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]").slice(0, 240) ?? null
    : null;
}

function syncFailureRetryable(error: unknown) {
  return error instanceof AgentApiError ? error.responseRetryable ?? null : null;
}

function snapshotRejectionRemediation(code: string) {
  if (code === "SNAPSHOT_POLICY_LEASE_INVALID") {
    return "The Agent will refresh its policy and send a new snapshot.";
  }
  if (code === "SNAPSHOT_OBSERVATION_TIME_INVALID") {
    return "The Agent will create a new snapshot using its current server time anchor.";
  }
  if (code === "SNAPSHOT_OUTSIDE_POLICY_WINDOW") {
    return "Focus collection is paused until the next approved work window.";
  }
  return "Use the request ID to inspect the server log if this repeats.";
}

function snapshotRejectionRetryable(code: string) {
  return code !== "SNAPSHOT_OUTSIDE_POLICY_WINDOW";
}

export function summarizeIntervalRejections(
  results: TrackingSyncItemResultV2[],
) {
  const counts = new Map<string, {
    code: string;
    count: number;
    terminal: boolean;
  }>();
  for (const result of results) {
    if (result.status !== "REJECTED") continue;
    const code = (result.rejectionCode ?? "REJECTED")
      .replace(/[^A-Z0-9_-]/gi, "_")
      .slice(0, 80) || "REJECTED";
    const terminal = result.terminal !== false;
    const key = `${code}:${terminal ? "terminal" : "retry"}`;
    const current = counts.get(key) ?? { code, count: 0, terminal };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count || left.code.localeCompare(right.code),
  );
}

export function shouldRecordConfirmedSyncWarningV2(
  snapshotResult: { status: string } | null | undefined,
  intervalRejected: number,
) {
  return snapshotResult?.status === "REJECTED" || intervalRejected > 0;
}

function intervalRejectionMessage(
  items: ReturnType<typeof summarizeIntervalRejections>,
) {
  const count = items.reduce((total, item) => total + item.count, 0);
  const codes = items.map((item) => `${item.code} (${item.count})`).join(", ");
  return `${count} completed interval${count === 1 ? " was" : "s were"} rejected: ${codes}.`;
}

function intervalRejectionRemediation(
  items: ReturnType<typeof summarizeIntervalRejections>,
) {
  const codes = new Set(items.map((item) => item.code));
  if (codes.has("FOCUS_OVERLAP")) {
    return "The overlapping Focus interval was preserved as rejected evidence. Version 0.6.11 serializes lifecycle boundaries and keeps each tracking stream on a non-regressing timeline; export diagnostics with this request ID if new overlaps continue.";
  }
  if (codes.has("RUNTIME_OVERLAP")) {
    return "The overlapping runtime interval was not counted. The Agent will continue from the current visible-window observation.";
  }
  if (codes.has("OPEN_RUNTIME_NOT_ENABLED")) {
    return "Open/runtime remains paused until the current policy version enables it and the employee acknowledges that version.";
  }
  if (codes.has("POLICY_REJECTED")) {
    return "The Agent will refresh its policy lease; data outside the authorised window is not counted.";
  }
  return "Use the request ID and exported redacted diagnostics to inspect this interval rejection.";
}

function snapshotDiagnosticStatus(
  snapshot: DesktopTrackingRuntimeStateV2["latestSnapshot"],
  serverResult: DesktopTrackingRuntimeStateV2["lastSnapshotSyncStatus"],
) {
  if (!snapshot) return serverResult?.status ?? "NOT_AVAILABLE";
  if (
    serverResult?.status === "CONFIRMED" &&
    serverResult.observedAt === snapshot.lastObservedAt
  ) {
    return "CONFIRMED";
  }
  if (
    serverResult?.status === "REJECTED" &&
    serverResult.observedAt === snapshot.lastObservedAt
  ) {
    return "REJECTED";
  }
  return "LOCAL_PENDING";
}

function latestCursorAcceptedAt(
  cursors: Array<{ latestAcceptedEndedAt: string | null }>,
) {
  return cursors.reduce<string | null>((latest, cursor) => {
    if (!cursor.latestAcceptedEndedAt) return latest;
    if (!latest) return cursor.latestAcceptedEndedAt;
    return Date.parse(cursor.latestAcceptedEndedAt) > Date.parse(latest)
      ? cursor.latestAcceptedEndedAt
      : latest;
  }, null);
}

function latestIsoTimestampV2(
  current: string | null,
  candidate: string | null,
) {
  const currentMs = Date.parse(current ?? "");
  const candidateMs = Date.parse(candidate ?? "");
  if (!Number.isFinite(candidateMs)) return current;
  if (!Number.isFinite(currentMs) || candidateMs > currentMs) {
    return new Date(candidateMs).toISOString();
  }
  return current;
}

function prependDiagnostic(
  diagnostics: TrackingSyncDiagnosticV2[],
  diagnostic: TrackingSyncDiagnosticV2,
) {
  return [
    diagnostic,
    ...diagnostics.filter(
      (existing) => existing.requestId !== diagnostic.requestId,
    ),
  ].slice(0, 10);
}

function isLegacySnapshotPolicyFailure(
  error: unknown,
  snapshotPresent: boolean,
) {
  return (
    snapshotPresent &&
    error instanceof AgentApiError &&
    error.status === 400 &&
    error.responseStage === "policy"
  );
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
