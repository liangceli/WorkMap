import assert from "node:assert/strict";
import test from "node:test";
import { validateActivityIntervalV2 } from "../../../packages/shared-types/src/tracking-v2.js";
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

test("real-browser fractional monotonic timestamps emit whole-millisecond ledger intervals", () => {
  const fractionalClock: BrowserClockEpochV2 = {
    clockEpochId: "epoch-fractional",
    clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
    clockEpochStartedMonotonicMs: 1_234.567,
  };
  const engine = new BrowserFocusEngineV2(
    fractionalClock,
    policy(),
    "CHROME",
    null,
    () => "fractional-id",
  );

  engine.acquireFocus(
    { subjectKey: "fractional.example", displayName: "fractional.example" },
    1_240.891,
  );
  const closed = engine.clearFocus(2_742.234);

  assert.equal(closed.intervals.length, 1);
  const interval = closed.intervals[0]!;
  assert.deepEqual(
    [interval.startedMonotonicMs, interval.endedMonotonicMs, interval.durationMs],
    [1_241, 2_742, 1_501],
  );
  assert.equal(Date.parse(interval.endedAt) - Date.parse(interval.startedAt), 1_501);
  assert(
    [
      interval.startedMonotonicMs,
      interval.endedMonotonicMs,
      interval.durationMs,
    ].every(Number.isInteger),
  );
  assert.deepEqual(validateActivityIntervalV2(interval), []);
});

test("upgrade recovery quantizes a fractional 0.5.3 checkpoint before sealing it", () => {
  const fractionalClock: BrowserClockEpochV2 = {
    clockEpochId: "epoch-upgrade",
    clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
    clockEpochStartedMonotonicMs: 100.25,
  };
  const checkpoint: NonNullable<
    ConstructorParameters<typeof BrowserFocusEngineV2>[3]
  > = {
    version: 1,
    snapshotSequence: 4,
    nextIntervalSequence: 2,
    lastObservedAtMonotonicMs: 2_742.234,
    collectorState: "HEALTHY",
    current: {
      activitySessionId: "upgrade-session",
      currentStateId: "upgrade-state",
      subject: {
        subjectKey: "upgrade.example",
        displayName: "upgrade.example",
      },
      state: "ACTIVE",
      sessionStartedAtMonotonicMs: 1_240.891,
      stateStartedAtMonotonicMs: 1_240.891,
      activeEvidenceAtMonotonicMs: 1_240.891,
      lastActivityEvidenceKind: "TRUSTED_PAGE_INTERACTION",
      confirmedThroughMonotonicMs: 1_240.891,
      latestEmittedIntervalSequence: null,
      latestEmittedClientEventId: null,
    },
  };
  const engine = new BrowserFocusEngineV2(
    fractionalClock,
    policy(),
    "CHROME",
    checkpoint,
    () => "upgrade-id",
  );

  const closed = engine.clearFocus(checkpoint.lastObservedAtMonotonicMs);
  assert.equal(closed.intervals.length, 1);
  assert.deepEqual(
    [
      closed.intervals[0]!.startedMonotonicMs,
      closed.intervals[0]!.endedMonotonicMs,
      closed.intervals[0]!.durationMs,
    ],
    [1_241, 2_742, 1_501],
  );
  assert.deepEqual(validateActivityIntervalV2(closed.intervals[0]), []);
});

test("sub-millisecond focus switches never emit zero, negative, or overlapping intervals", () => {
  const engine = createEngine();
  engine.acquireFocus(
    { subjectKey: "a.example", displayName: "a.example" },
    10.2,
  );
  const switched = engine.acquireFocus(
    { subjectKey: "b.example", displayName: "b.example" },
    10.4,
  );
  const closed = engine.clearFocus(10.6);
  const intervals = [...switched.intervals, ...closed.intervals];

  assert.deepEqual(
    intervals.map((interval) => [
      interval.subjectKey,
      interval.startedMonotonicMs,
      interval.endedMonotonicMs,
      interval.durationMs,
    ]),
    [["b.example", 10, 11, 1]],
  );
  assert(
    intervals.every(
      (interval, index) =>
        Number.isInteger(interval.durationMs) &&
        interval.durationMs > 0 &&
        interval.endedMonotonicMs > interval.startedMonotonicMs &&
        (index === 0 ||
          interval.startedMonotonicMs >= intervals[index - 1]!.endedMonotonicMs),
    ),
  );
});

test("UTC midnight rollover preserves exact adjacent Domain intervals", () => {
  const midnightClock: BrowserClockEpochV2 = {
    clockEpochId: "epoch-midnight",
    clockEpochStartedAt: "2026-07-21T23:59:50.000Z",
    clockEpochStartedMonotonicMs: 0,
  };
  let nextId = 1;
  const engine = new BrowserFocusEngineV2(
    midnightClock,
    policy(),
    "CHROME",
    null,
    () => `midnight-${nextId++}`,
  );
  engine.acquireFocus(
    { subjectKey: "rollover.example", displayName: "rollover.example" },
    5_000,
  );
  const closed = engine.clearFocus(15_000);
  assert.equal(closed.intervals[0]?.startedAt, "2026-07-21T23:59:55.000Z");
  assert.equal(closed.intervals[0]?.endedAt, "2026-07-22T00:00:05.000Z");
  assert.equal(closed.intervals[0]?.durationMs, 10_000);
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
