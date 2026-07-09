import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentApiError,
  isInactiveAgentSessionError,
  sendAppUsage,
  sendHeartbeat,
  startAgentSession,
  stopAgentSession,
  waitForApiReady,
} from "../src/apiClient.js";
import { EVENT_QUEUE_CAPACITY, FileEventQueue } from "../src/fileStore.js";
import { DesktopAgentRuntime, shouldSendHeartbeat } from "../src/runtime.js";
import type { AgentConfig, AppUsageEvent, ForegroundSample } from "../src/types.js";
import type { WindowsForegroundAdapter } from "../src/windowsForeground.js";

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
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Agent session is not active for this device." }), { status: 403 });
    await assert.rejects(() => sendHeartbeat(config), (error: unknown) =>
      error instanceof AgentApiError
      && error.status === 403
      && error.responseMessage === "Agent session is not active for this device."
      && isInactiveAgentSessionError(error));
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(() => sendHeartbeat(config), (error: unknown) => error instanceof AgentApiError && error.status === undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("runtime keeps sending heartbeat when foreground sampling fails after startup or wake", async () => {
  await withRuntimeEnvironment(async (directory) => {
    const originalFetch = globalThis.fetch;
    let heartbeatCalls = 0;
    globalThis.fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/device-client/session/start") {
        return jsonResponse({ sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", startedAt: new Date().toISOString() });
      }
      if (path === "/device-client/heartbeat") {
        heartbeatCalls += 1;
        return jsonResponse({ device: { id: config.deviceId }, sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
      }
      if (path === "/device-client/session/stop") {
        return jsonResponse({ sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", endedAt: new Date().toISOString() });
      }
      return jsonResponse({ accepted: 0 });
    };

    try {
      const runtime = new DesktopAgentRuntime(config, {
        adapter: fakeAdapter(async () => { throw new Error("foreground sampler unavailable"); }),
        queue: new FileEventQueue(join(directory, "queue.json")),
      });
      const run = runtime.run();
      await waitUntil(() => heartbeatCalls > 0);
      await runtime.shutdown();
      await run;
      assert.equal(heartbeatCalls > 0, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("runtime recreates an inactive agent session instead of requiring re-pair", async () => {
  await withRuntimeEnvironment(async (directory) => {
    const originalFetch = globalThis.fetch;
    let startCalls = 0;
    const heartbeatSessions: string[] = [];
    globalThis.fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/device-client/session/start") {
        startCalls += 1;
        return jsonResponse({ sessionId: sessionId(startCalls), startedAt: new Date().toISOString() });
      }
      if (path === "/device-client/heartbeat") {
        const body = JSON.parse(String(init?.body)) as { sessionId?: string };
        heartbeatSessions.push(body.sessionId ?? "");
        if (heartbeatSessions.length === 1) {
          return jsonResponse({ message: "Agent session is not active for this device." }, 403);
        }
        return jsonResponse({ device: { id: config.deviceId }, sessionId: body.sessionId ?? null });
      }
      if (path === "/device-client/session/stop") {
        return jsonResponse({ sessionId: sessionId(startCalls), endedAt: new Date().toISOString() });
      }
      return jsonResponse({ accepted: 0 });
    };

    try {
      const runtime = new DesktopAgentRuntime(config, {
        adapter: fakeAdapter(async () => sample("Microsoft Edge")),
        queue: new FileEventQueue(join(directory, "queue.json")),
      });
      const run = runtime.run();
      await waitUntil(() => heartbeatSessions.length >= 2);
      await runtime.shutdown();
      await run;

      assert.equal(startCalls, 2);
      assert.deepEqual(heartbeatSessions, [sessionId(1), sessionId(2)]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
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

async function withRuntimeEnvironment(action: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "workmap-agent-runtime-test-"));
  const previousLocalAppData = process.env.LOCALAPPDATA;
  const previousSampleInterval = process.env.WORKMAP_AGENT_SAMPLE_INTERVAL_MS;
  const previousHeartbeatInterval = process.env.WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS;
  const previousCheckpointInterval = process.env.WORKMAP_AGENT_CHECKPOINT_INTERVAL_MS;
  process.env.LOCALAPPDATA = directory;
  process.env.WORKMAP_AGENT_SAMPLE_INTERVAL_MS = "5";
  process.env.WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS = "20";
  process.env.WORKMAP_AGENT_CHECKPOINT_INTERVAL_MS = "20";
  try {
    await action(directory);
  } finally {
    restoreEnv("LOCALAPPDATA", previousLocalAppData);
    restoreEnv("WORKMAP_AGENT_SAMPLE_INTERVAL_MS", previousSampleInterval);
    restoreEnv("WORKMAP_AGENT_HEARTBEAT_INTERVAL_MS", previousHeartbeatInterval);
    restoreEnv("WORKMAP_AGENT_CHECKPOINT_INTERVAL_MS", previousCheckpointInterval);
    await rm(directory, { recursive: true, force: true });
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function fakeAdapter(sampleFn: () => Promise<ForegroundSample>) {
  return {
    sample: sampleFn,
    stop: () => undefined,
  } as unknown as WindowsForegroundAdapter;
}

function sample(appName: string): ForegroundSample {
  return {
    appName,
    openAppNames: [appName],
    isIdle: false,
    isLocked: false,
    observedAtMs: Date.now(),
    lastInputAtMs: Date.now(),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1_500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Timed out waiting for runtime condition.");
}

function sessionId(index: number) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
}
