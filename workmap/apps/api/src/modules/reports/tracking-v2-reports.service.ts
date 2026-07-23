import { Injectable } from "@nestjs/common";
import {
  DeviceClientType,
  TrackingActivitySource,
  TrackingActivityStream,
  TrackingReconciliationState,
} from "@prisma/client";
import {
  computeTarget,
  TrackingV2ReconciliationService,
} from "../devices/tracking-v2-reconciliation.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DESKTOP_FRESH_MS = 30_000;
const BROWSER_FRESH_MS = 90_000;

type LiveFilter = {
  companyId: string;
  userId?: string;
  userIds?: string[];
};

type ConfirmedUsageFilter = LiveFilter & {
  range: {
    from: Date;
    to: Date;
  };
};

type ConfirmedSubjectDay = {
  companyId: string;
  userId: string;
  source: TrackingActivitySource;
  utcDate: Date;
  activitySubjectId: string;
  subjectKey: string;
  displayName: string;
  focusActiveMs: bigint;
  focusedIdleMs: bigint;
  openRuntimeMs: bigint;
  latestIncludedReceivedAt: Date | null;
};

type ConfirmedUserDay = {
  companyId: string;
  userId: string;
  source: TrackingActivitySource;
  utcDate: Date;
  focusActiveMs: bigint;
  focusedIdleMs: bigint;
  latestIncludedReceivedAt: Date | null;
};

@Injectable()
export class TrackingV2ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: TrackingV2ReconciliationService,
  ) {}

  async getLiveActivity(filter: LiveFilter) {
    const now = new Date();
    const devices = await this.prisma.device.findMany({
      where: {
        companyId: filter.companyId,
        ...identityFilter(filter),
        protocolActivatedAt: { not: null },
        revokedAt: null,
      },
      orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        clientType: true,
        browserName: true,
        workstationId: true,
        protocolActivatedAt: true,
        hostname: true,
        agentVersion: true,
        user: { select: { displayName: true } },
        workstation: { select: { displayName: true } },
        liveFocusSnapshots: {
          where: { stream: TrackingActivityStream.FOCUS },
          select: {
            source: true,
            browserName: true,
            snapshotSequence: true,
            activitySessionId: true,
            currentStateId: true,
            clockEpochId: true,
            policyVersion: true,
            subjectKey: true,
            displayName: true,
            state: true,
            sessionStartedAt: true,
            stateStartedAt: true,
            lastActivityEvidenceAt: true,
            activityEvidenceKind: true,
            latestEmittedIntervalSequence: true,
            latestEmittedClientEventId: true,
            nextIntervalSequence: true,
            lastObservedAt: true,
            collectorState: true,
            provisionalFromAt: true,
            receivedAt: true,
          },
        },
        clientHealth: {
          select: {
            source: true,
            clientType: true,
            clientVersion: true,
            platform: true,
            connectionState: true,
            collectorState: true,
            policyState: true,
            migrationState: true,
            queuePending: true,
            queueReady: true,
            queueDeadLetter: true,
            oldestQueuedAt: true,
            nextRetryAt: true,
            lastSuccessfulHeartbeatAt: true,
            lastSuccessfulSyncAt: true,
            errorCode: true,
            serverDiagnosticCode: true,
            serverDiagnosticRequestId: true,
            serverDiagnosticAt: true,
            receivedAt: true,
          },
        },
        syncCursors: {
          where: { stream: TrackingActivityStream.FOCUS },
          select: {
            source: true,
            stream: true,
            clockEpochId: true,
            contiguousThroughSequence: true,
            latestAcceptedEndedAt: true,
            missingRanges: true,
            rejectedRanges: true,
            clockDriftMs: true,
            updatedAt: true,
          },
        },
        sequenceTombstones: {
          orderBy: [{ rejectedAt: "desc" }, { sequenceNumber: "desc" }],
          take: 100,
          select: {
            source: true,
            stream: true,
            clockEpochId: true,
            sequenceNumber: true,
            rejectionCode: true,
            requestId: true,
            rejectedAt: true,
          },
        },
      },
    });

    const rows = devices.map((device) => {
      const source = sourceForClient(device.clientType);
      const snapshot = device.liveFocusSnapshots.find(
        (item) => item.source === source,
      ) ?? null;
      const health = device.clientHealth.find(
        (item) => item.source === source,
      ) ?? null;
      const intervalRejections = (device.sequenceTombstones ?? []).filter(
        (item) => item.source === source,
      );
      const cursor = snapshot
        ? device.syncCursors.find(
            (item) =>
              item.source === source &&
              item.clockEpochId === snapshot.clockEpochId,
          ) ?? null
        : null;
      const freshnessLimitMs =
        source === TrackingActivitySource.DESKTOP_APP
          ? DESKTOP_FRESH_MS
          : BROWSER_FRESH_MS;
      const connectionObservedAt = health?.receivedAt ?? null;
      const connectionAgeMs = connectionObservedAt
        ? Math.max(0, now.getTime() - connectionObservedAt.getTime())
        : null;
      const connectionFresh =
        connectionAgeMs !== null && connectionAgeMs <= freshnessLimitMs;
      const snapshotObservedAt = snapshot?.receivedAt ?? null;
      const snapshotAgeMs = snapshotObservedAt
        ? Math.max(0, now.getTime() - snapshotObservedAt.getTime())
        : null;
      const snapshotFresh =
        snapshotAgeMs !== null && snapshotAgeMs <= freshnessLimitMs;
      const snapshotDiagnosticIsCurrent = Boolean(
        health?.serverDiagnosticCode &&
          health.serverDiagnosticAt &&
          (!snapshotObservedAt || health.serverDiagnosticAt >= snapshotObservedAt),
      );
      const snapshotStatus = snapshotDiagnosticIsCurrent
        ? "REJECTED"
        : snapshotFresh && snapshot?.state !== "NONE"
          ? "CURRENT"
          : snapshotFresh
            ? "NO_CURRENT_FOCUS"
            : snapshot
              ? "STALE"
              : "NOT_RECEIVED";
      const current =
        snapshotFresh &&
        !snapshotDiagnosticIsCurrent &&
        snapshot &&
        snapshot.state !== "NONE"
          ? {
              state: snapshot.state,
              subjectKey: snapshot.subjectKey,
              displayName: snapshot.displayName,
              browserName: snapshot.browserName,
              sessionStartedAt: iso(snapshot.sessionStartedAt),
              stateStartedAt: iso(snapshot.stateStartedAt),
              lastActivityEvidenceAt: iso(
                snapshot.lastActivityEvidenceAt,
              ),
              activityEvidenceKind: snapshot.activityEvidenceKind,
              provisionalFromAt: iso(snapshot.provisionalFromAt),
              provisionalDurationMs: snapshot.provisionalFromAt
                ? Math.max(
                    0,
                    now.getTime() -
                      snapshot.provisionalFromAt.getTime(),
                  )
                : null,
            }
          : null;
      return {
        deviceId: device.id,
        userId: device.userId,
        displayName: device.user.displayName,
        clientType: device.clientType,
        source,
        browserName: device.browserName,
        workstationId: device.workstationId,
        workstationName: device.workstation?.displayName ?? null,
        hostname:
          device.clientType === DeviceClientType.DESKTOP_AGENT
            ? device.hostname
            : null,
        clientVersion: health?.clientVersion ?? device.agentVersion,
        protocolActivatedAt: iso(device.protocolActivatedAt),
        // Backward-compatible aliases now describe the server-confirmed
        // connection health lane. Snapshot freshness is intentionally separate.
        fresh: connectionFresh,
        freshnessAgeMs: connectionAgeMs,
        freshnessLimitMs,
        connectionFresh,
        connectionFreshnessAgeMs: connectionAgeMs,
        connectionFreshnessLimitMs: freshnessLimitMs,
        connectionConfirmedAt: iso(connectionObservedAt),
        snapshotFresh,
        snapshotFreshnessAgeMs: snapshotAgeMs,
        snapshotFreshnessLimitMs: freshnessLimitMs,
        snapshotStatus,
        current,
        snapshot: snapshot
          ? {
              snapshotSequence: snapshot.snapshotSequence,
              activitySessionId: snapshot.activitySessionId,
              currentStateId: snapshot.currentStateId,
              clockEpochId: snapshot.clockEpochId,
              policyVersion: snapshot.policyVersion,
              state: snapshot.state,
              nextIntervalSequence:
                snapshot.nextIntervalSequence,
              latestEmittedIntervalSequence:
                snapshot.latestEmittedIntervalSequence,
              latestEmittedClientEventId:
                snapshot.latestEmittedClientEventId,
              lastObservedAt: iso(snapshot.lastObservedAt),
              collectorState: snapshot.collectorState,
              receivedAt: iso(snapshot.receivedAt),
            }
          : null,
        health: health
          ? {
              connectionState: health.connectionState,
              collectorState: health.collectorState,
              policyState: health.policyState,
              migrationState: health.migrationState,
              platform: health.platform,
              queue: {
                pending: health.queuePending,
                ready: health.queueReady,
                deadLetter: health.queueDeadLetter,
                oldestQueuedAt: iso(health.oldestQueuedAt),
                nextRetryAt: iso(health.nextRetryAt),
              },
              lastSuccessfulHeartbeatAt: iso(
                health.lastSuccessfulHeartbeatAt,
              ),
              lastSuccessfulSyncAt: iso(
                health.lastSuccessfulSyncAt,
              ),
              errorCode: health.errorCode,
              serverDiagnosticCode: health.serverDiagnosticCode,
              serverDiagnosticRequestId:
                health.serverDiagnosticRequestId,
              serverDiagnosticAt: iso(health.serverDiagnosticAt),
              receivedAt: iso(health.receivedAt),
            }
          : null,
        cursor: cursor
          ? {
              clockEpochId: cursor.clockEpochId,
              contiguousThroughSequence:
                cursor.contiguousThroughSequence,
              latestAcceptedEndedAt: iso(
                cursor.latestAcceptedEndedAt,
              ),
              missingRanges: readJsonArray(cursor.missingRanges),
              rejectedRanges: readJsonArray(cursor.rejectedRanges),
              clockDriftMs: cursor.clockDriftMs,
              updatedAt: iso(cursor.updatedAt),
            }
          : null,
        intervalDiagnostics: {
          lastRejected: intervalRejections[0]
            ? {
                code: intervalRejections[0].rejectionCode,
                requestId: intervalRejections[0].requestId,
                rejectedAt: iso(intervalRejections[0].rejectedAt),
                stream: intervalRejections[0].stream,
                clockEpochId: intervalRejections[0].clockEpochId,
                sequenceNumber: intervalRejections[0].sequenceNumber,
              }
            : null,
          rejectionCodeCounts: rejectionCodeCounts(intervalRejections),
          recent: intervalRejections.slice(0, 12).map((item) => ({
            code: item.rejectionCode,
            requestId: item.requestId,
            rejectedAt: iso(item.rejectedAt),
            stream: item.stream,
            clockEpochId: item.clockEpochId,
            sequenceNumber: item.sequenceNumber,
          })),
        },
        correlation: null as null | {
          state: "RESOLVED" | "UNRESOLVED" | "NO_MATCH";
          desktopDeviceId?: string;
          extensionDeviceId?: string;
        },
      };
    });

    correlateBrowserFocus(rows);
    return {
      serverTime: now.toISOString(),
      devices: rows,
      coverage: {
        total: rows.length,
        fresh: rows.filter((row) => row.connectionFresh).length,
        stale: rows.filter((row) => !row.connectionFresh).length,
        connected: rows.filter((row) => row.connectionFresh).length,
        disconnected: rows.filter((row) => !row.connectionFresh).length,
        freshSnapshots: rows.filter(
          (row) =>
            row.snapshotStatus === "CURRENT" ||
            row.snapshotStatus === "NO_CURRENT_FOCUS",
        ).length,
        staleSnapshots: rows.filter(
          (row) => row.snapshotStatus === "STALE",
        ).length,
        rejectedSnapshots: rows.filter(
          (row) => row.snapshotStatus === "REJECTED",
        ).length,
        withSequenceGaps: rows.filter(
          (row) => (row.cursor?.missingRanges.length ?? 0) > 0,
        ).length,
        withDeadLetters: rows.filter(
          (row) => (row.health?.queue.deadLetter ?? 0) > 0,
        ).length,
        withRejectedIntervals: rows.filter(
          (row) => row.intervalDiagnostics.lastRejected !== null,
        ).length,
      },
    };
  }

  async retryDirtySummaries() {
    return this.reconciliation.reconcileDirtyTargets();
  }

  async getConfirmedUsage(filter: ConfirmedUsageFilter) {
    const [activatedDeviceCount, activePolicy] = await Promise.all([
      this.prisma.device.count({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          protocolActivatedAt: { not: null },
        },
      }),
      this.prisma.monitoringPolicy.findFirst({
        where: {
          companyId: filter.companyId,
          activeFrom: { lte: new Date() },
        },
        orderBy: [{ activeFrom: "desc" }, { id: "desc" }],
        select: {
          collectOpenRuntime: true,
          collectDomainOpenRuntime: true,
        },
      }),
    ]);
    if (activatedDeviceCount === 0) return null;

    const dateFilter = {
      gte: utcDateOnly(filter.range.from),
      lte: utcDateOnly(filter.range.to),
    };
    let targets =
      await this.prisma.usageReconciliationTarget.findMany({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          utcDate: dateFilter,
          state: { not: TrackingReconciliationState.CLEAN },
        },
        select: {
          companyId: true,
          userId: true,
          source: true,
          utcDate: true,
          state: true,
          version: true,
          dirtyAt: true,
          lastErrorCode: true,
        },
      });
    if (targets.length > 0) {
      try {
        await this.reconciliation.reconcileTargets(targets);
      } catch {
        // The direct ledger fallback below preserves accuracy for dates that
        // remain dirty after a best-effort reconciliation attempt.
      }
      targets =
        await this.prisma.usageReconciliationTarget.findMany({
          where: {
            companyId: filter.companyId,
            ...identityFilter(filter),
            utcDate: dateFilter,
            state: { not: TrackingReconciliationState.CLEAN },
          },
          select: {
            companyId: true,
            userId: true,
            source: true,
            utcDate: true,
            state: true,
            version: true,
            dirtyAt: true,
            lastErrorCode: true,
          },
        });
    }

    const dirtyKeys = new Set(targets.map(summaryTargetKey));
    const [storedSubjectDays, storedUserDays] = await Promise.all([
      this.prisma.userSubjectDailySummary.findMany({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          utcDate: dateFilter,
        },
        select: {
          companyId: true,
          userId: true,
          source: true,
          utcDate: true,
          activitySubjectId: true,
          focusActiveMs: true,
          focusedIdleMs: true,
          openRuntimeMs: true,
          latestIncludedReceivedAt: true,
          subject: {
            select: {
              subjectKey: true,
              displayName: true,
            },
          },
        },
      }),
      this.prisma.userDailyFocusSummary.findMany({
        where: {
          companyId: filter.companyId,
          ...identityFilter(filter),
          utcDate: dateFilter,
        },
        select: {
          companyId: true,
          userId: true,
          source: true,
          utcDate: true,
          focusActiveMs: true,
          focusedIdleMs: true,
          latestIncludedReceivedAt: true,
        },
      }),
    ]);

    const subjectDays: ConfirmedSubjectDay[] = storedSubjectDays
      .filter((row) => !dirtyKeys.has(summaryTargetKey(row)))
      .map((row) => ({
        ...row,
        subjectKey: row.subject.subjectKey,
        displayName: row.subject.displayName,
      }));
    const userDays: ConfirmedUserDay[] = storedUserDays.filter(
      (row) => !dirtyKeys.has(summaryTargetKey(row)),
    );

    if (targets.length > 0) {
      const fragments =
        await this.prisma.activityIntervalDayFragment.findMany({
          where: {
            OR: targets.map((target) => ({
              companyId: target.companyId,
              userId: target.userId,
              source: target.source,
              utcDate: utcDateOnly(target.utcDate),
            })),
          },
          select: {
            companyId: true,
            userId: true,
            source: true,
            utcDate: true,
            deviceId: true,
            activitySubjectId: true,
            metric: true,
            startedAt: true,
            endedAt: true,
            activityInterval: {
              select: {
                receivedAt: true,
                subject: {
                  select: {
                    subjectKey: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        });
      const fragmentsByTarget = groupBy(fragments, summaryTargetKey);
      for (const target of targets) {
        const rows = fragmentsByTarget.get(summaryTargetKey(target)) ?? [];
        const computed = computeTarget(rows);
        const latestIncludedReceivedAt = rows.reduce<Date | null>(
          (latest, row) =>
            !latest || row.activityInterval.receivedAt > latest
              ? row.activityInterval.receivedAt
              : latest,
          null,
        );
        userDays.push({
          companyId: target.companyId,
          userId: target.userId,
          source: target.source,
          utcDate: utcDateOnly(target.utcDate),
          focusActiveMs: computed.user.focusActiveMs,
          focusedIdleMs: computed.user.focusedIdleMs,
          latestIncludedReceivedAt,
        });
        const subjectRows = groupBy(
          rows,
          (row) => row.activitySubjectId,
        );
        for (const [activitySubjectId, totals] of computed.subjects) {
          const sourceRow = subjectRows.get(activitySubjectId)?.[0];
          if (!sourceRow) continue;
          subjectDays.push({
            companyId: target.companyId,
            userId: target.userId,
            source: target.source,
            utcDate: utcDateOnly(target.utcDate),
            activitySubjectId,
            subjectKey:
              sourceRow.activityInterval.subject.subjectKey,
            displayName:
              sourceRow.activityInterval.subject.displayName,
            ...totals,
            latestIncludedReceivedAt,
          });
        }
      }
    }

    return buildConfirmedUsageResponse({
      activatedDeviceCount,
      appOpenRuntimeEnabled: activePolicy?.collectOpenRuntime ?? false,
      domainOpenRuntimeEnabled:
        activePolicy?.collectDomainOpenRuntime ?? false,
      subjectDays,
      userDays,
      dirtyTargets: targets,
    });
  }
}

function identityFilter(filter: LiveFilter) {
  if (filter.userId) return { userId: filter.userId };
  if (filter.userIds) return { userId: { in: filter.userIds } };
  return {};
}

function sourceForClient(clientType: DeviceClientType | null) {
  return clientType === DeviceClientType.BROWSER_EXTENSION
    ? TrackingActivitySource.BROWSER_DOMAIN
    : TrackingActivitySource.DESKTOP_APP;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function readJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function rejectionCodeCounts(rows: Array<{ rejectionCode: string }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.rejectionCode] = (counts[row.rejectionCode] ?? 0) + 1;
  }
  return counts;
}

function browserForDesktopApp(displayName: string | null | undefined) {
  const normalized = displayName?.trim().toLowerCase() ?? "";
  if (
    normalized.includes("microsoft edge") ||
    normalized === "msedge" ||
    normalized === "edge"
  ) {
    return "EDGE";
  }
  if (
    normalized.includes("google chrome") ||
    normalized === "chrome"
  ) {
    return "CHROME";
  }
  return null;
}

function correlateBrowserFocus(
  rows: Array<{
    deviceId: string;
    clientType: DeviceClientType | null;
    browserName: string | null;
    workstationId: string | null;
    fresh: boolean;
    current: null | { displayName: string | null };
    correlation: null | {
      state: "RESOLVED" | "UNRESOLVED" | "NO_MATCH";
      desktopDeviceId?: string;
      extensionDeviceId?: string;
    };
  }>,
) {
  for (const desktop of rows) {
    if (
      desktop.clientType !== DeviceClientType.DESKTOP_AGENT ||
      !desktop.fresh ||
      !desktop.current ||
      !desktop.workstationId
    ) {
      continue;
    }
    const browserName = browserForDesktopApp(
      desktop.current.displayName,
    );
    if (!browserName) continue;
    const candidates = rows.filter(
      (row) =>
        row.clientType === DeviceClientType.BROWSER_EXTENSION &&
        row.workstationId === desktop.workstationId &&
        row.browserName === browserName &&
        row.fresh &&
        row.current,
    );
    if (candidates.length === 1) {
      desktop.correlation = {
        state: "RESOLVED",
        desktopDeviceId: desktop.deviceId,
        extensionDeviceId: candidates[0]!.deviceId,
      };
      candidates[0]!.correlation = desktop.correlation;
    } else {
      desktop.correlation = {
        state: candidates.length > 1 ? "UNRESOLVED" : "NO_MATCH",
        desktopDeviceId: desktop.deviceId,
      };
      for (const candidate of candidates) {
        candidate.correlation = {
          state: "UNRESOLVED",
          desktopDeviceId: desktop.deviceId,
          extensionDeviceId: candidate.deviceId,
        };
      }
    }
  }
}

function buildConfirmedUsageResponse(input: {
  activatedDeviceCount: number;
  appOpenRuntimeEnabled: boolean;
  domainOpenRuntimeEnabled: boolean;
  subjectDays: ConfirmedSubjectDay[];
  userDays: ConfirmedUserDay[];
  dirtyTargets: Array<{
    userId: string;
    source: TrackingActivitySource;
    utcDate: Date;
    state: TrackingReconciliationState;
    lastErrorCode: string | null;
  }>;
}) {
  const subjectTotals = new Map<
    string,
    {
      source: TrackingActivitySource;
      subjectKey: string;
      displayName: string;
      focusActiveMs: bigint;
      focusedIdleMs: bigint;
      openRuntimeMs: bigint;
    }
  >();
  for (const row of input.subjectDays) {
    const key = `${row.source}:${row.activitySubjectId}`;
    const current = subjectTotals.get(key) ?? {
      source: row.source,
      subjectKey: row.subjectKey,
      displayName: row.displayName,
      focusActiveMs: 0n,
      focusedIdleMs: 0n,
      openRuntimeMs: 0n,
    };
    current.focusActiveMs += row.focusActiveMs;
    current.focusedIdleMs += row.focusedIdleMs;
    current.openRuntimeMs += row.openRuntimeMs;
    subjectTotals.set(key, current);
  }

  const apps = [...subjectTotals.values()]
    .filter((row) => row.source === TrackingActivitySource.DESKTOP_APP)
    .map((row) => ({
      appName: row.displayName,
      ...confirmedSubjectResponse(row),
    }))
    .sort(sortConfirmedSubjects);
  const websites = [...subjectTotals.values()]
    .filter(
      (row) => row.source === TrackingActivitySource.BROWSER_DOMAIN,
    )
    .map((row) => ({
      domain: row.displayName,
      ...confirmedSubjectResponse(row),
    }))
    .sort(sortConfirmedSubjects);

  const days = new Map<
    string,
    {
      date: string;
      appActiveMs: bigint;
      appIdleMs: bigint;
      domainActiveMs: bigint;
      domainIdleMs: bigint;
    }
  >();
  for (const row of input.userDays) {
    const date = toDateOnly(row.utcDate);
    const current = days.get(date) ?? {
      date,
      appActiveMs: 0n,
      appIdleMs: 0n,
      domainActiveMs: 0n,
      domainIdleMs: 0n,
    };
    if (row.source === TrackingActivitySource.DESKTOP_APP) {
      current.appActiveMs += row.focusActiveMs;
      current.appIdleMs += row.focusedIdleMs;
    } else {
      current.domainActiveMs += row.focusActiveMs;
      current.domainIdleMs += row.focusedIdleMs;
    }
    days.set(date, current);
  }
  const daily = [...days.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      date: row.date,
      appActiveMs: safeMs(row.appActiveMs),
      appIdleMs: safeMs(row.appIdleMs),
      domainActiveMs: safeMs(row.domainActiveMs),
      domainIdleMs: safeMs(row.domainIdleMs),
      appActiveSeconds: seconds(row.appActiveMs),
      appIdleSeconds: seconds(row.appIdleMs),
      domainActiveSeconds: seconds(row.domainActiveMs),
      domainIdleSeconds: seconds(row.domainIdleMs),
    }));
  const latestIncludedReceivedAt = input.subjectDays.reduce<Date | null>(
    (latest, row) =>
      !latest ||
      (row.latestIncludedReceivedAt &&
        row.latestIncludedReceivedAt > latest)
        ? row.latestIncludedReceivedAt
        : latest,
    null,
  );

  return {
    apps,
    websites,
    daily,
    coverage: {
      activatedDeviceCount: input.activatedDeviceCount,
      openRuntimeEnabled:
        input.appOpenRuntimeEnabled || input.domainOpenRuntimeEnabled,
      appOpenRuntimeEnabled: input.appOpenRuntimeEnabled,
      domainOpenRuntimeEnabled: input.domainOpenRuntimeEnabled,
      reconciliationState:
        input.dirtyTargets.length > 0 ? "LEDGER_FALLBACK" : "RECONCILED",
      dirtyDates: input.dirtyTargets.map((target) => ({
        userId: target.userId,
        source: target.source,
        date: toDateOnly(target.utcDate),
        state: target.state,
        errorCode: target.lastErrorCode,
      })),
      latestIncludedReceivedAt: iso(latestIncludedReceivedAt),
    },
  };
}

function confirmedSubjectResponse(
  row: {
    subjectKey: string;
    focusActiveMs: bigint;
    focusedIdleMs: bigint;
    openRuntimeMs: bigint;
  },
) {
  return {
    subjectKey: row.subjectKey,
    category: null,
    productivityLabel: "UNCATEGORISED",
    activeSeconds: seconds(row.focusActiveMs),
    idleSeconds: seconds(row.focusedIdleMs),
    focusActiveSeconds: seconds(row.focusActiveMs),
    focusedIdleSeconds: seconds(row.focusedIdleMs),
    openRuntimeSeconds: seconds(row.openRuntimeMs),
    focusActiveMs: safeMs(row.focusActiveMs),
    focusedIdleMs: safeMs(row.focusedIdleMs),
    openRuntimeMs: safeMs(row.openRuntimeMs),
  };
}

function sortConfirmedSubjects(
  left: { focusActiveMs: number; openRuntimeMs: number; subjectKey: string },
  right: { focusActiveMs: number; openRuntimeMs: number; subjectKey: string },
) {
  return (
    right.focusActiveMs - left.focusActiveMs ||
    right.openRuntimeMs - left.openRuntimeMs ||
    left.subjectKey.localeCompare(right.subjectKey)
  );
}

function seconds(value: bigint) {
  return safeMs(value) / 1000;
}

function safeMs(value: bigint) {
  const converted = Number(value);
  return Number.isSafeInteger(converted)
    ? converted
    : Number.MAX_SAFE_INTEGER;
}

function utcDateOnly(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function summaryTargetKey(value: {
  companyId: string;
  userId: string;
  source: TrackingActivitySource;
  utcDate: Date;
}) {
  return [
    value.companyId,
    value.userId,
    value.source,
    toDateOnly(value.utcDate),
  ].join(":");
}

function groupBy<T>(
  values: T[],
  keyFor: (value: T) => string,
) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}
