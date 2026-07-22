import assert from "node:assert/strict";
import test from "node:test";

import {
  FOCUS_IDLE_THRESHOLD_MS,
  FakeMonotonicClockV2,
  appendActivityIntervalWithoutEvictionV2,
  canBootstrapFirstStateProvisionalV2,
  canonicalizeActivityIntervalV2,
  computeTrackingSequenceCoverageV2,
  hashActivityIntervalV2,
  isIntervalInsidePolicyWindowsV2,
  mapWindowsInputTickToMonotonicMsV2,
  trackingEventIdentityV2,
  trackingSequenceIdentityV2,
  unionTrackingDurationMsV2,
  validateActivityIntervalV2,
  type ActivityIntervalV2,
  type LiveFocusSnapshotV2,
} from "../src/tracking-v2";

function interval(overrides: Partial<ActivityIntervalV2> = {}): ActivityIntervalV2 {
  return {
    clientEventId: "event-1",
    activitySessionId: "session-1",
    sequenceNumber: 1,
    source: "DESKTOP_APP",
    stream: "FOCUS",
    metric: "FOCUS_ACTIVE",
    subjectKey: "app:publisher:product",
    displayName: "Code Editor",
    startedAt: "2026-07-17T00:00:00.000Z",
    endedAt: "2026-07-17T00:00:04.000Z",
    clockEpochId: "epoch-1",
    startedMonotonicMs: 10_000,
    endedMonotonicMs: 14_000,
    durationMs: 4_000,
    policyVersion: "policy-1",
    policyLeaseId: "lease-1",
    ...overrides,
  };
}

function snapshot(overrides: Partial<LiveFocusSnapshotV2> = {}): LiveFocusSnapshotV2 {
  return {
    snapshotSequence: 1,
    activitySessionId: "session-1",
    currentStateId: "state-1",
    source: "DESKTOP_APP",
    stream: "FOCUS",
    clockEpochId: "epoch-1",
    policyVersion: "policy-1",
    policyLeaseId: "lease-1",
    subjectKey: "app:publisher:product",
    displayName: "Code Editor",
    state: "ACTIVE",
    sessionStartedAt: "2026-07-17T00:00:00.000Z",
    stateStartedAt: "2026-07-17T00:00:00.000Z",
    lastActivityEvidenceAt: "2026-07-17T00:00:00.000Z",
    activityEvidenceKind: "FOCUS_ACQUIRED",
    latestEmittedIntervalSequence: null,
    latestEmittedClientEventId: null,
    nextIntervalSequence: 1,
    lastObservedAt: "2026-07-17T00:00:10.000Z",
    collectorState: "HEALTHY",
    ...overrides,
  };
}

test("v2 uses one fixed sixty-second idle threshold", () => {
  assert.equal(FOCUS_IDLE_THRESHOLD_MS, 60_000);
});

test("positive millisecond intervals survive validation without five-second filtering", () => {
  assert.deepEqual(validateActivityIntervalV2(interval({ durationMs: 250, endedAt: "2026-07-17T00:00:00.250Z", endedMonotonicMs: 10_250 })), []);
  assert.ok(validateActivityIntervalV2(interval({ durationMs: 0 })).some((issue) => issue.code === "INVALID_DURATION"));
});

test("fractional monotonic bounds are rejected before database integer conversion", () => {
  const issues = validateActivityIntervalV2(
    interval({
      durationMs: 60_000,
      endedAt: "2026-07-17T00:01:00.000Z",
      startedMonotonicMs: 10_000.25,
      endedMonotonicMs: 70_000.25,
    }),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "MONOTONIC_MISMATCH" && issue.field === "durationMs",
    ),
  );
});

test("source and stream identity are independent from event identity", () => {
  const value = interval();
  assert.equal(trackingEventIdentityV2("device-1", value), "device-1:event-1");
  assert.equal(
    trackingSequenceIdentityV2("device-1", value),
    "device-1:DESKTOP_APP:FOCUS:epoch-1:1",
  );
});

test("canonical payloads normalize UTC and hash every semantic field deterministically", async () => {
  const value = interval({ startedAt: "2026-07-17T00:00:00Z", endedAt: "2026-07-17T00:00:04Z" });
  const retry = interval({ startedAt: "2026-07-17T00:00:00.000Z", endedAt: "2026-07-17T00:00:04.000Z" });
  assert.equal(canonicalizeActivityIntervalV2(value), canonicalizeActivityIntervalV2(retry));
  assert.equal(await hashActivityIntervalV2(value), await hashActivityIntervalV2(retry));
  assert.notEqual(await hashActivityIntervalV2(value), await hashActivityIntervalV2(interval({ durationMs: 3_999 })));
});

test("forbidden or unknown privacy fields are rejected", () => {
  const unsafe = { ...interval(), windowTitle: "Confidential plan", url: "https://example.test/private" };
  const issues = validateActivityIntervalV2(unsafe);
  assert.deepEqual(
    issues.filter((issue) => issue.code === "FORBIDDEN_FIELD").map((issue) => issue.field),
    ["windowTitle", "url"],
  );
});

test("browser identity is required only for domain intervals", () => {
  assert.ok(
    validateActivityIntervalV2(
      interval({
        source: "BROWSER_DOMAIN",
        subjectKey: "domain:example.test",
        displayName: "example.test",
        startedMonotonicMs: undefined,
        endedMonotonicMs: undefined,
      }),
    ).some((issue) => issue.code === "INVALID_BROWSER_IDENTITY"),
  );
  assert.deepEqual(
    validateActivityIntervalV2(
      interval({
        source: "BROWSER_DOMAIN",
        browserName: "EDGE",
        subjectKey: "domain:example.test",
        displayName: "example.test",
        startedMonotonicMs: undefined,
        endedMonotonicMs: undefined,
      }),
    ),
    [],
  );
});

test("contiguous cursor never hides a missing sequence", () => {
  assert.deepEqual(computeTrackingSequenceCoverageV2([
    { sequenceNumber: 1, status: "ACCEPTED" },
    { sequenceNumber: 3, status: "ACCEPTED" },
  ]), {
    contiguousThroughSequence: 1,
    latestAcceptedEndedAt: null,
    missingRanges: [{ from: 2, to: 2 }],
    rejectedRanges: [],
  });

  assert.equal(computeTrackingSequenceCoverageV2([
    { sequenceNumber: 1, status: "ACCEPTED" },
    { sequenceNumber: 3, status: "ACCEPTED" },
    { sequenceNumber: 2, status: "DUPLICATE" },
  ]).contiguousThroughSequence, 3);

  const rejected = computeTrackingSequenceCoverageV2([
    { sequenceNumber: 1, status: "ACCEPTED" },
    { sequenceNumber: 3, status: "ACCEPTED" },
    { sequenceNumber: 2, status: "REJECTED", terminal: true, rejectionCode: "INVALID_INTERVAL" },
  ]);
  assert.equal(rejected.contiguousThroughSequence, 3);
  assert.deepEqual(rejected.rejectedRanges, [{ from: 2, to: 2, code: "INVALID_INTERVAL" }]);
});

test("first-state provisional time requires an empty epoch and a valid policy window", () => {
  const context = {
    snapshot: snapshot(),
    contiguousThroughSequence: 0,
    hasAnyDisposition: false,
    hasMissingSequence: false,
    hasOverlap: false,
    protocolActivatedAt: "2026-07-17T00:00:00.000Z",
    clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
    allowedUtcWindows: [{ startsAt: "2026-07-17T00:00:00.000Z", endsAt: "2026-07-17T08:00:00.000Z" }],
  };
  assert.equal(canBootstrapFirstStateProvisionalV2(context), true);
  assert.equal(canBootstrapFirstStateProvisionalV2({ ...context, hasAnyDisposition: true }), false);
  assert.equal(
    canBootstrapFirstStateProvisionalV2({
      ...context,
      snapshot: snapshot({ latestEmittedIntervalSequence: 1, latestEmittedClientEventId: "event-1" }),
    }),
    false,
  );
});

test("policy windows are server-issued UTC boundaries", () => {
  const windows = [{ startsAt: "2026-07-17T00:00:00.000Z", endsAt: "2026-07-17T08:00:00.000Z" }];
  assert.equal(isIntervalInsidePolicyWindowsV2(interval(), windows), true);
  assert.equal(
    isIntervalInsidePolicyWindowsV2(interval({ startedAt: "2026-07-16T23:59:59.000Z" }), windows),
    false,
  );
});

test("Windows 32-bit last-input tick rollover maps to a five-millisecond advance", () => {
  const currentTickCount64 = 0x1_0000_0003n;
  const mapped = mapWindowsInputTickToMonotonicMsV2(currentTickCount64, 0xffff_fffe, 60_000);
  assert.equal(mapped, 0xffff_fffen);
  assert.equal(currentTickCount64 - (mapped ?? 0n), 5n);
  assert.equal(mapWindowsInputTickToMonotonicMsV2(currentTickCount64, 1, 1), null);
});

test("fake monotonic clock keeps duration stable across a wall-clock rollback", () => {
  const clock = new FakeMonotonicClockV2({
    monotonicMs: 1_000,
    wallClockMs: Date.parse("2026-07-17T00:00:00.000Z"),
  });
  clock.advance(5_000);
  clock.jumpWallClock(-3_600_000);
  assert.equal(clock.nowMonotonicMs(), 6_000);
  clock.advance(1_000);
  assert.equal(clock.nowMonotonicMs(), 7_000);
});

test("overlapping device intervals are unioned instead of double counted", () => {
  assert.equal(
    unionTrackingDurationMsV2([
      { startedAt: "2026-07-17T00:00:00.000Z", endedAt: "2026-07-17T00:01:00.000Z" },
      { startedAt: "2026-07-17T00:00:30.000Z", endedAt: "2026-07-17T00:01:30.000Z" },
      { startedAt: "2026-07-17T00:02:00.000Z", endedAt: "2026-07-17T00:02:10.000Z" },
    ]),
    100_000,
  );
});

test("a full durable queue reports pressure and never evicts its oldest interval", () => {
  const first = interval({ clientEventId: "event-1", sequenceNumber: 1 });
  const second = interval({ clientEventId: "event-2", sequenceNumber: 2 });
  const result = appendActivityIntervalWithoutEvictionV2([first], second, 1);
  assert.equal(result.accepted, false);
  assert.equal(result.queuePressure, true);
  assert.deepEqual(result.queue, [first]);
});
