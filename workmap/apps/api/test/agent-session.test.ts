/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AgentSessionEndReason, DeviceOS, UserRole } from "@prisma/client";
import { DevicesService } from "../src/modules/devices/devices.service.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const context = { companyId: COMPANY_ID, userId: USER_ID, role: UserRole.EMPLOYEE };

test("agent sessions record live app, graceful stop and prior unexpected stop", async () => {
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

  const stopped = await service.stopAgentSession(context, { deviceId: DEVICE_ID, sessionId: first.sessionId });
  assert.equal(stopped.endReason, AgentSessionEndReason.GRACEFUL_SHUTDOWN);

  const second = await service.startAgentSession(context, { deviceId: DEVICE_ID });
  const secondRow = prisma.sessions.find((session) => session.id === second.sessionId)!;
  secondRow.lastHeartbeatAt = new Date("2026-06-21T10:05:00.000Z");
  await service.startAgentSession(context, { deviceId: DEVICE_ID });
  assert.equal(secondRow.endReason, AgentSessionEndReason.UNEXPECTED_STOP);
  assert.equal(secondRow.endedAt?.toISOString(), "2026-06-21T10:05:00.000Z");
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
  };

  async $transaction(callback: (tx: AgentSessionPrisma) => Promise<unknown>) {
    return callback(this);
  }
}

function matches(row: Record<string, any>, where: Record<string, any>) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}
