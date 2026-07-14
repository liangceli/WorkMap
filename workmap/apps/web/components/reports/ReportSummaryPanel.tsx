"use client";

import { Activity, AlertTriangle, ChevronDown, Download, FileText, Globe2, Power, RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type { ApiClientOptions, WorkMapApiReportLiveStatus, WorkMapApiUsageSummary, WorkMapApiUser } from "../../lib/api/apiTypes";
import { getAgentLiveStatus, getUsageSummary } from "../../lib/api/reportsApi";
import { listUsers } from "../../lib/api/usersApi";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { WorkMapButton } from "../ui/WorkMapButton";
import { mergeLiveUsage } from "./liveUsage";
import {
  defaultReportFilters,
  utcToday,
  persistReportFilters,
  restoreReportFilters,
  type ReportFilters,
  type ViewFilter,
} from "./reportFilters";

type AuthContext = { options: ApiClientOptions; role: string; userId: string; source: string };
type ReportState = {
  loading: boolean;
  summary: WorkMapApiUsageSummary | null;
  statusText: string;
  error: string | null;
};

export function ReportSummaryPanel() {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [users, setUsers] = useState<WorkMapApiUser[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(() => defaultReportFilters("company"));
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => defaultReportFilters("company"));
  const [liveStatus, setLiveStatus] = useState<WorkMapApiReportLiveStatus | null>(null);
  const activityRevisionRef = useRef<string | null | undefined>(undefined);
  const [reportState, setReportState] = useState<ReportState>({
    loading: true,
    summary: null,
    statusText: "Checking reports API...",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const authResult = await getWorkMapApiAuthOptions();
      if (cancelled) return;
      if (!authResult.available) {
        setReportState({ loading: false, summary: null, statusText: "Sign in to load workspace reports.", error: authResult.reason });
        return;
      }

      const context: AuthContext = {
        options: authResult.options,
        role: authResult.role,
        userId: authResult.userId,
        source: authResult.source,
      };
      const canViewCompany = canRequestCompanySummary(context.role);
      const fallbackFilters = defaultReportFilters(canViewCompany ? "company" : "me");
      const directoryResult = canViewCompany ? await listUsers(context.options) : null;
      const directoryUsers = directoryResult?.ok ? directoryResult.data : [];
      const initialFilters = restoreReportFilters(context.userId, fallbackFilters, {
        canViewCompany,
        userIds: directoryUsers.map((user) => user.id),
        departmentIds: directoryResult?.ok
          ? directoryUsers.flatMap((user) => user.department && typeof user.department !== "string" ? [user.department.id] : [])
          : undefined,
      });
      const result = await requestSummary(context, initialFilters);
      if (cancelled) return;

      setAuth(context);
      setFilters(initialFilters);
      setAppliedFilters(initialFilters);
      if (directoryResult?.ok) setUsers(directoryUsers);
      applyResult(result, setReportState);
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    activityRevisionRef.current = reportState.summary?.activityRevision;
  }, [reportState.summary?.activityRevision]);

  useEffect(() => {
    if (auth) persistReportFilters(auth.userId, filters);
  }, [auth, filters]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const refresh = async () => {
      const userId = appliedFilters.view.startsWith("user:") ? appliedFilters.view.slice(5) : undefined;
      const result = await getAgentLiveStatus({
        ...auth.options,
        scope: appliedFilters.view === "company" ? "company" : "user",
        userId,
        departmentId: appliedFilters.view === "company" ? appliedFilters.departmentId || undefined : undefined,
        from: appliedFilters.from,
        to: appliedFilters.to,
      });
      if (cancelled || !result.ok) return;
      setLiveStatus(result.data);
      if (result.data.activityRevision !== activityRevisionRef.current) {
        const summaryResult = await requestSummary(auth, appliedFilters);
        if (!cancelled && summaryResult.ok) {
          activityRevisionRef.current = summaryResult.data.activityRevision;
          applyResult(summaryResult, setReportState);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [auth, appliedFilters]);

  const departments = useMemo(() => {
    const values = new Map<string, string>();
    for (const user of users) {
      if (user.department && typeof user.department !== "string") values.set(user.department.id, user.department.name);
    }
    return Array.from(values, ([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [users]);

  const selectedUser = useMemo(() => {
    if (!appliedFilters.view.startsWith("user:")) return null;
    const userId = appliedFilters.view.slice(5);
    return users.find((user) => user.id === userId) ?? null;
  }, [appliedFilters.view, users]);

  async function applyFilters() {
    if (!auth) return;
    if (!filters.from || !filters.to) {
      setReportState((current) => ({ ...current, loading: false, error: "Choose both a start date and an end date." }));
      return;
    }
    if (filters.from > filters.to) {
      setReportState((current) => ({ ...current, loading: false, error: "Start date must be on or before end date." }));
      return;
    }
    setReportState((current) => ({ ...current, loading: true, error: null, statusText: "Refreshing report..." }));
    const result = await requestSummary(auth, filters);
    persistReportFilters(auth.userId, filters);
    setLiveStatus(null);
    setAppliedFilters(filters);
    applyResult(result, setReportState);
  }

  function applyPreset(days: number) {
    const to = utcToday();
    setFilters((current) => ({ ...current, from: addUtcDays(to, -(days - 1)), to }));
  }

  const summary = useMemo(() => mergeLiveUsage(reportState.summary, liveStatus), [reportState.summary, liveStatus]);
  const hasRows = Boolean(summary && (summary.apps.length > 0 || summary.websites.length > 0));
  const scopeLabel = getScopeLabel(summary, selectedUser, departments);

  return (
    <div className="wm-report-summary" style={styles.stack}>
      <section style={styles.filterPanel} aria-label="Report filters">
        <div style={styles.filterHeader}>
          <div>
            <p style={styles.panelLabel}>Report controls</p>
            <h2 style={styles.panelTitle}>Usage summary filters</h2>
          </div>
          <div style={styles.presetGroup} aria-label="Date presets">
            {[1, 7, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => applyPreset(days)} style={styles.presetButton}>{days === 1 ? "Daily" : `${days} days`}</button>
            ))}
          </div>
        </div>

        <div style={styles.filterGrid}>
          {auth && canRequestCompanySummary(auth.role) ? (
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Report view</span>
              <select
                value={filters.view}
                onChange={(event) => setFilters((current) => ({ ...current, view: event.target.value as ViewFilter, departmentId: "" }))}
                style={styles.input}
              >
                <option value="company">Company aggregate</option>
                <option value="me">My activity</option>
                {users.filter((user) => user.id !== auth.userId).map((user) => (
                  <option key={user.id} value={`user:${user.id}`}>{user.displayName}</option>
                ))}
              </select>
            </label>
          ) : (
            <div style={styles.readonlyField}>
              <span style={styles.fieldLabel}>Report view</span>
              <strong>My activity</strong>
            </div>
          )}

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Department</span>
            <select
              value={filters.departmentId}
              disabled={filters.view !== "company"}
              onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}
              style={{ ...styles.input, ...(filters.view !== "company" ? styles.disabledInput : {}) }}
            >
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>From</span>
            <input required type="date" value={filters.from} max={filters.to} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>To</span>
            <input required type="date" value={filters.to} min={filters.from} max={utcToday()} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} style={styles.input} />
          </label>
        </div>

        <div style={styles.filterActions}>
          <WorkMapButton type="button" tone="primary" onClick={() => void applyFilters()} disabled={!auth || reportState.loading}>
            <RefreshCw size={16} aria-hidden /> {reportState.loading ? "Loading" : "Apply filters"}
          </WorkMapButton>
          <WorkMapButton type="button" onClick={() => summary && exportSummaryCsv(summary, scopeLabel)} disabled={!summary}>
            <Download size={16} aria-hidden /> Export CSV
          </WorkMapButton>
          <WorkMapButton type="button" onClick={() => summary && exportSummaryTxt(summary, scopeLabel)} disabled={!summary}>
            <FileText size={16} aria-hidden /> Download TXT
          </WorkMapButton>
          <span style={styles.rangeText}>{summary ? `${summary.range.from} to ${summary.range.to} (${summary.range.timeZone})` : "UTC reporting dates"}</span>
        </div>
      </section>

      <section style={styles.statusPanel}>
        <div>
          <p style={styles.panelLabel}>Role-aware reporting</p>
          <h2 style={styles.panelTitle}>{reportState.loading ? "Loading report" : reportState.statusText}</h2>
          <p style={styles.panelText}>
            Company view is aggregated by default. Authorized Owner and manager roles may select an individual employee; every individual report request is audit logged.
            Employees and IT Admins see only their own summary.
          </p>
          {auth ? <p style={styles.sessionText}>Cognito session / {auth.role} / {scopeLabel}</p> : null}
        </div>
        {reportState.error ? <p role="alert" style={styles.errorText}>{reportState.error}</p> : null}
      </section>

      {summary?.scope === "user" ? <AgentStatusPanel summary={summary} /> : null}

      {summary && summary.browserExtensionCoverage.length > 0 ? <BrowserExtensionCoveragePanel rows={summary.browserExtensionCoverage} /> : null}

      {summary ? <MetricGrid summary={summary} /> : null}

      {summary && summary.daily.length > 0 ? <DailyTrend rows={summary.daily} /> : null}

      {summary?.scope === "company" && summary.employeeUsage.length > 0 ? <EmployeeUsageChart rows={summary.employeeUsage} /> : null}

      {summary?.scope === "user" && summary.agentSessions.length > 0 ? <AgentSessionHistory rows={summary.agentSessions} /> : null}

      {summary ? (
        <section style={styles.apiPanel}>
          <div style={styles.apiHeader}>
            <div>
              <p style={styles.panelLabel}>API summary</p>
              <h2 style={styles.panelTitle}>{scopeLabel}</h2>
              <p style={styles.panelText}>App and domain totals remain separate because browser time also appears under the desktop browser process. Every card highlights focus active; expand it only when you need focused idle and open/runtime context.</p>
            </div>
            <span style={styles.scopePill}>{summary.scope === "company" ? "Company scope" : "User scope"}</span>
          </div>
          {hasRows ? (
            <div style={styles.summaryGrid}>
              <SummaryUsageList title="Apps" kind="app" rows={summary.apps.map((row) => ({ name: row.appName, ...row }))} />
              <SummaryUsageList title="Domains" kind="domain" rows={summary.websites.map((row) => ({ name: row.domain, ...row }))} />
            </div>
          ) : (
            <p style={styles.emptyText}>No usage rows exist for this scope and date range.</p>
          )}
        </section>
      ) : (
        <section style={styles.emptyPanel}>
          <h2 style={styles.panelTitle}>No report loaded</h2>
          <p style={styles.panelText}>Connect a paired tracking client and sign in with Cognito to load real tenant data.</p>
        </section>
      )}
    </div>
  );
}

function AgentStatusPanel({ summary }: { summary: WorkMapApiUsageSummary }) {
  const status = summary.agentStatus;
  if (!status || status.state === "not_paired") {
    return (
      <section style={styles.agentPanel} aria-label="Desktop Agent status">
        <Power size={20} aria-hidden />
        <div><p style={styles.panelLabel}>Desktop Agent</p><h2 style={styles.panelTitle}>No paired Agent</h2><p style={styles.panelText}>This employee has no active Windows Agent session.</p></div>
      </section>
    );
  }
  const online = status.state === "online";
  const interrupted = status.state === "interrupted";
  return (
    <section style={{ ...styles.agentPanel, ...(interrupted ? styles.agentInterrupted : online ? styles.agentOnline : {}) }} aria-label="Desktop Agent status">
      {interrupted ? <AlertTriangle size={20} aria-hidden /> : online ? <Activity size={20} aria-hidden /> : <Power size={20} aria-hidden />}
      <div style={styles.agentBody}>
        <div style={styles.agentHeader}>
          <div>
            <p style={styles.panelLabel}>Desktop Agent now</p>
            <h2 style={styles.panelTitle}>{online ? "Connected" : interrupted ? "Connection interrupted" : "Stopped normally"}</h2>
          </div>
          <span style={styles.agentTimestamp}>{status.lastHeartbeatAt ? `Last signal ${formatDateTime(status.lastHeartbeatAt)}` : "No heartbeat"}</span>
        </div>
        <div style={styles.currentAppRow}>
          <span style={styles.currentAppLabel}>Current foreground app</span>
          <strong style={styles.currentAppName}>{online ? status.currentAppName ?? "No active foreground app" : "Not available"}</strong>
          <span style={styles.currentAppDuration}>
            {online && status.currentAppName
              ? status.currentAppFocusedIdleSeconds
                ? "No recent input"
                : `${formatDuration(status.currentAppActiveSeconds ?? 0)} focus active`
              : ""}
          </span>
        </div>
        <div style={styles.todayUsageRow}>
          <span>Today across all foreground apps</span>
          <strong>{formatDuration(status.todayActiveSeconds ?? 0)}</strong>
        </div>
        <p style={styles.agentMeta}>{status.hostname ?? "Windows device"} · Session started {status.startedAt ? formatDateTime(status.startedAt) : "unknown"}</p>
      </div>
    </section>
  );
}

function BrowserExtensionCoveragePanel({ rows }: { rows: WorkMapApiUsageSummary["browserExtensionCoverage"] }) {
  return (
    <section style={styles.trendPanel} aria-label="Browser extension coverage">
      <div style={styles.trendHeader}>
        <div>
          <p style={styles.panelLabel}>Browser extension coverage</p>
          <h2 style={styles.panelTitle}>Chrome and Edge tracking signal</h2>
          <p style={styles.panelText}>Signal loss is detected 90 seconds after the last heartbeat. It may mean the extension is disabled or removed, or that the browser, computer, or network is unavailable.</p>
        </div>
        <Globe2 size={20} aria-hidden />
      </div>
      <div style={styles.sessionRows}>
        {rows.map((row) => {
          const connected = row.state === "connected";
          return (
            <div key={row.deviceId} style={styles.sessionRow}>
              <span style={{ ...styles.sessionState, ...(!connected ? styles.sessionInterrupted : {}) }}>{connected ? "Connected" : "Signal lost"}</span>
              <span>{row.displayName} · {formatBrowserName(row.browserName)}</span>
              <span>{row.lastSignalAt ? `Last signal ${formatDateTime(row.lastSignalAt)}` : `Enabled observed ${formatDateTime(row.enabledAt)}`}</span>
              <span>
                {!connected && row.coverageLostDetectedAt
                  ? `Coverage lost detected ${formatDateTime(row.coverageLostDetectedAt)}`
                  : row.coverageRestoredAt
                    ? `Coverage restored ${formatDateTime(row.coverageRestoredAt)}`
                    : `Enabled observed ${formatDateTime(row.enabledAt)}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmployeeUsageChart({ rows }: { rows: WorkMapApiUsageSummary["employeeUsage"] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.activeSeconds));
  return (
    <section style={styles.trendPanel} aria-label="Company employee app usage">
      <div><p style={styles.panelLabel}>Company comparison</p><h2 style={styles.panelTitle}>App active time by employee</h2></div>
      <div style={styles.employeeBars}>
        {rows.map((row) => (
          <div key={row.userId} style={styles.employeeBarRow}>
            <span style={styles.employeeName}>{row.displayName}</span>
            <div style={styles.employeeBarTrack}><span style={{ ...styles.employeeBarFill, width: `${Math.max(1, row.activeSeconds / maximum * 100)}%` }} /></div>
            <strong style={styles.employeeDuration}>{formatDuration(row.activeSeconds)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentSessionHistory({ rows }: { rows: WorkMapApiUsageSummary["agentSessions"] }) {
  return (
    <section style={styles.trendPanel} aria-label="Desktop Agent session history">
      <div><p style={styles.panelLabel}>Agent audit</p><h2 style={styles.panelTitle}>Start, stop and interruption history</h2></div>
      <div style={styles.sessionRows}>
        {rows.slice(0, 30).map((row) => {
          const interrupted = row.endReason === "UNEXPECTED_STOP";
          return (
            <div key={row.id} style={styles.sessionRow}>
              <span style={{ ...styles.sessionState, ...(interrupted ? styles.sessionInterrupted : {}) }}>{row.endedAt ? interrupted ? "Interrupted" : "Stopped" : "Running"}</span>
              <span>Started {formatDateTime(row.startedAt)}</span>
              <span>{row.endedAt ? `Ended ${formatDateTime(row.endedAt)}` : `Last signal ${formatDateTime(row.lastHeartbeatAt)}`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MetricGrid({ summary }: { summary: WorkMapApiUsageSummary }) {
  const appActive = sum(summary.apps, "activeSeconds");
  const domainActive = sum(summary.websites, "activeSeconds");
  const domainIdle = sum(summary.websites, "idleSeconds");
  const metrics = [
    { label: "App focus active", value: formatDuration(appActive), detail: "Foreground app with keyboard or mouse input within 30 seconds" },
    { label: "Domain focus active", value: formatDuration(domainActive), detail: `${formatDuration(domainIdle)} focused idle` },
    { label: "Tracked items", value: `${summary.apps.length} / ${summary.websites.length}`, detail: "App rows / domain rows" },
    {
      label: "Devices active",
      value: `${summary.deviceCoverage?.activeDevices24h ?? 0} / ${summary.deviceCoverage?.registeredDevices ?? 0}`,
      detail: `${summary.deviceCoverage?.usersWithActivity ?? 0} user(s) with activity in range`,
    },
  ];
  return (
    <section style={styles.metricGrid} aria-label="Usage metrics">
      {metrics.map((metric) => (
        <article key={metric.label} style={styles.metricCard}>
          <p style={styles.metricLabel}>{metric.label}</p>
          <strong style={styles.metricValue}>{metric.value}</strong>
          <p style={styles.metricDetail}>{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}

function DailyTrend({ rows }: { rows: WorkMapApiUsageSummary["daily"] }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.appActiveSeconds, row.domainActiveSeconds]));
  return (
    <section style={styles.trendPanel}>
      <div style={styles.trendHeader}>
        <div>
          <p style={styles.panelLabel}>Daily trend</p>
          <h2 style={styles.panelTitle}>Active duration by source</h2>
        </div>
        <div style={styles.legend}><span style={styles.appLegend} /> Apps <span style={styles.domainLegend} /> Domains</div>
      </div>
      <div style={styles.trendRows}>
        {rows.map((row) => (
          <div key={row.date} style={styles.trendRow}>
            <time style={styles.trendDate}>{formatShortDate(row.date)}</time>
            <div style={styles.bars}>
              <div title={`Apps ${formatDuration(row.appActiveSeconds)}`} style={{ ...styles.appBar, width: `${Math.max(1, row.appActiveSeconds / maximum * 100)}%` }} />
              <div title={`Domains ${formatDuration(row.domainActiveSeconds)}`} style={{ ...styles.domainBar, width: `${Math.max(1, row.domainActiveSeconds / maximum * 100)}%` }} />
            </div>
            <span style={styles.trendValue}>{formatDuration(row.appActiveSeconds)} / {formatDuration(row.domainActiveSeconds)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export type UsageListRow = {
  name: string;
  category: string | null;
  productivityLabel: string | null;
  activeSeconds: number;
  idleSeconds: number;
  focusActiveSeconds?: number;
  focusedIdleSeconds?: number;
  openRuntimeSeconds?: number;
};

function SummaryUsageList({ title, kind, rows }: { title: string; kind: "app" | "domain"; rows: UsageListRow[] }) {
  return (
    <section style={styles.summaryCard}>
      <h3 style={styles.summaryTitle}>{title}</h3>
      <div style={styles.summaryRows}>
        {rows.map((row) => kind === "app"
          ? <AppUsageMetricCard key={row.name} row={row} />
          : <DomainUsageMetricCard key={row.name} row={row} />)}
      </div>
    </section>
  );
}

export function AppUsageMetricCard({ row, initiallyExpanded = false }: { row: UsageListRow; initiallyExpanded?: boolean }) {
  return <UsageMetricCard row={row} kind="app" initiallyExpanded={initiallyExpanded} />;
}

export function DomainUsageMetricCard({ row, initiallyExpanded = false }: { row: UsageListRow; initiallyExpanded?: boolean }) {
  return <UsageMetricCard row={row} kind="domain" initiallyExpanded={initiallyExpanded} />;
}

function UsageMetricCard({ row, kind, initiallyExpanded }: { row: UsageListRow; kind: "app" | "domain"; initiallyExpanded: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const focusActive = formatDuration(row.focusActiveSeconds ?? row.activeSeconds);
  const itemLabel = kind === "app" ? "app" : "domain";
  return (
    <article style={styles.appMetricCard}>
      <button
        type="button"
        style={styles.appMetricToggle}
        aria-expanded={expanded}
        aria-label={`${row.name}, ${focusActive} focus active. ${expanded ? "Hide" : "Show"} secondary ${itemLabel} time metrics`}
        onClick={() => setExpanded((current) => !current)}
      >
        <span style={styles.nameCell}>
          <span style={styles.summaryName}>{row.name}</span>
          <span style={styles.summaryCategory}>{row.category ?? formatProductivity(row.productivityLabel)}</span>
        </span>
        <span style={styles.appPrimaryMetric}>
          <MetricChip
            label="Focus active"
            value={focusActive}
            tone="active"
            title={kind === "app" ? "Foreground/focused app with recent keyboard or mouse input" : "Focused domain receiving trusted keyboard, mouse, wheel, or touch input"}
            prominent
          />
          <ChevronDown
            aria-hidden="true"
            size={18}
            style={{ ...styles.appMetricChevron, transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </button>
      {expanded ? (
        <div style={styles.appSecondaryMetrics} aria-label={`${row.name} secondary ${itemLabel} time metrics`}>
          <MetricChip
            label="Focused idle"
            value={formatDuration(row.focusedIdleSeconds ?? row.idleSeconds)}
            tone="idle"
            title={`Focused ${itemLabel} after 30 seconds without keyboard, mouse, wheel, or touch input`}
          />
          <MetricChip
            label="Open/runtime"
            value={formatDuration(openRuntime(row))}
            tone="runtime"
            title={kind === "app" ? "App was open or running; not proof of active use" : "At least one tab for this domain was open; duplicate tabs are counted once"}
          />
        </div>
      ) : null}
    </article>
  );
}

function MetricChip({ label, value, tone, title, prominent = false }: { label: string; value: string; tone: "active" | "idle" | "runtime"; title: string; prominent?: boolean }) {
  const toneStyle = tone === "active" ? styles.metricChipActive : tone === "idle" ? styles.metricChipIdle : styles.metricChipRuntime;
  return (
    <span style={{ ...styles.metricChip, ...toneStyle, ...(prominent ? styles.metricChipProminent : {}) }} title={title}>
      <small style={styles.metricChipLabel}>{label}</small>
      <strong style={{ ...styles.metricChipValue, ...(prominent ? styles.metricChipValueProminent : {}) }}>{value}</strong>
    </span>
  );
}

async function requestSummary(auth: AuthContext, filters: ReportFilters) {
  const userId = filters.view.startsWith("user:") ? filters.view.slice(5) : undefined;
  return getUsageSummary({
    ...auth.options,
    scope: filters.view === "company" ? "company" : "user",
    userId,
    departmentId: filters.view === "company" ? filters.departmentId || undefined : undefined,
    from: filters.from,
    to: filters.to,
  });
}

function applyResult(
  result: Awaited<ReturnType<typeof getUsageSummary>>,
  setState: (state: ReportState) => void,
) {
  if (!result.ok) {
    setState({ loading: false, summary: null, statusText: "Reports API could not be loaded.", error: result.error });
    return;
  }
  setState({
    loading: false,
    summary: result.data,
    statusText: result.data.scope === "company" ? "Company usage summary loaded." : "Personal usage summary loaded.",
    error: null,
  });
}

function canRequestCompanySummary(role: string) {
  return role === "OWNER" || role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN";
}

function getScopeLabel(summary: WorkMapApiUsageSummary | null, selectedUser: WorkMapApiUser | null, departments: Array<{ id: string; name: string }>) {
  if (!summary) return "No scope loaded";
  if (summary.scope === "user") return selectedUser?.displayName ?? "My activity";
  if (summary.departmentId) return departments.find((department) => department.id === summary.departmentId)?.name ?? "Department aggregate";
  return "Company aggregate";
}

function exportSummaryCsv(summary: WorkMapApiUsageSummary, scopeLabel: string) {
  const rows: Array<Array<string | number>> = [
    ["scope", "source", "item", "category", "productivity", "focus_active_seconds", "focused_idle_seconds", "open_runtime_seconds", "from", "to"],
    ...summary.apps.map((row) => [
      scopeLabel,
      "app",
      row.appName,
      row.category ?? "",
      row.productivityLabel ?? "",
      row.focusActiveSeconds ?? row.activeSeconds,
      row.focusedIdleSeconds ?? row.idleSeconds,
      openRuntime(row),
      summary.range.from,
      summary.range.to,
    ]),
    ...summary.websites.map((row) => [
      scopeLabel,
      "domain",
      row.domain,
      row.category ?? "",
      row.productivityLabel ?? "",
      row.focusActiveSeconds ?? row.activeSeconds,
      row.focusedIdleSeconds ?? row.idleSeconds,
      openRuntime(row),
      summary.range.from,
      summary.range.to,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `workmap-usage-${summary.range.from}-${summary.range.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportSummaryTxt(summary: WorkMapApiUsageSummary, scopeLabel: string) {
  const lines = [
    "WORKMAP APP USAGE REPORT",
    `Scope: ${scopeLabel}`,
    `Period: ${summary.range.from} to ${summary.range.to} (${summary.range.timeZone})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SUMMARY",
    `App focus active: ${formatDuration(sum(summary.apps, "activeSeconds"))}`,
    `App focused idle: ${formatDuration(sum(summary.apps, "idleSeconds"))}`,
    `App open/runtime: ${formatDuration(summary.apps.reduce((total, row) => total + openRuntime(row), 0))}`,
    `Domain focus active: ${formatDuration(sum(summary.websites, "activeSeconds"))}`,
    `Domain focused idle: ${formatDuration(sum(summary.websites, "idleSeconds"))}`,
    `Domain open/runtime: ${formatDuration(summary.websites.reduce((total, row) => total + openRuntime(row), 0))}`,
    "",
  ];
  if (summary.agentStatus) {
    lines.push(
      "DESKTOP AGENT STATUS",
      `State: ${summary.agentStatus.state}`,
      `Device: ${summary.agentStatus.hostname ?? "Unknown Windows device"}`,
      `Last signal: ${summary.agentStatus.lastHeartbeatAt ?? "None"}`,
      `Current foreground app: ${summary.agentStatus.currentAppName ?? "None"}`,
      `Current app focus active: ${formatDuration(summary.agentStatus.currentAppActiveSeconds ?? 0)}`,
      `Current app focused idle: ${formatDuration(summary.agentStatus.currentAppFocusedIdleSeconds ?? 0)}`,
      `Today active across all apps: ${formatDuration(summary.agentStatus.todayActiveSeconds ?? 0)}`,
      "",
    );
  }
  lines.push("APP TOTALS");
  if (summary.apps.length === 0) lines.push("No app activity recorded.");
  for (const row of summary.apps) {
    lines.push(`${row.appName}: ${formatDuration(row.focusActiveSeconds ?? row.activeSeconds)} focus active; ${formatDuration(row.focusedIdleSeconds ?? row.idleSeconds)} focused idle; ${formatDuration(openRuntime(row))} open/runtime`);
  }
  lines.push("", "DOMAIN TOTALS");
  if (summary.websites.length === 0) lines.push("No domain activity recorded.");
  for (const row of summary.websites) {
    lines.push(`${row.domain}: ${formatDuration(row.focusActiveSeconds ?? row.activeSeconds)} focus active; ${formatDuration(row.focusedIdleSeconds ?? row.idleSeconds)} focused idle; ${formatDuration(openRuntime(row))} open/runtime`);
  }
  lines.push("", "DAILY TOTALS");
  if (summary.daily.length === 0) lines.push("No daily activity recorded.");
  for (const row of summary.daily) lines.push(`${row.date}: ${formatDuration(row.appActiveSeconds)} app active`);
  if (summary.employeeUsage.length > 0) {
    lines.push("", "EMPLOYEE APP TOTALS");
    for (const row of summary.employeeUsage) lines.push(`${row.displayName}: ${formatDuration(row.activeSeconds)} active`);
  }
  if (summary.appTimeline.length > 0) {
    lines.push("", "APP ACTIVITY TIMELINE");
    for (const row of summary.appTimeline) lines.push(`${row.startedAt} -> ${row.endedAt ?? "open"} | ${row.appName} | ${formatDuration(row.durationSeconds)}`);
  }
  if (summary.agentSessions.length > 0) {
    lines.push("", "AGENT SESSION AUDIT");
    for (const row of summary.agentSessions) lines.push(`${row.startedAt} -> ${row.endedAt ?? "running"} | ${row.endReason ?? "ACTIVE"}`);
  }
  lines.push(
    "",
    "PRIVACY BOUNDARY",
    "WorkMap records foreground application product names and duration only. It does not collect window titles, screenshots, screen recordings, keystrokes, clipboard, camera, microphone, file contents, message/email bodies, webpage bodies, form inputs, or passwords.",
  );
  downloadText(
    `workmap-app-usage-${safeFileName(scopeLabel)}-${summary.range.from}-${summary.range.to}.txt`,
    lines.join("\r\n"),
  );
}

function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "report";
}

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const text = safe.replace(/"/g, '""');
  return `"${text}"`;
}

function openRuntime(row: { activeSeconds: number; idleSeconds: number; openRuntimeSeconds?: number }) {
  return Math.max(row.openRuntimeSeconds ?? 0, row.activeSeconds + row.idleSeconds);
}

function sum(rows: Array<{ activeSeconds: number; idleSeconds: number }>, key: "activeSeconds" | "idleSeconds") {
  return rows.reduce((total, row) => total + row[key], 0);
}

function formatProductivity(value: string | null) {
  return value ? value.toLowerCase().replace(/_/g, " ") : "Uncategorised";
}

function formatBrowserName(value: "CHROME" | "EDGE" | "UNKNOWN") {
  return value === "EDGE" ? "Microsoft Edge" : value === "CHROME" ? "Google Chrome" : "Browser extension";
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const wholeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const styles = {
  stack: { display: "grid", gap: "14px" },
  filterPanel: { ...wmStyles.card, padding: "16px", display: "grid", gap: "14px" },
  filterHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", flexWrap: "wrap" as const },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: "12px" },
  field: { display: "grid", gap: "6px" },
  readonlyField: { display: "grid", gap: "6px", alignContent: "start", minHeight: wm.sizes.inputHeight },
  fieldLabel: { color: wm.colors.textMuted, fontSize: "12px", fontWeight: 800 },
  input: { ...wmStyles.input, width: "100%", minHeight: wm.sizes.inputHeight, padding: "8px 10px" },
  disabledInput: { background: wm.colors.surfaceLow, color: wm.colors.textMuted, cursor: "not-allowed" },
  presetGroup: { display: "flex", gap: "6px", flexWrap: "wrap" as const },
  presetButton: { ...wmStyles.secondaryButton, minHeight: "34px", padding: "6px 10px" },
  filterActions: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" as const },
  rangeText: { color: wm.colors.textMuted, fontSize: "12px", fontWeight: 700 },
  statusPanel: { ...wmStyles.infoNotice, display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", flexWrap: "wrap" as const, padding: "16px" },
  agentPanel: { ...wmStyles.card, padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px", color: wm.colors.textSecondary },
  agentOnline: { borderColor: wm.colors.successBorder, background: wm.colors.successBg, color: wm.colors.success },
  agentInterrupted: { borderColor: wm.colors.error, background: wm.colors.errorBg, color: wm.colors.errorText },
  agentBody: { minWidth: 0, flex: 1 },
  agentHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" as const },
  agentTimestamp: { color: wm.colors.textMuted, fontSize: "12px", fontWeight: 700 },
  currentAppRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", alignItems: "center", gap: "12px", borderTop: `1px solid ${wm.colors.borderSubtle}`, borderBottom: `1px solid ${wm.colors.borderSubtle}`, padding: "12px 0", marginTop: "4px" },
  currentAppLabel: { color: wm.colors.textMuted, fontSize: "12px", fontWeight: 800 },
  currentAppName: { color: wm.colors.text, fontSize: "15px", overflowWrap: "anywhere" as const },
  currentAppDuration: { color: wm.colors.secondary, fontSize: "16px", fontWeight: 900, whiteSpace: "nowrap" as const },
  agentMeta: { margin: "10px 0 0", color: wm.colors.textMuted, fontSize: "12px" },
  todayUsageRow: { display: "flex", justifyContent: "space-between", gap: "12px", paddingTop: "10px", color: wm.colors.textSecondary, fontSize: "13px", fontWeight: 800, flexWrap: "wrap" as const },
  panelLabel: { ...wmStyles.eyebrow, color: wm.colors.infoText, margin: 0 },
  panelTitle: { margin: "0 0 8px", color: wm.colors.text, fontSize: "18px", lineHeight: 1.3 },
  panelText: { margin: 0, color: wm.colors.textSecondary, fontSize: "13px", lineHeight: 1.5, maxWidth: "880px" },
  sessionText: { margin: "8px 0 0", color: wm.colors.textMuted, fontSize: "12px", fontWeight: 800 },
  errorText: { margin: 0, color: wm.colors.errorText, background: wm.colors.errorBg, border: `1px solid ${wm.colors.error}`, borderRadius: wm.radius.md, padding: "10px 12px", fontSize: "13px", fontWeight: 800, maxWidth: "380px" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" },
  metricCard: { ...wmStyles.card, padding: "16px" },
  metricLabel: { margin: "0 0 8px", color: wm.colors.textMuted, fontSize: "12px", fontWeight: 900, textTransform: "uppercase" as const },
  metricValue: { display: "block", color: wm.colors.text, fontSize: "26px", lineHeight: 1 },
  metricDetail: { margin: "10px 0 0", color: wm.colors.textSecondary, fontSize: "13px", lineHeight: 1.45 },
  trendPanel: { ...wmStyles.card, padding: "16px", display: "grid", gap: "12px" },
  trendHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", flexWrap: "wrap" as const },
  legend: { display: "flex", alignItems: "center", gap: "6px", color: wm.colors.textMuted, fontSize: "12px", fontWeight: 700 },
  appLegend: { width: "12px", height: "8px", borderRadius: wm.radius.sm, background: wm.colors.secondary },
  domainLegend: { width: "12px", height: "8px", borderRadius: wm.radius.sm, background: wm.colors.focus },
  trendRows: { display: "grid", gap: "8px", maxHeight: "320px", overflowY: "auto" as const },
  trendRow: { display: "grid", gridTemplateColumns: "64px minmax(120px, 1fr) 112px", gap: "10px", alignItems: "center", minHeight: "32px" },
  trendDate: { color: wm.colors.textMuted, fontSize: "12px", fontWeight: 700 },
  bars: { display: "grid", gap: "3px", minWidth: 0 },
  appBar: { height: "7px", minWidth: "2px", borderRadius: wm.radius.sm, background: wm.colors.secondary },
  domainBar: { height: "7px", minWidth: "2px", borderRadius: wm.radius.sm, background: wm.colors.focus },
  trendValue: { color: wm.colors.textSecondary, fontSize: "11px", fontWeight: 700, textAlign: "right" as const, whiteSpace: "nowrap" as const },
  employeeBars: { display: "grid", gap: "10px" },
  employeeBarRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "12px", alignItems: "center", minHeight: "30px" },
  employeeName: { color: wm.colors.text, fontSize: "13px", fontWeight: 800, overflowWrap: "anywhere" as const },
  employeeBarTrack: { height: "12px", background: wm.colors.surfaceLow, border: `1px solid ${wm.colors.borderSubtle}`, overflow: "hidden", borderRadius: wm.radius.sm },
  employeeBarFill: { display: "block", height: "100%", minWidth: "2px", background: wm.colors.secondary },
  employeeDuration: { color: wm.colors.textSecondary, fontSize: "12px", textAlign: "right" as const, whiteSpace: "nowrap" as const },
  sessionRows: { display: "grid", gap: "8px", maxHeight: "320px", overflowY: "auto" as const },
  sessionRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: "12px", alignItems: "center", minHeight: "38px", borderTop: `1px solid ${wm.colors.borderSubtle}`, color: wm.colors.textSecondary, fontSize: "12px" },
  sessionState: { color: wm.colors.success, fontWeight: 900 },
  sessionInterrupted: { color: wm.colors.errorText },
  apiPanel: { ...wmStyles.card, padding: "16px" },
  apiHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", marginBottom: "12px" },
  scopePill: { border: `1px solid ${wm.colors.infoBorder}`, borderRadius: wm.radius.full, background: wm.colors.infoBg, color: wm.colors.infoText, padding: "6px 10px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" as const },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "12px" },
  summaryCard: { border: `1px solid ${wm.colors.borderSubtle}`, borderRadius: wm.radius.md, background: wm.colors.surfaceLow, padding: "12px", minWidth: 0 },
  summaryTitle: { margin: "0 0 10px", color: wm.colors.text, fontSize: "16px" },
  summaryRows: { display: "grid", gap: "8px" },
  summaryRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "10px", alignItems: "center", borderTop: `1px solid ${wm.colors.borderSubtle}`, paddingTop: "10px", minHeight: "58px" },
  appMetricCard: { border: `1px solid ${wm.colors.borderSubtle}`, borderRadius: wm.radius.md, background: wm.colors.surface, overflow: "hidden", minWidth: 0 },
  appMetricToggle: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" as const, border: 0, background: "transparent", color: wm.colors.text, padding: "10px", textAlign: "left" as const, font: "inherit", cursor: "pointer" },
  appPrimaryMetric: { display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" },
  appMetricChevron: { flex: "0 0 auto", color: wm.colors.textMuted, transition: "transform 160ms ease" },
  appSecondaryMetrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", borderTop: `1px solid ${wm.colors.borderSubtle}`, background: wm.colors.surfaceLow, padding: "10px" },
  nameCell: { display: "grid", gap: "3px", minWidth: 0 },
  summaryName: { display: "block", margin: "0 0 3px", color: wm.colors.text, fontSize: "13px", fontWeight: 800, overflowWrap: "anywhere" as const },
  summaryCategory: { display: "block", margin: 0, color: wm.colors.textMuted, fontSize: "12px" },
  summaryTime: { color: wm.colors.textSecondary, fontSize: "12px", fontWeight: 800, whiteSpace: "nowrap" as const },
  domainMetricChips: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" as const },
  metricChip: { display: "grid", gap: "2px", borderWidth: "1px", borderStyle: "solid", borderColor: wm.colors.borderSubtle, borderRadius: wm.radius.md, padding: "8px 9px", minWidth: 0 },
  metricChipProminent: { minWidth: "142px", padding: "9px 11px", boxShadow: "0 1px 2px rgba(25, 165, 100, 0.10)" },
  metricChipActive: { background: wm.colors.successBg, borderColor: wm.colors.successBorder, color: wm.colors.success },
  metricChipIdle: { background: wm.colors.warningBg, borderColor: wm.colors.warningBorder, color: wm.colors.warning },
  metricChipRuntime: { background: wm.colors.infoBg, borderColor: wm.colors.infoBorder, color: wm.colors.infoText },
  metricChipLabel: { color: "currentColor", fontSize: "10px", fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" as const, opacity: 0.82 },
  metricChipValue: { color: "currentColor", fontSize: "13px", lineHeight: 1.2, whiteSpace: "nowrap" as const },
  metricChipValueProminent: { fontSize: "16px" },
  emptyPanel: { ...wmStyles.infoNotice, display: "grid", gap: "6px", padding: "16px" },
  emptyText: { margin: 0, color: wm.colors.textSecondary, fontSize: "13px", lineHeight: 1.45 },
} as const;
