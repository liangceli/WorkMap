import assert from "node:assert/strict";
import test from "node:test";
import { TrackingActivityMetric } from "@prisma/client";
import {
  computeTarget,
  TRACKING_RECONCILIATION_INGESTION_QUIET_PERIOD_MS,
  TRACKING_RECONCILIATION_QUIET_PERIOD_MS,
  TrackingV2ReconciliationService,
} from "../src/modules/devices/tracking-v2-reconciliation.service.js";
import { TrackingV2ReconciliationWorker } from "../src/modules/devices/tracking-v2-reconciliation.worker.js";
import { advanceTrackingCursorCoverageV2 } from "../src/modules/devices/tracking-v2-sync.service.js";

const BASE = Date.parse("2026-07-17T09:00:00.000Z");

function fragment(
  deviceId: string,
  activitySubjectId: string,
  metric: TrackingActivityMetric,
  startOffsetMs: number,
  endOffsetMs: number,
) {
  return {
    deviceId,
    activitySubjectId,
    metric,
    startedAt: new Date(BASE + startOffsetMs),
    endedAt: new Date(BASE + endOffsetMs),
    activityInterval: {
      receivedAt: new Date(BASE + endOffsetMs + 100),
    },
  };
}

test("user/day reconciliation unions overlapping devices and gives Active priority over Idle", () => {
  const result = computeTarget([
    fragment("desktop-1", "app-code", TrackingActivityMetric.FOCUS_ACTIVE, 0, 10_000),
    fragment("desktop-2", "app-edge", TrackingActivityMetric.FOCUS_ACTIVE, 4_000, 12_000),
    fragment("desktop-1", "app-code", TrackingActivityMetric.FOCUS_IDLE, 8_000, 15_000),
  ]);

  assert.deepEqual(result.user, {
    focusActiveMs: 12_000n,
    focusedIdleMs: 3_000n,
    openRuntimeMs: 0n,
  });
  assert.deepEqual(result.subjects.get("app-code"), {
    focusActiveMs: 10_000n,
    focusedIdleMs: 5_000n,
    openRuntimeMs: 0n,
  });
  assert.deepEqual(result.subjects.get("app-edge"), {
    focusActiveMs: 8_000n,
    focusedIdleMs: 0n,
    openRuntimeMs: 0n,
  });
});

test("a four-second confirmed interval remains official history", () => {
  const result = computeTarget([
    fragment("desktop-1", "app-terminal", TrackingActivityMetric.FOCUS_ACTIVE, 0, 4_000),
  ]);

  assert.equal(result.user.focusActiveMs, 4_000n);
  assert.equal(result.subjects.get("app-terminal")?.focusActiveMs, 4_000n);
});

test("adjacent confirmed intervals remain lossless without double counting", () => {
  const result = computeTarget([
    fragment("desktop-1", "app-code", TrackingActivityMetric.FOCUS_ACTIVE, 0, 15_000),
    fragment("desktop-1", "app-code", TrackingActivityMetric.FOCUS_ACTIVE, 15_000, 30_000),
    fragment("desktop-1", "app-code", TrackingActivityMetric.FOCUS_ACTIVE, 15_000, 30_000),
  ]);

  assert.equal(result.user.focusActiveMs, 30_000n);
  assert.equal(result.subjects.get("app-code")?.focusActiveMs, 30_000n);
});

test("Chrome and Edge overlapping the same user, hostname and metric are unioned", () => {
  const result = computeTarget([
    fragment("chrome-device", "domain-docs", TrackingActivityMetric.FOCUS_ACTIVE, 0, 30_000),
    fragment("edge-device", "domain-docs", TrackingActivityMetric.FOCUS_ACTIVE, 10_000, 40_000),
  ]);

  assert.equal(result.user.focusActiveMs, 40_000n);
  assert.equal(result.subjects.get("domain-docs")?.focusActiveMs, 40_000n);
});

test("Chrome and Edge Domain runtime overlap is unioned for the same hostname", () => {
  const result = computeTarget([
    fragment("chrome-device", "domain-docs", TrackingActivityMetric.OPEN_RUNTIME, 0, 30_000),
    fragment("edge-device", "domain-docs", TrackingActivityMetric.OPEN_RUNTIME, 10_000, 40_000),
  ]);

  assert.equal(result.user.openRuntimeMs, 40_000n);
  assert.equal(result.subjects.get("domain-docs")?.openRuntimeMs, 40_000n);
});

test("cursor refresh advances from its contiguous prefix without rescanning accepted history", () => {
  const coverage = advanceTrackingCursorCoverageV2(
    {
      contiguousThroughSequence: 100,
      latestAcceptedEndedAt: "2026-07-17T10:00:00.000Z",
      rejectedRanges: [
        { from: 5, to: 5, code: "POLICY_REJECTED" },
        { from: 102, to: 102, code: "STALE_CACHE" },
      ],
    },
    [
      {
        sequenceNumber: 101,
        status: "ACCEPTED",
        endedAt: "2026-07-17T10:01:00.000Z",
      },
      {
        sequenceNumber: 102,
        status: "REJECTED",
        terminal: true,
        rejectionCode: "FOCUS_OVERLAP",
      },
      {
        sequenceNumber: 104,
        status: "ACCEPTED",
        endedAt: "2026-07-17T10:04:00.000Z",
      },
    ],
  );

  assert.deepEqual(coverage, {
    contiguousThroughSequence: 102,
    latestAcceptedEndedAt: "2026-07-17T10:04:00.000Z",
    missingRanges: [{ from: 103, to: 103 }],
    rejectedRanges: [
      { from: 5, to: 5, code: "POLICY_REJECTED" },
      { from: 102, to: 102, code: "FOCUS_OVERLAP" },
    ],
  });
});

test("background reconciliation waits for a quiet target instead of racing active uploads", async () => {
  type DirtyTargetQuery = {
    where: { dirtyAt: { lte: Date } };
    take: number;
  };
  let query: DirtyTargetQuery | null = null;
  const service = new TrackingV2ReconciliationService({
    usageReconciliationTarget: {
      updateMany: async () => ({ count: 0 }),
      findMany: async (input: DirtyTargetQuery) => {
        query = input;
        return [];
      },
    },
  } as never);
  const before = Date.now();

  const result = await service.reconcileDirtyTargets();
  const observedQuery = query as DirtyTargetQuery | null;
  assert(observedQuery);
  const cutoff = observedQuery.where.dirtyAt.lte;

  assert.deepEqual(result, { reconciled: 0 });
  assert.equal(observedQuery.take, 4);
  assert.ok(
    cutoff.getTime() <= before - TRACKING_RECONCILIATION_QUIET_PERIOD_MS + 100,
  );
  assert.ok(
    cutoff.getTime() >= before - TRACKING_RECONCILIATION_QUIET_PERIOD_MS - 100,
  );
});

test("recent Tracking v2 traffic is detected without changing ingestion state", async () => {
  type DeviceQuery = {
    where: {
      protocolActivatedAt: { not: null };
      revokedAt: null;
      lastSeenAt: { gte: Date };
    };
    select: { id: true };
  };
  let query: DeviceQuery | null = null;
  const service = new TrackingV2ReconciliationService({
    device: {
      findFirst: async (input: DeviceQuery) => {
        query = input;
        return { id: "recent-tracking-device" };
      },
    },
  } as never);
  const now = new Date("2026-08-10T02:00:00.000Z");

  const result = await service.hasRecentTrackingActivity(
    TRACKING_RECONCILIATION_INGESTION_QUIET_PERIOD_MS,
    now,
  );
  const observedQuery = query as DeviceQuery | null;

  assert.equal(result, true);
  assert(observedQuery);
  assert.equal(
    observedQuery.where.lastSeenAt.gte.toISOString(),
    "2026-08-10T01:58:00.000Z",
  );
  assert.deepEqual(observedQuery.where.protocolActivatedAt, {
    not: null,
  });
  assert.equal(observedQuery.where.revokedAt, null);
  assert.deepEqual(observedQuery.select, { id: true });
});

test("background reconciliation defers while tracking clients are active", async () => {
  let reconcileCalls = 0;
  const worker = new TrackingV2ReconciliationWorker({
    hasRecentTrackingActivity: async () => true,
    reconcileDirtyTargets: async () => {
      reconcileCalls += 1;
      return { reconciled: 1 };
    },
  } as never);

  const result = await worker.runOnce();

  assert.deepEqual(result, { deferred: true, reconciled: 0 });
  assert.equal(reconcileCalls, 0);
  worker.onModuleDestroy();
});

test("background reconciliation resumes one target after tracking is quiet", async () => {
  let requestedLimit: number | null = null;
  const worker = new TrackingV2ReconciliationWorker({
    hasRecentTrackingActivity: async () => false,
    reconcileDirtyTargets: async (limit: number) => {
      requestedLimit = limit;
      return { reconciled: 1 };
    },
  } as never);

  const result = await worker.runOnce();

  assert.deepEqual(result, { deferred: false, reconciled: 1 });
  assert.equal(requestedLimit, 1);
  worker.onModuleDestroy();
});
