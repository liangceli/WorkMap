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

test("a valid App interval is inserted into the confirmed ledger and displayed by Reports", async () => {
  const now = Date.now();
  const prisma = new SyncPrisma(now);
  const sync = new TrackingV2SyncService(
    prisma as any,
    policyService(now) as any,
  );
  const startedAt = new Date(now - 20_000);
  const endedAt = new Date(now - 10_000);

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
      ],
    }),
    REQUEST_ID,
  );

  assert.equal(response.results[0]?.status, "ACCEPTED");
  assert.equal(prisma.intervals.length, 1, "the accepted interval is in the official ledger");
  assert.equal(prisma.fragments.length, 1, "the ledger interval has a report day fragment");
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
  assert.equal(usage.coverage.reconciliationState, "LEDGER_FALLBACK");
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

function noneSnapshot(now: number, snapshotSequence: number) {
  return {
    snapshotSequence,
    activitySessionId: null,
    currentStateId: null,
    source: "DESKTOP_APP",
    stream: "FOCUS",
    clockEpochId: CLOCK_ID,
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
    lastObservedAt: new Date(now - 500).toISOString(),
    collectorState: "HEALTHY",
  };
}

class SyncPrisma {
  readonly now: number;
  readonly lease: any;
  intervals: any[] = [];
  fragments: any[] = [];
  subjects: any[] = [];
  targets: any[] = [];
  liveSnapshotSequence: number | null = null;
  savedSnapshot: any = null;
  healthUpdate: any = null;
  deviceHeartbeatWritten = false;

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
        collectWebsiteDomain: true,
      },
    };
  }

  devicePolicyLease = {
    findMany: async () => [this.lease],
    findFirst: async () => ({ id: LEASE_ID }),
  };
  monitoringPolicy = {
    findFirst: async () => ({ policyVersion: "v1" }),
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
    findMany: async () => [],
    createMany: async () => ({ count: 0 }),
    count: async () => 0,
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
        : { snapshotSequence: this.liveSnapshotSequence },
    upsert: async ({ update }: any) => {
      this.savedSnapshot = update;
      this.liveSnapshotSequence = update.snapshotSequence;
      return update;
    },
  };
  clientHealthSnapshot = {
    upsert: async ({ update }: any) => {
      this.healthUpdate = update;
      return update;
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
