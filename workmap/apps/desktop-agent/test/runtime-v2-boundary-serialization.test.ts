import assert from "node:assert/strict";
import test from "node:test";
import {
  DesktopAgentRuntimeV2,
  recoveredTailPolicyDecisionV2,
  trackingSyncBackoffDelayV2,
} from "../src/runtimeV2.js";
import { TRACKING_V2_SYNC_TIMEOUT_MS } from "../src/apiClient.js";
import { DESKTOP_V2_SYNC_BATCH_SIZE } from "../src/trackingV2Types.js";
import type {
  ActivityIntervalV2,
  DesktopTrackingRuntimeStateV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";
import { createInitialDesktopTrackingV2State } from "../src/trackingV2Store.js";

test("0.6.7 runtime state upgrades with empty non-regressing watermarks", () => {
  const legacyState = createInitialDesktopTrackingV2State() as Partial<
    ReturnType<typeof createInitialDesktopTrackingV2State>
  >;
  delete legacyState.focusTimelineThroughAt;
  delete legacyState.openRuntimeTimelineThroughAt;
  const runtime = new DesktopAgentRuntimeV2(
    {
      apiBaseUrl: "https://workmap.invalid",
      credential: "test-only-credential",
      deviceId: "device-1",
      agentVersion: "desktop-agent-windows/test",
    },
    {
      store: {
        readRuntimeState: () => legacyState,
      } as never,
    },
  );
  const state = (runtime as unknown as {
    state: ReturnType<typeof createInitialDesktopTrackingV2State>;
  }).state;

  assert.equal(state.focusTimelineThroughAt, null);
  assert.equal(state.openRuntimeTimelineThroughAt, null);
});

test("Electron power boundaries wait for the existing native mutation lane", async () => {
  const runtime = new DesktopAgentRuntimeV2(
    {
      apiBaseUrl: "https://workmap.invalid",
      credential: "test-only-credential",
      deviceId: "device-1",
      agentVersion: "desktop-agent-windows/test",
    },
    {
      store: {
        readRuntimeState: () => null,
      } as never,
    },
  );
  const events: string[] = [];
  let releaseNativeMutation!: () => void;
  const nativeMutation = new Promise<void>((resolve) => {
    releaseNativeMutation = resolve;
  }).then(() => {
    events.push("native-finished");
  });
  const internals = runtime as unknown as {
    eventChain: Promise<void>;
    enqueueHostBoundary: () => Promise<void>;
    enqueueLifecycle: () => Promise<void>;
    flushStatusQueue: () => Promise<void>;
  };
  internals.eventChain = nativeMutation;
  internals.enqueueHostBoundary = async () => {
    events.push("electron-boundary");
  };
  internals.enqueueLifecycle = async () => {
    events.push("lifecycle");
  };
  internals.flushStatusQueue = async () => {
    events.push("status-flush");
  };

  const report = runtime.reportDeviceStatus("LOCKED", "SYSTEM_LOCK");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, []);

  releaseNativeMutation();
  await report;
  assert.deepEqual(events, [
    "native-finished",
    "electron-boundary",
    "lifecycle",
    "status-flush",
  ]);
});

test("retryable sync failures use bounded global backoff instead of one request per new row", async () => {
  assert.equal(TRACKING_V2_SYNC_TIMEOUT_MS, 60_000);
  assert.equal(DESKTOP_V2_SYNC_BATCH_SIZE, 20);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 20].map(trackingSyncBackoffDelayV2),
    [5_000, 15_000, 30_000, 60_000, 60_000, 60_000],
  );

  const runtime = new DesktopAgentRuntimeV2(
    {
      apiBaseUrl: "https://workmap.invalid",
      credential: "test-only-credential",
      deviceId: "device-1",
      agentVersion: "desktop-agent-windows/test",
    },
    {
      store: {
        readRuntimeState: () => ({
          ...createInitialDesktopTrackingV2State(),
          protocolActivatedAt: "2026-07-28T00:00:00.000Z",
        }),
      } as never,
    },
  );
  let syncCalls = 0;
  const internals = runtime as unknown as {
    syncRetryNotBeforeMs: number;
    syncRetryTimer: NodeJS.Timeout | null;
    requestSync: () => Promise<void>;
    performSync: () => Promise<void>;
  };
  internals.performSync = async () => {
    syncCalls += 1;
  };
  internals.syncRetryNotBeforeMs = Date.now() + 30;

  await Promise.all([
    internals.requestSync(),
    internals.requestSync(),
    internals.requestSync(),
  ]);
  assert.equal(syncCalls, 0);
  assert.notEqual(internals.syncRetryTimer, null);

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(syncCalls, 1);
  if (internals.syncRetryTimer) clearTimeout(internals.syncRetryTimer);
});

test("startup keeps the original lease on recovered Focus and open/runtime tails after a lease refresh", async () => {
  const persisted = recoveredRuntimeState(OLD_POLICY);
  const persistedIntervals: ActivityIntervalV2[] = [];
  let writtenState: DesktopTrackingRuntimeStateV2 | null = null;
  const runtime = new DesktopAgentRuntimeV2(
    testConfig(),
    {
      store: recoveryStore(
        persisted,
        persistedIntervals,
        (state) => { writtenState = state; },
      ) as never,
      diagnosticLog: quietDiagnosticLog() as never,
    },
  );
  const internals = runtime as unknown as {
    state: DesktopTrackingRuntimeStateV2;
    closeRecoveredV2Tail: () => Promise<void>;
  };
  internals.state.policy = NEW_POLICY;

  await internals.closeRecoveredV2Tail();

  assert.equal(persistedIntervals.length, 3);
  assert.equal(
    persistedIntervals.every((interval) => interval.policyLeaseId === "lease-old"),
    true,
  );
  assert.equal(writtenState?.clock, null);
  assert.equal(writtenState?.engineCheckpoint, null);
  assert.equal(writtenState?.openRuntimeClock, null);
  assert.equal(writtenState?.openRuntimeCheckpoint, null);
});

test("startup preserves same-lease recovery when every tail remains inside its authorised window", async () => {
  const persisted = recoveredRuntimeState(OLD_POLICY);
  const persistedIntervals: ActivityIntervalV2[] = [];
  const runtime = new DesktopAgentRuntimeV2(
    testConfig(),
    {
      store: recoveryStore(persisted, persistedIntervals) as never,
      diagnosticLog: quietDiagnosticLog() as never,
    },
  );
  const internals = runtime as unknown as {
    closeRecoveredV2Tail: () => Promise<void>;
  };

  await internals.closeRecoveredV2Tail();

  assert.equal(persistedIntervals.length, 3);
  assert.deepEqual(
    persistedIntervals.map((interval) => interval.stream).sort(),
    ["FOCUS", "OPEN_RUNTIME", "OPEN_RUNTIME"],
  );
  assert.equal(
    persistedIntervals.every((interval) => interval.policyLeaseId === "lease-old"),
    true,
  );
});

test("same lease still rejects recovery timestamps outside its own allowed window", () => {
  const decision = recoveredTailPolicyDecisionV2({
    recoveredPolicy: OLD_POLICY,
    stream: "FOCUS",
    clock: {
      clockEpochId: "clock-old",
      clockEpochStartedAt: "2026-07-28T07:30:00.000Z",
      clockEpochStartedMonotonicMs: 0,
    },
    ranges: [{ startsAtMonotonicMs: 1_000, endsAtMonotonicMs: 2_000 }],
  });

  assert.deepEqual(decision, {
    recover: false,
    reasonCode: "RECOVERY_OUTSIDE_POLICY_WINDOW",
  });
});

const OLD_POLICY: DeviceTrackingPolicyV2 = {
  policyId: "policy-1",
  policyVersion: "v3",
  effectiveAt: "2026-07-29T00:00:00.000Z",
  policyLeaseId: "lease-old",
  policyLeaseIssuedAt: "2026-07-29T00:00:00.000Z",
  policyLeaseExpiresAt: "2026-07-30T00:00:00.000Z",
  serverTime: "2026-07-29T07:30:10.000Z",
  scheduleTimeZone: "Australia/Adelaide",
  scheduleTimeZoneState: "CONFIRMED",
  allowedUtcWindows: [{
    startsAt: "2026-07-29T00:00:00.000Z",
    endsAt: "2026-07-30T00:00:00.000Z",
  }],
  allowedUtcWindowsHash: "old-window",
  workHoursOnly: true,
  workdayStart: "09:00",
  workdayEnd: "21:33",
  idleThresholdMs: 60_000,
  collectAppFocus: true,
  collectDomainFocus: true,
  collectOpenRuntime: true,
  acknowledgementState: "ACKNOWLEDGED",
  acknowledgedAt: "2026-07-29T00:00:00.000Z",
};

const NEW_POLICY: DeviceTrackingPolicyV2 = {
  ...OLD_POLICY,
  policyLeaseId: "lease-new",
  policyLeaseIssuedAt: "2026-07-30T00:30:00.000Z",
  policyLeaseExpiresAt: "2026-07-31T00:30:00.000Z",
  serverTime: "2026-07-30T00:30:10.000Z",
  allowedUtcWindows: [{
    startsAt: "2026-07-30T00:30:00.000Z",
    endsAt: "2026-07-30T12:03:00.000Z",
  }],
  allowedUtcWindowsHash: "new-window",
};

function testConfig() {
  return {
    apiBaseUrl: "https://workmap.invalid",
    credential: "test-only-credential",
    deviceId: "device-1",
    agentVersion: "desktop-agent-windows/test",
  };
}

function recoveredRuntimeState(
  policy: DeviceTrackingPolicyV2,
): DesktopTrackingRuntimeStateV2 {
  return {
    ...createInitialDesktopTrackingV2State(),
    protocolActivatedAt: "2026-07-29T00:00:00.000Z",
    policy,
    clock: {
      clockEpochId: "focus-clock",
      clockEpochStartedAt: "2026-07-29T07:30:00.000Z",
      clockEpochStartedMonotonicMs: 0,
    },
    engineCheckpoint: {
      version: 1,
      snapshotSequence: 1,
      nextIntervalSequence: 2,
      lastObservedAtMonotonicMs: 20_000,
      collectorState: "HEALTHY",
      current: {
        activitySessionId: "focus-session",
        currentStateId: "focus-state",
        subject: { subjectKey: "app:focus", displayName: "Focus App" },
        state: "ACTIVE",
        sessionStartedAtMonotonicMs: 0,
        stateStartedAtMonotonicMs: 0,
        activeEvidenceAtMonotonicMs: 20_000,
        lastActivityEvidenceKind: "FOCUS_ACQUIRED",
        confirmedThroughMonotonicMs: 10_000,
        latestEmittedIntervalSequence: null,
        latestEmittedClientEventId: null,
      },
    },
    openRuntimeClock: {
      clockEpochId: "runtime-clock",
      clockEpochStartedAt: "2026-07-29T07:30:00.000Z",
      clockEpochStartedMonotonicMs: 0,
    },
    openRuntimeCheckpoint: {
      version: 1,
      nextIntervalSequence: 3,
      lastObservedAtMonotonicMs: 20_000,
      current: ["one", "two"].map((key) => ({
        activitySessionId: `runtime-${key}`,
        subject: { subjectKey: `app:${key}`, displayName: `Runtime ${key}` },
        openedAtMonotonicMs: 0,
        confirmedThroughMonotonicMs: 10_000,
      })),
    },
  };
}

function recoveryStore(
  state: DesktopTrackingRuntimeStateV2,
  intervals: ActivityIntervalV2[],
  onWrite: (state: DesktopTrackingRuntimeStateV2) => void = () => undefined,
) {
  return {
    readRuntimeState: () => state,
    persistEngineUpdate: (
      items: ActivityIntervalV2[],
      next: DesktopTrackingRuntimeStateV2,
    ) => {
      intervals.push(...items);
      onWrite(next);
    },
    persistRuntimeUpdate: (
      items: ActivityIntervalV2[],
      next: DesktopTrackingRuntimeStateV2,
    ) => {
      intervals.push(...items);
      onWrite(next);
    },
    writeRuntimeState: onWrite,
  };
}

function quietDiagnosticLog() {
  return {
    write: async () => undefined,
    getDirectory: () => "test-only",
  };
}
