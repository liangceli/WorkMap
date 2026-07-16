"use client";

import { useEffect, useState } from "react";
import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { AppShell } from "../../components/layout/AppShell";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type { WorkMapApiPlayerPosition, WorkMapApiUser } from "../../lib/api/apiTypes";
import { listDevices } from "../../lib/api/devicesApi";
import { getAgentLiveStatus, getUsageSummary } from "../../lib/api/reportsApi";
import { listUsers } from "../../lib/api/usersApi";
import { getVirtualOfficeMap, listVirtualOfficePositions } from "../../lib/api/virtualOfficeApi";
import { decodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { defaultLayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";
import { statusFromFreshness } from "../../components/office/presence";
import {
  aggregateEmployeeActivityByUser,
  buildDeviceHealthByUser,
  deriveDeviceActivityStatus,
  deriveDeviceHealth,
  type AggregatedEmployeeActivity,
  type DeviceHealth,
} from "../../lib/people/peopleStatus";
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
      const [result, devicesResult, usageSummaryResult, liveStatusResult, officeMapResult] = await Promise.all([
        listUsers(auth.options),
        listDevices(auth.options),
        canLoadCompanyReports
          ? getUsageSummary({
            ...auth.options,
            scope: "company",
            from: today,
            to: today,
            includeAudit: false,
            includeLive: false,
          })
          : Promise.resolve(null),
        canLoadCompanyReports
          ? getAgentLiveStatus({ ...auth.options, scope: "company", from: today, to: today })
          : Promise.resolve(null),
        getVirtualOfficeMap(auth.options),
      ]);

      const positionsResult = officeMapResult.ok ? await listVirtualOfficePositions(officeMapResult.data.id, auth.options) : null;

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
      const activityByUser = aggregateEmployeeActivityByUser(usageSummary, liveStatus);
      const deviceHealthByUser = buildDeviceHealthByUser(devices, usageSummary, liveStatus);
      const virtualStatusByUser = buildVirtualStatusByUser(positionsResult?.ok ? positionsResult.data : []);
      const reportsLoaded = Boolean(usageSummary || liveStatus);

      setDirectoryState({
        loading: false,
        source: "api",
        employees: result.data.map((user) => toDirectoryEmployee(
          user,
          activityByUser.get(user.id),
          deviceHealthByUser.get(user.id),
          virtualStatusByUser.get(user.id),
          reportsLoaded,
        )),
        statusText: buildStatusText(
          result.data.length,
          canLoadCompanyReports,
          usageSummaryResult,
          liveStatusResult,
          devicesResult.ok,
          positionsResult?.ok === true,
        ),
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

function toDirectoryEmployee(
  user: WorkMapApiUser,
  activity: AggregatedEmployeeActivity | undefined,
  deviceHealth: DeviceHealth | undefined,
  virtualStatus: WorkMapApiPlayerPosition["status"] | undefined,
  reportsLoaded: boolean,
): DashboardEmployee {
  const hasActivity = Boolean(activity && activity.activeSeconds + activity.idleSeconds > 0);
  const status = virtualStatus ?? (user.status && (user.status !== "offline" || !hasActivity) ? user.status : hasActivity ? "available" : "offline");
  const resolvedDeviceHealth = deriveDeviceHealth(activity, deviceHealth);
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
    deviceHealth: resolvedDeviceHealth,
    deviceStatus: deriveDeviceActivityStatus(activity, resolvedDeviceHealth),
  };
}

function buildVirtualStatusByUser(positions: WorkMapApiPlayerPosition[]) {
  return new Map(positions.map((position) => [position.userId, statusFromFreshness(position.status, position.updatedAt)]));
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
  positionsLoaded: boolean,
) {
  if (!canLoadCompanyReports) {
    return `${userCount} same-workspace users loaded from GET /users${devicesLoaded ? " + /devices" : ""}${positionsLoaded ? " + virtual-office positions" : ""}. Activity summaries require manager report access.`;
  }

  const summaryLoaded = usageSummaryResult?.ok === true;
  const liveLoaded = liveStatusResult?.ok === true;
  if (summaryLoaded && liveLoaded) {
    return `${userCount} users aggregated from /users${devicesLoaded ? " + /devices" : ""}${positionsLoaded ? " + virtual-office positions" : ""} + today's company reports.`;
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
