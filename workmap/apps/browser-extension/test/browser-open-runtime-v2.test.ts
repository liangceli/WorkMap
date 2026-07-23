import assert from "node:assert/strict";
import test from "node:test";
import { BrowserOpenRuntimeEngineV2 } from "../src/browserOpenRuntimeEngineV2.js";
import { policyBoundaryMonotonic } from "../src/backgroundV2.js";
import type {
  BrowserClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

const clock: BrowserClockEpochV2 = {
  clockEpochId: "runtime-epoch",
  clockEpochStartedAt: "2026-07-23T00:00:00.000Z",
  clockEpochStartedMonotonicMs: 0,
};

const policy: DeviceTrackingPolicyV2 = {
  policyId: "policy-id",
  policyVersion: "v3",
  effectiveAt: "2026-07-23T00:00:00.000Z",
  policyLeaseId: "lease-id",
  policyLeaseIssuedAt: "2026-07-23T00:00:00.000Z",
  policyLeaseExpiresAt: "2026-07-24T00:00:00.000Z",
  serverTime: "2026-07-23T00:00:00.000Z",
  scheduleTimeZone: "Australia/Adelaide",
  scheduleTimeZoneState: "CONFIRMED",
  allowedUtcWindows: [
    {
      startsAt: "2026-07-23T00:00:00.000Z",
      endsAt: "2026-07-24T00:00:00.000Z",
    },
  ],
  allowedUtcWindowsHash: "runtime-window",
  workHoursOnly: true,
  workdayStart: "09:00",
  workdayEnd: "21:33",
  idleThresholdMs: 60_000,
  collectAppFocus: true,
  collectDomainFocus: true,
  collectOpenRuntime: false,
  collectDomainOpenRuntime: true,
  acknowledgementState: "ACKNOWLEDGED",
  acknowledgedAt: "2026-07-22T00:00:00.000Z",
};

function idFactory() {
  let next = 1;
  return () => `runtime-id-${next++}`;
}

test("same-host tabs de-duplicate while different hostnames run in parallel", () => {
  const engine = new BrowserOpenRuntimeEngineV2(
    clock,
    policy,
    "CHROME",
    null,
    idFactory(),
  );

  engine.observeOpenDomains(["example.com", "example.com"], 0);
  const first = engine.settle(300_000).intervals;
  engine.observeOpenDomains(["example.com", "docs.example"], 300_000);
  const second = engine.settle(600_000).intervals;
  engine.observeOpenDomains(["docs.example"], 600_000);
  const third = engine.settle(900_000).intervals;
  const intervals = [...first, ...second, ...third];

  const totals = new Map<string, number>();
  for (const interval of intervals) {
    totals.set(
      interval.subjectKey,
      (totals.get(interval.subjectKey) ?? 0) + interval.durationMs,
    );
    assert.equal(interval.stream, "OPEN_RUNTIME");
    assert.equal(interval.metric, "OPEN_RUNTIME");
    assert.equal(interval.source, "BROWSER_DOMAIN");
    assert.equal(interval.displayName, interval.subjectKey);
    assert.ok(!("url" in interval));
  }
  assert.equal(totals.get("example.com"), 600_000);
  assert.equal(totals.get("docs.example"), 600_000);
});

test("restart recovery closes only through the last durable observation", () => {
  const engine = new BrowserOpenRuntimeEngineV2(
    clock,
    policy,
    "EDGE",
    null,
    idFactory(),
  );
  engine.observeOpenDomains(["example.com"], 0);
  const emitted = engine.settle(30_000).intervals;
  assert.equal(emitted.length, 1);

  const recovered = new BrowserOpenRuntimeEngineV2(
    clock,
    policy,
    "EDGE",
    engine.checkpoint(),
    idFactory(),
  );
  assert.deepEqual(recovered.clear(30_000).intervals, []);
});

test("Browser runtime cannot start without its explicit policy lease flag", () => {
  assert.throws(
    () =>
      new BrowserOpenRuntimeEngineV2(
        clock,
        { ...policy, collectDomainOpenRuntime: false },
        "CHROME",
      ),
    /authorised policy lease/,
  );
});

test("policy closure projects runtime to the authorised UTC boundary", () => {
  assert.equal(
    policyBoundaryMonotonic(
      clock,
      10_000,
      Date.parse("2026-07-23T00:01:00.000Z"),
      75_000,
    ),
    60_000,
  );
});
