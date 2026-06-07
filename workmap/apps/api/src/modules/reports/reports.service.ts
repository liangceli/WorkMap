import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canViewEmployeeActivity, canViewOwnReports, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type SummaryQuery = {
  userId?: string;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getUsageSummary(context: RequestContext, query: SummaryQuery) {
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

    const [appRows, websiteRows] = await Promise.all([
      this.prisma.appUsageSummary.groupBy({
        by: ["appName", "category", "productivityLabel"],
        where: { companyId: context.companyId, userId },
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
        take: 10,
      }),
      this.prisma.websiteUsageSummary.groupBy({
        by: ["domain", "category", "productivityLabel"],
        where: { companyId: context.companyId, userId },
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
        take: 10,
      }),
    ]);

    return {
      userId,
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
