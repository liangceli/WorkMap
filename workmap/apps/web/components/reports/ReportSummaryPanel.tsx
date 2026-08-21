"use client";

import { Activity, AlertTriangle, ChevronDown, Download, FileText, Globe2, History, Monitor, Power, RefreshCw, Wifi, WifiOff } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type {
  ApiClientOptions,
  WorkMapApiReportLiveStatus,
  WorkMapApiTrackingAudit,
  WorkMapApiTrackingV2LiveActivity,
  WorkMapApiUsageSummary,
  WorkMapApiUser,
} from "../../lib/api/apiTypes";
import { getAgentLiveStatus, getTrackingAudit, getTrackingV2LiveActivity, getUsageSummary } from "../../lib/api/reportsApi";
import { getCompliancePolicy } from "../../lib/api/complianceApi";
import { listUsers } from "../../lib/api/usersApi";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { WorkMapButton } from "../ui/WorkMapButton";
import { readReportSnapshot, updateReportSnapshot } from "./reportSnapshotCache";
import { startCompletionPoller } from "./completionPoller";
import { refreshReportSelection } from "./reportSelectionRefresh";
import {
  isConnectionAuditTimestampInRange,
  resolveConnectionAuditRange,
} from "./connectionAuditRange";
import {
  selectTrackingV2LiveDevices,
  trackingV2ConnectionPresentation,
  trackingV2SnapshotPresentation,
  type TrackingV2LiveDevice,
} from "./trackingV2LivePresentation";
import {
  defaultReportFilters,
  calendarToday,
  normalizeTimeZone,
  resolveViewerTimeZone,
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

type AuditState = {
  audit: WorkMapApiTrackingAudit | null;
  refreshStatus: "loading" | "ready" | "error";
};

type CurrentLiveData = {
  trackingV2: WorkMapApiTrackingV2LiveActivity | null;
  legacy: WorkMapApiReportLiveStatus | null;
  revision: string | null;
};

type SelectionRefreshState = {
  live: boolean;
  summary: boolean;
};

const LIVE_REFRESH_MS = 15_000;
const SUMMARY_REVISION_CHECK_MS = 60_000;
const AUDIT_REFRESH_MS = 60_000;
const LIVE_REQUEST_TIMEOUT_MS = 10_000;
const AUDIT_REQUEST_TIMEOUT_MS = 15_000;
const SUMMARY_REQUEST_TIMEOUT_MS = 20_000;

export function ReportSummaryPanel() {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [reportTimeZone, setReportTimeZone] = useState("UTC");
  const [users, setUsers] = useState<WorkMapApiUser[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(() => defaultReportFilters("company"));
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => defaultReportFilters("company"));
  const [liveStatus, setLiveStatus] = useState<WorkMapApiReportLiveStatus | null>(null);
  const [trackingV2Live, setTrackingV2Live] = useState<WorkMapApiTrackingV2LiveActivity | null>(null);
  const [selectionRefresh, setSelectionRefresh] = useState<SelectionRefreshState>({ live: false, summary: false });
  const [livePollingReady, setLivePollingReady] = useState(false);
  const activityRevisionRef = useRef<string | null | undefined>(undefined);
  const [auditState, setAuditState] = useState<AuditState>({ audit: null, refreshStatus: "loading" });
  const filterRequestAbortRef = useRef<AbortController | null>(null);
  const [reportState, setReportState] = useState<ReportState>({
    loading: true,
    summary: null,
    statusText: "Checking reports API...",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const requestAbort = new AbortController();
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
      const policyResult = await getCompliancePolicy(context.options);
      if (cancelled) return;
      const timeZone = normalizeTimeZone(
        policyResult.ok
          ? policyResult.data.scheduleTimeZone
          : resolveViewerTimeZone(),
      );
      setReportTimeZone(timeZone);
      const fallbackFilters = defaultReportFilters(
        canViewCompany ? "company" : "me",
        calendarToday(new Date(), timeZone),
      );
      const initialFilters = restoreReportFilters(context.userId, fallbackFilters, {
        canViewCompany,
      });
      setAuth(context);
      setFilters(initialFilters);
      setAppliedFilters(initialFilters);

      const snapshotKey = reportSnapshotKey(context, initialFilters, timeZone);
      const snapshot = readReportSnapshot(snapshotKey);
      const now = Date.now();
      if (snapshot?.liveStatus) setLiveStatus(snapshot.liveStatus);
      if (snapshot?.trackingV2Live) setTrackingV2Live(snapshot.trackingV2Live);
      if (snapshot?.audit) setAuditState({ audit: snapshot.audit, refreshStatus: "ready" });
      if (snapshot?.summary) {
        activityRevisionRef.current = currentLiveRevision({
          trackingV2: snapshot.trackingV2Live,
          legacy: snapshot.liveStatus,
          revision: null,
        });
        setReportState({
          loading: false,
          summary: snapshot.summary,
          statusText: snapshot.summary.scope === "company" ? "Company usage summary loaded." : "Personal usage summary loaded.",
          error: null,
        });
      }

      // After timezone-dependent filters are resolved, cold live and summary
      // requests are launched together. Audit is independent and cannot be
      // blocked by a live-status failure.
      const summaryRevisionDue = !snapshot?.summary || now - snapshot.summaryCachedAt >= SUMMARY_REVISION_CHECK_MS;
      const cachedRevision = currentLiveRevision({
        trackingV2: snapshot?.trackingV2Live ?? null,
        legacy: snapshot?.liveStatus ?? null,
        revision: null,
      });
      const initialLivePromise = requestCurrentLive(context, initialFilters, summaryRevisionDue, requestAbort.signal);
      const coldSummaryPromise = snapshot?.summary
        ? Promise.resolve(null)
        : requestSummary(context, initialFilters, requestAbort.signal);
      if (initialFilters.view !== "company" && (!snapshot?.audit || now - snapshot.auditCachedAt >= AUDIT_REFRESH_MS)) {
        void loadAudit(context, initialFilters, timeZone, () => cancelled, setAuditState, (audit) => {
          updateReportSnapshot(snapshotKey, { audit });
        }, requestAbort.signal);
      }
      const [initialLiveResult, coldSummaryResult] = await Promise.all([initialLivePromise, coldSummaryPromise]);
      if (cancelled) return;
      if (initialLiveResult.ok) {
        setLiveStatus(initialLiveResult.data.legacy);
        setTrackingV2Live(initialLiveResult.data.trackingV2);
        activityRevisionRef.current = initialLiveResult.data.revision;
        updateReportSnapshot(snapshotKey, {
          liveStatus: initialLiveResult.data.legacy,
          trackingV2Live: initialLiveResult.data.trackingV2,
        });
      }

      if (coldSummaryResult) {
        applyResult(coldSummaryResult, setReportState);
        if (coldSummaryResult.ok) updateReportSnapshot(snapshotKey, { summary: coldSummaryResult.data });
      } else if (
        summaryRevisionDue
          && initialLiveResult.ok
          && initialLiveResult.data.revision !== cachedRevision
      ) {
        const result = await requestSummary(context, initialFilters, requestAbort.signal);
        if (cancelled) return;
        if (result.ok) {
          applyResult(result, setReportState);
          updateReportSnapshot(snapshotKey, { summary: result.data });
        }
      }

      // The user directory only fills the Owner filter controls. It must not block
      // the current page's first report request or compete with it at startup.
      if (canViewCompany) {
        void loadDirectory(context.options, () => cancelled, setUsers);
      }
      setLivePollingReady(true);
    }
    void initialize();
    return () => {
      cancelled = true;
      requestAbort.abort();
      filterRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (auth) persistReportFilters(auth.userId, filters);
  }, [auth, filters]);

  useEffect(() => {
    if (!auth || !livePollingReady) return;
    let cancelled = false;
    const requestAbort = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const result = await requestCurrentLive(auth, appliedFilters, false, requestAbort.signal);
      if (cancelled || !result.ok) return;
      setLiveStatus(result.data.legacy);
      setTrackingV2Live(result.data.trackingV2);
      const snapshotKey = reportSnapshotKey(auth, appliedFilters, reportTimeZone);
      updateReportSnapshot(snapshotKey, {
        liveStatus: result.data.legacy,
        trackingV2Live: result.data.trackingV2,
      });
    };
    const poller = startCompletionPoller(refresh, LIVE_REFRESH_MS, undefined, false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") poller.trigger();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      requestAbort.abort();
      poller.stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [auth, appliedFilters, livePollingReady, reportTimeZone]);

  useEffect(() => {
    if (!auth || !livePollingReady || appliedFilters.view === "company") return;
    let cancelled = false;
    const requestAbort = new AbortController();
    const refreshAudit = async () => {
      if (document.visibilityState !== "visible") return;
      const snapshotKey = reportSnapshotKey(auth, appliedFilters, reportTimeZone);
      await loadAudit(auth, appliedFilters, reportTimeZone, () => cancelled, setAuditState, (audit) => {
        updateReportSnapshot(snapshotKey, { audit });
      }, requestAbort.signal);
    };
    const poller = startCompletionPoller(refreshAudit, AUDIT_REFRESH_MS, undefined, false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") poller.trigger();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      requestAbort.abort();
      poller.stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [auth, appliedFilters, livePollingReady, reportTimeZone]);

  useEffect(() => {
    if (!auth || !livePollingReady) return;
    let cancelled = false;
    const requestAbort = new AbortController();
    const refreshSummaryRevision = async () => {
      if (document.visibilityState !== "visible") return;
      const liveResult = await requestCurrentLive(auth, appliedFilters, true, requestAbort.signal);
      if (cancelled || !liveResult.ok || liveResult.data.revision === activityRevisionRef.current) return;
      const summaryResult = await requestSummary(auth, appliedFilters, requestAbort.signal);
      if (cancelled || !summaryResult.ok) return;
      activityRevisionRef.current = liveResult.data.revision;
      applyResult(summaryResult, setReportState);
      updateReportSnapshot(reportSnapshotKey(auth, appliedFilters, reportTimeZone), { summary: summaryResult.data });
    };
    const poller = startCompletionPoller(refreshSummaryRevision, SUMMARY_REVISION_CHECK_MS, undefined, false);
    return () => {
      cancelled = true;
      requestAbort.abort();
      poller.stop();
    };
  }, [auth, appliedFilters, livePollingReady, reportTimeZone]);

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
    filterRequestAbortRef.current?.abort();
    const requestAbort = new AbortController();
    filterRequestAbortRef.current = requestAbort;
    const nextFilters = { ...filters };
    const selectionChanged = !sameReportSelection(nextFilters, appliedFilters);
    const snapshotKey = reportSnapshotKey(auth, nextFilters, reportTimeZone);

    setSelectionRefresh({ live: true, summary: true });
    setLiveStatus(null);
    setTrackingV2Live(null);
    activityRevisionRef.current = undefined;
    setReportState((current) => ({
      ...current,
      loading: false,
      summary: selectionChanged ? null : current.summary,
      error: null,
      statusText: "Refreshing report...",
    }));
    if (selectionChanged) setAuditState({ audit: null, refreshStatus: "loading" });
    setAppliedFilters(nextFilters);
    persistReportFilters(auth.userId, nextFilters);

    try {
      await refreshReportSelection({
        requestLive: () => requestCurrentLive(auth, nextFilters, false, requestAbort.signal),
        requestSummary: () => requestSummary(auth, nextFilters, requestAbort.signal),
        applyLive: (result) => {
          if (requestAbort.signal.aborted || filterRequestAbortRef.current !== requestAbort) return;
          if (result.ok) {
            setLiveStatus(result.data.legacy);
            setTrackingV2Live(result.data.trackingV2);
            activityRevisionRef.current = result.data.revision;
            updateReportSnapshot(snapshotKey, {
              liveStatus: result.data.legacy,
              trackingV2Live: result.data.trackingV2,
            });
          }
          if (result.ok) setSelectionRefresh((current) => ({ ...current, live: false }));
        },
        applySummary: (result) => {
          if (requestAbort.signal.aborted || filterRequestAbortRef.current !== requestAbort) return;
          applyResult(result, setReportState, !selectionChanged);
          if (result.ok) {
            updateReportSnapshot(snapshotKey, { summary: result.data });
            if (result.data.scope === "user") {
              void loadAudit(auth, nextFilters, reportTimeZone, () => requestAbort.signal.aborted, setAuditState, (audit) => {
                updateReportSnapshot(snapshotKey, { audit });
              }, requestAbort.signal);
            }
          }
          setSelectionRefresh((current) => ({ ...current, summary: false }));
        },
      });
    } finally {
      if (filterRequestAbortRef.current === requestAbort) {
        setSelectionRefresh({ live: false, summary: false });
        filterRequestAbortRef.current = null;
      }
    }
  }

  function applyPreset(days: number) {
    const to = calendarToday(new Date(), reportTimeZone);
    setFilters((current) => ({ ...current, from: addUtcDays(to, -(days - 1)), to }));
  }

  const summary = reportState.summary;
  const liveUser = liveStatus?.scope === "user" ? liveStatus : null;
  const hasRows = Boolean(summary && (summary.apps.length > 0 || summary.websites.length > 0));
  const scopeLabel = getScopeLabel(summary, selectedUser, departments);
  const appOpenRuntimeEnabled =
    summary?.trackingV2Coverage?.appOpenRuntimeEnabled
    ?? summary?.trackingV2Coverage?.openRuntimeEnabled
    ?? false;
  const domainOpenRuntimeEnabled =
    summary?.trackingV2Coverage?.domainOpenRuntimeEnabled === true;
  const liveSelectionLoading = selectionRefresh.live
    || (reportState.loading && liveStatus === null && trackingV2Live === null);
  const summarySelectionLoading = reportState.loading || selectionRefresh.summary;
  const filterApplyLoading = selectionRefresh.live || selectionRefresh.summary;
  const filterSelectionLoading = reportState.loading || filterApplyLoading;

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
            <input required type="date" value={filters.to} min={filters.from} max={calendarToday(new Date(), reportTimeZone)} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} style={styles.input} />
          </label>
        </div>

        <div style={styles.filterActions}>
          <WorkMapButton type="button" tone="primary" onClick={() => void applyFilters()} disabled={!auth || filterSelectionLoading}>
            <RefreshCw className={filterSelectionLoading ? "wm-report-loading-spinner" : undefined} size={16} aria-hidden /> {filterApplyLoading ? "Applying filters" : reportState.loading ? "Loading" : "Apply filters"}
          </WorkMapButton>
          <WorkMapButton type="button" onClick={() => summary && exportSummaryCsv(summary, scopeLabel)} disabled={!summary || summarySelectionLoading}>
            <Download size={16} aria-hidden /> Export CSV
          </WorkMapButton>
          <WorkMapButton type="button" onClick={() => summary && exportSummaryTxt(summary, scopeLabel)} disabled={!summary || summarySelectionLoading}>
            <FileText size={16} aria-hidden /> Download TXT
          </WorkMapButton>
          <span style={styles.rangeText}>{summarySelectionLoading ? "Loading selected reporting dates" : summary ? `${summary.range.from} to ${summary.range.to} (${summary.range.timeZone})` : `Workspace reporting dates (${reportTimeZone})`}</span>
        </div>
      </section>

      {liveSelectionLoading ? (
        <ReportSectionLoader section="live" />
      ) : trackingV2Live && trackingV2Live.devices.length > 0 && appliedFilters.view !== "company" ? (
        <TrackingV2LiveOverview live={trackingV2Live} />
      ) : liveUser || (!summarySelectionLoading && summary?.scope === "user") ? (
        <EmployeeLiveOverview
          agentStatus={liveUser?.agentStatus ?? summary?.agentStatus ?? null}
          rows={liveUser?.browserExtensionCoverage ?? summary?.browserExtensionCoverage ?? []}
        />
      ) : null}

      {summarySelectionLoading ? (
        <ReportSectionLoader section="summary" />
      ) : reportState.error || !summary ? (
        <section style={styles.statusPanel}>
          <div>
            <p style={styles.panelLabel}>Role-aware reporting</p>
            <h2 style={styles.panelTitle}>{reportState.statusText}</h2>
            <p style={styles.panelText}>Reports remain scoped to the signed-in role and selected employee.</p>
            {auth ? <p style={styles.sessionText}>Cognito session / {auth.role} / {scopeLabel}</p> : null}
          </div>
          {reportState.error ? <p role="alert" style={styles.errorText}>{reportState.error}</p> : null}
        </section>
      ) : null}

      {!summarySelectionLoading && summary?.scope === "user" ? (
        <EmployeeConnectionAudit
          auditState={auditState}
          rows={liveUser?.browserExtensionCoverage ?? summary.browserExtensionCoverage}
          v2Devices={trackingV2Live?.devices ?? []}
          filters={appliedFilters}
          timeZone={reportTimeZone}
        />
      ) : null}

      {!summarySelectionLoading && summary?.scope === "company" && summary.browserExtensionCoverage.length > 0 ? <BrowserExtensionCoveragePanel rows={summary.browserExtensionCoverage} /> : null}

      {!summarySelectionLoading && summary?.scope === "company" ? <MetricGrid summary={summary} /> : null}

      {!summarySelectionLoading && summary && summary.daily.length > 0 ? <DailyTrend rows={summary.daily} /> : null}

      {!summarySelectionLoading && summary?.scope === "company" && summary.employeeUsage.length > 0 ? <EmployeeUsageChart rows={summary.employeeUsage} /> : null}

      {!summarySelectionLoading && summary ? (
        <section style={styles.apiPanel}>
          <div style={styles.apiHeader}>
            <div>
              <p style={styles.panelLabel}>API summary</p>
              <h2 style={styles.panelTitle}>{scopeLabel}</h2>
              <p style={styles.panelText}>
                App and domain totals remain separate because domain time is a browser breakdown, not extra work time.
                Every card highlights confirmed focus active; current provisional activity is shown only in Live signals.
                {appOpenRuntimeEnabled ? " Expand an App card for measured focused idle and App open/runtime context." : " App open/runtime collection is not enabled for v2 tracking."}
                {domainOpenRuntimeEnabled
                  ? " Expand a Domain card for measured focused idle and Domain open/runtime context."
                  : " Browser Domain open/runtime collection is not enabled for v2 tracking."}
              </p>
            </div>
            <span style={styles.scopePill}>{summary.scope === "company" ? "Company scope" : "User scope"}</span>
          </div>
          {hasRows ? (
            <div style={styles.summaryGrid}>
              <SummaryUsageList title="Apps" kind="app" rows={summary.apps.map((row) => ({ name: row.appName, ...row }))} openRuntimeEnabled={appOpenRuntimeEnabled} />
              <SummaryUsageList title="Domains" kind="domain" rows={summary.websites.map((row) => ({ name: row.domain, ...row }))} openRuntimeEnabled={domainOpenRuntimeEnabled} />
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

function TrackingV2LiveOverview({ live }: { live: WorkMapApiTrackingV2LiveActivity }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const visible = useMemo(() => selectTrackingV2LiveDevices(live.devices), [live.devices]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="wm-report-detail-section" style={styles.reportSection} aria-labelledby="tracking-v2-live-heading">
      <div style={styles.sectionHeader}>
        <div>
          <p style={styles.panelLabel}>Live signals</p>
          <h2 id="tracking-v2-live-heading" style={styles.sectionTitle}>Tracking connections and current focus</h2>
          <p style={styles.panelText}>
            Current activity is provisional until the client closes and confirms the interval. Confirmed report totals remain separate.
          </p>
        </div>
        <div style={styles.liveCoverage}>
          <Activity size={20} aria-hidden />
          <strong>{visible.coverage.connected}/{visible.coverage.total} connected</strong>
          <span>{visible.coverage.freshSnapshots} confirmed snapshot(s)</span>
        </div>
      </div>
      <div style={styles.twoColumnGrid}>
        {visible.devices.map((device) => (
          <TrackingV2DeviceCard
            key={device.deviceId}
            device={device}
            serverTime={live.serverTime}
            nowMs={nowMs}
          />
        ))}
      </div>
      {visible.hiddenInactiveBrowserCount > 0 ? (
        <p style={styles.emptyText}>
          {visible.hiddenInactiveBrowserCount} older inactive Browser connection(s) hidden from Live signals; current connections take priority.
        </p>
      ) : null}
      {visible.coverage.withSequenceGaps > 0 || visible.coverage.withDeadLetters > 0 ? (
        <div role="status" style={styles.liveWarning}>
          <AlertTriangle size={17} aria-hidden />
          <span>
            {visible.coverage.withSequenceGaps > 0 ? `${visible.coverage.withSequenceGaps} client(s) have sequence gaps. ` : ""}
            {visible.coverage.withDeadLetters > 0 ? `${visible.coverage.withDeadLetters} client(s) have rejected events requiring attention.` : ""}
            Confirmed totals exclude unresolved data.
          </span>
        </div>
      ) : null}
    </section>
  );
}

function TrackingV2DeviceCard({
  device,
  serverTime,
  nowMs,
}: {
  device: TrackingV2LiveDevice;
  serverTime: string;
  nowMs: number;
}) {
  const serverDiagnostic = describeTrackingV2ServerDiagnostic(device);
  const intervalDiagnostic = device.intervalDiagnostics?.lastRejected ?? null;
  const connection = trackingV2ConnectionPresentation(device);
  const snapshot = trackingV2SnapshotPresentation(device);
  const attention = !connection.connected;
  const clientName = device.clientType === "DESKTOP_AGENT"
    ? "Desktop Agent"
    : `${formatTrackingBrowserName(device.browserName)} Extension`;
  const provisionalMs = liveProvisionalDurationMs(device, serverTime, nowMs);
  const currentLabel = device.source === "DESKTOP_APP" ? "Current app" : "Current domain";
  const currentValue = snapshot.label;

  return (
    <article
      style={{ ...styles.clientCard, ...(attention ? styles.clientAttention : styles.clientConnected) }}
      aria-label={`${clientName} status`}
    >
      <div style={styles.clientHeader}>
        <span style={styles.clientIcon}>
          {device.clientType === "DESKTOP_AGENT"
            ? attention ? <AlertTriangle size={20} aria-hidden /> : <Monitor size={20} aria-hidden />
            : attention ? <WifiOff size={20} aria-hidden /> : <Globe2 size={20} aria-hidden />}
        </span>
        <div style={styles.clientHeading}>
          <p style={styles.clientLabel}>{clientName}</p>
          <h3 style={styles.clientTitle}>{connection.label}</h3>
        </div>
        <span style={{
          ...styles.connectionPill,
          ...(attention
            ? styles.connectionPillAttention
            : connection.paused
              ? styles.connectionPillPaused
              : styles.connectionPillConnected),
        }}>
          {connection.pill}
        </span>
      </div>

      <div style={styles.focusBlock}>
        <span style={styles.focusLabel}>{currentLabel}</span>
        <strong style={styles.focusValue}>{currentValue}</strong>
        <span style={styles.focusMeta}>
          {device.snapshotStatus === "CURRENT" && device.current
            ? `${device.current.state === "ACTIVE" ? "Focus active" : "Focused idle"} - ${formatDuration(provisionalMs / 1000)} provisional`
            : snapshot.detail}
        </span>
        {device.current?.lastActivityEvidenceAt ? (
          <span style={styles.focusMeta}>
            Last trusted evidence {formatDateTime(device.current.lastActivityEvidenceAt)}
          </span>
        ) : null}
      </div>

      <div style={styles.healthGrid}>
        <span>
          <small>Connection confirmed</small>
          <strong>{device.connectionConfirmedAt ? formatDateTime(device.connectionConfirmedAt) : "Not confirmed"}</strong>
        </span>
        <span>
          <small>Snapshot received</small>
          <strong>{device.snapshot?.receivedAt ? formatDateTime(device.snapshot.receivedAt) : snapshot.pill}</strong>
        </span>
        <span>
          <small>Queue</small>
          <strong>{device.health?.queue.pending ?? 0} pending</strong>
        </span>
        <span>
          <small>Confirmed through</small>
          <strong>{device.cursor?.latestAcceptedEndedAt ? formatDateTime(device.cursor.latestAcceptedEndedAt) : "No confirmed interval"}</strong>
        </span>
        <span>
          <small>Policy</small>
          <strong>{formatTrackingState(device.health?.policyState ?? "UNKNOWN")}</strong>
        </span>
        <span>
          <small>Last sync</small>
          <strong>{device.health?.lastSuccessfulSyncAt ? formatDateTime(device.health.lastSuccessfulSyncAt) : "Not synced"}</strong>
        </span>
      </div>

      {serverDiagnostic ? (
        <div role="status" style={styles.serverDiagnostic}>
          <AlertTriangle size={17} aria-hidden />
          <div style={styles.serverDiagnosticBody}>
            <strong>{serverDiagnostic.title}</strong>
            <span>{serverDiagnostic.detail}</span>
            <span><strong>Action:</strong> {serverDiagnostic.action}</span>
            <small style={styles.serverDiagnosticMeta}>
              Code {device.health?.serverDiagnosticCode}
              {device.health?.serverDiagnosticAt ? ` - ${formatDateTime(device.health.serverDiagnosticAt)}` : ""}
              {device.health?.serverDiagnosticRequestId ? ` - Request ${device.health.serverDiagnosticRequestId}` : ""}
            </small>
          </div>
        </div>
      ) : null}

      {intervalDiagnostic ? (
        <div role="status" style={styles.serverDiagnostic}>
          <AlertTriangle size={17} aria-hidden />
          <div style={styles.serverDiagnosticBody}>
            <strong>Confirmed interval rejected</strong>
            <span>
              Code {intervalDiagnostic.code}. This row is a server tombstone and is not included in historical Domain/App totals.
            </span>
            <small style={styles.serverDiagnosticMeta}>
              {intervalDiagnostic.rejectedAt ? formatDateTime(intervalDiagnostic.rejectedAt) : "Time unavailable"}
              {intervalDiagnostic.requestId ? ` - Request ${intervalDiagnostic.requestId}` : " - Legacy request ID unavailable"}
              {` - ${intervalDiagnostic.stream} sequence ${intervalDiagnostic.sequenceNumber}`}
            </small>
          </div>
        </div>
      ) : null}

      {device.correlation && device.clientType === "BROWSER_EXTENSION" ? (
        <p style={styles.correlationText}>
          Browser/App correlation: {formatTrackingState(device.correlation.state)}
        </p>
      ) : null}
      <div style={styles.clientFooter}>
        <span>{device.workstationName ?? device.hostname ?? "Workstation"}</span>
        <span>v{device.clientVersion ?? "unknown"}</span>
      </div>
    </article>
  );
}

function liveProvisionalDurationMs(device: TrackingV2LiveDevice, serverTime: string, nowMs: number) {
  if (!device.snapshotFresh || !device.current || device.current.provisionalDurationMs === null) return 0;
  const serverMs = Date.parse(serverTime);
  const elapsedSinceResponse = Number.isFinite(serverMs) ? Math.max(0, nowMs - serverMs) : 0;
  return device.current.provisionalDurationMs + elapsedSinceResponse;
}

function describeTrackingV2ServerDiagnostic(device: TrackingV2LiveDevice) {
  const code = device.health?.serverDiagnosticCode;
  if (code === "SNAPSHOT_POLICY_LEASE_INVALID") {
    return {
      pill: "Policy",
      title: "Policy lease needs refresh",
      detail: "The server rejected the live snapshot because it used an expired or replaced policy lease.",
      action: "Keep the client running. It will fetch the current policy and restart its live snapshot automatically.",
    };
  }
  if (code === "SNAPSHOT_OBSERVATION_TIME_INVALID") {
    return {
      pill: "Clock",
      title: "Client time could not be verified",
      detail: "The live snapshot time was outside the range the server can safely accept.",
      action: "Enable automatic Windows date, time, and time-zone settings. Restart the client only if the warning persists.",
    };
  }
  if (code === "SNAPSHOT_OUTSIDE_POLICY_WINDOW") {
    return {
      pill: "Schedule",
      title: "Outside configured work hours",
      detail: "The client sent an active snapshot outside the monitoring window allowed by the current policy.",
      action: "No manual action is normally required. Tracking resumes in the next allowed work window.",
    };
  }
  return null;
}

function formatTrackingBrowserName(value: TrackingV2LiveDevice["browserName"]) {
  if (value === "EDGE") return "Microsoft Edge";
  if (value === "CHROME") return "Google Chrome";
  return "Browser";
}

function formatTrackingState(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function EmployeeLiveOverview({
  agentStatus,
  rows,
}: {
  agentStatus: WorkMapApiUsageSummary["agentStatus"];
  rows: WorkMapApiUsageSummary["browserExtensionCoverage"];
}) {
  return (
    <section className="wm-report-detail-section" style={styles.reportSection} aria-labelledby="employee-live-heading">
      <div style={styles.sectionHeader}>
        <div>
          <p style={styles.panelLabel}>Live signals</p>
          <h2 id="employee-live-heading" style={styles.sectionTitle}>Tracking connections and current focus</h2>
          <p style={styles.panelText}>Fresh client signals only. Stale activity is not presented as current.</p>
        </div>
        <Activity size={22} aria-hidden />
      </div>
      <div style={styles.twoColumnGrid}>
        <AgentLiveCard status={agentStatus} />
        <BrowserLiveCard rows={rows} />
      </div>
    </section>
  );
}

function AgentLiveCard({ status }: { status: WorkMapApiUsageSummary["agentStatus"] }) {
  if (!status || status.state === "not_paired") {
    return (
      <article style={styles.clientCard} aria-label="Desktop Agent status">
        <div style={styles.clientHeader}>
          <span style={styles.clientIcon}><Monitor size={20} aria-hidden /></span>
          <div><p style={styles.clientLabel}>Desktop Agent</p><h3 style={styles.clientTitle}>Not paired</h3></div>
        </div>
        <p style={styles.emptyText}>This employee has no Windows Agent connection.</p>
      </article>
    );
  }
  const running = status.state === "running";
  const attention = isAttentionAgentState(status.state);
  return (
    <article style={{ ...styles.clientCard, ...(attention ? styles.clientAttention : running ? styles.clientConnected : {}) }} aria-label="Desktop Agent status">
      <div style={styles.clientHeader}>
        <span style={styles.clientIcon}>{attention ? <AlertTriangle size={20} aria-hidden /> : running ? <Monitor size={20} aria-hidden /> : <Power size={20} aria-hidden />}</span>
        <div style={styles.clientHeading}>
          <p style={styles.clientLabel}>Desktop Agent</p>
          <h3 style={styles.clientTitle}>{describeAgentState(status.state)}</h3>
        </div>
        <span style={{ ...styles.connectionPill, ...(attention ? styles.connectionPillAttention : running ? styles.connectionPillConnected : {}) }}>
          {running ? "Connected" : describeAgentState(status.state)}
        </span>
      </div>
      <div style={styles.focusBlock}>
        <span style={styles.focusLabel}>Focus-active app</span>
        <strong style={styles.focusValue}>{running ? status.currentAppName ?? "No active app" : "Unavailable"}</strong>
        <span style={styles.focusMeta}>
          {running && status.currentAppName
            ? status.currentAppFocusedIdleSeconds
              ? "No recent input"
              : `${formatDuration(status.currentAppActiveSeconds ?? 0)} active`
            : "No fresh foreground signal"}
        </span>
      </div>
      <div style={styles.clientFooter}>
        <span>{status.hostname ?? "Windows device"}</span>
        <span>{status.lastHeartbeatAt ? `Heartbeat ${formatDateTime(status.lastHeartbeatAt)}` : "No heartbeat"}</span>
      </div>
    </article>
  );
}

function BrowserLiveCard({ rows }: { rows: WorkMapApiUsageSummary["browserExtensionCoverage"] }) {
  const connectedCount = rows.filter((row) => row.state === "connected" && !hasBrowserTrackingIssue(row)).length;
  return (
    <article style={{ ...styles.clientCard, ...(connectedCount > 0 ? styles.clientConnected : rows.length > 0 ? styles.clientAttention : {}) }} aria-label="Browser Extension status">
      <div style={styles.clientHeader}>
        <span style={styles.clientIcon}>{connectedCount > 0 ? <Globe2 size={20} aria-hidden /> : <WifiOff size={20} aria-hidden />}</span>
        <div style={styles.clientHeading}>
          <p style={styles.clientLabel}>Browser Extension</p>
          <h3 style={styles.clientTitle}>{rows.length === 0 ? "Not paired" : connectedCount > 0 ? "Connected" : "Browser heartbeat not received"}</h3>
        </div>
        {rows.length > 0 ? (
          <span style={{ ...styles.connectionPill, ...(connectedCount > 0 ? styles.connectionPillConnected : styles.connectionPillAttention) }}>
            {connectedCount}/{rows.length} online
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? <p style={styles.emptyText}>This employee has no paired Chrome or Edge extension.</p> : (
        <div style={styles.browserSignalRows}>
          {rows.map((row) => {
            const connected = row.state === "connected";
            const trackingIssue = hasBrowserTrackingIssue(row);
            return (
              <div key={row.deviceId} style={styles.browserSignalRow}>
                <div style={styles.browserIdentity}>
                  {connected ? <Wifi size={15} aria-hidden /> : <WifiOff size={15} aria-hidden />}
                  <strong>{formatBrowserName(row.browserName)}</strong>
                  <span style={{ ...styles.signalDot, background: connected && !trackingIssue ? wm.colors.success : wm.colors.error }} />
                </div>
                <div style={styles.domainFocus}>
                  <span style={styles.focusLabel}>Focus-active domain</span>
                  <strong style={styles.focusValue}>{!connected ? "Unavailable" : trackingIssue ? trackingStateLabel(row.trackingState) : row.currentDomain ?? "No active domain"}</strong>
                  <span style={styles.focusMeta}>
                    {trackingIssue && row.trackingStatusObservedAt
                      ? `Tracking status ${formatDateTime(row.trackingStatusObservedAt)}`
                      : row.currentDomainObservedAt
                      ? `Observed ${formatDateTime(row.currentDomainObservedAt)}`
                      : row.lastSignalAt ? `Last signal ${formatDateTime(row.lastSignalAt)}` : "No signal received"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
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
              <span style={{ ...styles.sessionState, ...(!connected || hasBrowserTrackingIssue(row) ? styles.sessionInterrupted : {}) }}>
                {!connected ? "Signal lost" : hasBrowserTrackingIssue(row) ? trackingStateLabel(row.trackingState) : "Connected"}
              </span>
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

type AuditEntry = {
  id: string;
  title: string;
  detail?: string;
  timestamp: string;
  tone: "positive" | "attention" | "neutral";
};

function EmployeeConnectionAudit({
  auditState,
  rows,
  v2Devices,
  filters,
  timeZone,
}: {
  auditState: AuditState;
  rows: WorkMapApiUsageSummary["browserExtensionCoverage"];
  v2Devices: WorkMapApiTrackingV2LiveActivity["devices"];
  filters: ReportFilters;
  timeZone: string;
}) {
  const audit = auditState.audit;
  const auditRange = resolveConnectionAuditRange(filters, timeZone);
  const includesTimestamp = (timestamp: string) =>
    isConnectionAuditTimestampInRange(
      timestamp,
      auditRange.calendar,
      auditRange.timeZone,
    );
  const desktopEntries = audit
    ? buildDesktopAuditEntries(audit).filter((entry) => includesTimestamp(entry.timestamp))
    : [];
  const browserGroups = audit
    ? buildBrowserAuditGroups(
        { ...audit, browserExtensionCoverage: rows },
        v2Devices,
        includesTimestamp,
      )
    : [];
  const emptyText = audit
    ? "No confirmed connection events in this report range."
    : auditState.refreshStatus === "loading"
      ? "Loading confirmed connection history..."
      : "Connection history is temporarily unavailable; no empty-history conclusion was made.";
  const browserEmptyText = audit
    ? "No Extension start or stop was detected in this report range."
    : emptyText;
  const countLabel = audit
    ? undefined
    : auditState.refreshStatus === "loading" ? "Loading" : "Unavailable";
  return (
    <section className="wm-report-detail-section" style={styles.reportSection} aria-labelledby="connection-audit-heading">
      <div style={styles.sectionHeader}>
        <div>
          <p style={styles.panelLabel}>Connection audit</p>
          <h2 id="connection-audit-heading" style={styles.sectionTitle}>Start, stop and interruption history</h2>
          <p style={styles.panelText}>Desktop Agent transitions and simplified Browser Extension start/stop records are shown separately.</p>
          <p style={styles.auditRangeText}>
            Connection history and usage totals use {auditRange.timeZone}: {auditRange.calendar.from}
            {auditRange.calendar.to === auditRange.calendar.from ? "" : ` to ${auditRange.calendar.to}`}.
          </p>
        </div>
        <History size={22} aria-hidden />
      </div>
      {auditState.refreshStatus === "error" ? (
        <p role="status" style={styles.auditRefreshWarning}>
          <AlertTriangle size={17} aria-hidden />
          <span>{audit ? "Connection history refresh failed; showing the last confirmed history." : "Connection history could not be loaded. CandidGrid is not reporting this as zero events."}</span>
        </p>
      ) : null}
      <div style={styles.twoColumnGrid}>
        <AuditTimeline title="Desktop Agent" icon={<Monitor size={18} aria-hidden />} entries={desktopEntries} emptyText={emptyText} countLabel={countLabel} />
        <BrowserAuditTimeline groups={browserGroups} emptyText={browserEmptyText} countLabel={countLabel} />
      </div>
    </section>
  );
}

function ReportSectionLoader({ section }: { section: "live" | "summary" }) {
  const live = section === "live";
  const title = live ? "Updating live signals" : "Loading confirmed activity";
  const detail = live
    ? "Checking the selected employee's current connections and focus."
    : "Loading the selected employee's confirmed App and Domain totals.";
  return (
    <section
      className="wm-report-detail-section wm-report-section-loader"
      style={styles.reportSection}
      aria-label={title}
      aria-busy="true"
      role="status"
    >
      <div style={styles.sectionLoaderHeader}>
        <span style={styles.sectionLoaderIcon}>
          <RefreshCw className="wm-report-loading-spinner" size={20} aria-hidden />
        </span>
        <div>
          <p style={styles.panelLabel}>{live ? "Live signals" : "API summary"}</p>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.panelText}>{detail}</p>
        </div>
      </div>
      <div className="wm-report-loading-grid" aria-hidden="true">
        <span className="wm-report-loading-card" />
        <span className="wm-report-loading-card" />
      </div>
    </section>
  );
}

function hasBrowserTrackingIssue(row: WorkMapApiUsageSummary["browserExtensionCoverage"][number]) {
  return row.trackingState === "permission_required" || row.trackingState === "registration_failed";
}

function trackingStateLabel(state: WorkMapApiUsageSummary["browserExtensionCoverage"][number]["trackingState"]) {
  if (state === "permission_required") return "Website access required";
  if (state === "registration_failed") return "Tracker needs attention";
  return "Tracking unavailable";
}

export function AuditTimeline({
  title,
  icon,
  entries,
  emptyText = "No confirmed connection events in this report range.",
  countLabel,
}: {
  title: string;
  icon: React.ReactNode;
  entries: AuditEntry[];
  emptyText?: string;
  countLabel?: string;
}) {
  return (
    <article style={styles.auditCard} aria-label={`${title} connection history`}>
      <div style={styles.auditCardHeader}>
        <span style={styles.auditIcon}>{icon}</span>
        <h3 style={styles.auditTitle}>{title}</h3>
        <span style={styles.auditCount}>{countLabel ?? `${entries.length} events`}</span>
      </div>
      <div style={styles.auditRows}>
        <AuditRows entries={entries} emptyText={emptyText} />
      </div>
    </article>
  );
}

export function BrowserAuditTimeline({
  groups,
  emptyText = "No Extension start or stop was detected in this report range.",
  countLabel,
}: {
  groups: BrowserAuditGroup[];
  emptyText?: string;
  countLabel?: string;
}) {
  const eventCount = groups.reduce((total, group) => total + group.entries.length, 0);
  return (
    <article style={styles.auditCard} aria-label="Browser Extension connection history">
      <div style={styles.auditCardHeader}>
        <span style={styles.auditIcon}><Globe2 size={18} aria-hidden /></span>
        <h3 style={styles.auditTitle}>Browser Extension</h3>
        <span style={styles.auditCount}>{countLabel ?? `${eventCount} records`}</span>
      </div>
      <div style={styles.browserAuditGroups}>
        <p style={styles.browserAuditNote}>
          Start times are confirmed by the Extension. Stop times show when CandidGrid detected that reporting had ceased; an exact browser close time or cause is not available.
        </p>
        {groups.length === 0 ? <p style={styles.emptyText}>{emptyText}</p> : groups.map((group) => (
          <section key={group.deviceId} style={styles.auditDeviceGroup} aria-label={`${group.title} connection history`}>
            <div style={styles.auditDeviceHeader}>
              <div style={styles.auditDeviceIdentity}>
                <strong>{group.title}</strong>
                <span>{group.detail}</span>
              </div>
              <span style={styles.auditCount}>{group.entries.length} records</span>
            </div>
            <div style={styles.auditDeviceRows}>
              <AuditRows entries={group.entries} emptyText="No connection events for this browser in the report range." />
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function AuditRows({ entries, emptyText }: { entries: AuditEntry[]; emptyText: string }) {
  if (entries.length === 0) return <p style={styles.emptyText}>{emptyText}</p>;
  return entries.map((entry) => (
    <div key={entry.id} style={styles.auditRow}>
      <span style={{ ...styles.auditMarker, ...(entry.tone === "attention" ? styles.auditMarkerAttention : entry.tone === "positive" ? styles.auditMarkerPositive : {}) }} />
      <div style={styles.auditContent}>
        <div style={styles.auditLine}>
          <strong style={styles.auditEventTitle}>{entry.title}</strong>
          <time style={styles.auditTime}>{formatDateTime(entry.timestamp)}</time>
        </div>
        {entry.detail ? <span style={styles.auditDetail}>{entry.detail}</span> : null}
      </div>
    </div>
  ));
}

export function buildDesktopAuditEntries(summary: Pick<WorkMapApiUsageSummary, "agentSessions" | "deviceStatusHistory">): AuditEntry[] {
  const desktopStatuses: WorkMapApiUsageSummary["deviceStatusHistory"] = [];
  for (const event of summary.deviceStatusHistory) {
    if (event.source !== "DESKTOP_AGENT") continue;
    desktopStatuses.push(event);
  }
  const entries: AuditEntry[] = desktopStatuses.map(desktopStatusToAuditEntry);
  const sessionsWithStatusStart = new Set(
    desktopStatuses
      .filter((event) => event.agentSessionId && (event.status === "RUNNING" || event.status === "RESTARTED"))
      .map((event) => event.agentSessionId),
  );
  const sessionsWithStatusEnd = new Set(
    desktopStatuses
      .filter((event) => event.agentSessionId && isDesktopSessionEndStatus(event.status))
      .map((event) => event.agentSessionId),
  );

  for (const session of summary.agentSessions) {
    if (!sessionsWithStatusStart.has(session.id)) {
      entries.push({
        id: `${session.id}:started`,
        title: "Agent started",
        detail: "Desktop monitoring session opened",
        timestamp: session.startedAt,
        tone: "positive",
      });
    }
    if (session.endedAt && !sessionsWithStatusEnd.has(session.id)) {
      const interrupted = session.endReason === "UNEXPECTED_STOP" || session.endReason === "UNKNOWN_INTERRUPTED" || session.endReason === "AGENT_CRASHED" || session.endReason === "AGENT_TERMINATED";
      entries.push({
        id: `${session.id}:ended`,
        title: describeSessionEnd(session.endReason),
        detail: session.endReason === "USER_STOP" ? "Employee manually stopped the Agent" : "Desktop monitoring session ended",
        timestamp: session.endedAt,
        tone: interrupted ? "attention" : "neutral",
      });
    }
  }
  return sortAuditEntries(entries);
}

function desktopStatusToAuditEntry(
  event: WorkMapApiUsageSummary["deviceStatusHistory"][number],
): AuditEntry {
  return {
    id: `${event.deviceId}:status:${event.id}`,
    title: formatDesktopStatus(event.status),
    detail: `Desktop Agent - ${formatDesktopStatusReason(event.reason)}${event.confidence === "INFERRED" ? " (inferred)" : ""}${statusSyncWasDelayed(event) ? ` - synced ${formatDateTime(event.receivedAt)}` : ""}`,
    timestamp: event.startedAt,
    tone: desktopStatusTone(event.status),
  };
}

function formatDesktopStatus(status: WorkMapApiUsageSummary["deviceStatusHistory"][number]["status"]) {
  switch (status) {
    case "RUNNING": return "Agent started";
    case "STOPPED_BY_USER": return "Stopped by user";
    case "NETWORK_OFFLINE": return "Network offline";
    case "DEVICE_SHUTDOWN": return "Device shut down";
    case "SLEEPING": return "Sleeping";
    case "LOCKED": return "Locked";
    case "AGENT_CRASHED": return "Agent crashed";
    case "AGENT_TERMINATED": return "Agent terminated";
    case "SERVER_UNREACHABLE": return "CandidGrid service unreachable";
    case "UNKNOWN_INTERRUPTED": return "Interrupted";
    case "RECONNECTED": return "Reconnected";
    case "RESTARTED": return "Agent restarted";
  }
}

function formatDesktopStatusReason(reason: WorkMapApiUsageSummary["deviceStatusHistory"][number]["reason"]) {
  return reason.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function desktopStatusTone(
  status: WorkMapApiUsageSummary["deviceStatusHistory"][number]["status"],
): AuditEntry["tone"] {
  if (["RUNNING", "RECONNECTED", "RESTARTED"].includes(status)) return "positive";
  if (["NETWORK_OFFLINE", "AGENT_CRASHED", "AGENT_TERMINATED", "SERVER_UNREACHABLE", "UNKNOWN_INTERRUPTED"].includes(status)) return "attention";
  return "neutral";
}

function isDesktopSessionEndStatus(
  status: WorkMapApiUsageSummary["deviceStatusHistory"][number]["status"],
) {
  return ["STOPPED_BY_USER", "DEVICE_SHUTDOWN", "SLEEPING", "AGENT_CRASHED", "AGENT_TERMINATED", "UNKNOWN_INTERRUPTED"].includes(status);
}

export function buildBrowserAuditEntries(
  summary: Pick<WorkMapApiUsageSummary, "browserExtensionCoverage" | "deviceStatusHistory">,
  v2Devices: WorkMapApiTrackingV2LiveActivity["devices"] = [],
): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const startKeys = new Set<string>();
  for (const event of summary.deviceStatusHistory) {
    if (
      event.source !== "BROWSER_EXTENSION" ||
      (event.status !== "RUNNING" && event.status !== "RESTARTED")
    ) {
      continue;
    }
    const startKey = `${event.deviceId}:${event.startedAt}`;
    if (startKeys.has(startKey)) continue;
    startKeys.add(startKey);
    entries.push({
      id: `${event.deviceId}:status:${event.id}`,
      title: "Extension started",
      timestamp: event.startedAt,
      tone: "positive",
    });
  }
  for (const row of summary.browserExtensionCoverage) {
    if (row.state !== "signal_lost" || !row.coverageLostDetectedAt) continue;
    const hasMatchingInterruption = entries.some((entry) =>
      entry.id.startsWith(`${row.deviceId}:`)
      && entry.title === "Extension stopped reporting"
      && Math.abs(Date.parse(entry.timestamp) - Date.parse(row.coverageLostDetectedAt!)) <= 90_000,
    );
    if (!hasMatchingInterruption) {
      entries.push({
        id: `${row.deviceId}:coverage-lost`,
        title: "Extension stopped reporting",
        timestamp: row.coverageLostDetectedAt,
        tone: "neutral",
      });
    }
  }
  for (const device of v2Devices) {
    if (
      device.clientType !== "BROWSER_EXTENSION" ||
      device.connectionFresh ||
      !device.connectionConfirmedAt
    ) {
      continue;
    }
    const coverageLostDetectedAt = new Date(
      Date.parse(device.connectionConfirmedAt) +
        device.connectionFreshnessLimitMs,
    ).toISOString();
    const hasMatchingInterruption = entries.some(
      (entry) =>
        entry.id.startsWith(`${device.deviceId}:`) &&
        entry.title === "Extension stopped reporting" &&
        Math.abs(
          Date.parse(entry.timestamp) -
            Date.parse(coverageLostDetectedAt),
        ) <= 90_000,
    );
    if (!hasMatchingInterruption) {
      entries.push({
        id: `${device.deviceId}:v2-coverage-lost`,
        title: "Extension stopped reporting",
        timestamp: coverageLostDetectedAt,
        tone: "neutral",
      });
    }
  }
  return sortAuditEntries(entries);
}

export type BrowserAuditGroup = {
  deviceId: string;
  browserName: "CHROME" | "EDGE" | "UNKNOWN";
  title: string;
  detail: string;
  entries: AuditEntry[];
};

export function buildBrowserAuditGroups(
  summary: Pick<WorkMapApiUsageSummary, "browserExtensionCoverage" | "deviceStatusHistory">,
  v2Devices: WorkMapApiTrackingV2LiveActivity["devices"] = [],
  includesTimestamp: (timestamp: string) => boolean = () => true,
): BrowserAuditGroup[] {
  const devices = new Map<string, {
    browserName: "CHROME" | "EDGE" | "UNKNOWN";
    version: string | null;
    workstationName: string | null;
  }>();
  const remember = (
    deviceId: string,
    browserName: "CHROME" | "EDGE" | "UNKNOWN" | null | undefined,
    version: string | null | undefined,
    workstationName?: string | null,
  ) => {
    const current = devices.get(deviceId);
    const resolvedBrowserName = browserName && browserName !== "UNKNOWN"
      ? browserName
      : current?.browserName ?? "UNKNOWN";
    devices.set(deviceId, {
      browserName: resolvedBrowserName,
      version: version ?? current?.version ?? null,
      workstationName: workstationName ?? current?.workstationName ?? null,
    });
  };

  for (const event of summary.deviceStatusHistory) {
    if (event.source === "BROWSER_EXTENSION") remember(event.deviceId, event.browserName, event.clientVersion);
  }
  for (const row of summary.browserExtensionCoverage) {
    remember(row.deviceId, row.browserName, row.version);
  }
  for (const device of v2Devices) {
    if (device.clientType === "BROWSER_EXTENSION") {
      remember(device.deviceId, device.browserName, device.clientVersion, device.workstationName);
    }
  }

  return Array.from(devices, ([deviceId, identity]) => {
    const entries = buildBrowserAuditEntries(
      {
        browserExtensionCoverage: summary.browserExtensionCoverage.filter((row) => row.deviceId === deviceId),
        deviceStatusHistory: summary.deviceStatusHistory.filter((event) => event.deviceId === deviceId),
      },
      v2Devices.filter((device) => device.deviceId === deviceId),
    ).filter((entry) => includesTimestamp(entry.timestamp));
    const identityDetail = identity.workstationName
      ? identity.workstationName
      : `Device ${deviceId.slice(0, 8)}`;
    return {
      deviceId,
      browserName: identity.browserName,
      title: identity.browserName === "UNKNOWN"
        ? "Browser Extension"
        : `${formatBrowserName(identity.browserName)} Extension`,
      detail: identity.version ? `${identityDetail} · ${identity.version}` : identityDetail,
      entries,
    };
  }).filter((group) => group.entries.length > 0).sort((left, right) => {
    const newestDifference = Date.parse(right.entries[0]?.timestamp ?? "") - Date.parse(left.entries[0]?.timestamp ?? "");
    return Number.isNaN(newestDifference) || newestDifference === 0
      ? left.title.localeCompare(right.title) || left.deviceId.localeCompare(right.deviceId)
      : newestDifference;
  });
}

function sortAuditEntries(entries: AuditEntry[]) {
  return entries.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

function MetricGrid({ summary }: { summary: WorkMapApiUsageSummary }) {
  const appActive = sum(summary.apps, "activeSeconds");
  const domainActive = sum(summary.websites, "activeSeconds");
  const domainIdle = sum(summary.websites, "idleSeconds");
  const metrics = [
    { label: "App focus active", value: formatDuration(appActive), detail: "Foreground app with trusted activity evidence within 60 seconds" },
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

function SummaryUsageList({
  title,
  kind,
  rows,
  openRuntimeEnabled,
}: {
  title: string;
  kind: "app" | "domain";
  rows: UsageListRow[];
  openRuntimeEnabled: boolean;
}) {
  return (
    <section style={styles.summaryCard}>
      <h3 style={styles.summaryTitle}>{title}</h3>
      <div style={styles.summaryRows}>
        {rows.map((row) => kind === "app"
          ? <AppUsageMetricCard key={row.name} row={row} openRuntimeEnabled={openRuntimeEnabled} />
          : <DomainUsageMetricCard key={row.name} row={row} openRuntimeEnabled={openRuntimeEnabled} />)}
      </div>
    </section>
  );
}

export function AppUsageMetricCard({
  row,
  initiallyExpanded = false,
  openRuntimeEnabled = true,
}: {
  row: UsageListRow;
  initiallyExpanded?: boolean;
  openRuntimeEnabled?: boolean;
}) {
  return <UsageMetricCard row={row} kind="app" initiallyExpanded={initiallyExpanded} openRuntimeEnabled={openRuntimeEnabled} />;
}

export function DomainUsageMetricCard({
  row,
  initiallyExpanded = false,
  openRuntimeEnabled = false,
}: {
  row: UsageListRow;
  initiallyExpanded?: boolean;
  openRuntimeEnabled?: boolean;
}) {
  return <UsageMetricCard row={row} kind="domain" initiallyExpanded={initiallyExpanded} openRuntimeEnabled={openRuntimeEnabled} />;
}

function UsageMetricCard({
  row,
  kind,
  initiallyExpanded,
  openRuntimeEnabled,
}: {
  row: UsageListRow;
  kind: "app" | "domain";
  initiallyExpanded: boolean;
  openRuntimeEnabled: boolean;
}) {
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
            title={`Focused ${itemLabel} after 60 seconds without trusted activity evidence`}
          />
          <MetricChip
            label="Open/runtime"
            value={openRuntimeEnabled ? formatDuration(openRuntime(row)) : "Not enabled"}
            tone="runtime"
            title={openRuntimeEnabled
              ? kind === "app" ? "Measured app open/runtime; not proof of active use" : "Measured domain open/runtime; not proof of active use"
              : "Open/runtime collection is disabled in the v2 tracking release"}
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

async function requestSummary(auth: AuthContext, filters: ReportFilters, signal?: AbortSignal) {
  const userId = filters.view.startsWith("user:") ? filters.view.slice(5) : undefined;
  return getUsageSummary({
    ...auth.options,
    scope: filters.view === "company" ? "company" : "user",
    userId,
    departmentId: filters.view === "company" ? filters.departmentId || undefined : undefined,
    from: filters.from,
    to: filters.to,
    includeAudit: false,
    includeLive: false,
    signal,
    timeoutMs: SUMMARY_REQUEST_TIMEOUT_MS,
  });
}

function reportSnapshotKey(auth: AuthContext, filters: ReportFilters, timeZone: string) {
  return JSON.stringify([
    "report-snapshot-v2-workspace-calendar",
    auth.userId,
    auth.role,
    auth.source,
    filters.view,
    filters.departmentId,
    filters.from,
    filters.to,
    timeZone,
  ]);
}

async function requestCurrentLive(
  auth: AuthContext,
  filters: ReportFilters,
  includeRevision = true,
  signal?: AbortSignal,
): Promise<
  | { ok: true; data: CurrentLiveData }
  | { ok: false; error: string }
> {
  const userId = filters.view.startsWith("user:") ? filters.view.slice(5) : undefined;
  const common = {
    ...auth.options,
    scope: (filters.view === "company" ? "company" : "user") as "company" | "user",
    userId,
    departmentId: filters.view === "company" ? filters.departmentId || undefined : undefined,
    signal,
    timeoutMs: LIVE_REQUEST_TIMEOUT_MS,
  };
  const trackingV2 = await getTrackingV2LiveActivity(common);
  if (trackingV2.ok && trackingV2.data.devices.length > 0) {
    const data: CurrentLiveData = {
      trackingV2: trackingV2.data,
      legacy: null,
      revision: trackingV2Revision(trackingV2.data),
    };
    return { ok: true, data };
  }

  const legacy = await getAgentLiveStatus({
    ...common,
    from: filters.from,
    to: filters.to,
    includeRevision,
  });
  if (legacy.ok) {
    return {
      ok: true,
      data: {
        trackingV2: trackingV2.ok ? trackingV2.data : null,
        legacy: legacy.data,
        revision: legacy.data.activityRevision,
      },
    };
  }
  if (trackingV2.ok) {
    return {
      ok: true,
      data: {
        trackingV2: trackingV2.data,
        legacy: null,
        revision: trackingV2Revision(trackingV2.data),
      },
    };
  }
  return { ok: false, error: trackingV2.error };
}

function currentLiveRevision(data: CurrentLiveData) {
  return data.revision
    ?? (data.trackingV2 ? trackingV2Revision(data.trackingV2) : null)
    ?? data.legacy?.activityRevision
    ?? null;
}

function trackingV2Revision(live: WorkMapApiTrackingV2LiveActivity) {
  const settledCursors = live.devices
    .map((device) => [
      device.deviceId,
      device.cursor?.clockEpochId ?? null,
      device.cursor?.contiguousThroughSequence ?? null,
      device.cursor?.latestAcceptedEndedAt ?? null,
      device.cursor?.rejectedRanges.length ?? 0,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify(settledCursors);
}

async function loadAudit(
  auth: AuthContext,
  filters: ReportFilters,
  timeZone: string,
  isCancelled: () => boolean,
  setState: React.Dispatch<React.SetStateAction<AuditState>>,
  onLoaded?: (audit: WorkMapApiTrackingAudit) => void,
  signal?: AbortSignal,
) {
  setState((current) => current.audit
    ? current
    : { ...current, refreshStatus: "loading" });
  const userId = filters.view.startsWith("user:") ? filters.view.slice(5) : undefined;
  const auditRange = resolveConnectionAuditRange(filters, timeZone);
  const result = await getTrackingAudit({
    ...auth.options,
    scope: filters.view === "company" ? "company" : "user",
    userId,
    departmentId: filters.view === "company" ? filters.departmentId || undefined : undefined,
    from: auditRange.request.from,
    to: auditRange.request.to,
    includeTimeline: false,
    signal,
    timeoutMs: AUDIT_REQUEST_TIMEOUT_MS,
  });
  if (isCancelled()) return;
  if (!result.ok) {
    setState((current) => ({ ...current, refreshStatus: "error" }));
    return;
  }
  onLoaded?.(result.data);
  setState((current) => mergeAuditState(current, result.data));
}

function sameReportSelection(left: ReportFilters, right: ReportFilters) {
  return left.view === right.view
    && left.departmentId === right.departmentId
    && left.from === right.from
    && left.to === right.to;
}

export function mergeAuditState(current: AuditState, nextAudit: WorkMapApiTrackingAudit): AuditState {
  if (
    current.audit
    && current.refreshStatus === "ready"
    && auditHistoryRevision(current.audit) === auditHistoryRevision(nextAudit)
  ) return current;
  return { audit: nextAudit, refreshStatus: "ready" };
}

function auditHistoryRevision(audit: WorkMapApiTrackingAudit) {
  const sessions = audit.agentSessions
    .map((session) => [session.id, session.startedAt, session.endedAt, session.endReason])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  const statuses = audit.deviceStatusHistory
    .map((event) => [
      event.id,
      event.deviceId,
      event.status,
      event.reason,
      event.startedAt,
      event.endedAt,
      event.receivedAt,
      event.source,
      event.browserName,
      event.clientVersion,
      event.confidence,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify([audit.scope, audit.userId, sessions, statuses]);
}

async function loadDirectory(
  options: ApiClientOptions,
  isCancelled: () => boolean,
  onLoaded: (users: WorkMapApiUser[]) => void,
) {
  const result = await listUsers(options);
  if (isCancelled()) return;
  onLoaded(result.ok ? result.data : []);
}

function applyResult(
  result: Awaited<ReturnType<typeof getUsageSummary>>,
  setState: React.Dispatch<React.SetStateAction<ReportState>>,
  preservePrevious = false,
) {
  if (!result.ok) {
    setState((current) => ({
      loading: false,
      summary: preservePrevious ? current.summary : null,
      statusText: preservePrevious && current.summary ? "Showing the last confirmed report." : "Reports API could not be loaded.",
      error: result.error,
    }));
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
  const appRuntimeEnabled = summary.trackingV2Coverage?.appOpenRuntimeEnabled
    ?? summary.trackingV2Coverage?.openRuntimeEnabled
    ?? false;
  const domainRuntimeEnabled =
    summary.trackingV2Coverage?.domainOpenRuntimeEnabled === true;
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
      appRuntimeEnabled ? openRuntime(row) : "",
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
      domainRuntimeEnabled ? openRuntime(row) : "",
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
  const appRuntimeEnabled = summary.trackingV2Coverage?.appOpenRuntimeEnabled
    ?? summary.trackingV2Coverage?.openRuntimeEnabled
    ?? false;
  const domainRuntimeEnabled =
    summary.trackingV2Coverage?.domainOpenRuntimeEnabled === true;
  const lines = [
    "WORKMAP APP USAGE REPORT",
    `Scope: ${scopeLabel}`,
    `Period: ${summary.range.from} to ${summary.range.to} (${summary.range.timeZone})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SUMMARY",
    `App focus active: ${formatDuration(sum(summary.apps, "activeSeconds"))}`,
    `App focused idle: ${formatDuration(sum(summary.apps, "idleSeconds"))}`,
    `App open/runtime: ${appRuntimeEnabled ? formatDuration(summary.apps.reduce((total, row) => total + openRuntime(row), 0)) : "Not enabled"}`,
    `Domain focus active: ${formatDuration(sum(summary.websites, "activeSeconds"))}`,
    `Domain focused idle: ${formatDuration(sum(summary.websites, "idleSeconds"))}`,
    `Domain open/runtime: ${domainRuntimeEnabled ? formatDuration(summary.websites.reduce((total, row) => total + openRuntime(row), 0)) : "Not enabled"}`,
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
    lines.push(`${row.appName}: ${formatDuration(row.focusActiveSeconds ?? row.activeSeconds)} focus active; ${formatDuration(row.focusedIdleSeconds ?? row.idleSeconds)} focused idle; ${appRuntimeEnabled ? `${formatDuration(openRuntime(row))} open/runtime` : "open/runtime not enabled"}`);
  }
  lines.push("", "DOMAIN TOTALS");
  if (summary.websites.length === 0) lines.push("No domain activity recorded.");
  for (const row of summary.websites) {
    lines.push(`${row.domain}: ${formatDuration(row.focusActiveSeconds ?? row.activeSeconds)} focus active; ${formatDuration(row.focusedIdleSeconds ?? row.idleSeconds)} focused idle; ${domainRuntimeEnabled ? `${formatDuration(openRuntime(row))} open/runtime` : "open/runtime not enabled"}`);
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
    "CandidGrid reports foreground App and focused HTTP/HTTPS hostname with Focus active/focused idle time, plus separately labelled App or Domain open/runtime when enabled by policy. It does not collect window or page titles, files, URL paths, queries or fragments, screenshots or recordings, key values or typed text, pointer details, clipboard, camera, microphone, external private message/Teams/email body content, webpage or form content, or passwords.",
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
  return row.openRuntimeSeconds ?? 0;
}

function sum(rows: Array<{ activeSeconds: number; idleSeconds: number }>, key: "activeSeconds" | "idleSeconds") {
  return rows.reduce((total, row) => total + row[key], 0);
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

function describeAgentState(state: NonNullable<WorkMapApiUsageSummary["agentStatus"]>["state"]) {
  switch (state) {
    case "running": return "Running";
    case "stopped_by_user": return "Stopped by user";
    case "network_offline": return "Network offline";
    case "device_shutdown": return "Device shut down";
    case "sleeping": return "Device sleeping";
    case "locked": return "Device locked";
    case "agent_crashed": return "Agent crashed";
    case "agent_terminated": return "Agent terminated";
    case "server_unreachable": return "CandidGrid service unreachable";
    case "unknown_interrupted": return "Interrupted (reason unknown)";
    case "not_paired": return "No paired Agent";
  }
}

function isAttentionAgentState(state: NonNullable<WorkMapApiUsageSummary["agentStatus"]>["state"]) {
  return ["network_offline", "agent_crashed", "agent_terminated", "server_unreachable", "unknown_interrupted"].includes(state);
}

function statusSyncWasDelayed(row: WorkMapApiUsageSummary["deviceStatusHistory"][number]) {
  return new Date(row.receivedAt).getTime() - new Date(row.startedAt).getTime() > 30_000;
}

function describeSessionEnd(endReason: WorkMapApiUsageSummary["agentSessions"][number]["endReason"]) {
  switch (endReason) {
    case "USER_STOP": return "Stopped by user";
    case "DEVICE_SHUTDOWN": return "Device shut down";
    case "SUSPENDED": return "Suspended";
    case "AGENT_CRASHED": return "Agent crashed";
    case "AGENT_TERMINATED": return "Agent terminated";
    case "UNEXPECTED_STOP":
    case "UNKNOWN_INTERRUPTED": return "Interrupted";
    default: return "Stopped";
  }
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
  reportSection: { display: "grid", gap: "14px", padding: "6px 0" },
  sectionLoaderHeader: { display: "flex", alignItems: "flex-start", gap: "12px" },
  sectionLoaderIcon: { display: "grid", placeItems: "center", width: "40px", height: "40px", flex: "0 0 auto", border: `1px solid ${wm.colors.infoBorder}`, borderRadius: wm.radius.full, background: wm.colors.infoBg, color: wm.colors.infoText },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", color: wm.colors.infoText },
  sectionTitle: { margin: "2px 0 6px", color: wm.colors.text, fontSize: "22px", lineHeight: 1.25 },
  liveCoverage: { display: "flex", alignItems: "center", gap: "7px", border: `1px solid ${wm.colors.infoBorder}`, borderRadius: wm.radius.full, background: wm.colors.infoBg, color: wm.colors.infoText, padding: "7px 10px", fontSize: "12px", whiteSpace: "nowrap" as const },
  liveWarning: { display: "flex", alignItems: "flex-start", gap: "9px", border: `1px solid ${wm.colors.warningBorder}`, borderRadius: wm.radius.md, background: wm.colors.warningBg, color: wm.colors.warning, padding: "11px 12px", fontSize: "12px", lineHeight: 1.45 },
  auditRefreshWarning: { display: "flex", alignItems: "flex-start", gap: "9px", margin: 0, border: `1px solid ${wm.colors.warningBorder}`, borderRadius: wm.radius.md, background: wm.colors.warningBg, color: wm.colors.warning, padding: "11px 12px", fontSize: "12px", lineHeight: 1.45 },
  auditRangeText: { margin: "4px 0 0", color: wm.colors.textMuted, fontSize: "12px", lineHeight: 1.45 },
  twoColumnGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "14px", alignItems: "stretch" },
  clientCard: { ...wmStyles.card, display: "grid", alignContent: "start", gap: "14px", padding: "18px", minWidth: 0, overflow: "hidden" },
  clientConnected: { borderColor: wm.colors.successBorder },
  clientAttention: { borderColor: wm.colors.error, background: wm.colors.errorBg },
  clientHeader: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: "10px", minWidth: 0 },
  clientIcon: { display: "grid", placeItems: "center", width: "38px", height: "38px", borderRadius: wm.radius.full, background: wm.colors.infoBg, color: wm.colors.infoText },
  clientHeading: { minWidth: 0 },
  clientLabel: { margin: 0, color: wm.colors.textMuted, fontSize: "11px", fontWeight: 900, textTransform: "uppercase" as const },
  clientTitle: { margin: "2px 0 0", color: wm.colors.text, fontSize: "18px", lineHeight: 1.25, overflowWrap: "anywhere" as const },
  connectionPill: { justifySelf: "end", maxWidth: "100%", border: `1px solid ${wm.colors.borderStrong}`, borderRadius: wm.radius.full, padding: "5px 9px", color: wm.colors.textSecondary, background: wm.colors.surface, fontSize: "11px", fontWeight: 900, lineHeight: 1.2, textAlign: "center" as const },
  connectionPillConnected: { borderColor: wm.colors.successBorder, background: wm.colors.successBg, color: wm.colors.success },
  connectionPillPaused: { borderColor: wm.colors.infoBorder, background: wm.colors.infoBg, color: wm.colors.infoText },
  connectionPillAttention: { borderColor: wm.colors.error, background: wm.colors.errorBg, color: wm.colors.errorText },
  focusBlock: { display: "grid", gap: "4px", borderTop: `1px solid ${wm.colors.borderSubtle}`, borderBottom: `1px solid ${wm.colors.borderSubtle}`, padding: "14px 0", minWidth: 0 },
  focusLabel: { color: wm.colors.textMuted, fontSize: "11px", fontWeight: 900, textTransform: "uppercase" as const },
  focusValue: { color: wm.colors.text, fontSize: "20px", lineHeight: 1.25, overflowWrap: "anywhere" as const },
  focusMeta: { color: wm.colors.textSecondary, fontSize: "12px", lineHeight: 1.4, overflowWrap: "anywhere" as const },
  healthGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px 12px", color: wm.colors.textSecondary },
  serverDiagnostic: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", alignItems: "start", gap: "9px", border: `1px solid ${wm.colors.warningBorder}`, borderRadius: wm.radius.md, background: wm.colors.warningBg, color: wm.colors.warning, padding: "11px 12px", fontSize: "12px", lineHeight: 1.45 },
  serverDiagnosticBody: { display: "grid", gap: "4px", minWidth: 0 },
  serverDiagnosticMeta: { color: wm.colors.textMuted, overflowWrap: "anywhere" as const },
  correlationText: { margin: 0, color: wm.colors.infoText, fontSize: "11px", fontWeight: 800 },
  clientFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px 16px", flexWrap: "wrap" as const, color: wm.colors.textMuted, fontSize: "11px", fontWeight: 700 },
  browserSignalRows: { display: "grid", gap: "12px" },
  browserSignalRow: { display: "grid", gridTemplateColumns: "minmax(130px, 0.65fr) minmax(0, 1.35fr)", gap: "14px", alignItems: "center", borderTop: `1px solid ${wm.colors.borderSubtle}`, paddingTop: "12px", minWidth: 0 },
  browserIdentity: { display: "flex", alignItems: "center", gap: "7px", minWidth: 0, color: wm.colors.textSecondary, fontSize: "12px" },
  signalDot: { width: "7px", height: "7px", borderRadius: wm.radius.full, flex: "0 0 auto" },
  domainFocus: { display: "grid", gap: "3px", minWidth: 0 },
  auditCard: { ...wmStyles.card, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minWidth: 0, overflow: "hidden" },
  auditCardHeader: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: "10px", borderBottom: `1px solid ${wm.colors.borderSubtle}`, padding: "14px 16px" },
  auditIcon: { display: "grid", placeItems: "center", color: wm.colors.infoText },
  auditTitle: { margin: 0, color: wm.colors.text, fontSize: "16px", lineHeight: 1.25 },
  auditCount: { color: wm.colors.textMuted, fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" as const },
  auditRows: { display: "grid", alignContent: "start", maxHeight: "420px", overflowY: "auto" as const, padding: "0 16px" },
  browserAuditGroups: { display: "flex", flexDirection: "column" as const, alignItems: "stretch", gap: "12px", maxHeight: "420px", overflowY: "auto" as const, padding: "12px" },
  browserAuditNote: { margin: 0, color: wm.colors.textMuted, fontSize: "11px", lineHeight: 1.45 },
  auditDeviceGroup: { flex: "0 0 auto", border: `1px solid ${wm.colors.borderSubtle}`, borderRadius: wm.radius.md, overflow: "hidden", background: wm.colors.surface },
  auditDeviceHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "11px 12px", borderBottom: `1px solid ${wm.colors.borderSubtle}`, background: wm.colors.surfaceLow },
  auditDeviceIdentity: { display: "grid", gap: "2px", minWidth: 0, color: wm.colors.text, fontSize: "13px", overflowWrap: "anywhere" as const },
  auditDeviceRows: { display: "grid", alignContent: "start", padding: "0 12px" },
  auditRow: { display: "grid", gridTemplateColumns: "10px minmax(0, 1fr)", gap: "10px", borderBottom: `1px solid ${wm.colors.borderSubtle}`, padding: "12px 0", minWidth: 0 },
  auditMarker: { width: "8px", height: "8px", marginTop: "5px", borderRadius: wm.radius.full, background: wm.colors.offline },
  auditMarkerPositive: { background: wm.colors.success },
  auditMarkerAttention: { background: wm.colors.error },
  auditContent: { display: "grid", gap: "4px", minWidth: 0 },
  auditLine: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6px 12px", flexWrap: "wrap" as const },
  auditEventTitle: { color: wm.colors.text, fontSize: "13px", overflowWrap: "anywhere" as const },
  auditTime: { color: wm.colors.textMuted, fontSize: "11px", fontWeight: 700 },
  auditDetail: { color: wm.colors.textSecondary, fontSize: "12px", lineHeight: 1.45, overflowWrap: "anywhere" as const },
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
