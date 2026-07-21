import assert from "node:assert/strict";
import test from "node:test";
import { TrackingActivityMetric } from "@prisma/client";
import { computeTarget } from "../src/modules/devices/tracking-v2-reconciliation.service.js";

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
