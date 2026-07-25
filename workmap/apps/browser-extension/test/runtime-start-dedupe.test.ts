import assert from "node:assert/strict";
import test from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";

test("duplicate startup callbacks for one Browser boot enqueue one durable profile-start event", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;
  let stored: Record<string, unknown> = {
    workmapStatus: {
      state: "connected",
      queuedEvents: 0,
    },
    workmapStatusQueue: [],
  };
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: (
          keys: string[] | string,
          callback: (items: Record<string, unknown>) => void,
        ) => {
          const requested = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(
            requested
              .filter((key) => key in stored)
              .map((key) => [key, stored[key]]),
          ));
        },
        set: (
          items: Record<string, unknown>,
          callback?: () => void,
        ) => {
          stored = { ...stored, ...items };
          callback?.();
        },
      },
    },
  };

  try {
    const runtime = new BrowserExtensionRuntimeV2({} as never) as unknown as {
      config: {
        apiBaseUrl: string;
        credential: string;
        deviceId: string;
        browserName: string;
      };
      state: {
        protocolActivatedAt: string;
        lastSuccessfulHeartbeatAt: null;
        trackingAccess: {
          contentRegistration: "REGISTERED";
        };
      };
      ensureInitialized(): Promise<void>;
      flushStatusQueue(): Promise<boolean>;
      requestSync(immediate: boolean): Promise<void>;
      handleRuntimeStarted(operation: "profile-start" | "extension-update"): Promise<void>;
    };
    runtime.config = {
      apiBaseUrl: "https://api.example",
      credential: "not-sent",
      deviceId: "11111111-1111-4111-8111-111111111111",
      browserName: "EDGE",
    };
    runtime.state = {
      protocolActivatedAt: "2026-07-25T00:00:00.000Z",
      lastSuccessfulHeartbeatAt: null,
      trackingAccess: {
        contentRegistration: "REGISTERED",
      },
    };
    let flushes = 0;
    let syncs = 0;
    runtime.ensureInitialized = async () => undefined;
    runtime.flushStatusQueue = async () => {
      flushes += 1;
      return true;
    };
    runtime.requestSync = async () => {
      syncs += 1;
    };

    await runtime.handleRuntimeStarted("profile-start");
    await runtime.handleRuntimeStarted("profile-start");

    const queue = stored.workmapStatusQueue as Array<{
      event: {
        status: string;
        reason: string;
        metadata?: { operation?: string };
      };
    }>;
    const status = stored.workmapStatus as {
      runtimeStartGuard?: { deviceId: string; observedAtMs: number };
    };
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.event.status, "RESTARTED");
    assert.equal(queue[0]?.event.reason, "AGENT_RESTART");
    assert.equal(queue[0]?.event.metadata?.operation, "profile-start");
    assert.equal(status.runtimeStartGuard?.deviceId, runtime.config.deviceId);
    assert(Number.isFinite(status.runtimeStartGuard?.observedAtMs));
    assert.equal(flushes, 1);
    assert.equal(syncs, 1);
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome;
    } else {
      (globalThis as { chrome?: unknown }).chrome = originalChrome;
    }
  }
});
