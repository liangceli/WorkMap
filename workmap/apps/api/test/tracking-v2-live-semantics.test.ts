/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import {
  DeviceClientType,
  TrackingActivitySource,
} from "@prisma/client";
import { TrackingV2SyncService } from "../src/modules/devices/tracking-v2-sync.service.js";
import { TrackingV2ReportsService } from "../src/modules/reports/tracking-v2-reports.service.js";

const COMPANY_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSTATION_ID = "22222222-2222-4222-8222-222222222222";
const LEASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLOCK_ID = "99999999-9999-4999-8999-999999999999";
const NEW_CLOCK_ID = "12121212-1212-4212-8212-121212121212";
const REQUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("fresh server-confirmed health stays connected when the App snapshot is rejected", async () => {
  const nowMs = Date.now();
  const prisma = new SyncPrisma(nowMs);
  prisma.lease.allowedUtcWindows = [
    {
      startsAt: new Date(nowMs - 15 * 60_000).toISOString(),
      endsAt: new Date(nowMs + 60 * 60_000).toISOString(),
    },
  ];
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(nowMs) as any,
  );
  const rejectedObservedAt = new Date(nowMs - 30 * 60_000);
  const syncResponse = await sync.sync(
    context(nowMs),
    syncRequest(nowMs, {
      focusSnapshot: {
        snapshotSequence: 2,
        activitySessionId: "77777777-7777-4777-8777-777777777777",
        currentStateId: "88888888-8888-4888-8888-888888888888",
        source: "DESKTOP_APP",
        stream: "FOCUS",
        clockEpochId: CLOCK_ID,
        policyVersion: "v1",
        policyLeaseId: LEASE_ID,
        subjectKey: "app:test",
        displayName: "Test App",
        state: "ACTIVE",
        sessionStartedAt: new Date(nowMs - 31 * 60_000).toISOString(),
        stateStartedAt: new Date(nowMs - 31 * 60_000).toISOString(),
        lastActivityEvidenceAt: rejectedObservedAt.toISOString(),
        activityEvidenceKind: "FOCUS_ACQUIRED",
        latestEmittedIntervalSequence: null,
        latestEmittedClientEventId: null,
        nextIntervalSequence: 1,
        lastObservedAt: rejectedObservedAt.toISOString(),
        collectorState: "HEALTHY",
      },
    }),
    REQUEST_ID,
  );

  assert.equal(syncResponse.focusSnapshotResult?.status, "REJECTED");
  assert.equal(
    syncResponse.focusSnapshotResult?.status === "REJECTED"
      ? syncResponse.focusSnapshotResult.rejectionCode
      : null,
    "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  );
  assert.equal(prisma.deviceHeartbeatWritten, true);
  assert.equal(
    prisma.healthUpdate?.serverDiagnosticCode,
    "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  );

  const now = new Date();
  const oldSnapshotAt = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const device = liveDevice({
    snapshotReceivedAt: oldSnapshotAt,
    healthReceivedAt: now,
    diagnosticAt: now,
    diagnosticCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  });
  const service = new TrackingV2ReportsService(
    { device: { findMany: async () => [device] } } as any,
    {} as any,
  );

  const response = await service.getLiveActivity({ companyId: COMPANY_ID });
  const row = response.devices[0]!;

  assert.equal(row.connectionFresh, true);
  assert.equal(row.fresh, true, "compatibility freshness follows connection health");
  assert.equal(row.snapshotFresh, false);
  assert.equal(row.snapshotStatus, "REJECTED");
  assert.equal(row.current, null);
  assert.equal(response.coverage.connected, 1);
  assert.equal(response.coverage.disconnected, 0);
  assert.equal(response.coverage.rejectedSnapshots, 1);
  assert.equal(row.intervalDiagnostics.lastRejected?.code, "POLICY_REJECTED");
  assert.equal(row.intervalDiagnostics.lastRejected?.requestId, REQUEST_ID);
  assert.equal(response.coverage.withRejectedIntervals, 1);
});

test("invalid snapshot state timing is not mislabeled as outside the policy window", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );

  const response = await sync.sync(
    context(now),
    syncRequest(now, {
      focusSnapshot: {
        snapshotSequence: 1,
        activitySessionId: "77777777-7777-4777-8777-777777777777",
        currentStateId: "88888888-8888-4888-8888-888888888888",
        source: "DESKTOP_APP",
        stream: "FOCUS",
        clockEpochId: CLOCK_ID,
        policyVersion: "v1",
        policyLeaseId: LEASE_ID,
        subjectKey: "app:test",
        displayName: "Test App",
        state: "ACTIVE",
        sessionStartedAt: new Date(now - 10_000).toISOString(),
        stateStartedAt: new Date(now + 1_000).toISOString(),
        lastActivityEvidenceAt: new Date(now - 500).toISOString(),
        activityEvidenceKind: "FOCUS_ACQUIRED",
        latestEmittedIntervalSequence: null,
        latestEmittedClientEventId: null,
        nextIntervalSequence: 1,
        lastObservedAt: new Date(now - 500).toISOString(),
        collectorState: "HEALTHY",
      },
    }),
    REQUEST_ID,
  );

  assert.equal(response.focusSnapshotResult?.status, "REJECTED");
  assert.equal(
    response.focusSnapshotResult?.status === "REJECTED"
      ? response.focusSnapshotResult.rejectionCode
      : null,
    "SNAPSHOT_OBSERVATION_TIME_INVALID",
  );
});

test("a newer valid App snapshot replaces the old snapshot state", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.liveSnapshotSequence = 4;
  const service = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );

  const response = await service.sync(
    context(now),
    syncRequest(now, {
      focusSnapshot: noneSnapshot(now, 5),
    }),
    REQUEST_ID,
  );

  assert.equal(response.focusSnapshotResult?.status, "ACCEPTED");
  assert.equal(response.acceptedSnapshotSequence, 5);
  assert.equal(prisma.savedSnapshot?.snapshotSequence, 5);
  assert.equal(prisma.savedSnapshot?.state, "NONE");
  assert.equal(
    prisma.healthUpdate?.serverDiagnosticCode,
    null,
    "an accepted replacement snapshot clears the older rejection diagnostic",
  );
});

test("an older or duplicate valid snapshot cannot clear a newer rejection diagnostic", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.liveSnapshotSequence = 5;
  const service = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );

  const response = await service.sync(
    context(now),
    syncRequest(now, { focusSnapshot: noneSnapshot(now, 5) }),
    REQUEST_ID,
  );

  assert.equal(response.focusSnapshotResult?.status, "ACCEPTED");
  assert.equal(response.acceptedSnapshotSequence, null);
  assert.equal(
    Object.hasOwn(prisma.healthUpdate, "serverDiagnosticCode"),
    false,
    "a non-written snapshot leaves a newer persisted warning untouched",
  );
});

test("a newer clock epoch can replace a higher snapshot sequence from the prior epoch", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.liveSnapshotSequence = 900;
  prisma.liveSnapshotClockEpochId = CLOCK_ID;
  prisma.liveSnapshotLastObservedAt = new Date(now - 60_000);
  const service = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );

  const response = await service.sync(
    context(now),
    syncRequest(now, {
      focusSnapshot: noneSnapshot(now, 1, {
        clockEpochId: NEW_CLOCK_ID,
        lastObservedAt: new Date(now - 500).toISOString(),
      }),
    }),
    REQUEST_ID,
  );

  assert.equal(response.acceptedSnapshotSequence, 1);
  assert.equal(prisma.savedSnapshot?.clockEpochId, NEW_CLOCK_ID);
  assert.equal(prisma.savedSnapshot?.snapshotSequence, 1);
});

test("a delayed prior clock epoch cannot overwrite a newer observed snapshot", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.liveSnapshotSequence = 1;
  prisma.liveSnapshotClockEpochId = NEW_CLOCK_ID;
  prisma.liveSnapshotLastObservedAt = new Date(now - 500);
  const service = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );

  const response = await service.sync(
    context(now),
    syncRequest(now, {
      focusSnapshot: noneSnapshot(now, 901, {
        clockEpochId: CLOCK_ID,
        lastObservedAt: new Date(now - 60_000).toISOString(),
      }),
    }),
    REQUEST_ID,
  );

  assert.equal(response.acceptedSnapshotSequence, null);
  assert.equal(prisma.savedSnapshot, null);
  assert.equal(
    Object.hasOwn(prisma.healthUpdate, "serverDiagnosticCode"),
    false,
  );
});

test("valid Focus active and focused-idle intervals enter the ledger and Reports", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );
  const startedAt = new Date(now - 50_000);
  const endedAt = new Date(now - 40_000);
  const idleEndedAt = new Date(now - 10_000);

  const response = await sync.sync(
    context(now),
    syncRequest(now, {
      intervals: [
        {
          clientEventId: "77777777-7777-4777-8777-777777777777",
          activitySessionId: "88888888-8888-4888-8888-888888888888",
          sequenceNumber: 1,
          source: "DESKTOP_APP",
          stream: "FOCUS",
          metric: "FOCUS_ACTIVE",
          subjectKey: "app:test",
          displayName: "Test App",
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          clockEpochId: CLOCK_ID,
          startedMonotonicMs: 1_000,
          endedMonotonicMs: 11_000,
          durationMs: 10_000,
          policyVersion: "v1",
          policyLeaseId: LEASE_ID,
        },
        {
          clientEventId: "79797979-7979-4979-8979-797979797979",
          activitySessionId: "88888888-8888-4888-8888-888888888888",
          sequenceNumber: 2,
          source: "DESKTOP_APP",
          stream: "FOCUS",
          metric: "FOCUS_IDLE",
          subjectKey: "app:test",
          displayName: "Test App",
          startedAt: endedAt.toISOString(),
          endedAt: idleEndedAt.toISOString(),
          clockEpochId: CLOCK_ID,
          startedMonotonicMs: 11_000,
          endedMonotonicMs: 41_000,
          durationMs: 30_000,
          policyVersion: "v1",
          policyLeaseId: LEASE_ID,
        },
      ],
    }),
    REQUEST_ID,
  );

  assert.deepEqual(response.results.map((result) => result.status), ["ACCEPTED", "ACCEPTED"]);
  assert.equal(prisma.intervals.length, 2, "accepted intervals are in the official ledger");
  assert.equal(prisma.fragments.length, 2, "ledger intervals have report day fragments");
  assert.equal(
    Object.hasOwn(prisma.healthUpdate, "serverDiagnosticCode"),
    false,
    "a health-only confirmation preserves any prior snapshot diagnostic",
  );

  const reports = new TrackingV2ReportsService(
    prisma as any,
    {
      reconcileTargets: async () => {
        throw new Error("Use the ledger fallback in this focused test.");
      },
    } as any,
  );
  const usage = await reports.getConfirmedUsage({
    companyId: COMPANY_ID,
    userId: USER_ID,
    range: {
      from: new Date(`${startedAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      to: new Date(`${startedAt.toISOString().slice(0, 10)}T23:59:59.999Z`),
    },
  });

  assert(usage);
  assert.equal(usage.apps[0]?.appName, "Test App");
  assert.equal(usage.apps[0]?.focusActiveMs, 10_000);
  assert.equal(usage.apps[0]?.focusedIdleMs, 30_000);
  assert.equal(usage.coverage.reconciliationState, "LEDGER_FALLBACK");
});

test("Browser Domain Focus active and focused-idle enter the official ledger and Domain Reports", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    browserPolicyService(now) as any,
  );
  const startedAt = new Date(now - 50_000);
  const activeEndedAt = new Date(now - 35_000);
  const idleEndedAt = new Date(now - 5_000);
  const interval = (
    clientEventId: string,
    sequenceNumber: number,
    metric: "FOCUS_ACTIVE" | "FOCUS_IDLE",
    from: Date,
    to: Date,
    monotonicStart: number,
    monotonicEnd: number,
  ) => ({
    clientEventId,
    activitySessionId: "85858585-8585-4585-8585-858585858585",
    sequenceNumber,
    source: "BROWSER_DOMAIN",
    stream: "FOCUS",
    metric,
    subjectKey: "docs.example",
    displayName: "docs.example",
    browserName: "CHROME",
    startedAt: from.toISOString(),
    endedAt: to.toISOString(),
    clockEpochId: CLOCK_ID,
    startedMonotonicMs: monotonicStart,
    endedMonotonicMs: monotonicEnd,
    durationMs: monotonicEnd - monotonicStart,
    policyVersion: "v1",
    policyLeaseId: LEASE_ID,
  });

  const response = await sync.sync(
    browserContext(now),
    browserSyncRequest(now, {
      intervals: [
        interval(
          "81818181-8181-4181-8181-818181818181",
          1,
          "FOCUS_ACTIVE",
          startedAt,
          activeEndedAt,
          1_000,
          16_000,
        ),
        interval(
          "82828282-8282-4282-8282-828282828282",
          2,
          "FOCUS_IDLE",
          activeEndedAt,
          idleEndedAt,
          16_000,
          46_000,
        ),
      ],
    }),
    REQUEST_ID,
  );

  assert.deepEqual(response.results.map((result) => result.status), ["ACCEPTED", "ACCEPTED"]);
  assert.equal(prisma.intervals.length, 2);
  assert(prisma.intervals.every((row) => row.source === TrackingActivitySource.BROWSER_DOMAIN));

  const reports = new TrackingV2ReportsService(
    prisma as any,
    { reconcileTargets: async () => { throw new Error("Use ledger fallback."); } } as any,
  );
  const usage = await reports.getConfirmedUsage({
    companyId: COMPANY_ID,
    userId: USER_ID,
    range: {
      from: new Date(`${startedAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      to: new Date(`${startedAt.toISOString().slice(0, 10)}T23:59:59.999Z`),
    },
  });

  assert.equal(usage.websites[0]?.domain, "docs.example");
  assert.equal(usage.websites[0]?.focusActiveMs, 15_000);
  assert.equal(usage.websites[0]?.focusedIdleMs, 30_000);
  assert.equal(usage.websites[0]?.openRuntimeMs, 0);
  assert.equal(usage.coverage.domainOpenRuntimeEnabled, false);

  const mismatch = await sync.sync(
    browserContext(now),
    browserSyncRequest(now, {
      intervals: [{
        ...interval(
          "83838383-8383-4383-8383-838383838383",
          3,
          "FOCUS_ACTIVE",
          startedAt,
          activeEndedAt,
          1_000,
          16_000,
        ),
        browserName: "EDGE",
      }],
    }),
    REQUEST_ID,
  );
  assert.equal(mismatch.results[0]?.status, "REJECTED");
  assert.equal(mismatch.results[0]?.rejectionCode, "BROWSER_IDENTITY_MISMATCH");
  assert.equal(prisma.intervals.length, 2, "identity-mismatched Browser time is not ledgered");
  assert.equal(prisma.tombstones.at(-1)?.requestId, REQUEST_ID);
});

test("Browser Domain open/runtime uses its own policy and reaches confirmed Domain Reports", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.lease.collectDomainOpenRuntime = true;
  prisma.lease.monitoringPolicy.collectDomainOpenRuntime = true;
  const sync = new TrackingV2SyncService(
    prisma as any,
    browserPolicyService(now) as any,
  );
  const startedAt = new Date(now - 20_000);
  const endedAt = new Date(now - 10_000);
  const runtimeInterval = (
    clientEventId: string,
    sequenceNumber: number,
    domain: string,
  ) => ({
    clientEventId,
    activitySessionId: crypto.randomUUID(),
    sequenceNumber,
    source: "BROWSER_DOMAIN",
    stream: "OPEN_RUNTIME",
    metric: "OPEN_RUNTIME",
    subjectKey: domain,
    displayName: domain,
    browserName: "CHROME",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    clockEpochId: CLOCK_ID,
    startedMonotonicMs: 1_000,
    endedMonotonicMs: 11_000,
    durationMs: 10_000,
    policyVersion: "v1",
    policyLeaseId: LEASE_ID,
  });

  const response = await sync.sync(
    browserContext(now),
    browserSyncRequest(now, {
      intervals: [
        runtimeInterval(
          "83838383-8383-4383-8383-838383838381",
          1,
          "docs.example",
        ),
        runtimeInterval(
          "83838383-8383-4383-8383-838383838382",
          2,
          "chat.example",
        ),
      ],
    }),
    REQUEST_ID,
  );
  assert.deepEqual(response.results.map((item) => item.status), [
    "ACCEPTED",
    "ACCEPTED",
  ]);

  const reports = new TrackingV2ReportsService(
    prisma as any,
    {
      reconcileTargets: async () => {
        throw new Error("Use ledger fallback.");
      },
    } as any,
  );
  const usage = await reports.getConfirmedUsage({
    companyId: COMPANY_ID,
    userId: USER_ID,
    range: {
      from: new Date(`${startedAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      to: new Date(`${startedAt.toISOString().slice(0, 10)}T23:59:59.999Z`),
    },
  });
  assert.equal(usage.coverage.domainOpenRuntimeEnabled, true);
  assert.deepEqual(
    usage.websites
      .map((row) => [row.domain, row.openRuntimeMs])
      .sort(),
    [
      ["chat.example", 10_000],
      ["docs.example", 10_000],
    ],
  );

  const disabledPrisma = new SyncPrisma(now);
  const rejected = await new TrackingV2SyncService(
    disabledPrisma as any,
    browserPolicyService(now) as any,
  ).sync(
    browserContext(now),
    browserSyncRequest(now, {
      intervals: [
        runtimeInterval(
          "83838383-8383-4383-8383-838383838383",
          1,
          "docs.example",
        ),
      ],
    }),
    REQUEST_ID,
  );
  assert.equal(rejected.results[0]?.status, "REJECTED");
  assert.equal(
    rejected.results[0]?.rejectionCode,
    "OPEN_RUNTIME_NOT_ENABLED",
  );
  assert.equal(disabledPrisma.intervals.length, 0);
});

test("a recovered Browser heartbeat persists an inferred interruption and recovery", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.previousHealthReceivedAt = new Date(now - 120_000);
  const sync = new TrackingV2SyncService(
    prisma as any,
    browserPolicyService(now) as any,
  );

  await sync.sync(
    browserContext(now),
    browserSyncRequest(now),
    REQUEST_ID,
  );

  assert.deepEqual(
    prisma.statusEvents.map((event) => [
      event.status,
      event.reason,
      event.confidence,
    ]),
    [
      ["UNKNOWN_INTERRUPTED", "HEARTBEAT_TIMEOUT", "INFERRED"],
      ["RECONNECTED", "UNKNOWN", "CONFIRMED"],
    ],
  );
});

test("fractional Browser monotonic bounds become a terminal tombstone instead of a 500", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    browserPolicyService(now) as any,
  );
  const startedAt = new Date(now - 70_000);
  const endedAt = new Date(now - 10_000);

  const response = await sync.sync(
    browserContext(now),
    browserSyncRequest(now, {
      intervals: [
        {
          clientEventId: "84848484-8484-4484-8484-848484848484",
          activitySessionId: "85858585-8585-4585-8585-858585858585",
          sequenceNumber: 1,
          source: "BROWSER_DOMAIN",
          stream: "FOCUS",
          metric: "FOCUS_ACTIVE",
          subjectKey: "docs.example",
          displayName: "docs.example",
          browserName: "CHROME",
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          clockEpochId: CLOCK_ID,
          startedMonotonicMs: 1_000.25,
          endedMonotonicMs: 61_000.25,
          durationMs: 60_000,
          policyVersion: "v1",
          policyLeaseId: LEASE_ID,
        },
      ],
    }),
    REQUEST_ID,
  );

  assert.equal(response.results[0]?.status, "REJECTED");
  assert.equal(response.results[0]?.rejectionCode, "MONOTONIC_MISMATCH");
  assert.equal(response.results[0]?.terminal, true);
  assert.equal(prisma.intervals.length, 0);
  assert.equal(prisma.tombstones[0]?.rejectionCode, "MONOTONIC_MISMATCH");
  assert.equal(prisma.tombstones[0]?.requestId, REQUEST_ID);
});

test("overlapping open/runtime for different Apps is accepted and displayed without becoming Focus time", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );
  const startedAt = new Date(now - 20_000);
  const endedAt = new Date(now - 10_000);
  const runtimeInterval = (
    clientEventId: string,
    sequenceNumber: number,
    subjectKey: string,
    displayName: string,
  ) => ({
    clientEventId,
    activitySessionId: `${sequenceNumber}8888888-8888-4888-8888-888888888888`,
    sequenceNumber,
    source: "DESKTOP_APP",
    stream: "OPEN_RUNTIME",
    metric: "OPEN_RUNTIME",
    subjectKey,
    displayName,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    clockEpochId: NEW_CLOCK_ID,
    startedMonotonicMs: 1_000,
    endedMonotonicMs: 11_000,
    durationMs: 10_000,
    policyVersion: "v1",
    policyLeaseId: LEASE_ID,
  });

  const response = await sync.sync(
    context(now),
    syncRequest(now, {
      intervals: [
        runtimeInterval(
          "71717171-7171-4171-8171-717171717171",
          1,
          "app:codex",
          "Codex",
        ),
        runtimeInterval(
          "72727272-7272-4272-8272-727272727272",
          2,
          "app:teams",
          "Microsoft Teams",
        ),
      ],
    }),
    REQUEST_ID,
  );

  assert.deepEqual(response.results.map((result) => result.status), [
    "ACCEPTED",
    "ACCEPTED",
  ]);
  assert.equal(prisma.intervals.length, 2);

  const reports = new TrackingV2ReportsService(
    prisma as any,
    {
      reconcileTargets: async () => {
        throw new Error("Use the ledger fallback in this focused test.");
      },
    } as any,
  );
  const usage = await reports.getConfirmedUsage({
    companyId: COMPANY_ID,
    userId: USER_ID,
    range: {
      from: new Date(`${startedAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      to: new Date(`${startedAt.toISOString().slice(0, 10)}T23:59:59.999Z`),
    },
  });

  assert(usage);
  assert.equal(usage.coverage.openRuntimeEnabled, true);
  assert.deepEqual(
    usage.apps.map((row) => ({
      appName: row.appName,
      focusActiveMs: row.focusActiveMs,
      openRuntimeMs: row.openRuntimeMs,
    })).sort((left, right) => left.appName.localeCompare(right.appName)),
    [
      { appName: "Codex", focusActiveMs: 0, openRuntimeMs: 10_000 },
      { appName: "Microsoft Teams", focusActiveMs: 0, openRuntimeMs: 10_000 },
    ],
  );
});

test("overlapping open/runtime for the same App remains rejected", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );
  const startedAt = new Date(now - 30_000);
  const endedAt = new Date(now - 10_000);
  const interval = (clientEventId: string, sequenceNumber: number) => ({
    clientEventId,
    activitySessionId: `${sequenceNumber}9999999-9999-4999-8999-999999999999`,
    sequenceNumber,
    source: "DESKTOP_APP",
    stream: "OPEN_RUNTIME",
    metric: "OPEN_RUNTIME",
    subjectKey: "app:codex",
    displayName: "Codex",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    clockEpochId: NEW_CLOCK_ID,
    startedMonotonicMs: 1_000,
    endedMonotonicMs: 21_000,
    durationMs: 20_000,
    policyVersion: "v1",
    policyLeaseId: LEASE_ID,
  });

  const response = await sync.sync(
    context(now),
    syncRequest(now, {
      intervals: [
        interval("73737373-7373-4373-8373-737373737373", 1),
        interval("74747474-7474-4474-8474-747474747474", 2),
      ],
    }),
    REQUEST_ID,
  );

  assert.equal(response.results[0]?.status, "ACCEPTED");
  assert.equal(response.results[1]?.status, "REJECTED");
  assert.equal(response.results[1]?.rejectionCode, "RUNTIME_OVERLAP");
});

test("open/runtime is rejected until the active policy explicitly enables it", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  prisma.lease.monitoringPolicy.collectOpenRuntime = false;
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );
  const startedAt = new Date(now - 20_000);
  const endedAt = new Date(now - 10_000);

  const response = await sync.sync(
    context(now),
    syncRequest(now, {
      intervals: [{
        clientEventId: "75757575-7575-4575-8575-757575757575",
        activitySessionId: "76767676-7676-4676-8676-767676767676",
        sequenceNumber: 1,
        source: "DESKTOP_APP",
        stream: "OPEN_RUNTIME",
        metric: "OPEN_RUNTIME",
        subjectKey: "app:codex",
        displayName: "Codex",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        clockEpochId: NEW_CLOCK_ID,
        startedMonotonicMs: 1_000,
        endedMonotonicMs: 11_000,
        durationMs: 10_000,
        policyVersion: "v1",
        policyLeaseId: LEASE_ID,
      }],
    }),
    REQUEST_ID,
  );

  assert.equal(response.results[0]?.status, "REJECTED");
  assert.equal(response.results[0]?.rejectionCode, "OPEN_RUNTIME_NOT_ENABLED");
  assert.equal(prisma.intervals.length, 0);
  assert.equal(prisma.tombstones[0]?.requestId, REQUEST_ID);
  assert.equal(prisma.tombstones[0]?.rejectionCode, "OPEN_RUNTIME_NOT_ENABLED");
});

function liveDevice(input: {
  snapshotReceivedAt: Date;
  healthReceivedAt: Date;
  diagnosticAt: Date;
  diagnosticCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW";
}) {
  return {
    id: DEVICE_ID,
    userId: USER_ID,
    clientType: DeviceClientType.DESKTOP_AGENT,
    browserName: null,
    workstationId: WORKSTATION_ID,
    protocolActivatedAt: new Date(input.snapshotReceivedAt.getTime() - 1_000),
    hostname: "WM-TEST",
    agentVersion: "desktop-agent-windows/0.6.4",
    user: { displayName: "Employee" },
    workstation: { displayName: "Workstation" },
    liveFocusSnapshots: [
      {
        source: TrackingActivitySource.DESKTOP_APP,
        browserName: null,
        snapshotSequence: 1,
        activitySessionId: null,
        currentStateId: null,
        clockEpochId: CLOCK_ID,
        policyVersion: "v1",
        subjectKey: null,
        displayName: null,
        state: "NONE",
        sessionStartedAt: null,
        stateStartedAt: null,
        lastActivityEvidenceAt: null,
        activityEvidenceKind: null,
        latestEmittedIntervalSequence: null,
        latestEmittedClientEventId: null,
        nextIntervalSequence: 1,
        lastObservedAt: input.snapshotReceivedAt,
        collectorState: "HEALTHY",
        provisionalFromAt: null,
        receivedAt: input.snapshotReceivedAt,
      },
    ],
    clientHealth: [
      {
        source: TrackingActivitySource.DESKTOP_APP,
        clientType: DeviceClientType.DESKTOP_AGENT,
        clientVersion: "desktop-agent-windows/0.6.4",
        platform: "WINDOWS",
        connectionState: "ONLINE",
        collectorState: "HEALTHY",
        policyState: "ACTIVE",
        migrationState: "V2",
        queuePending: 0,
        queueReady: 0,
        queueDeadLetter: 3,
        oldestQueuedAt: null,
        nextRetryAt: null,
        lastSuccessfulHeartbeatAt: input.healthReceivedAt,
        lastSuccessfulSyncAt: input.healthReceivedAt,
        errorCode: "NONE",
        serverDiagnosticCode: input.diagnosticCode,
        serverDiagnosticRequestId: REQUEST_ID,
        serverDiagnosticAt: input.diagnosticAt,
        receivedAt: input.healthReceivedAt,
      },
    ],
    syncCursors: [],
    sequenceTombstones: [
      {
        source: TrackingActivitySource.DESKTOP_APP,
        stream: "FOCUS",
        clockEpochId: CLOCK_ID,
        sequenceNumber: 9,
        rejectionCode: "POLICY_REJECTED",
        requestId: REQUEST_ID,
        rejectedAt: input.diagnosticAt,
      },
    ],
  };
}

function context(now: number) {
  return {
    companyId: COMPANY_ID,
    userId: USER_ID,
    role: "EMPLOYEE" as const,
    deviceId: DEVICE_ID,
    credentialId: "55555555-5555-4555-8555-555555555555",
    clientType: DeviceClientType.DESKTOP_AGENT,
    browserName: null,
    workstationId: WORKSTATION_ID,
    protocolActivatedAt: new Date(now - 60 * 60_000),
  };
}

function policyService(now: number) {
  return {
    requireV2DeviceIdentity: async () => ({
      id: DEVICE_ID,
      clientType: DeviceClientType.DESKTOP_AGENT,
      browserName: null,
      workstationId: WORKSTATION_ID,
      protocolActivatedAt: new Date(now - 60 * 60_000),
    }),
  };
}

function browserContext(now: number) {
  return {
    ...context(now),
    clientType: DeviceClientType.BROWSER_EXTENSION,
    browserName: "CHROME" as const,
  };
}

function browserPolicyService(now: number) {
  return {
    requireV2DeviceIdentity: async () => ({
      id: DEVICE_ID,
      clientType: DeviceClientType.BROWSER_EXTENSION,
      browserName: "CHROME" as const,
      workstationId: WORKSTATION_ID,
      protocolActivatedAt: new Date(now - 60 * 60_000),
    }),
  };
}

function syncRequest(
  now: number,
  overrides: { intervals?: unknown[]; focusSnapshot?: unknown } = {},
) {
  return {
    protocolVersion: 2,
    protocolActivatedAt: new Date(now - 60 * 60_000).toISOString(),
    clientInstanceId: "66666666-6666-4666-8666-666666666666",
    sentAt: new Date(now - 100).toISOString(),
    intervals: overrides.intervals ?? [],
    ...(overrides.focusSnapshot
      ? { focusSnapshot: overrides.focusSnapshot }
      : {}),
    health: {
      clientType: "DESKTOP_AGENT",
      clientVersion: "desktop-agent-windows/0.6.4",
      platform: "WINDOWS",
      connectionState: "ONLINE",
      collectorState: "HEALTHY",
      policyState: "ACTIVE",
      migrationState: "V2",
      queue: {
        pending: 0,
        ready: 0,
        deadLetter: 0,
        oldestQueuedAt: null,
        nextRetryAt: null,
      },
      lastSuccessfulHeartbeatAt: null,
      lastSuccessfulSyncAt: null,
      errorCode: "NONE",
    },
  };
}

function browserSyncRequest(
  now: number,
  overrides: { intervals?: unknown[]; focusSnapshot?: unknown } = {},
) {
  const request = syncRequest(now, overrides);
  return {
    ...request,
    health: {
      ...request.health,
      clientType: "BROWSER_EXTENSION",
      clientVersion: "browser-extension-mv3/0.5.8",
      platform: "CHROME",
    },
  };
}

function noneSnapshot(
  now: number,
  snapshotSequence: number,
  overrides: { clockEpochId?: string; lastObservedAt?: string } = {},
) {
  return {
    snapshotSequence,
    activitySessionId: null,
    currentStateId: null,
    source: "DESKTOP_APP",
    stream: "FOCUS",
    clockEpochId: overrides.clockEpochId ?? CLOCK_ID,
    policyVersion: "v1",
    policyLeaseId: LEASE_ID,
    subjectKey: null,
    displayName: null,
    state: "NONE",
    sessionStartedAt: null,
    stateStartedAt: null,
    lastActivityEvidenceAt: null,
    activityEvidenceKind: null,
    latestEmittedIntervalSequence: null,
    latestEmittedClientEventId: null,
    nextIntervalSequence: 1,
    lastObservedAt:
      overrides.lastObservedAt ?? new Date(now - 500).toISOString(),
    collectorState: "HEALTHY",
  };
}

class SyncPrisma {
  readonly now: number;
  readonly lease: any;
  intervals: any[] = [];
  fragments: any[] = [];
  tombstones: any[] = [];
  subjects: any[] = [];
  targets: any[] = [];
  liveSnapshotSequence: number | null = null;
  liveSnapshotClockEpochId = CLOCK_ID;
  liveSnapshotLastObservedAt: Date | null = null;
  savedSnapshot: any = null;
  healthUpdate: any = null;
  deviceHeartbeatWritten = false;
  previousHealthReceivedAt: Date | null = null;
  statusEvents: any[] = [];

  constructor(now: number) {
    this.now = now;
    this.lease = {
      id: LEASE_ID,
      companyId: COMPANY_ID,
      userId: USER_ID,
      deviceId: DEVICE_ID,
      policyVersion: "v1",
      issuedAt: new Date(now - 60 * 60_000),
      expiresAt: new Date(now + 60 * 60_000),
      allowedUtcWindows: [
        {
          startsAt: new Date(now - 60 * 60_000).toISOString(),
          endsAt: new Date(now + 60 * 60_000).toISOString(),
        },
      ],
      monitoringPolicy: {
        collectAppUsage: true,
        collectOpenRuntime: true,
        collectWebsiteDomain: true,
        collectDomainOpenRuntime: false,
      },
      collectDomainOpenRuntime: false,
    };
  }

  devicePolicyLease = {
    findMany: async () => [this.lease],
    findFirst: async () => ({ id: LEASE_ID }),
  };
  monitoringPolicy = {
    findFirst: async () => ({
      policyVersion: "v1",
      collectOpenRuntime: true,
      collectDomainOpenRuntime:
        this.lease.monitoringPolicy.collectDomainOpenRuntime,
    }),
  };
  clientWriteLane = {
    upsert: async () => ({ id: "12121212-1212-4212-8212-121212121212" }),
  };
  activityInterval = {
    findMany: async () => this.intervals,
    findFirst: async () => null,
    count: async () => this.intervals.length,
    createMany: async ({ data }: any) => {
      this.intervals.push(
        ...data.map((row: any) => ({ ...row, receivedAt: new Date() })),
      );
      return { count: data.length };
    },
  };
  clientSequenceTombstone = {
    findMany: async () => this.tombstones,
    createMany: async ({ data }: any) => {
      this.tombstones.push(...data);
      return { count: data.length };
    },
    count: async () => this.tombstones.length,
  };
  activitySubject = {
    createMany: async ({ data }: any) => {
      this.subjects.push(...data);
      return { count: data.length };
    },
    findMany: async () => this.subjects,
    update: async () => ({}),
  };
  activityIntervalDayFragment = {
    createMany: async ({ data }: any) => {
      this.fragments.push(...data);
      return { count: data.length };
    },
    findMany: async () =>
      this.fragments.map((fragment) => {
        const interval = this.intervals.find(
          (row) => row.id === fragment.activityIntervalId,
        );
        const subject = this.subjects.find(
          (row) => row.id === fragment.activitySubjectId,
        );
        return {
          ...fragment,
          activityInterval: {
            receivedAt: interval.receivedAt,
            subject: {
              subjectKey: subject.subjectKey,
              displayName: subject.displayName,
            },
          },
        };
      }),
  };
  usageReconciliationTarget = {
    upsert: async ({ create }: any) => {
      const row = {
        ...create,
        state: "DIRTY",
        version: 1,
        dirtyAt: new Date(),
        lastErrorCode: null,
      };
      this.targets = [row];
      return row;
    },
    findMany: async () => this.targets,
  };
  deviceSubjectDailySummary = { upsert: async () => ({}) };
  clientSyncCursor = { upsert: async () => ({}) };
  liveFocusSnapshot = {
    findUnique: async () =>
      this.liveSnapshotSequence === null
        ? null
        : {
            snapshotSequence: this.liveSnapshotSequence,
            clockEpochId: this.liveSnapshotClockEpochId,
            lastObservedAt:
              this.liveSnapshotLastObservedAt ?? new Date(this.now - 1_000),
          },
    upsert: async ({ update }: any) => {
      this.savedSnapshot = update;
      this.liveSnapshotSequence = update.snapshotSequence;
      this.liveSnapshotClockEpochId = update.clockEpochId;
      this.liveSnapshotLastObservedAt = update.lastObservedAt;
      return update;
    },
  };
  clientHealthSnapshot = {
    findUnique: async () =>
      this.previousHealthReceivedAt
        ? { receivedAt: this.previousHealthReceivedAt }
        : null,
    upsert: async ({ update }: any) => {
      this.healthUpdate = update;
      return update;
    },
  };
  deviceStatusEvent = {
    findFirst: async () => null,
    create: async ({ data }: any) => {
      this.statusEvents.push(data);
      return data;
    },
  };
  device = {
    update: async () => {
      this.deviceHeartbeatWritten = true;
      return {};
    },
    count: async () => 1,
  };
  userSubjectDailySummary = { findMany: async () => [] };
  userDailyFocusSummary = { findMany: async () => [] };

  async $queryRaw() {
    return [];
  }

  async $transaction(operation: (tx: this) => unknown) {
    return operation(this);
  }
}
