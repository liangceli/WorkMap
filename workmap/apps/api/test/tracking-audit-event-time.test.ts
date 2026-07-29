import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@workmap/auth";
import { ReportsService } from "../src/modules/reports/reports.service.js";

test("Connection Audit queries lifecycle event time instead of delayed receipt time", async () => {
  let deviceStatusWhere: Record<string, unknown> | null = null;
  const prisma = {
    agentSession: {
      findMany: async () => [],
    },
    deviceStatusEvent: {
      findMany: async (query: { where: Record<string, unknown> }) => {
        deviceStatusWhere = query.where;
        return [];
      },
    },
    activityEvent: {
      findMany: async () => [],
    },
  };
  const context: RequestContext = {
    companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "11111111-1111-4111-8111-111111111111",
    role: "EMPLOYEE",
  };
  const reports = new ReportsService(prisma as never, {} as never);

  await reports.getTrackingAudit(context, {
    scope: "user",
    from: "2026-07-01",
    to: "2026-07-02",
  });

  assert(deviceStatusWhere);
  assert.deepEqual(deviceStatusWhere.startedAt, {
    gte: new Date("2026-07-01T00:00:00.000Z"),
    lt: new Date("2026-07-03T00:00:00.000Z"),
  });
  assert.equal(deviceStatusWhere.recordedAt, undefined);
});
