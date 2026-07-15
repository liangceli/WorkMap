import assert from "node:assert/strict";
import test from "node:test";
import { createSingleFlightTtlCache } from "../lib/api/apiAuth.js";

test("authentication context cache de-duplicates concurrent lookups and reuses a fresh result", async () => {
  let now = 100;
  let requestCount = 0;
  const cache = createSingleFlightTtlCache(8_000, () => now);
  const load = async () => {
    requestCount += 1;
    return { role: "OWNER" };
  };

  const [first, second] = await Promise.all([cache.get("user-a", load), cache.get("user-a", load)]);
  assert.deepEqual(first, { role: "OWNER" });
  assert.deepEqual(second, { role: "OWNER" });
  assert.equal(requestCount, 1);

  await cache.get("user-a", load);
  assert.equal(requestCount, 1);

  now += 8_001;
  await cache.get("user-a", load);
  assert.equal(requestCount, 2);
});

test("authentication context cache does not retain a transient failed mapping", async () => {
  let requestCount = 0;
  const cache = createSingleFlightTtlCache(8_000, () => 100, (result: { available: boolean }) => result.available);
  const load = async () => {
    requestCount += 1;
    return { available: false };
  };

  await cache.get("user-a", load);
  await cache.get("user-a", load);
  assert.equal(requestCount, 2);
});
