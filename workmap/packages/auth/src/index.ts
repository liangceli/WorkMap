export type WorkMapRole = "EMPLOYEE" | "TEAM_LEAD" | "MANAGER" | "HR_ADMIN" | "IT_ADMIN" | "OWNER";

export type RequestContext = {
  companyId: string;
  userId: string;
  role: WorkMapRole;
};

const MANAGER_ROLES = new Set<WorkMapRole>(["TEAM_LEAD", "MANAGER", "HR_ADMIN", "OWNER"]);
const ADMIN_ROLES = new Set<WorkMapRole>(["HR_ADMIN", "IT_ADMIN", "OWNER"]);

export function canViewEmployeeActivity(actor: RequestContext, targetUserId: string) {
  return actor.userId === targetUserId || MANAGER_ROLES.has(actor.role);
}

export function canManageCompliance(actor: RequestContext) {
  return ADMIN_ROLES.has(actor.role);
}

export function canManageIntegrations(actor: RequestContext) {
  return actor.role === "IT_ADMIN" || actor.role === "OWNER";
}

export function canViewDeviceHealth(actor: RequestContext) {
  return actor.role === "IT_ADMIN" || actor.role === "OWNER" || actor.role === "MANAGER";
}
