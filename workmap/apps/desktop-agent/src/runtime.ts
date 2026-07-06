import { AgentApiError, sendAppUsage, sendHeartbeat, startAgentSession, stopAgentSession } from "./apiClient.js";
import { FileEventQueue, readTrackingCheckpoint, writeAgentStatus, writeTrackingCheckpoint } from "./fileStore.js";
import { AppTrackingState, recoverTrackingCheckpoint } from "./trackingState.js";
import type { AgentConfig, AgentStatus } from "./types.js";
import { WindowsForegroundAdapter } from "./windowsForeground.js";

export class DesktopAgentRuntime {
  private readonly tracking = new AppTrackingState();
  private readonly adapter: WindowsForegroundAdapter;
  private readonly queue: FileEventQueue;
  private stopped = false;
  private finalized = false;
  private runPromise: Promise<void> | null = null;
  private status: AgentStatus;
  private sessionId: string | null = null;

  constructor(
    private readonly config: AgentConfig,
    options: { adapter?: WindowsForegroundAdapter; queue?: FileEventQueue } = {},
  ) {
    this.adapter = options.adapter ?? new WindowsForegroundAdapter(readPositiveNumber("WORKMAP_AGENT_IDLE_SECONDS", 300));
    this.queue = options.queue ?? new FileEventQueue();
    this.status = { state: "connected", deviceId: config.deviceId, queuedEvents: 0 };
  }

  async run() {
    if (!this.runPromise) this.runPromise = this.runLoop();
    await this.runPromise;
  }

  private async runLoop() {
    await this.queue.load();
    const recovered = recoverTrackingCheckpoint(await readTrackingCheckpoint(), this.config.deviceId);
    if (recovered) await this.queue.enqueue(recovered);
    await writeTrackingCheckpoint(null);
    await this.updateStatus();
    const sampleInterval = readPositiveNumber("WORKMAP_AGENT_SAMPLE_INTERVAL_MS", 1_000);
    const heartbeatInterval = readPositiveNumber("WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS", 10_000);
    const checkpointInterval = readPositiveNumber("WORKMAP_AGENT_CHECKPOINT_INTERVAL_MS", 5_000);
    let nextHeartbeatAt = 0;
    let nextCheckpointAt = 0;

    try {
      while (!this.stopped) {
        const now = Date.now();
        try {
          const sample = await this.adapter.sample();
          if (this.stopped) break;
          const events = this.tracking.observe(sample, this.config.deviceId);
          for (const event of events) await this.queue.enqueue(event);
          if (events.length > 0 || now >= nextCheckpointAt) {
            await writeTrackingCheckpoint(this.tracking.checkpoint());
            nextCheckpointAt = now + checkpointInterval;
          }
          if (shouldSendHeartbeat(events.length, now, nextHeartbeatAt)) {
            await this.heartbeat();
            nextHeartbeatAt = now + heartbeatInterval;
          }
          if (this.status.state === "auth_required") {
            this.stopped = true;
            break;
          }
          await this.flushQueue();
        } catch (error) {
          this.status.state = "error";
          this.status.error = safeError(error);
          await this.updateStatus();
        }
        if (!this.stopped) await delay(sampleInterval);
      }
    } finally {
      await this.finalize();
    }
  }

  async shutdown() {
    this.stopped = true;
    if (this.runPromise) return this.runPromise;
    await this.queue.load();
    await this.finalize();
  }

  private async finalize() {
    if (this.finalized) return;
    this.finalized = true;
    for (const event of this.tracking.shutdown(this.config.deviceId, Date.now())) await this.queue.enqueue(event);
    await writeTrackingCheckpoint(null);
    await this.flushQueue();
    if (this.sessionId && this.status.state !== "auth_required") {
      try {
        await stopAgentSession(this.config, this.sessionId);
      } catch (error) {
        this.status.error = safeError(error);
      }
    }
    this.sessionId = null;
    await this.updateStatus();
  }

  private async heartbeat() {
    try {
      if (!this.sessionId) {
        const started = await startAgentSession(this.config);
        this.sessionId = started.sessionId;
      }
      await sendHeartbeat(this.config, this.sessionId, this.tracking.currentActivity());
      this.status.state = "connected";
      this.status.lastHeartbeatAt = new Date().toISOString();
      this.status.error = undefined;
    } catch (error) {
      this.applyApiFailure(error);
    }
    await this.updateStatus();
  }

  private async flushQueue() {
    if (this.status.state === "auth_required") return;
    const ready = this.queue.listReady();
    if (ready.length === 0) return;
    const ids = ready.map((item) => item.event.clientEventId);
    try {
      await sendAppUsage(this.config, ready.map((item) => item.event));
      await this.queue.acknowledge(ids);
      this.status.state = "connected";
      this.status.lastUploadAt = new Date().toISOString();
      this.status.error = undefined;
    } catch (error) {
      if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) {
        this.status.state = "auth_required";
      } else if (error instanceof AgentApiError && error.status && error.status >= 400 && error.status < 500) {
        await this.queue.discard(ids);
        this.status.state = "error";
      } else {
        await this.queue.retry(ids);
        this.status.state = "offline";
      }
      this.status.error = safeError(error);
    }
    await this.updateStatus();
  }

  private applyApiFailure(error: unknown) {
    if (error instanceof AgentApiError && (error.status === 401 || error.status === 403)) this.status.state = "auth_required";
    else this.status.state = "offline";
    this.status.error = safeError(error);
  }

  private async updateStatus() {
    this.status.queuedEvents = this.queue.size();
    this.status.sessionId = this.sessionId ?? undefined;
    this.status.currentActivity = this.tracking.currentActivity();
    await writeAgentStatus(this.status);
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

export function shouldSendHeartbeat(completedEventCount: number, now: number, nextHeartbeatAt: number) {
  return completedEventCount > 0 || now >= nextHeartbeatAt;
}
