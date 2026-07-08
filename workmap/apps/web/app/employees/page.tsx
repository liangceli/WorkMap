"use client";

import { useEffect, useState } from "react";
import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { AppShell } from "../../components/layout/AppShell";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type { WorkMapApiDevice, WorkMapApiReportLiveStatus, WorkMapApiUsageSummary, WorkMapApiUser } from "../../lib/api/apiTypes";
import { listDevices } from "../../lib/api/devicesApi";
import { getAgentLiveStatus, getUsageSummary } from "../../lib/api/reportsApi";
import { listUsers } from "../../lib/api/usersApi";
import { decodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { defaultLayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";
import { wmStyles } from "../../lib/theme/workmapTheme";
import { getUserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";
import type { DashboardEmployee } from "../../components/dashboard/mockDashboardData";

type DirectoryState = {
  loading: boolean;
  source: "checking" | "api" | "fallback";
  employees: DashboardEmployee[];
  statusText: string;
};

const initialDirectoryState: DirectoryState = {
  loading: true,
  source: "checking",
  employees: [],
  statusText: "Checking backend users API...",
};

export default function EmployeesPage() {
  const [directoryState, setDirectoryState] = useState<DirectoryState>(initialDirectoryState);
  const [activeRole, setActiveRole] = useState<WorkMapRole | null>(null);

  useEffect(() => {
    setActiveRole(getUserSetupState()?.role ?? null);

    let cancelled = false;

    async function loadDirectory() {
      const auth = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      if (!auth.available) {
        setDirectoryState({
          loading: false,
          source: "fallback",
          employees: [],
          statusText: `Sign in with Cognito to load the workspace directory. ${auth.reason}`,
        });
        return;
      }

      setActiveRole(toWorkflowRole(auth.role));

      const today = toUtcDateOnly(new Date());
      const canLoadCompanyReports = canRequestCompanyReports(auth.role);
      const [result, devicesResult, usageSummaryResult, liveStatusResult] = await Promise.all([
        listUsers(auth.options),
        listDevices(auth.options),
        canLoadCompanyReports
          ? getUsageSummary({ ...auth.options, scope: "company", from: today, to: today })
          : Promise.resolve(null),
        canLoadCompanyReports
          ? getAgentLiveStatus({ ...auth.options, scope: "company", from: today, to: today })
          : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setDirectoryState({
          loading: false,
          source: "fallback",
          employees: [],
          statusText: `Workspace directory could not be loaded: ${result.error}`,
        });
        return;
      }

      const usageSummary = usageSummaryResult?.ok ? usageSummaryResult.data : null;
      const liveStatus = liveStatusResult?.ok && liveStatusResult.data.scope === "company" ? liveStatusResult.data : null;
      const devices = devicesResult.ok ? devicesResult.data : [];
      const aggregated = aggregateDirectoryActivity(usageSummary, liveStatus, devices);
      const reportsLoaded = Boolean(usageSummary || liveStatus);

      setDirectoryState({
        loading: false,
        source: "api",
        employees: result.data.map((user) => toDirectoryEmployee(user, aggregated.byUser.get(user.id), aggregated.deviceHealthByUser.get(user.id), reportsLoaded)),
        statusText: buildStatusText(result.data.length, canLoadCompanyReports, usageSummaryResult, liveStatusResult, devicesResult.ok),
      });
    }

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  const showManagerActions = activeRole === "MANAGER" || activeRole === "OWNER";

  return (
    <AppShell variant="editorial">
      <section className="wm-redesign-page wm-employees-page" style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="People directory"
          title="Employees"
          subtitle="Find teammates, check presence, and launch contact actions from one quiet workspace."
          actions={
            <>
              {showManagerActions ? <WorkMapButton href="/dashboard">Dashboard</WorkMapButton> : null}
              <WorkMapButton href="/virtual-office" tone="primary">Open office</WorkMapButton>
            </>
          }
        />

        <EmployeeDirectory
          employees={directoryState.employees}
          showProfileLinks={directoryState.source !== "api"}
          loading={directoryState.loading}
          statusText={directoryState.statusText}
        />
      </section>
    </AppShell>
  );
}

type AggregatedEmployeeActivity = {
  activeSeconds: number;
  idleSeconds: number;
  topApp: string | null;
  topDomain: string | null;
};

type BrowserCoverage = WorkMapApiUsageSummary["browserExtensionCoverage"][number];
type DeviceHealth = NonNullable<DashboardEmployee["deviceHealth"]>;

function toDirectoryEmployee(
  user: WorkMapApiUser,
  activity: AggregatedEmployeeActivity | undefined,
  deviceHealth: DeviceHealth | undefined,
  reportsLoaded: boolean,
): DashboardEmployee {
  const hasActivity = Boolean(activity && activity.activeSeconds + activity.idleSeconds > 0);
  const status = user.status && (user.status !== "offline" || !hasActivity) ? user.status : hasActivity ? "available" : "offline";
  const backendAvatar = decodeLayeredAvatarId(user.avatarId);

  return {
    id: user.id,
    name: user.displayName,
    role: user.jobTitle || formatRole(user.role) || "Team member",
    roleGroup: isEmployeeRole(user.role) ? "employee" : "manager",
    department: readDepartmentName(user.department),
    status,
    localTime: reportsLoaded ? (hasActivity ? "Activity today" : "No activity today") : "Team directory",
    avatar: backendAvatar ?? defaultLayeredAvatarConfig,
    activeTime: activity ? formatDuration(activity.activeSeconds) : reportsLoaded ? "0m" : "Report unavailable",
    idleTime: activity ? formatDuration(activity.idleSeconds) : reportsLoaded ? "0m" : "Report unavailable",
    topApp: activity?.topApp ?? (reportsLoaded ? "No app data" : "Report unavailable"),
    topDomain: activity?.topDomain ?? (reportsLoaded ? "No domain data" : "Report unavailable"),
    deviceHealth: deriveDeviceHealth(activity, deviceHealth),
  };
}

function aggregateDirectoryActivity(
  usageSummary: WorkMapApiUsageSummary | null,
  liveStatus: Extract<WorkMapApiReportLiveStatus, { scope: "company" }> | null,
  devices: WorkMapApiDevice[],
) {
  const byUser = new Map<string, AggregatedEmployeeActivity>();
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

  return { byUser, deviceHealthByUser };
}

function deriveDeviceHealth(activity: AggregatedEmployeeActivity | undefined, deviceHealth: DeviceHealth | undefined) {
  if (activity && activity.activeSeconds + activity.idleSeconds > 0) {
    return "online";
  }

  return deviceHealth ?? "offline";
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

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function buildStatusText(
  userCount: number,
  canLoadCompanyReports: boolean,
  usageSummaryResult: Awaited<ReturnType<typeof getUsageSummary>> | null,
  liveStatusResult: Awaited<ReturnType<typeof getAgentLiveStatus>> | null,
  devicesLoaded: boolean,
) {
  if (!canLoadCompanyReports) {
    return `${userCount} same-workspace users loaded from GET /users${devicesLoaded ? " + /devices" : ""}. Activity summaries require manager report access.`;
  }

  const summaryLoaded = usageSummaryResult?.ok === true;
  const liveLoaded = liveStatusResult?.ok === true;
  if (summaryLoaded && liveLoaded) {
    return `${userCount} users aggregated from /users${devicesLoaded ? " + /devices" : ""} + today's company reports.`;
  }

  const errors = [
    usageSummaryResult && !usageSummaryResult.ok ? `usage summary: ${usageSummaryResult.error}` : null,
    liveStatusResult && !liveStatusResult.ok ? `live status: ${liveStatusResult.error}` : null,
  ].filter(Boolean);

  return `${userCount} users loaded from /users. Activity aggregation partial${errors.length > 0 ? ` (${errors.join("; ")})` : ""}.`;
}

function canRequestCompanyReports(role: string) {
  return role === "OWNER" || role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN";
}

function toWorkflowRole(role: string): WorkMapRole | null {
  if (role === "OWNER" || role === "MANAGER" || role === "EMPLOYEE" || role === "IT_ADMIN") {
    return role;
  }

  if (role === "TEAM_LEAD" || role === "HR_ADMIN") {
    return "MANAGER";
  }

  return null;
}

function toUtcDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readDepartmentName(department: WorkMapApiUser["department"]) {
  if (!department) {
    return "General";
  }

  if (typeof department === "string") {
    return department;
  }

  return department.name;
}

function formatRole(role: string | undefined) {
  return role ? role.replace(/_/g, " ") : "";
}

function isEmployeeRole(role: string | undefined) {
  return (role ?? "").toUpperCase() === "EMPLOYEE";
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
