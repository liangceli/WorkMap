export type WorkMapRole = "EMPLOYEE" | "TEAM_LEAD" | "MANAGER" | "HR_ADMIN" | "IT_ADMIN" | "OWNER";

export type RequestContext = {
  companyId: string;
  userId: string;
  role: WorkMapRole;
};

export type WorkMapJwtPayload = {
  sub: string;
  companyId: string;
  role?: WorkMapRole;
  iat?: number;
  exp?: number;
};

export type CognitoJwtPayload = {
  sub: string;
  iss: string;
  token_use?: "id" | "access" | string;
  aud?: string;
  client_id?: string;
  email?: string;
  email_verified?: boolean | "true" | "false" | string;
  name?: string;
  username?: string;
  "cognito:username"?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
};

export type WorkMapCapability =
  | "manageCompany"
  | "inviteEmployees"
  | "viewEmployeeDirectory"
  | "viewEmployeeActivity"
  | "viewOwnReports"
  | "viewTeamReports"
  | "manageCompliancePolicy"
  | "viewComplianceStatus"
  | "manageIntegrations"
  | "viewDeviceHealth"
  | "accessTechnicalSettings"
  | "accessVirtualOffice"
  | "useContactLinks";

export const WORKMAP_ROLE_CAPABILITIES = {
  EMPLOYEE: [
    "viewEmployeeDirectory",
    "viewOwnReports",
    "accessVirtualOffice",
    "useContactLinks",
  ],
  TEAM_LEAD: [
    "viewEmployeeDirectory",
    "viewEmployeeActivity",
    "viewOwnReports",
    "viewTeamReports",
    "accessVirtualOffice",
    "useContactLinks",
  ],
  MANAGER: [
    "viewEmployeeDirectory",
    "viewEmployeeActivity",
    "viewOwnReports",
    "viewTeamReports",
    "accessVirtualOffice",
    "useContactLinks",
  ],
  HR_ADMIN: [
    "viewEmployeeDirectory",
    "viewEmployeeActivity",
    "viewOwnReports",
    "viewTeamReports",
    "manageCompliancePolicy",
    "viewComplianceStatus",
    "accessVirtualOffice",
    "useContactLinks",
  ],
  IT_ADMIN: [
    "viewEmployeeDirectory",
    "viewOwnReports",
    "manageIntegrations",
    "viewDeviceHealth",
    "accessTechnicalSettings",
    "accessVirtualOffice",
    "useContactLinks",
  ],
  OWNER: [
    "manageCompany",
    "inviteEmployees",
    "viewEmployeeDirectory",
    "viewEmployeeActivity",
    "viewOwnReports",
    "viewTeamReports",
    "manageCompliancePolicy",
    "viewComplianceStatus",
    "manageIntegrations",
    "viewDeviceHealth",
    "accessTechnicalSettings",
    "accessVirtualOffice",
    "useContactLinks",
  ],
} as const satisfies Record<WorkMapRole, readonly WorkMapCapability[]>;

export function roleHasCapability(role: WorkMapRole, capability: WorkMapCapability) {
  return (WORKMAP_ROLE_CAPABILITIES[role] as readonly WorkMapCapability[]).includes(capability);
}

export function hasCapability(actor: RequestContext, capability: WorkMapCapability) {
  return roleHasCapability(actor.role, capability);
}

export function canManageCompany(actor: RequestContext) {
  return hasCapability(actor, "manageCompany");
}

export function canInviteEmployees(actor: RequestContext) {
  return hasCapability(actor, "inviteEmployees");
}

export function canViewEmployeeDirectory(actor: RequestContext) {
  return hasCapability(actor, "viewEmployeeDirectory");
}

export function canViewEmployeeActivity(actor: RequestContext, targetUserId: string) {
  return actor.userId === targetUserId || hasCapability(actor, "viewEmployeeActivity");
}

export function canViewOwnReports(actor: RequestContext) {
  return hasCapability(actor, "viewOwnReports");
}

export function canViewTeamReports(actor: RequestContext) {
  return hasCapability(actor, "viewTeamReports");
}

export function canManageCompliance(actor: RequestContext) {
  return hasCapability(actor, "manageCompliancePolicy");
}

export function canViewComplianceStatus(actor: RequestContext) {
  return hasCapability(actor, "viewComplianceStatus");
}

export function canManageIntegrations(actor: RequestContext) {
  return hasCapability(actor, "manageIntegrations");
}

export function canViewDeviceHealth(actor: RequestContext) {
  return hasCapability(actor, "viewDeviceHealth");
}

export function canAccessTechnicalSettings(actor: RequestContext) {
  return hasCapability(actor, "accessTechnicalSettings");
}

export function canAccessVirtualOffice(actor: RequestContext) {
  return hasCapability(actor, "accessVirtualOffice");
}

export function canUseContactLinks(actor: RequestContext) {
  return hasCapability(actor, "useContactLinks");
}
