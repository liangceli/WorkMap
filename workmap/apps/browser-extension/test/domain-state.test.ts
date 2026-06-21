import assert from "node:assert/strict";
import test from "node:test";
import { DomainTrackingState } from "../src/domainState.js";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

test("tracks tabs, focus, idle and service-worker restoration without duplicate identity", () => {
  let id = 0;
  const createId = () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
  const tracker = new DomainTrackingState(undefined, 1_000, 120_000, createId);
  assert.deepEqual(tracker.observe("a.example", "active", 1_000, DEVICE_ID, "CHROME"), []);
  tracker.observe("a.example", "active", 6_000, DEVICE_ID, "CHROME");
  const switched = tracker.observe("b.example", "active", 11_000, DEVICE_ID, "CHROME");
  assert.equal(switched[0]?.domain, "a.example");
  assert.equal(switched[0]?.durationSeconds, 10);

  const restored = new DomainTrackingState(tracker.snapshot(), 1_000, 120_000, createId);
  const idleStarted = restored.observe("b.example", "idle", 16_000, DEVICE_ID, "CHROME");
  assert.equal(idleStarted[0]?.domain, "b.example");
  assert.equal(idleStarted[0]?.isIdle, false);
  assert.equal(idleStarted[0]?.clientEventId, tracker.snapshot().active?.clientEventId);
  assert.deepEqual(restored.observe("b.example", "idle", 20_000, DEVICE_ID, "CHROME"), []);
  const resumed = restored.observe("b.example", "active", 25_000, DEVICE_ID, "CHROME");
  assert.equal(resumed[0]?.isIdle, true);
  restored.observe("c.example", "active", 26_000, DEVICE_ID, "CHROME");
  const checkpoint = restored.checkpoint(31_000, DEVICE_ID, "CHROME");
  assert.equal(checkpoint[0]?.domain, "c.example");
});
