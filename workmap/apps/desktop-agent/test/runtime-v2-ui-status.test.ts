import assert from "node:assert/strict";
import test from "node:test";
import { buildDesktopAgentUiStatusV2 } from "../src/runtimeV2.js";
import { createInitialDesktopTrackingV2State } from "../src/trackingV2Store.js";

test("live UI status uses the latest in-memory server-confirmed heartbeat", () => {
  const runtimeState = createInitialDesktopTrackingV2State();
  runtimeState.lastSuccessfulHeartbeatAt = "2026-07-20T05:50:10.000Z";
  runtimeState.lastSuccessfulSyncAt = "2026-07-20T05:50:10.000Z";

  const status = buildDesktopAgentUiStatusV2({
    deviceId: "device-1",
    runtimeState,
    connectionState: "ONLINE",
    collectorState: "HEALTHY",
    policySetupMessage: null,
    queuePending: 0,
    queuedStatusEvents: 0,
    queuedLegacyEvents: 0,
  });

  assert.equal(status.state, "connected");
  assert.equal(status.lastHeartbeatAt, "2026-07-20T05:50:10.000Z");
  assert.equal(status.lastUploadAt, "2026-07-20T05:50:10.000Z");
});

test("live UI status still reports a real offline or paused runtime", () => {
  const runtimeState = createInitialDesktopTrackingV2State();
  const base = {
    deviceId: "device-1",
    runtimeState,
    policySetupMessage: null,
    queuePending: 0,
    queuedStatusEvents: 0,
    queuedLegacyEvents: 0,
  } as const;

  assert.equal(
    buildDesktopAgentUiStatusV2({
      ...base,
      connectionState: "OFFLINE",
      collectorState: "PAUSED",
    }).state,
    "offline",
  );
  assert.equal(
    buildDesktopAgentUiStatusV2({
      ...base,
      connectionState: "ONLINE",
      collectorState: "PAUSED",
    }).state,
    "paused",
  );
});
