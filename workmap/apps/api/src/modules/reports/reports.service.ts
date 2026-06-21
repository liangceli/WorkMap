import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canViewEmployeeActivity, canViewOwnReports, canViewTeamReports, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type SummaryQuery = {
  userId?: string;
  departmentId?: string;
  scope?: string;
  from?: string;
  to?: string;
};

type ReportScope = "user" | "company";
type ReportRange = { from: Date; to: Date; fromDate: string; toDate: string };
type UsageFilter = { companyId: string; userId?: string; userIds?: string[]; range: ReportRange };

const DEFAULT_REPORT_DAYS = 30;
const MAX_REPORT_DAYS = 366;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getUsageSummary(context: RequestContext, query: SummaryQuery) {
    const scope = normalizeReportScope(query.scope);
    const range = parseReportRange(query.from, query.to);

    if (scope === "company") {
      if (query.userId) throw new BadRequestException("userId cannot be combined with company scope.");
      return this.getCompanyUsageSummary(context, query.departmentId, range);
    }

    if (query.departmentId) throw new BadRequestException("departmentId is available only for company scope.");
    const userId = await this.resolveVisibleReportUserId(context, query.userId);

    if (query.userId && query.userId !== context.userId) {
      await this.audit.logSensitiveAction({
        companyId: context.companyId,
        actorUserId: context.userId,
        targetUserId: query.userId,
        action: "REPORT_USER_SUMMARY_VIEWED",
        resourceType: "User",
        resourceId: query.userId,
        metadata: { source: "api.reports.getUsageSummary", from: range.fromDate, to: range.toDate },
      });
    }

    const filter = { companyId: context.companyId, userId, range };
    const [summary, deviceCoverage] = await Promise.all([
      this.getUsageRows(filter),
      this.getDeviceCoverage(filter),
    ]);

    return {
      scope: "user" satisfies ReportScope,
      userId,
      departmentId: null,
      range: reportRangeResponse(range),
      ...summary,
      deviceCoverage,
    };
  }

  private async getCompanyUsageSummary(context: RequestContext, departmentId: string | undefined, range: ReportRange) {
    if (!canViewTeamReports(context)) {
      throw new ForbiddenException("Company reports are not visible to this role.");
    }

    const userIds = departmentId ? await this.resolveDepartmentUserIds(context.companyId, departmentId) : undefined;
    await this.audit.logSensitiveAction({
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "REPORT_COMPANY_SUMMARY_VIEWED",
      resourceType: departmentId ? "Department" : "Company",
      resourceId: departmentId ?? context.companyId,
      metadata: {
        source: "api.reports.getUsageSummary",
        scope: "company",
        departmentId: departmentId ?? null,
        from: range.fromDate,
        to: range.toDate,
      },
    });

    const filter = { companyId: context.companyId, userIds, range };
    const [summary, deviceCoverage] = await Promise.all([
      this.getUsageRows(filter),
      this.getDeviceCoverage(filter),
    ]);

    return {
      scope: "company" satisfies ReportScope,
      userId: null,
      departmentId: departmentId ?? null,
      range: reportRangeResponse(range),
      ...summary,
      deviceCoverage,
    };
  }

  private async getUsageRows(filter: UsageFilter) {
    const where = summaryWhere(filter);
    const [appRows, websiteRows, appDailyRows, websiteDailyRows] = await Promise.all([
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
      this.prisma.appUsageSummary.groupBy({
        by: ["date"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { date: "asc" },
      }),
      this.prisma.websiteUsageSummary.groupBy({
        by: ["date"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const daily = new Map<string, {
      date: string;
      appActiveSeconds: number;
      appIdleSeconds: number;
      domainActiveSeconds: number;
      domainIdleSeconds: number;
    }>();
    for (const row of appDailyRows) {
      const date = toDateOnly(row.date);
      daily.set(date, {
        date,
        appActiveSeconds: row._sum?.activeSeconds ?? 0,
        appIdleSeconds: row._sum?.idleSeconds ?? 0,
        domainActiveSeconds: 0,
        domainIdleSeconds: 0,
      });
    }
    for (const row of websiteDailyRows) {
      const date = toDateOnly(row.date);
      const item = daily.get(date) ?? {
        date,
        appActiveSeconds: 0,
        appIdleSeconds: 0,
        domainActiveSeconds: 0,
        domainIdleSeconds: 0,
      };
      item.domainActiveSeconds = row._sum?.activeSeconds ?? 0;
      item.domainIdleSeconds = row._sum?.idleSeconds ?? 0;
      daily.set(date, item);
    }

    return {
      apps: appRows.map((row) => ({
        appName: row.appName,
        category: row.category,
        productivityLabel: effectiveProductivityLabel(row.productivityLabel, row.category),
        activeSeconds: row._sum.activeSeconds ?? 0,
        idleSeconds: row._sum.idleSeconds ?? 0,
      })),
      websites: websiteRows.map((row) => ({
        domain: row.domain,
        category: row.category,
        productivityLabel: effectiveProductivityLabel(row.productivityLabel, row.category),
        activeSeconds: row._sum.activeSeconds ?? 0,
        idleSeconds: row._sum.idleSeconds ?? 0,
      })),
      daily: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
    };
  }

  private async getDeviceCoverage(filter: UsageFilter) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const identityWhere = identityFilter(filter);
    const eventEndExclusive = addUtcDays(filter.range.to, 1);
    const [registeredDevices, activeDevices24h, usersWithActivity] = await Promise.all([
      this.prisma.device.count({ where: { companyId: filter.companyId, ...identityWhere, revokedAt: null } }),
      this.prisma.device.count({ where: { companyId: filter.companyId, ...identityWhere, revokedAt: null, lastSeenAt: { gte: oneDayAgo } } }),
      this.prisma.activityEvent.groupBy({
        by: ["userId"],
        where: {
          companyId: filter.companyId,
          ...identityWhere,
          startedAt: { gte: filter.range.from, lt: eventEndExclusive },
        },
      }),
    ]);

    return { registeredDevices, activeDevices24h, usersWithActivity: usersWithActivity.length };
  }

  private async resolveDepartmentUserIds(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException("Report department not found.");

    const users = await this.prisma.user.findMany({
      where: { companyId, departmentId },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async resolveVisibleReportUserId(context: RequestContext, requestedUserId?: string) {
    const userId = requestedUserId ?? context.userId;
    if (userId === context.userId) {
      if (!canViewOwnReports(context)) throw new ForbiddenException("Reports are not visible to this role.");
      return userId;
    }
    if (!canViewEmployeeActivity(context, userId)) {
      throw new ForbiddenException("Employee activity is not visible to this role.");
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, companyId: context.companyId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("Report target not found.");
    return target.id;
  }
}

function normalizeReportScope(scope: string | undefined): ReportScope {
  return scope === "company" ? "company" : "user";
}

function parseReportRange(fromInput?: string, toInput?: string): ReportRange {
  const today = utcDateOnly(new Date());
  const to = toInput ? parseDateOnly(toInput, "to") : today;
  if (to > today) throw new BadRequestException("Report to date cannot be in the future.");
  const from = fromInput ? parseDateOnly(fromInput, "from") : addUtcDays(to, -(DEFAULT_REPORT_DAYS - 1));
  if (from > to) throw new BadRequestException("Report from date must be on or before to date.");
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > MAX_REPORT_DAYS) throw new BadRequestException(`Report range cannot exceed ${MAX_REPORT_DAYS} days.`);
  return { from, to, fromDate: toDateOnly(from), toDate: toDateOnly(to) };
}

function parseDateOnly(value: string, label: string) {
  if (!DATE_ONLY_PATTERN.test(value)) throw new BadRequestException(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDateOnly(date) !== value) throw new BadRequestException(`${label} must be a valid date.`);
  return date;
}

function summaryWhere(filter: UsageFilter) {
  return {
    companyId: filter.companyId,
    ...identityFilter(filter),
    date: { gte: filter.range.from, lte: filter.range.to },
  };
}

function identityFilter(filter: Pick<UsageFilter, "userId" | "userIds">) {
  if (filter.userId) return { userId: filter.userId };
  if (filter.userIds) return { userId: { in: filter.userIds } };
  return {};
}

function reportRangeResponse(range: ReportRange) {
  return { from: range.fromDate, to: range.toDate, timeZone: "UTC" as const };
}

function effectiveProductivityLabel(label: string, category: string | null) {
  return label === "UNCATEGORISED" && category ? "PRODUCTIVE" : label;
}

function utcDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
