import type { PlayerDirection, UserPresenceStatus } from "@workmap/shared-types";

export type ApiResult<T> =
  | { ok: true; data: T; source: "api" }
  | { ok: false; error: string; status?: number; source: "fallback" };

export type ApiClientOptions = {
  token?: string;
  baseUrl?: string;
};

export type WorkMapApiUser = {
  id: string;
  email?: string;
  displayName: string;
  role?: string;
  department?: string | null;
  status?: UserPresenceStatus;
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

export type WorkMapApiUsageSummary = {
  userId?: string;
  range?: string;
  activeTime?: string;
  idleTime?: string;
  apps?: Array<{ name: string; duration: string; share?: string }>;
  domains?: Array<{ domain: string; duration: string; share?: string }>;
};
