import type { IntegrationItem, IntegrationStatus } from "./mockIntegrationsData";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type IntegrationButtonProps = {
  integration: IntegrationItem;
};

const statusLabels: Record<IntegrationStatus, string> = {
  ready: "Ready",
  mock: "Mock link",
  needs_setup: "Needs setup",
};

const statusColors: Record<IntegrationStatus, { color: string; background: string; border: string }> = {
  ready: { color: wm.colors.success, background: wm.colors.successBg, border: wm.colors.successBorder },
  mock: { color: wm.colors.infoText, background: wm.colors.infoBg, border: wm.colors.infoBorder },
  needs_setup: { color: wm.colors.warning, background: wm.colors.warningBg, border: wm.colors.warningBorder },
};

export function IntegrationButton({ integration }: IntegrationButtonProps) {
  const statusStyle = statusColors[integration.status];

  return (
    <article style={styles.card}>
      <div style={styles.header}>
        <div>
          <p style={styles.category}>{integration.category}</p>
          <h2 style={styles.name}>{integration.name}</h2>
        </div>
        <span
          style={{
            ...styles.status,
            color: statusStyle.color,
            background: statusStyle.background,
            borderColor: statusStyle.border,
          }}
        >
          {statusLabels[integration.status]}
        </span>
      </div>

      <p style={styles.description}>{integration.description}</p>
      <p style={styles.privacy}>{integration.privacyNote}</p>

      <a href={integration.href} style={styles.action}>
        {integration.actionLabel}
      </a>
    </article>
  );
}

const styles = {
  card: {
    ...wmStyles.card,
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  category: {
    ...wmStyles.eyebrow,
    color: wm.colors.textMuted,
  },
  name: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "19px",
    fontWeight: 700,
  },
  status: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "5px 9px",
    whiteSpace: "nowrap" as const,
    fontSize: "12px",
    fontWeight: 700,
  },
  description: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  privacy: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  action: {
    ...wmStyles.primaryButton,
    display: "inline-flex",
    justifyContent: "center",
    padding: "10px 12px",
  },
};
