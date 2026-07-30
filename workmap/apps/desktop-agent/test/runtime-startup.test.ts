import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeStartupRetrier } from "../src/runtimeStartup.js";

type TestConfig = { deviceId: string };

test("runtime startup retries a transient missing protected config without a process restart", async () => {
  let configReads = 0;
  let started = false;
  const retrier = new RuntimeStartupRetrier<TestConfig>({
    loadConfig: async () => {
      configReads += 1;
      return configReads === 1 ? null : { deviceId: "device-1" };
    },
    start: async (config) => {
      assert.equal(config.deviceId, "device-1");
      started = true;
    },
    isStarted: () => started,
    retryDelaysMs: [5],
  });

  assert.equal(await retrier.ensure(), false);
  await waitFor(() => started);
  assert.equal(configReads, 2);
  assert.equal(retrier.failure(), null);
});

test("a later successful UI config read can self-heal after the bounded retry budget", async () => {
  let started = false;
  const retrier = new RuntimeStartupRetrier<TestConfig>({
    loadConfig: async () => null,
    start: async () => {
      started = true;
    },
    isStarted: () => started,
    retryDelaysMs: [],
  });

  assert.equal(await retrier.ensure(), false);
  assert.notEqual(retrier.failure(), null);
  assert.equal(await retrier.ensure({ deviceId: "device-1" }), true);
  assert.equal(started, true);
  assert.equal(retrier.failure(), null);
});

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 500;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(predicate(), true, "Timed out waiting for the runtime startup retry.");
}
