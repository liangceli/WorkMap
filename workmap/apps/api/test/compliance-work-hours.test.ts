/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ComplianceService } from "../src/modules/compliance/compliance.service.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const POLICY_ID = "22222222-2222-4222-8222-222222222222";

test("an authorised policy administrator can extend active work hours to 23:00", async () => {
  const prisma = new CompliancePrisma();
  const service = new ComplianceService(prisma as any);

  const result = await service.updatePolicyWorkHours(
    context("OWNER"),
    POLICY_ID,
    { workdayStart: "09:00", workdayEnd: "23:00" },
  );

  assert.equal(result.workdayStart, "09:00");
  assert.equal(result.workdayEnd, "23:00");
  assert.deepEqual(prisma.lastUpdate, {
    workdayStart: "09:00",
    workdayEnd: "23:00",
  });
});

test("employees cannot change monitoring work hours", async () => {
  const service = new ComplianceService(new CompliancePrisma() as any);

  await assert.rejects(
    service.updatePolicyWorkHours(
      context("EMPLOYEE"),
      POLICY_ID,
      { workdayStart: "09:00", workdayEnd: "23:00" },
    ),
    ForbiddenException,
  );
});

test("a policy administrator cannot change another tenant's policy", async () => {
  const service = new ComplianceService(new CompliancePrisma() as any);

  await assert.rejects(
    service.updatePolicyWorkHours(
      {
        ...context("OWNER"),
        companyId: "44444444-4444-4444-8444-444444444444",
      },
      POLICY_ID,
      { workdayStart: "09:00", workdayEnd: "23:00" },
    ),
    NotFoundException,
  );
});

test("a superseded policy cannot be edited through the active work-hours route", async () => {
  const service = new ComplianceService(new CompliancePrisma() as any);

  await assert.rejects(
    service.updatePolicyWorkHours(
      context("OWNER"),
      "55555555-5555-4555-8555-555555555555",
      { workdayStart: "09:00", workdayEnd: "23:00" },
    ),
    NotFoundException,
  );
});

test("work hours reject invalid and overnight ranges", async () => {
  const service = new ComplianceService(new CompliancePrisma() as any);

  await assert.rejects(
    service.updatePolicyWorkHours(
      context("OWNER"),
      POLICY_ID,
      { workdayStart: "09:00", workdayEnd: "09:00" },
    ),
    BadRequestException,
  );
  await assert.rejects(
    service.updatePolicyWorkHours(
      context("OWNER"),
      POLICY_ID,
      { workdayStart: "9am", workdayEnd: "23:00" },
    ),
    BadRequestException,
  );
});

test("an in-place work-hours update cannot narrow an already issued policy lease", async () => {
  const prisma = new CompliancePrisma();
  const service = new ComplianceService(prisma as any);

  await assert.rejects(
    service.updatePolicyWorkHours(
      context("OWNER"),
      POLICY_ID,
      { workdayStart: "10:00", workdayEnd: "17:00" },
    ),
    BadRequestException,
  );
  assert.equal(prisma.lastUpdate, null);
});

function context(role: "OWNER" | "EMPLOYEE") {
  return {
    companyId: COMPANY_ID,
    userId: "33333333-3333-4333-8333-333333333333",
    role,
  } as const;
}

class CompliancePrisma {
  lastUpdate: { workdayStart: string; workdayEnd: string } | null = null;
  private policy = {
    id: POLICY_ID,
    policyVersion: "v1",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "17:00",
    scheduleTimeZone: "Australia/Adelaide",
  };

  monitoringPolicy = {
    findFirst: async (input: { where: { companyId?: string } }) =>
      input.where.companyId === COMPANY_ID
        ? { ...this.policy }
        : null,
    update: async (input: {
      where: { id: string };
      data: { workdayStart: string; workdayEnd: string };
    }) => {
      this.lastUpdate = { ...input.data };
      this.policy = { ...this.policy, ...input.data };
      return { ...this.policy };
    },
  };
}
