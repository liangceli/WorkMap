import assert from "node:assert/strict";
import test from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";
import { BrowserFocusEngineV2 } from "../src/browserFocusEngineV2.js";
import { BrowserOpenRuntimeEngineV2 } from "../src/browserOpenRuntimeEngineV2.js";
import type {
  BrowserActivityIntervalV2,
  BrowserClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

test("active collection owns one bounded 20-second MV3 keepalive and stops it when collection ends", async () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let callback: (() => void) | null = null;
  let scheduled = 0;
  let cleared: unknown = null;
  let checkpointRuns = 0;

  try {
    globalThis.setInterval = ((handler: () => void, delay: number) => {
      assert.equal(delay, 20_000);
      callback = handler;
      scheduled += 1;
      return 42 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval;
    globalThis.clearInterval = ((handle: unknown) => {
      cleared = handle;
    }) as typeof clearInterval;

    const runtime = new BrowserExtensionRuntimeV2({} as never) as unknown as {
      engine: unknown;
      openRuntimeEngine: unknown;
      captureAllowed(): boolean;
      openRuntimeCollectionAllowed(): boolean;
      refreshCollectorKeepAlive(): void;
      runCollectorKeepAliveCheckpoint(): Promise<void>;
    };
    runtime.engine = { checkpoint: () => ({ current: {} }) };
    runtime.captureAllowed = () => true;
    runtime.runCollectorKeepAliveCheckpoint = async () => {
      checkpointRuns += 1;
    };

    runtime.refreshCollectorKeepAlive();
    runtime.refreshCollectorKeepAlive();
    assert.equal(scheduled, 1, "one active collector must own only one timer");
    assert.ok(callback);
    callback!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(checkpointRuns, 1);

    runtime.captureAllowed = () => false;
    runtime.refreshCollectorKeepAlive();
    assert.equal(cleared, 42);

    let openRuntimeDomains = 0;
    runtime.engine = null;
    runtime.openRuntimeEngine = {
      checkpoint: () => ({
        current: Array.from({ length: openRuntimeDomains }, () => ({})),
      }),
    };
    runtime.openRuntimeCollectionAllowed = () => true;
    runtime.refreshCollectorKeepAlive();
    assert.equal(scheduled, 1, "an empty runtime engine is not a session");
    openRuntimeDomains = 1;
    runtime.refreshCollectorKeepAlive();
    assert.equal(scheduled, 2);
    openRuntimeDomains = 0;
    runtime.refreshCollectorKeepAlive();
    assert.equal(cleared, 42);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("the keepalive checkpoint itself settles both proven collectors without an alarm", async () => {
  const focusUpdate = { source: "focus" };
  const runtimeUpdate = { source: "runtime" };
  const calls: string[] = [];
  const runtime = new BrowserExtensionRuntimeV2({} as never) as unknown as {
    state: unknown;
    engine: { settle(at: number): unknown };
    openRuntimeEngine: { settle(at: number): unknown };
    ensureInitialized(): Promise<void>;
    guardLifecycleContinuity(): Promise<boolean>;
    refreshPolicyIfDue(): Promise<void>;
    restoreCollectorIfAllowed(): Promise<void>;
    captureAllowed(): boolean;
    openRuntimeCollectionAllowed(): boolean;
    persistUpdate(update: unknown, immediateSync: boolean): Promise<boolean>;
    persistOpenRuntimeUpdate(update: unknown, immediateSync: boolean): Promise<boolean>;
    reconcileOpenRuntime(immediateSync: boolean): Promise<void>;
    reconcileBrowserReality(immediateSync: boolean): Promise<void>;
    restoreAfterQueuePressure(): Promise<void>;
    refreshCollectorKeepAlive(): void;
    runCollectorKeepAliveCheckpoint(): Promise<void>;
  };
  runtime.state = {};
  runtime.engine = {
    settle: (at) => {
      assert(Number.isFinite(at));
      calls.push("focus-settle");
      return focusUpdate;
    },
  };
  runtime.openRuntimeEngine = {
    settle: (at) => {
      assert(Number.isFinite(at));
      calls.push("runtime-settle");
      return runtimeUpdate;
    },
  };
  runtime.ensureInitialized = async () => undefined;
  runtime.guardLifecycleContinuity = async () => false;
  runtime.refreshPolicyIfDue = async () => undefined;
  runtime.restoreCollectorIfAllowed = async () => undefined;
  runtime.captureAllowed = () => true;
  runtime.openRuntimeCollectionAllowed = () => true;
  runtime.persistUpdate = async (update, immediateSync) => {
    assert.equal(update, focusUpdate);
    assert.equal(immediateSync, false);
    calls.push("focus-persist");
    return true;
  };
  runtime.persistOpenRuntimeUpdate = async (update, immediateSync) => {
    assert.equal(update, runtimeUpdate);
    assert.equal(immediateSync, false);
    calls.push("runtime-persist");
    return true;
  };
  runtime.reconcileOpenRuntime = async () => {
    calls.push("runtime-reconcile");
  };
  runtime.reconcileBrowserReality = async () => {
    calls.push("focus-reconcile");
  };
  runtime.restoreAfterQueuePressure = async () => undefined;
  runtime.refreshCollectorKeepAlive = () => undefined;

  await runtime.runCollectorKeepAliveCheckpoint();
  assert.deepEqual(calls, [
    "focus-settle",
    "focus-persist",
    "runtime-settle",
    "runtime-persist",
    "runtime-reconcile",
    "focus-reconcile",
  ]);
});

test("twenty-second keepalive settlement alone ledgers a two-hour active Edge page and open tab", () => {
  const clock: BrowserClockEpochV2 = {
    clockEpochId: "long-edge-epoch",
    clockEpochStartedAt: "2026-07-24T00:00:00.000Z",
    clockEpochStartedMonotonicMs: 0,
  };
  const policy: DeviceTrackingPolicyV2 = {
    policyId: "policy",
    policyVersion: "v4",
    effectiveAt: "2026-07-24T00:00:00.000Z",
    policyLeaseId: "lease",
    policyLeaseIssuedAt: "2026-07-24T00:00:00.000Z",
    policyLeaseExpiresAt: "2026-07-25T00:00:00.000Z",
    serverTime: "2026-07-24T00:00:00.000Z",
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [{
      startsAt: "2026-07-24T00:00:00.000Z",
      endsAt: "2026-07-25T00:00:00.000Z",
    }],
    allowedUtcWindowsHash: "window",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "21:33",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    collectDomainOpenRuntime: true,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: "2026-07-24T00:00:00.000Z",
  };
  let nextId = 1;
  const createId = () => `long-session-${nextId++}`;
  const focus = new BrowserFocusEngineV2(
    clock,
    policy,
    "EDGE",
    null,
    createId,
  );
  const runtime = new BrowserOpenRuntimeEngineV2(
    clock,
    policy,
    "EDGE",
    null,
    createId,
  );
  const focusIntervals: BrowserActivityIntervalV2[] = [];
  const runtimeIntervals: BrowserActivityIntervalV2[] = [];
  focus.acquireFocus(
    { subjectKey: "work.example", displayName: "work.example" },
    0,
  );
  runtime.observeOpenDomains(["work.example"], 0);

  for (let at = 10_000; at <= 7_200_000; at += 10_000) {
    focusIntervals.push(...focus.recordTrustedInteraction(at).intervals);
    if (at % 20_000 === 0) {
      focusIntervals.push(...focus.observe(at).intervals);
      runtimeIntervals.push(
        ...runtime.observeOpenDomains(["work.example"], at).intervals,
      );
      focusIntervals.push(...focus.settle(at).intervals);
      runtimeIntervals.push(...runtime.settle(at).intervals);
    }
  }

  const sum = (intervals: BrowserActivityIntervalV2[]) =>
    intervals.reduce((total, interval) => total + interval.durationMs, 0);
  assert.equal(sum(focusIntervals), 7_200_000);
  assert.equal(sum(runtimeIntervals), 7_200_000);
  assert(focusIntervals.every((interval) => interval.metric === "FOCUS_ACTIVE"));
  assert(runtimeIntervals.every((interval) => interval.metric === "OPEN_RUNTIME"));
  for (const intervals of [focusIntervals, runtimeIntervals]) {
    assert(
      intervals.every(
        (interval, index) =>
          interval.durationMs > 0 &&
          (index === 0 ||
            interval.startedMonotonicMs >=
              intervals[index - 1]!.endedMonotonicMs),
      ),
    );
  }
});
