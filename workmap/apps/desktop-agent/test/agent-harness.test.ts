import assert from "node:assert/strict";
import { registerAgentDevice, sendAppUsage, sendHeartbeat } from "../src/index.js";

type RecordedRequest = {
  path: string;
  authorization: string | null;
  body: unknown;
};

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;
const recordedRequests: RecordedRequest[] = [];

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const body = init?.body ? JSON.parse(String(init.body)) : null;

  recordedRequests.push({
    path: url.pathname,
    authorization: new Headers(init?.headers).get("authorization"),
    body,
  });

  if (url.pathname === "/devices/register" || url.pathname === "/devices/heartbeat") {
    return jsonResponse({ device: { id: DEVICE_ID } });
  }

  if (url.pathname === "/activity/app-usage") {
    return jsonResponse({ accepted: 1, source: "DESKTOP_AGENT", eventType: "APP" });
  }

  return new Response("not found", { status: 404 });
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

async function main() {
  try {
    const config = {
      apiBaseUrl: "https://api.workmap.test",
      token: "test-workmap-token",
      hostname: "WM-TEST-LAPTOP",
      os: "WINDOWS",
      agentVersion: "desktop-agent-harness/test",
    };
    const startedAt = "2026-06-17T09:00:00.000Z";
    const endedAt = "2026-06-17T09:05:00.000Z";

    const registration = await registerAgentDevice(config);
    assert.equal(registration.device.id, DEVICE_ID);

    await sendHeartbeat(config, DEVICE_ID);
    await sendAppUsage(config, [
      {
        deviceId: DEVICE_ID,
        appName: "Visual Studio Code",
        startedAt,
        endedAt,
        isIdle: false,
      },
    ]);

    assert.deepEqual(recordedRequests.map((request) => request.path), [
      "/devices/register",
      "/devices/heartbeat",
      "/activity/app-usage",
    ]);
    assert(recordedRequests.every((request) => request.authorization === "Bearer test-workmap-token"));
    assert.deepEqual(recordedRequests[0]?.body, {
      os: "WINDOWS",
      hostname: "WM-TEST-LAPTOP",
      agentVersion: "desktop-agent-harness/test",
    });
    assert.deepEqual(recordedRequests[1]?.body, {
      deviceId: DEVICE_ID,
      agentVersion: "desktop-agent-harness/test",
    });
    assert.deepEqual(recordedRequests[2]?.body, {
      events: [
        {
          deviceId: DEVICE_ID,
          appName: "Visual Studio Code",
          startedAt,
          endedAt,
          isIdle: false,
        },
      ],
    });

    console.info("desktop-agent harness test passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
