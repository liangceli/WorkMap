import assert from "node:assert/strict";
import test from "node:test";
import { BrowserFocusEngineV2 } from "../src/browserFocusEngineV2.js";
import type {
  BrowserClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const clock: BrowserClockEpochV2 = {
  clockEpochId: "epoch-1",
  clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
  clockEpochStartedMonotonicMs: 0,
};

test("focused hostname starts immediately and becomes idle at exactly 60 seconds", () => {
  const engine = createEngine();
  const started = engine.acquireFocus(
    { subjectKey: "docs.example", displayName: "docs.example" },
    1_000,
  );
  assert.equal(started.snapshot.state, "ACTIVE");
  assert.equal(started.snapshot.stateStartedAt, "2026-07-17T00:00:01.000Z");

  const settled = engine.settle(75_000);
  assert.deepEqual(
    settled.intervals.map((interval) => [
      interval.metric,
      interval.startedAt,
      interval.endedAt,
      interval.durationMs,
    ]),
    [
      [
        "FOCUS_ACTIVE",
        "2026-07-17T00:00:01.000Z",
        "2026-07-17T00:01:01.000Z",
        60_000,
      ],
      [
        "FOCUS_IDLE",
        "2026-07-17T00:01:01.000Z",
        "2026-07-17T00:01:15.000Z",
        14_000,
      ],
    ],
  );
  assert.equal(settled.snapshot.state, "IDLE");
});

test("trusted interaction refreshes the deadline and resumes idle immediately", () => {
  const engine = createEngine();
  engine.acquireFocus(
    { subjectKey: "mail.example", displayName: "mail.example" },
    0,
  );
  engine.recordTrustedInteraction(50_000);
  const beforeBoundary = engine.observe(109_999);
  assert.equal(beforeBoundary.snapshot.state, "ACTIVE");
  assert.equal(beforeBoundary.intervals.length, 0);

  const atBoundary = engine.observe(110_000);
  assert.equal(atBoundary.snapshot.state, "IDLE");
  assert.equal(atBoundary.intervals[0]?.durationMs, 110_000);

  const resumed = engine.recordTrustedInteraction(120_000);
  assert.equal(resumed.intervals[0]?.metric, "FOCUS_IDLE");
  assert.equal(resumed.intervals[0]?.durationMs, 10_000);
  assert.equal(resumed.snapshot.state, "ACTIVE");
  assert.equal(
    resumed.snapshot.stateStartedAt,
    "2026-07-17T00:02:00.000Z",
  );
});

test("tab switch closes the previous hostname and maintains one focus session", () => {
  const engine = createEngine();
  engine.acquireFocus(
    { subjectKey: "a.example", displayName: "a.example" },
    2_000,
  );
  const switched = engine.acquireFocus(
    { subjectKey: "b.example", displayName: "b.example" },
    7_500,
  );
  assert.equal(switched.intervals.length, 1);
  assert.equal(switched.intervals[0]?.subjectKey, "a.example");
  assert.equal(switched.intervals[0]?.durationMs, 5_500);
  assert.equal(switched.snapshot.subjectKey, "b.example");
  assert.equal(switched.snapshot.state, "ACTIVE");
});

test("restart checkpoint retains identity and recovery closes only proven time", () => {
  const original = createEngine();
  original.acquireFocus(
    { subjectKey: "workmap.test", displayName: "workmap.test" },
    4_000,
  );
  original.recordTrustedInteraction(14_000);
  original.observe(20_000);
  const checkpoint = original.checkpoint();

  const recovered = createEngine(checkpoint);
  const closed = recovered.clearFocus(
    checkpoint.lastObservedAtMonotonicMs,
  );
  assert.equal(closed.intervals.length, 1);
  assert.equal(closed.intervals[0]?.startedMonotonicMs, 4_000);
  assert.equal(closed.intervals[0]?.endedMonotonicMs, 20_000);
  assert.equal(closed.snapshot.state, "NONE");
  assert.equal(
    recovered.checkpoint().nextIntervalSequence,
    closed.intervals[0]!.sequenceNumber + 1,
  );
});

test("late and duplicate observations never create negative or overlapping time", () => {
  const engine = createEngine();
  engine.acquireFocus(
    { subjectKey: "late.example", displayName: "late.example" },
    10_000,
  );
  assert.equal(engine.observe(10_000).intervals.length, 0);
  assert.equal(engine.observe(9_000).intervals.length, 0);
  const closed = engine.clearFocus(12_500);
  assert.equal(closed.intervals.length, 1);
  assert.equal(closed.intervals[0]?.durationMs, 2_500);
  assert(
    closed.intervals.every(
      (interval) =>
        interval.durationMs > 0 &&
        interval.endedMonotonicMs > interval.startedMonotonicMs,
    ),
  );
});

function createEngine(
  checkpoint?: ConstructorParameters<typeof BrowserFocusEngineV2>[3],
) {
  let nextId = checkpoint?.nextIntervalSequence ?? 1;
  return new BrowserFocusEngineV2(
    clock,
    policy(),
    "EDGE",
    checkpoint,
    () => `id-${nextId++}`,
  );
}

function policy(): DeviceTrackingPolicyV2 {
  return {
    policyId: "policy-1",
    policyVersion: "version-1",
    effectiveAt: "2026-07-16T00:00:00.000Z",
    policyLeaseId: "lease-1",
    policyLeaseIssuedAt: "2026-07-17T00:00:00.000Z",
    policyLeaseExpiresAt: "2026-07-18T00:00:00.000Z",
    serverTime: "2026-07-17T00:00:00.000Z",
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [
      {
        startsAt: "2026-07-17T00:00:00.000Z",
        endsAt: "2026-07-18T00:00:00.000Z",
      },
    ],
    allowedUtcWindowsHash: "hash",
    workHoursOnly: false,
    workdayStart: "00:00",
    workdayEnd: "23:59",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: "2026-07-16T00:00:00.000Z",
  };
}
