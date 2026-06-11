"use client";

import { useEffect, useMemo, useState } from "react";
import { EmployeeCard } from "./EmployeeCard";
import { AppUsageTable } from "./AppUsageTable";
import { PrivacyNoticeCard } from "./PrivacyNoticeCard";
import { UsageSummaryCard } from "./UsageSummaryCard";
import { WebsiteUsageTable } from "./WebsiteUsageTable";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getCompliancePolicy } from "../../lib/api/complianceApi";
import { getApiHealth } from "../../lib/api/healthApi";
import { getUsageSummary } from "../../lib/api/reportsApi";
import type { WorkMapApiPlayerPosition, WorkMapApiUsageSummary } from "../../lib/api/apiTypes";
import { getVirtualOfficeMap, listVirtualOfficePositions } from "../../lib/api/virtualOfficeApi";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import {
  appUsageRows,
  dashboardEmployees,
  websiteUsageRows,
  type DashboardEmployee,
  type UsageMetric,
  type UsageRow,
} from "../../lib/mock/mockPeople";

type DashboardState = {
  loading: boolean;
  authSource: string | null;
  healthOk: boolean;
  healthText: string;
  positions: WorkMapApiPlayerPosition[];
  roomNames: Record<string, string>;
  policyVersion: string | null;
  complianceText: string;
  usageSummary: WorkMapApiUsageSummary | null;
  statusText: string;
  errors: string[];
};

const initialDashboardState: DashboardState = {
  loading: true,
  authSource: null,
  healthOk: false,
  healthText: "Checking backend health...",
  positions: [],
  roomNames: {},
  policyVersion: null,
  complianceText: "Checking policy status...",
  usageSummary: null,
  statusText: "Checking pilot API readiness...",
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
      let positions: WorkMapApiPlayerPosition[] = [];
      let roomNames: Record<string, string> = {};
      let policyVersion: string | null = null;
      let complianceText = "Sign in with pilot auth to load backend policy status.";
      let usageSummary: WorkMapApiUsageSummary | null = null;

      if (auth.available) {
        authSource = auth.source;
        const [mapResult, policyResult, usageResult] = await Promise.all([
          getVirtualOfficeMap(auth.options),
          getCompliancePolicy(auth.options),
          getUsageSummary({ ...auth.options, scope: canRequestCompanySummary(auth.role) ? "company" : "user" }),
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
      } else {
        errors.push(auth.reason);
      }

      if (cancelled) {
        return;
      }

      setDashboardState({
        loading: false,
        authSource,
        healthOk,
        healthText,
        positions,
        roomNames,
        policyVersion,
        complianceText,
        usageSummary,
        statusText: auth.available
          ? `Using ${formatAuthSource(auth.source)} for pilot dashboard checks.`
          : "No backend API auth is available yet. Use /login before pilot QA.",
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
  const people = useMemo(
    () =>
      dashboardState.positions.length > 0
        ? dashboardState.positions.map((position, index) => toDashboardEmployee(position, index, dashboardState.roomNames))
        : dashboardEmployees,
    [dashboardState.positions, dashboardState.roomNames],
  );

  const metrics = useMemo<UsageMetric[]>(
    () => [
      {
        label: "API health",
        value: dashboardState.loading ? "Checking" : dashboardState.healthOk ? "Online" : "Review",
        detail: dashboardState.healthText,
        tone: dashboardState.healthOk ? "green" : "amber",
      },
      {
        label: "API auth",
        value: dashboardState.authSource ? formatAuthSource(dashboardState.authSource) : "Missing",
        detail: dashboardState.authSource
          ? "Dashboard checks are using an authenticated API context."
          : "Sign in with pilot auth; development token fallback stays development-only.",
        tone: dashboardState.authSource ? "blue" : "amber",
      },
      {
        label: "Remote presence",
        value: dashboardState.positions.length > 0 ? `${presenceCounts.active}/${presenceCounts.idle}/${presenceCounts.offline}` : "No API rows",
        detail:
          dashboardState.positions.length > 0
            ? "Active / idle / offline teammates from office positions."
            : "No remote position rows were available; sample people are shown below.",
        tone: dashboardState.positions.length > 0 ? "green" : "slate",
      },
      {
        label: "Compliance",
        value: dashboardState.policyVersion ? `Policy ${dashboardState.policyVersion}` : "Check page",
        detail: dashboardState.complianceText,
        tone: dashboardState.policyVersion ? "green" : "amber",
      },
      {
        label: "Tracking coverage",
        value: dashboardState.usageSummary?.deviceCoverage
          ? `${dashboardState.usageSummary.deviceCoverage.activeDevices24h}/${dashboardState.usageSummary.deviceCoverage.registeredDevices}`
          : "No rows",
        detail: dashboardState.usageSummary?.deviceCoverage
          ? `${dashboardState.usageSummary.deviceCoverage.usersWithActivity} user(s) have app/domain summary data in the current report scope.`
          : "Register a device and submit app/domain usage events to populate backend-backed tracking summaries.",
        tone: dashboardState.usageSummary?.deviceCoverage?.activeDevices24h ? "green" : "slate",
      },
    ],
    [dashboardState, presenceCounts],
  );

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Manager dashboard</p>
          <h1 style={styles.title}>Pilot readiness at a glance</h1>
          <p style={styles.subtitle}>
            Check backend reachability, session context, team presence, compliance status, and sparse usage summaries for the 5-person pilot.
          </p>
        </div>
        <div style={styles.heroActions}>
          <a href="/virtual-office" style={styles.officeLink}>Open office</a>
          <a href="/reports" style={styles.secondaryLink}>View reports</a>
          <a href="/compliance" style={styles.secondaryLink}>Review compliance</a>
          <a href="/settings" style={styles.secondaryLink}>Settings</a>
        </div>
      </section>

      <section style={styles.metricGrid}>
        {metrics.map((metric) => (
          <UsageSummaryCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section style={styles.statusPanel}>
        <div>
          <p style={styles.panelLabel}>Pilot checks</p>
          <h2 style={styles.panelTitle}>{dashboardState.loading ? "Checking setup" : dashboardState.statusText}</h2>
          <p style={styles.panelText}>
            Dashboard data is limited to API health, office presence, policy status, and existing reports summaries. It does not claim full
            enterprise monitoring or historical surveillance.
          </p>
        </div>
        {dashboardState.errors.length > 0 ? (
          <ul style={styles.errorList}>
            {dashboardState.errors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <p style={styles.sessionText}>No dashboard API issues detected in this browser session.</p>
        )}
      </section>

      <div style={styles.contentGrid}>
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>
            {dashboardState.positions.length > 0 ? "People from office API" : "Pilot example people"}
          </h2>
          <p style={styles.panelText}>
            {dashboardState.positions.length > 0
              ? "Remote teammates are loaded from virtual-office positions. The current signed-in user is excluded from this manager snapshot."
              : "No office position rows were available, so these sample cards keep the pilot page testable."}
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
            title={usageRows.fromApi ? "Top apps from Reports API" : "Pilot example apps"}
            rows={usageRows.apps}
          />
          <WebsiteUsageTable
            title={usageRows.fromApi ? "Top domains from Reports API" : "Pilot example domains"}
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
      if (position.status === "idle") {
        counts.idle += 1;
      } else if (position.status === "offline") {
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
  index: number,
  roomNames: Record<string, string>,
): DashboardEmployee {
  const fallback = dashboardEmployees[index % dashboardEmployees.length];
  const roomName = position.roomId ? roomNames[position.roomId] : null;

  return {
    id: position.userId,
    name: position.displayName,
    role: "Pilot teammate",
    department: roomName ?? "Office area",
    status: position.status,
    localTime: formatTimestamp(position.updatedAt),
    avatar: fallback.avatar,
    activeTime: statusLabel(position.status),
    idleTime: formatFreshness(position.updatedAt),
    topApp: "Reports API",
    topDomain: "Domain summary",
    deviceHealth: position.status === "offline" ? "offline" : "online",
  };
}

function buildUsageRows(summary: WorkMapApiUsageSummary | null): { fromApi: boolean; apps: UsageRow[]; websites: UsageRow[] } {
  if (!summary || (summary.apps.length === 0 && summary.websites.length === 0)) {
    return { fromApi: false, apps: appUsageRows, websites: websiteUsageRows };
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
  if (source === "pilot-session") {
    return "Pilot";
  }

  if (source === "dev-token") {
    return "Dev token";
  }

  if (source === "dev-cache") {
    return "Dev cache";
  }

  return source;
}

function canRequestCompanySummary(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN";
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
  statusPanel: {
    ...wmStyles.infoNotice,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "16px",
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
