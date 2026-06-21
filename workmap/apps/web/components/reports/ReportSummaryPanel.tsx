"use client";

import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type { ApiClientOptions, WorkMapApiUsageSummary, WorkMapApiUser } from "../../lib/api/apiTypes";
import { getUsageSummary } from "../../lib/api/reportsApi";
import { listUsers } from "../../lib/api/usersApi";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { WorkMapButton } from "../ui/WorkMapButton";

type AuthContext = { options: ApiClientOptions; role: string; userId: string; source: string };
type ViewFilter = "company" | "me" | `user:${string}`;
type ReportFilters = { view: ViewFilter; departmentId: string; from: string; to: string };
type ReportState = {
  loading: boolean;
  summary: WorkMapApiUsageSummary | null;
  statusText: string;
  error: string | null;
};

export function ReportSummaryPanel() {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [users, setUsers] = useState<WorkMapApiUser[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(() => defaultFilters("me"));
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => defaultFilters("me"));
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
      const initialFilters = defaultFilters(canRequestCompanySummary(context.role) ? "company" : "me");
      const directoryResult = canRequestCompanySummary(context.role) ? await listUsers(context.options) : null;
      const result = await requestSummary(context, initialFilters);
      if (cancelled) return;

      setAuth(context);
      setFilters(initialFilters);
      setAppliedFilters(initialFilters);
      if (directoryResult?.ok) setUsers(directoryResult.data);
      applyResult(result, setReportState);
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

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
    setAppliedFilters(filters);
    applyResult(result, setReportState);
  }

  function applyPreset(days: number) {
    const to = utcToday();
    setFilters((current) => ({ ...current, from: addUtcDays(to, -(days - 1)), to }));
  }

  const summary = reportState.summary;
  const hasRows = Boolean(summary && (summary.apps.length > 0 || summary.websites.length > 0));
  const scopeLabel = getScopeLabel(summary, selectedUser, departments);

  return (
    <div style={styles.stack}>
      <section style={styles.filterPanel} aria-label="Report filters">
        <div style={styles.filterHeader}>
          <div>
            <p style={styles.panelLabel}>Report controls</p>
            <h2 style={styles.panelTitle}>Usage summary filters</h2>
          </div>
          <div style={styles.presetGroup} aria-label="Date presets">
            {[7, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => applyPreset(days)} style={styles.presetButton}>{days} days</button>
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

      {summary ? <MetricGrid summary={summary} /> : null}

      {summary && summary.daily.length > 0 ? <DailyTrend rows={summary.daily} /> : null}

      {summary ? (
        <section style={styles.apiPanel}>
          <div style={styles.apiHeader}>
            <div>
              <p style={styles.panelLabel}>API summary</p>
              <h2 style={styles.panelTitle}>{scopeLabel}</h2>
              <p style={styles.panelText}>App and domain totals remain separate because browser time also appears under the desktop browser process.</p>
            </div>
            <span style={styles.scopePill}>{summary.scope === "company" ? "Company scope" : "User scope"}</span>
          </div>
          {hasRows ? (
            <div style={styles.summaryGrid}>
              <SummaryUsageList title="Apps" rows={summary.apps.map((row) => ({ name: row.appName, ...row }))} />
              <SummaryUsageList title="Domains" rows={summary.websites.map((row) => ({ name: row.domain, ...row }))} />
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

function MetricGrid({ summary }: { summary: WorkMapApiUsageSummary }) {
  const appActive = sum(summary.apps, "activeSeconds");
  const appIdle = sum(summary.apps, "idleSeconds");
  const domainActive = sum(summary.websites, "activeSeconds");
  const domainIdle = sum(summary.websites, "idleSeconds");
  const metrics = [
    { label: "App active", value: formatDuration(appActive), detail: `${formatDuration(appIdle)} app idle` },
    { label: "Domain active", value: formatDuration(domainActive), detail: `${formatDuration(domainIdle)} domain idle` },
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

type UsageListRow = {
  name: string;
  category: string | null;
  productivityLabel: string | null;
  activeSeconds: number;
  idleSeconds: number;
};

function SummaryUsageList({ title, rows }: { title: string; rows: UsageListRow[] }) {
  return (
    <section style={styles.summaryCard}>
      <h3 style={styles.summaryTitle}>{title}</h3>
      <div style={styles.summaryRows}>
        {rows.map((row) => (
          <div key={row.name} style={styles.summaryRow}>
            <div style={styles.nameCell}>
              <p style={styles.summaryName}>{row.name}</p>
              <p style={styles.summaryCategory}>{row.category ?? formatProductivity(row.productivityLabel)}</p>
            </div>
            <span style={styles.summaryTime}>{formatDuration(row.activeSeconds)} active</span>
            <span style={styles.summaryTime}>{formatDuration(row.idleSeconds)} idle</span>
          </div>
        ))}
      </div>
    </section>
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

function defaultFilters(view: ViewFilter): ReportFilters {
  const to = utcToday();
  return { view, departmentId: "", from: addUtcDays(to, -29), to };
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
    ["scope", "source", "item", "category", "productivity", "active_seconds", "idle_seconds", "from", "to"],
    ...summary.apps.map((row) => [scopeLabel, "app", row.appName, row.category ?? "", row.productivityLabel ?? "", row.activeSeconds, row.idleSeconds, summary.range.from, summary.range.to]),
    ...summary.websites.map((row) => [scopeLabel, "domain", row.domain, row.category ?? "", row.productivityLabel ?? "", row.activeSeconds, row.idleSeconds, summary.range.from, summary.range.to]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `workmap-usage-${summary.range.from}-${summary.range.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const text = safe.replace(/"/g, '""');
  return `"${text}"`;
}

function sum(rows: Array<{ activeSeconds: number; idleSeconds: number }>, key: "activeSeconds" | "idleSeconds") {
  return rows.reduce((total, row) => total + row[key], 0);
}

function formatProductivity(value: string | null) {
  return value ? value.toLowerCase().replace(/_/g, " ") : "Uncategorised";
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
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
  apiPanel: { ...wmStyles.card, padding: "16px" },
  apiHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", marginBottom: "12px" },
  scopePill: { border: `1px solid ${wm.colors.infoBorder}`, borderRadius: wm.radius.full, background: wm.colors.infoBg, color: wm.colors.infoText, padding: "6px 10px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" as const },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "12px" },
  summaryCard: { border: `1px solid ${wm.colors.borderSubtle}`, borderRadius: wm.radius.md, background: wm.colors.surfaceLow, padding: "12px", minWidth: 0 },
  summaryTitle: { margin: "0 0 10px", color: wm.colors.text, fontSize: "16px" },
  summaryRows: { display: "grid", gap: "8px" },
  summaryRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: "10px", alignItems: "center", borderTop: `1px solid ${wm.colors.borderSubtle}`, paddingTop: "8px", minHeight: "46px" },
  nameCell: { minWidth: 0 },
  summaryName: { margin: "0 0 3px", color: wm.colors.text, fontSize: "13px", fontWeight: 800, overflowWrap: "anywhere" as const },
  summaryCategory: { margin: 0, color: wm.colors.textMuted, fontSize: "12px" },
  summaryTime: { color: wm.colors.textSecondary, fontSize: "12px", fontWeight: 800, whiteSpace: "nowrap" as const },
  emptyPanel: { ...wmStyles.infoNotice, display: "grid", gap: "6px", padding: "16px" },
  emptyText: { margin: 0, color: wm.colors.textSecondary, fontSize: "13px", lineHeight: 1.45 },
} as const;
