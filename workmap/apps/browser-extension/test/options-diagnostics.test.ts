import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_CONNECTION_FRESH_MS,
  collectorStatusLabel,
  deriveStatusHealth,
} from "../src/optionsDiagnostics.js";
import type { ExtensionStatus } from "../src/extensionStorage.js";

const heartbeatAt = "2026-07-22T10:00:00.000Z";
const heartbeatMs = Date.parse(heartbeatAt);

test("Options and Reports share the 90-second Browser heartbeat boundary", () => {
  const status = connectedStatus();
  assert.equal(BROWSER_CONNECTION_FRESH_MS, 90_000);
  assert.equal(
    deriveStatusHealth(status, heartbeatMs + 30_001).label,
    "Online",
    "a delayed 30-second alarm must not create a false local outage",
  );
  assert.equal(
    deriveStatusHealth(status, heartbeatMs + 90_000).label,
    "Online",
  );
  assert.equal(
    deriveStatusHealth(status, heartbeatMs + 90_001).label,
    "Offline",
  );
});

test("collector diagnostics use the persisted collector lane", () => {
  assert.equal(collectorStatusLabel(connectedStatus()), "HEALTHY");
  assert.equal(
    collectorStatusLabel({ ...connectedStatus(), collectorState: "LIMITED" }),
    "LIMITED",
  );
  assert.equal(collectorStatusLabel(undefined), "UNKNOWN");
});

test("auth and upgrade states override heartbeat freshness", () => {
  assert.equal(
    deriveStatusHealth({ ...connectedStatus(), state: "auth_required" }).label,
    "Auth required",
  );
  assert.equal(
    deriveStatusHealth({ ...connectedStatus(), state: "upgrade_required" }).label,
    "Upgrade required",
  );
});

function connectedStatus(): ExtensionStatus {
  return {
    state: "connected",
    connectionState: "ONLINE",
    collectorState: "HEALTHY",
    lastHeartbeatAt: heartbeatAt,
    queuedEvents: 0,
  };
}
