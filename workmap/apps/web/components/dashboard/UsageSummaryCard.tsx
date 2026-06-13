import type { UsageMetric } from "./mockDashboardData";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type UsageSummaryCardProps = {
  metric: UsageMetric;
};

const toneColors: Record<UsageMetric["tone"], string> = {
  green: wm.colors.success,
  blue: wm.colors.secondary,
  amber: wm.colors.warning,
  slate: wm.colors.textSecondary,
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
    ...wmStyles.card,
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
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
  value: {
    display: "block",
    color: wm.colors.text,
    fontSize: "26px",
    lineHeight: 1,
  },
  detail: {
    margin: "10px 0 0",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
