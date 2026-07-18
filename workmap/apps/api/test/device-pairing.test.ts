/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DeviceClientType, UserRole } from "@prisma/client";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { DeviceClientController } from "../src/modules/devices/device-client.controller.js";
import { DevicePairingService } from "../src/modules/devices/device-pairing.service.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const SPOOFED_DEVICE_ID = "55555555-5555-4555-8555-555555555555";
const context = { companyId: COMPANY_ID, userId: USER_ID, role: "EMPLOYEE" as const };

test("pairing code is tenant/user bound, short-lived, one-time and credential is hash-only", async () => {
  const prisma = new PairingPrisma();
  const service = new DevicePairingService(prisma as never);
  const pairing = await service.createPairingCode(context, { clientType: "DESKTOP_AGENT" });
  assert.match(pairing.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(prisma.pairingCodes[0]?.companyId, COMPANY_ID);
  assert.equal(prisma.pairingCodes[0]?.userId, USER_ID);
  assert(!JSON.stringify(prisma.pairingCodes).includes(pairing.code));

  await assert.rejects(() => service.exchangePairingCode({ code: pairing.code, clientType: "BROWSER_EXTENSION" }), UnauthorizedException);
  assert.equal((await service.getPairingStatus(context, pairing.id)).status, "pending");
  const exchanged = await service.exchangePairingCode({ code: pairing.code, clientType: "DESKTOP_AGENT", os: "WINDOWS", hostname: "WM-PC", agentVersion: "alpha" });
  assert.match(exchanged.credential, /^wmdev_/);
  assert.equal(exchanged.clientType, DeviceClientType.DESKTOP_AGENT);
  assert.equal(prisma.devices[0]?.companyId, COMPANY_ID);
  assert.equal(prisma.credentials[0]?.userId, USER_ID);
  assert(!JSON.stringify(prisma.credentials).includes(exchanged.credential));
  assert.equal((await service.getPairingStatus(context, pairing.id)).status, "paired");
  await assert.rejects(() => service.exchangePairingCode({ code: pairing.code }), UnauthorizedException);

  const resolved = await service.resolveDeviceAuthorization(`Device ${exchanged.credential}`);
  assert.equal(resolved.companyId, COMPANY_ID);
  assert.equal(resolved.userId, USER_ID);
  assert.equal(resolved.deviceId, exchanged.device.id);
});

test("expired/invalid codes fail and revoked device credential immediately fails", async () => {
  const prisma = new PairingPrisma();
  const service = new DevicePairingService(prisma as never);
  const pairing = await service.createPairingCode(context, { clientType: "BROWSER_EXTENSION" });
  prisma.pairingCodes[0]!.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => service.exchangePairingCode({ code: pairing.code }), UnauthorizedException);
  await assert.rejects(() => service.exchangePairingCode({ code: "AAAA-BBBB" }), UnauthorizedException);

  const valid = await service.createPairingCode(context, { clientType: "BROWSER_EXTENSION" });
  const exchanged = await service.exchangePairingCode({
    code: valid.code,
    clientType: "BROWSER_EXTENSION",
    browserName: "CHROME",
  });
  await service.revokeDevice(context, exchanged.device.id);
  await assert.rejects(() => service.resolveDeviceAuthorization(`Device ${exchanged.credential}`), UnauthorizedException);
});

test("device credentials are isolated from tenant report auth surface", async () => {
  const reportController = await readFile(new URL("../src/modules/reports/reports.controller.ts", import.meta.url), "utf8");
  const deviceController = await readFile(new URL("../src/modules/devices/device-client.controller.ts", import.meta.url), "utf8");
  assert.match(reportController, /RequestContextGuard/);
  assert.doesNotMatch(reportController, /DeviceCredentialGuard/);
  assert.match(deviceController, /DeviceCredentialGuard/);
  assert.match(deviceController, /device-client/);
});

test("device-client endpoints bind uploaded usage to the credential device context", async () => {
  const calls: Array<{ context: unknown; input: any }> = [];
  const activity = {
    ingestAppUsage: async (requestContext: unknown, input: unknown) => {
      calls.push({ context: requestContext, input });
      return { accepted: 2 };
    },
    ingestDomainUsage: async () => ({ accepted: 0 }),
  };
  const controller = new DeviceClientController({} as never, {} as never, activity as never);
  const deviceContext = {
    companyId: COMPANY_ID,
    userId: USER_ID,
    role: UserRole.EMPLOYEE,
    deviceId: DEVICE_ID,
    credentialId: "credential-1",
    clientType: DeviceClientType.DESKTOP_AGENT,
  };

  const result = await controller.appUsage(deviceContext, {
    events: [
      { deviceId: SPOOFED_DEVICE_ID, appName: "Code", durationSeconds: 60 },
      { appName: "Edge", durationSeconds: 30 },
    ],
  });

  assert.deepEqual(result, { accepted: 2 });
  assert.deepEqual(calls[0]?.context, { companyId: COMPANY_ID, userId: USER_ID, role: UserRole.EMPLOYEE });
  assert.deepEqual(calls[0]?.input.events.map((event: any) => event.deviceId), [DEVICE_ID, DEVICE_ID]);
  assert.throws(
    () => controller.domainUsage(deviceContext, { events: [{ deviceId: SPOOFED_DEVICE_ID, domain: "example.com" }] }),
    ForbiddenException,
  );
});

class PairingPrisma {
  pairingCodes: any[] = [];
  devices: any[] = [];
  credentials: any[] = [];
  workstations: any[] = [];

  devicePairingCode = {
    create: async ({ data }: any) => {
      if (this.pairingCodes.some((row) => row.codeHash === data.codeHash)) throw Object.assign(new Error("unique"), { code: "P2002" });
      const row = { id: crypto.randomUUID(), deviceId: null, usedAt: null, createdAt: new Date(), ...data };
      this.pairingCodes.push(row); return row;
    },
    findUnique: async ({ where }: any) => this.pairingCodes.find((row) => row.codeHash === where.codeHash) ?? null,
    findFirst: async ({ where }: any) => this.pairingCodes.find((row) => row.id === where.id && row.companyId === where.companyId && row.userId === where.userId) ?? null,
    updateMany: async ({ where, data }: any) => {
      const row = this.pairingCodes.find((item) => item.id === where.id && item.usedAt === null && item.expiresAt > where.expiresAt.gt);
      if (!row) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    },
    update: async ({ where, data }: any) => { const row = this.pairingCodes.find((item) => item.id === where.id); Object.assign(row, data); return row; },
  };

  device = {
    create: async ({ data }: any) => { const row = { id: crypto.randomUUID(), revokedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data }; this.devices.push(row); return row; },
    findFirst: async ({ where }: any) => this.devices.find((row) => row.id === where.id && row.companyId === where.companyId) ?? null,
    update: async ({ where, data }: any) => { const row = this.devices.find((item) => item.id === where.id); Object.assign(row, data); return row; },
  };

  workstation = {
    create: async ({ data }: any) => {
      const row = {
        id: crypto.randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.workstations.push(row);
      return row;
    },
    findFirst: async ({ where }: any) =>
      this.workstations.find(
        (row) =>
          row.id === where.id &&
          row.companyId === where.companyId &&
          row.userId === where.userId &&
          row.revokedAt === null,
      ) ?? null,
  };

  deviceCredential = {
    create: async ({ data }: any) => { const row = { id: crypto.randomUUID(), revokedAt: null, expiresAt: null, lastUsedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data }; this.credentials.push(row); return row; },
    findUnique: async ({ where }: any) => {
      const row = this.credentials.find((item) => item.tokenHash === where.tokenHash);
      if (!row) return null;
      const device = this.devices.find((item) => item.id === row.deviceId);
      return { ...row, device, user: { role: UserRole.EMPLOYEE } };
    },
    update: async ({ where, data }: any) => { const row = this.credentials.find((item) => item.id === where.id); Object.assign(row, data); return row; },
    updateMany: async ({ where, data }: any) => {
      const rows = this.credentials.filter((item) => item.deviceId === where.deviceId && item.revokedAt === null);
      rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
    },
  };

  async $transaction(input: any) { return typeof input === "function" ? input(this) : Promise.all(input); }
}
