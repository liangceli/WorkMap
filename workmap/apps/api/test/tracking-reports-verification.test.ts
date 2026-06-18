/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  ActivityEventSource,
  ActivityEventType,
  BrowserName,
  DeviceOS,
  ProductivityLabel,
  UserRole,
} from "@prisma/client";
import type { PlatformRequestContext, RequestContext } from "@workmap/auth";
import { ActivityService } from "../src/modules/activity/activity.service.js";
import { DevicesService } from "../src/modules/devices/devices.service.js";
import { PlatformService } from "../src/modules/platform/platform.service.js";
import { ReportsService } from "../src/modules/reports/reports.service.js";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_DEVICE_ID = "55555555-5555-4555-8555-555555555555";

const employeeContext: RequestContext = {
  companyId: COMPANY_ID,
  userId: EMPLOYEE_ID,
  role: "EMPLOYEE",
};
const ownerContext: RequestContext = {
  companyId: COMPANY_ID,
  userId: OWNER_ID,
  role: "OWNER",
};
const otherTenantContext: RequestContext = {
  companyId: OTHER_COMPANY_ID,
  userId: OTHER_USER_ID,
  role: "EMPLOYEE",
};
const platformContext: PlatformRequestContext = {
  platformRole: "PLATFORM_ADMIN",
  identity: {
    email: "platform-admin@example.test",
    cognitoSub: "platform-sub",
    displayName: "Platform Admin",
  },
  source: "cognito",
};

async function main() {
  testControllerGuards();
  await testDeviceRegistrationHeartbeatAndOwnership();
  await testActivityIngestionAndReportsLoop();
  await testReportAccessBoundaries();
  await testPlatformAdminAggregateBoundary();

  console.info("api tracking/reports verification tests passed");
}

function testControllerGuards() {
  assertSourceContains("src/modules/activity/activity.controller.ts", "@UseGuards(RequestContextGuard)");
  assertSourceContains("src/modules/devices/devices.controller.ts", "@UseGuards(RequestContextGuard)");
  assertSourceContains("src/modules/reports/reports.controller.ts", "@UseGuards(RequestContextGuard)");
  assertSourceContains("src/modules/platform/platform.controller.ts", "@UseGuards(PlatformContextGuard)");
}

async function testDeviceRegistrationHeartbeatAndOwnership() {
  const prisma = new MockPrisma();
  const devices = new DevicesService(prisma as any);

  const registration = await devices.registerDevice(employeeContext, {
    deviceId: DEVICE_ID,
    os: "WINDOWS",
    hostname: "WM-EMPLOYEE-LAPTOP",
    agentVersion: "desktop-agent-harness/test",
  });

  assert.equal(registration.device.id, DEVICE_ID);
  assert.equal(prisma.devices[0]?.companyId, COMPANY_ID);
  assert.equal(prisma.devices[0]?.userId, EMPLOYEE_ID);
  assert.equal(prisma.devices[0]?.os, DeviceOS.WINDOWS);

  const heartbeat = await devices.recordHeartbeat(employeeContext, {
    deviceId: DEVICE_ID,
    agentVersion: "desktop-agent-harness/test-2",
  });
  assert.equal(heartbeat.device.id, DEVICE_ID);
  assert.equal(prisma.devices[0]?.agentVersion, "desktop-agent-harness/test-2");

  await assertRejectsWith(
    () => devices.recordHeartbeat(otherTenantContext, { deviceId: DEVICE_ID }),
    ForbiddenException,
  );
  await assertRejectsWith(
    () => devices.registerDevice(otherTenantContext, { deviceId: DEVICE_ID, os: "LINUX" }),
    ForbiddenException,
  );
}

async function testActivityIngestionAndReportsLoop() {
  const prisma = new MockPrisma();
  prisma.seedDevice({ id: DEVICE_ID, companyId: COMPANY_ID, userId: EMPLOYEE_ID });
  const activity = new ActivityService(prisma as any);
  const reports = new ReportsService(prisma as any, new MockAuditService() as any);

  const appResult = await activity.ingestAppUsage(employeeContext, {
    events: [
      {
        deviceId: DEVICE_ID,
        appName: "Visual Studio Code",
        startedAt: "2026-06-17T09:00:00.000Z",
        endedAt: "2026-06-17T09:05:00.000Z",
        isIdle: false,
      },
    ],
  });
  const domainResult = await activity.ingestDomainUsage(employeeContext, {
    events: [
      {
        deviceId: DEVICE_ID,
        domain: "https://Github.com/workmap/private-path?token=secret#fragment",
        browserName: "Chrome",
        startedAt: "2026-06-17T09:05:00.000Z",
        durationSeconds: 180,
        isIdle: false,
      },
    ],
  });

  assert.deepEqual(appResult, {
    accepted: 1,
    source: ActivityEventSource.DESKTOP_AGENT,
    eventType: ActivityEventType.APP,
  });
  assert.deepEqual(domainResult, {
    accepted: 1,
    source: ActivityEventSource.BROWSER_EXTENSION,
    eventType: ActivityEventType.BROWSER,
  });
  assert.equal(prisma.activityEvents.length, 2);
  assert.equal(prisma.activityEvents[0]?.companyId, COMPANY_ID);
  assert.equal(prisma.activityEvents[0]?.userId, EMPLOYEE_ID);
  assert.equal(prisma.activityEvents[1]?.domain, "github.com");
  assert(!JSON.stringify(prisma.activityEvents).includes("private-path"));
  assert(!JSON.stringify(prisma.activityEvents).includes("secret"));

  const ownSummary = await reports.getUsageSummary(employeeContext, {});
  assert.equal(ownSummary.scope, "user");
  assert.equal(ownSummary.userId, EMPLOYEE_ID);
  assert.deepEqual(ownSummary.apps.map((row: any) => [row.appName, row.activeSeconds]), [["Visual Studio Code", 300]]);
  assert.deepEqual(ownSummary.websites.map((row: any) => [row.domain, row.activeSeconds]), [["github.com", 180]]);
  assert.deepEqual(ownSummary.deviceCoverage, {
    registeredDevices: 1,
    activeDevices24h: 1,
    usersWithActivity: 1,
  });

  const companySummary = await reports.getUsageSummary(ownerContext, { scope: "company" });
  assert.equal(companySummary.scope, "company");
  assert.equal(companySummary.userId, null);
  assert.equal(companySummary.apps[0]?.appName, "Visual Studio Code");
  assert.equal(companySummary.websites[0]?.domain, "github.com");
  assert.deepEqual(companySummary.deviceCoverage, {
    registeredDevices: 1,
    activeDevices24h: 1,
    usersWithActivity: 1,
  });

  await assertRejectsWith(
    () => activity.ingestAppUsage(employeeContext, {
      deviceId: OTHER_DEVICE_ID,
      appName: "Outlook",
      startedAt: "2026-06-17T09:00:00.000Z",
      durationSeconds: 60,
    }),
    ForbiddenException,
  );
  await assertRejectsWith(
    () => activity.ingestDomainUsage(employeeContext, {
      deviceId: DEVICE_ID,
      domain: "not a hostname",
      browserName: "CHROME",
      startedAt: "2026-06-17T09:00:00.000Z",
      durationSeconds: 60,
    }),
    BadRequestException,
  );
}

async function testReportAccessBoundaries() {
  const prisma = new MockPrisma();
  prisma.seedDevice({ id: DEVICE_ID, companyId: COMPANY_ID, userId: EMPLOYEE_ID });
  prisma.seedDevice({ id: OTHER_DEVICE_ID, companyId: OTHER_COMPANY_ID, userId: OTHER_USER_ID });
  const reports = new ReportsService(prisma as any, new MockAuditService() as any);

  await assertRejectsWith(
    () => reports.getUsageSummary(employeeContext, { scope: "company" }),
    ForbiddenException,
  );
  await assertRejectsWith(
    () => reports.getUsageSummary(employeeContext, { userId: OWNER_ID }),
    ForbiddenException,
  );
  await assertRejectsWith(
    () => reports.getUsageSummary(ownerContext, { userId: OTHER_USER_ID }),
    NotFoundException,
  );
}

async function testPlatformAdminAggregateBoundary() {
  const prisma = new MockPrisma();
  prisma.seedDevice({ id: DEVICE_ID, companyId: COMPANY_ID, userId: EMPLOYEE_ID });
  prisma.activityEvents.push({
    id: nextId("event"),
    companyId: COMPANY_ID,
    userId: EMPLOYEE_ID,
    deviceId: DEVICE_ID,
    source: ActivityEventSource.DESKTOP_AGENT,
    eventType: ActivityEventType.APP,
    appName: "Visual Studio Code",
    browserName: null,
    domain: null,
    isIdle: false,
    isActiveWindow: true,
    startedAt: new Date("2026-06-17T09:00:00.000Z"),
    endedAt: new Date("2026-06-17T09:05:00.000Z"),
    durationSeconds: 300,
    createdAt: new Date("2026-06-17T09:05:01.000Z"),
    updatedAt: new Date("2026-06-17T09:05:01.000Z"),
  });
  const platform = new PlatformService(prisma as any);

  const healthResult = await platform.getTenantHealth(platformContext, COMPANY_ID);
  assert.deepEqual(Object.keys(healthResult.health).sort(), ["counts", "lastActivityAt", "lastVirtualOfficePositionAt", "readiness"]);
  assert.equal(healthResult.health.lastActivityAt, "2026-06-17T09:05:01.000Z");
  assert(!JSON.stringify(healthResult).includes("Visual Studio Code"));
  assert(!JSON.stringify(healthResult).includes("github.com"));

  const platformSource = readSource("src/modules/platform/platform.service.ts");
  assert(!platformSource.includes("appUsageSummary"));
  assert(!platformSource.includes("websiteUsageSummary"));
}

function assertSourceContains(relativePath: string, expected: string) {
  const source = readSource(relativePath);
  assert(source.includes(expected), `${relativePath} should contain ${expected}`);
}

function readSource(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

async function assertRejectsWith<TError extends Error>(
  action: () => Promise<unknown>,
  errorConstructor: new (...args: any[]) => TError,
) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof errorConstructor, `Expected ${errorConstructor.name}, received ${String(error)}`);
    return;
  }

  assert.fail(`Expected ${errorConstructor.name} to be thrown.`);
}

class MockAuditService {
  logs: unknown[] = [];

  async logSensitiveAction(input: unknown) {
    this.logs.push(input);
  }
}

class MockPrisma {
  users = [
    { id: EMPLOYEE_ID, companyId: COMPANY_ID, role: UserRole.EMPLOYEE },
    { id: OWNER_ID, companyId: COMPANY_ID, role: UserRole.OWNER },
    { id: OTHER_USER_ID, companyId: OTHER_COMPANY_ID, role: UserRole.EMPLOYEE },
  ];
  devices: DeviceRow[] = [];
  activityEvents: ActivityEventRow[] = [];
  appSummaries: AppSummaryRow[] = [];
  websiteSummaries: WebsiteSummaryRow[] = [];
  platformAuditLogs: unknown[] = [];

  device = {
    findUnique: async ({ where }: any) => this.devices.find((device) => device.id === where.id) ?? null,
    findFirst: async ({ where }: any) => this.devices.find((device) => matchesWhere(device, where)) ?? null,
    create: async ({ data }: any) => {
      const device = toDeviceRow({ id: data.id ?? nextId("device"), ...data });
      this.devices.push(device);
      return device;
    },
    update: async ({ where, data }: any) => {
      const device = this.devices.find((item) => item.id === where.id);
      assert(device, `Device ${where.id} not found in mock.`);
      Object.assign(device, data, { updatedAt: new Date() });
      return device;
    },
    count: async ({ where }: any) => this.devices.filter((device) => matchesWhere(device, where)).length,
  };

  activityEvent = {
    findFirst: async ({ where, select }: any) => {
      const event = this.activityEvents.find((item) => matchesWhere(item, where));
      return event && select?.id ? { id: event.id } : event ?? null;
    },
    create: async ({ data }: any) => {
      const event = {
        id: nextId("event"),
        browserName: null,
        domain: null,
        appName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.activityEvents.push(event);
      return event;
    },
    groupBy: async ({ where }: any) => uniqueBy(this.activityEvents.filter((event) => matchesWhere(event, where)), "userId").map((event) => ({
      userId: event.userId,
    })),
    aggregate: async ({ where }: any) => {
      const rows = this.activityEvents.filter((event) => matchesWhere(event, where));
      const latest = rows.reduce<Date | null>((current, row) => maxDate(current, row.createdAt), null);
      return { _max: { createdAt: latest } };
    },
  };

  appUsageSummary = {
    upsert: async ({ where, update, create }: any) => {
      const key = where.companyId_userId_date_appName;
      let row = this.appSummaries.find((summary) =>
        summary.companyId === key.companyId
        && summary.userId === key.userId
        && sameDate(summary.date, key.date)
        && summary.appName === key.appName,
      );

      if (!row) {
        row = { id: nextId("app"), ...create };
        this.appSummaries.push(row);
        return row;
      }

      row.activeSeconds += update.activeSeconds?.increment ?? 0;
      row.idleSeconds += update.idleSeconds?.increment ?? 0;
      row.updatedAt = new Date();
      return row;
    },
    groupBy: async ({ where, take }: any) => groupAppSummaries(this.appSummaries.filter((row) => matchesWhere(row, where)), take),
  };

  websiteUsageSummary = {
    upsert: async ({ where, update, create }: any) => {
      const key = where.companyId_userId_date_domain_browserName;
      let row = this.websiteSummaries.find((summary) =>
        summary.companyId === key.companyId
        && summary.userId === key.userId
        && sameDate(summary.date, key.date)
        && summary.domain === key.domain
        && summary.browserName === key.browserName,
      );

      if (!row) {
        row = { id: nextId("web"), ...create };
        this.websiteSummaries.push(row);
        return row;
      }

      row.activeSeconds += update.activeSeconds?.increment ?? 0;
      row.idleSeconds += update.idleSeconds?.increment ?? 0;
      row.updatedAt = new Date();
      return row;
    },
    groupBy: async ({ where, take }: any) => groupWebsiteSummaries(this.websiteSummaries.filter((row) => matchesWhere(row, where)), take),
  };

  user = {
    findFirst: async ({ where, select }: any) => {
      const user = this.users.find((item) => matchesWhere(item, where));
      if (!user) {
        return null;
      }
      return select?.id ? { id: user.id } : user;
    },
    count: async ({ where }: any) => this.users.filter((user) => matchesWhere(user, where)).length,
    groupBy: async ({ where }: any) => {
      const counts = new Map<string, number>();
      for (const user of this.users.filter((item) => matchesWhere(item, where))) {
        const key = `${user.companyId}:${user.role}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts, ([key, count]) => {
        const [companyId, role] = key.split(":");
        return { companyId, role, _count: { _all: count } };
      });
    },
  };

  company = {
    findUnique: async ({ where, select }: any) => {
      if (where.id !== COMPANY_ID) {
        return null;
      }
      return select?.id && Object.keys(select).length === 1 ? { id: COMPANY_ID } : mockCompany();
    },
    findMany: async () => [mockCompany()],
  };

  invitation = {
    count: async () => 0,
  };

  officeMap = {
    findFirst: async () => ({ id: "office-map-id" }),
  };

  monitoringPolicy = {
    count: async () => 1,
  };

  integrationAccount = {
    count: async () => 0,
  };

  virtualOfficePosition = {
    aggregate: async () => ({ _max: { updatedAt: null } }),
  };

  platformAuditLog = {
    create: async ({ data }: any) => {
      this.platformAuditLogs.push(data);
      return data;
    },
    findMany: async () => [],
  };

  async $transaction(operations: Promise<unknown>[]) {
    return Promise.all(operations);
  }

  seedDevice(input: Pick<DeviceRow, "id" | "companyId" | "userId">) {
    this.devices.push(toDeviceRow({
      ...input,
      os: DeviceOS.UNKNOWN,
      hostname: "WM-TEST",
      agentVersion: "test",
      lastSeenAt: new Date(),
    }));
  }
}

type DeviceRow = {
  id: string;
  companyId: string;
  userId: string;
  os: DeviceOS;
  hostname: string | null;
  agentVersion: string | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ActivityEventRow = {
  id: string;
  companyId: string;
  userId: string;
  deviceId: string;
  source: ActivityEventSource;
  eventType: ActivityEventType;
  appName: string | null;
  browserName: BrowserName | null;
  domain: string | null;
  isIdle: boolean;
  isActiveWindow: boolean;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppSummaryRow = {
  id: string;
  companyId: string;
  userId: string;
  date: Date;
  appName: string;
  category: string | null;
  productivityLabel: ProductivityLabel;
  activeSeconds: number;
  idleSeconds: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type WebsiteSummaryRow = {
  id: string;
  companyId: string;
  userId: string;
  date: Date;
  domain: string;
  browserName: BrowserName;
  category: string | null;
  productivityLabel: ProductivityLabel;
  activeSeconds: number;
  idleSeconds: number;
  createdAt?: Date;
  updatedAt?: Date;
};

function toDeviceRow(input: Partial<DeviceRow> & Pick<DeviceRow, "id" | "companyId" | "userId">): DeviceRow {
  return {
    os: DeviceOS.UNKNOWN,
    hostname: null,
    agentVersion: null,
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}

function mockCompany() {
  return {
    id: COMPANY_ID,
    name: "WorkMap Demo Company",
    slug: "workmap-demo-company",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-17T00:00:00.000Z"),
    _count: {
      users: 2,
      devices: 1,
      officeMaps: 1,
      policies: 1,
      integrations: 0,
      invitations: 0,
    },
  };
}

function matchesWhere(row: Record<string, any>, where: Record<string, any> | undefined) {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof Date) {
      return actual instanceof Date && actual.getTime() === expected.getTime();
    }
    if (expected && typeof expected === "object" && "gte" in expected) {
      return actual instanceof Date && actual >= expected.gte;
    }
    if (expected && typeof expected === "object" && "in" in expected) {
      return Array.isArray(expected.in) && expected.in.includes(actual);
    }
    return actual === expected;
  });
}

function groupAppSummaries(rows: AppSummaryRow[], take: number) {
  const grouped = new Map<string, {
    appName: string;
    category: string | null;
    productivityLabel: ProductivityLabel;
    _sum: { activeSeconds: number; idleSeconds: number };
  }>();

  for (const row of rows) {
    const key = `${row.appName}:${row.category ?? ""}:${row.productivityLabel}`;
    const existing = grouped.get(key) ?? {
      appName: row.appName,
      category: row.category,
      productivityLabel: row.productivityLabel,
      _sum: { activeSeconds: 0, idleSeconds: 0 },
    };
    existing._sum.activeSeconds += row.activeSeconds;
    existing._sum.idleSeconds += row.idleSeconds;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right._sum.activeSeconds - left._sum.activeSeconds)
    .slice(0, take);
}

function groupWebsiteSummaries(rows: WebsiteSummaryRow[], take: number) {
  const grouped = new Map<string, {
    domain: string;
    category: string | null;
    productivityLabel: ProductivityLabel;
    _sum: { activeSeconds: number; idleSeconds: number };
  }>();

  for (const row of rows) {
    const key = `${row.domain}:${row.category ?? ""}:${row.productivityLabel}`;
    const existing = grouped.get(key) ?? {
      domain: row.domain,
      category: row.category,
      productivityLabel: row.productivityLabel,
      _sum: { activeSeconds: 0, idleSeconds: 0 },
    };
    existing._sum.activeSeconds += row.activeSeconds;
    existing._sum.idleSeconds += row.idleSeconds;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right._sum.activeSeconds - left._sum.activeSeconds)
    .slice(0, take);
}

function uniqueBy<T>(rows: T[], key: keyof T) {
  const seen = new Set<unknown>();
  return rows.filter((row) => {
    const value = row[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function sameDate(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function maxDate(left: Date | null, right: Date | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}

let idSequence = 0;
function nextId(prefix: string) {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
