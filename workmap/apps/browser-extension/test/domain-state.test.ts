import assert from "node:assert/strict";
import test from "node:test";
import { DomainTrackingState } from "../src/domainState.js";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

test("trusted interaction transfers focus between different domains without overlap", () => {
  const tracker = createTracker();
  assert.deepEqual(tracker.recordInteraction(1, "a.example", 1_000, DEVICE_ID, "CHROME"), []);
  const switched = tracker.recordInteraction(2, "b.example", 11_000, DEVICE_ID, "CHROME");
  const focusA = switched.find((event) => event.domain === "a.example" && event.isActiveWindow);
  assert.equal(focusA?.startedAt, "1970-01-01T00:00:01.000Z");
  assert.equal(focusA?.endedAt, "1970-01-01T00:00:11.000Z");
  assert.equal(focusA?.durationSeconds, 10);
  assert.equal(focusA?.isIdle, false);
});

test("same-domain tabs share one open runtime and do not multiply duration", () => {
  const tracker = createTracker(undefined, 600_000);
  tracker.reconcileTabs([{ tabId: 1, domain: "github.com" }], 1_000, DEVICE_ID, "CHROME");
  tracker.reconcileTabs([
    { tabId: 1, domain: "github.com" },
    { tabId: 2, domain: "github.com" },
    { tabId: 3, domain: "github.com" },
  ], 2_000, DEVICE_ID, "CHROME");
  assert.deepEqual(tracker.reconcileTabs([{ tabId: 2, domain: "github.com" }], 101_000, DEVICE_ID, "CHROME"), []);
  const closed = tracker.reconcileTabs([], 301_000, DEVICE_ID, "CHROME");
  assert.equal(closed.length, 1);
  assert.equal(closed[0]?.domain, "github.com");
  assert.equal(closed[0]?.isActiveWindow, false);
  assert.equal(closed[0]?.durationSeconds, 300);
});

test("focus active changes to focused idle at the exact 30 second boundary and resumes immediately", () => {
  const tracker = createTracker();
  tracker.recordInteraction(7, "docs.example", 1_000, DEVICE_ID, "EDGE");
  const idle = tracker.markIdle(7, 1_000, 31_000, DEVICE_ID, "EDGE");
  assert.equal(idle.length, 1);
  assert.equal(idle[0]?.isIdle, false);
  assert.equal(idle[0]?.durationSeconds, 30);
  assert.equal(idle[0]?.endedAt, "1970-01-01T00:00:31.000Z");

  const resumed = tracker.recordInteraction(7, "docs.example", 41_000, DEVICE_ID, "EDGE");
  const focusedIdle = resumed.find((event) => event.isIdle && event.isActiveWindow);
  assert.equal(focusedIdle?.startedAt, "1970-01-01T00:00:31.000Z");
  assert.equal(focusedIdle?.durationSeconds, 10);
});

test("persisted state checkpoints focus and de-duplicated runtime with stable event ids", () => {
  const tracker = createTracker();
  tracker.recordInteraction(9, "workmap.test", 1_000, DEVICE_ID, "CHROME");
  const restored = createTracker(tracker.snapshot());
  const events = restored.checkpoint(11_000, DEVICE_ID, "CHROME");
  assert.equal(events.filter((event) => event.isActiveWindow).length, 1);
  assert.equal(events.filter((event) => !event.isActiveWindow).length, 1);
  assert.equal(events[0]?.clientEventId, tracker.snapshot().focus?.clientEventId);
});

function createTracker(snapshot?: ConstructorParameters<typeof DomainTrackingState>[0], maximumSampleGapMs = 120_000) {
  let id = 0;
  return new DomainTrackingState(snapshot, 0, maximumSampleGapMs, () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`);
}
