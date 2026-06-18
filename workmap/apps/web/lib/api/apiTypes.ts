import type { PlayerDirection, UserPresenceStatus } from "@workmap/shared-types";

export type ApiResult<T> =
  | { ok: true; data: T; source: "api" }
  | { ok: false; error: string; status?: number; source: "fallback" };

export type ApiClientOptions = {
  token?: string;
  baseUrl?: string;
};

export type WorkMapApiHealth = {
  status: "ok" | string;
  service: string;
  timestamp: string;
};

export type WorkMapApiUser = {
  id: string;
  email?: string;
  displayName: string;
  role?: string;
  department?: { id: string; name: string } | string | null;
  status?: UserPresenceStatus;
  avatarId?: string | null;
  jobTitle?: string | null;
  contactOnly?: boolean;
};

export type WorkMapApiDevelopmentToken = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: WorkMapApiAuthUser;
};

export type WorkMapApiAuthUser = {
  id: string;
  companyId: string;
  companySlug: string;
  email: string;
  displayName: string;
  role: string;
  avatarId?: string | null;
};

export type WorkMapApiCompany = {
  id: string;
  name: string;
  slug: string;
};

export type WorkMapApiRequestContext = {
  companyId: string;
  userId: string;
  role: string;
};

export type WorkMapApiPlatformContext = {
  platformRole: "PLATFORM_ADMIN";
  identity: {
    email: string;
    cognitoSub: string;
    displayName: string;
  };
  source: "cognito";
};

export type WorkMapApiPilotSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: WorkMapApiAuthUser;
};

export type WorkMapApiWorkspaceContext = {
  context: WorkMapApiRequestContext;
  user: WorkMapApiAuthUser;
  company: WorkMapApiCompany;
  onboarding: {
    createdWorkspace: boolean;
    acceptedInvite: boolean;
    nextRoute: string;
  };
};

export type WorkMapApiTenantStatus =
  | {
      state: "needs_workspace";
      cognito: {
        sub: string;
        email: string;
        displayName: string;
      };
    }
  | ({
      state: "workspace_ready";
      cognito: {
        sub: string;
        email: string;
        displayName: string;
      };
    } & WorkMapApiWorkspaceContext);

export type WorkMapApiInvitation = {
  id: string;
  invitedEmail: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  invitedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkMapApiCreateInvitationResponse = {
  invitation: WorkMapApiInvitation;
  inviteLink: string;
  token: string;
};

export type WorkMapApiInvitationList = {
  invitations: WorkMapApiInvitation[];
};

export type WorkMapApiOfficeRoom = {
  id: string;
  name: string;
  type: string;
  zoneData?: unknown;
  autoStatus?: UserPresenceStatus | null;
};

export type WorkMapApiOfficeMap = {
  id: string;
  name: string;
  slug: string;
  width: number;
  height: number;
  tileSize: number;
  mapData: unknown;
  rooms: WorkMapApiOfficeRoom[];
};

export type WorkMapApiNavigationDestination = {
  id: string;
  roomId?: string;
  name: string;
  type: string;
  description?: string;
  anchor?: unknown;
  bounds?: unknown;
  autoStatus?: UserPresenceStatus | null;
  peopleCount?: number;
};

export type WorkMapApiPlayerPosition = {
  userId: string;
  displayName: string;
  avatarId: string;
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
  updatedAt: string;
};

export type WorkMapApiSavePlayerPositionInput = {
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
};

export type WorkMapApiSavedPlayerPosition = WorkMapApiSavePlayerPositionInput & {
  userId: string;
  updatedAt: string;
};

export type WorkMapApiIntegration = {
  id: string;
  provider: string;
  status?: string;
  config?: unknown;
};

export type WorkMapApiContactLinks = {
  targetUserId?: string;
  displayName?: string;
  teamsChatUrl?: string;
  outlookMailtoUrl?: string;
  threeCxUrl?: string;
  teams?: string | { label?: string; href?: string; enabled?: boolean };
  email?: string;
  outlook?: string | { label?: string; href?: string; enabled?: boolean };
  call3cx?: string;
  threeCx?: string | { label?: string; href?: string; enabled?: boolean };
  calendar?: string;
};

export type WorkMapApiCompliancePolicy = {
  id: string;
  name: string;
  collectAppUsage: boolean;
  collectWebsiteDomain: boolean;
  collectFullUrl: boolean;
  collectScreenshots: boolean;
  collectKeystrokes: boolean;
  workHoursOnly: boolean;
  workdayStart: string;
  workdayEnd: string;
  retentionDays: number;
  employeeCanViewOwnData: boolean;
  policyVersion: string;
  activeFrom: string;
};

export type WorkMapApiPolicyAcknowledgement = {
  id: string;
  monitoringPolicyId: string;
  acknowledgedAt: string;
};

export type WorkMapApiUsageSummary = {
  scope?: "user" | "company";
  userId: string | null;
  apps: Array<{
    appName: string;
    category: string | null;
    productivityLabel: string | null;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  websites: Array<{
    domain: string;
    category: string | null;
    productivityLabel: string | null;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  deviceCoverage?: {
    registeredDevices: number;
    activeDevices24h: number;
    usersWithActivity: number;
  };
};

export type WorkMapApiDevice = {
  id: string;
  os: string;
  hostname: string | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
};

export type WorkMapApiDeviceRegistration = {
  device: WorkMapApiDevice;
};

export type WorkMapApiActivityIngestResult = {
  accepted: number;
  source: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
  eventType: "APP" | "BROWSER";
};

export type WorkMapApiPlatformTenantSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  ownerCount: number;
  employeeCount: number;
  userCount: number;
  deviceCount: number;
  inviteCount: number;
  integrationCount: number;
  policyConfigured: boolean;
  defaultOfficeMapConfigured: boolean;
};

export type WorkMapApiPlatformTenantHealth = {
  readiness: {
    hasOwner: boolean;
    hasUsers: boolean;
    hasDefaultOfficeMap: boolean;
    hasMonitoringPolicy: boolean;
  };
  counts: {
    owners: number;
    users: number;
    pendingInvites: number;
    devices: number;
    activeDevices24h: number;
    enabledIntegrations: number;
  };
  lastActivityAt: string | null;
  lastVirtualOfficePositionAt: string | null;
};

export type WorkMapApiPlatformTenantList = {
  tenants: WorkMapApiPlatformTenantSummary[];
};

export type WorkMapApiPlatformTenantDetail = {
  tenant: WorkMapApiPlatformTenantSummary & {
    roleCounts: Record<string, number>;
  };
  health: WorkMapApiPlatformTenantHealth;
};

export type WorkMapApiPlatformTenantHealthResponse = {
  health: WorkMapApiPlatformTenantHealth;
};

export type WorkMapApiPlatformAuditList = {
  audit: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    targetCompany: {
      id: string;
      name: string;
      slug: string;
    } | null;
    actor: {
      email: string | null;
      cognitoSub: string | null;
      displayName: string | null;
      platformRole: string;
    };
    metadata: unknown;
    createdAt: string;
  }>;
};
