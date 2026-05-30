import type { UsageMetric } from "./mockDashboardData";

type UsageSummaryCardProps = {
  metric: UsageMetric;
};

const toneColors: Record<UsageMetric["tone"], string> = {
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706",
  slate: "#475569",
};

export function UsageSummaryCard({ metric }: UsageSummaryCardProps) {
  return (
    <article style={styles.card}>
      <div style={{ ...styles.accent, background: toneColors[metric.tone] }} />
      <p style={styles.label}>{metric.label}</p>
      <strong style={styles.value}>{metric.value}</strong>
      <p style={styles.detail}>{metric.detail}</p>
    </article>
  );
}

const styles = {
  card: {
    position: "relative" as const,
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
    overflow: "hidden",
  },
  accent: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "3px",
  },
  label: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
  value: {
    display: "block",
    color: "#0f172a",
    fontSize: "26px",
    lineHeight: 1,
  },
  detail: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
