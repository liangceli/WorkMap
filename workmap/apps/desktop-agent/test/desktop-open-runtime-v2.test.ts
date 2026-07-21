import assert from "node:assert/strict";
import test from "node:test";
import { DesktopOpenRuntimeEngineV2 } from "../src/desktopOpenRuntimeEngineV2.js";
import type {
  DesktopClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const CLOCK: DesktopClockEpochV2 = {
  clockEpochId: "runtime-epoch-1",
  clockEpochStartedAt: "2026-07-21T00:00:00.000Z",
  clockEpochStartedMonotonicMs: 1_000,
};

const POLICY: DeviceTrackingPolicyV2 = {
  policyId: "policy-2",
  policyVersion: "v2",
  effectiveAt: "2026-07-21T00:00:00.000Z",
  policyLeaseId: "lease-2",
  policyLeaseIssuedAt: "2026-07-21T00:00:00.000Z",
  policyLeaseExpiresAt: "2026-07-22T00:00:00.000Z",
  serverTime: "2026-07-21T00:00:00.000Z",
  scheduleTimeZone: "Australia/Adelaide",
  scheduleTimeZoneState: "CONFIRMED",
  allowedUtcWindows: [{
    startsAt: "2026-07-21T00:00:00.000Z",
    endsAt: "2026-07-22T00:00:00.000Z",
  }],
  allowedUtcWindowsHash: "hash",
  workHoursOnly: false,
  workdayStart: "00:00",
  workdayEnd: "23:59",
  idleThresholdMs: 60_000,
  collectAppFocus: true,
  collectDomainFocus: true,
  collectOpenRuntime: true,
  acknowledgementState: "ACKNOWLEDGED",
  acknowledgedAt: "2026-07-21T00:00:00.000Z",
};

const CODEX = { subjectKey: "app:codex", displayName: "Codex" };
const TEAMS = { subjectKey: "app:teams", displayName: "Microsoft Teams" };

function engine() {
  let id = 0;
  return new DesktopOpenRuntimeEngineV2(
    CLOCK,
    POLICY,
    null,
    () => `runtime-id-${++id}`,
  );
}

test("different visible Apps accrue open/runtime concurrently", () => {
  const tracker = engine();
  tracker.observeVisibleApps([CODEX, TEAMS], 1_000);
  const settled = tracker.settle(11_000);

  assert.equal(settled.intervals.length, 2);
  assert.deepEqual(
    settled.intervals.map((interval) => interval.displayName).sort(),
    ["Codex", "Microsoft Teams"],
  );
  assert.ok(settled.intervals.every((interval) => interval.durationMs === 10_000));
  assert.ok(settled.intervals.every((interval) => interval.stream === "OPEN_RUNTIME"));
  assert.equal(
    settled.intervals.reduce((total, interval) => total + interval.durationMs, 0),
    20_000,
    "two open Apps may exceed ten seconds of wall-clock runtime",
  );
});

test("multiple windows for one App are de-duplicated by subject identity", () => {
  const tracker = engine();
  tracker.observeVisibleApps([CODEX, CODEX], 1_000);
  const settled = tracker.settle(11_000);

  assert.equal(settled.intervals.length, 1);
  assert.equal(settled.intervals[0]?.displayName, "Codex");
  assert.equal(settled.intervals[0]?.durationMs, 10_000);
});

test("closing, locking, or leaving policy closes only measured open time", () => {
  const tracker = engine();
  tracker.observeVisibleApps([CODEX, TEAMS], 1_000);
  tracker.settle(11_000);

  const codexClosed = tracker.observeVisibleApps([TEAMS], 16_000);
  assert.equal(codexClosed.intervals.length, 1);
  assert.equal(codexClosed.intervals[0]?.displayName, "Codex");
  assert.equal(codexClosed.intervals[0]?.durationMs, 5_000);

  const boundary = tracker.clear(21_000);
  assert.equal(boundary.intervals.length, 1);
  assert.equal(boundary.intervals[0]?.displayName, "Microsoft Teams");
  assert.equal(boundary.intervals[0]?.durationMs, 10_000);
  assert.deepEqual(tracker.checkpoint().current, []);
});
