import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createInitialDesktopTrackingV2State,
  DesktopTrackingV2Store,
  V2QueuePressureError,
} from "../src/trackingV2Store.js";
import type {
  ActivityIntervalV2,
  LiveFocusSnapshotV2,
} from "../src/trackingV2Types.js";

const SNAPSHOT: LiveFocusSnapshotV2 = {
  snapshotSequence: 1,
  activitySessionId: "session-1",
  currentStateId: "state-1",
  source: "DESKTOP_APP",
  stream: "FOCUS",
  clockEpochId: "epoch-1",
  policyVersion: "policy-v1",
  policyLeaseId: "lease-1",
  subjectKey: "app:code",
  displayName: "Code",
  state: "ACTIVE",
  sessionStartedAt: "2026-07-17T00:00:00.000Z",
  stateStartedAt: "2026-07-17T00:00:00.000Z",
  lastActivityEvidenceAt: "2026-07-17T00:00:00.000Z",
  activityEvidenceKind: "FOCUS_ACQUIRED",
  latestEmittedIntervalSequence: 1,
  latestEmittedClientEventId: "event-1",
  nextIntervalSequence: 2,
  lastObservedAt: "2026-07-17T00:00:15.000Z",
  collectorState: "HEALTHY",
};

test("v2 queue pressure is atomic and never evicts existing activity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workmap-v2-store-"));
  const file = join(directory, "tracking.sqlite");
  const store = new DesktopTrackingV2Store(file, 1);
  const state = {
    ...createInitialDesktopTrackingV2State(),
    latestSnapshot: SNAPSHOT,
  };
  try {
    store.persistEngineUpdate([interval("event-1", 1)], state, SNAPSHOT);
    store.persistEngineUpdate([interval("event-1", 1)], state, SNAPSHOT);

    assert.throws(
      () =>
        store.persistEngineUpdate(
          [interval("event-2", 2)],
          { ...state, lastErrorCode: "QUEUE_PRESSURE" },
          { ...SNAPSHOT, snapshotSequence: 2 },
        ),
      V2QueuePressureError,
    );
    assert.deepEqual(
      store.listReady().map((item) => item.clientEventId),
      ["event-1"],
    );
    assert.equal(store.stats().pending, 1);
    assert.equal(store.readRuntimeState()?.lastErrorCode, "NONE");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("v2 queue survives process restart until server acknowledgement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workmap-v2-restart-"));
  const file = join(directory, "tracking.sqlite");
  const state = createInitialDesktopTrackingV2State();
  const first = new DesktopTrackingV2Store(file, 4);
  first.persistEngineUpdate([interval("event-1", 1)], state, SNAPSHOT);
  first.close();

  const restored = new DesktopTrackingV2Store(file, 4);
  try {
    assert.equal(restored.listReady()[0]?.durationMs, 15_000);
    restored.acknowledge(["event-1"]);
    assert.equal(restored.stats().pending, 0);
  } finally {
    restored.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("v2 runtime state starts with empty safe sync diagnostics", () => {
  const state = createInitialDesktopTrackingV2State();
  assert.equal(state.lastSyncDiagnostic, null);
  assert.deepEqual(state.recentSyncFailures, []);
  assert.equal(state.focusTimelineThroughAt, null);
  assert.equal(state.openRuntimeTimelineThroughAt, null);
});

function interval(clientEventId: string, sequenceNumber: number): ActivityIntervalV2 {
  const startedAtMs = (sequenceNumber - 1) * 15_000;
  return {
    clientEventId,
    activitySessionId: "session-1",
    sequenceNumber,
    source: "DESKTOP_APP",
    stream: "FOCUS",
    metric: "FOCUS_ACTIVE",
    subjectKey: "app:code",
    displayName: "Code",
    startedAt: new Date(Date.parse("2026-07-17T00:00:00.000Z") + startedAtMs).toISOString(),
    endedAt: new Date(Date.parse("2026-07-17T00:00:00.000Z") + startedAtMs + 15_000).toISOString(),
    clockEpochId: "epoch-1",
    startedMonotonicMs: startedAtMs,
    endedMonotonicMs: startedAtMs + 15_000,
    durationMs: 15_000,
    policyVersion: "policy-v1",
    policyLeaseId: "lease-1",
  };
}
