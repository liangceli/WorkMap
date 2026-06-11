import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canViewEmployeeActivity, canViewOwnReports, canViewTeamReports, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type SummaryQuery = {
  userId?: string;
  scope?: string;
};

type ReportScope = "user" | "company";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getUsageSummary(context: RequestContext, query: SummaryQuery) {
    const scope = normalizeReportScope(query.scope);

    if (scope === "company") {
      return this.getCompanyUsageSummary(context);
    }

    const userId = await this.resolveVisibleReportUserId(context, query.userId);

    if (query.userId && query.userId !== context.userId && userId === query.userId) {
      await this.audit.logSensitiveAction({
        companyId: context.companyId,
        actorUserId: context.userId,
        targetUserId: query.userId,
        action: "REPORT_USER_SUMMARY_VIEWED",
        resourceType: "User",
        resourceId: query.userId,
        metadata: { source: "api.reports.getUsageSummary" },
      });
    }

    const [summary, deviceCoverage] = await Promise.all([
      this.getUsageRows({ companyId: context.companyId, userId }),
      this.getDeviceCoverage(context.companyId, userId),
    ]);

    return {
      scope: "user" satisfies ReportScope,
      userId,
      ...summary,
      deviceCoverage,
    };
  }

  private async getCompanyUsageSummary(context: RequestContext) {
    if (!canViewTeamReports(context)) {
      throw new ForbiddenException("Company reports are not visible to this role.");
    }

    await this.audit.logSensitiveAction({
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "REPORT_COMPANY_SUMMARY_VIEWED",
      resourceType: "Company",
      resourceId: context.companyId,
      metadata: { source: "api.reports.getUsageSummary", scope: "company" },
    });

    const [summary, deviceCoverage] = await Promise.all([
      this.getUsageRows({ companyId: context.companyId }),
      this.getDeviceCoverage(context.companyId),
    ]);

    return {
      scope: "company" satisfies ReportScope,
      userId: null,
      ...summary,
      deviceCoverage,
    };
  }

  private async getUsageRows(filter: { companyId: string; userId?: string }) {
    const where = {
      companyId: filter.companyId,
      ...(filter.userId ? { userId: filter.userId } : {}),
    };
    const [appRows, websiteRows] = await Promise.all([
      this.prisma.appUsageSummary.groupBy({
        by: ["appName", "category", "productivityLabel"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
        take: 10,
      }),
      this.prisma.websiteUsageSummary.groupBy({
        by: ["domain", "category", "productivityLabel"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
        take: 10,
      }),
    ]);

    return {
      apps: appRows.map((row) => ({
        appName: row.appName,
        category: row.category,
        productivityLabel: row.productivityLabel,
        activeSeconds: row._sum.activeSeconds ?? 0,
        idleSeconds: row._sum.idleSeconds ?? 0,
      })),
      websites: websiteRows.map((row) => ({
        domain: row.domain,
        category: row.category,
        productivityLabel: row.productivityLabel,
        activeSeconds: row._sum.activeSeconds ?? 0,
        idleSeconds: row._sum.idleSeconds ?? 0,
      })),
    };
  }

  private async getDeviceCoverage(companyId: string, userId?: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where = {
      companyId,
      ...(userId ? { userId } : {}),
    };

    const [registeredDevices, activeDevices24h, usersWithActivity] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.count({ where: { ...where, lastSeenAt: { gte: oneDayAgo } } }),
      this.prisma.activityEvent.groupBy({
        by: ["userId"],
        where,
      }),
    ]);

    return {
      registeredDevices,
      activeDevices24h,
      usersWithActivity: usersWithActivity.length,
    };
  }

  private async resolveVisibleReportUserId(context: RequestContext, requestedUserId?: string) {
    const userId = requestedUserId ?? context.userId;

    if (userId === context.userId) {
      if (!canViewOwnReports(context)) {
        throw new ForbiddenException("Reports are not visible to this role.");
      }

      return userId;
    }

    if (!canViewEmployeeActivity(context, userId)) {
      throw new ForbiddenException("Employee activity is not visible to this role.");
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: context.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!target) {
      throw new NotFoundException("Report target not found.");
    }

    return target.id;
  }
}

function normalizeReportScope(scope: string | undefined): ReportScope {
  return scope === "company" ? "company" : "user";
}
