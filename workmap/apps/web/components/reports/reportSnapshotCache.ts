import type { WorkMapApiReportLiveStatus, WorkMapApiTrackingAudit, WorkMapApiUsageSummary } from "../../lib/api/apiTypes";

export type ReportSnapshot = {
  summary: WorkMapApiUsageSummary | null;
  liveStatus: WorkMapApiReportLiveStatus | null;
  audit: WorkMapApiTrackingAudit | null;
  cachedAt: number;
  summaryCachedAt: number;
  liveCachedAt: number;
  auditCachedAt: number;
};

const MAX_SNAPSHOTS = 20;
const SNAPSHOT_TTL_MS = 5 * 60_000;
const snapshots = new Map<string, ReportSnapshot>();

export function readReportSnapshot(key: string, now = Date.now()) {
  const snapshot = snapshots.get(key);
  if (!snapshot) return null;
  if (now - snapshot.cachedAt > SNAPSHOT_TTL_MS) {
    snapshots.delete(key);
    return null;
  }
  return snapshot;
}

export function updateReportSnapshot(
  key: string,
  updates: Partial<Omit<ReportSnapshot, "cachedAt">>,
  now = Date.now(),
) {
  const existing = readReportSnapshot(key, now);
  const hasSummary = updates.summary !== undefined;
  const hasLiveStatus = updates.liveStatus !== undefined;
  const hasAudit = updates.audit !== undefined;
  const snapshot: ReportSnapshot = {
    summary: updates.summary ?? existing?.summary ?? null,
    liveStatus: updates.liveStatus ?? existing?.liveStatus ?? null,
    audit: updates.audit ?? existing?.audit ?? null,
    cachedAt: now,
    summaryCachedAt: hasSummary ? now : existing?.summaryCachedAt ?? 0,
    liveCachedAt: hasLiveStatus ? now : existing?.liveCachedAt ?? 0,
    auditCachedAt: hasAudit ? now : existing?.auditCachedAt ?? 0,
  };
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  trimSnapshots();
  return snapshot;
}

function trimSnapshots() {
  while (snapshots.size > MAX_SNAPSHOTS) {
    const oldestKey = snapshots.keys().next().value;
    if (!oldestKey) return;
    snapshots.delete(oldestKey);
  }
}
