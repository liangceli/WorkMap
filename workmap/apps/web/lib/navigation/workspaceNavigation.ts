import type { WorkMapRole } from "../workflow/workflowState";

export type WorkspaceNavigationItem = {
  label: string;
  description: string;
  href: string;
  group: "workspace" | "insight" | "admin";
  roles: WorkMapRole[];
};

export const workspaceNavigationItems: WorkspaceNavigationItem[] = [
  {
    label: "Employees",
    description: "People directory",
    href: "/employees",
    group: "workspace",
    roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"],
  },
  {
    label: "Dashboard",
    description: "Workspace overview",
    href: "/dashboard",
    group: "insight",
    roles: ["MANAGER", "OWNER"],
  },
  {
    label: "Reports",
    description: "Activity and work insights",
    href: "/reports",
    group: "insight",
    roles: ["MANAGER", "OWNER", "IT_ADMIN"],
  },
  {
    label: "Compliance",
    description: "Privacy and policy",
    href: "/compliance",
    group: "insight",
    roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"],
  },
  {
    label: "Office",
    description: "Live team presence",
    href: "/virtual-office",
    group: "workspace",
    roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"],
  },
  {
    label: "Invites",
    description: "Invite workspace members",
    href: "/onboarding/invite",
    group: "admin",
    roles: ["OWNER"],
  },
  {
    label: "Integrations",
    description: "Connected workplace tools",
    href: "/integrations",
    group: "admin",
    roles: ["OWNER", "IT_ADMIN"],
  },
  {
    label: "Settings",
    description: "Workspace configuration",
    href: "/settings",
    group: "admin",
    roles: ["OWNER", "IT_ADMIN"],
  },
];

export function getWorkspaceNavigationItemsForRole(role: WorkMapRole) {
  return workspaceNavigationItems.filter((item) => item.roles.includes(role));
}

export function getVirtualOfficeNavigationItemsForRole(role: WorkMapRole) {
  return getWorkspaceNavigationItemsForRole(role).filter((item) => item.href !== "/virtual-office");
}

export function toWorkflowRole(role: string | undefined): WorkMapRole {
  if (role === "OWNER") {
    return "OWNER";
  }

  if (role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN") {
    return "MANAGER";
  }

  if (role === "IT_ADMIN") {
    return "IT_ADMIN";
  }

  return "EMPLOYEE";
}
