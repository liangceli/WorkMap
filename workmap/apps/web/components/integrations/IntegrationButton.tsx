import type { IntegrationItem, IntegrationStatus } from "./mockIntegrationsData";

type IntegrationButtonProps = {
  integration: IntegrationItem;
};

const statusLabels: Record<IntegrationStatus, string> = {
  ready: "Ready",
  mock: "Mock link",
  needs_setup: "Needs setup",
};

const statusColors: Record<IntegrationStatus, { color: string; background: string; border: string }> = {
  ready: { color: "#15803d", background: "#f0fdf4", border: "#bbf7d0" },
  mock: { color: "#1d4ed8", background: "#eff6ff", border: "#bfdbfe" },
  needs_setup: { color: "#b45309", background: "#fff7ed", border: "#fed7aa" },
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
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
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
    margin: "0 0 6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  name: {
    margin: 0,
    color: "#0f172a",
    fontSize: "19px",
  },
  status: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "5px 9px",
    whiteSpace: "nowrap" as const,
    fontSize: "12px",
    fontWeight: 900,
  },
  description: {
    margin: 0,
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  privacy: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  action: {
    display: "inline-flex",
    justifyContent: "center",
    border: "1px solid #0f172a",
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 12px",
    textDecoration: "none",
    fontWeight: 900,
  },
};
