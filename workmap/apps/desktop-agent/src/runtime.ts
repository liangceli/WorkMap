import {
  AgentApiError,
  isInactiveAgentSessionError,
  sendAppUsage,
  sendDeviceStatus,
  sendHeartbeat,
  startAgentSession,
  stopAgentSession,
} from "./apiClient.js";
import { FileEventQueue, FileStatusEventQueue, readTrackingCheckpoint, writeAgentStatus, writeTrackingCheckpoint } from "./fileStore.js";
import { AppTrackingState, recoverTrackingCheckpoints } from "./trackingState.js";
import { randomUUID } from "node:crypto";
import type { AgentConfig, AgentStatus, AppUsageEvent, DeviceStatusEvent, DeviceStatusName, DeviceStatusReason } from "./types.js";
import { DEFAULT_IDLE_THRESHOLD_SECONDS, WindowsForegroundAdapter } from "./windowsForeground.js";

export const DEFAULT_SAMPLE_INTERVAL_MS = 100;

type StatusWriter = (status: AgentStatus) => Promise<unknown>;
type ShutdownReason = "USER_STOP" | "DEVICE_SHUTDOWN" | "SUSPENDED" | "AGENT_CRASHED" | "AGENT_TERMINATED" | "UNKNOWN_INTERRUPTED" | undefined;

export class DesktopAgentRuntime {
  private readonly tracking = new AppTrackingState({
    runtimeSegmentMs: readPositiveNumber("WORKMAP_AGENT_RUNTIME_SEGMENT_MS", 10_000),
  });
  private readonly adapter: WindowsForegroundAdapter;
  private readonly queue: FileEventQueue;
  private readonly statusQueue: FileStatusEventQueue;
  private stopped = false;
  private finalized = false;
  private runPromise: Promise<void> | null = null;
  private status: AgentStatus;
  private readonly statusWriter: StatusWriter;
  private sessionId: string | null = null;
  private readonly clientSessionId = randomUUID();
  private readonly timeZone = resolveTimeZone();
  private sequenceNumber = 0;
  private shutdownReason: ShutdownReason;
  private hasConnected = false;
  private heartbeatHealthy = false;

  constructor(
    private readonly config: AgentConfig,
    options: {
      adapter?: WindowsForegroundAdapter;
      queue?: FileEventQueue;
      statusQueue?: FileStatusEventQueue;
      statusWriter?: StatusWriter;
    } = {},
  ) {
    this.adapter = options.adapter ?? new WindowsForegroundAdapter(readPositiveNumber("WORKMAP_AGENT_IDLE_SECONDS", DEFAULT_IDLE_THRESHOLD_SECONDS));
    this.queue = options.queue ?? new FileEventQueue();
    this.statusQueue = options.statusQueue ?? new FileStatusEventQueue();
    this.statusWriter = options.statusWriter ?? writeAgentStatus;
    this.status = { state: "offline", deviceId: config.deviceId, queuedEvents: 0 };
  }

  async run() {
    if (!this.runPromise) this.runPromise = this.runLoop();
    await this.runPromise;
  }

  private async runLoop() {
    await this.queue.load();
    await this.statusQueue.load();
    const recovered = recoverTrackingCheckpoints(await readTrackingCheckpoint(), this.config.deviceId);
    if (recovered.length > 0) await this.queue.enqueueMany(recovered);
    await writeTrackingCheckpoint(null);
    await this.updateStatus();
    const sampleInterval = readPositiveNumber("WORKMAP_AGENT_SAMPLE_INTERVAL_MS", DEFAULT_SAMPLE_INTERVAL_MS);
    const heartbeatInterval = readPositiveNumber("WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS", 10_000);
    const checkpointInterval = readPositiveNumber("WORKMAP_AGENT_CHECKPOINT_INTERVAL_MS", 5_000);
    await this.heartbeat();
    let nextHeartbeatAt = Date.now() + heartbeatInterval;
    let nextCheckpointAt = 0;

    try {
      while (!this.stopped) {
        let completedEventCount = 0;
        try {
          const now = Date.now();
          const sample = await this.adapter.sample();
          if (this.stopped) break;
          const events = this.tracking.observe(sample, this.config.deviceId);
          completedEventCount = events.length;
          for (const event of events) await this.enqueueActivity(event);
          if (events.length > 0 || now >= nextCheckpointAt) {
            await writeTrackingCheckpoint(this.tracking.checkpoint());
            nextCheckpointAt = now + checkpointInterval;
          }
        } catch (error) {
          if (this.status.state !== "connected") this.status.state = "error";
          this.status.error = safeError(error);
          await this.updateStatus();
        }
        const heartbeatNow = Date.now();
        if (shouldSendHeartbeat(completedEventCount, heartbeatNow, nextHeartbeatAt)) {
          await this.heartbeat();
          nextHeartbeatAt = Date.now() + heartbeatInterval;
        }
        if (this.status.state === "auth_required") {
          this.shutdownReason = "UNKNOWN_INTERRUPTED";
          this.stopped = true;
          break;
        }
        await this.flushStatusQueue();
        await this.flushQueue();
        if (!this.stopped) await delay(sampleInterval);
      }
    } finally {
      await this.finalize();
    }
  }

  async shutdown(reason: ShutdownReason = "USER_STOP") {
    this.shutdownReason = reason;
    this.stopped = true;
    if (this.runPromise) return this.runPromise;
    await this.queue.load();
    await this.statusQueue.load();
    await this.finalize();
  }

  private async finalize() {
    if (this.finalized) return;
    this.finalized = true;
    this.adapter.stop();
    for (const event of this.tracking.shutdown(this.config.deviceId, Date.now())) await this.enqueueActivity(event);
    await writeTrackingCheckpoint(null);
    const shutdownStatusId = await this.enqueueShutdownStatus(this.shutdownReason);
    await this.flushStatusQueue();
    await this.flushQueue();
    if (this.sessionId && this.status.state !== "auth_required") {
      try {
        await stopAgentSession(this.config, this.sessionId, this.shutdownReason, this.timeZone);
        if (shutdownStatusId) await this.statusQueue.acknowledge([shutdownStatusId]);
      } catch (error) {
        this.status.error = safeError(error);
      }
    }
    this.sessionId = null;
    if (this.status.state !== "auth_required") this.status.state = "offline";
    await this.updateStatus();
  }

  private async heartbeat() {
    try {
      const shouldReportReconnection = this.hasConnected && !this.heartbeatHealthy;
      await this.sendHeartbeatWithSessionRecovery();
      this.heartbeatHealthy = true;
      this.status.state = "connected";
      this.status.lastHeartbeatAt = new Date().toISOString();
      this.status.error = undefined;
      if (shouldReportReconnection) {
        await this.enqueueDeviceStatus("RECONNECTED", "SYSTEM_RESUME", { operation: "heartbeat-recovered" });
      }
      this.hasConnected = true;
    } catch (error) {
      await this.applyApiFailure(error);
    }
    await this.updateStatus();
  }

  private async sendHeartbeatWithSessionRecovery() {
    if (!this.sessionId) await this.startNewSession();
    try {
      await sendHeartbeat(this.config, this.sessionId ?? undefined, this.tracking.currentActivity(), this.nextSequence(), this.timeZone);
    } catch (error) {
      if (!isInactiveAgentSessionError(error)) throw error;
      this.sessionId = null;
      await this.startNewSession();
      await sendHeartbeat(this.config, this.sessionId ?? undefined, this.tracking.currentActivity(), this.nextSequence(), this.timeZone);
    }
  }

  private async startNewSession() {
    const started = await startAgentSession(this.config, this.clientSessionId, this.timeZone);
    this.sessionId = started.sessionId;
  }

  private async flushQueue() {
    if (this.status.state === "auth_required") return;
    const ready = this.queue.listReady();
    if (ready.length === 0) return;
    const ids = ready.map((item) => item.event.clientEventId);
    try {
      await sendAppUsage(this.config, ready.map((item) => this.ensureActivityMetadata(item.event)));
      await this.queue.acknowledge(ids);
      this.status.lastUploadAt = new Date().toISOString();
      if (this.heartbeatHealthy) {
        this.status.state = "connected";
        this.status.error = undefined;
      }
    } catch (error) {
      if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
        this.status.state = "auth_required";
      } else if (error instanceof AgentApiError && error.status && error.status >= 400 && error.status < 500) {
        await this.queue.discard(ids);
        this.status.state = "error";
      } else {
        await this.queue.retry(ids);
        this.status.state = error instanceof AgentApiError && error.status && error.status >= 500 ? "server_unreachable" : "offline";
      }
      this.status.error = safeError(error);
    }
    await this.updateStatus();
  }

  private async applyApiFailure(error: unknown) {
    this.heartbeatHealthy = false;
    if (error instanceof AgentApiError && (error.status === 401 || (error.status === 403 && !isInactiveAgentSessionError(error)))) {
      this.status.state = "auth_required";
    } else {
      const nextState = error instanceof AgentApiError && error.status && error.status >= 500 ? "server_unreachable" : "offline";
      const changed = this.hasConnected && this.status.state !== nextState;
      this.status.state = nextState;
      if (changed) {
        await this.enqueueDeviceStatus(
          nextState === "server_unreachable" ? "SERVER_UNREACHABLE" : "NETWORK_OFFLINE",
          nextState === "server_unreachable" ? "SERVER_REQUEST_FAILED" : "NETWORK_UNAVAILABLE",
          { operation: "heartbeat-failed" },
        );
      }
    }
    this.status.error = safeError(error);
  }

  async reportDeviceStatus(status: DeviceStatusName, reason: DeviceStatusReason, metadata?: DeviceStatusEvent["metadata"]) {
    if (status === "SLEEPING" || status === "LOCKED" || status === "DEVICE_SHUTDOWN") {
      const boundary = this.tracking.observe({
        appName: null,
        openAppNames: [],
        isIdle: status !== "DEVICE_SHUTDOWN",
        isLocked: true,
        observedAtMs: Date.now(),
      }, this.config.deviceId);
      for (const event of boundary) await this.enqueueActivity(event);
      await writeTrackingCheckpoint(this.tracking.checkpoint());
    }
    await this.enqueueDeviceStatus(status, reason, metadata);
    await this.flushStatusQueue();
    await this.flushQueue();
  }

  private async enqueueActivity(event: AppUsageEvent) {
    await this.queue.enqueue(this.ensureActivityMetadata(event));
  }

  private ensureActivityMetadata(event: AppUsageEvent): AppUsageEvent {
    if (event.clientInstanceId && event.sequenceNumber !== undefined && event.clientMonotonicMs !== undefined && event.timeZone) {
      // Events created while the API was unavailable already have stable
      // identity metadata. Once the runtime reopens a session, bind only the
      // previously unbound events so report/audit data can still trace them to
      // the recovered Agent session without changing their identity.
      return bindActivityEventToSession(event, this.sessionId);
    }
    return bindActivityEventToSession({
      ...event,
      clientInstanceId: event.clientInstanceId ?? this.config.deviceId,
      sequenceNumber: event.sequenceNumber ?? this.nextSequence(),
      clientMonotonicMs: event.clientMonotonicMs ?? monotonicNowMs(),
      timeZone: event.timeZone ?? this.timeZone,
    }, this.sessionId);
  }

  private async enqueueDeviceStatus(status: DeviceStatusName, reason: DeviceStatusReason, metadata?: DeviceStatusEvent["metadata"]) {
    const recordedAt = new Date().toISOString();
    const event: DeviceStatusEvent = {
      clientEventId: randomUUID(),
      deviceId: this.config.deviceId,
      ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      status,
      reason,
      startedAt: recordedAt,
      ...(this.status.lastHeartbeatAt ? { lastHeartbeatAt: this.status.lastHeartbeatAt } : {}),
      recordedAt,
      timeZone: this.timeZone,
      confidence: "CONFIRMED",
      ...(metadata ? { metadata } : {}),
    };
    await this.statusQueue.enqueue(event);
    this.status.deviceStatus = status;
    return event.clientEventId;
  }

  private async enqueueShutdownStatus(reason: ShutdownReason) {
    const lifecycle = shutdownLifecycle(reason);
    return this.enqueueDeviceStatus(lifecycle.status, lifecycle.reason, { operation: "runtime-finalize" });
  }

  private async flushStatusQueue() {
    if (this.status.state === "auth_required") return;
    const ready = this.statusQueue.listReady();
    if (ready.length === 0) return;
    const ids = ready.map((item) => item.event.clientEventId);
    try {
      for (const item of ready) await sendDeviceStatus(this.config, item.event);
      await this.statusQueue.acknowledge(ids);
      this.status.lastStatusUploadAt = new Date().toISOString();
    } catch (error) {
      if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
        this.status.state = "auth_required";
      } else if (error instanceof AgentApiError && error.status && error.status >= 400 && error.status < 500) {
        await this.statusQueue.discard(ids);
        this.status.state = "error";
      } else {
        await this.statusQueue.retry(ids);
        this.status.state = error instanceof AgentApiError && error.status && error.status >= 500 ? "server_unreachable" : "offline";
      }
      this.status.error = safeError(error);
    }
    await this.updateStatus();
  }

  private nextSequence() {
    this.sequenceNumber = (this.sequenceNumber + 1) % 2_147_483_648;
    return this.sequenceNumber;
  }

  private async updateStatus() {
    this.status.queuedEvents = this.queue.size();
    this.status.queuedStatusEvents = this.statusQueue.size();
    this.status.sessionId = this.sessionId ?? undefined;
    this.status.clientSessionId = this.clientSessionId;
    this.status.currentActivity = this.tracking.currentActivity();
    try {
      await this.statusWriter(this.status);
    } catch {
      // Local UI status writes are diagnostic only. They must never stop heartbeat or upload loops.
    }
  }
}

function readPositiveNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown error";
}

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function monotonicNowMs() {
  return Math.max(0, Math.round(process.uptime() * 1_000));
}

function shutdownLifecycle(reason: ShutdownReason): { status: DeviceStatusName; reason: DeviceStatusReason } {
  switch (reason) {
    case "USER_STOP": return { status: "STOPPED_BY_USER", reason: "USER_STOP" };
    case "DEVICE_SHUTDOWN": return { status: "DEVICE_SHUTDOWN", reason: "SYSTEM_SHUTDOWN" };
    case "SUSPENDED": return { status: "SLEEPING", reason: "SYSTEM_SUSPEND" };
    case "AGENT_CRASHED": return { status: "AGENT_CRASHED", reason: "PROCESS_CRASH" };
    case "AGENT_TERMINATED": return { status: "AGENT_TERMINATED", reason: "PROCESS_TERMINATED" };
    default: return { status: "UNKNOWN_INTERRUPTED", reason: "UNKNOWN" };
  }
}

export function shouldSendHeartbeat(completedEventCount: number, now: number, nextHeartbeatAt: number) {
  return completedEventCount > 0 || now >= nextHeartbeatAt;
}

export function bindActivityEventToSession(event: AppUsageEvent, sessionId: string | null) {
  return sessionId && !event.agentSessionId ? { ...event, agentSessionId: sessionId } : event;
}
