import assert from "node:assert/strict";
import test from "node:test";
import {
  ExtensionApiError,
  sendDomainUsage,
  sendExtensionStatus,
  syncTrackingV2,
} from "../src/extensionApi.js";
import {
  enqueueDomainEvents,
  enqueueStatusEvent,
  MAX_EXTENSION_QUEUE,
  retryDomainEvents,
  retryStatusEvents,
} from "../src/extensionStorage.js";
import type { DomainUsageEvent } from "../src/domainTracking.js";
import type { BrowserTrackingSyncRequestV2 } from "../src/trackingV2Types.js";

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
    assert(requestBody.includes('"protocolVersion":2'));
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

test("v2 sync correlates successful and failed requests without retaining credentials", async () => {
  const originalFetch = globalThis.fetch;
  const requestId = "extension-test-request-1";
  try {
    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-workmap-request-id"), requestId);
      assert.equal(headers.get("authorization"), "Device wmdev_test");
      return Response.json({
        results: [],
        cursors: [],
        acceptedSnapshotSequence: null,
        focusSnapshotResult: {
          status: "REJECTED",
          rejectionCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
          message: "Outside the policy window.",
        },
        serverTime: "2026-07-21T00:00:00.000Z",
        activePolicyVersion: "v1",
        activePolicyLeaseId: "lease-1",
        requestId,
      });
    };
    const response = await syncTrackingV2(config(), syncBody(), requestId);
    assert.equal(response.requestId, requestId);
    assert.deepEqual(response.focusSnapshotResult, {
      status: "REJECTED",
      rejectionCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
      message: "Outside the policy window.",
    });

    for (const status of [401, 403, 408, 429, 500, 503]) {
      globalThis.fetch = async () => Response.json({
        message: "credential wmdev_leaked should be removed",
        requestId: `api-${status}`,
        reasonCode: status === 429 ? "RATE_LIMITED" : "SYNC_FAILED",
        stage: "sync-v2",
        retryable: status === 408 || status === 429 || status >= 500,
        remediation: "Retry after policy refresh.",
      }, { status });
      await assert.rejects(
        () => syncTrackingV2(config(), syncBody(), requestId),
        (error: unknown) => {
          assert(error instanceof ExtensionApiError);
          assert.equal(error.status, status);
          assert.equal(error.detail.requestId, `api-${status}`);
          assert(!error.message.includes("wmdev_leaked"));
          assert(error.message.includes("[credential]"));
          return true;
        },
      );
    }
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
    protocolVersion: 2 as const,
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

function config() {
  return {
    apiBaseUrl: "https://api.test",
    credential: "wmdev_test",
    deviceId: "22222222-2222-4222-8222-222222222222",
    browserName: "CHROME" as const,
  };
}

function syncBody(): BrowserTrackingSyncRequestV2 {
  return {
    protocolVersion: 2,
    protocolActivatedAt: "2026-07-20T00:00:00.000Z",
    clientInstanceId: "33333333-3333-4333-8333-333333333333",
    sentAt: "2026-07-21T00:00:00.000Z",
    intervals: [],
    health: {
      clientType: "BROWSER_EXTENSION",
      clientVersion: "browser-extension-mv3/0.5.7",
      platform: "CHROME",
      connectionState: "ONLINE",
      collectorState: "HEALTHY",
      policyState: "ACTIVE",
      migrationState: "V2_ACTIVE",
      queue: {
        pending: 0,
        ready: 0,
        deadLetter: 0,
        oldestQueuedAt: null,
        nextRetryAt: null,
      },
      lastSuccessfulHeartbeatAt: null,
      lastSuccessfulSyncAt: null,
      errorCode: "NONE",
    },
  };
}
