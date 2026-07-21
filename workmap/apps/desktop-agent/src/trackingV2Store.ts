import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getAgentDataDirectory } from "./fileStore.js";
import {
  DESKTOP_V2_QUEUE_CAPACITY,
  type ActivityIntervalV2,
  type DesktopTrackingRuntimeStateV2,
  type DesktopV2QueueStats,
  type LiveFocusSnapshotV2,
} from "./trackingV2Types.js";

const RUNTIME_STATE_KEY = "runtime-state";

export class V2QueuePressureError extends Error {
  constructor() {
    super("The tracking queue is full. Collection is paused without deleting existing activity.");
  }
}

export class DesktopTrackingV2Store {
  private readonly database: DatabaseSync;

  constructor(
    filePath = join(getAgentDataDirectory(), "tracking-v2.sqlite"),
    private readonly capacity = DESKTOP_V2_QUEUE_CAPACITY,
  ) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA synchronous = FULL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS tracking_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS tracking_interval_queue (
        client_event_id TEXT PRIMARY KEY,
        sequence_number INTEGER NOT NULL,
        clock_epoch_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'DEAD_LETTER')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at_ms INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        dead_letter_code TEXT
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS tracking_interval_sequence_identity
        ON tracking_interval_queue(clock_epoch_id, sequence_number);
      CREATE INDEX IF NOT EXISTS tracking_interval_ready
        ON tracking_interval_queue(state, next_attempt_at_ms, sequence_number);
    `);
  }

  close() {
    this.database.close();
  }

  readRuntimeState(): DesktopTrackingRuntimeStateV2 | null {
    const row = this.database.prepare(
      "SELECT value_json FROM tracking_meta WHERE key = ?",
    ).get(RUNTIME_STATE_KEY) as { value_json?: unknown } | undefined;
    if (typeof row?.value_json !== "string") return null;
    try {
      return JSON.parse(row.value_json) as DesktopTrackingRuntimeStateV2;
    } catch {
      return null;
    }
  }

  writeRuntimeState(state: DesktopTrackingRuntimeStateV2) {
    this.writeMeta(RUNTIME_STATE_KEY, state);
  }

  persistEngineUpdate(
    intervals: ActivityIntervalV2[],
    state: DesktopTrackingRuntimeStateV2,
    snapshot: LiveFocusSnapshotV2,
    nowMs = Date.now(),
  ) {
    this.persistIntervalsAndState(
      intervals,
      { ...state, latestSnapshot: snapshot },
      nowMs,
    );
  }

  persistRuntimeUpdate(
    intervals: ActivityIntervalV2[],
    state: DesktopTrackingRuntimeStateV2,
    nowMs = Date.now(),
  ) {
    this.persistIntervalsAndState(intervals, state, nowMs);
  }

  private persistIntervalsAndState(
    intervals: ActivityIntervalV2[],
    state: DesktopTrackingRuntimeStateV2,
    nowMs: number,
  ) {
    this.transaction(() => {
      const currentCount = this.pendingAndDeadLetterCount();
      const insert = this.database.prepare(`
        INSERT OR IGNORE INTO tracking_interval_queue (
          client_event_id,
          sequence_number,
          clock_epoch_id,
          payload_json,
          state,
          attempts,
          next_attempt_at_ms,
          created_at_ms
        ) VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)
      `);
      let newlyInserted = 0;
      for (const interval of intervals) {
        const existingByEvent = this.database.prepare(
          "SELECT payload_json FROM tracking_interval_queue WHERE client_event_id = ?",
        ).get(interval.clientEventId) as { payload_json?: unknown } | undefined;
        const serialized = JSON.stringify(interval);
        if (existingByEvent) {
          if (existingByEvent.payload_json !== serialized) {
            throw new Error("A v2 activity event identity was reused with different content.");
          }
          continue;
        }
        const existingBySequence = this.database.prepare(`
          SELECT payload_json
          FROM tracking_interval_queue
          WHERE clock_epoch_id = ? AND sequence_number = ?
        `).get(interval.clockEpochId, interval.sequenceNumber) as
          | { payload_json?: unknown }
          | undefined;
        if (existingBySequence) {
          if (existingBySequence.payload_json !== serialized) {
            throw new Error("A v2 activity sequence was reused with different content.");
          }
          continue;
        }
        if (currentCount + newlyInserted >= this.capacity) {
          throw new V2QueuePressureError();
        }
        const result = insert.run(
          interval.clientEventId,
          interval.sequenceNumber,
          interval.clockEpochId,
          serialized,
          nowMs,
          nowMs,
        );
        newlyInserted += Number(result.changes);
      }
      this.writeMeta(RUNTIME_STATE_KEY, state);
    });
  }

  listReady(nowMs = Date.now(), limit = 50): ActivityIntervalV2[] {
    const rows = this.database.prepare(`
      SELECT payload_json
      FROM tracking_interval_queue
      WHERE state = 'PENDING' AND next_attempt_at_ms <= ?
      ORDER BY clock_epoch_id ASC, sequence_number ASC
      LIMIT ?
    `).all(nowMs, limit) as Array<{ payload_json: unknown }>;
    return rows.flatMap((row) => {
      if (typeof row.payload_json !== "string") return [];
      try {
        return [JSON.parse(row.payload_json) as ActivityIntervalV2];
      } catch {
        return [];
      }
    });
  }

  acknowledge(clientEventIds: string[]) {
    if (clientEventIds.length === 0) return;
    this.transaction(() => {
      const remove = this.database.prepare(
        "DELETE FROM tracking_interval_queue WHERE client_event_id = ? AND state = 'PENDING'",
      );
      for (const clientEventId of clientEventIds) remove.run(clientEventId);
    });
  }

  deadLetter(items: Array<{ clientEventId: string; code: string }>) {
    if (items.length === 0) return;
    this.transaction(() => {
      const update = this.database.prepare(`
        UPDATE tracking_interval_queue
        SET state = 'DEAD_LETTER', dead_letter_code = ?, next_attempt_at_ms = 0
        WHERE client_event_id = ? AND state = 'PENDING'
      `);
      for (const item of items) {
        update.run(sanitizeDeadLetterCode(item.code), item.clientEventId);
      }
    });
  }

  retry(clientEventIds: string[], nowMs = Date.now(), retryAfterMs?: number) {
    if (clientEventIds.length === 0) return;
    this.transaction(() => {
      const read = this.database.prepare(
        "SELECT attempts FROM tracking_interval_queue WHERE client_event_id = ? AND state = 'PENDING'",
      );
      const update = this.database.prepare(`
        UPDATE tracking_interval_queue
        SET attempts = ?, next_attempt_at_ms = ?
        WHERE client_event_id = ? AND state = 'PENDING'
      `);
      for (const clientEventId of clientEventIds) {
        const row = read.get(clientEventId) as { attempts?: unknown } | undefined;
        const attempts = Number(row?.attempts ?? 0) + 1;
        const delayMs = retryAfterMs ?? retryBackoffMs(attempts, clientEventId);
        update.run(attempts, nowMs + delayMs, clientEventId);
      }
    });
  }

  stats(nowMs = Date.now()): DesktopV2QueueStats {
    const counts = this.database.prepare(`
      SELECT
        SUM(CASE WHEN state = 'PENDING' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN state = 'PENDING' AND next_attempt_at_ms <= ? THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN state = 'DEAD_LETTER' THEN 1 ELSE 0 END) AS dead_letter,
        MIN(CASE WHEN state = 'PENDING' THEN created_at_ms END) AS oldest_queued_at_ms,
        MIN(CASE WHEN state = 'PENDING' AND next_attempt_at_ms > ? THEN next_attempt_at_ms END) AS next_retry_at_ms
      FROM tracking_interval_queue
    `).get(nowMs, nowMs) as Record<string, unknown>;
    return {
      pending: Number(counts.pending ?? 0),
      ready: Number(counts.ready ?? 0),
      deadLetter: Number(counts.dead_letter ?? 0),
      oldestQueuedAt: toIsoOrNull(counts.oldest_queued_at_ms),
      nextRetryAt: toIsoOrNull(counts.next_retry_at_ms),
    };
  }

  deadLetterSummary() {
    const rows = this.database.prepare(`
      SELECT COALESCE(dead_letter_code, 'REJECTED') AS code, COUNT(*) AS count
      FROM tracking_interval_queue
      WHERE state = 'DEAD_LETTER'
      GROUP BY COALESCE(dead_letter_code, 'REJECTED')
      ORDER BY count DESC, code ASC
    `).all() as Array<{ code: unknown; count: unknown }>;
    return rows.map((row) => ({
      code: sanitizeDeadLetterCode(String(row.code ?? "REJECTED")),
      count: Number(row.count ?? 0),
    }));
  }

  hasCapacity(reserve = 1) {
    return this.pendingAndDeadLetterCount() + Math.max(0, reserve) <= this.capacity;
  }

  private writeMeta(key: string, value: unknown) {
    this.database.prepare(`
      INSERT INTO tracking_meta (key, value_json, updated_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at_ms = excluded.updated_at_ms
    `).run(key, JSON.stringify(value), Date.now());
  }

  private pendingAndDeadLetterCount() {
    const row = this.database.prepare(
      "SELECT COUNT(*) AS count FROM tracking_interval_queue",
    ).get() as { count?: unknown };
    return Number(row.count ?? 0);
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createInitialDesktopTrackingV2State(): DesktopTrackingRuntimeStateV2 {
  return {
    version: 1,
    migrationState: "V1",
    activationId: null,
    proposedActivatedAt: null,
    protocolActivatedAt: null,
    policy: null,
    serverOffsetMs: 0,
    clientInstanceId: randomUUID(),
    clock: null,
    engineCheckpoint: null,
    openRuntimeClock: null,
    openRuntimeCheckpoint: null,
    latestSnapshot: null,
    lastSuccessfulSyncAt: null,
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: "NONE",
    lastSyncDiagnostic: null,
    recentSyncFailures: [],
    lastSnapshotSyncStatus: null,
    lastIntervalUploadStatus: null,
  };
}

function retryBackoffMs(attempts: number, identity: string) {
  const schedule = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];
  const base = schedule[Math.min(Math.max(attempts - 1, 0), schedule.length - 1)] ?? 300_000;
  const hash = Array.from(identity).reduce((value, character) => value + character.charCodeAt(0), 0);
  const jitter = Math.round(base * (((hash % 21) - 10) / 100));
  return Math.max(1_000, base + jitter);
}

function sanitizeDeadLetterCode(value: string) {
  return value.replace(/[^A-Z0-9_-]/gi, "_").slice(0, 80) || "REJECTED";
}

function toIsoOrNull(value: unknown) {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : null;
}
