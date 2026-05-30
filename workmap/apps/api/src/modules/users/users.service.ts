import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canViewEmployeeActivity, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { toApiStatus } from "../common/enum-mappers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCurrentUser(context: RequestContext) {
    return this.getUserProfile(context, context.userId);
  }

  async listDirectory(context: RequestContext) {
    const users = await this.prisma.user.findMany({
      where: { companyId: context.companyId },
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ displayName: "asc" }],
    });

    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: toApiStatus(user.status),
      avatarId: user.avatarId,
      jobTitle: user.jobTitle,
      department: user.department,
    }));
  }

  async getUserProfile(context: RequestContext, userId: string) {
    const includeSensitive = canViewEmployeeActivity(context, userId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: context.companyId,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (!includeSensitive) {
      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        status: toApiStatus(user.status),
        avatarId: user.avatarId,
        jobTitle: user.jobTitle,
        department: user.department,
        contactOnly: true,
      };
    }

    if (context.userId !== userId) {
      await this.audit.logSensitiveAction({
        companyId: context.companyId,
        actorUserId: context.userId,
        targetUserId: userId,
        action: "EMPLOYEE_DETAIL_VIEWED",
        resourceType: "User",
        resourceId: userId,
        metadata: { source: "api.users.getUserProfile" },
      });
    }

    const [apps, websites] = await Promise.all([
      this.prisma.appUsageSummary.findMany({
        where: { companyId: context.companyId, userId },
        orderBy: [{ date: "desc" }, { activeSeconds: "desc" }],
        take: 5,
      }),
      this.prisma.websiteUsageSummary.findMany({
        where: { companyId: context.companyId, userId },
        orderBy: [{ date: "desc" }, { activeSeconds: "desc" }],
        take: 5,
      }),
    ]);

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: toApiStatus(user.status),
      avatarId: user.avatarId,
      jobTitle: user.jobTitle,
      department: user.department,
      appUsage: apps.map((item) => ({
        appName: item.appName,
        category: item.category,
        productivityLabel: item.productivityLabel,
        activeSeconds: item.activeSeconds,
        idleSeconds: item.idleSeconds,
        date: item.date.toISOString().slice(0, 10),
      })),
      websiteUsage: websites.map((item) => ({
        domain: item.domain,
        browserName: item.browserName,
        category: item.category,
        productivityLabel: item.productivityLabel,
        activeSeconds: item.activeSeconds,
        idleSeconds: item.idleSeconds,
        date: item.date.toISOString().slice(0, 10),
      })),
    };
  }

  assertCanViewActivity(context: RequestContext, userId: string) {
    if (!canViewEmployeeActivity(context, userId)) {
      throw new ForbiddenException("Employee activity is not visible to this role.");
    }
  }
}
