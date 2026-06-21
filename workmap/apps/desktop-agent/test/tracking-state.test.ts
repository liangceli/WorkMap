import assert from "node:assert/strict";
import test from "node:test";
import { AppTrackingState } from "../src/trackingState.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const base = Date.parse("2026-06-18T00:00:00.000Z");

test("tracks app switches, stable durations, idle, resume and shutdown", () => {
  let id = 0;
  const state = new AppTrackingState({ minimumDurationMs: 1_000, createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}` });
  assert.deepEqual(state.observe(sample("Code", 0), DEVICE_ID), []);
  assert.deepEqual(state.observe(sample("Code", 5_000), DEVICE_ID), []);
  const switched = state.observe(sample("Outlook", 10_000), DEVICE_ID);
  assert.equal(switched[0]?.appName, "Code");
  assert.equal(switched[0]?.durationSeconds, 10);
  const idle = state.observe({ ...sample(null, 15_000), isIdle: true }, DEVICE_ID);
  assert.equal(idle[0]?.appName, "Outlook");
  assert.equal(idle[0]?.durationSeconds, 5);
  assert.deepEqual(state.observe({ ...sample(null, 20_000), isLocked: true }, DEVICE_ID), []);
  assert.deepEqual(state.observe(sample("Teams", 25_000), DEVICE_ID), []);
  const shutdown = state.shutdown(DEVICE_ID, base + 30_000);
  assert.equal(shutdown[0]?.appName, "Teams");
  assert.equal(shutdown[0]?.durationSeconds, 5);
});

test("filters short/no-window segments, duplicate samples and caps delayed samples", () => {
  const state = new AppTrackingState({ minimumDurationMs: 5_000, maximumSampleGapMs: 10_000, createEventId: () => "00000000-0000-4000-8000-000000000001" });
  state.observe(sample("A", 0), DEVICE_ID);
  assert.deepEqual(state.observe(sample("B", 2_000), DEVICE_ID), []);
  assert.deepEqual(state.observe(sample("B", 2_000), DEVICE_ID), []);
  state.observe(sample("B", 7_000), DEVICE_ID);
  const delayed = state.observe(sample("C", 60_000), DEVICE_ID);
  assert.equal(delayed[0]?.durationSeconds, 15);
  assert.deepEqual(state.observe(sample(null, 61_000), DEVICE_ID), []);
});

function sample(appName: string | null, offset: number) {
  return { appName, isIdle: false, isLocked: false, observedAtMs: base + offset };
}
