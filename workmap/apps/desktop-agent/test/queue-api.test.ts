import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentApiError, sendAppUsage, sendHeartbeat, startAgentSession, stopAgentSession, waitForApiReady } from "../src/apiClient.js";
import { EVENT_QUEUE_CAPACITY, FileEventQueue } from "../src/fileStore.js";
import { shouldSendHeartbeat } from "../src/runtime.js";
import type { AgentConfig, AppUsageEvent } from "../src/types.js";

const config: AgentConfig = {
  apiBaseUrl: "https://api.workmap.test",
  credential: "wmdev_test_credential",
  deviceId: "11111111-1111-4111-8111-111111111111",
  agentVersion: "test",
};

test("device API uses scoped credential and payload has no title or content", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; authorization: string | null; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    requests.push({ path, authorization: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(path.endsWith("/start") ? { sessionId: "session-1", startedAt: new Date().toISOString() } : { accepted: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const session = await startAgentSession(config);
    await sendHeartbeat(config, session.sessionId, {
      appName: "Visual Studio Code",
      startedAt: "2026-06-18T00:00:00.000Z",
      lastObservedAt: "2026-06-18T00:00:10.000Z",
      activeSeconds: 10,
      isIdle: false,
    });
    await sendAppUsage(config, [event(1)]);
    await stopAgentSession(config, session.sessionId);
    assert.deepEqual(requests.map((item) => item.path), ["/device-client/session/start", "/device-client/heartbeat", "/device-client/app-usage", "/device-client/session/stop"]);
    assert(requests.every((item) => item.authorization === `Device ${config.credential}`));
    const payload = JSON.stringify(requests[1]?.body);
    assert(!payload.includes("windowTitle"));
    assert(!payload.includes("content"));
  } finally { globalThis.fetch = originalFetch; }
});

test("API distinguishes auth and network failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("forbidden", { status: 403 });
  await assert.rejects(() => sendHeartbeat(config), (error: unknown) => error instanceof AgentApiError && error.status === 403);
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(() => sendHeartbeat(config), (error: unknown) => error instanceof AgentApiError && error.status === undefined);
  globalThis.fetch = originalFetch;
});

test("pairing readiness warms the deployed API before code exchange", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; method?: string } | null = null;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), method: init?.method };
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };
  try {
    await waitForApiReady(config.apiBaseUrl);
    assert.deepEqual(request, { url: `${config.apiBaseUrl}/health`, method: "GET" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("persistent queue retries, acknowledges and enforces capacity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workmap-agent-test-"));
  const filePath = join(directory, "queue.json");
  try {
    const queue = new FileEventQueue(filePath);
    await queue.load(1_000);
    await queue.enqueue(event(1), 1_000);
    await queue.retry([event(1).clientEventId], 1_000);
    assert.equal(queue.listReady(1_001).length, 0);
    await queue.load(100_000);
    assert.equal(JSON.parse(await readFile(filePath, "utf8")).length, 1);
    await queue.acknowledge([event(1).clientEventId]);
    assert.equal(queue.size(), 0);
    await queue.enqueueMany(Array.from({ length: EVENT_QUEUE_CAPACITY + 5 }, (_, index) => event(index + 10)), 100_000);
    assert.equal(queue.size(), EVENT_QUEUE_CAPACITY);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("an app transition triggers an immediate heartbeat before the next scheduled interval", () => {
  assert.equal(shouldSendHeartbeat(1, 5_000, 10_000), true);
  assert.equal(shouldSendHeartbeat(0, 5_000, 10_000), false);
  assert.equal(shouldSendHeartbeat(0, 10_000, 10_000), true);
});

function event(index: number): AppUsageEvent {
  return {
    clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    deviceId: config.deviceId,
    appName: "Code",
    startedAt: "2026-06-18T00:00:00.000Z",
    endedAt: "2026-06-18T00:00:05.000Z",
    durationSeconds: 5,
    isIdle: false,
    isActiveWindow: true,
  };
}
