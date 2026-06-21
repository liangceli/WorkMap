"use client";

import { useEffect, useState } from "react";
import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type { WorkMapApiUser } from "../../lib/api/apiTypes";
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

      const result = await listUsers(auth.options);

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

      setDirectoryState({
        loading: false,
        source: "api",
        employees: result.data.map(toDirectoryEmployee),
        statusText: `${result.data.length} same-workspace users loaded from GET /users.`,
      });
    }

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  const showManagerActions = activeRole === "MANAGER" || activeRole === "OWNER";

  return (
    <AppShell>
      <section style={styles.shell}>
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

        <WorkMapPrivacyNotice title={directoryState.source === "api" ? "Backend directory" : "Directory unavailable"}>
          {directoryState.loading
            ? "Checking whether this browser has an authenticated WorkMap API context."
            : directoryState.statusText}
        </WorkMapPrivacyNotice>

        <EmployeeDirectory employees={directoryState.employees} showProfileLinks={directoryState.source !== "api"} />
      </section>
    </AppShell>
  );
}

function toDirectoryEmployee(user: WorkMapApiUser): DashboardEmployee {
  const status = user.status ?? "offline";
  const backendAvatar = decodeLayeredAvatarId(user.avatarId);

  return {
    id: user.id,
    name: user.displayName,
    role: user.jobTitle || formatRole(user.role) || "Team member",
    department: readDepartmentName(user.department),
    status,
    localTime: "Backend directory",
    avatar: backendAvatar ?? defaultLayeredAvatarConfig,
    activeTime: "API scoped",
    idleTime: "Contact view",
    topApp: "Not shown",
    topDomain: "Not shown",
    deviceHealth: status === "offline" ? "offline" : "online",
  };
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

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
