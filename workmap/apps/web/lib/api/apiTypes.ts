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
  department?: string | null;
  status?: UserPresenceStatus;
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
};

export type WorkMapApiPilotSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: WorkMapApiAuthUser;
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
  name: string;
  type: string;
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
  teams?: string;
  email?: string;
  call3cx?: string;
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
  userId: string;
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
};
