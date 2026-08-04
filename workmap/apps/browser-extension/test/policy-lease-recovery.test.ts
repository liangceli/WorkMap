import assert from "node:assert/strict";
import test from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";
import { BrowserFocusEngineV2 } from "../src/browserFocusEngineV2.js";
import { BrowserOpenRuntimeEngineV2 } from "../src/browserOpenRuntimeEngineV2.js";
import {
  createInitialBrowserTrackingV2State,
  type BrowserActivityIntervalV2,
  type BrowserLiveFocusSnapshotV2,
  type BrowserTrackingRuntimeStateV2,
  type BrowserTrackingSyncResponseV2,
  type DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

type RecoveryHarness = {
  state: BrowserTrackingRuntimeStateV2 | null;
  config: {
    apiBaseUrl: string;
    deviceId: string;
    browserName: string;
    credential: string;
  } | null;
  browserName: "EDGE" | "CHROME" | null;
  connectionState: "ONLINE" | "OFFLINE";
  collectorState: "HEALTHY" | "PAUSED";
  runtimeGeneration: number;
  store: {
    writeRuntimeState(state: BrowserTrackingRuntimeStateV2): Promise<void>;
    persistEngineUpdate(
      intervals: BrowserActivityIntervalV2[],
      state: BrowserTrackingRuntimeStateV2,
      snapshot: BrowserLiveFocusSnapshotV2 | null,
    ): Promise<BrowserTrackingRuntimeStateV2>;
    persistOpenRuntimeUpdate(
      intervals: BrowserActivityIntervalV2[],
      state: BrowserTrackingRuntimeStateV2,
    ): Promise<BrowserTrackingRuntimeStateV2>;
    applySyncResults(
      results: BrowserTrackingSyncResponseV2["results"],
      requestId: string,
    ): Promise<void>;
    readRuntimeState(): Promise<BrowserTrackingRuntimeStateV2>;
  };
  closeRecoveredV2Tail(): Promise<void>;
  ensureProtocolV2(stored: { workmapQueue?: never[] }): Promise<boolean>;
  applySyncSuccess(
    prepared: {
      generation: number;
      deviceId: string;
      clientInstanceId: string;
      config: NonNullable<RecoveryHarness["config"]>;
      ready: never[];
      requestId: string;
      sentSnapshot: BrowserLiveFocusSnapshotV2;
      request: never;
    },
    response: BrowserTrackingSyncResponseV2,
    requestStartedAtMs: number,
  ): Promise<void>;
  refreshCollectorKeepAlive(): void;
  stopCollectorKeepAlive(): void;
  updateVisibleStatus(): Promise<void>;
};

const oldLeaseId = "11111111-1111-4111-8111-111111111111";
const newLeaseId = "22222222-2222-4222-8222-222222222222";
const deviceId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const activatedAt = "2026-08-04T00:00:00.000Z";

function policy(
  policyLeaseId: string,
  serverTime = "2026-08-04T01:00:20.000Z",
): DeviceTrackingPolicyV2 {
  return {
    policyId: "policy",
    policyVersion: "v3",
    effectiveAt: "2026-08-04T00:00:00.000Z",
    policyLeaseId,
    policyLeaseIssuedAt: "2026-08-04T00:00:00.000Z",
    policyLeaseExpiresAt: "2026-08-05T00:00:00.000Z",
    serverTime,
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [{
      startsAt: "2026-08-04T00:00:00.000Z",
      endsAt: "2026-08-05T00:00:00.000Z",
    }],
    allowedUtcWindowsHash: `window-${policyLeaseId}`,
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "21:33",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    collectDomainOpenRuntime: true,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: "2026-08-03T00:00:00.000Z",
  };
}

function runtimeState(
  currentPolicy = policy(oldLeaseId),
): BrowserTrackingRuntimeStateV2 {
  return {
    ...createInitialBrowserTrackingV2State(),
    migrationState: "V2",
    protocolActivatedAt: activatedAt,
    policy: currentPolicy,
  };
}

function runtime(): RecoveryHarness {
  return new BrowserExtensionRuntimeV2({} as never) as unknown as RecoveryHarness;
}

test("a recovered Focus and Domain runtime tail keeps its durable old policy lease", async () => {
  const clock = {
    clockEpochId: "55555555-5555-4555-8555-555555555555",
    clockEpochStartedAt: "2026-08-04T01:00:00.000Z",
    clockEpochStartedMonotonicMs: 1_000,
  };
  const oldPolicy = policy(oldLeaseId);
  const focus = new BrowserFocusEngineV2(clock, oldPolicy, "EDGE");
  const firstFocus = focus.acquireFocus(
    { subjectKey: "work.example", displayName: "work.example" },
    1_000,
  );
  focus.observe(11_000);
  const openRuntime = new BrowserOpenRuntimeEngineV2(
    clock,
    oldPolicy,
    "EDGE",
  );
  openRuntime.observeOpenDomains(
    ["work.example", "docs.example"],
    1_000,
  );
  openRuntime.observeOpenDomains(
    ["work.example", "docs.example"],
    11_000,
  );

  const harness = runtime();
  harness.browserName = "EDGE";
  harness.state = {
    ...runtimeState(oldPolicy),
    clock,
    engineCheckpoint: focus.checkpoint(),
    openRuntimeClock: clock,
    openRuntimeCheckpoint: openRuntime.checkpoint(),
    latestSnapshot: firstFocus.snapshot,
    snapshotConfirmation: {
      state: "LOCAL_PENDING",
      snapshotSequence: firstFocus.snapshot.snapshotSequence,
      observedAt: firstFocus.snapshot.lastObservedAt,
      confirmedAt: null,
      rejectionCode: null,
      requestId: null,
    },
  };
  const persisted: BrowserActivityIntervalV2[] = [];
  harness.store = {
    writeRuntimeState: async () => undefined,
    persistEngineUpdate: async (intervals, state, snapshot) => {
      persisted.push(...intervals);
      return { ...state, latestSnapshot: snapshot };
    },
    persistOpenRuntimeUpdate: async (intervals, state) => {
      persisted.push(...intervals);
      return state;
    },
    applySyncResults: async () => undefined,
    readRuntimeState: async () => harness.state!,
  };
  harness.stopCollectorKeepAlive = () => undefined;

  await harness.closeRecoveredV2Tail();

  assert.deepEqual(
    persisted.map((row) => [row.stream, row.subjectKey, row.policyLeaseId]),
    [
      ["FOCUS", "work.example", oldLeaseId],
      ["OPEN_RUNTIME", "docs.example", oldLeaseId],
      ["OPEN_RUNTIME", "work.example", oldLeaseId],
    ],
  );
  assert.equal(harness.state?.latestSnapshot, null);
  assert.equal(harness.state?.snapshotConfirmation.state, "NONE");
  assert.equal(harness.state?.clock, null);
  assert.equal(harness.state?.openRuntimeClock, null);
});

test("protocol startup seals the stored lease before installing the refreshed lease", async () => {
  const harness = runtime();
  harness.config = {
    apiBaseUrl: "https://api.example",
    deviceId,
    browserName: "Edge",
    credential: "safe-test-credential",
  };
  harness.browserName = "EDGE";
  harness.state = runtimeState(policy(oldLeaseId));
  harness.store = {
    writeRuntimeState: async () => undefined,
    persistEngineUpdate: async (_intervals, state, snapshot) => ({
      ...state,
      latestSnapshot: snapshot,
    }),
    persistOpenRuntimeUpdate: async (_intervals, state) => state,
    applySyncResults: async () => undefined,
    readRuntimeState: async () => harness.state!,
  };
  const leaseSeenDuringRecovery: Array<string | null | undefined> = [];
  harness.closeRecoveredV2Tail = async () => {
    leaseSeenDuringRecovery.push(harness.state?.policy?.policyLeaseId);
  };
  const refreshedPolicy = policy(newLeaseId);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/device-client/status")) {
      return Response.json({
        paired: true,
        clientType: "BROWSER_EXTENSION",
        deviceId,
        workstationId: null,
        browserName: "EDGE",
        protocolActivatedAt: activatedAt,
      });
    }
    if (url.endsWith("/device-client/tracking-policy")) {
      return Response.json(refreshedPolicy);
    }
    if (url.endsWith("/device-client/protocol-v2/prepare")) {
      return Response.json({
        activationId: null,
        state: "CONFIRMED",
        protocolActivatedAt: activatedAt,
        serverTime: refreshedPolicy.serverTime,
        policy: refreshedPolicy,
      });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    assert.equal(await harness.ensureProtocolV2({ workmapQueue: [] }), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(leaseSeenDuringRecovery, [oldLeaseId]);
  assert.equal(harness.state?.policy?.policyLeaseId, newLeaseId);
});

test("a terminal live-snapshot lease rejection is diagnosed but never resent", async () => {
  const harness = runtime();
  const currentPolicy = policy(oldLeaseId);
  const focus = new BrowserFocusEngineV2(
    {
      clockEpochId: "66666666-6666-4666-8666-666666666666",
      clockEpochStartedAt: "2026-08-04T01:00:00.000Z",
      clockEpochStartedMonotonicMs: 1_000,
    },
    currentPolicy,
    "EDGE",
  );
  const sentSnapshot = focus.acquireFocus(
    { subjectKey: "work.example", displayName: "work.example" },
    1_000,
  ).snapshot;
  harness.config = {
    apiBaseUrl: "https://api.example",
    deviceId,
    browserName: "Edge",
    credential: "safe-test-credential",
  };
  harness.browserName = "EDGE";
  harness.state = {
    ...runtimeState(currentPolicy),
    latestSnapshot: sentSnapshot,
  };
  harness.connectionState = "ONLINE";
  harness.collectorState = "HEALTHY";
  harness.store = {
    writeRuntimeState: async () => undefined,
    persistEngineUpdate: async (_intervals, state, snapshot) => ({
      ...state,
      latestSnapshot: snapshot,
    }),
    persistOpenRuntimeUpdate: async (_intervals, state) => state,
    applySyncResults: async () => undefined,
    readRuntimeState: async () => harness.state!,
  };
  harness.refreshCollectorKeepAlive = () => undefined;
  harness.stopCollectorKeepAlive = () => undefined;
  harness.updateVisibleStatus = async () => undefined;
  const response: BrowserTrackingSyncResponseV2 = {
    results: [],
    cursors: [],
    acceptedSnapshotSequence: null,
    focusSnapshotResult: {
      status: "REJECTED",
      rejectionCode: "SNAPSHOT_POLICY_LEASE_INVALID",
      message: "Refresh the current policy lease.",
    },
    serverTime: "2026-08-04T01:00:20.000Z",
    activePolicyVersion: "v3",
    activePolicyLeaseId: newLeaseId,
    requestId,
  };

  await harness.applySyncSuccess(
    {
      generation: harness.runtimeGeneration,
      deviceId,
      clientInstanceId: harness.state.clientInstanceId,
      config: harness.config,
      ready: [],
      requestId,
      sentSnapshot,
      request: {} as never,
    },
    response,
    Date.parse(response.serverTime) - 10,
  );

  assert.equal(harness.state?.latestSnapshot, null);
  assert.deepEqual(harness.state?.snapshotConfirmation, {
    state: "REJECTED",
    snapshotSequence: sentSnapshot.snapshotSequence,
    observedAt: sentSnapshot.lastObservedAt,
    confirmedAt: response.serverTime,
    rejectionCode: "SNAPSHOT_POLICY_LEASE_INVALID",
    requestId,
  });
});
