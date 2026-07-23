import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBrowserFocusTimelineThroughAt,
  calculateBrowserServerOffsetMs,
  createBrowserFocusClockV2,
} from "../src/browserFocusTimelineV2.js";
import { BrowserFocusEngineV2 } from "../src/browserFocusEngineV2.js";
import type {
  BrowserActivityIntervalV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const BASE = Date.parse("2026-07-23T00:00:00.000Z");

test("delayed evidence and a regressed clock estimate cannot overlap Focus epochs", () => {
  const firstClock = createBrowserFocusClockV2({
    serverNowMs: BASE + 10_000,
    processingMonotonicMs: 10_000,
    observationMonotonicMs: 0,
    protocolActivatedAt: new Date(BASE).toISOString(),
    focusTimelineThroughAt: null,
    policy: policy(),
    createId: () => "epoch-1",
  });
  assert(firstClock);
  const firstEngine = new BrowserFocusEngineV2(
    firstClock,
    policy(),
    "EDGE",
    null,
    () => "first-event",
  );
  firstEngine.acquireFocus(subject("first.example"), 0);
  const first = firstEngine.clearFocus(10_000).intervals;
  assert.equal(first.length, 1);

  const through = advanceBrowserFocusTimelineThroughAt(null, first);
  const secondClock = createBrowserFocusClockV2({
    serverNowMs: BASE + 11_000,
    processingMonotonicMs: 21_000,
    observationMonotonicMs: 19_000,
    protocolActivatedAt: new Date(BASE).toISOString(),
    focusTimelineThroughAt: through,
    policy: policy(),
    createId: () => "epoch-2",
  });
  assert(secondClock);
  const secondEngine = new BrowserFocusEngineV2(
    secondClock,
    policy(),
    "EDGE",
    null,
    () => "second-event",
  );
  secondEngine.acquireFocus(subject("second.example"), 19_000);
  const second = secondEngine.clearFocus(20_000).intervals;
  assert.equal(second.length, 1);

  assert.equal(first[0]!.endedAt, second[0]!.startedAt);
  assert.equal(first[0]!.startedAt, "2026-07-23T00:00:00.000Z");
  assert.equal(second[0]!.endedAt, "2026-07-23T00:00:11.000Z");
  assert(
    Date.parse(first[0]!.endedAt) <= Date.parse(second[0]!.startedAt),
  );
});

test("a future legacy watermark pauses epoch creation until server time catches up", () => {
  const input = {
    processingMonotonicMs: 20_000,
    observationMonotonicMs: 20_000,
    protocolActivatedAt: new Date(BASE).toISOString(),
    focusTimelineThroughAt: new Date(BASE + 30_000).toISOString(),
    policy: policy(),
    createId: () => "epoch",
  };
  assert.equal(
    createBrowserFocusClockV2({ ...input, serverNowMs: BASE + 29_999 }),
    null,
  );
  assert.equal(
    createBrowserFocusClockV2({ ...input, serverNowMs: BASE + 30_000 })
      ?.clockEpochStartedAt,
    "2026-07-23T00:00:30.000Z",
  );
});

test("the timeline watermark advances monotonically across queued intervals", () => {
  const intervals = [
    interval("2026-07-23T00:00:03.000Z"),
    interval("2026-07-23T00:00:09.000Z"),
    interval("2026-07-23T00:00:05.000Z"),
  ];
  assert.equal(
    advanceBrowserFocusTimelineThroughAt(
      "2026-07-23T00:00:07.000Z",
      intervals,
    ),
    "2026-07-23T00:00:09.000Z",
  );
});

test("server clock calibration uses request start instead of delayed response time", () => {
  assert.equal(
    calculateBrowserServerOffsetMs(
      "2026-07-23T00:00:01.250Z",
      BASE + 1_000,
    ),
    250,
  );
  assert.equal(calculateBrowserServerOffsetMs("invalid", BASE), null);
});

function policy(): DeviceTrackingPolicyV2 {
  return {
    policyId: "policy-1",
    policyVersion: "v2",
    effectiveAt: new Date(BASE).toISOString(),
    policyLeaseId: "lease-1",
    policyLeaseIssuedAt: new Date(BASE).toISOString(),
    policyLeaseExpiresAt: new Date(BASE + 24 * 60 * 60_000).toISOString(),
    serverTime: new Date(BASE).toISOString(),
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [
      {
        startsAt: new Date(BASE).toISOString(),
        endsAt: new Date(BASE + 24 * 60 * 60_000).toISOString(),
      },
    ],
    allowedUtcWindowsHash: "hash",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "21:33",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: new Date(BASE).toISOString(),
  };
}

function subject(subjectKey: string) {
  return { subjectKey, displayName: subjectKey };
}

function interval(endedAt: string): BrowserActivityIntervalV2 {
  return {
    clientEventId: `event-${endedAt}`,
    activitySessionId: "session",
    sequenceNumber: 1,
    source: "BROWSER_DOMAIN",
    stream: "FOCUS",
    metric: "FOCUS_ACTIVE",
    subjectKey: "example.test",
    displayName: "example.test",
    browserName: "CHROME",
    startedAt: new Date(Date.parse(endedAt) - 1_000).toISOString(),
    endedAt,
    clockEpochId: "epoch",
    startedMonotonicMs: 0,
    endedMonotonicMs: 1_000,
    durationMs: 1_000,
    policyVersion: "v2",
    policyLeaseId: "lease-1",
  };
}
