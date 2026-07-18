import assert from "node:assert/strict";
import test from "node:test";

import {
  SingleFocusSessionEngineV2,
  planLegacyProtocolActivationV2,
  type FocusSubjectV2,
  type SingleFocusEngineConfigV2,
} from "../src/single-focus-engine-v2";

const APP_A: FocusSubjectV2 = {
  subjectKey: "app:publisher:editor",
  displayName: "Code Editor",
};
const APP_B: FocusSubjectV2 = {
  subjectKey: "app:publisher:teams",
  displayName: "Microsoft Teams",
};

function config(overrides: Partial<SingleFocusEngineConfigV2> = {}): SingleFocusEngineConfigV2 {
  let id = 0;
  return {
    source: "DESKTOP_APP",
    clockEpochId: "epoch-1",
    clockEpochStartedAt: "2026-07-17T00:00:00.000Z",
    clockEpochStartedMonotonicMs: 1_000,
    policyVersion: "policy-1",
    policyLeaseId: "lease-1",
    createId: () => `id-${++id}`,
    ...overrides,
  };
}

test("first valid focus starts Active immediately without waiting for a sample threshold", () => {
  const engine = new SingleFocusSessionEngineV2(config());
  const update = engine.acquireFocus(APP_A, 1_000);
  assert.deepEqual(update.intervals, []);
  assert.equal(update.snapshot.state, "ACTIVE");
  assert.equal(update.snapshot.stateStartedAt, "2026-07-17T00:00:00.000Z");
  assert.equal(update.snapshot.nextIntervalSequence, 1);
});

test("a short app switch persists the old app and creates no overlap", () => {
  const engine = new SingleFocusSessionEngineV2(config());
  engine.acquireFocus(APP_A, 1_000);
  const switched = engine.acquireFocus(APP_B, 5_000);
  assert.equal(switched.intervals.length, 1);
  assert.deepEqual(
    switched.intervals.map((item) => [item.displayName, item.startedAt, item.endedAt, item.durationMs]),
    [["Code Editor", "2026-07-17T00:00:00.000Z", "2026-07-17T00:00:04.000Z", 4_000]],
  );
  assert.equal(switched.snapshot.displayName, "Microsoft Teams");
  assert.equal(switched.snapshot.state, "ACTIVE");
});

test("same normalized subject keeps one logical session across periodic settlement", () => {
  const engine = new SingleFocusSessionEngineV2(config({ maximumIntervalMs: 30_000 }));
  const initial = engine.acquireFocus(APP_A, 1_000);
  const sessionId = initial.snapshot.activitySessionId;
  engine.recordActivityEvidence(20_000, "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND");
  const settled = engine.settle(31_000);
  assert.equal(settled.intervals.length, 1);
  assert.equal(settled.intervals[0]?.durationMs, 30_000);
  assert.equal(settled.snapshot.activitySessionId, sessionId);
  assert.equal(settled.snapshot.sessionStartedAt, "2026-07-17T00:00:00.000Z");
  assert.equal(settled.snapshot.nextIntervalSequence, 2);

  const sameApp = engine.acquireFocus({ ...APP_A, displayName: "Code Editor Updated" }, 32_000);
  assert.equal(sameApp.snapshot.activitySessionId, sessionId);
  assert.equal(sameApp.snapshot.displayName, "Code Editor Updated");
});

test("Active closes and Idle starts at exactly sixty seconds after the last evidence", () => {
  const engine = new SingleFocusSessionEngineV2(config());
  engine.acquireFocus(APP_A, 1_000);
  const before = engine.observe(60_999);
  assert.equal(before.snapshot.state, "ACTIVE");
  const boundary = engine.observe(61_000);
  assert.equal(boundary.intervals.length, 1);
  assert.equal(boundary.intervals[0]?.metric, "FOCUS_ACTIVE");
  assert.equal(boundary.intervals[0]?.durationMs, 60_000);
  assert.equal(boundary.snapshot.state, "IDLE");
  assert.equal(boundary.snapshot.stateStartedAt, "2026-07-17T00:01:00.000Z");
});

test("new evidence while Idle closes Idle at the evidence time and resumes Active", () => {
  const engine = new SingleFocusSessionEngineV2(config());
  engine.acquireFocus(APP_A, 1_000);
  engine.observe(61_000);
  const resumed = engine.recordActivityEvidence(76_000, "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND");
  assert.equal(resumed.intervals.length, 1);
  assert.equal(resumed.intervals[0]?.metric, "FOCUS_IDLE");
  assert.equal(resumed.intervals[0]?.durationMs, 15_000);
  assert.equal(resumed.snapshot.state, "ACTIVE");
  assert.equal(resumed.snapshot.stateStartedAt, "2026-07-17T00:01:15.000Z");
});

test("checkpoint recovery preserves session, sequence and unconfirmed boundary", () => {
  const first = new SingleFocusSessionEngineV2(config());
  first.acquireFocus(APP_A, 1_000);
  first.recordActivityEvidence(10_000, "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND");
  const settled = first.settle(16_000);
  const checkpoint = first.checkpoint();

  const restored = new SingleFocusSessionEngineV2(config(), checkpoint);
  const stopped = restored.clearFocus(21_000);
  assert.equal(stopped.intervals.length, 1);
  assert.equal(stopped.intervals[0]?.sequenceNumber, 2);
  assert.equal(stopped.intervals[0]?.startedAt, settled.intervals[0]?.endedAt);
  assert.equal(stopped.snapshot.state, "NONE");
});

test("collector suspension closes focus with exactly one snapshot sequence increment", () => {
  const engine = new SingleFocusSessionEngineV2(config());
  const started = engine.acquireFocus(APP_A, 1_000);
  const suspended = engine.setCollectorState("SUSPENDED", 6_000);

  assert.equal(suspended.snapshot.snapshotSequence, started.snapshot.snapshotSequence + 1);
  assert.equal(suspended.snapshot.state, "NONE");
  assert.equal(suspended.snapshot.collectorState, "SUSPENDED");
  assert.equal(suspended.intervals.length, 1);
  assert.equal(suspended.intervals[0]?.durationMs, 5_000);
});

test("browser profile uses the same one-session rules with immutable browser identity", () => {
  const engine = new SingleFocusSessionEngineV2(
    config({ source: "BROWSER_DOMAIN", browserName: "EDGE" }),
  );
  const domain = { subjectKey: "domain:example.test", displayName: "example.test", browserName: "EDGE" as const };
  const update = engine.acquireFocus(domain, 1_000);
  assert.equal(update.snapshot.browserName, "EDGE");
  assert.throws(
    () => engine.acquireFocus({ ...domain, browserName: "CHROME" }, 2_000),
    /browser identity/,
  );
});

test("legacy activation preserves queued rows and never fabricates an unobserved tail", () => {
  const queue = [{ clientEventId: "legacy-1", durationSeconds: 12 }];
  const plan = planLegacyProtocolActivationV2(
    queue,
    "2026-07-17T00:01:00.000Z",
    "2026-07-17T00:00:50.000Z",
  );
  assert.deepEqual(plan.legacyQueue, queue);
  assert.notEqual(plan.legacyQueue, queue);
  assert.equal(plan.legacyCloseAt, "2026-07-17T00:00:50.000Z");
  assert.deepEqual(plan.coverageGap, {
    startsAt: "2026-07-17T00:00:50.000Z",
    endsAt: "2026-07-17T00:01:00.000Z",
  });
  assert.equal(plan.requiresFreshFocusProof, true);
});
