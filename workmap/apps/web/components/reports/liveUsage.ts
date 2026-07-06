import type { WorkMapApiReportLiveStatus, WorkMapApiUsageSummary } from "../../lib/api/apiTypes";

const MINIMUM_LIVE_DURATION_SECONDS = 5;

export function mergeLiveUsage(
  summary: WorkMapApiUsageSummary | null,
  liveStatus: WorkMapApiReportLiveStatus | null,
): WorkMapApiUsageSummary | null {
  if (!summary || !liveStatus || summary.scope !== liveStatus.scope || !rangeIncludesUtcToday(summary)) return summary;
  if (summary.scope === "company" && liveStatus.scope === "company") {
    if ((summary.departmentId ?? null) !== (liveStatus.departmentId ?? null)) return summary;
    return mergeSegments(summary, liveStatus.apps, liveStatus.employeeUsage);
  }
  if (summary.scope === "user" && liveStatus.scope === "user" && summary.userId === liveStatus.userId) {
    const status = liveStatus.agentStatus;
    const currentSeconds = status?.state === "online" ? status.currentAppActiveSeconds ?? 0 : 0;
    const apps = status?.currentAppName && currentSeconds >= MINIMUM_LIVE_DURATION_SECONDS
      ? [{ appName: status.currentAppName, activeSeconds: currentSeconds }]
      : [];
    return { ...mergeSegments(summary, apps, []), agentStatus: status };
  }
  return summary;
}

function mergeSegments(
  summary: WorkMapApiUsageSummary,
  liveApps: Array<{ appName: string; activeSeconds: number }>,
  liveEmployees: Array<{ userId: string; displayName: string; activeSeconds: number }>,
) {
  const apps = summary.apps.map((row) => ({ ...row }));
  for (const live of liveApps) {
    if (live.activeSeconds < MINIMUM_LIVE_DURATION_SECONDS) continue;
    const existing = apps.find((row) => row.appName === live.appName);
    if (existing) existing.activeSeconds += live.activeSeconds;
    else apps.push({
      appName: live.appName,
      category: null,
      productivityLabel: null,
      activeSeconds: live.activeSeconds,
      idleSeconds: 0,
    });
  }
  apps.sort((left, right) => right.activeSeconds - left.activeSeconds || left.appName.localeCompare(right.appName));

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
    if (live.activeSeconds < MINIMUM_LIVE_DURATION_SECONDS) continue;
    const existing = employeeUsage.find((row) => row.userId === live.userId);
    if (existing) existing.activeSeconds += live.activeSeconds;
    else employeeUsage.push({ ...live, idleSeconds: 0 });
  }
  employeeUsage.sort((left, right) => right.activeSeconds - left.activeSeconds || left.displayName.localeCompare(right.displayName));

  return { ...summary, apps, daily, employeeUsage };
}

function rangeIncludesUtcToday(summary: WorkMapApiUsageSummary) {
  const today = new Date().toISOString().slice(0, 10);
  return summary.range.from <= today && summary.range.to >= today;
}
