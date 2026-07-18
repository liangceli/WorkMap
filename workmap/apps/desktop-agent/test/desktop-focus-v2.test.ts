import assert from "node:assert/strict";
import test from "node:test";
import { DesktopFocusEngineV2 } from "../src/desktopFocusEngineV2.js";
import type {
  DesktopClockEpochV2,
  DesktopFocusSubjectV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const CLOCK: DesktopClockEpochV2 = {
  clockEpochId: "epoch-1",
  clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
  clockEpochStartedMonotonicMs: 1_000,
};
const POLICY: DeviceTrackingPolicyV2 = {
  policyId: "policy-1",
  policyVersion: "policy-v1",
  effectiveAt: "2026-07-17T00:00:00.000Z",
  policyLeaseId: "lease-1",
  policyLeaseIssuedAt: "2026-07-17T00:00:00.000Z",
  policyLeaseExpiresAt: "2026-07-18T00:00:00.000Z",
  serverTime: "2026-07-17T00:00:00.000Z",
  scheduleTimeZone: "Australia/Adelaide",
  scheduleTimeZoneState: "CONFIRMED",
  allowedUtcWindows: [{ startsAt: "2026-07-17T00:00:00.000Z", endsAt: "2026-07-18T00:00:00.000Z" }],
  allowedUtcWindowsHash: "hash",
  workHoursOnly: false,
  workdayStart: "00:00",
  workdayEnd: "23:59",
  idleThresholdMs: 60_000,
  collectAppFocus: true,
  collectDomainFocus: true,
  collectOpenRuntime: false,
  acknowledgementState: "ACKNOWLEDGED",
  acknowledgedAt: "2026-07-17T00:00:00.000Z",
};
const APP_A: DesktopFocusSubjectV2 = { subjectKey: "app:code", displayName: "Code" };
const APP_B: DesktopFocusSubjectV2 = { subjectKey: "app:teams", displayName: "Microsoft Teams" };

function engine() {
  let id = 0;
  return new DesktopFocusEngineV2(CLOCK, POLICY, null, () => `id-${++id}`);
}

test("starts focus immediately and switches without overlap", () => {
  const tracker = engine();
  const started = tracker.acquireFocus(APP_A, 1_000);
  assert.equal(started.snapshot.state, "ACTIVE");
  assert.equal(started.snapshot.stateStartedAt, "2026-07-17T00:00:00.000Z");

  const switched = tracker.acquireFocus(APP_B, 5_000);
  assert.equal(switched.intervals.length, 1);
  assert.equal(switched.intervals[0]?.displayName, "Code");
  assert.equal(switched.intervals[0]?.durationMs, 4_000);
  assert.equal(switched.snapshot.displayName, "Microsoft Teams");
});

test("transitions to idle exactly sixty seconds after trusted evidence", () => {
  const tracker = engine();
  tracker.acquireFocus(APP_A, 1_000);
  tracker.recordSessionInput(10_000);
  assert.equal(tracker.observe(69_999).snapshot.state, "ACTIVE");
  const idle = tracker.observe(70_000);
  assert.equal(idle.intervals[0]?.durationMs, 69_000);
  assert.equal(idle.snapshot.state, "IDLE");
  assert.equal(idle.snapshot.stateStartedAt, "2026-07-17T00:01:09.000Z");
});

test("periodic settlement keeps one logical session and stable sequence", () => {
  const tracker = engine();
  const started = tracker.acquireFocus(APP_A, 1_000);
  const sessionId = started.snapshot.activitySessionId;
  const first = tracker.settle(16_000);
  const second = tracker.settle(31_000);
  assert.equal(first.intervals[0]?.durationMs, 15_000);
  assert.equal(second.intervals[0]?.durationMs, 15_000);
  assert.equal(second.snapshot.activitySessionId, sessionId);
  assert.equal(first.intervals[0]?.sequenceNumber, 1);
  assert.equal(second.intervals[0]?.sequenceNumber, 2);
});

test("checkpoint recovery cannot recreate already persisted time", () => {
  const tracker = engine();
  tracker.acquireFocus(APP_A, 1_000);
  tracker.settle(16_000);
  const restored = new DesktopFocusEngineV2(CLOCK, POLICY, tracker.checkpoint(), () => "id-restored");
  const stopped = restored.clearFocus(21_000);
  assert.equal(stopped.intervals.length, 1);
  assert.equal(stopped.intervals[0]?.startedAt, "2026-07-17T00:00:15.000Z");
  assert.equal(stopped.intervals[0]?.durationMs, 5_000);
});

test("duplicate and delayed observations never create negative intervals", () => {
  const tracker = engine();
  tracker.acquireFocus(APP_A, 2_000);
  assert.deepEqual(tracker.observe(2_000).intervals, []);
  assert.deepEqual(tracker.observe(1_500).intervals, []);
  const stopped = tracker.clearFocus(5_000);
  assert.equal(stopped.intervals[0]?.durationMs, 3_000);
  assert.ok(stopped.intervals.every((interval) => interval.durationMs > 0));
});
