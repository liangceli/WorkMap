import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentStatus, QueuedEvent } from "./types.js";

const MAX_QUEUE_SIZE = 1_000;
const MAX_QUEUE_AGE_MS = 31 * 24 * 60 * 60 * 1000;

export function getAgentDataDirectory() {
  const root = process.env.LOCALAPPDATA?.trim() || join(process.env.USERPROFILE?.trim() || process.cwd(), "AppData", "Local");
  return join(root, "WorkMap", "DesktopAgent");
}

export class FileEventQueue {
  private events: QueuedEvent[] = [];
  constructor(private readonly filePath = join(getAgentDataDirectory(), "queue.json")) {}

  async load(nowMs = Date.now()) {
    this.events = (await readJson<QueuedEvent[]>(this.filePath, [])).filter((item) => item.createdAtMs >= nowMs - MAX_QUEUE_AGE_MS).slice(-MAX_QUEUE_SIZE);
    await this.save();
  }

  listReady(nowMs = Date.now(), limit = 50) {
    return this.events.filter((item) => item.nextAttemptAtMs <= nowMs).slice(0, limit);
  }

  async enqueue(event: QueuedEvent["event"], nowMs = Date.now()) {
    await this.enqueueMany([event], nowMs);
  }

  async enqueueMany(events: QueuedEvent["event"][], nowMs = Date.now()) {
    const ids = new Set(this.events.map((item) => item.event.clientEventId));
    for (const event of events) {
      if (ids.has(event.clientEventId)) continue;
      this.events.push({ event, attempts: 0, nextAttemptAtMs: nowMs, createdAtMs: nowMs });
      ids.add(event.clientEventId);
    }
    if (this.events.length > MAX_QUEUE_SIZE) this.events.splice(0, this.events.length - MAX_QUEUE_SIZE);
    await this.save();
  }

  async acknowledge(ids: string[]) {
    const sent = new Set(ids);
    this.events = this.events.filter((item) => !sent.has(item.event.clientEventId));
    await this.save();
  }

  async discard(ids: string[]) {
    return this.acknowledge(ids);
  }

  async retry(ids: string[], nowMs = Date.now()) {
    const retrying = new Set(ids);
    for (const item of this.events) {
      if (!retrying.has(item.event.clientEventId)) continue;
      item.attempts += 1;
      const delay = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(item.attempts, 6));
      item.nextAttemptAtMs = nowMs + delay;
    }
    await this.save();
  }

  size() { return this.events.length; }

  private async save() { await writeJsonAtomic(this.filePath, this.events); }
}

export async function writeAgentStatus(status: AgentStatus, filePath = join(getAgentDataDirectory(), "status.json")) {
  await writeJsonAtomic(filePath, status);
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as T; } catch { return fallback; }
}

export async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

export const EVENT_QUEUE_CAPACITY = MAX_QUEUE_SIZE;
