"use client";

import { useEffect, useState } from "react";
import { EmployeeAvatar } from "../dashboard/EmployeeAvatar";
import type { DashboardEmployee } from "../dashboard/mockDashboardData";
import { PresenceBadge } from "../office/PresenceBadge";
import { getUserSetupState } from "../../lib/workflow/workflowState";

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
              ? "Manager summaries are mock data until backend RBAC APIs exist."
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
                <h3 style={styles.smallTitle}>Manager-only mock summary</h3>
                <p style={styles.bodyText}>Active time, idle time, app summary, and domain summary. Real data requires backend RBAC.</p>
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
                <p style={styles.bodyText}>No other teammates in this mock department.</p>
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
  const color = health === "offline" ? "#64748b" : health === "delayed" ? "#b45309" : "#15803d";

  return {
    ...styles.deviceHealth,
    color,
    borderColor: health === "offline" ? "#cbd5e1" : health === "delayed" ? "#fed7aa" : "#bbf7d0",
    background: health === "offline" ? "#f8fafc" : health === "delayed" ? "#fff7ed" : "#f0fdf4",
  };
}

const styles = {
  stack: {
    display: "grid",
    gap: "16px",
  },
  profileHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: "16px",
    alignItems: "stretch",
  },
  identityBlock: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "18px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 6px",
    fontSize: "32px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "0 0 12px",
    color: "#475569",
    fontSize: "15px",
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    alignItems: "center",
  },
  localTime: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "8px 10px",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 800,
  },
  deviceHealth: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
  },
  modeCard: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  panelLabel: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    overflow: "hidden",
  },
  segmentButton: {
    height: "40px",
    border: 0,
    background: "#ffffff",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 900,
  },
  segmentButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
  },
  modeText: {
    margin: "12px 0 0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
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
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
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
    fontSize: "18px",
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
  },
  primaryAction: {
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: "6px",
    padding: "10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  actionButton: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    borderRadius: "6px",
    padding: "10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    margin: 0,
  },
  metric: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "12px",
  },
  metricLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  metricValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: "17px",
    fontWeight: 900,
  },
  privacyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  smallTitle: {
    margin: "0 0 6px",
    fontSize: "15px",
  },
  bodyText: {
    margin: 0,
    color: "#475569",
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
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px",
    color: "#0f172a",
    textDecoration: "none",
  },
  teammateName: {
    display: "block",
    fontSize: "14px",
  },
  teammateRole: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
  },
  navStack: {
    display: "grid",
    gap: "8px",
  },
  navLink: {
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px",
    textAlign: "center" as const,
    textDecoration: "none",
    fontWeight: 900,
  },
  navLinkDark: {
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px",
    textAlign: "center" as const,
    textDecoration: "none",
    fontWeight: 900,
  },
};
