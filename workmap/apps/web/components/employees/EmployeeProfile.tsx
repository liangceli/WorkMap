"use client";

import { useEffect, useState } from "react";
import { EmployeeAvatar } from "../dashboard/EmployeeAvatar";
import type { DashboardEmployee } from "../dashboard/mockDashboardData";
import { PresenceBadge } from "../office/PresenceBadge";
import { getUserSetupState } from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type EmployeeProfileProps = {
  employee: DashboardEmployee;
  teammates: DashboardEmployee[];
};

type VisibilityMode = "manager" | "employee";

export function EmployeeProfile({ employee, teammates }: EmployeeProfileProps) {
  const [mode, setMode] = useState<VisibilityMode>("manager");

  useEffect(() => {
    const state = getUserSetupState();
    if (state?.role === "EMPLOYEE") {
      setMode("employee");
    }
  }, []);

  return (
    <div style={styles.stack}>
      <section style={styles.profileHeader}>
        <div style={styles.identityBlock}>
          <EmployeeAvatar avatar={employee.avatar} size={112} />
          <div>
            <p style={styles.eyebrow}>{employee.department}</p>
            <h1 style={styles.title}>{employee.name}</h1>
            <p style={styles.subtitle}>{employee.role}</p>
            <div style={styles.badgeRow}>
              <PresenceBadge status={employee.status} />
              <span style={styles.localTime}>{employee.localTime}</span>
              <span style={getDeviceStyle(employee.deviceHealth)}>{formatDeviceHealth(employee.deviceHealth)}</span>
            </div>
          </div>
        </div>

        <div style={styles.modeCard}>
          <p style={styles.panelLabel}>Visibility</p>
          <div style={styles.segmented} aria-label="Visibility mode">
            <button
              type="button"
              onClick={() => setMode("manager")}
              style={{ ...styles.segmentButton, ...(mode === "manager" ? styles.segmentButtonActive : {}) }}
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => setMode("employee")}
              style={{ ...styles.segmentButton, ...(mode === "employee" ? styles.segmentButtonActive : {}) }}
            >
              Employee
            </button>
          </div>
          <p style={styles.modeText}>
            {mode === "manager"
              ? "Manager summaries require backend RBAC and real report rows."
              : "Employee view only shows contact, role, status, and local time."}
          </p>
        </div>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.mainStack}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.panelLabel}>Contact</p>
                <h2 style={styles.panelTitle}>Quick actions</h2>
              </div>
            </div>
            <div style={styles.contactGrid}>
              <button type="button" style={styles.primaryAction}>Teams chat</button>
              <button type="button" style={styles.actionButton}>Email</button>
              <button type="button" style={styles.actionButton}>3CX call</button>
              <button type="button" style={styles.actionButton}>Schedule</button>
            </div>
          </section>

          {mode === "manager" ? (
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <p style={styles.panelLabel}>Today</p>
                  <h2 style={styles.panelTitle}>Work summary</h2>
                </div>
              </div>
              <dl style={styles.metricGrid}>
                <div style={styles.metric}>
                  <dt style={styles.metricLabel}>Active time</dt>
                  <dd style={styles.metricValue}>{employee.activeTime}</dd>
                </div>
                <div style={styles.metric}>
                  <dt style={styles.metricLabel}>Idle time</dt>
                  <dd style={styles.metricValue}>{employee.idleTime}</dd>
                </div>
                <div style={styles.metric}>
                  <dt style={styles.metricLabel}>Top app</dt>
                  <dd style={styles.metricValue}>{employee.topApp}</dd>
                </div>
                <div style={styles.metric}>
                  <dt style={styles.metricLabel}>Top domain</dt>
                  <dd style={styles.metricValue}>{employee.topDomain}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section style={styles.panel}>
            <p style={styles.panelLabel}>Privacy</p>
            <h2 style={styles.panelTitle}>Visible fields</h2>
            <div style={styles.privacyGrid}>
              <div>
                <h3 style={styles.smallTitle}>Shown to employees</h3>
                <p style={styles.bodyText}>Name, role, department, presence status, local time, and contact actions.</p>
              </div>
              <div>
                <h3 style={styles.smallTitle}>Manager-only summary</h3>
                <p style={styles.bodyText}>Active time, idle time, app summary, and domain summary require backend RBAC and real activity rows.</p>
              </div>
            </div>
          </section>
        </div>

        <aside style={styles.sideStack}>
          <section style={styles.panel}>
            <p style={styles.panelLabel}>Team</p>
            <h2 style={styles.panelTitle}>Same department</h2>
            <div style={styles.teammateList}>
              {teammates.length === 0 ? (
                <p style={styles.bodyText}>No other teammates are available in this view.</p>
              ) : (
                teammates.map((teammate) => (
                  <a key={teammate.id} href={`/employees/${teammate.id}`} style={styles.teammateLink}>
                    <EmployeeAvatar avatar={teammate.avatar} size={42} />
                    <span>
                      <strong style={styles.teammateName}>{teammate.name}</strong>
                      <span style={styles.teammateRole}>{teammate.role}</span>
                    </span>
                  </a>
                ))
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <p style={styles.panelLabel}>Navigation</p>
            <div style={styles.navStack}>
              <a href="/employees" style={styles.navLink}>Back to employees</a>
              <a href="/dashboard" style={styles.navLink}>Dashboard</a>
              <a href="/virtual-office" style={styles.navLinkDark}>Open office</a>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function formatDeviceHealth(health?: DashboardEmployee["deviceHealth"]) {
  if (health === "delayed") {
    return "Device delayed";
  }

  if (health === "offline") {
    return "Device offline";
  }

  return "Device online";
}

function getDeviceStyle(health?: DashboardEmployee["deviceHealth"]) {
  const color = health === "offline" ? wm.colors.textMuted : health === "delayed" ? wm.colors.warning : wm.colors.success;

  return {
    ...styles.deviceHealth,
    color,
    borderColor:
      health === "offline" ? wm.colors.borderStrong : health === "delayed" ? wm.colors.warningBorder : wm.colors.successBorder,
    background: health === "offline" ? wm.colors.appBackground : health === "delayed" ? wm.colors.warningBg : wm.colors.successBg,
  };
}

const styles = {
  stack: {
    display: "grid",
    gap: "16px",
  },
  profileHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "16px",
    alignItems: "stretch",
  },
  identityBlock: {
    ...wmStyles.elevatedCard,
    display: "flex",
    alignItems: "center",
    gap: "18px",
    padding: "18px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
  },
  title: {
    margin: "0 0 6px",
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "32px",
    lineHeight: 1.12,
    fontWeight: 750,
  },
  subtitle: {
    margin: "0 0 12px",
    color: wm.colors.textSecondary,
    fontSize: "15px",
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    alignItems: "center",
  },
  localTime: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surface,
    padding: "8px 10px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    fontWeight: 700,
  },
  deviceHealth: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
  },
  modeCard: {
    ...wmStyles.card,
    padding: "16px",
  },
  panelLabel: {
    ...wmStyles.eyebrow,
    color: wm.colors.textMuted,
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    overflow: "hidden",
  },
  segmentButton: {
    height: "40px",
    border: 0,
    background: wm.colors.surface,
    color: wm.colors.textSecondary,
    cursor: "pointer",
    fontWeight: 700,
  },
  segmentButtonActive: {
    background: wm.colors.secondary,
    color: wm.colors.surface,
  },
  modeText: {
    margin: "12px 0 0",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  mainStack: {
    display: "grid",
    gap: "14px",
  },
  sideStack: {
    display: "grid",
    gap: "14px",
  },
  panel: {
    ...wmStyles.card,
    padding: "16px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  panelTitle: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "18px",
    fontWeight: 700,
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "10px",
  },
  primaryAction: {
    ...wmStyles.primaryButton,
    padding: "10px",
  },
  actionButton: {
    ...wmStyles.secondaryButton,
    padding: "10px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
    margin: 0,
  },
  metric: {
    border: `1px solid ${wm.colors.borderSubtle}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surfaceLow,
    padding: "12px",
  },
  metricLabel: {
    color: wm.colors.textMuted,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  metricValue: {
    margin: "6px 0 0",
    color: wm.colors.text,
    fontSize: "17px",
    fontWeight: 700,
  },
  privacyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: "14px",
  },
  smallTitle: {
    margin: "0 0 6px",
    color: wm.colors.text,
    fontSize: "15px",
  },
  bodyText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  teammateList: {
    display: "grid",
    gap: "10px",
  },
  teammateLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: `1px solid ${wm.colors.borderSubtle}`,
    borderRadius: wm.radius.md,
    padding: "8px",
    color: wm.colors.text,
    textDecoration: "none",
  },
  teammateName: {
    display: "block",
    fontSize: "14px",
  },
  teammateRole: {
    display: "block",
    color: wm.colors.textMuted,
    fontSize: "12px",
  },
  navStack: {
    display: "grid",
    gap: "8px",
  },
  navLink: {
    ...wmStyles.secondaryButton,
    padding: "10px",
    textAlign: "center" as const,
  },
  navLinkDark: {
    ...wmStyles.primaryButton,
    padding: "10px",
    textAlign: "center" as const,
  },
};
