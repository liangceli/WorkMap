import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { canManageCompliance, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePolicy(companyId: string) {
    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId,
        activeFrom: {
          lte: new Date(),
        },
      },
      orderBy: {
        activeFrom: "desc",
      },
    });

    if (!policy) {
      throw new NotFoundException("Active monitoring policy not found.");
    }

    return policy;
  }

  async acknowledgePolicy(companyId: string, userId: string, monitoringPolicyId: string) {
    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        id: monitoringPolicyId,
        companyId,
      },
      select: { id: true },
    });

    if (!policy) {
      throw new NotFoundException("Monitoring policy not found.");
    }

    return this.prisma.policyAcknowledgement.upsert({
      where: {
        userId_monitoringPolicyId: {
          userId,
          monitoringPolicyId,
        },
      },
      update: {
        acknowledgedAt: new Date(),
      },
      create: {
        companyId,
        userId,
        monitoringPolicyId,
        acknowledgedAt: new Date(),
      },
    });
  }

  async confirmScheduleTimeZone(
    context: RequestContext,
    monitoringPolicyId: string,
    input: unknown,
  ) {
    if (!canManageCompliance(context)) {
      throw new ForbiddenException(
        "Only an authorised policy administrator can confirm the monitoring time zone.",
      );
    }
    const body =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? input as Record<string, unknown>
        : {};
    const scheduleTimeZone =
      typeof body.scheduleTimeZone === "string"
        ? body.scheduleTimeZone.trim()
        : "";
    if (!scheduleTimeZone || scheduleTimeZone.length > 80) {
      throw new BadRequestException(
        "scheduleTimeZone must be a valid IANA time zone.",
      );
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: scheduleTimeZone }).format();
    } catch {
      throw new BadRequestException(
        "scheduleTimeZone must be a valid IANA time zone.",
      );
    }

    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        id: monitoringPolicyId,
        companyId: context.companyId,
      },
      select: {
        id: true,
        policyVersion: true,
        scheduleTimeZone: true,
      },
    });
    if (!policy) {
      throw new NotFoundException("Monitoring policy not found.");
    }
    if (
      policy.scheduleTimeZone &&
      policy.scheduleTimeZone !== scheduleTimeZone
    ) {
      throw new BadRequestException(
        "This policy already has a confirmed time zone. Create a new policy version to change it.",
      );
    }
    if (policy.scheduleTimeZone === scheduleTimeZone) {
      return policy;
    }
    return this.prisma.monitoringPolicy.update({
      where: { id: policy.id },
      data: { scheduleTimeZone },
      select: {
        id: true,
        policyVersion: true,
        scheduleTimeZone: true,
      },
    });
  }

  async updatePolicyWorkHours(
    context: RequestContext,
    monitoringPolicyId: string,
    input: unknown,
  ) {
    if (!canManageCompliance(context)) {
      throw new ForbiddenException(
        "Only an authorised policy administrator can change monitoring work hours.",
      );
    }
    const body = readBody(input);
    const workdayStart = readClockTime(body.workdayStart, "workdayStart");
    const workdayEnd = readClockTime(body.workdayEnd, "workdayEnd");
    if (clockMinutes(workdayEnd) <= clockMinutes(workdayStart)) {
      throw new BadRequestException(
        "workdayEnd must be later than workdayStart on the same day.",
      );
    }

    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId: context.companyId,
        activeFrom: { lte: new Date() },
      },
      orderBy: { activeFrom: "desc" },
      select: {
        id: true,
        policyVersion: true,
        workHoursOnly: true,
        workdayStart: true,
        workdayEnd: true,
        scheduleTimeZone: true,
      },
    });
    if (!policy || policy.id !== monitoringPolicyId) {
      throw new NotFoundException("Active monitoring policy not found.");
    }
    if (!policy.workHoursOnly) {
      throw new BadRequestException(
        "This policy does not currently restrict collection to work hours.",
      );
    }
    if (
      clockMinutes(workdayStart) > clockMinutes(policy.workdayStart) ||
      clockMinutes(workdayEnd) < clockMinutes(policy.workdayEnd)
    ) {
      throw new BadRequestException(
        "The current policy lease can only be extended. Create a new policy version before narrowing work hours.",
      );
    }
    if (
      policy.workdayStart === workdayStart &&
      policy.workdayEnd === workdayEnd
    ) {
      return policy;
    }

    return this.prisma.monitoringPolicy.update({
      where: { id: policy.id },
      data: { workdayStart, workdayEnd },
      select: {
        id: true,
        policyVersion: true,
        workHoursOnly: true,
        workdayStart: true,
        workdayEnd: true,
        scheduleTimeZone: true,
      },
    });
  }

  async enableOpenRuntimeCollection(
    context: RequestContext,
    monitoringPolicyId: string,
  ) {
    if (!canManageCompliance(context)) {
      throw new ForbiddenException(
        "Only an authorised policy administrator can enable App open/runtime collection.",
      );
    }

    const now = new Date();
    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId: context.companyId,
        activeFrom: { lte: now },
      },
      orderBy: [{ activeFrom: "desc" }, { id: "desc" }],
      select: {
        id: true,
        companyId: true,
        name: true,
        collectAppUsage: true,
        collectOpenRuntime: true,
        collectWebsiteDomain: true,
        collectDomainOpenRuntime: true,
        collectFullUrl: true,
        collectScreenshots: true,
        collectKeystrokes: true,
        workHoursOnly: true,
        workdayStart: true,
        workdayEnd: true,
        scheduleTimeZone: true,
        retentionDays: true,
        employeeCanViewOwnData: true,
        policyVersion: true,
        activeFrom: true,
      },
    });
    if (!policy || policy.id !== monitoringPolicyId) {
      throw new NotFoundException("Active monitoring policy not found.");
    }
    if (!policy.collectAppUsage) {
      throw new BadRequestException(
        "App open/runtime collection requires App usage collection to remain enabled.",
      );
    }
    if (policy.collectOpenRuntime) return policy;

    const versions = await this.prisma.monitoringPolicy.findMany({
      where: { companyId: context.companyId },
      select: { policyVersion: true },
    });
    const policyVersion = nextPolicyVersion(
      versions.map((item) => item.policyVersion),
    );
    return this.prisma.monitoringPolicy.create({
      data: {
        companyId: policy.companyId,
        name: policy.name,
        collectAppUsage: policy.collectAppUsage,
        collectOpenRuntime: true,
        collectWebsiteDomain: policy.collectWebsiteDomain,
        collectDomainOpenRuntime: policy.collectDomainOpenRuntime,
        collectFullUrl: policy.collectFullUrl,
        collectScreenshots: policy.collectScreenshots,
        collectKeystrokes: policy.collectKeystrokes,
        workHoursOnly: policy.workHoursOnly,
        workdayStart: policy.workdayStart,
        workdayEnd: policy.workdayEnd,
        scheduleTimeZone: policy.scheduleTimeZone,
        retentionDays: policy.retentionDays,
        employeeCanViewOwnData: policy.employeeCanViewOwnData,
        policyVersion,
        activeFrom: new Date(
          Math.max(now.getTime(), policy.activeFrom.getTime() + 1),
        ),
      },
    });
  }

  async enableDomainOpenRuntimeCollection(
    context: RequestContext,
    monitoringPolicyId: string,
  ) {
    if (!canManageCompliance(context)) {
      throw new ForbiddenException(
        "Only an authorised policy administrator can enable Browser Domain open/runtime collection.",
      );
    }

    const now = new Date();
    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId: context.companyId,
        activeFrom: { lte: now },
      },
      orderBy: [{ activeFrom: "desc" }, { id: "desc" }],
      select: {
        id: true,
        companyId: true,
        name: true,
        collectAppUsage: true,
        collectOpenRuntime: true,
        collectWebsiteDomain: true,
        collectDomainOpenRuntime: true,
        collectFullUrl: true,
        collectScreenshots: true,
        collectKeystrokes: true,
        workHoursOnly: true,
        workdayStart: true,
        workdayEnd: true,
        scheduleTimeZone: true,
        retentionDays: true,
        employeeCanViewOwnData: true,
        policyVersion: true,
        activeFrom: true,
      },
    });
    if (!policy || policy.id !== monitoringPolicyId) {
      throw new NotFoundException("Active monitoring policy not found.");
    }
    if (!policy.collectWebsiteDomain) {
      throw new BadRequestException(
        "Browser Domain open/runtime collection requires Browser Domain collection to remain enabled.",
      );
    }
    if (policy.collectDomainOpenRuntime) return policy;

    const versions = await this.prisma.monitoringPolicy.findMany({
      where: { companyId: context.companyId },
      select: { policyVersion: true },
    });
    const policyVersion = nextPolicyVersion(
      versions.map((item) => item.policyVersion),
    );
    return this.prisma.monitoringPolicy.create({
      data: {
        companyId: policy.companyId,
        name: policy.name,
        collectAppUsage: policy.collectAppUsage,
        collectOpenRuntime: policy.collectOpenRuntime,
        collectWebsiteDomain: policy.collectWebsiteDomain,
        collectDomainOpenRuntime: true,
        collectFullUrl: policy.collectFullUrl,
        collectScreenshots: policy.collectScreenshots,
        collectKeystrokes: policy.collectKeystrokes,
        workHoursOnly: policy.workHoursOnly,
        workdayStart: policy.workdayStart,
        workdayEnd: policy.workdayEnd,
        scheduleTimeZone: policy.scheduleTimeZone,
        retentionDays: policy.retentionDays,
        employeeCanViewOwnData: policy.employeeCanViewOwnData,
        policyVersion,
        activeFrom: new Date(
          Math.max(now.getTime(), policy.activeFrom.getTime() + 1),
        ),
      },
    });
  }
}

export function nextPolicyVersion(versions: string[]) {
  const highest = versions.reduce((current, version) => {
    const match = /^v(\d+)$/.exec(version.trim());
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  let candidate = Math.max(1, highest + 1);
  const existing = new Set(versions);
  while (existing.has(`v${candidate}`)) candidate += 1;
  return `v${candidate}`;
}

function readBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readClockTime(value: unknown, label: string) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new BadRequestException(`${label} must use 24-hour HH:MM format.`);
  }
  return value;
}

function clockMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}
