import { PresenceBadge } from "../office/PresenceBadge";
import { EmployeeAvatar } from "./EmployeeAvatar";
import type { DashboardEmployee } from "./mockDashboardData";

type EmployeeCardProps = {
  employee: DashboardEmployee;
};

export function EmployeeCard({ employee }: EmployeeCardProps) {
  return (
    <article style={styles.card}>
      <div style={styles.header}>
        <EmployeeAvatar avatar={employee.avatar} />
        <div style={styles.identity}>
          <h3 style={styles.name}>{employee.name}</h3>
          <p style={styles.meta}>{employee.role}</p>
          <p style={styles.meta}>
            {employee.department} / {employee.localTime}
          </p>
        </div>
      </div>
      <PresenceBadge status={employee.status} />
      <dl style={styles.stats}>
        <div>
          <dt style={styles.statLabel}>Active</dt>
          <dd style={styles.statValue}>{employee.activeTime}</dd>
        </div>
        <div>
          <dt style={styles.statLabel}>Idle</dt>
          <dd style={styles.statValue}>{employee.idleTime}</dd>
        </div>
      </dl>
      <div style={styles.actions}>
        <button type="button" style={styles.actionButton}>Teams</button>
        <button type="button" style={styles.actionButton}>Email</button>
        <button type="button" style={styles.actionButton}>3CX</button>
      </div>
    </article>
  );
}

const styles = {
  card: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "14px",
    display: "grid",
    gap: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  identity: {
    minWidth: 0,
  },
  name: {
    margin: "0 0 4px",
    fontSize: "16px",
  },
  meta: {
    margin: "0 0 2px",
    color: "#64748b",
    fontSize: "13px",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    margin: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  statValue: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 800,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  actionButton: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: "6px",
    padding: "8px",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 700,
  },
};
