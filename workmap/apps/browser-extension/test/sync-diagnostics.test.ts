import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSyncDiagnostics,
  assertBrowserDeviceIdentity,
  BrowserRuntimeDiagnosticError,
  BROWSER_SERVER_HEARTBEAT_FRESH_MS,
  classifyRetryableConnectionFailure,
  collectorStateForPolicy,
  hasLifecycleDiscontinuity,
  isRetryableError,
  runCollectorMaintenanceWithHeartbeat,
  sameBrowserSnapshot,
  snapshotConfirmationFromResponse,
  summarizeIntervalUpload,
} from "../src/backgroundV2.js";
import type {
  BrowserLiveFocusSnapshotV2,
  BrowserTrackingSyncResponseV2,
  TrackingSyncItemResultV2,
} from "../src/trackingV2Types.js";

const occurredAt = "2026-07-21T01:02:03.000Z";
const requestId = "11111111-1111-4111-8111-111111111111";

test("focus reconciliation failure never suppresses the health heartbeat", async () => {
  const calls: string[] = [];
  await runCollectorMaintenanceWithHeartbeat(
    async () => {
      calls.push("maintenance");
      throw new Error("focused window query failed");
    },
    async () => {
      calls.push("diagnostic");
      throw new Error("diagnostic persistence failed");
    },
    async () => {
      calls.push("heartbeat");
    },
  );
  assert.deepEqual(calls, ["maintenance", "diagnostic", "heartbeat"]);
});

test("standalone Browser pairing remains a complete v2 identity", () => {
  assert.doesNotThrow(() => assertBrowserDeviceIdentity({
    paired: true,
    clientType: "BROWSER_EXTENSION",
    deviceId: "22222222-2222-4222-8222-222222222222",
    workstationId: null,
    browserName: "EDGE",
    protocolActivatedAt: null,
  }, {
    deviceId: "22222222-2222-4222-8222-222222222222",
    browserName: "EDGE",
  }));
});

test("real Browser identity mismatch is terminal and not a network retry", () => {
  assert.throws(() => assertBrowserDeviceIdentity({
    paired: true,
    clientType: "BROWSER_EXTENSION",
    deviceId: "22222222-2222-4222-8222-222222222222",
    workstationId: null,
    browserName: "CHROME",
    protocolActivatedAt: null,
  }, {
    deviceId: "22222222-2222-4222-8222-222222222222",
    browserName: "EDGE",
  }), (error: unknown) => {
    assert(error instanceof BrowserRuntimeDiagnosticError);
    assert.equal(error.code, "DEVICE_IDENTITY_MISMATCH");
    assert.equal(error.retryable, false);
    assert.equal(error.connectionState, "AUTH_REQUIRED");
    assert.equal(isRetryableError(error), false);
    return true;
  });
});

test("transient request failures do not create false connection outages", () => {
  const confirmedAt = "2026-07-27T00:00:00.000Z";
  const confirmedAtMs = Date.parse(confirmedAt);
  assert.deepEqual(
    classifyRetryableConnectionFailure({
      browserOnline: true,
      lastSuccessfulHeartbeatAt: confirmedAt,
      nowMs: confirmedAtMs + BROWSER_SERVER_HEARTBEAT_FRESH_MS,
    }),
    { connectionState: "ONLINE", statusTransition: null },
    "a server-confirmed heartbeat remains authoritative through the freshness window",
  );
  assert.deepEqual(
    classifyRetryableConnectionFailure({
      browserOnline: true,
      lastSuccessfulHeartbeatAt: confirmedAt,
      nowMs: confirmedAtMs + BROWSER_SERVER_HEARTBEAT_FRESH_MS + 1,
    }),
    { connectionState: "OFFLINE", statusTransition: null },
    "an online network interface cannot prove WorkMap connectivity after the heartbeat expires",
  );
  assert.deepEqual(
    classifyRetryableConnectionFailure({
      browserOnline: false,
      lastSuccessfulHeartbeatAt: confirmedAt,
      nowMs: confirmedAtMs + 1,
    }),
    {
      connectionState: "OFFLINE",
      statusTransition: {
        status: "NETWORK_OFFLINE",
        reason: "NETWORK_UNAVAILABLE",
      },
    },
    "a browser-confirmed network loss can end connection health immediately",
  );
});

test("HTTP 200 snapshot rejection remains distinct from connection health", () => {
  const result: BrowserTrackingSyncResponseV2["focusSnapshotResult"] = {
    status: "REJECTED",
    rejectionCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
    message: "Outside the allowed policy window.",
  };
  const confirmation = snapshotConfirmationFromResponse(
    snapshot(),
    result,
    requestId,
    occurredAt,
  );
  assert.deepEqual(confirmation, {
    state: "REJECTED",
    snapshotSequence: 7,
    observedAt: "2026-07-21T01:02:00.000Z",
    confirmedAt: occurredAt,
    rejectionCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
    requestId,
  });
  const diagnostics = appendSyncDiagnostics([], [], result, requestId, occurredAt);
  assert.equal(diagnostics[0]?.stage, "SNAPSHOT");
  assert.equal(diagnostics[0]?.requestId, requestId);
  assert.equal(diagnostics[0]?.code, "SNAPSHOT_OUTSIDE_POLICY_WINDOW");
  assert.equal(diagnostics[0]?.terminal, true);
});

test("a delayed sync response cannot confirm or reject a newer local snapshot", () => {
  const sent = snapshot();
  assert.equal(sameBrowserSnapshot(sent, { ...sent }), true);
  assert.equal(
    sameBrowserSnapshot(sent, { ...sent, snapshotSequence: 8 }),
    false,
  );
  assert.equal(
    sameBrowserSnapshot(sent, {
      ...sent,
      clockEpochId: "44444444-4444-4444-8444-444444444444",
    }),
    false,
  );
});

test("accepted, duplicate and rejected interval results retain exact bounded evidence", () => {
  const results: TrackingSyncItemResultV2[] = [
    { clientEventId: "accepted", status: "ACCEPTED" },
    { clientEventId: "duplicate", status: "DUPLICATE" },
    {
      clientEventId: "terminal",
      status: "REJECTED",
      rejectionCode: "OUTSIDE_POLICY_WINDOW",
      terminal: true,
    },
    {
      clientEventId: "retryable",
      status: "REJECTED",
      rejectionCode: "LEASE_REFRESH_REQUIRED",
      terminal: false,
    },
  ];
  assert.deepEqual(summarizeIntervalUpload(results, requestId, occurredAt), {
    status: "REJECTED",
    occurredAt,
    requestId,
    accepted: 1,
    duplicate: 1,
    rejected: 2,
    rejectionCodes: {
      OUTSIDE_POLICY_WINDOW: 1,
      LEASE_REFRESH_REQUIRED: 1,
    },
  });
  const diagnostics = appendSyncDiagnostics([], results, null, requestId, occurredAt);
  assert.deepEqual(
    diagnostics.map((row) => [row.code, row.outcome, row.retryable, row.requestId, row.count]),
    [
      ["OUTSIDE_POLICY_WINDOW", "REJECTED", false, requestId, 1],
      ["LEASE_REFRESH_REQUIRED", "RETRYING", true, requestId, 1],
    ],
  );
});

test("sleep, service-worker gaps and clock jumps are never backfilled", () => {
  const previous = { wallClockMs: 1_000, monotonicMs: 1_000 };
  assert.equal(
    hasLifecycleDiscontinuity(
      previous,
      { wallClockMs: 31_000, monotonicMs: 31_000 },
    ),
    false,
  );
  assert.equal(
    hasLifecycleDiscontinuity(
      previous,
      { wallClockMs: 47_000, monotonicMs: 47_000 },
    ),
    true,
    "an observation gap beyond one 30-second alarm plus tolerance is unknown time",
  );
  assert.equal(
    hasLifecycleDiscontinuity(
      previous,
      { wallClockMs: 500, monotonicMs: 2_000 },
    ),
    true,
  );
  assert.equal(
    hasLifecycleDiscontinuity(
      previous,
      { wallClockMs: 20_000, monotonicMs: 5_000 },
    ),
    true,
  );
});

test("Domain Focus stays paused until acknowledgement, lease and UTC window all permit it", () => {
  const base = policy();
  const now = Date.parse("2026-07-21T01:00:00.000Z");
  assert.equal(collectorStateForPolicy(base, now), "HEALTHY");
  assert.equal(
    collectorStateForPolicy({ ...base, collectDomainFocus: false }, now),
    "PAUSED",
  );
  assert.equal(
    collectorStateForPolicy({ ...base, acknowledgementState: "REQUIRED" }, now),
    "PAUSED",
  );
  assert.equal(
    collectorStateForPolicy({ ...base, policyLeaseExpiresAt: "2026-07-21T00:59:59.000Z" }, now),
    "PAUSED",
  );
  assert.equal(
    collectorStateForPolicy({
      ...base,
      allowedUtcWindows: [{
        startsAt: "2026-07-21T02:00:00.000Z",
        endsAt: "2026-07-21T03:00:00.000Z",
      }],
    }, now),
    "PAUSED",
  );
  assert.equal(
    collectorStateForPolicy({
      ...base,
      policyLeaseId: "lease-2",
      policyLeaseExpiresAt: "2026-07-22T00:00:00.000Z",
    }, now),
    "HEALTHY",
    "a refreshed acknowledged lease can resume inside its server-issued window",
  );
});

function snapshot(): BrowserLiveFocusSnapshotV2 {
  return {
    snapshotId: "22222222-2222-4222-8222-222222222222",
    snapshotSequence: 7,
    observedAt: "2026-07-21T01:02:00.000Z",
    lastObservedAt: "2026-07-21T01:02:00.000Z",
    source: "BROWSER_DOMAIN",
    stream: "FOCUS",
    state: "FOCUS_ACTIVE",
    metric: "FOCUS_ACTIVE",
    activitySubjectId: "example.com",
    subjectKey: "example.com",
    displayName: "example.com",
    browserName: "CHROME",
    collectorState: "HEALTHY",
    policyVersion: "v1",
    policyLeaseId: "lease-1",
    clockEpochId: "33333333-3333-4333-8333-333333333333",
  };
}

function policy() {
  return {
    policyId: "policy-1",
    policyVersion: "v1",
    effectiveAt: "2026-07-21T00:00:00.000Z",
    policyLeaseId: "lease-1",
    policyLeaseIssuedAt: "2026-07-21T00:00:00.000Z",
    policyLeaseExpiresAt: "2026-07-22T00:00:00.000Z",
    serverTime: "2026-07-21T01:00:00.000Z",
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED" as const,
    allowedUtcWindows: [{
      startsAt: "2026-07-21T00:00:00.000Z",
      endsAt: "2026-07-22T00:00:00.000Z",
    }],
    allowedUtcWindowsHash: "hash",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "17:00",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    acknowledgementState: "ACKNOWLEDGED" as const,
    acknowledgedAt: "2026-07-20T00:00:00.000Z",
  };
}
