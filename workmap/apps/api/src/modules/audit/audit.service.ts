import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

type AuditLogInput = {
  companyId: string;
  actorUserId?: string;
  targetUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logSensitiveAction(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata,
      },
    });
  }
}
