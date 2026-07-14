import assert from "node:assert/strict";
import test from "node:test";
import { ExtensionApiError, sendDomainUsage, sendExtensionStatus } from "../src/extensionApi.js";
import {
  enqueueDomainEvents,
  enqueueStatusEvent,
  MAX_EXTENSION_QUEUE,
  retryDomainEvents,
  retryStatusEvents,
} from "../src/extensionStorage.js";
import type { DomainUsageEvent } from "../src/domainTracking.js";

test("domain API uses device credential and classifies auth failure", async () => {
  const originalFetch = globalThis.fetch;
  let captured = "";
  globalThis.fetch = async (_input, init) => {
    captured = String(init?.body);
    assert.equal(new Headers(init?.headers).get("authorization"), "Device wmdev_test");
    return new Response("forbidden", { status: 401 });
  };
  await assert.rejects(
    () => sendDomainUsage({ apiBaseUrl: "https://api.test", credential: "wmdev_test", deviceId: "d", browserName: "CHROME" }, [event(1)]),
    (error: unknown) => error instanceof ExtensionApiError && error.status === 401,
  );
  assert(!captured.includes("/private/path"));
  globalThis.fetch = originalFetch;
});

test("queue dedupes stable ids, applies backoff and enforces capacity", () => {
  let queue = enqueueDomainEvents([], [event(1), event(1)], 1_000);
  assert.equal(queue.length, 1);
  queue = retryDomainEvents(queue, new Set([event(1).clientEventId]), 1_000);
  assert(queue[0]!.nextAttemptAtMs > 1_000);
  queue = enqueueDomainEvents(queue, Array.from({ length: MAX_EXTENSION_QUEUE + 5 }, (_, index) => event(index + 10)), 2_000);
  assert.equal(queue.length, MAX_EXTENSION_QUEUE);
});

test("status API uses the scoped device credential and status queue persists retry identity", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    assert.equal(new Headers(init?.headers).get("authorization"), "Device wmdev_test");
    return new Response(JSON.stringify({ id: "event" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await sendExtensionStatus(
      { apiBaseUrl: "https://api.test", credential: "wmdev_test", deviceId: "d", browserName: "CHROME" },
      statusEvent(1),
    );
    assert(requestBody.includes("NETWORK_OFFLINE"));
    assert(!requestBody.includes("wmdev_test"));

    let queue = enqueueStatusEvent([], statusEvent(1), 1_000);
    queue = enqueueStatusEvent(queue, statusEvent(1), 1_000);
    assert.equal(queue.length, 1);
    queue = retryStatusEvents(queue, new Set([statusEvent(1).clientEventId]), 1_000);
    assert(queue[0]!.nextAttemptAtMs > 1_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function event(index: number): DomainUsageEvent {
  return {
    clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    deviceId: "22222222-2222-4222-8222-222222222222",
    domain: "example.com",
    browserName: "CHROME",
    startedAt: "2026-06-18T00:00:00.000Z",
    endedAt: "2026-06-18T00:00:05.000Z",
    durationSeconds: 5,
    isIdle: false,
    isActiveWindow: true,
  };
}

function statusEvent(index: number) {
  return {
    clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    deviceId: "22222222-2222-4222-8222-222222222222",
    status: "NETWORK_OFFLINE" as const,
    reason: "NETWORK_UNAVAILABLE" as const,
    startedAt: "2026-06-18T00:00:00.000Z",
    recordedAt: "2026-06-18T00:00:00.000Z",
    timeZone: "Australia/Adelaide",
    confidence: "CONFIRMED" as const,
  };
}
