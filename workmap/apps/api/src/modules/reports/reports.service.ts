import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ActivityEventSource,
  ActivityEventType,
  AgentSessionEndReason,
  DeviceClientType,
  DeviceStatus,
  DeviceStatusConfidence,
  DeviceStatusReason,
} from "@prisma/client";
import { canViewEmployeeActivity, canViewOwnReports, canViewTeamReports, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS } from "../devices/devices.service.js";
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
type LiveAppSegment = { userId: string; displayName: string; appName: string; activeSeconds: number; focusedIdleSeconds: number };
type UsageInterval = { startedAt: Date; endedAt: Date };
type DomainMetricTotals = { focusActiveSeconds: number; focusedIdleSeconds: number; openRuntimeSeconds: number };
type AgentSessionReportRow = {
  id: string;
  clientSessionId: string | null;
  startedAt: Date;
  lastHeartbeatAt: Date;
  endedAt: Date | null;
  endReason: AgentSessionEndReason | null;
};
type DeviceStatusReportRow = {
  id: string;
  deviceId: string;
  agentSessionId: string | null;
  status: DeviceStatus;
  reason: DeviceStatusReason;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string | null;
  recordedAt: string;
  receivedAt: string;
  source: DeviceClientType;
  timeZone: string | null;
  confidence: DeviceStatusConfidence;
};
type ReportedAgentState =
  | "not_paired"
  | "running"
  | "stopped_by_user"
  | "network_offline"
  | "device_shutdown"
  | "sleeping"
  | "locked"
  | "agent_crashed"
  | "agent_terminated"
  | "server_unreachable"
  | "unknown_interrupted";

const DEFAULT_REPORT_DAYS = 30;
const MAX_REPORT_DAYS = 366;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AGENT_HEARTBEAT_FRESH_MS = 30_000;
const BROWSER_CURRENT_DOMAIN_FRESH_MS = 45_000;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

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
    const [summary, deviceCoverage, browserExtensionCoverage, agentStatus, agentSessions, deviceStatusHistory, appTimeline, activityRevision] = await Promise.all([
      this.getUsageRows(filter),
      this.getDeviceCoverage(filter),
      this.getBrowserExtensionCoverage(filter),
      this.getAgentStatus(filter),
      this.getAgentSessions(filter),
      this.getDeviceStatusHistory(filter),
      this.getAppTimeline(filter),
      this.getActivityRevision(filter),
    ]);

    return {
      scope: "user" satisfies ReportScope,
      userId,
      departmentId: null,
      range: reportRangeResponse(range),
      ...summary,
      deviceCoverage,
      browserExtensionCoverage,
      agentStatus,
      agentSessions,
      deviceStatusHistory,
      appTimeline,
      employeeUsage: [],
      activityRevision,
    };
  }

  async getAgentLiveStatus(context: RequestContext, query: SummaryQuery) {
    const scope = normalizeReportScope(query.scope);
    const range = parseReportRange(query.from, query.to);
    if (scope === "company") {
      if (query.userId) throw new BadRequestException("userId cannot be combined with company scope.");
      if (!canViewTeamReports(context)) throw new ForbiddenException("Company reports are not visible to this role.");
      const userIds = query.departmentId
        ? await this.resolveDepartmentUserIds(context.companyId, query.departmentId)
        : undefined;
      const filter = { companyId: context.companyId, userIds, range };
      const [segments, browserExtensionCoverage, activityRevision] = await Promise.all([
        this.getLiveAppSegments(filter),
        this.getBrowserExtensionCoverage(filter),
        this.getActivityRevision(filter),
      ]);
      return {
        scope: "company" as const,
        userId: null,
        departmentId: query.departmentId ?? null,
        apps: aggregateLiveApps(segments),
        employeeUsage: aggregateLiveEmployees(segments),
        browserExtensionCoverage,
        activityRevision,
      };
    }

    if (query.departmentId) throw new BadRequestException("departmentId is available only for company scope.");
    const userId = await this.resolveVisibleReportUserId(context, query.userId);
    const filter = { companyId: context.companyId, userId, range };
    const [agentStatus, browserExtensionCoverage, activityRevision] = await Promise.all([
      this.getAgentStatus(filter),
      this.getBrowserExtensionCoverage(filter),
      this.getActivityRevision(filter),
    ]);
    return {
      scope: "user" as const,
      userId,
      departmentId: null,
      agentStatus,
      browserExtensionCoverage,
      activityRevision,
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
    const [summary, deviceCoverage, browserExtensionCoverage, employeeUsage, activityRevision] = await Promise.all([
      this.getUsageRows(filter),
      this.getDeviceCoverage(filter),
      this.getBrowserExtensionCoverage(filter),
      this.getEmployeeUsage(filter),
      this.getActivityRevision(filter),
    ]);

    return {
      scope: "company" satisfies ReportScope,
      userId: null,
      departmentId: departmentId ?? null,
      range: reportRangeResponse(range),
      ...summary,
      deviceCoverage,
      browserExtensionCoverage,
      agentStatus: null,
      agentSessions: [],
      deviceStatusHistory: [],
      appTimeline: [],
      employeeUsage,
      activityRevision,
    };
  }

  private async getUsageRows(filter: UsageFilter) {
    const where = summaryWhere(filter);
    const [appRows, websiteRows, appDailyRows, appRuntimeRows, domainMetrics] = await Promise.all([
      this.prisma.appUsageSummary.groupBy({
        by: ["appName", "category", "productivityLabel"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
      }),
      this.prisma.websiteUsageSummary.groupBy({
        by: ["domain", "category", "productivityLabel"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
      }),
      this.prisma.appUsageSummary.groupBy({
        by: ["date"],
        where,
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { date: "asc" },
      }),
      this.getOpenRuntimeRows(filter),
      this.getDomainMetricRows(filter),
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
    for (const row of domainMetrics.daily) {
      const date = row.date;
      const item = daily.get(date) ?? {
        date,
        appActiveSeconds: 0,
        appIdleSeconds: 0,
        domainActiveSeconds: 0,
        domainIdleSeconds: 0,
      };
      item.domainActiveSeconds = row.activeSeconds;
      item.domainIdleSeconds = row.idleSeconds;
      daily.set(date, item);
    }

    const runtimeByApp = new Map<string, number>();
    for (const row of appRuntimeRows) {
      if (row.appName) runtimeByApp.set(row.appName, row.openRuntimeSeconds);
    }
    const apps = appRows.map((row) => {
      const focusActiveSeconds = row._sum.activeSeconds ?? 0;
      const focusedIdleSeconds = row._sum.idleSeconds ?? 0;
      return {
        appName: row.appName,
        category: row.category,
        productivityLabel: effectiveProductivityLabel(row.productivityLabel, row.category),
        activeSeconds: focusActiveSeconds,
        idleSeconds: focusedIdleSeconds,
        focusActiveSeconds,
        focusedIdleSeconds,
        openRuntimeSeconds: Math.max(runtimeByApp.get(row.appName) ?? 0, focusActiveSeconds + focusedIdleSeconds),
      };
    });
    const seenApps = new Set(apps.map((row) => row.appName));
    for (const row of appRuntimeRows) {
      if (!row.appName || seenApps.has(row.appName)) continue;
      apps.push({
        appName: row.appName,
        category: null,
        productivityLabel: "UNCATEGORISED",
        activeSeconds: 0,
        idleSeconds: 0,
        focusActiveSeconds: 0,
        focusedIdleSeconds: 0,
        openRuntimeSeconds: row.openRuntimeSeconds,
      });
    }
    apps.sort((left, right) =>
      right.focusActiveSeconds - left.focusActiveSeconds
      || right.openRuntimeSeconds - left.openRuntimeSeconds
      || left.appName.localeCompare(right.appName),
    );

    const websiteMetadata = new Map(websiteRows.map((row) => [row.domain, row]));
    const websites = Array.from(new Set([...websiteMetadata.keys(), ...domainMetrics.byDomain.keys()]), (domain) => {
      const metadata = websiteMetadata.get(domain);
      const metrics = domainMetrics.byDomain.get(domain);
      const focusActiveSeconds = metrics?.focusActiveSeconds ?? metadata?._sum.activeSeconds ?? 0;
      const focusedIdleSeconds = metrics?.focusedIdleSeconds ?? metadata?._sum.idleSeconds ?? 0;
      return {
        domain,
        category: metadata?.category ?? null,
        productivityLabel: effectiveProductivityLabel(metadata?.productivityLabel ?? "UNCATEGORISED", metadata?.category ?? null),
        activeSeconds: focusActiveSeconds,
        idleSeconds: focusedIdleSeconds,
        focusActiveSeconds,
        focusedIdleSeconds,
        openRuntimeSeconds: Math.max(metrics?.openRuntimeSeconds ?? 0, focusActiveSeconds + focusedIdleSeconds),
      };
    }).sort((left, right) =>
      right.focusActiveSeconds - left.focusActiveSeconds
      || right.openRuntimeSeconds - left.openRuntimeSeconds
      || left.domain.localeCompare(right.domain));

    return {
      apps,
      websites,
      daily: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
    };
  }

  private async getDomainMetricRows(filter: UsageFilter) {
    const events = await this.prisma.activityEvent.findMany({
      where: {
        companyId: filter.companyId,
        ...identityFilter(filter),
        source: ActivityEventSource.BROWSER_EXTENSION,
        eventType: ActivityEventType.BROWSER,
        domain: { not: null },
        endedAt: { not: null },
        startedAt: { gte: filter.range.from, lt: addUtcDays(filter.range.to, 1) },
      },
      select: {
        domain: true,
        isIdle: true,
        isActiveWindow: true,
        startedAt: true,
        endedAt: true,
      },
    });
    return summarizeDomainIntervals(events.flatMap((event) => event.domain && event.endedAt ? [{
      domain: event.domain,
      isIdle: event.isIdle,
      isActiveWindow: event.isActiveWindow,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
    }] : []));
  }

  private async getOpenRuntimeRows(filter: UsageFilter) {
    const rows = await this.prisma.activityEvent.groupBy({
      by: ["appName"],
      where: {
        companyId: filter.companyId,
        ...identityFilter(filter),
        source: ActivityEventSource.DESKTOP_AGENT,
        eventType: ActivityEventType.APP,
        appName: { not: null },
        isActiveWindow: false,
        isIdle: false,
        startedAt: { gte: filter.range.from, lt: addUtcDays(filter.range.to, 1) },
      },
      _sum: { durationSeconds: true },
      orderBy: { _sum: { durationSeconds: "desc" } },
    });
    return rows.map((row) => ({
      appName: row.appName,
      openRuntimeSeconds: row._sum.durationSeconds ?? 0,
    }));
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

  private async getBrowserExtensionCoverage(filter: UsageFilter) {
    const devices = await this.prisma.device.findMany({
      where: { companyId: filter.companyId, ...identityFilter(filter), revokedAt: null },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" },
    });
    const extensionDevices = devices.filter((device) => device.agentVersion?.startsWith("browser-extension-mv3/") === true);
    if (extensionDevices.length === 0) return [];
    const now = Date.now();
    const deviceIds = extensionDevices.map((device) => device.id);
    const [outages, recentFocusedDomains] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: {
          companyId: filter.companyId,
          source: ActivityEventSource.BROWSER_EXTENSION,
          eventType: ActivityEventType.HEARTBEAT,
          deviceId: { in: deviceIds },
        },
        orderBy: { endedAt: "desc" },
        select: { deviceId: true, startedAt: true, endedAt: true },
      }),
      this.getRecentFocusedDomains(filter.companyId, deviceIds, new Date(now - BROWSER_CURRENT_DOMAIN_FRESH_MS)),
    ]);
    const latestOutageByDevice = new Map<string, typeof outages[number]>();
    for (const outage of outages) if (!latestOutageByDevice.has(outage.deviceId)) latestOutageByDevice.set(outage.deviceId, outage);
    const latestFocusedDomainByDevice = new Map<string, typeof recentFocusedDomains[number]>();
    for (const event of recentFocusedDomains) {
      const existing = latestFocusedDomainByDevice.get(event.deviceId);
      if (!existing || (event.endedAt?.getTime() ?? 0) > (existing.endedAt?.getTime() ?? 0)) {
        latestFocusedDomainByDevice.set(event.deviceId, event);
      }
    }
    return extensionDevices.map((device) => {
      const outage = latestOutageByDevice.get(device.id);
      const focusedDomain = latestFocusedDomainByDevice.get(device.id);
      const lastSignalAt = device.lastSeenAt;
      const connected = Boolean(lastSignalAt && now - lastSignalAt.getTime() <= BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS);
      return {
        deviceId: device.id,
        userId: device.userId,
        displayName: device.user.displayName,
        browserName: device.hostname === "EDGE" ? "EDGE" : device.hostname === "CHROME" ? "CHROME" : "UNKNOWN",
        version: device.agentVersion,
        state: connected ? "connected" as const : "signal_lost" as const,
        enabledAt: device.createdAt.toISOString(),
        lastSignalAt: lastSignalAt?.toISOString() ?? null,
        currentDomain: connected ? focusedDomain?.domain ?? null : null,
        currentDomainObservedAt: connected ? focusedDomain?.endedAt?.toISOString() ?? null : null,
        coverageLostDetectedAt: connected
          ? outage?.startedAt.toISOString() ?? null
          : lastSignalAt ? new Date(lastSignalAt.getTime() + BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS).toISOString() : device.createdAt.toISOString(),
        coverageRestoredAt: outage?.endedAt?.toISOString() ?? null,
      };
    });
  }

  private async getRecentFocusedDomains(companyId: string, deviceIds: string[], observedSince: Date) {
    try {
      return await this.prisma.activityEvent.findMany({
        where: {
          companyId,
          source: ActivityEventSource.BROWSER_EXTENSION,
          eventType: ActivityEventType.BROWSER,
          deviceId: { in: deviceIds },
          domain: { not: null },
          isIdle: false,
          isActiveWindow: true,
          endedAt: { gte: observedSince },
        },
        orderBy: { endedAt: "desc" },
        select: { deviceId: true, domain: true, endedAt: true },
      });
    } catch (error) {
      this.logger.warn(`Current Browser Domain lookup failed; returning coverage without live domain (${reportQueryErrorCode(error)}).`);
      return [];
    }
  }

  private async getAgentStatus(filter: Pick<UsageFilter, "companyId" | "userId">) {
    if (!filter.userId) return null;
    const session = await this.prisma.agentSession.findFirst({
      where: { companyId: filter.companyId, userId: filter.userId },
      include: { device: { select: { hostname: true, agentVersion: true } } },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return { state: "not_paired" as const };

    const now = Date.now();
    const heartbeatAgeMs = now - session.lastHeartbeatAt.getTime();
    const isFresh = !session.endedAt && heartbeatAgeMs <= AGENT_HEARTBEAT_FRESH_MS;
    const latestStatusEvent = await this.prisma.deviceStatusEvent.findFirst({
      where: {
        companyId: filter.companyId,
        userId: filter.userId,
        deviceId: session.deviceId,
        source: DeviceClientType.DESKTOP_AGENT,
      },
      orderBy: { recordedAt: "desc" },
    });
    const state = resolveReportedAgentState(session, latestStatusEvent, isFresh);
    const currentAppDurationSeconds = isFresh && session.currentAppName && session.currentAppStartedAt
      ? Math.max(0, Math.round((Math.min(now, session.lastHeartbeatAt.getTime() + 15_000) - session.currentAppStartedAt.getTime()) / 1000))
      : 0;
    const currentAppActiveSeconds = !session.currentAppIsIdle ? currentAppDurationSeconds : 0;
    const currentAppFocusedIdleSeconds = session.currentAppIsIdle ? currentAppDurationSeconds : 0;
    const today = utcDateOnly(new Date());
    const todaySummary = await this.prisma.appUsageSummary.aggregate({
      where: { companyId: filter.companyId, userId: filter.userId, date: today },
      _sum: { activeSeconds: true },
    });

    return {
      state,
      sessionId: session.id,
      deviceId: session.deviceId,
      hostname: session.device.hostname,
      agentVersion: session.agentVersion ?? session.device.agentVersion,
      startedAt: session.startedAt.toISOString(),
      lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
      heartbeatAgeSeconds: Math.max(0, Math.round(heartbeatAgeMs / 1000)),
      isFresh,
      endedAt: session.endedAt?.toISOString() ?? null,
      endReason: session.endReason,
      statusReason: latestStatusEvent?.reason ?? null,
      statusConfidence: latestStatusEvent?.confidence ?? null,
      statusRecordedAt: latestStatusEvent?.recordedAt.toISOString() ?? null,
      currentAppName: isFresh ? session.currentAppName : null,
      currentAppStartedAt: isFresh ? session.currentAppStartedAt?.toISOString() ?? null : null,
      currentAppActiveSeconds,
      currentAppFocusedIdleSeconds,
      todayActiveSeconds: (todaySummary._sum.activeSeconds ?? 0) + currentAppActiveSeconds,
    };
  }

  private async getLiveAppSegments(filter: UsageFilter): Promise<LiveAppSegment[]> {
    const now = Date.now();
    const rangeEndExclusive = addUtcDays(filter.range.to, 1).getTime();
    if (now < filter.range.from.getTime() || now >= rangeEndExclusive) return [];

    const sessions = await this.prisma.agentSession.findMany({
      where: {
        companyId: filter.companyId,
        ...identityFilter(filter),
        endedAt: null,
        lastHeartbeatAt: { gte: new Date(now - 30_000) },
        currentAppName: { not: null },
        currentAppStartedAt: { not: null },
      },
      include: { user: { select: { displayName: true } } },
    });

    return sessions.flatMap((session) => {
      if (!session.currentAppName || !session.currentAppStartedAt) return [];
      const segmentStart = Math.max(session.currentAppStartedAt.getTime(), filter.range.from.getTime());
      const segmentEnd = Math.min(now, session.lastHeartbeatAt.getTime() + 15_000, rangeEndExclusive);
      const durationSeconds = Math.max(0, Math.round((segmentEnd - segmentStart) / 1000));
      if (durationSeconds < 5) return [];
      return [{
        userId: session.userId,
        displayName: session.user.displayName,
        appName: session.currentAppName,
        activeSeconds: session.currentAppIsIdle ? 0 : durationSeconds,
        focusedIdleSeconds: session.currentAppIsIdle ? durationSeconds : 0,
      }];
    });
  }

  private async getActivityRevision(filter: UsageFilter) {
    const [activity, status] = await Promise.all([
      this.prisma.activityEvent.aggregate({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          eventType: { in: [ActivityEventType.APP, ActivityEventType.BROWSER] },
          startedAt: { gte: filter.range.from, lt: addUtcDays(filter.range.to, 1) },
        },
        _max: { createdAt: true },
      }),
      this.prisma.deviceStatusEvent.aggregate({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          recordedAt: { gte: filter.range.from, lt: addUtcDays(filter.range.to, 1) },
        },
        _max: { receivedAt: true },
      }),
    ]);
    const latest = [activity._max.createdAt, status._max.receivedAt]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0];
    return latest?.toISOString() ?? null;
  }

  private async getAgentSessions(filter: UsageFilter) {
    if (!filter.userId) return [];
    const endExclusive = addUtcDays(filter.range.to, 1);
    const sessions = await this.prisma.agentSession.findMany({
      where: {
        companyId: filter.companyId,
        userId: filter.userId,
        startedAt: { lt: endExclusive },
        OR: [{ endedAt: null }, { endedAt: { gte: filter.range.from } }],
      },
      orderBy: { startedAt: "desc" },
      take: 500,
    });
    const now = Date.now();
    return coalesceAgentSessions(sessions).map((session) => {
      const staleOpenSession = !session.endedAt && now - session.lastHeartbeatAt.getTime() > AGENT_HEARTBEAT_FRESH_MS;
      return {
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? (staleOpenSession ? session.lastHeartbeatAt.toISOString() : null),
        endReason: session.endReason ?? (staleOpenSession ? "UNKNOWN_INTERRUPTED" : null),
      };
    });
  }

  private async getDeviceStatusHistory(filter: UsageFilter) {
    if (!filter.userId) return [];
    const events = await this.prisma.deviceStatusEvent.findMany({
      where: {
        companyId: filter.companyId,
        userId: filter.userId,
        source: DeviceClientType.DESKTOP_AGENT,
        recordedAt: { gte: filter.range.from, lt: addUtcDays(filter.range.to, 1) },
      },
      orderBy: { recordedAt: "desc" },
      take: 500,
      select: {
        id: true,
        deviceId: true,
        agentSessionId: true,
        status: true,
        reason: true,
        startedAt: true,
        endedAt: true,
        lastHeartbeatAt: true,
        recordedAt: true,
        receivedAt: true,
        source: true,
        timeZone: true,
        confidence: true,
      },
    });
    return coalesceDeviceStatusHistory(events.map((event) => ({
      id: event.id,
      deviceId: event.deviceId,
      agentSessionId: event.agentSessionId,
      status: event.status,
      reason: event.reason,
      startedAt: event.startedAt.toISOString(),
      endedAt: event.endedAt?.toISOString() ?? null,
      lastHeartbeatAt: event.lastHeartbeatAt?.toISOString() ?? null,
      recordedAt: event.recordedAt.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
      source: event.source,
      timeZone: event.timeZone,
      confidence: event.confidence,
    })));
  }

  private async getEmployeeUsage(filter: UsageFilter) {
    const [rows, topAppRows, topDomainRows] = await Promise.all([
      this.prisma.appUsageSummary.groupBy({
        by: ["userId"],
        where: summaryWhere(filter),
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
      }),
      this.prisma.appUsageSummary.groupBy({
        by: ["userId", "appName"],
        where: summaryWhere(filter),
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
      }),
      this.prisma.websiteUsageSummary.groupBy({
        by: ["userId", "domain"],
        where: summaryWhere(filter),
        _sum: { activeSeconds: true, idleSeconds: true },
        orderBy: { _sum: { activeSeconds: "desc" } },
      }),
    ]);
    if (rows.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { companyId: filter.companyId, id: { in: rows.map((row: { userId: string }) => row.userId) } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user: { id: string; displayName: string }) => [user.id, user.displayName]));
    const topAppByUser = firstMetricByUser(topAppRows, "appName");
    const topDomainByUser = firstMetricByUser(topDomainRows, "domain");
    return rows.map((row: { userId: string; _sum: { activeSeconds: number | null; idleSeconds: number | null } }) => ({
      userId: row.userId,
      displayName: names.get(row.userId) ?? "Employee",
      activeSeconds: row._sum.activeSeconds ?? 0,
      idleSeconds: row._sum.idleSeconds ?? 0,
      topApp: topAppByUser.get(row.userId) ?? null,
      topDomain: topDomainByUser.get(row.userId) ?? null,
    }));
  }

  private async getAppTimeline(filter: UsageFilter) {
    if (!filter.userId) return [];
    const endExclusive = addUtcDays(filter.range.to, 1);
    const events = await this.prisma.activityEvent.findMany({
      where: {
        companyId: filter.companyId,
        userId: filter.userId,
        source: ActivityEventSource.DESKTOP_AGENT,
        eventType: ActivityEventType.APP,
        startedAt: { gte: filter.range.from, lt: endExclusive },
      },
      select: { appName: true, startedAt: true, endedAt: true, durationSeconds: true },
      orderBy: { startedAt: "asc" },
    });
    return events.map((event) => ({
      appName: event.appName ?? "Unknown application",
      startedAt: event.startedAt.toISOString(),
      endedAt: event.endedAt?.toISOString() ?? null,
      durationSeconds: event.durationSeconds ?? 0,
    }));
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

function resolveReportedAgentState(
  session: { endedAt: Date | null; endReason: AgentSessionEndReason | null },
  latestStatusEvent: {
    status: DeviceStatus;
    reason: DeviceStatusReason;
    confidence: DeviceStatusConfidence;
    recordedAt: Date;
  } | null,
  isFresh: boolean,
): ReportedAgentState {
  if (isFresh) {
    if (latestStatusEvent?.status === DeviceStatus.LOCKED) return "locked";
    if (latestStatusEvent?.status === DeviceStatus.SLEEPING) return "sleeping";
    return "running";
  }

  switch (latestStatusEvent?.status) {
    case DeviceStatus.STOPPED_BY_USER: return "stopped_by_user";
    case DeviceStatus.NETWORK_OFFLINE: return "network_offline";
    case DeviceStatus.DEVICE_SHUTDOWN: return "device_shutdown";
    case DeviceStatus.SLEEPING: return "sleeping";
    case DeviceStatus.LOCKED: return "locked";
    case DeviceStatus.AGENT_CRASHED: return "agent_crashed";
    case DeviceStatus.AGENT_TERMINATED: return "agent_terminated";
    case DeviceStatus.SERVER_UNREACHABLE: return "server_unreachable";
    case DeviceStatus.UNKNOWN_INTERRUPTED: return "unknown_interrupted";
    default: break;
  }

  switch (session.endReason) {
    case AgentSessionEndReason.USER_STOP: return "stopped_by_user";
    case AgentSessionEndReason.DEVICE_SHUTDOWN: return "device_shutdown";
    case AgentSessionEndReason.SUSPENDED: return "sleeping";
    case AgentSessionEndReason.AGENT_CRASHED: return "agent_crashed";
    case AgentSessionEndReason.AGENT_TERMINATED: return "agent_terminated";
    default: return "unknown_interrupted";
  }
}

function normalizeReportScope(scope: string | undefined): ReportScope {
  return scope === "company" ? "company" : "user";
}

export function parseReportRange(fromInput?: string, toInput?: string, now = new Date()): ReportRange {
  const today = utcDateOnly(now);
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

function coalesceAgentSessions(sessions: AgentSessionReportRow[]) {
  const logicalSessions = new Map<string, AgentSessionReportRow>();
  for (const session of sessions) {
    const key = session.clientSessionId ? `client:${session.clientSessionId}` : `server:${session.id}`;
    const existing = logicalSessions.get(key);
    if (!existing) {
      logicalSessions.set(key, { ...session });
      continue;
    }

    existing.startedAt = earlierDate(existing.startedAt, session.startedAt);
    existing.lastHeartbeatAt = laterDate(existing.lastHeartbeatAt, session.lastHeartbeatAt);
    if (!existing.endedAt || !session.endedAt) {
      existing.endedAt = null;
      existing.endReason = null;
      continue;
    }
    existing.endedAt = laterDate(existing.endedAt, session.endedAt);
    if (sessionEndReasonPriority(session.endReason) > sessionEndReasonPriority(existing.endReason)) {
      existing.endReason = session.endReason;
    }
  }
  return Array.from(logicalSessions.values()).sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
}

function coalesceDeviceStatusHistory(events: DeviceStatusReportRow[]) {
  const ordered = [...events].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const transitions: DeviceStatusReportRow[] = [];
  const previousByStream = new Map<string, DeviceStatusReportRow>();
  for (const event of ordered) {
    const streamKey = `${event.deviceId}:${event.source}`;
    const previous = previousByStream.get(streamKey);
    if (
      previous
      && previous.deviceId === event.deviceId
      && previous.agentSessionId === event.agentSessionId
      && previous.source === event.source
      && previous.status === event.status
      && previous.reason === event.reason
    ) {
      continue;
    }
    transitions.push(event);
    previousByStream.set(streamKey, event);
  }
  return transitions.reverse();
}

function sessionEndReasonPriority(reason: AgentSessionEndReason | null) {
  switch (reason) {
    case AgentSessionEndReason.USER_STOP: return 8;
    case AgentSessionEndReason.DEVICE_SHUTDOWN: return 7;
    case AgentSessionEndReason.SUSPENDED: return 6;
    case AgentSessionEndReason.AGENT_CRASHED: return 5;
    case AgentSessionEndReason.AGENT_TERMINATED: return 4;
    case AgentSessionEndReason.GRACEFUL_SHUTDOWN: return 3;
    case AgentSessionEndReason.UNEXPECTED_STOP: return 2;
    case AgentSessionEndReason.UNKNOWN_INTERRUPTED: return 1;
    default: return 0;
  }
}

function earlierDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function laterDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
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

function summarizeDomainIntervals(events: Array<{
  domain: string;
  isIdle: boolean;
  isActiveWindow: boolean;
  startedAt: Date;
  endedAt: Date;
}>) {
  type IntervalBuckets = { active: UsageInterval[]; idle: UsageInterval[]; runtime: UsageInterval[] };
  const byDomainIntervals = new Map<string, IntervalBuckets>();
  const byDateDomain = new Map<string, Map<string, Pick<IntervalBuckets, "active" | "idle">>>();

  for (const event of events) {
    if (event.endedAt <= event.startedAt) continue;
    const buckets = byDomainIntervals.get(event.domain) ?? { active: [], idle: [], runtime: [] };
    const interval = { startedAt: event.startedAt, endedAt: event.endedAt };
    if (event.isIdle) buckets.idle.push(interval);
    else if (event.isActiveWindow) buckets.active.push(interval);
    else buckets.runtime.push(interval);
    byDomainIntervals.set(event.domain, buckets);

    if (event.isIdle || event.isActiveWindow) {
      const date = toDateOnly(event.startedAt);
      const domains = byDateDomain.get(date) ?? new Map<string, Pick<IntervalBuckets, "active" | "idle">>();
      const dailyBuckets = domains.get(event.domain) ?? { active: [], idle: [] };
      (event.isIdle ? dailyBuckets.idle : dailyBuckets.active).push(interval);
      domains.set(event.domain, dailyBuckets);
      byDateDomain.set(date, domains);
    }
  }

  const byDomain = new Map<string, DomainMetricTotals>();
  for (const [domain, buckets] of byDomainIntervals) {
    byDomain.set(domain, {
      focusActiveSeconds: unionDurationSeconds(buckets.active),
      focusedIdleSeconds: unionDurationSeconds(buckets.idle),
      openRuntimeSeconds: unionDurationSeconds(buckets.runtime),
    });
  }

  const daily = Array.from(byDateDomain, ([date, domains]) => ({
    date,
    activeSeconds: Array.from(domains.values()).reduce((total, buckets) => total + unionDurationSeconds(buckets.active), 0),
    idleSeconds: Array.from(domains.values()).reduce((total, buckets) => total + unionDurationSeconds(buckets.idle), 0),
  })).sort((left, right) => left.date.localeCompare(right.date));

  return { byDomain, daily };
}

function unionDurationSeconds(intervals: UsageInterval[]) {
  if (intervals.length === 0) return 0;
  const ordered = [...intervals].sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  let totalMs = 0;
  let start = ordered[0]!.startedAt.getTime();
  let end = ordered[0]!.endedAt.getTime();
  for (const interval of ordered.slice(1)) {
    const nextStart = interval.startedAt.getTime();
    const nextEnd = interval.endedAt.getTime();
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      totalMs += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  totalMs += end - start;
  return Math.max(0, Math.round(totalMs / 1000));
}

function aggregateLiveApps(segments: LiveAppSegment[]) {
  const totals = new Map<string, { appName: string; activeSeconds: number; focusedIdleSeconds: number }>();
  for (const segment of segments) {
    const current = totals.get(segment.appName) ?? { appName: segment.appName, activeSeconds: 0, focusedIdleSeconds: 0 };
    current.activeSeconds += segment.activeSeconds;
    current.focusedIdleSeconds += segment.focusedIdleSeconds;
    totals.set(segment.appName, current);
  }
  return Array.from(totals.values())
    .sort((left, right) => right.activeSeconds - left.activeSeconds || right.focusedIdleSeconds - left.focusedIdleSeconds || left.appName.localeCompare(right.appName));
}

function aggregateLiveEmployees(segments: LiveAppSegment[]) {
  const totals = new Map<string, {
    userId: string;
    displayName: string;
    activeSeconds: number;
    idleSeconds: number;
    topApp: string | null;
    topAppSeconds: number;
  }>();
  const appTotals = new Map<string, Map<string, number>>();
  for (const segment of segments) {
    const current = totals.get(segment.userId) ?? {
      userId: segment.userId,
      displayName: segment.displayName,
      activeSeconds: 0,
      idleSeconds: 0,
      topApp: null,
      topAppSeconds: 0,
    };
    current.activeSeconds += segment.activeSeconds;
    current.idleSeconds += segment.focusedIdleSeconds;
    const byApp = appTotals.get(segment.userId) ?? new Map<string, number>();
    const appSeconds = (byApp.get(segment.appName) ?? 0) + segment.activeSeconds + segment.focusedIdleSeconds;
    byApp.set(segment.appName, appSeconds);
    appTotals.set(segment.userId, byApp);
    if (appSeconds > current.topAppSeconds || (appSeconds === current.topAppSeconds && segment.appName.localeCompare(current.topApp ?? "") < 0)) {
      current.topApp = segment.appName;
      current.topAppSeconds = appSeconds;
    }
    totals.set(segment.userId, current);
  }
  return Array.from(totals.values())
    .map((employee) => ({
      userId: employee.userId,
      displayName: employee.displayName,
      activeSeconds: employee.activeSeconds,
      idleSeconds: employee.idleSeconds,
      topApp: employee.topApp,
      topDomain: null,
    }))
    .sort((left, right) => right.activeSeconds - left.activeSeconds || left.displayName.localeCompare(right.displayName));
}

function firstMetricByUser<T extends { userId: string; _sum: { activeSeconds: number | null; idleSeconds?: number | null } } & Record<string, unknown>>(
  rows: T[],
  field: string,
) {
  const result = new Map<string, string>();
  const scores = new Map<string, number>();
  for (const row of rows) {
    const value = row[field];
    if (typeof value !== "string" || value.length === 0) continue;
    const score = row._sum.activeSeconds ?? 0;
    const currentScore = scores.get(row.userId);
    const currentValue = result.get(row.userId);
    if (
      currentScore === undefined
      || score > currentScore
      || (score === currentScore && (!currentValue || value.localeCompare(currentValue) < 0))
    ) {
      result.set(row.userId, value);
      scores.set(row.userId, score);
    }
  }
  return result;
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

function reportQueryErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "UnknownError";
}
