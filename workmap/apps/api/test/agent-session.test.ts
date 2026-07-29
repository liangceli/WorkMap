/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AgentSessionEndReason, DeviceClientType, DeviceOS, DeviceStatus, DeviceStatusReason, UserRole } from "@prisma/client";
import { DevicesService } from "../src/modules/devices/devices.service.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const context = { companyId: COMPANY_ID, userId: USER_ID, role: UserRole.EMPLOYEE };

test("agent sessions record live app, explicit user stop and inferred restart interruption", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);

  const first = await service.startAgentSession(context, { deviceId: DEVICE_ID, agentVersion: "test/1" });
  await service.recordHeartbeat(context, {
    deviceId: DEVICE_ID,
    sessionId: first.sessionId,
    currentActivity: {
      appName: "Visual Studio Code",
      startedAt: "2026-06-21T10:00:00.000Z",
      lastObservedAt: "2026-06-21T10:00:10.000Z",
      isIdle: false,
    },
  });
  assert.equal(prisma.sessions[0]?.currentAppName, "Visual Studio Code");

  prisma.sessions[0]!.lastSequenceNumber = 10;
  await service.recordHeartbeat(context, {
    deviceId: DEVICE_ID,
    sessionId: first.sessionId,
    sequenceNumber: 5,
  });
  assert.equal(prisma.sessions[0]?.lastSequenceNumber, 10);
  await service.recordHeartbeat(context, {
    deviceId: DEVICE_ID,
    sessionId: first.sessionId,
    sequenceNumber: 11,
  });
  assert.equal(prisma.sessions[0]?.lastSequenceNumber, 11);

  const stopped = await service.stopAgentSession(context, { deviceId: DEVICE_ID, sessionId: first.sessionId, reason: "USER_STOP" });
  assert.equal(stopped.endReason, AgentSessionEndReason.USER_STOP);
  assert.equal(prisma.statusEvents[1]?.status, DeviceStatus.STOPPED_BY_USER);
  assert.equal(prisma.statusEvents[1]?.reason, DeviceStatusReason.USER_STOP);

  const second = await service.startAgentSession(context, { deviceId: DEVICE_ID });
  const secondRow = prisma.sessions.find((session) => session.id === second.sessionId)!;
  secondRow.lastHeartbeatAt = new Date("2026-06-21T10:05:00.000Z");
  await service.startAgentSession(context, { deviceId: DEVICE_ID });
  assert.equal(secondRow.endReason, AgentSessionEndReason.UNKNOWN_INTERRUPTED);
  assert.equal(secondRow.endedAt?.toISOString(), "2026-06-21T10:05:00.000Z");
  assert.equal(prisma.statusEvents.at(-2)?.status, DeviceStatus.UNKNOWN_INTERRUPTED);
  assert.equal(prisma.statusEvents.at(-1)?.status, DeviceStatus.RESTARTED);
});

test("agent session start is idempotent for the same client runtime", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);
  const clientSessionId = "55555555-5555-4555-8555-555555555555";

  const first = await service.startAgentSession(context, { deviceId: DEVICE_ID, clientSessionId });
  const retried = await service.startAgentSession(context, { deviceId: DEVICE_ID, clientSessionId });

  assert.equal(retried.sessionId, first.sessionId);
  assert.equal(prisma.sessions.length, 1);
  assert.equal(prisma.statusEvents.length, 1);
  assert.equal(prisma.sessions[0]?.endReason, null);
});

test("heartbeat normalizes a bounded future client clock without losing relative activity time", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);
  const started = await service.startAgentSession(context, { deviceId: DEVICE_ID });
  const before = Date.now();
  const clientObservedAt = before + 2 * 60_000;

  await service.recordHeartbeat(context, {
    deviceId: DEVICE_ID,
    sessionId: started.sessionId,
    currentActivity: {
      appName: "Microsoft Edge",
      startedAt: new Date(clientObservedAt - 15_000).toISOString(),
      lastObservedAt: new Date(clientObservedAt).toISOString(),
      isIdle: false,
    },
  });

  const session = prisma.sessions[0]!;
  assert(session.currentAppLastObservedAt.getTime() >= before);
  assert(session.currentAppLastObservedAt.getTime() <= Date.now());
  assert.equal(session.currentAppLastObservedAt.getTime() - session.currentAppStartedAt.getTime(), 15_000);
});

test("durable device status closes a session and stays idempotent after retry", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);
  const started = await service.startAgentSession(context, { deviceId: DEVICE_ID, agentVersion: "test/1" });
  const recordedAt = new Date().toISOString();
  const event = {
    deviceId: DEVICE_ID,
    sessionId: started.sessionId,
    clientEventId: "44444444-4444-4444-8444-444444444444",
    status: "STOPPED_BY_USER",
    reason: "USER_STOP",
    startedAt: recordedAt,
    endedAt: recordedAt,
    recordedAt,
    timeZone: "Australia/Adelaide",
  };

  await service.recordDeviceStatus(context, event, DeviceClientType.DESKTOP_AGENT);
  await service.recordDeviceStatus(context, event, DeviceClientType.DESKTOP_AGENT);
  await service.recordDeviceStatus(context, {
    ...event,
    clientEventId: "66666666-6666-4666-8666-666666666666",
  }, DeviceClientType.DESKTOP_AGENT);

  const session = prisma.sessions.find((row) => row.id === started.sessionId);
  assert.equal(session?.endReason, AgentSessionEndReason.USER_STOP);
  assert.equal(prisma.statusEvents.filter((row) => row.clientEventId === event.clientEventId).length, 1);
  assert.equal(prisma.statusEvents.filter((row) => row.status === DeviceStatus.STOPPED_BY_USER).length, 1);
});

test("browser tracking-health transitions persist without turning repeated status retries into history noise", async () => {
  const prisma = new AgentSessionPrisma();
  const lastHeartbeatBeforeHealthEvent = prisma.deviceRow.lastSeenAt.toISOString();
  const service = new DevicesService(prisma as any);
  const recordedAt = new Date().toISOString();
  const base = {
    deviceId: DEVICE_ID,
    status: "RUNNING",
    reason: "UNKNOWN",
    startedAt: recordedAt,
    recordedAt,
    timeZone: "Australia/Adelaide",
  };

  await service.recordDeviceStatus(context, {
    ...base,
    clientEventId: "77777777-7777-4777-8777-777777777777",
    metadata: { operation: "tracking-access", trackingState: "ready" },
  }, DeviceClientType.BROWSER_EXTENSION);
  await service.recordDeviceStatus(context, {
    ...base,
    clientEventId: "88888888-8888-4888-8888-888888888888",
    metadata: { operation: "tracking-access", trackingState: "permission_required" },
  }, DeviceClientType.BROWSER_EXTENSION);
  await service.recordDeviceStatus(context, {
    ...base,
    clientEventId: "99999999-9999-4999-8999-999999999999",
    metadata: { operation: "tracking-access", trackingState: "permission_required" },
  }, DeviceClientType.BROWSER_EXTENSION);

  const browserEvents = prisma.statusEvents.filter((event) => event.source === DeviceClientType.BROWSER_EXTENSION);
  assert.equal(browserEvents.length, 2);
  assert.equal(browserEvents[1]?.metadata?.trackingState, "permission_required");
  assert.equal(prisma.deviceRow.lastSeenAt.toISOString(), lastHeartbeatBeforeHealthEvent);
});

test("separate Browser profile starts remain distinct lifecycle events", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);
  const firstAt = new Date(Date.now() - 1_000).toISOString();
  const secondAt = new Date().toISOString();

  for (const [clientEventId, recordedAt] of [
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", firstAt],
    ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", secondAt],
  ]) {
    await service.recordDeviceStatus(context, {
      deviceId: DEVICE_ID,
      clientEventId,
      status: "RESTARTED",
      reason: "AGENT_RESTART",
      startedAt: recordedAt,
      recordedAt,
      timeZone: "Australia/Adelaide",
      metadata: { operation: "profile-start" },
    }, DeviceClientType.BROWSER_EXTENSION);
  }

  assert.equal(
    prisma.statusEvents.filter(
      (event) => event.status === "RESTARTED",
    ).length,
    2,
  );
});

test("separate Desktop v2 starts remain distinct while retrying one event stays idempotent", async () => {
  const prisma = new AgentSessionPrisma();
  const service = new DevicesService(prisma as any);
  const firstAt = new Date(Date.now() - 1_000).toISOString();
  const secondAt = new Date().toISOString();
  const firstEvent = {
    deviceId: DEVICE_ID,
    clientEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "RUNNING",
    reason: "AGENT_STARTED",
    startedAt: firstAt,
    recordedAt: firstAt,
    timeZone: "Australia/Adelaide",
    metadata: { operation: "protocol-v2-start", agentVersion: "desktop-agent-windows/0.6.9" },
  };

  await service.recordDeviceStatus(context, firstEvent, DeviceClientType.DESKTOP_AGENT);
  await service.recordDeviceStatus(context, {
    ...firstEvent,
    clientEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    startedAt: secondAt,
    recordedAt: secondAt,
  }, DeviceClientType.DESKTOP_AGENT);
  await service.recordDeviceStatus(context, firstEvent, DeviceClientType.DESKTOP_AGENT);

  const starts = prisma.statusEvents.filter(
    (event) => event.source === DeviceClientType.DESKTOP_AGENT
      && event.status === DeviceStatus.RUNNING
      && event.reason === DeviceStatusReason.AGENT_STARTED,
  );
  assert.equal(starts.length, 2);
  assert.deepEqual(
    starts.map((event) => event.clientEventId).sort(),
    [
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ],
  );
});

class AgentSessionPrisma {
  deviceRow = {
    id: DEVICE_ID,
    companyId: COMPANY_ID,
    userId: USER_ID,
    os: DeviceOS.WINDOWS,
    hostname: "EMPLOYEE-PC",
    agentVersion: "test/1",
    lastSeenAt: new Date(),
    revokedAt: null,
  };
  sessions: any[] = [];
  statusEvents: any[] = [];

  device = {
    findFirst: async ({ where }: any) => matches(this.deviceRow, where) ? this.deviceRow : null,
    update: async ({ data }: any) => Object.assign(this.deviceRow, data),
  };

  agentSession = {
    findFirst: async ({ where }: any) => this.sessions.filter((session) => matches(session, where)).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null,
    create: async ({ data }: any) => {
      const row = { id: randomUUID(), endedAt: null, endReason: null, currentAppName: null, currentAppStartedAt: null, currentAppLastObservedAt: null, currentAppIsIdle: false, ...data };
      this.sessions.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.sessions.find((session) => session.id === where.id);
      assert(row);
      return Object.assign(row, data);
    },
    updateMany: async ({ where, data }: any) => {
      const rows = this.sessions.filter((session) => session.id === where.id
        && (session.lastSequenceNumber === null
          || session.lastSequenceNumber === undefined
          || session.lastSequenceNumber < data.lastSequenceNumber));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
  };

  deviceStatusEvent = {
    create: async ({ data }: any) => {
      if (data.clientEventId && this.statusEvents.some((event) => event.companyId === data.companyId && event.source === data.source && event.clientEventId === data.clientEventId)) {
        throw Object.assign(new Error("duplicate status event"), { code: "P2002" });
      }
      const row = { id: randomUUID(), receivedAt: new Date(), createdAt: new Date(), ...data };
      this.statusEvents.push(row);
      return row;
    },
    findFirst: async ({ where, orderBy }: any) => {
      const rows = this.statusEvents.filter((event) => matches(event, where)).reverse();
      if (orderBy?.recordedAt === "desc") rows.sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime());
      return rows[0] ?? null;
    },
  };

  async $transaction(callback: (tx: AgentSessionPrisma) => Promise<unknown>) {
    return callback(this);
  }
}

function matches(row: Record<string, any>, where: Record<string, any>) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}
