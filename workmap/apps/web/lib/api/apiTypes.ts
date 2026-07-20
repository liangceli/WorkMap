import type { PlayerDirection, UserPresenceStatus, VirtualOfficeReaction } from "@workmap/shared-types";

export type ApiResult<T> =
  | { ok: true; data: T; source: "api" }
  | { ok: false; error: string; status?: number; source: "fallback" };

export type ApiClientOptions = {
  token?: string;
  baseUrl?: string;
  authSource?: "cognito";
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

export type WorkMapApiInvitationPreview = {
  invitedEmail: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  company: {
    id: string;
    name: string;
    slug: string;
  };
  expiresAt: string;
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
  scheduleTimeZone: string | null;
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
  scope: "user" | "company";
  userId: string | null;
  departmentId: string | null;
  range: {
    from: string;
    to: string;
    timeZone: "UTC";
  };
  apps: Array<{
    appName: string;
    category: string | null;
    productivityLabel: string | null;
    activeSeconds: number;
    idleSeconds: number;
    focusActiveSeconds?: number;
    focusedIdleSeconds?: number;
    openRuntimeSeconds?: number;
  }>;
  websites: Array<{
    domain: string;
    category: string | null;
    productivityLabel: string | null;
    activeSeconds: number;
    idleSeconds: number;
    focusActiveSeconds?: number;
    focusedIdleSeconds?: number;
    openRuntimeSeconds?: number;
  }>;
  daily: Array<{
    date: string;
    appActiveSeconds: number;
    appIdleSeconds: number;
    domainActiveSeconds: number;
    domainIdleSeconds: number;
  }>;
  deviceCoverage?: {
    registeredDevices: number;
    activeDevices24h: number;
    usersWithActivity: number;
  };
  browserExtensionCoverage: Array<{
    deviceId: string;
    userId: string;
    displayName: string;
    browserName: "CHROME" | "EDGE" | "UNKNOWN";
    version: string | null;
    state: "connected" | "signal_lost";
    enabledAt: string;
    lastSignalAt: string | null;
    currentDomain: string | null;
    currentDomainObservedAt: string | null;
    coverageLostDetectedAt: string | null;
    coverageRestoredAt: string | null;
    trackingState: "ready" | "permission_required" | "registration_failed" | null;
    trackingStatusObservedAt: string | null;
  }>;
  agentStatus: null | {
    state:
      | "not_paired"
      | "running"
      | "stopped_by_user"
      | "network_offline"
      | "device_shutdown"
      | "sleeping"
      | "locked"
      | "agent_crashed"
      | "agent_terminated"
      | "server_unreachable"
      | "unknown_interrupted";
    sessionId?: string;
    deviceId?: string;
    hostname?: string | null;
    agentVersion?: string | null;
    startedAt?: string;
    lastHeartbeatAt?: string;
    heartbeatAgeSeconds?: number;
    isFresh?: boolean;
    endedAt?: string | null;
    endReason?: "GRACEFUL_SHUTDOWN" | "UNEXPECTED_STOP" | "USER_STOP" | "DEVICE_SHUTDOWN" | "SUSPENDED" | "AGENT_CRASHED" | "AGENT_TERMINATED" | "UNKNOWN_INTERRUPTED" | null;
    statusReason?: "AGENT_STARTED" | "USER_STOP" | "SYSTEM_SHUTDOWN" | "SYSTEM_SUSPEND" | "SYSTEM_RESUME" | "SYSTEM_LOCK" | "SYSTEM_UNLOCK" | "NETWORK_UNAVAILABLE" | "SERVER_REQUEST_FAILED" | "PROCESS_CRASH" | "PROCESS_TERMINATED" | "HEARTBEAT_TIMEOUT" | "AGENT_RESTART" | "UNKNOWN" | null;
    statusConfidence?: "CONFIRMED" | "INFERRED" | null;
    statusRecordedAt?: string | null;
    currentAppName?: string | null;
    currentAppStartedAt?: string | null;
    currentAppActiveSeconds?: number;
    currentAppFocusedIdleSeconds?: number;
    todayActiveSeconds?: number;
  };
  agentSessions: Array<{
    id: string;
    startedAt: string;
    lastHeartbeatAt: string;
    endedAt: string | null;
    endReason: "GRACEFUL_SHUTDOWN" | "UNEXPECTED_STOP" | "USER_STOP" | "DEVICE_SHUTDOWN" | "SUSPENDED" | "AGENT_CRASHED" | "AGENT_TERMINATED" | "UNKNOWN_INTERRUPTED" | null;
  }>;
  deviceStatusHistory: Array<{
    id: string;
    deviceId: string;
    agentSessionId: string | null;
    status: "RUNNING" | "STOPPED_BY_USER" | "NETWORK_OFFLINE" | "DEVICE_SHUTDOWN" | "SLEEPING" | "LOCKED" | "AGENT_CRASHED" | "AGENT_TERMINATED" | "SERVER_UNREACHABLE" | "UNKNOWN_INTERRUPTED" | "RECONNECTED" | "RESTARTED";
    reason: "AGENT_STARTED" | "USER_STOP" | "SYSTEM_SHUTDOWN" | "SYSTEM_SUSPEND" | "SYSTEM_RESUME" | "SYSTEM_LOCK" | "SYSTEM_UNLOCK" | "NETWORK_UNAVAILABLE" | "SERVER_REQUEST_FAILED" | "PROCESS_CRASH" | "PROCESS_TERMINATED" | "HEARTBEAT_TIMEOUT" | "AGENT_RESTART" | "UNKNOWN";
    startedAt: string;
    endedAt: string | null;
    lastHeartbeatAt: string | null;
    recordedAt: string;
    receivedAt: string;
    source: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
    timeZone: string | null;
    confidence: "CONFIRMED" | "INFERRED";
  }>;
  appTimeline: Array<{
    appName: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
  }>;
  employeeUsage: Array<{
    userId: string;
    displayName: string;
    activeSeconds: number;
    idleSeconds: number;
    topApp?: string | null;
    topDomain?: string | null;
  }>;
  activityRevision: string | null;
  trackingV2Coverage?: {
    activatedDeviceCount: number;
    openRuntimeEnabled: boolean;
    reconciliationState: "RECONCILED" | "LEDGER_FALLBACK";
    dirtyDates: Array<{
      userId: string;
      source: "DESKTOP_APP" | "BROWSER_DOMAIN";
      date: string;
      state: string;
      errorCode: string | null;
    }>;
    latestIncludedReceivedAt: string | null;
  };
};

export type WorkMapApiPolicyScheduleTimeZone = {
  id: string;
  policyVersion: string;
  scheduleTimeZone: string;
  scheduleTimeZoneState: "CONFIRMED";
};

export type WorkMapApiPolicyWorkHours = {
  id: string;
  policyVersion: string;
  workHoursOnly: boolean;
  workdayStart: string;
  workdayEnd: string;
  scheduleTimeZone: string | null;
};

export type WorkMapApiTrackingAudit = {
  scope: "user" | "company";
  userId: string | null;
  agentSessions: WorkMapApiUsageSummary["agentSessions"];
  deviceStatusHistory: WorkMapApiUsageSummary["deviceStatusHistory"];
  appTimeline: WorkMapApiUsageSummary["appTimeline"];
};

export type WorkMapApiReportLiveStatus =
  | {
      scope: "user";
      userId: string;
      departmentId: null;
      agentStatus: WorkMapApiUsageSummary["agentStatus"];
      browserExtensionCoverage: WorkMapApiUsageSummary["browserExtensionCoverage"];
      activityRevision: string | null;
    }
  | {
      scope: "company";
      userId: null;
      departmentId: string | null;
      apps: Array<{ appName: string; activeSeconds: number; focusedIdleSeconds?: number }>;
      employeeUsage: Array<{
        userId: string;
        displayName: string;
        activeSeconds: number;
        idleSeconds?: number;
        topApp?: string | null;
        topDomain?: string | null;
      }>;
      browserExtensionCoverage: WorkMapApiUsageSummary["browserExtensionCoverage"];
      activityRevision: string | null;
    };

export type WorkMapApiTrackingV2LiveActivity = {
  serverTime: string;
  devices: Array<{
    deviceId: string;
    userId: string;
    displayName: string;
    clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
    source: "DESKTOP_APP" | "BROWSER_DOMAIN";
    browserName: "CHROME" | "EDGE" | null;
    workstationId: string | null;
    workstationName: string | null;
    hostname: string | null;
    clientVersion: string | null;
    protocolActivatedAt: string | null;
    /** Backward-compatible alias for connectionFresh. */
    fresh: boolean;
    /** Backward-compatible alias for connectionFreshnessAgeMs. */
    freshnessAgeMs: number | null;
    freshnessLimitMs: number;
    connectionFresh: boolean;
    connectionFreshnessAgeMs: number | null;
    connectionFreshnessLimitMs: number;
    connectionConfirmedAt: string | null;
    snapshotFresh: boolean;
    snapshotFreshnessAgeMs: number | null;
    snapshotFreshnessLimitMs: number;
    snapshotStatus:
      | "CURRENT"
      | "NO_CURRENT_FOCUS"
      | "STALE"
      | "REJECTED"
      | "NOT_RECEIVED";
    current: null | {
      state: "ACTIVE" | "IDLE";
      subjectKey: string | null;
      displayName: string | null;
      browserName: "CHROME" | "EDGE" | null;
      sessionStartedAt: string | null;
      stateStartedAt: string | null;
      lastActivityEvidenceAt: string | null;
      activityEvidenceKind:
        | "FOCUS_ACQUIRED"
        | "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND"
        | "TRUSTED_PAGE_INTERACTION"
        | null;
      provisionalFromAt: string | null;
      provisionalDurationMs: number | null;
    };
    snapshot: null | {
      snapshotSequence: number;
      activitySessionId: string | null;
      currentStateId: string | null;
      clockEpochId: string;
      policyVersion: string;
      state: "ACTIVE" | "IDLE" | "NONE";
      nextIntervalSequence: number;
      latestEmittedIntervalSequence: number | null;
      latestEmittedClientEventId: string | null;
      lastObservedAt: string | null;
      collectorState: "HEALTHY" | "LIMITED" | "PAUSED" | "ERROR";
      receivedAt: string | null;
    };
    health: null | {
      connectionState: "ONLINE" | "OFFLINE" | "AUTH_REQUIRED" | "UPGRADE_REQUIRED" | "ERROR";
      collectorState: "HEALTHY" | "LIMITED" | "PAUSED" | "ERROR";
      policyState: "ACTIVE" | "ACKNOWLEDGEMENT_REQUIRED" | "TIMEZONE_REQUIRED" | "EXPIRED";
      migrationState: "V1" | "PREPARING_V2" | "DRAINING_V1" | "V2" | "ERROR";
      platform: "WINDOWS" | "CHROME" | "EDGE";
      queue: {
        pending: number;
        ready: number;
        deadLetter: number;
        oldestQueuedAt: string | null;
        nextRetryAt: string | null;
      };
      lastSuccessfulHeartbeatAt: string | null;
      lastSuccessfulSyncAt: string | null;
      errorCode: string | null;
      serverDiagnosticCode:
        | "SNAPSHOT_POLICY_LEASE_INVALID"
        | "SNAPSHOT_OBSERVATION_TIME_INVALID"
        | "SNAPSHOT_OUTSIDE_POLICY_WINDOW"
        | null;
      serverDiagnosticRequestId: string | null;
      serverDiagnosticAt: string | null;
      receivedAt: string | null;
    };
    cursor: null | {
      clockEpochId: string;
      contiguousThroughSequence: number;
      latestAcceptedEndedAt: string | null;
      missingRanges: unknown[];
      rejectedRanges: unknown[];
      clockDriftMs: number | null;
      updatedAt: string | null;
    };
    correlation: null | {
      state: "RESOLVED" | "UNRESOLVED" | "NO_MATCH";
      desktopDeviceId?: string;
      extensionDeviceId?: string;
    };
  }>;
  coverage: {
    total: number;
    fresh: number;
    stale: number;
    connected: number;
    disconnected: number;
    freshSnapshots: number;
    staleSnapshots: number;
    rejectedSnapshots: number;
    withSequenceGaps: number;
    withDeadLetters: number;
  };
};

export type WorkMapApiDevice = {
  id: string;
  os: string;
  hostname: string | null;
  agentVersion: string | null;
  lastSeenAt: string | null;
  revokedAt?: string | null;
  user?: {
    id: string;
    displayName: string;
    email?: string;
  };
};

export type WorkMapApiDeviceRegistration = {
  device: WorkMapApiDevice;
};

export type WorkMapApiPairingCode = {
  id: string;
  code: string;
  clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
  status: "pending";
  expiresAt: string;
};

export type WorkMapApiPairingStatus = {
  id: string;
  clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
  status: "pending" | "paired" | "expired";
  expiresAt: string;
  deviceId: string | null;
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

export type WorkMapApiNotice = {
  id: string;
  type: "MESSAGE" | "WAVE" | "REACTION";
  direction: "sent" | "received";
  actor: { id: string; displayName: string };
  recipient: { id: string; displayName: string };
  message: string | null;
  reaction: VirtualOfficeReaction | null;
  createdAt: string;
  readAt: string | null;
};

export type WorkMapApiNoticeList = {
  items: WorkMapApiNotice[];
  unreadCount: number;
};
