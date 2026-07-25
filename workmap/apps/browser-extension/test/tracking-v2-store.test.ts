import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertBrowserQueueCapacity,
  BrowserTrackingV2Store,
  BrowserV2QueuePressureError,
  calculateBrowserRetryAt,
} from "../src/trackingV2Store.js";
import {
  BROWSER_V2_QUEUE_CAPACITY,
  createInitialBrowserTrackingV2State,
} from "../src/trackingV2Types.js";

test("v2 queue is bounded without silently evicting retained history", () => {
  assert.equal(BROWSER_V2_QUEUE_CAPACITY, 10_000);
  assert.doesNotThrow(() =>
    assertBrowserQueueCapacity(BROWSER_V2_QUEUE_CAPACITY - 1, 1),
  );
  assert.throws(
    () => assertBrowserQueueCapacity(BROWSER_V2_QUEUE_CAPACITY, 1),
    BrowserV2QueuePressureError,
  );
});

test("retry backoff is bounded and does not spin", () => {
  const now = 1_000;
  assert.equal(calculateBrowserRetryAt(now, 1), now + 5_000);
  assert.equal(calculateBrowserRetryAt(now, 2), now + 10_000);
  assert.equal(calculateBrowserRetryAt(now, 99), now + 5 * 60_000);
});

test("current v8 runtime state round-trips without being replaced by initial state", async () => {
  const expected = {
    ...createInitialBrowserTrackingV2State(),
    protocolActivatedAt: "2026-07-25T03:30:00.000Z",
    lastSuccessfulHeartbeatAt: "2026-07-25T03:31:00.000Z",
    lastSuccessfulSyncAt: "2026-07-25T03:31:00.000Z",
    confirmedIntervalThrough: "2026-07-25T03:30:40.000Z",
    lastRequestId: "runtime-v8-round-trip",
  };
  let writes = 0;
  const transaction = {
    error: null,
    oncomplete: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onabort: null as ((event: Event) => void) | null,
    objectStore(name: string) {
      assert.equal(name, "meta");
      return {
        get(key: string) {
          assert.equal(key, "runtime");
          const request = {
            result: { key: "runtime", value: expected },
            error: null,
            onsuccess: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
          };
          queueMicrotask(() => {
            request.onsuccess?.(new Event("success"));
            queueMicrotask(() => transaction.oncomplete?.(new Event("complete")));
          });
          return request;
        },
        put() {
          writes += 1;
        },
      };
    },
  };
  const database = {
    transaction(storeName: string, mode: IDBTransactionMode) {
      assert.equal(storeName, "meta");
      assert.equal(mode, "readonly");
      return transaction;
    },
  } as unknown as IDBDatabase;
  const store = new BrowserTrackingV2Store();
  (
    store as unknown as {
      databasePromise: Promise<IDBDatabase>;
    }
  ).databasePromise = Promise.resolve(database);

  assert.deepEqual(await store.readRuntimeState(), expected);
  assert.equal(writes, 0, "reading current state must never overwrite it");
});

test("pairing reset clears every store without deleting an open multi-context database", async () => {
  const cleared: string[] = [];
  const transaction = {
    error: null,
    oncomplete: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onabort: null as ((event: Event) => void) | null,
    objectStore(name: string) {
      return {
        clear() {
          cleared.push(name);
        },
      };
    },
  };
  const database = {
    transaction(storeNames: string[], mode: IDBTransactionMode) {
      assert.deepEqual(storeNames, ["intervals", "deadLetters", "meta"]);
      assert.equal(mode, "readwrite");
      queueMicrotask(() => transaction.oncomplete?.(new Event("complete")));
      return transaction;
    },
  } as unknown as IDBDatabase;
  const store = new BrowserTrackingV2Store();
  (
    store as unknown as {
      databasePromise: Promise<IDBDatabase>;
    }
  ).databasePromise = Promise.resolve(database);

  await store.reset();

  assert.deepEqual(cleared, ["intervals", "deadLetters", "meta"]);
});

test("IndexedDB queue uses atomic state/event writes and dual unique identity", async () => {
  const source = await readFile(
    new URL("../src/trackingV2Store.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /transaction\(\s*\[INTERVAL_STORE, META_STORE\],\s*"readwrite"/,
  );
  assert.match(source, /keyPath: "clientEventId"/);
  assert.match(source, /\["stream", "clockEpochId", "sequenceNumber"\]/);
  assert.match(source, /\{ unique: true \}/);
  assert.match(source, /DEAD_LETTER_STORE/);
  assert.match(source, /requestId/);
  assert.match(source, /BROWSER_V2_DEAD_LETTER_RETENTION_MS/);
  assert.match(source, /LegacyRuntimeStateV6/);
  assert.match(source, /focusTimelineThroughAt/);
  assert.match(source, /advanceBrowserFocusTimelineThroughAt/);
  assert.doesNotMatch(source, /deleteDatabase/);
  assert.doesNotMatch(source, /\.slice\(-BROWSER_V2_QUEUE_CAPACITY\)/);
  assert.doesNotMatch(source, /delete\(.*oldest/i);
});
