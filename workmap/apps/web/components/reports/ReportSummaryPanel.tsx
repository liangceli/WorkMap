import type { ReportMetric, ReportRow } from "./mockReportsData";

type ReportSummaryPanelProps = {
  metrics: ReportMetric[];
  rows: ReportRow[];
};

const healthLabels: Record<ReportRow["health"], string> = {
  normal: "Normal",
  watch: "Watch",
  quiet: "Quiet",
};

const healthStyles: Record<ReportRow["health"], { color: string; background: string; border: string }> = {
  normal: { color: "#15803d", background: "#f0fdf4", border: "#bbf7d0" },
  watch: { color: "#b45309", background: "#fff7ed", border: "#fed7aa" },
  quiet: { color: "#475569", background: "#f8fafc", border: "#cbd5e1" },
};

export function ReportSummaryPanel({ metrics, rows }: ReportSummaryPanelProps) {
  return (
    <div style={styles.stack}>
      <section style={styles.metricGrid}>
        {metrics.map((metric) => (
          <article key={metric.label} style={styles.metricCard}>
            <p style={styles.metricLabel}>{metric.label}</p>
            <strong style={styles.metricValue}>{metric.value}</strong>
            <p style={styles.metricDetail}>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section style={styles.tablePanel}>
        <div style={styles.tableHeader}>
          <span>Department</span>
          <span>Active</span>
          <span>Idle</span>
          <span>Top app</span>
          <span>Top domain</span>
          <span>Health</span>
        </div>
        {rows.map((row) => {
          const statusStyle = healthStyles[row.health];

          return (
            <div key={row.department} style={styles.row}>
              <strong>{row.department}</strong>
              <span>{row.activeTime}</span>
              <span>{row.idleTime}</span>
              <span>{row.topApp}</span>
              <span>{row.topDomain}</span>
              <span
                style={{
                  ...styles.health,
                  color: statusStyle.color,
                  background: statusStyle.background,
                  borderColor: statusStyle.border,
                }}
              >
                {healthLabels[row.health]}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

const styles = {
  stack: {
    display: "grid",
    gap: "14px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
  },
  metricCard: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  metricLabel: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  metricValue: {
    display: "block",
    color: "#0f172a",
    fontSize: "26px",
    lineHeight: 1,
  },
  metricDetail: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  tablePanel: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.3fr repeat(4, 1fr) 100px",
    gap: "12px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    padding: "11px 14px",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.3fr repeat(4, 1fr) 100px",
    gap: "12px",
    alignItems: "center",
    borderBottom: "1px solid #eef2f7",
    padding: "13px 14px",
    color: "#334155",
    fontSize: "14px",
  },
  health: {
    justifySelf: "start",
    border: "1px solid",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
};
