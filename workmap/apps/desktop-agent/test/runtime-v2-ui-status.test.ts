import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDesktopAgentUiStatusV2,
  eventClockAnchorUtcMsV2,
  shouldImmediatelySyncHostEventV2,
  shouldRecordConfirmedSyncWarningV2,
  summarizeIntervalRejections,
} from "../src/runtimeV2.js";
import { createInitialDesktopTrackingV2State } from "../src/trackingV2Store.js";

test("live UI status uses the latest in-memory server-confirmed heartbeat", () => {
  const runtimeState = createInitialDesktopTrackingV2State();
  runtimeState.lastSuccessfulHeartbeatAt = "2026-07-20T05:50:10.000Z";
  runtimeState.lastSuccessfulSyncAt = "2026-07-20T05:50:10.000Z";
  runtimeState.serverOffsetMs = -131_661;

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
  assert.equal(status.serverOffsetMs, -131_661);
});

test("HTTP 200 interval rejections retain exact diagnostic codes", () => {
  assert.deepEqual(
    summarizeIntervalRejections([
      {
        clientEventId: "event-1",
        status: "REJECTED",
        rejectionCode: "FOCUS_OVERLAP",
        terminal: true,
      },
      {
        clientEventId: "event-2",
        status: "ACCEPTED",
      },
      {
        clientEventId: "event-3",
        status: "REJECTED",
        rejectionCode: "FOCUS_OVERLAP",
        terminal: true,
      },
    ]),
    [{ code: "FOCUS_OVERLAP", count: 2, terminal: true }],
  );
  assert.equal(shouldRecordConfirmedSyncWarningV2(null, 2), true);
  assert.equal(shouldRecordConfirmedSyncWarningV2({ status: "REJECTED" }, 0), true);
  assert.equal(shouldRecordConfirmedSyncWarningV2({ status: "ACCEPTED" }, 0), false);
});

test("a network-delayed foreground event keeps its original UTC anchor", () => {
  assert.equal(
    eventClockAnchorUtcMsV2({
      serverNowMs: 100_000,
      currentMonotonicMs: 20_000,
      eventMonotonicMs: 12_000,
      protocolActivatedAtMs: 0,
    }),
    92_000,
  );
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

test("high-frequency interaction pulses do not request one HTTP sync per pulse", () => {
  assert.equal(shouldImmediatelySyncHostEventV2("interaction_pulse"), false);
  assert.equal(shouldImmediatelySyncHostEventV2("foreground_changed"), true);
  assert.equal(shouldImmediatelySyncHostEventV2("health"), true);
});
