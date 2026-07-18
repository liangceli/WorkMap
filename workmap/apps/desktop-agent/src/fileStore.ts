import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { AgentStatus, QueuedEvent, QueuedStatusEvent, TrackingCheckpoint } from "./types.js";

const MAX_QUEUE_SIZE = 1_000;
const MAX_QUEUE_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_JSON_WRITE_ATTEMPTS = 5;
const DEFAULT_JSON_WRITE_RETRY_MS = 40;
const TRANSIENT_WRITE_ERROR_CODES = new Set(["EACCES", "EBUSY", "ENOENT", "EPERM"]);

type WriteFileImpl = typeof writeFile;
type RenameImpl = typeof rename;
type UnlinkImpl = typeof unlink;

export type JsonWriteOptions = {
  attempts?: number;
  retryDelayMs?: number;
  writeFileImpl?: WriteFileImpl;
  renameImpl?: RenameImpl;
  unlinkImpl?: UnlinkImpl;
  tempName?: () => string;
};

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

  async loadPreservingExisting() {
    this.events = await readJson<QueuedEvent[]>(this.filePath, []);
  }

  listReady(nowMs = Date.now(), limit = 50) {
    return this.events.filter((item) => item.nextAttemptAtMs <= nowMs).slice(0, limit);
  }

  async enqueue(event: QueuedEvent["event"], nowMs = Date.now()) {
    await this.enqueueMany([event], nowMs);
  }

  async enqueueMany(events: QueuedEvent["event"][], nowMs = Date.now()) {
    const ids = new Set(this.events.map((item) => item.event.clientEventId));
    const fingerprints = new Set(this.events.map((item) => legacyEventFingerprint(item.event)));
    for (const event of events) {
      const fingerprint = legacyEventFingerprint(event);
      if (ids.has(event.clientEventId) || fingerprints.has(fingerprint)) continue;
      this.events.push({ event, attempts: 0, nextAttemptAtMs: nowMs, createdAtMs: nowMs });
      ids.add(event.clientEventId);
      fingerprints.add(fingerprint);
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

  async clear() {
    this.events = [];
    await this.save();
  }

  private async save() { await writeJsonAtomic(this.filePath, this.events); }
}

export async function writeAgentStatus(status: AgentStatus, filePath = join(getAgentDataDirectory(), "status.json"), options: JsonWriteOptions = {}) {
  try {
    await writeJsonAtomic(filePath, status, {
      attempts: 3,
      retryDelayMs: 25,
      ...options,
    });
    return true;
  } catch {
    return false;
  }
}

export class FileStatusEventQueue {
  private events: QueuedStatusEvent[] = [];
  constructor(private readonly filePath = join(getAgentDataDirectory(), "status-queue.json")) {}

  async load(nowMs = Date.now()) {
    this.events = (await readJson<QueuedStatusEvent[]>(this.filePath, []))
      .filter((item) => item.createdAtMs >= nowMs - MAX_QUEUE_AGE_MS)
      .slice(-MAX_QUEUE_SIZE);
    await this.save();
  }

  listReady(nowMs = Date.now(), limit = 50) {
    return this.events.filter((item) => item.nextAttemptAtMs <= nowMs).slice(0, limit);
  }

  async enqueue(event: QueuedStatusEvent["event"], nowMs = Date.now()) {
    if (this.events.some((item) => item.event.clientEventId === event.clientEventId)) return;
    this.events.push({ event, attempts: 0, nextAttemptAtMs: nowMs, createdAtMs: nowMs });
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

  async clear() {
    this.events = [];
    await this.save();
  }

  private async save() { await writeJsonAtomic(this.filePath, this.events); }
}

function legacyEventFingerprint(event: QueuedEvent["event"]) {
  return [
    event.deviceId,
    event.appName,
    event.startedAt,
    event.endedAt,
    event.durationSeconds,
    event.isIdle,
    event.isActiveWindow,
    event.agentSessionId ?? "",
    event.clientInstanceId ?? "",
    event.sequenceNumber ?? "",
  ].join("|");
}

export function readTrackingCheckpoint(filePath = join(getAgentDataDirectory(), "tracking-state.json")) {
  return readJson<TrackingCheckpoint | null>(filePath, null);
}

export function writeTrackingCheckpoint(checkpoint: TrackingCheckpoint | null, filePath = join(getAgentDataDirectory(), "tracking-state.json")) {
  return writeJsonAtomic(filePath, checkpoint);
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as T; } catch { return fallback; }
}

export async function writeJsonAtomic(filePath: string, value: unknown, options: JsonWriteOptions = {}) {
  await mkdir(dirname(filePath), { recursive: true });

  const attempts = Math.max(1, options.attempts ?? DEFAULT_JSON_WRITE_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_JSON_WRITE_RETRY_MS);
  const writeFileImpl = options.writeFileImpl ?? writeFile;
  const renameImpl = options.renameImpl ?? rename;
  const unlinkImpl = options.unlinkImpl ?? unlink;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const temporary = join(dirname(filePath), options.tempName?.() ?? createTemporaryJsonFileName(filePath));

    try {
      await writeFileImpl(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await renameImpl(temporary, filePath);
      return;
    } catch (error) {
      lastError = error;
      await removeTemporaryFile(temporary, unlinkImpl);

      if (!isTransientWriteError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

export const EVENT_QUEUE_CAPACITY = MAX_QUEUE_SIZE;

function createTemporaryJsonFileName(filePath: string) {
  return `.${basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
}

async function removeTemporaryFile(filePath: string, unlinkImpl: UnlinkImpl) {
  try {
    await unlinkImpl(filePath);
  } catch {
    // Best effort cleanup. The next write uses a unique temp file, so a stale temp file cannot block writes.
  }
}

function isTransientWriteError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_WRITE_ERROR_CODES.has(code);
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}
