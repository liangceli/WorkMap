import assert from "node:assert/strict";
import test from "node:test";
import { DeviceClientType } from "@prisma/client";
import { classifyTrackingSyncDatabaseError } from "../src/modules/devices/tracking-v2-sync.service.js";
import { TrackingV2SyncService } from "../src/modules/devices/tracking-v2-sync.service.js";

const COMPANY_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSTATION_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("Tracking v2 diagnostics classify safe Prisma availability and transaction codes", () => {
  assert.deepEqual(classifyTrackingSyncDatabaseError({ code: "P2024" }), {
    prismaCode: "P2024",
    category: "DATABASE_POOL_TIMEOUT",
  });
  assert.deepEqual(classifyTrackingSyncDatabaseError({ code: "P2028" }), {
    prismaCode: "P2028",
    category: "DATABASE_TRANSACTION_TIMEOUT",
  });
  assert.deepEqual(classifyTrackingSyncDatabaseError({ code: "P2034" }), {
    prismaCode: "P2034",
    category: "DATABASE_WRITE_CONFLICT",
  });
  assert.deepEqual(classifyTrackingSyncDatabaseError({ code: "P1001" }), {
    prismaCode: "P1001",
    category: "DATABASE_UNREACHABLE",
  });
  assert.deepEqual(classifyTrackingSyncDatabaseError({ code: "P1002" }), {
    prismaCode: "P1002",
    category: "DATABASE_CONNECTION_TIMEOUT",
  });
});

test("Tracking v2 diagnostics inspect a bounded cause chain without logging error content", () => {
  const sensitiveError = {
    message: "credential and hostname must not be copied",
    cause: {
      message: "payload must not be copied",
      cause: { code: "P2024", meta: { connectionString: "secret" } },
    },
  };

  assert.deepEqual(classifyTrackingSyncDatabaseError(sensitiveError), {
    prismaCode: "P2024",
    category: "DATABASE_POOL_TIMEOUT",
  });
  assert.equal(classifyTrackingSyncDatabaseError({ code: "UNKNOWN" }), null);
});

test("Tracking v2 keeps the client response generic while the server log classifies a Prisma failure", async () => {
  const now = Date.now();
  const prismaError = Object.assign(new Error("secret database detail"), {
    code: "P2024",
    meta: { connectionString: "postgresql://credential@example.invalid" },
  });
  const prisma = {
    devicePolicyLease: { findMany: async () => [] },
    $transaction: async () => {
      throw prismaError;
    },
  };
  const service = new TrackingV2SyncService(
    prisma as never,
    {
      requireV2DeviceIdentity: async () => ({
        id: DEVICE_ID,
        clientType: DeviceClientType.BROWSER_EXTENSION,
        browserName: "EDGE",
        workstationId: WORKSTATION_ID,
        protocolActivatedAt: new Date(now - 60_000),
      }),
    } as never,
  );
  const warnings: string[] = [];
  (service as unknown as { logger: { warn: (message: string) => void } }).logger = {
    warn: (message) => warnings.push(message),
  };

  await assert.rejects(
    service.sync(
      {
        companyId: COMPANY_ID,
        userId: USER_ID,
        role: "EMPLOYEE",
        deviceId: DEVICE_ID,
        credentialId: "55555555-5555-4555-8555-555555555555",
        clientType: DeviceClientType.BROWSER_EXTENSION,
        browserName: "EDGE",
        workstationId: WORKSTATION_ID,
        protocolActivatedAt: new Date(now - 60_000),
      },
      {
        protocolVersion: 2,
        protocolActivatedAt: new Date(now - 60_000).toISOString(),
        clientInstanceId: "66666666-6666-4666-8666-666666666666",
        sentAt: new Date(now).toISOString(),
        intervals: [],
        health: {
          clientType: "BROWSER_EXTENSION",
          clientVersion: "browser-extension-mv3/test",
          platform: "EDGE",
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
      REQUEST_ID,
    ),
    (error: unknown) => {
      const response = (
        error as { getResponse: () => Record<string, unknown> }
      ).getResponse();
      assert.equal(response.code, "TRACKING_SYNC_INTERNAL");
      assert.equal(response.requestId, REQUEST_ID);
      assert.equal(JSON.stringify(response).includes("P2024"), false);
      assert.equal(JSON.stringify(response).includes("credential"), false);
      return true;
    },
  );

  assert.equal(warnings.length, 1);
  const serverLog = JSON.parse(warnings[0] ?? "{}") as Record<string, unknown>;
  assert.deepEqual(serverLog.databaseFailure, {
    prismaCode: "P2024",
    category: "DATABASE_POOL_TIMEOUT",
  });
  assert.equal(warnings[0]?.includes("credential"), false);
  assert.equal(warnings[0]?.includes("secret database detail"), false);
  const transaction = serverLog.transaction as Record<string, unknown>;
  assert.equal(transaction.currentStep, "acquire_transaction");
  assert.deepEqual(transaction.timingsMs, {});
  assert.equal(typeof transaction.currentStepDurationMs, "number");
  assert.equal(typeof transaction.durationMs, "number");
});
