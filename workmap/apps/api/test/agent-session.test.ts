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

  const session = prisma.sessions.find((row) => row.id === started.sessionId);
  assert.equal(session?.endReason, AgentSessionEndReason.USER_STOP);
  assert.equal(prisma.statusEvents.filter((row) => row.clientEventId === event.clientEventId).length, 1);
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
    findFirst: async ({ where }: any) => this.statusEvents.find((event) => matches(event, where)) ?? null,
  };

  async $transaction(callback: (tx: AgentSessionPrisma) => Promise<unknown>) {
    return callback(this);
  }
}

function matches(row: Record<string, any>, where: Record<string, any>) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}
