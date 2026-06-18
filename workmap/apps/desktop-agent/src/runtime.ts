import { AgentApiError, sendAppUsage, sendHeartbeat } from "./apiClient.js";
import { FileEventQueue, writeAgentStatus } from "./fileStore.js";
import { AppTrackingState } from "./trackingState.js";
import type { AgentConfig, AgentStatus } from "./types.js";
import { WindowsForegroundAdapter } from "./windowsForeground.js";

export class DesktopAgentRuntime {
  private readonly tracking = new AppTrackingState();
  private readonly adapter: WindowsForegroundAdapter;
  private readonly queue: FileEventQueue;
  private stopped = false;
  private status: AgentStatus;

  constructor(
    private readonly config: AgentConfig,
    options: { adapter?: WindowsForegroundAdapter; queue?: FileEventQueue } = {},
  ) {
    this.adapter = options.adapter ?? new WindowsForegroundAdapter(readPositiveNumber("WORKMAP_AGENT_IDLE_SECONDS", 300));
    this.queue = options.queue ?? new FileEventQueue();
    this.status = { state: "connected", deviceId: config.deviceId, queuedEvents: 0 };
  }

  async run() {
    await this.queue.load();
    await this.updateStatus();
    const sampleInterval = readPositiveNumber("WORKMAP_AGENT_SAMPLE_INTERVAL_MS", 2_000);
    const heartbeatInterval = readPositiveNumber("WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS", 60_000);
    let nextHeartbeatAt = 0;

    while (!this.stopped) {
      const now = Date.now();
      if (now >= nextHeartbeatAt) {
        await this.heartbeat();
        nextHeartbeatAt = now + heartbeatInterval;
      }
      try {
        const sample = await this.adapter.sample();
        for (const event of this.tracking.observe(sample, this.config.deviceId)) await this.queue.enqueue(event);
        await this.flushQueue();
      } catch (error) {
        this.status.state = "error";
        this.status.error = safeError(error);
        await this.updateStatus();
      }
      await delay(sampleInterval);
    }
  }

  async shutdown() {
    this.stopped = true;
    for (const event of this.tracking.shutdown(this.config.deviceId, Date.now())) await this.queue.enqueue(event);
    await this.flushQueue();
    await this.updateStatus();
  }

  private async heartbeat() {
    try {
      await sendHeartbeat(this.config);
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
