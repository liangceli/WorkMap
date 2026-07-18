import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertBrowserQueueCapacity,
  BrowserV2QueuePressureError,
  calculateBrowserRetryAt,
} from "../src/trackingV2Store.js";
import { BROWSER_V2_QUEUE_CAPACITY } from "../src/trackingV2Types.js";

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
  assert.match(source, /\["clockEpochId", "sequenceNumber"\]/);
  assert.match(source, /\{ unique: true \}/);
  assert.doesNotMatch(source, /\.slice\(-BROWSER_V2_QUEUE_CAPACITY\)/);
  assert.doesNotMatch(source, /delete\(.*oldest/i);
});
