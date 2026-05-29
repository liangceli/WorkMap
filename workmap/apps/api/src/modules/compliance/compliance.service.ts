import { Injectable, NotFoundException } from "@nestjs/common";
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
}
