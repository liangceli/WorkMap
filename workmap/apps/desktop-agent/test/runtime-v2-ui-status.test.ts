import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDesktopAgentUiStatusV2,
  clampMonotonicToPolicyEndV2,
  eventClockAnchorUtcMsV2,
  eventObservedUtcMsV2,
  latestTimelineThroughAtV2,
  projectMonotonicUtcMsV2,
  shouldImmediatelySyncHostEventV2,
  shouldRecordConfirmedSyncWarningV2,
  summarizeIntervalRejections,
  timelineCaptureAllowedAtV2,
} from "../src/runtimeV2.js";
import { createInitialDesktopTrackingV2State } from "../src/trackingV2Store.js";
import { DesktopFocusEngineV2 } from "../src/desktopFocusEngineV2.js";
import { DesktopOpenRuntimeEngineV2 } from "../src/desktopOpenRuntimeEngineV2.js";
import type {
  ActivityIntervalV2,
  DesktopClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const BOUNDARY_POLICY: DeviceTrackingPolicyV2 = {
  policyId: "policy-1",
  policyVersion: "v2",
  effectiveAt: "2026-07-21T00:00:00.000Z",
  policyLeaseId: "lease-2",
  policyLeaseIssuedAt: "2026-07-21T06:19:35.952Z",
  policyLeaseExpiresAt: "2026-07-21T11:03:00.000Z",
  serverTime: "2026-07-21T06:20:00.000Z",
  scheduleTimeZone: "Australia/Adelaide",
  scheduleTimeZoneState: "CONFIRMED",
  allowedUtcWindows: [{
    startsAt: "2026-07-21T06:19:35.952Z",
    endsAt: "2026-07-21T11:03:00.000Z",
  }],
  allowedUtcWindowsHash: "safe-hash",
  workHoursOnly: true,
  workdayStart: "09:00",
  workdayEnd: "21:33",
  idleThresholdMs: 60_000,
  collectAppFocus: true,
  collectDomainFocus: false,
  collectOpenRuntime: true,
  acknowledgementState: "ACKNOWLEDGED",
  acknowledgedAt: "2026-07-21T00:00:00.000Z",
};

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

test("a delayed pre-lease event is rejected instead of being moved into the live lease", () => {
  const observedAtMs = eventObservedUtcMsV2({
    serverNowMs: Date.parse("2026-07-21T06:19:40.000Z"),
    currentMonotonicMs: 10_000,
    eventMonotonicMs: 4_797,
  });

  assert.equal(
    new Date(observedAtMs).toISOString(),
    "2026-07-21T06:19:34.797Z",
  );
  assert.equal(
    timelineCaptureAllowedAtV2(BOUNDARY_POLICY, observedAtMs, null),
    false,
  );
});

test("Focus and open/runtime project their own independent clock epochs", () => {
  const focusClock: DesktopClockEpochV2 = {
    clockEpochId: "focus-epoch",
    clockEpochStartedAt: "2026-07-21T10:00:00.000Z",
    clockEpochStartedMonotonicMs: 1_000,
  };
  const runtimeClock: DesktopClockEpochV2 = {
    clockEpochId: "runtime-epoch",
    clockEpochStartedAt: "2026-07-21T10:00:05.000Z",
    clockEpochStartedMonotonicMs: 1_000,
  };

  assert.equal(
    projectMonotonicUtcMsV2(focusClock, 2_000),
    Date.parse("2026-07-21T10:00:01.000Z"),
  );
  assert.equal(
    projectMonotonicUtcMsV2(runtimeClock, 2_000),
    Date.parse("2026-07-21T10:00:06.000Z"),
  );
});

test("a policy-end boundary seals exactly at the authorised cutoff", () => {
  const clock: DesktopClockEpochV2 = {
    clockEpochId: "focus-epoch",
    clockEpochStartedAt: "2026-07-21T11:02:30.000Z",
    clockEpochStartedMonotonicMs: 1_000,
  };

  assert.equal(
    clampMonotonicToPolicyEndV2({
      clock,
      requestedMonotonicMs: 41_000,
      policy: BOUNDARY_POLICY,
    }),
    31_000,
  );

  const boundary = clampMonotonicToPolicyEndV2({
    clock,
    requestedMonotonicMs: 41_000,
    policy: BOUNDARY_POLICY,
  });
  const focus = new DesktopFocusEngineV2(clock, BOUNDARY_POLICY);
  focus.acquireFocus(
    { subjectKey: "app:focus", displayName: "Focus App" },
    1_000,
  );
  const focusIntervals = focus.clearFocus(boundary).intervals;
  const runtime = new DesktopOpenRuntimeEngineV2(clock, BOUNDARY_POLICY);
  runtime.observeVisibleApps(
    [{ subjectKey: "app:runtime", displayName: "Runtime App" }],
    1_000,
  );
  const runtimeIntervals = runtime.clear(boundary).intervals;

  assert.deepEqual(
    [...focusIntervals, ...runtimeIntervals].map((item) => item.endedAt),
    ["2026-07-21T11:03:00.000Z", "2026-07-21T11:03:00.000Z"],
  );
  assert.equal(
    timelineCaptureAllowedAtV2(
      BOUNDARY_POLICY,
      Date.parse("2026-07-21T11:03:00.000Z"),
      null,
    ),
    false,
  );
});

test("timeline watermarks advance per stream and never regress", () => {
  const intervals = [
    intervalForWatermark("FOCUS", "2026-07-21T10:00:20.000Z"),
    intervalForWatermark("OPEN_RUNTIME", "2026-07-21T10:00:30.000Z"),
  ];

  assert.equal(
    latestTimelineThroughAtV2(
      "2026-07-21T10:00:25.000Z",
      intervals,
      "FOCUS",
    ),
    "2026-07-21T10:00:25.000Z",
  );
  assert.equal(
    latestTimelineThroughAtV2(null, intervals, "OPEN_RUNTIME"),
    "2026-07-21T10:00:30.000Z",
  );
  assert.equal(
    timelineCaptureAllowedAtV2(
      BOUNDARY_POLICY,
      Date.parse("2026-07-21T10:00:20.000Z"),
      Date.parse("2026-07-21T10:00:25.000Z"),
    ),
    false,
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

function intervalForWatermark(
  stream: ActivityIntervalV2["stream"],
  endedAt: string,
): ActivityIntervalV2 {
  const endedAtMs = Date.parse(endedAt);
  const startedAtMs = endedAtMs - 1_000;
  return {
    clientEventId: `${stream}-event`,
    activitySessionId: `${stream}-session`,
    sequenceNumber: 1,
    source: "DESKTOP_APP",
    stream,
    metric: stream === "FOCUS" ? "FOCUS_ACTIVE" : "OPEN_RUNTIME",
    subjectKey: "app:test",
    displayName: "Test App",
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt,
    clockEpochId: `${stream}-epoch`,
    startedMonotonicMs: 1_000,
    endedMonotonicMs: 2_000,
    durationMs: 1_000,
    policyVersion: "v2",
    policyLeaseId: "lease-2",
  };
}
