import type { WorkMapApiDevice, WorkMapApiReportLiveStatus, WorkMapApiUsageSummary } from "../api/apiTypes";

export type AggregatedEmployeeActivity = {
  activeSeconds: number;
  idleSeconds: number;
  topApp: string | null;
  topDomain: string | null;
};

export type DeviceHealth = "online" | "delayed" | "offline";

export type DeviceActivityStatus =
  | "focus_active"
  | "focused_idle"
  | "open_runtime"
  | "signal_delayed"
  | "device_offline"
  | "no_report";

type CompanyLiveStatus = Extract<WorkMapApiReportLiveStatus, { scope: "company" }> | null;
type BrowserCoverage = WorkMapApiUsageSummary["browserExtensionCoverage"][number];

export function aggregateEmployeeActivityByUser(
  usageSummary: WorkMapApiUsageSummary | null,
  liveStatus: CompanyLiveStatus,
) {
  const byUser = new Map<string, AggregatedEmployeeActivity>();

  for (const row of usageSummary?.employeeUsage ?? []) {
    byUser.set(row.userId, {
      activeSeconds: row.activeSeconds,
      idleSeconds: row.idleSeconds,
      topApp: row.topApp ?? null,
      topDomain: row.topDomain ?? null,
    });
  }

  for (const row of liveStatus?.employeeUsage ?? []) {
    const current = byUser.get(row.userId) ?? { activeSeconds: 0, idleSeconds: 0, topApp: null, topDomain: null };
    current.activeSeconds += row.activeSeconds;
    current.idleSeconds += row.idleSeconds ?? 0;
    current.topApp = row.topApp ?? current.topApp;
    current.topDomain = row.topDomain ?? current.topDomain;
    byUser.set(row.userId, current);
  }

  return byUser;
}

export function buildDeviceHealthByUser(
  devices: WorkMapApiDevice[],
  usageSummary: WorkMapApiUsageSummary | null,
  liveStatus: CompanyLiveStatus,
) {
  const deviceHealthByUser = new Map<string, DeviceHealth>();

  for (const device of devices) {
    const userId = device.user?.id;
    if (!userId || device.revokedAt || isBrowserExtensionDevice(device)) {
      continue;
    }
    mergeDeviceHealth(deviceHealthByUser, userId, healthFromLastSignal(device.lastSeenAt));
  }

  for (const coverage of usageSummary?.browserExtensionCoverage ?? []) {
    mergeDeviceHealth(deviceHealthByUser, coverage.userId, healthFromBrowserCoverage(coverage));
  }
  for (const coverage of liveStatus?.browserExtensionCoverage ?? []) {
    mergeDeviceHealth(deviceHealthByUser, coverage.userId, healthFromBrowserCoverage(coverage));
  }

  return deviceHealthByUser;
}

export function deriveDeviceHealth(activity: AggregatedEmployeeActivity | undefined, deviceHealth: DeviceHealth | undefined) {
  if (activity && activity.activeSeconds + activity.idleSeconds > 0) {
    return "online";
  }

  return deviceHealth ?? "offline";
}

export function deriveDeviceActivityStatus(activity: AggregatedEmployeeActivity | undefined, health: DeviceHealth): DeviceActivityStatus {
  if (activity && activity.activeSeconds > 0) {
    return "focus_active";
  }

  if (activity && activity.idleSeconds > 0) {
    return "focused_idle";
  }

  if (health === "online") {
    return "open_runtime";
  }

  if (health === "delayed") {
    return "signal_delayed";
  }

  if (health === "offline") {
    return "device_offline";
  }

  return "no_report";
}

export function deviceActivityStatusLabel(status: DeviceActivityStatus) {
  switch (status) {
    case "focus_active":
      return "Focus active";
    case "focused_idle":
      return "Focused idle";
    case "open_runtime":
      return "Open/runtime";
    case "signal_delayed":
      return "Signal delayed";
    case "device_offline":
      return "Device offline";
    case "no_report":
      return "No report signal";
  }
}

function isBrowserExtensionDevice(device: WorkMapApiDevice) {
  return device.agentVersion?.startsWith("browser-extension-mv3/") === true;
}

function healthFromBrowserCoverage(coverage: BrowserCoverage): DeviceHealth {
  return coverage.state === "connected" ? "online" : "delayed";
}

function healthFromLastSignal(lastSeenAt: string | null): DeviceHealth {
  if (!lastSeenAt) {
    return "offline";
  }

  const signalAgeMs = Date.now() - Date.parse(lastSeenAt);
  if (!Number.isFinite(signalAgeMs)) {
    return "offline";
  }

  if (signalAgeMs <= 30_000) {
    return "online";
  }

  if (signalAgeMs <= 120_000) {
    return "delayed";
  }

  return "offline";
}

function mergeDeviceHealth(target: Map<string, DeviceHealth>, userId: string, next: DeviceHealth) {
  const current = target.get(userId);
  if (!current || healthRank(next) > healthRank(current)) {
    target.set(userId, next);
  }
}

function healthRank(health: DeviceHealth) {
  return health === "online" ? 2 : health === "delayed" ? 1 : 0;
}
