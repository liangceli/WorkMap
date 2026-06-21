"use client";

import { useEffect, useMemo, useState } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getUsageSummary } from "../../lib/api/reportsApi";
import type { WorkMapApiUsageSummary } from "../../lib/api/apiTypes";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type ReportState = {
  loading: boolean;
  authSource: string | null;
  role: string | null;
  summary: WorkMapApiUsageSummary | null;
  statusText: string;
  error: string | null;
};

const initialReportState: ReportState = {
  loading: true,
  authSource: null,
  role: null,
  summary: null,
  statusText: "Checking reports API...",
  error: null,
};

export function ReportSummaryPanel() {
  const [reportState, setReportState] = useState<ReportState>(initialReportState);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      const auth = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      if (!auth.available) {
        setReportState({
          loading: false,
          authSource: null,
          role: null,
          summary: null,
          statusText: "Sign in to load the backend usage summary for your workspace role.",
          error: auth.reason,
        });
        return;
      }

      const reportScope = canRequestCompanySummary(auth.role) ? "company" : "user";
      const result = await getUsageSummary({ ...auth.options, scope: reportScope });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setReportState({
          loading: false,
          authSource: auth.source,
          role: auth.role ?? null,
          summary: null,
          statusText: "Reports API could not be loaded.",
          error: result.error,
        });
        return;
      }

      setReportState({
        loading: false,
        authSource: auth.source,
        role: auth.role ?? null,
        summary: result.data,
        statusText:
          result.data.scope === "company"
            ? "Reports API loaded an aggregate workspace app and domain summary."
            : "Reports API loaded the current user's app and domain summary.",
        error: null,
      });
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  const apiMetrics = useMemo(() => buildApiMetrics(reportState.summary), [reportState.summary]);
  const hasApiRows = Boolean(reportState.summary && (reportState.summary.apps.length > 0 || reportState.summary.websites.length > 0));
  const scopeGuidance = getScopeGuidance(reportState.role, reportState.summary?.scope);

  return (
    <div style={styles.stack}>
      <section style={styles.statusPanel}>
        <div>
          <p style={styles.panelLabel}>Role-aware reporting</p>
          <h2 style={styles.panelTitle}>{reportState.loading ? "Checking reports API" : reportState.statusText}</h2>
          <p style={styles.panelText}>
            WorkMap reports currently expose app names, domains, active seconds, and idle seconds through the existing API. Company
            summaries are aggregate-only, while employees see their own rows. Reports do not include raw employee activity streams.
          </p>
          {reportState.authSource ? <p style={styles.sessionText}>API context: {formatAuthSource(reportState.authSource)}</p> : null}
          <p style={styles.sessionText}>{scopeGuidance}</p>
        </div>
        {reportState.error ? <p style={styles.errorText}>{reportState.error}</p> : null}
      </section>

      <section style={styles.boundaryGrid}>
        <ReportBoundaryCard
          title="Employee view"
          text="Employees can review their own app/domain summary rows when data exists. Company-wide reporting remains unavailable to employee roles."
        />
        <ReportBoundaryCard
          title="Owner view"
          text="Owners and allowed manager roles can request company aggregate summaries. These reports summarize app/domain time and device coverage without raw private content."
        />
          <ReportBoundaryCard
          title="Data availability"
          text="Device coverage and usage rows appear only after the desktop agent and browser extension submit real app/domain duration events."
        />
      </section>

      {apiMetrics ? (
        <section style={styles.metricGrid}>
          {apiMetrics.map((metric) => (
            <article key={metric.label} style={styles.metricCard}>
              <p style={styles.metricLabel}>{metric.label}</p>
              <strong style={styles.metricValue}>{metric.value}</strong>
              <p style={styles.metricDetail}>{metric.detail}</p>
            </article>
          ))}
        </section>
      ) : (
        <section style={styles.emptyPanel}>
          <h2 style={styles.panelTitle}>No report data loaded</h2>
          <p style={styles.panelText}>
            Sign in with Cognito and connect tracking clients before validating usage numbers. WorkMap will not show placeholder report rows
            as tenant data.
          </p>
        </section>
      )}

      {reportState.summary ? (
        <section style={styles.apiPanel}>
          <div style={styles.apiHeader}>
            <div>
              <p style={styles.panelLabel}>Available API summary</p>
              <h2 style={styles.panelTitle}>{reportState.summary.scope === "company" ? "Tenant usage summary" : "Current user usage rows"}</h2>
              <p style={styles.panelText}>
                {reportState.summary.scope === "company"
                  ? "Aggregate company rows help Owners understand data availability without exposing raw employee activity details."
                  : "Own-scope rows help the signed-in user understand their personal app/domain summary."}
              </p>
            </div>
            <span style={styles.scopePill}>{reportState.summary.scope === "company" ? "Company scope" : hasApiRows ? "API data" : "Sparse data"}</span>
          </div>
          {hasApiRows ? (
            <div style={styles.summaryGrid}>
              <SummaryUsageList title="Apps" rows={reportState.summary.apps.map((row) => ({
                name: row.appName,
                category: row.category ?? row.productivityLabel ?? "Uncategorized",
                activeSeconds: row.activeSeconds,
                idleSeconds: row.idleSeconds,
              }))} />
              <SummaryUsageList title="Domains" rows={reportState.summary.websites.map((row) => ({
                name: row.domain,
                category: row.category ?? row.productivityLabel ?? "Uncategorized",
                activeSeconds: row.activeSeconds,
                idleSeconds: row.idleSeconds,
              }))} />
            </div>
          ) : (
            <p style={styles.emptyText}>
              The Reports API responded, but this scope has no usage summary rows yet. This is acceptable during alpha setup; register a
              device and submit app/domain events before validating report numbers.
            </p>
          )}
        </section>
      ) : null}

    </div>
  );
}

function ReportBoundaryCard({ title, text }: { title: string; text: string }) {
  return (
    <article style={styles.boundaryCard}>
      <h3 style={styles.boundaryTitle}>{title}</h3>
      <p style={styles.boundaryText}>{text}</p>
    </article>
  );
}

type SummaryUsageRow = {
  name: string;
  category: string;
  activeSeconds: number;
  idleSeconds: number;
};

function SummaryUsageList({ title, rows }: { title: string; rows: SummaryUsageRow[] }) {
  return (
    <section style={styles.summaryCard}>
      <h3 style={styles.summaryTitle}>{title}</h3>
      {rows.length > 0 ? (
        <div style={styles.summaryRows}>
          {rows.slice(0, 6).map((row) => (
            <div key={row.name} style={styles.summaryRow}>
              <div>
                <p style={styles.summaryName}>{row.name}</p>
                <p style={styles.summaryCategory}>{row.category}</p>
              </div>
              <span style={styles.summaryTime}>{formatDuration(row.activeSeconds)} active</span>
              <span style={styles.summaryTime}>{formatDuration(row.idleSeconds)} idle</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.emptyText}>No {title.toLowerCase()} rows yet.</p>
      )}
    </section>
  );
}

function buildApiMetrics(summary: WorkMapApiUsageSummary | null) {
  if (!summary) {
    return null;
  }

  const activeSeconds = [...summary.apps, ...summary.websites].reduce((sum, row) => sum + row.activeSeconds, 0);
  const idleSeconds = [...summary.apps, ...summary.websites].reduce((sum, row) => sum + row.idleSeconds, 0);

  return [
    {
      label: "Active time",
      value: formatDuration(activeSeconds),
      detail: summary.scope === "company" ? "Tenant aggregate rows returned by Reports API." : "Current user rows returned by Reports API.",
    },
    { label: "Idle time", value: formatDuration(idleSeconds), detail: "Idle seconds from app and domain summary rows." },
    { label: "App rows", value: String(summary.apps.length), detail: "App names only; no screenshots or keystrokes." },
    {
      label: "Devices active",
      value: summary.deviceCoverage
        ? `${summary.deviceCoverage.activeDevices24h} / ${summary.deviceCoverage.registeredDevices}`
        : String(summary.websites.length),
      detail: summary.deviceCoverage
        ? `${summary.deviceCoverage.usersWithActivity} user(s) have activity rows in this scope.`
        : "Domains only; no full URL history in this report.",
    },
  ];
}

function canRequestCompanySummary(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN";
}

function getScopeGuidance(role: string | null, scope: WorkMapApiUsageSummary["scope"] | undefined) {
  if (role === "EMPLOYEE") {
    return "Employee view: this page uses your own report scope. Company-wide summaries are owner/manager-only.";
  }

  if (scope === "company") {
    return "Owner/manager view: company summaries are aggregate-only and do not expose raw activity rows.";
  }

  if (!role) {
    return "Sign in to resolve the report scope for your role.";
  }

  return "This role uses the safest available report scope for the current API contract.";
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

function formatAuthSource(source: string) {
  return source === "cognito-session" ? "Cognito session" : source;
}

const styles = {
  stack: {
    display: "grid",
    gap: "14px",
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
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  sessionText: {
    margin: "8px 0 0",
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 800,
  },
  errorText: {
    margin: 0,
    color: wm.colors.warning,
    fontSize: "13px",
    fontWeight: 800,
    maxWidth: "360px",
  },
  boundaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: "12px",
  },
  boundaryCard: {
    ...wmStyles.card,
    padding: "14px",
  },
  boundaryTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "15px",
    fontWeight: 900,
  },
  boundaryText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
  },
  emptyPanel: {
    ...wmStyles.infoNotice,
    display: "grid",
    gap: "6px",
    padding: "16px",
  },
  metricCard: {
    ...wmStyles.card,
    padding: "16px",
  },
  metricLabel: {
    margin: "0 0 8px",
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  metricValue: {
    display: "block",
    color: wm.colors.text,
    fontSize: "26px",
    lineHeight: 1,
  },
  metricDetail: {
    margin: "10px 0 0",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  apiPanel: {
    ...wmStyles.card,
    padding: "16px",
  },
  apiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "12px",
    marginBottom: "12px",
  },
  scopePill: {
    borderWidth: "1px",
    borderStyle: "solid" as const,
    borderColor: wm.colors.infoBorder,
    borderRadius: "999px",
    background: wm.colors.infoBg,
    color: wm.colors.infoText,
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: "12px",
  },
  summaryCard: {
    borderWidth: "1px",
    borderStyle: "solid" as const,
    borderColor: wm.colors.borderSubtle,
    borderRadius: wm.radius.lg,
    background: wm.colors.surfaceLow,
    padding: "12px",
  },
  summaryTitle: {
    margin: "0 0 10px",
    color: wm.colors.text,
    fontSize: "16px",
  },
  summaryRows: {
    display: "grid",
    gap: "8px",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: "10px",
    alignItems: "center",
    borderTopWidth: "1px",
    borderTopStyle: "solid" as const,
    borderTopColor: wm.colors.borderSubtle,
    paddingTop: "8px",
  },
  summaryName: {
    margin: "0 0 3px",
    color: wm.colors.text,
    fontSize: "13px",
    fontWeight: 800,
  },
  summaryCategory: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "12px",
  },
  summaryTime: {
    color: wm.colors.textSecondary,
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  },
  emptyText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
