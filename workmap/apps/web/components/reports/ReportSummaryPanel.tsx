import type { ReportMetric, ReportRow } from "./mockReportsData";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

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
  normal: { color: "#15803d", background: wm.colors.successBg, border: wm.colors.successBorder },
  watch: { color: wm.colors.warning, background: wm.colors.warningBg, border: wm.colors.warningBorder },
  quiet: { color: wm.colors.textSecondary, background: wm.colors.surfaceLow, border: wm.colors.border },
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
  tablePanel: {
    ...wmStyles.card,
    overflow: "hidden",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.3fr repeat(4, 1fr) 100px",
    gap: "12px",
    borderBottom: `1px solid ${wm.colors.borderSubtle}`,
    background: wm.colors.surfaceLow,
    color: wm.colors.textMuted,
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
    borderBottom: `1px solid ${wm.colors.borderSubtle}`,
    padding: "13px 14px",
    color: wm.colors.textSecondary,
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
