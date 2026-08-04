import {
  BROWSER_V2_DEAD_LETTER_CAPACITY,
  BROWSER_V2_DEAD_LETTER_RETENTION_MS,
  BROWSER_V2_QUEUE_CAPACITY,
  createInitialBrowserTrackingV2State,
  type BrowserActivityIntervalV2,
  type BrowserLiveFocusSnapshotV2,
  type BrowserTrackingRuntimeStateV2,
  type BrowserV2DeadLetterRecord,
  type BrowserV2QueueRecord,
  type BrowserV2QueueStats,
  type TrackingSyncItemResultV2,
} from "./trackingV2Types.js";
import {
  advanceBrowserFocusTimelineThroughAt,
  advanceBrowserTimelineThroughAt,
} from "./browserFocusTimelineV2.js";

const DATABASE_NAME = "workmap-tracking-v2";
const DATABASE_VERSION = 3;
const INTERVAL_STORE = "intervals";
const DEAD_LETTER_STORE = "deadLetters";
const META_STORE = "meta";
const RUNTIME_KEY = "runtime";

type MetaRecord = {
  key: string;
  value: BrowserTrackingRuntimeStateV2;
};

type LegacyRuntimeStateV7 = Omit<
  BrowserTrackingRuntimeStateV2,
  | "version"
  | "openRuntimeClock"
  | "openRuntimeCheckpoint"
  | "openRuntimeTimelineThroughAt"
  | "lastSystemState"
> & {
  version: 7;
};

type LegacyRuntimeStateV6 = Omit<
  LegacyRuntimeStateV7,
  "version" | "focusTimelineThroughAt"
> & {
  version: 6;
};

type LegacyRuntimeStateV5 = Omit<LegacyRuntimeStateV6, "version"> & {
  version: 5;
};

export class BrowserV2QueuePressureError extends Error {}

export class BrowserTrackingV2Store {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async readRuntimeState(): Promise<BrowserTrackingRuntimeStateV2> {
    const database = await this.database();
    const transaction = database.transaction(META_STORE, "readonly");
    const record = await requestAsPromise<MetaRecord | undefined>(
      transaction.objectStore(META_STORE).get(RUNTIME_KEY),
    );
    await transactionDone(transaction);
    if (record?.value.version === 8) {
      return record.value;
    }
    if ((record?.value as unknown as LegacyRuntimeStateV7 | undefined)?.version === 7) {
      const initial = createInitialBrowserTrackingV2State();
      const legacy = record!.value as unknown as LegacyRuntimeStateV7;
      const migrated: BrowserTrackingRuntimeStateV2 = {
        ...initial,
        ...legacy,
        version: 8,
        openRuntimeClock: null,
        openRuntimeCheckpoint: null,
        openRuntimeTimelineThroughAt: null,
        lastSystemState: null,
      };
      await this.writeRuntimeState(migrated);
      return migrated;
    }
    if ((record?.value as unknown as LegacyRuntimeStateV6 | undefined)?.version === 6) {
      const initial = createInitialBrowserTrackingV2State();
      const legacy = record!.value as unknown as LegacyRuntimeStateV6;
      const queued = await this.readQueuedIntervals();
      const migrated: BrowserTrackingRuntimeStateV2 = {
        ...initial,
        ...legacy,
        version: 8,
        focusTimelineThroughAt: advanceBrowserFocusTimelineThroughAt(
          legacy.confirmedIntervalThrough,
          queued.map((row) => row.interval),
        ),
      };
      await this.writeRuntimeState(migrated);
      return migrated;
    }
    if ((record?.value as unknown as LegacyRuntimeStateV5 | undefined)?.version === 5) {
      const initial = createInitialBrowserTrackingV2State();
      const legacy = record!.value as unknown as LegacyRuntimeStateV5;
      const queued = await this.readQueuedIntervals();
      const migrated: BrowserTrackingRuntimeStateV2 = {
        ...initial,
        ...legacy,
        version: 8,
        snapshotConfirmation: initial.snapshotConfirmation,
        lastIntervalUpload: null,
        confirmedIntervalThrough: null,
        focusTimelineThroughAt: advanceBrowserFocusTimelineThroughAt(
          null,
          queued.map((row) => row.interval),
        ),
        lastRequestId: null,
        diagnostics: [],
        trackingAccess: initial.trackingAccess,
        coverageLimitations: initial.coverageLimitations,
        lastLifecycleObservation: null,
      };
      await this.writeRuntimeState(migrated);
      return migrated;
    }
    if (record) {
      throw new Error(
        `Unsupported Browser tracking runtime state version: ${String((record.value as { version?: unknown }).version ?? "missing")}.`,
      );
    }
    const initial = createInitialBrowserTrackingV2State();
    await this.writeRuntimeState(initial);
    return initial;
  }

  async writeRuntimeState(state: BrowserTrackingRuntimeStateV2) {
    const database = await this.database();
    const transaction = database.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put({
      key: RUNTIME_KEY,
      value: state,
    } satisfies MetaRecord);
    await transactionDone(transaction);
  }

  async persistEngineUpdate(
    intervals: BrowserActivityIntervalV2[],
    state: BrowserTrackingRuntimeStateV2,
    snapshot: BrowserLiveFocusSnapshotV2 | null,
  ): Promise<BrowserTrackingRuntimeStateV2> {
    const database = await this.database();
    const transaction = database.transaction(
      [INTERVAL_STORE, META_STORE],
      "readwrite",
    );
    const intervalStore = transaction.objectStore(INTERVAL_STORE);
    const sequenceIndex = intervalStore.index("sequence");
    const existingCount = await requestAsPromise<number>(intervalStore.count());
    const newIntervals: BrowserActivityIntervalV2[] = [];

    for (const interval of intervals) {
      const byEvent = await requestAsPromise<BrowserV2QueueRecord | undefined>(
        intervalStore.get(interval.clientEventId),
      );
      const bySequence =
        await requestAsPromise<BrowserV2QueueRecord | undefined>(
          sequenceIndex.get([
            interval.stream,
            interval.clockEpochId,
            interval.sequenceNumber,
          ]),
        );
      const existing = byEvent ?? bySequence;
      if (existing) {
        if (
          existing.clientEventId === interval.clientEventId &&
          existing.interval.stream === interval.stream &&
          existing.clockEpochId === interval.clockEpochId &&
          existing.sequenceNumber === interval.sequenceNumber &&
          JSON.stringify(existing.interval) === JSON.stringify(interval)
        ) {
          continue;
        }
        transaction.abort();
        throw new Error(
          "Browser activity event or sequence identity already exists with different content.",
        );
      }
      newIntervals.push(interval);
    }

    assertBrowserQueueCapacity(existingCount, newIntervals.length);
    const nowMs = Date.now();
    for (const interval of newIntervals) {
      intervalStore.add({
        clientEventId: interval.clientEventId,
        clockEpochId: interval.clockEpochId,
        stream: interval.stream,
        sequenceNumber: interval.sequenceNumber,
        interval,
        attempts: 0,
        nextAttemptAtMs: nowMs,
        createdAtMs: nowMs,
      } satisfies BrowserV2QueueRecord);
    }
    const persistedState: BrowserTrackingRuntimeStateV2 = {
      ...state,
      latestSnapshot: snapshot,
      focusTimelineThroughAt: advanceBrowserFocusTimelineThroughAt(
        state.focusTimelineThroughAt,
        newIntervals,
      ),
    };
    transaction.objectStore(META_STORE).put({
      key: RUNTIME_KEY,
      value: persistedState,
    } satisfies MetaRecord);
    await transactionDone(transaction);
    return persistedState;
  }

  async persistOpenRuntimeUpdate(
    intervals: BrowserActivityIntervalV2[],
    state: BrowserTrackingRuntimeStateV2,
  ): Promise<BrowserTrackingRuntimeStateV2> {
    const database = await this.database();
    const transaction = database.transaction(
      [INTERVAL_STORE, META_STORE],
      "readwrite",
    );
    const intervalStore = transaction.objectStore(INTERVAL_STORE);
    const sequenceIndex = intervalStore.index("sequence");
    const existingCount = await requestAsPromise<number>(intervalStore.count());
    const newIntervals: BrowserActivityIntervalV2[] = [];

    for (const interval of intervals) {
      if (interval.stream !== "OPEN_RUNTIME") {
        transaction.abort();
        throw new Error("Only Domain open/runtime intervals can use this persistence path.");
      }
      const byEvent = await requestAsPromise<BrowserV2QueueRecord | undefined>(
        intervalStore.get(interval.clientEventId),
      );
      const bySequence = await requestAsPromise<BrowserV2QueueRecord | undefined>(
        sequenceIndex.get([
          interval.stream,
          interval.clockEpochId,
          interval.sequenceNumber,
        ]),
      );
      const existing = byEvent ?? bySequence;
      if (existing) {
        if (
          existing.clientEventId === interval.clientEventId &&
          existing.interval.stream === interval.stream &&
          existing.clockEpochId === interval.clockEpochId &&
          existing.sequenceNumber === interval.sequenceNumber &&
          JSON.stringify(existing.interval) === JSON.stringify(interval)
        ) {
          continue;
        }
        transaction.abort();
        throw new Error(
          "Browser activity event or sequence identity already exists with different content.",
        );
      }
      newIntervals.push(interval);
    }

    assertBrowserQueueCapacity(existingCount, newIntervals.length);
    const nowMs = Date.now();
    for (const interval of newIntervals) {
      intervalStore.add({
        clientEventId: interval.clientEventId,
        clockEpochId: interval.clockEpochId,
        stream: interval.stream,
        sequenceNumber: interval.sequenceNumber,
        interval,
        attempts: 0,
        nextAttemptAtMs: nowMs,
        createdAtMs: nowMs,
      } satisfies BrowserV2QueueRecord);
    }
    const persistedState: BrowserTrackingRuntimeStateV2 = {
      ...state,
      openRuntimeTimelineThroughAt: advanceBrowserTimelineThroughAt(
        state.openRuntimeTimelineThroughAt,
        newIntervals,
        "OPEN_RUNTIME",
      ),
    };
    transaction.objectStore(META_STORE).put({
      key: RUNTIME_KEY,
      value: persistedState,
    } satisfies MetaRecord);
    await transactionDone(transaction);
    return persistedState;
  }

  private async readQueuedIntervals() {
    const database = await this.database();
    const transaction = database.transaction(INTERVAL_STORE, "readonly");
    const records = await requestAsPromise<BrowserV2QueueRecord[]>(
      transaction.objectStore(INTERVAL_STORE).getAll(),
    );
    await transactionDone(transaction);
    return records;
  }

  async readReadyIntervals(
    limit: number,
    nowMs = Date.now(),
  ): Promise<BrowserV2QueueRecord[]> {
    const database = await this.database();
    const transaction = database.transaction(INTERVAL_STORE, "readonly");
    const records = await requestAsPromise<BrowserV2QueueRecord[]>(
      transaction
        .objectStore(INTERVAL_STORE)
        .index("nextAttemptAtMs")
        .getAll(IDBKeyRange.upperBound(nowMs)),
    );
    await transactionDone(transaction);
    return records
      .sort(
        (left, right) =>
          left.nextAttemptAtMs - right.nextAttemptAtMs ||
          left.createdAtMs - right.createdAtMs ||
          left.sequenceNumber - right.sequenceNumber,
      )
      .slice(0, limit);
  }

  async applySyncResults(
    results: TrackingSyncItemResultV2[],
    requestId: string,
    rejectedAtMs = Date.now(),
  ) {
    if (results.length === 0) return;
    const database = await this.database();
    const transaction = database.transaction(
      [INTERVAL_STORE, DEAD_LETTER_STORE],
      "readwrite",
    );
    const intervalStore = transaction.objectStore(INTERVAL_STORE);
    const deadLetterStore = transaction.objectStore(DEAD_LETTER_STORE);

    for (const result of results) {
      const record = await requestAsPromise<BrowserV2QueueRecord | undefined>(
        intervalStore.get(result.clientEventId),
      );
      if (
        result.status === "ACCEPTED" ||
        result.status === "DUPLICATE"
      ) {
        intervalStore.delete(result.clientEventId);
      }
      if (result.status === "REJECTED" && result.terminal) {
        if (record) {
          deadLetterStore.put({
            clientEventId: record.clientEventId,
            clockEpochId: record.clockEpochId,
            sequenceNumber: record.sequenceNumber,
            metric: record.interval.metric,
            rejectionCode: safeRejectionCode(result.rejectionCode),
            requestId,
            rejectedAtMs,
          } satisfies BrowserV2DeadLetterRecord);
        }
        intervalStore.delete(result.clientEventId);
      } else if (result.status === "REJECTED" && record) {
        const attempts = record.attempts + 1;
        intervalStore.put({
          ...record,
          attempts,
          nextAttemptAtMs: calculateBrowserRetryAt(rejectedAtMs, attempts),
        });
      }
    }

    const deadLetters = await requestAsPromise<BrowserV2DeadLetterRecord[]>(
      deadLetterStore.getAll(),
    );
    const retained = deadLetters
      .filter((row) => row.rejectedAtMs >= rejectedAtMs - BROWSER_V2_DEAD_LETTER_RETENTION_MS)
      .sort((left, right) => right.rejectedAtMs - left.rejectedAtMs)
      .slice(0, BROWSER_V2_DEAD_LETTER_CAPACITY);
    const retainedIds = new Set(retained.map((row) => row.clientEventId));
    for (const row of deadLetters) {
      if (!retainedIds.has(row.clientEventId)) deadLetterStore.delete(row.clientEventId);
    }
    await transactionDone(transaction);
  }

  async retry(
    clientEventIds: readonly string[],
    nowMs = Date.now(),
  ) {
    if (clientEventIds.length === 0) return;
    const database = await this.database();
    const transaction = database.transaction(INTERVAL_STORE, "readwrite");
    const store = transaction.objectStore(INTERVAL_STORE);
    for (const clientEventId of clientEventIds) {
      const record = await requestAsPromise<BrowserV2QueueRecord | undefined>(
        store.get(clientEventId),
      );
      if (!record) continue;
      const attempts = record.attempts + 1;
      store.put({
        ...record,
        attempts,
        nextAttemptAtMs: calculateBrowserRetryAt(nowMs, attempts),
      });
    }
    await transactionDone(transaction);
  }

  async stats(nowMs = Date.now()): Promise<BrowserV2QueueStats> {
    const database = await this.database();
    const transaction = database.transaction(
      [INTERVAL_STORE, DEAD_LETTER_STORE],
      "readonly",
    );
    const records = await requestAsPromise<BrowserV2QueueRecord[]>(
      transaction.objectStore(INTERVAL_STORE).getAll(),
    );
    const deadLetters = (
      await requestAsPromise<BrowserV2DeadLetterRecord[]>(
        transaction.objectStore(DEAD_LETTER_STORE).getAll(),
      )
    ).filter(
      (row) => row.rejectedAtMs >= nowMs - BROWSER_V2_DEAD_LETTER_RETENTION_MS,
    );
    await transactionDone(transaction);
    const oldest = records.reduce<number | null>(
      (value, row) =>
        value === null ? row.createdAtMs : Math.min(value, row.createdAtMs),
      null,
    );
    const nextRetry = records.reduce<number | null>(
      (value, row) =>
        value === null
          ? row.nextAttemptAtMs
          : Math.min(value, row.nextAttemptAtMs),
      null,
    );
    const runtime = await this.readRuntimeState();
    const deadLetterByCode: Record<string, number> = {};
    for (const row of deadLetters) {
      deadLetterByCode[row.rejectionCode] =
        (deadLetterByCode[row.rejectionCode] ?? 0) + 1;
    }
    if (runtime.terminalRejections > 0) {
      deadLetterByCode.LEGACY_UNATTRIBUTED = runtime.terminalRejections;
    }
    return {
      pending: records.length,
      ready: records.filter((row) => row.nextAttemptAtMs <= nowMs).length,
      deadLetter: deadLetters.length + runtime.terminalRejections,
      oldestQueuedAt: oldest === null ? null : new Date(oldest).toISOString(),
      nextRetryAt:
        nextRetry === null ? null : new Date(nextRetry).toISOString(),
      deadLetterByCode,
    };
  }

  async hasCapacity(additionalRows = 1) {
    const database = await this.database();
    const transaction = database.transaction(INTERVAL_STORE, "readonly");
    const count = await requestAsPromise<number>(
      transaction.objectStore(INTERVAL_STORE).count(),
    );
    await transactionDone(transaction);
    return count + additionalRows <= BROWSER_V2_QUEUE_CAPACITY;
  }

  async close() {
    if (!this.databasePromise) return;
    const database = await this.databasePromise;
    database.close();
    this.databasePromise = null;
  }

  async reset() {
    // Options and the MV3 worker are separate extension contexts and may both
    // have this database open during pairing. Deleting the database can then
    // remain blocked before the worker re-initializes. Clearing all stores in
    // one transaction preserves the schema and serializes safely with readers.
    const database = await this.database();
    const transaction = database.transaction(
      [INTERVAL_STORE, DEAD_LETTER_STORE, META_STORE],
      "readwrite",
    );
    transaction.objectStore(INTERVAL_STORE).clear();
    transaction.objectStore(DEAD_LETTER_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    await transactionDone(transaction);
  }

  private database() {
    this.databasePromise ??= openDatabase();
    return this.databasePromise;
  }
}

export function assertBrowserQueueCapacity(
  currentRows: number,
  additionalRows: number,
) {
  if (currentRows + additionalRows > BROWSER_V2_QUEUE_CAPACITY) {
    throw new BrowserV2QueuePressureError(
      `Browser activity queue reached its ${BROWSER_V2_QUEUE_CAPACITY}-event limit. Tracking is paused until queued history uploads.`,
    );
  }
}

export function calculateBrowserRetryAt(nowMs: number, attempts: number) {
  const delayMs = Math.min(
    5 * 60_000,
    5_000 * 2 ** Math.min(Math.max(0, attempts - 1), 6),
  );
  return nowMs + delayMs;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INTERVAL_STORE)) {
        const intervals = database.createObjectStore(INTERVAL_STORE, {
          keyPath: "clientEventId",
        });
        intervals.createIndex(
          "sequence",
          ["stream", "clockEpochId", "sequenceNumber"],
          { unique: true },
        );
        intervals.createIndex("nextAttemptAtMs", "nextAttemptAtMs");
        intervals.createIndex("createdAtMs", "createdAtMs");
      } else if ((event as IDBVersionChangeEvent).oldVersion < 3) {
        const intervals = request.transaction!.objectStore(INTERVAL_STORE);
        if (intervals.indexNames.contains("sequence")) {
          intervals.deleteIndex("sequence");
        }
        intervals.createIndex(
          "sequence",
          ["stream", "clockEpochId", "sequenceNumber"],
          { unique: true },
        );
        const cursorRequest = intervals.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const value = cursor.value as BrowserV2QueueRecord & {
            stream?: BrowserActivityIntervalV2["stream"];
          };
          if (!value.stream) {
            cursor.update({
              ...value,
              stream: value.interval?.stream ?? "FOCUS",
            });
          }
          cursor.continue();
        };
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(DEAD_LETTER_STORE)) {
        const deadLetters = database.createObjectStore(DEAD_LETTER_STORE, {
          keyPath: "clientEventId",
        });
        deadLetters.createIndex("rejectedAtMs", "rejectedAtMs");
        deadLetters.createIndex("rejectionCode", "rejectionCode");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onblocked = () =>
      reject(new Error("IndexedDB upgrade is blocked by another extension worker."));
  });
}

function safeRejectionCode(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z0-9_]{1,80}$/.test(normalized)
    ? normalized
    : "REJECTED";
}

function requestAsPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}
