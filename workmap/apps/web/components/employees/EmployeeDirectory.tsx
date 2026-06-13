"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserPresenceStatus } from "@workmap/shared-types";
import { EmployeeAvatar } from "../dashboard/EmployeeAvatar";
import type { DashboardEmployee } from "../dashboard/mockDashboardData";
import { PresenceBadge } from "../office/PresenceBadge";
import { WorkMapEmptyState } from "../ui/WorkMapEmptyState";
import { getUserSetupState } from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type EmployeeDirectoryProps = {
  employees: DashboardEmployee[];
  showProfileLinks?: boolean;
};

type VisibilityMode = "manager" | "employee";
type StatusFilter = "all" | UserPresenceStatus;

export function EmployeeDirectory({ employees, showProfileLinks = true }: EmployeeDirectoryProps) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mode, setMode] = useState<VisibilityMode>("employee");
  const [canSwitchMode, setCanSwitchMode] = useState(false);

  useEffect(() => {
    const state = getUserSetupState();
    const canUseManagerMode = Boolean(state && state.role !== "EMPLOYEE");

    setCanSwitchMode(canUseManagerMode);
    if (canUseManagerMode) {
      setMode("manager");
    }
  }, []);

  const departments = useMemo(
    () => ["all", ...Array.from(new Set(employees.map((employee) => employee.department))).sort()],
    [employees],
  );
  const statuses = useMemo(
    () => ["all", ...Array.from(new Set(employees.map((employee) => employee.status))).sort()] as StatusFilter[],
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${employee.name} ${employee.role} ${employee.department}`.toLowerCase().includes(normalizedQuery);
      const matchesDepartment = department === "all" || employee.department === department;
      const matchesStatus = status === "all" || employee.status === status;

      return matchesQuery && matchesDepartment && matchesStatus;
    });
  }, [department, employees, query, status]);

  return (
    <div style={styles.stack}>
      <section style={styles.toolbar}>
        <label style={styles.searchLabel}>
          <span style={styles.labelText}>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, role, or department"
            style={styles.searchInput}
          />
        </label>

        <label style={styles.controlLabel}>
          <span style={styles.labelText}>Department</span>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} style={styles.select}>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All departments" : item}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.controlLabel}>
          <span style={styles.labelText}>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} style={styles.select}>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : item.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        {canSwitchMode ? (
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
        ) : (
          <div style={styles.modePill}>Contact-only view</div>
        )}
      </section>

      <section style={styles.summaryBar}>
        <span>{filteredEmployees.length} people shown</span>
        <span>{employees.filter((employee) => employee.status !== "offline").length} online or recently active</span>
        <span>{mode === "manager" ? "Manager summaries visible" : "Contact-only view"}</span>
      </section>

      <section style={styles.tablePanel}>
        <div style={styles.tableHeader}>
          <span>Employee</span>
          <span>Status</span>
          <span>Contact</span>
          {mode === "manager" ? <span>Today</span> : null}
        </div>

        {filteredEmployees.length === 0 ? (
          <WorkMapEmptyState title="No employees match these filters">
            Try clearing the search or choosing a different department/status.
          </WorkMapEmptyState>
        ) : (
          filteredEmployees.map((employee) => (
            <article key={employee.id} style={styles.row}>
              <div style={styles.identityCell}>
                <EmployeeAvatar avatar={employee.avatar} size={58} />
                <div style={styles.identityText}>
                  <h2 style={styles.name}>{employee.name}</h2>
                  <p style={styles.meta}>{employee.role}</p>
                  <p style={styles.meta}>
                    {employee.department} / {employee.localTime}
                  </p>
                </div>
              </div>

              <div style={styles.statusCell}>
                <PresenceBadge status={employee.status} />
                <span style={getDeviceStyle(employee.deviceHealth)}>{formatDeviceHealth(employee.deviceHealth)}</span>
              </div>

              <div style={styles.actions}>
                <button type="button" style={styles.actionButton}>Teams</button>
                <button type="button" style={styles.actionButton}>Email</button>
                <button type="button" style={styles.actionButton}>3CX</button>
                {showProfileLinks ? <a href={`/employees/${employee.id}`} style={styles.actionLink}>View</a> : null}
              </div>

              {mode === "manager" ? (
                <dl style={styles.managerSummary}>
                  <div>
                    <dt style={styles.statLabel}>Active</dt>
                    <dd style={styles.statValue}>{employee.activeTime}</dd>
                  </div>
                  <div>
                    <dt style={styles.statLabel}>Idle</dt>
                    <dd style={styles.statValue}>{employee.idleTime}</dd>
                  </div>
                  <div>
                    <dt style={styles.statLabel}>Top app</dt>
                    <dd style={styles.statValue}>{employee.topApp}</dd>
                  </div>
                  <div>
                    <dt style={styles.statLabel}>Top domain</dt>
                    <dd style={styles.statValue}>{employee.topDomain}</dd>
                  </div>
                </dl>
              ) : null}
            </article>
          ))
        )}
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
    gap: "14px",
  },
  toolbar: {
    ...wmStyles.card,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
    gap: "12px",
    alignItems: "end",
    padding: "16px",
  },
  searchLabel: {
    display: "grid",
    gap: "6px",
  },
  controlLabel: {
    display: "grid",
    gap: "6px",
  },
  labelText: {
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  searchInput: {
    ...wmStyles.input,
    height: "38px",
    padding: "0 10px",
  },
  select: {
    ...wmStyles.input,
    height: "40px",
    padding: "0 10px",
  },
  segmented: {
    display: "inline-grid",
    gridTemplateColumns: "1fr 1fr",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    overflow: "hidden",
  },
  modePill: {
    display: "grid",
    placeItems: "center",
    minHeight: "40px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surfaceLow,
    color: wm.colors.textSecondary,
    padding: "0 12px",
    fontSize: "13px",
    fontWeight: 800,
  },
  segmentButton: {
    height: "40px",
    border: 0,
    background: wm.colors.surface,
    color: wm.colors.textSecondary,
    padding: "0 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  segmentButtonActive: {
    background: wm.colors.primaryContainer,
    color: wm.colors.surface,
  },
  summaryBar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
  },
  tablePanel: {
    ...wmStyles.card,
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    overflowX: "auto" as const,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.35fr) 210px 230px minmax(260px, 1fr)",
    minWidth: "920px",
    gap: "14px",
    borderBottom: `1px solid ${wm.colors.borderSubtle}`,
    background: wm.colors.surfaceLow,
    color: wm.colors.textMuted,
    padding: "11px 14px",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.35fr) 210px 230px minmax(260px, 1fr)",
    minWidth: "920px",
    gap: "14px",
    alignItems: "center",
    borderBottom: `1px solid ${wm.colors.borderSubtle}`,
    padding: "13px 14px",
  },
  identityCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  identityText: {
    minWidth: 0,
  },
  name: {
    margin: "0 0 4px",
    color: wm.colors.text,
    fontSize: "16px",
  },
  meta: {
    margin: "0 0 2px",
    color: wm.colors.textMuted,
    fontSize: "13px",
  },
  statusCell: {
    display: "grid",
    justifyItems: "start",
    gap: "8px",
  },
  deviceHealth: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 700,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(64px, 1fr))",
    gap: "8px",
  },
  actionButton: {
    ...wmStyles.secondaryButton,
    padding: "8px",
  },
  actionLink: {
    ...wmStyles.secondaryButton,
    padding: "8px",
    textAlign: "center" as const,
    fontSize: "13px",
  },
  managerSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    margin: 0,
  },
  statLabel: {
    color: wm.colors.textMuted,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  statValue: {
    margin: "3px 0 0",
    color: wm.colors.text,
    fontSize: "13px",
    fontWeight: 700,
  },
};
