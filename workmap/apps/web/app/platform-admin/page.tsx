"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { getWorkMapPlatformApiAuthOptions } from "../../lib/api/platformAuth";
import {
  getPlatformTenant,
  listPlatformAudit,
  listPlatformTenants,
} from "../../lib/api/platformApi";
import type {
  ApiClientOptions,
  WorkMapApiPlatformAuditList,
  WorkMapApiPlatformTenantDetail,
  WorkMapApiPlatformTenantSummary,
} from "../../lib/api/apiTypes";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type PageState =
  | { status: "loading" }
  | { status: "blocked"; message: string }
  | {
      status: "ready";
      apiOptions: ApiClientOptions;
      tenants: WorkMapApiPlatformTenantSummary[];
      selectedTenant?: WorkMapApiPlatformTenantDetail;
      audit: WorkMapApiPlatformAuditList["audit"];
    };

export default function PlatformAdminPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadPlatformData() {
      const auth = await getWorkMapPlatformApiAuthOptions();

      if (!auth.available) {
        if (!cancelled) {
          setState({ status: "blocked", message: auth.reason });
        }
        return;
      }

      const [tenantResult, auditResult] = await Promise.all([
        listPlatformTenants(auth.options),
        listPlatformAudit(auth.options),
      ]);

      if (cancelled) {
        return;
      }

      if (!tenantResult.ok) {
        setState({ status: "blocked", message: tenantResult.error });
        return;
      }

      const initialTenantId = tenantResult.data.tenants[0]?.id ?? null;
      const selectedTenant = initialTenantId ? await getPlatformTenant(initialTenantId, auth.options) : undefined;

      if (cancelled) {
        return;
      }

      setState({
        status: "ready",
        apiOptions: auth.options,
        tenants: tenantResult.data.tenants,
        selectedTenant: selectedTenant?.ok ? selectedTenant.data : undefined,
        audit: auditResult.ok ? auditResult.data.audit : [],
      });
    }

    void loadPlatformData();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectTenant = async (tenantId: string) => {
    if (state.status !== "ready") {
      return;
    }

    const result = await getPlatformTenant(tenantId, state.apiOptions);

    if (result.ok) {
      setState((current) => (current.status === "ready" ? { ...current, selectedTenant: result.data } : current));
    }
  };

  return (
    <AppShell>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Platform Admin</p>
          <h1 style={styles.title}>Platform health overview</h1>
          <p style={styles.lede}>
            Independent support access for tenant readiness, setup health, and platform audit summaries. Employee activity details,
            browsing history, virtual-office movement history, and secrets are intentionally excluded.
          </p>
        </div>
        <div style={styles.platformNotice}>
          <strong>Platform-only context</strong>
          <span>Tenant OWNER roles do not grant access here.</span>
        </div>
      </section>

      {state.status === "loading" ? <div style={styles.notice}>Checking platform permissions...</div> : null}

      {state.status === "blocked" ? (
        <div style={styles.blocked}>
          <strong>Platform access blocked</strong>
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Tenant list</h2>
              <span style={styles.countPill}>{state.tenants.length}</span>
            </div>
            <div style={styles.tenantList}>
              {state.tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => void selectTenant(tenant.id)}
                  style={{
                    ...styles.tenantButton,
                    ...(tenant.id === state.selectedTenant?.tenant.id ? styles.tenantButtonActive : null),
                  }}
                >
                  <span style={styles.tenantName}>{tenant.name}</span>
                  <span style={styles.tenantMeta}>{tenant.slug}</span>
                  <span style={styles.tenantStats}>
                    {tenant.userCount} users - {tenant.ownerCount} owners
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Tenant readiness</h2>
              <span style={styles.countPill}>safe summary</span>
            </div>
            {state.selectedTenant ? (
              <TenantHealthDetail detail={state.selectedTenant} />
            ) : (
              <p style={styles.muted}>Select a tenant to inspect setup readiness.</p>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Platform audit</h2>
              <span style={styles.countPill}>{state.audit.length}</span>
            </div>
            <div style={styles.auditList}>
              {state.audit.length > 0 ? (
                state.audit.slice(0, 8).map((entry) => (
                  <article key={entry.id} style={styles.auditRow}>
                    <strong>{entry.action}</strong>
                    <span>
                      {entry.targetCompany?.name ?? "Platform"} - {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </article>
                ))
              ) : (
                <p style={styles.muted}>No platform audit events returned yet.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function TenantHealthDetail({ detail }: { detail: WorkMapApiPlatformTenantDetail }) {
  const readiness = detail.health.readiness;
  const counts = detail.health.counts;

  return (
    <div style={styles.detailStack}>
      <div>
        <h3 style={styles.detailTitle}>{detail.tenant.name}</h3>
        <p style={styles.muted}>{detail.tenant.slug}</p>
      </div>
      <div style={styles.metricGrid}>
        <Metric label="Users" value={counts.users} />
        <Metric label="Owners" value={counts.owners} />
        <Metric label="Pending invites" value={counts.pendingInvites} />
        <Metric label="Devices active 24h" value={counts.activeDevices24h} />
      </div>
      <div style={styles.readinessList}>
        <ReadinessItem label="Owner configured" ready={readiness.hasOwner} />
        <ReadinessItem label="Users present" ready={readiness.hasUsers} />
        <ReadinessItem label="Default office map" ready={readiness.hasDefaultOfficeMap} />
        <ReadinessItem label="Monitoring policy" ready={readiness.hasMonitoringPolicy} />
      </div>
      <div style={styles.safeMeta}>
        <span>Last activity event: {formatNullableTime(detail.health.lastActivityAt)}</span>
        <span>Last office position: {formatNullableTime(detail.health.lastVirtualOfficePositionAt)}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div style={styles.readinessItem}>
      <span style={{ ...styles.readinessDot, background: ready ? "#22c55e" : "#f59e0b" }} />
      <span>{label}</span>
    </div>
  );
}

function formatNullableTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "not available";
}

const styles = {
  header: {
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "16px",
    flexWrap: "wrap" as const,
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    color: wm.colors.primary,
  },
  title: {
    margin: "4px 0 8px",
    color: wm.colors.text,
    fontSize: "32px",
    lineHeight: 1.1,
  },
  lede: {
    maxWidth: "820px",
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "15px",
    lineHeight: 1.55,
  },
  platformNotice: {
    display: "grid",
    gap: "5px",
    minWidth: "240px",
    border: `1px solid ${wm.colors.complianceBorder}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.complianceBg,
    color: wm.colors.compliance,
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.35,
  },
  notice: {
    ...wmStyles.infoNotice,
    padding: "14px 16px",
  },
  blocked: {
    display: "grid",
    gap: "6px",
    border: "1px solid #fecaca",
    borderRadius: wm.radius.lg,
    background: "#fef2f2",
    color: "#991b1b",
    padding: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  panel: {
    display: "grid",
    gap: "12px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surface,
    padding: "16px",
    boxShadow: wm.shadow.card,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  panelTitle: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "18px",
  },
  countPill: {
    borderRadius: "999px",
    background: wm.colors.surfaceLow,
    color: wm.colors.textSecondary,
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 800,
  },
  tenantList: {
    display: "grid",
    gap: "8px",
  },
  tenantButton: {
    display: "grid",
    gap: "4px",
    width: "100%",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: wm.colors.border,
    borderRadius: wm.radius.md,
    background: wm.colors.surface,
    color: wm.colors.text,
    padding: "12px",
    textAlign: "left" as const,
    cursor: "pointer",
  },
  tenantButtonActive: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: wm.colors.primary,
    background: "#eff6ff",
  },
  tenantName: {
    fontSize: "14px",
    fontWeight: 900,
  },
  tenantMeta: {
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 700,
  },
  tenantStats: {
    color: wm.colors.textSecondary,
    fontSize: "12px",
  },
  detailStack: {
    display: "grid",
    gap: "14px",
  },
  detailTitle: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "22px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  metric: {
    display: "grid",
    gap: "3px",
    borderTop: `1px solid ${wm.colors.border}`,
    padding: "10px 0 0",
  },
  readinessList: {
    display: "grid",
    gap: "8px",
  },
  readinessItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 700,
  },
  readinessDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
  },
  safeMeta: {
    display: "grid",
    gap: "6px",
    color: wm.colors.textMuted,
    fontSize: "12px",
    lineHeight: 1.45,
  },
  auditList: {
    display: "grid",
    gap: "8px",
  },
  auditRow: {
    display: "grid",
    gap: "3px",
    borderBottom: `1px solid ${wm.colors.border}`,
    paddingBottom: "8px",
    color: wm.colors.textSecondary,
    fontSize: "12px",
  },
  muted: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
