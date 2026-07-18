import { Injectable } from "@nestjs/common";
import {
  Prisma,
  TrackingActivityMetric,
  TrackingActivitySource,
  TrackingReconciliationState,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

export type TrackingReconciliationTargetKey = {
  companyId: string;
  userId: string;
  source: TrackingActivitySource;
  utcDate: Date;
};

type TimedFragment = {
  deviceId: string;
  activitySubjectId: string;
  metric: TrackingActivityMetric;
  startedAt: Date;
  endedAt: Date;
  activityInterval: {
    receivedAt: Date;
  };
};

type MetricTotals = {
  focusActiveMs: bigint;
  focusedIdleMs: bigint;
  openRuntimeMs: bigint;
};

@Injectable()
export class TrackingV2ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileTargets(keys: TrackingReconciliationTargetKey[]) {
    const unique = [
      ...new Map(
        keys.map((key) => [
          targetKey(key),
          {
            ...key,
            utcDate: utcDateOnly(key.utcDate),
          },
        ]),
      ).values(),
    ];
    for (const key of unique) {
      await this.reconcileTarget(key);
    }
  }

  async reconcileDirtyTargets(limit = 20) {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.usageReconciliationTarget.updateMany({
      where: {
        state: TrackingReconciliationState.PROCESSING,
        lastAttemptAt: { lt: staleBefore },
      },
      data: {
        state: TrackingReconciliationState.FAILED,
        lastErrorCode: "STALE_PROCESSING_RECOVERED",
      },
    });
    const targets = await this.prisma.usageReconciliationTarget.findMany({
      where: {
        state: {
          in: [
            TrackingReconciliationState.DIRTY,
            TrackingReconciliationState.FAILED,
          ],
        },
      },
      orderBy: [{ dirtyAt: "asc" }, { id: "asc" }],
      take: Math.max(1, Math.min(limit, 100)),
      select: {
        companyId: true,
        userId: true,
        source: true,
        utcDate: true,
      },
    });
    await this.reconcileTargets(targets);
    return { reconciled: targets.length };
  }

  private async reconcileTarget(key: TrackingReconciliationTargetKey) {
    const normalized = {
      ...key,
      utcDate: utcDateOnly(key.utcDate),
    };
    const target =
      await this.prisma.usageReconciliationTarget.findUnique({
        where: {
          companyId_userId_source_utcDate: normalized,
        },
      });
    if (!target || target.state === TrackingReconciliationState.CLEAN) {
      return;
    }
    const claim =
      await this.prisma.usageReconciliationTarget.updateMany({
        where: {
          id: target.id,
          version: target.version,
          state: {
            in: [
              TrackingReconciliationState.DIRTY,
              TrackingReconciliationState.FAILED,
            ],
          },
        },
        data: {
          state: TrackingReconciliationState.PROCESSING,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          lastErrorCode: null,
        },
      });
    if (claim.count !== 1) return;

    try {
      const fragments =
        await this.prisma.activityIntervalDayFragment.findMany({
          where: normalized,
          select: {
            deviceId: true,
            activitySubjectId: true,
            metric: true,
            startedAt: true,
            endedAt: true,
            activityInterval: {
              select: { receivedAt: true },
            },
          },
        });
      const computed = computeTarget(fragments);
      const latestIncludedReceivedAt = latestReceivedAt(fragments);

      await this.prisma.$transaction(
        async (tx) => {
          const currentSubjectIds = [...computed.subjects.keys()];
          const existingSubjects =
            await tx.userSubjectDailySummary.findMany({
              where: normalized,
              select: { activitySubjectId: true },
            });
          for (const [activitySubjectId, totals] of computed.subjects) {
            await tx.userSubjectDailySummary.upsert({
              where: {
                companyId_userId_source_activitySubjectId_utcDate: {
                  ...normalized,
                  activitySubjectId,
                },
              },
              update: {
                ...totals,
                reconciliationVersion: target.version,
                latestIncludedReceivedAt,
              },
              create: {
                ...normalized,
                activitySubjectId,
                ...totals,
                reconciliationVersion: target.version,
                latestIncludedReceivedAt,
              },
            });
          }
          const staleSubjectIds = existingSubjects
            .map((row) => row.activitySubjectId)
            .filter((id) => !currentSubjectIds.includes(id));
          if (staleSubjectIds.length > 0) {
            await tx.userSubjectDailySummary.updateMany({
              where: {
                ...normalized,
                activitySubjectId: { in: staleSubjectIds },
              },
              data: {
                focusActiveMs: 0n,
                focusedIdleMs: 0n,
                openRuntimeMs: 0n,
                reconciliationVersion: target.version,
                latestIncludedReceivedAt,
              },
            });
          }

          await tx.userDailyFocusSummary.upsert({
            where: {
              companyId_userId_source_utcDate: normalized,
            },
            update: {
              focusActiveMs: computed.user.focusActiveMs,
              focusedIdleMs: computed.user.focusedIdleMs,
              reconciliationVersion: target.version,
              latestIncludedReceivedAt,
            },
            create: {
              ...normalized,
              focusActiveMs: computed.user.focusActiveMs,
              focusedIdleMs: computed.user.focusedIdleMs,
              reconciliationVersion: target.version,
              latestIncludedReceivedAt,
            },
          });

          const companyLane = [
            normalized.companyId,
            normalized.source,
            normalized.utcDate.toISOString(),
          ].join(":");
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(hashtext(${companyLane}))
          `;
          const users = await tx.userDailyFocusSummary.findMany({
            where: {
              companyId: normalized.companyId,
              source: normalized.source,
              utcDate: normalized.utcDate,
            },
            select: {
              focusActiveMs: true,
              focusedIdleMs: true,
              reconciliationVersion: true,
              latestIncludedReceivedAt: true,
            },
          });
          const companyFocusActiveMs = users.reduce(
            (sum, row) => sum + row.focusActiveMs,
            0n,
          );
          const companyFocusedIdleMs = users.reduce(
            (sum, row) => sum + row.focusedIdleMs,
            0n,
          );
          const companyLatestIncludedAt = users.reduce<Date | null>(
            (latest, row) =>
              !latest ||
              (row.latestIncludedReceivedAt &&
                row.latestIncludedReceivedAt > latest)
                ? row.latestIncludedReceivedAt
                : latest,
            null,
          );
          const companyVersion = users.reduce(
            (version, row) =>
              Math.max(version, row.reconciliationVersion),
            0,
          );
          await tx.companyDailyFocusSummary.upsert({
            where: {
              companyId_source_utcDate: {
                companyId: normalized.companyId,
                source: normalized.source,
                utcDate: normalized.utcDate,
              },
            },
            update: {
              focusActiveMs: companyFocusActiveMs,
              focusedIdleMs: companyFocusedIdleMs,
              reconciliationVersion: companyVersion,
              latestIncludedReceivedAt: companyLatestIncludedAt,
            },
            create: {
              companyId: normalized.companyId,
              source: normalized.source,
              utcDate: normalized.utcDate,
              focusActiveMs: companyFocusActiveMs,
              focusedIdleMs: companyFocusedIdleMs,
              reconciliationVersion: companyVersion,
              latestIncludedReceivedAt: companyLatestIncludedAt,
            },
          });
          await tx.usageReconciliationTarget.updateMany({
            where: {
              id: target.id,
              version: target.version,
              state: TrackingReconciliationState.PROCESSING,
            },
            data: {
              state: TrackingReconciliationState.CLEAN,
              reconciledAt: new Date(),
              lastErrorCode: null,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
    } catch (error) {
      await this.prisma.usageReconciliationTarget.updateMany({
        where: {
          id: target.id,
          version: target.version,
          state: TrackingReconciliationState.PROCESSING,
        },
        data: {
          state: TrackingReconciliationState.FAILED,
          lastErrorCode: reconciliationErrorCode(error),
        },
      });
      throw error;
    }
  }
}

export function computeTarget(fragments: TimedFragment[]) {
  const subjectGroups = groupBy(
    fragments,
    (fragment) => fragment.activitySubjectId,
  );
  const subjects = new Map<string, MetricTotals>();
  for (const [subjectId, rows] of subjectGroups) {
    subjects.set(subjectId, metricTotals(rows));
  }
  return {
    subjects,
    user: metricTotals(fragments),
  };
}

function metricTotals(fragments: TimedFragment[]): MetricTotals {
  const activeRanges = mergeRanges(
    fragments.filter(
      (row) => row.metric === TrackingActivityMetric.FOCUS_ACTIVE,
    ),
  );
  const idleRanges = mergeRanges(
    fragments.filter(
      (row) => row.metric === TrackingActivityMetric.FOCUS_IDLE,
    ),
  );
  return {
    focusActiveMs: durationOfRanges(activeRanges),
    focusedIdleMs: durationExcluding(idleRanges, activeRanges),
    openRuntimeMs: unionDuration(
      fragments.filter(
        (row) => row.metric === TrackingActivityMetric.OPEN_RUNTIME,
      ),
    ),
  };
}

export function unionDuration(
  values: Array<{ startedAt: Date; endedAt: Date }>,
) {
  return durationOfRanges(mergeRanges(values));
}

function mergeRanges(
  values: Array<{ startedAt: Date; endedAt: Date }>,
) {
  const ranges = values
    .filter((value) => value.endedAt > value.startedAt)
    .map((value) => ({
      start: value.startedAt.getTime(),
      end: value.endedAt.getTime(),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const current = merged.at(-1);
    if (!current || range.start > current.end) {
      merged.push({ ...range });
      continue;
    }
    current.end = Math.max(current.end, range.end);
  }
  return merged;
}

function durationOfRanges(
  ranges: Array<{ start: number; end: number }>,
) {
  return ranges.reduce(
    (total, range) => total + BigInt(range.end - range.start),
    0n,
  );
}

function durationExcluding(
  values: Array<{ start: number; end: number }>,
  excluded: Array<{ start: number; end: number }>,
) {
  let total = 0n;
  let excludedIndex = 0;
  for (const value of values) {
    let cursor = value.start;
    while (
      excludedIndex < excluded.length &&
      excluded[excludedIndex]!.end <= cursor
    ) {
      excludedIndex += 1;
    }
    let scanIndex = excludedIndex;
    while (
      scanIndex < excluded.length &&
      excluded[scanIndex]!.start < value.end
    ) {
      const blocker = excluded[scanIndex]!;
      if (blocker.start > cursor) {
        total += BigInt(Math.min(blocker.start, value.end) - cursor);
      }
      cursor = Math.max(cursor, blocker.end);
      if (cursor >= value.end) break;
      scanIndex += 1;
    }
    if (cursor < value.end) {
      total += BigInt(value.end - cursor);
    }
  }
  return total;
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

function latestReceivedAt(values: TimedFragment[]) {
  return values.reduce<Date | null>(
    (latest, value) =>
      !latest || value.activityInterval.receivedAt > latest
        ? value.activityInterval.receivedAt
        : latest,
    null,
  );
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

function targetKey(value: TrackingReconciliationTargetKey) {
  return [
    value.companyId,
    value.userId,
    value.source,
    utcDateOnly(value.utcDate).toISOString(),
  ].join(":");
}

function reconciliationErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 80);
  }
  return "RECONCILIATION_FAILED";
}

// Reconciliation logs must identify the failed database operation without
// exposing connection strings or device credentials.
export function describeTrackingV2Error(error: unknown) {
  const record = asRecord(error);
  const code = typeof record?.code === "string" ? record.code : undefined;
  const meta = asRecord(record?.meta);
  const detail = firstString(
    meta?.message,
    record?.message,
    typeof error === "string" ? error : undefined,
  );
  const message = redactTrackingV2Log(detail ?? "Unknown reconciliation error.");
  return `${code ? `code=${code} ` : ""}message=${message}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string");
}

function redactTrackingV2Log(value: string) {
  return value
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, "[database-url]")
    .replace(/(?:device|bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}
