"use client";

import { useEffect, useMemo, useState } from "react";
import { EmployeeCard } from "./EmployeeCard";
import { AppUsageTable } from "./AppUsageTable";
import { PrivacyNoticeCard } from "./PrivacyNoticeCard";
import { UsageSummaryCard } from "./UsageSummaryCard";
import { WebsiteUsageTable } from "./WebsiteUsageTable";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getCompliancePolicy } from "../../lib/api/complianceApi";
import { listDevices } from "../../lib/api/devicesApi";
import { getApiHealth } from "../../lib/api/healthApi";
import { getAgentLiveStatus, getUsageSummary } from "../../lib/api/reportsApi";
import type { WorkMapApiDevice, WorkMapApiPlayerPosition, WorkMapApiReportLiveStatus, WorkMapApiUsageSummary } from "../../lib/api/apiTypes";
import { statusFromFreshness } from "../office/presence";
import {
  aggregateEmployeeActivityByUser,
  buildDeviceHealthByUser,
  deriveDeviceActivityStatus,
  deriveDeviceHealth,
  type DeviceActivityStatus,
} from "../../lib/people/peopleStatus";
import { decodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { defaultLayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";
import { getVirtualOfficeMap, listVirtualOfficePositions } from "../../lib/api/virtualOfficeApi";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import type { DashboardEmployee, UsageMetric, UsageRow } from "./mockDashboardData";

type DashboardState = {
  loading: boolean;
  authSource: string | null;
  role: string | null;
  healthOk: boolean;
  healthText: string;
  positions: WorkMapApiPlayerPosition[];
  roomNames: Record<string, string>;
  policyVersion: string | null;
  complianceText: string;
  usageSummary: WorkMapApiUsageSummary | null;
  liveStatus: Extract<WorkMapApiReportLiveStatus, { scope: "company" }> | null;
  devices: WorkMapApiDevice[];
  statusText: string;
  errors: string[];
};

const initialDashboardState: DashboardState = {
  loading: true,
  authSource: null,
  role: null,
  healthOk: false,
  healthText: "Checking backend health...",
  positions: [],
  roomNames: {},
  policyVersion: null,
  complianceText: "Checking policy status...",
  usageSummary: null,
  liveStatus: null,
  devices: [],
  statusText: "Checking workspace signals...",
  errors: [],
};

export function ManagerOverviewPanel() {
  const [dashboardState, setDashboardState] = useState<DashboardState>(initialDashboardState);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const errors: string[] = [];
      const healthResult = await getApiHealth();
      let healthOk = false;
      let healthText = "Backend health was not confirmed.";

      if (healthResult.ok) {
        healthOk = healthResult.data.status === "ok";
        healthText = `${healthResult.data.service} responded at ${formatTimestamp(healthResult.data.timestamp)}.`;
      } else {
        errors.push(`Health check: ${healthResult.error}`);
      }

      const auth = await getWorkMapApiAuthOptions();
      let authSource: string | null = null;
      let role: string | null = null;
      let positions: WorkMapApiPlayerPosition[] = [];
      let roomNames: Record<string, string> = {};
      let policyVersion: string | null = null;
      let complianceText = "Sign in with Cognito to load backend policy status.";
      let usageSummary: WorkMapApiUsageSummary | null = null;
      let liveStatus: Extract<WorkMapApiReportLiveStatus, { scope: "company" }> | null = null;
      let devices: WorkMapApiDevice[] = [];

      if (auth.available) {
        authSource = auth.source;
        role = auth.role ?? null;
        const canLoadCompanyReports = canRequestCompanySummary(auth.role);
        const [mapResult, policyResult, usageResult, liveStatusResult, devicesResult] = await Promise.all([
          getVirtualOfficeMap(auth.options),
          getCompliancePolicy(auth.options),
          getUsageSummary({ ...auth.options, scope: canLoadCompanyReports ? "company" : "user" }),
          canLoadCompanyReports ? getAgentLiveStatus({ ...auth.options, scope: "company" }) : Promise.resolve(null),
          listDevices(auth.options),
        ]);

        if (mapResult.ok) {
          roomNames = Object.fromEntries(mapResult.data.rooms.map((room) => [room.id, room.name]));
          const positionsResult = await listVirtualOfficePositions(mapResult.data.id, auth.options);

          if (positionsResult.ok) {
            positions = positionsResult.data.filter((position) => position.userId !== auth.userId);
          } else {
            errors.push(`Office positions: ${positionsResult.error}`);
          }
        } else {
          errors.push(`Office map: ${mapResult.error}`);
        }

        if (policyResult.ok) {
          policyVersion = policyResult.data.policyVersion;
          complianceText = `Policy ${policyResult.data.policyVersion} is available for acknowledgement.`;
        } else {
          errors.push(`Compliance policy: ${policyResult.error}`);
          complianceText = "Compliance policy could not be loaded; the compliance page still shows safe transparency copy.";
        }

        if (usageResult.ok) {
          usageSummary = usageResult.data;
        } else {
          errors.push(`Reports summary: ${usageResult.error}`);
        }

        if (liveStatusResult?.ok && liveStatusResult.data.scope === "company") {
          liveStatus = liveStatusResult.data;
        } else if (liveStatusResult && !liveStatusResult.ok) {
          errors.push(`Live report status: ${liveStatusResult.error}`);
        }

        if (devicesResult.ok) {
          devices = devicesResult.data;
        } else {
          errors.push(`Devices: ${devicesResult.error}`);
        }
      } else {
        errors.push(auth.reason);
      }

      if (cancelled) {
        return;
      }

      setDashboardState({
        loading: false,
        authSource,
        role,
        healthOk,
        healthText,
        positions,
        roomNames,
        policyVersion,
        complianceText,
        usageSummary,
        liveStatus,
        devices,
        statusText: auth.available
          ? `Using ${formatAuthSource(auth.source)} for workspace dashboard data.`
          : "No backend API auth is available yet. Sign in before reviewing workspace data.",
        errors,
      });
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const presenceCounts = useMemo(() => countPresence(dashboardState.positions), [dashboardState.positions]);
  const usageRows = useMemo(() => buildUsageRows(dashboardState.usageSummary), [dashboardState.usageSummary]);
  const deviceStatusByUser = useMemo(
    () => buildDeviceStatusByUser(dashboardState.usageSummary, dashboardState.liveStatus, dashboardState.devices),
    [dashboardState.devices, dashboardState.liveStatus, dashboardState.usageSummary],
  );
  const journey = useMemo(() => getDashboardJourney(dashboardState.role), [dashboardState.role]);
  const people = useMemo(
    () =>
      dashboardState.positions.length > 0
        ? dashboardState.positions.map((position, index) => toDashboardEmployee(
          position,
          index,
          dashboardState.roomNames,
          deviceStatusByUser.get(position.userId),
        ))
        : [],
    [dashboardState.positions, dashboardState.roomNames, deviceStatusByUser],
  );

  const metrics = useMemo<UsageMetric[]>(
    () => [
      {
        label: "Workspace API",
        value: dashboardState.loading ? "Checking" : dashboardState.healthOk ? "Online" : "Review",
        detail: dashboardState.healthText,
        tone: dashboardState.healthOk ? "green" : "amber",
      },
      {
        label: "Session",
        value: dashboardState.authSource ? formatAuthSource(dashboardState.authSource) : "Missing",
        detail: dashboardState.authSource
          ? "Dashboard data is using an authenticated API context."
          : "Sign in with Cognito before reviewing workspace data.",
        tone: dashboardState.authSource ? "blue" : "amber",
      },
      {
        label: "Remote presence",
        value: dashboardState.positions.length > 0 ? `${presenceCounts.active}/${presenceCounts.idle}/${presenceCounts.offline}` : "No API rows",
        detail:
          dashboardState.positions.length > 0
            ? "Active / idle / offline teammates from office positions."
            : "No remote position rows are available yet.",
        tone: dashboardState.positions.length > 0 ? "green" : "slate",
      },
      {
        label: "Compliance",
        value: dashboardState.policyVersion ? `Policy ${dashboardState.policyVersion}` : "Check page",
        detail: dashboardState.complianceText,
        tone: dashboardState.policyVersion ? "green" : "amber",
      },
      {
        label: "Data coverage",
        value: dashboardState.usageSummary?.deviceCoverage
          ? `${dashboardState.usageSummary.deviceCoverage.activeDevices24h}/${dashboardState.usageSummary.deviceCoverage.registeredDevices}`
          : "No rows",
        detail: dashboardState.usageSummary?.deviceCoverage
          ? `${dashboardState.usageSummary.deviceCoverage.usersWithActivity} user(s) have app/domain summary data in the current report scope.`
          : "Register a device and submit app/domain usage events to populate backend-backed summaries.",
        tone: dashboardState.usageSummary?.deviceCoverage?.activeDevices24h ? "green" : "slate",
      },
    ],
    [dashboardState, presenceCounts],
  );

  return (
    <div className="wm-redesign-page wm-dashboard-page" style={styles.stack}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>{journey.eyebrow}</p>
          <h1 style={styles.title}>{journey.title}</h1>
          <p style={styles.subtitle}>{journey.subtitle}</p>
        </div>
        <div style={styles.heroActions}>
          {journey.actions.map((action) => (
            <a key={action.href} href={action.href} style={action.primary ? styles.officeLink : styles.secondaryLink}>
              {action.label}
            </a>
          ))}
        </div>
      </section>

      <section style={styles.guidancePanel}>
        <p style={styles.panelLabel}>{journey.guidanceLabel}</p>
        <p style={styles.panelText}>{journey.guidance}</p>
      </section>

      <section style={styles.setupPanel}>
        <div>
          <p style={styles.panelLabel}>Setup coverage</p>
          <h2 style={styles.panelTitle}>{journey.setupTitle}</h2>
          <p style={styles.panelText}>{journey.alphaNote}</p>
        </div>
        <div style={styles.setupList}>
          {journey.setupItems.map((item) => (
            <span key={item} style={styles.setupItem}>{item}</span>
          ))}
        </div>
      </section>

      <section style={styles.metricGrid}>
        {metrics.map((metric) => (
          <UsageSummaryCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section style={styles.statusPanel}>
        <div>
          <p style={styles.panelLabel}>Live workspace status</p>
          <h2 style={styles.panelTitle}>{dashboardState.loading ? "Checking setup" : dashboardState.statusText}</h2>
          <p style={styles.panelText}>
            This dashboard combines session health, office presence, compliance policy, setup coverage, and role-appropriate usage
            summaries. It shows availability and aggregate signals only; it does not expose screenshots, keystrokes, external private messages,
            full URLs, webpage content, or hidden monitoring data.
          </p>
        </div>
        {dashboardState.errors.length > 0 ? (
          <ul style={styles.errorList}>
            {dashboardState.errors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <p style={styles.sessionText}>Workspace signals loaded without dashboard API errors.</p>
        )}
      </section>

      <div style={styles.contentGrid}>
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>
            {dashboardState.positions.length > 0 ? "People in the office" : "No teammates visible yet"}
          </h2>
          <p style={styles.panelText}>
            {dashboardState.positions.length > 0
              ? "Remote teammates are loaded from the virtual-office positions API. Your own current-user row is not duplicated here."
              : "Teammates appear here after they join the same workspace and publish a safe virtual-office presence row."}
          </p>
          <div style={styles.employeeGrid}>
            {people.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        </section>

        <aside style={styles.sideStack}>
          <PrivacyNoticeCard />
          <AppUsageTable
            title={usageRows.fromApi ? "Top apps from Reports API" : "No app rows yet"}
            rows={usageRows.apps}
          />
          <WebsiteUsageTable
            title={usageRows.fromApi ? "Top domains from Reports API" : "No domain rows yet"}
            rows={usageRows.websites}
          />
        </aside>
      </div>
    </div>
  );
}

function countPresence(positions: WorkMapApiPlayerPosition[]) {
  return positions.reduce(
    (counts, position) => {
      const status = statusFromFreshness(position.status, position.updatedAt);
      if (status === "idle") {
        counts.idle += 1;
      } else if (status === "offline") {
        counts.offline += 1;
      } else {
        counts.active += 1;
      }

      return counts;
    },
    { active: 0, idle: 0, offline: 0 },
  );
}

function toDashboardEmployee(
  position: WorkMapApiPlayerPosition,
  _index: number,
  roomNames: Record<string, string>,
  deviceStatus: DeviceActivityStatus | undefined,
): DashboardEmployee {
  const roomName = position.roomId ? roomNames[position.roomId] : null;
  const virtualStatus = statusFromFreshness(position.status, position.updatedAt);

  return {
    id: position.userId,
    name: position.displayName,
    role: "Team member",
    department: roomName ?? "Office area",
    status: virtualStatus,
    localTime: formatTimestamp(position.updatedAt),
    avatar: decodeLayeredAvatarId(position.avatarId) ?? defaultLayeredAvatarConfig,
    activeTime: statusLabel(virtualStatus),
    idleTime: formatFreshness(position.updatedAt),
    topApp: "Reports API",
    topDomain: "Domain summary",
    deviceStatus: deviceStatus ?? "no_report",
  };
}

function buildDeviceStatusByUser(
  usageSummary: WorkMapApiUsageSummary | null,
  liveStatus: Extract<WorkMapApiReportLiveStatus, { scope: "company" }> | null,
  devices: WorkMapApiDevice[],
) {
  const activityByUser = aggregateEmployeeActivityByUser(usageSummary?.scope === "company" ? usageSummary : null, liveStatus);
  const healthByUser = buildDeviceHealthByUser(devices, usageSummary?.scope === "company" ? usageSummary : null, liveStatus);
  const statuses = new Map<string, DeviceActivityStatus>();
  const userIds = new Set([...activityByUser.keys(), ...healthByUser.keys()]);

  for (const userId of userIds) {
    const activity = activityByUser.get(userId);
    const health = deriveDeviceHealth(activity, healthByUser.get(userId));
    statuses.set(userId, deriveDeviceActivityStatus(activity, health));
  }

  return statuses;
}

function buildUsageRows(summary: WorkMapApiUsageSummary | null): { fromApi: boolean; apps: UsageRow[]; websites: UsageRow[] } {
  if (!summary || (summary.apps.length === 0 && summary.websites.length === 0)) {
    return { fromApi: false, apps: [], websites: [] };
  }

  const appTotal = summary.apps.reduce((sum, row) => sum + row.activeSeconds + row.idleSeconds, 0);
  const websiteTotal = summary.websites.reduce((sum, row) => sum + row.activeSeconds + row.idleSeconds, 0);

  return {
    fromApi: true,
    apps: summary.apps.map((row) => ({
      name: row.appName,
      category: row.category ?? row.productivityLabel ?? "Uncategorized",
      duration: formatDuration(row.activeSeconds + row.idleSeconds),
      share: formatShare(row.activeSeconds + row.idleSeconds, appTotal),
    })),
    websites: summary.websites.map((row) => ({
      name: row.domain,
      category: row.category ?? row.productivityLabel ?? "Uncategorized",
      duration: formatDuration(row.activeSeconds + row.idleSeconds),
      share: formatShare(row.activeSeconds + row.idleSeconds, websiteTotal),
    })),
  };
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0m";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatShare(seconds: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) {
    return "0%";
  }

  return `${Math.round((seconds / total) * 100)}%`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFreshness(value: string) {
  const updated = Date.parse(value);

  if (!Number.isFinite(updated)) {
    return "Unknown";
  }

  const minutes = Math.max(0, Math.round((Date.now() - updated) / 60_000));

  if (minutes === 0) {
    return "Just now";
  }

  return `${minutes}m ago`;
}

function statusLabel(status: WorkMapApiPlayerPosition["status"]) {
  return status.replace(/_/g, " ");
}

function formatAuthSource(source: string) {
  return source === "cognito-session" ? "Cognito" : source;
}

function canRequestCompanySummary(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN";
}

function getDashboardJourney(role: string | null) {
  if (role === "OWNER") {
    return {
      eyebrow: "Owner workspace",
      title: "Workspace management overview",
      subtitle: "Track team presence, setup coverage, compliance readiness, and aggregate activity summaries as data becomes available.",
      guidanceLabel: "Owner next steps",
      guidance:
        "Start with employee invites, then ask the team to complete compliance, avatar, and device setup. Reports stay sparse until a paired Desktop Agent or Browser Extension submits app/domain summary data.",
      setupTitle: "Bring the workspace online",
      alphaNote:
        "The current alpha includes Windows active-app tracking, MV3 active-domain tracking, secure device pairing, bounded offline queues, retry backoff, revocation, and local Alpha packages.",
      setupItems: ["Invite employees", "Complete compliance", "Finish avatar/profile", "Register devices"],
      actions: [
        { label: "Invite employees", href: "/onboarding/invite", primary: true },
        { label: "Open office", href: "/virtual-office" },
        { label: "View reports", href: "/reports" },
        { label: "Review compliance", href: "/compliance" },
      ],
    };
  }

  if (role === "EMPLOYEE") {
    return {
      eyebrow: "Employee workspace",
      title: "Your workspace view",
      subtitle: "See your office presence, teammate directory, compliance policy, and your own work summaries when data exists.",
      guidanceLabel: "Employee access",
      guidance:
        "Company-wide reports, invites, integrations, and settings are owner/admin areas. Your dashboard focuses on your own presence, compliance status, and personal summary availability.",
      setupTitle: "Your setup checklist",
      alphaNote:
        "Activity summaries appear only after your paired Desktop Agent or Browser Extension submits events. WorkMap does not show screenshots, keystrokes, external private messages, or webpage content.",
      setupItems: ["Review compliance", "Finish profile/avatar", "Set up device", "Open office"],
      actions: [
        { label: "Open office", href: "/virtual-office", primary: true },
        { label: "People directory", href: "/employees" },
        { label: "Review compliance", href: "/compliance" },
      ],
    };
  }

  return {
    eyebrow: "Workspace overview",
    title: "Team clarity without private content",
    subtitle: "See who is available, whether tracking coverage is healthy, and where app/domain summaries are ready for review.",
    guidanceLabel: "Workspace guidance",
    guidance:
      "Use the office and directory for day-to-day presence. Reports and admin actions appear only when the signed-in role can use them.",
    setupTitle: "Resolve workspace context",
    alphaNote:
        "Sign in with Cognito to see API-backed workspace data. WorkMap no longer displays placeholder rows as tenant metrics.",
    setupItems: ["Sign in", "Resolve role", "Load policy", "Load summaries"],
    actions: [
      { label: "Open office", href: "/virtual-office", primary: true },
      { label: "View reports", href: "/reports" },
      { label: "Review compliance", href: "/compliance" },
      { label: "Settings", href: "/settings" },
    ],
  };
}

const styles = {
  stack: {
    display: "grid",
    gap: "18px",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
    ...wmStyles.elevatedCard,
    padding: "20px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
  },
  title: {
    ...wmStyles.pageTitle,
  },
  subtitle: {
    ...wmStyles.pageSubtitle,
  },
  officeLink: {
    flex: "0 0 auto",
    ...wmStyles.primaryButton,
    padding: "10px 14px",
  },
  heroActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  secondaryLink: {
    flex: "0 0 auto",
    ...wmStyles.secondaryButton,
    padding: "10px 12px",
    fontSize: "13px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
  },
  guidancePanel: {
    ...wmStyles.infoNotice,
    display: "grid",
    gap: "6px",
    padding: "14px 16px",
  },
  setupPanel: {
    ...wmStyles.card,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: "16px",
    alignItems: "center",
    padding: "16px",
  },
  setupList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  setupItem: {
    borderWidth: "1px",
    borderStyle: "solid" as const,
    borderColor: wm.colors.borderSubtle,
    borderRadius: "999px",
    background: wm.colors.surfaceLow,
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 900,
    textAlign: "center" as const,
  },
  statusPanel: {
    ...wmStyles.infoNotice,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "16px",
    flexWrap: "wrap" as const,
    padding: "16px",
  },
  panelLabel: {
    ...wmStyles.eyebrow,
    color: wm.colors.infoText,
    margin: 0,
  },
  panelTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "18px",
    lineHeight: 1.3,
  },
  panelText: {
    margin: "0 0 12px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  sessionText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 800,
  },
  errorList: {
    margin: 0,
    paddingLeft: "18px",
    color: wm.colors.warning,
    fontSize: "13px",
    lineHeight: 1.5,
    maxWidth: "420px",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  panel: {
    ...wmStyles.card,
    padding: "16px",
  },
  employeeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  sideStack: {
    display: "grid",
    gap: "12px",
  },
};
