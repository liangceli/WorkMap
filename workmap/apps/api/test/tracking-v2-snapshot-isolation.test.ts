import assert from "node:assert/strict";
import test from "node:test";
import { DeviceClientType } from "@prisma/client";
import { TrackingV2SyncService } from "../src/modules/devices/tracking-v2-sync.service.js";
import type { PrismaService } from "../src/modules/prisma/prisma.service.js";
import type { TrackingV2PolicyService } from "../src/modules/devices/tracking-v2-policy.service.js";

test("v2 sync isolates a rejected live snapshot from heartbeat confirmation", async () => {
  const now = Date.now();
  const protocolActivatedAt = new Date(now - 60_000);
  let healthWrite: Record<string, unknown> | null = null;
  let deviceHeartbeatWritten = false;

  const tx = {
    activityInterval: { findMany: async () => [] },
    clientSequenceTombstone: { findMany: async () => [] },
    clientHealthSnapshot: {
      findUnique: async () => null,
      upsert: async (input: { update: Record<string, unknown> }) => {
        healthWrite = input.update;
        return input.update;
      },
    },
    device: {
      update: async () => {
        deviceHeartbeatWritten = true;
        return {};
      },
    },
  };
  const expiredLease = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyId: "33333333-3333-4333-8333-333333333333",
    userId: "44444444-4444-4444-8444-444444444444",
    deviceId: "11111111-1111-4111-8111-111111111111",
    policyVersion: "v1",
    issuedAt: new Date(now - 120_000),
    expiresAt: new Date(now - 1_000),
    allowedUtcWindows: [],
    monitoringPolicy: {
      collectAppUsage: true,
      collectWebsiteDomain: true,
    },
  };
  const prisma = {
    devicePolicyLease: { findMany: async () => [expiredLease] },
    monitoringPolicy: { findFirst: async () => null },
    $transaction: async (operation: (client: typeof tx) => unknown) =>
      operation(tx),
  } as unknown as PrismaService;
  const policyService = {
    requireV2DeviceIdentity: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      clientType: DeviceClientType.DESKTOP_AGENT,
      browserName: null,
      workstationId: "22222222-2222-4222-8222-222222222222",
      protocolActivatedAt,
    }),
  } as unknown as TrackingV2PolicyService;
  const service = new TrackingV2SyncService(prisma, policyService);
  const observedAt = new Date(now - 500);
  const stateStartedAt = new Date(now - 2_000);

  const response = await service.sync(
    {
      companyId: "33333333-3333-4333-8333-333333333333",
      userId: "44444444-4444-4444-8444-444444444444",
      role: "EMPLOYEE",
      deviceId: "11111111-1111-4111-8111-111111111111",
      credentialId: "55555555-5555-4555-8555-555555555555",
      clientType: DeviceClientType.DESKTOP_AGENT,
      browserName: null,
      workstationId: "22222222-2222-4222-8222-222222222222",
      protocolActivatedAt,
    },
    {
      protocolVersion: 2,
      protocolActivatedAt: protocolActivatedAt.toISOString(),
      clientInstanceId: "66666666-6666-4666-8666-666666666666",
      sentAt: observedAt.toISOString(),
      intervals: [],
      focusSnapshot: {
        snapshotSequence: 1,
        activitySessionId: "77777777-7777-4777-8777-777777777777",
        currentStateId: "88888888-8888-4888-8888-888888888888",
        source: "DESKTOP_APP",
        stream: "FOCUS",
        clockEpochId: "99999999-9999-4999-8999-999999999999",
        policyVersion: "v1",
        policyLeaseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        subjectKey: "app:test",
        displayName: "Test App",
        state: "ACTIVE",
        sessionStartedAt: stateStartedAt.toISOString(),
        stateStartedAt: stateStartedAt.toISOString(),
        lastActivityEvidenceAt: observedAt.toISOString(),
        activityEvidenceKind: "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND",
        latestEmittedIntervalSequence: null,
        latestEmittedClientEventId: null,
        nextIntervalSequence: 1,
        lastObservedAt: observedAt.toISOString(),
        collectorState: "HEALTHY",
      },
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
    },
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );

  assert.deepEqual(response.results, []);
  assert.equal(response.focusSnapshotResult?.status, "REJECTED");
  assert.equal(
    response.focusSnapshotResult?.status === "REJECTED"
      ? response.focusSnapshotResult.rejectionCode
      : null,
    "SNAPSHOT_POLICY_LEASE_INVALID",
  );
  assert.equal(deviceHeartbeatWritten, true);
  assert.equal(
    healthWrite?.serverDiagnosticCode,
    "SNAPSHOT_POLICY_LEASE_INVALID",
  );
  assert.equal(
    healthWrite?.serverDiagnosticRequestId,
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
});
