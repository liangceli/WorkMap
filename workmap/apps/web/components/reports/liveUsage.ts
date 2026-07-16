import type { WorkMapApiReportLiveStatus, WorkMapApiUsageSummary } from "../../lib/api/apiTypes";

const MINIMUM_LIVE_DURATION_SECONDS = 5;

export function mergeLiveUsage(
  summary: WorkMapApiUsageSummary | null,
  liveStatus: WorkMapApiReportLiveStatus | null,
): WorkMapApiUsageSummary | null {
  if (!summary || !liveStatus || summary.scope !== liveStatus.scope) return summary;
  const summaryWithCoverage = { ...summary, browserExtensionCoverage: liveStatus.browserExtensionCoverage };
  if (!rangeIncludesUtcToday(summary)) return summaryWithCoverage;
  if (summary.scope === "company" && liveStatus.scope === "company") {
    if ((summary.departmentId ?? null) !== (liveStatus.departmentId ?? null)) return summary;
    return mergeSegments(summaryWithCoverage, liveStatus.apps, liveStatus.employeeUsage);
  }
  if (summary.scope === "user" && liveStatus.scope === "user" && summary.userId === liveStatus.userId) {
    const status = liveStatus.agentStatus;
    const currentActiveSeconds = status?.state === "running" ? status.currentAppActiveSeconds ?? 0 : 0;
    const currentIdleSeconds = status?.state === "running" ? status.currentAppFocusedIdleSeconds ?? 0 : 0;
    const apps = status?.currentAppName && Math.max(currentActiveSeconds, currentIdleSeconds) >= MINIMUM_LIVE_DURATION_SECONDS
      ? [{ appName: status.currentAppName, activeSeconds: currentActiveSeconds, focusedIdleSeconds: currentIdleSeconds }]
      : [];
    return { ...mergeSegments(summaryWithCoverage, apps, []), agentStatus: status };
  }
  return summary;
}

// The report summary and the live heartbeat are separate requests. A completed
// Agent slice can be acknowledged between them, so retain the last displayed
// value for one immutable report view until the persisted aggregate catches up.
// This is presentation-only: exports and stored summaries still use API data.
export function retainMonotonicLiveUsage(
  previous: WorkMapApiUsageSummary | null,
  current: WorkMapApiUsageSummary | null,
): WorkMapApiUsageSummary | null {
  if (!previous || !current || !sameReportView(previous, current)) return current;

  return {
    ...current,
    apps: retainRows(previous.apps, current.apps, mergeAppRow),
    daily: retainRows(previous.daily, current.daily, mergeDailyRow),
    employeeUsage: retainRows(previous.employeeUsage, current.employeeUsage, mergeEmployeeRow),
  };
}

function mergeSegments(
  summary: WorkMapApiUsageSummary,
  liveApps: Array<{ appName: string; activeSeconds: number; focusedIdleSeconds?: number }>,
  liveEmployees: Array<{ userId: string; displayName: string; activeSeconds: number; idleSeconds?: number }>,
) {
  const apps = summary.apps.map((row) => ({ ...row }));
  for (const live of liveApps) {
    const focusedIdleSeconds = live.focusedIdleSeconds ?? 0;
    if (Math.max(live.activeSeconds, focusedIdleSeconds) < MINIMUM_LIVE_DURATION_SECONDS) continue;
    const existing = apps.find((row) => row.appName === live.appName);
    if (existing) {
      existing.activeSeconds += live.activeSeconds;
      existing.focusActiveSeconds = (existing.focusActiveSeconds ?? existing.activeSeconds - live.activeSeconds) + live.activeSeconds;
      existing.idleSeconds += focusedIdleSeconds;
      existing.focusedIdleSeconds = (existing.focusedIdleSeconds ?? existing.idleSeconds - focusedIdleSeconds) + focusedIdleSeconds;
      existing.openRuntimeSeconds = Math.max(existing.openRuntimeSeconds ?? 0, (existing.activeSeconds + existing.idleSeconds));
    }
    else apps.push({
      appName: live.appName,
      category: null,
      productivityLabel: null,
      activeSeconds: live.activeSeconds,
      idleSeconds: focusedIdleSeconds,
      focusActiveSeconds: live.activeSeconds,
      focusedIdleSeconds,
      openRuntimeSeconds: live.activeSeconds + focusedIdleSeconds,
    });
  }
  apps.sort((left, right) =>
    right.activeSeconds - left.activeSeconds
    || (right.openRuntimeSeconds ?? right.activeSeconds + right.idleSeconds) - (left.openRuntimeSeconds ?? left.activeSeconds + left.idleSeconds)
    || left.appName.localeCompare(right.appName),
  );

  const liveTotal = liveApps.reduce(
    (total, row) => total + (row.activeSeconds >= MINIMUM_LIVE_DURATION_SECONDS ? row.activeSeconds : 0),
    0,
  );
  const today = new Date().toISOString().slice(0, 10);
  const daily = summary.daily.map((row) => ({ ...row }));
  if (liveTotal > 0) {
    const currentDay = daily.find((row) => row.date === today);
    if (currentDay) currentDay.appActiveSeconds += liveTotal;
    else daily.push({ date: today, appActiveSeconds: liveTotal, appIdleSeconds: 0, domainActiveSeconds: 0, domainIdleSeconds: 0 });
    daily.sort((left, right) => left.date.localeCompare(right.date));
  }

  const employeeUsage = summary.employeeUsage.map((row) => ({ ...row }));
  for (const live of liveEmployees) {
    const idleSeconds = live.idleSeconds ?? 0;
    if (Math.max(live.activeSeconds, idleSeconds) < MINIMUM_LIVE_DURATION_SECONDS) continue;
    const existing = employeeUsage.find((row) => row.userId === live.userId);
    if (existing) {
      existing.activeSeconds += live.activeSeconds;
      existing.idleSeconds += idleSeconds;
    } else employeeUsage.push({ ...live, idleSeconds });
  }
  employeeUsage.sort((left, right) => right.activeSeconds - left.activeSeconds || left.displayName.localeCompare(right.displayName));

  return { ...summary, apps, daily, employeeUsage };
}

function rangeIncludesUtcToday(summary: WorkMapApiUsageSummary) {
  const today = new Date().toISOString().slice(0, 10);
  return summary.range.from <= today && summary.range.to >= today;
}

function sameReportView(left: WorkMapApiUsageSummary, right: WorkMapApiUsageSummary) {
  return left.scope === right.scope
    && left.userId === right.userId
    && left.departmentId === right.departmentId
    && left.range.from === right.range.from
    && left.range.to === right.range.to
    && left.range.timeZone === right.range.timeZone;
}

function retainRows<Row>(
  previous: Row[],
  current: Row[],
  merge: (previous: Row, current: Row) => Row,
) {
  const previousByKey = new Map(previous.map((row) => [rowKey(row), row]));
  const merged = current.map((row) => {
    const prior = previousByKey.get(rowKey(row));
    return prior ? merge(prior, row) : row;
  });
  const currentKeys = new Set(current.map(rowKey));
  return [...merged, ...previous.filter((row) => !currentKeys.has(rowKey(row)))];
}

function mergeAppRow(
  previous: WorkMapApiUsageSummary["apps"][number],
  current: WorkMapApiUsageSummary["apps"][number],
) {
  return {
    ...current,
    activeSeconds: Math.max(previous.activeSeconds, current.activeSeconds),
    idleSeconds: Math.max(previous.idleSeconds, current.idleSeconds),
    focusActiveSeconds: Math.max(previous.focusActiveSeconds ?? previous.activeSeconds, current.focusActiveSeconds ?? current.activeSeconds),
    focusedIdleSeconds: Math.max(previous.focusedIdleSeconds ?? previous.idleSeconds, current.focusedIdleSeconds ?? current.idleSeconds),
    openRuntimeSeconds: Math.max(previous.openRuntimeSeconds ?? 0, current.openRuntimeSeconds ?? 0),
  };
}

function mergeDailyRow(
  previous: WorkMapApiUsageSummary["daily"][number],
  current: WorkMapApiUsageSummary["daily"][number],
) {
  return {
    ...current,
    appActiveSeconds: Math.max(previous.appActiveSeconds, current.appActiveSeconds),
    appIdleSeconds: Math.max(previous.appIdleSeconds, current.appIdleSeconds),
    domainActiveSeconds: Math.max(previous.domainActiveSeconds, current.domainActiveSeconds),
    domainIdleSeconds: Math.max(previous.domainIdleSeconds, current.domainIdleSeconds),
  };
}

function mergeEmployeeRow(
  previous: WorkMapApiUsageSummary["employeeUsage"][number],
  current: WorkMapApiUsageSummary["employeeUsage"][number],
) {
  return {
    ...current,
    activeSeconds: Math.max(previous.activeSeconds, current.activeSeconds),
    idleSeconds: Math.max(previous.idleSeconds, current.idleSeconds),
  };
}

function rowKey(row: unknown) {
  if (typeof row !== "object" || row === null) return "";
  const value = row as Record<string, unknown>;
  if (typeof value.appName === "string") return `app:${value.appName}`;
  if (typeof value.date === "string") return `date:${value.date}`;
  if (typeof value.userId === "string") return `user:${value.userId}`;
  return "";
}
