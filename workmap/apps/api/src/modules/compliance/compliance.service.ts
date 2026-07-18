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
}
