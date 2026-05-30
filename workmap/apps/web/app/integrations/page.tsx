import { IntegrationButton } from "../../components/integrations/IntegrationButton";
import { integrationItems } from "../../components/integrations/mockIntegrationsData";
import { AppShell } from "../../components/layout/AppShell";

export default function IntegrationsPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Admin settings</p>
            <h1 style={styles.title}>Integrations</h1>
            <p style={styles.subtitle}>
              Configure lightweight contact launchers for Teams, Outlook, calendar scheduling, and 3CX.
            </p>
          </div>
          <nav style={styles.nav}>
            <a href="/dashboard" style={styles.secondaryLink}>Dashboard</a>
            <a href="/settings" style={styles.secondaryLink}>Settings</a>
            <a href="/virtual-office" style={styles.primaryLink}>Open office</a>
          </nav>
        </header>

        <section style={styles.notice}>
          <strong>Current MVP scope</strong>
          <span>
            These are link-based integration entry points. WorkMap does not request Microsoft Graph permissions, read message
            content, read email bodies, or record call audio.
          </span>
        </section>

        <section style={styles.grid}>
          {integrationItems.map((integration) => (
            <IntegrationButton key={integration.id} integration={integration} />
          ))}
        </section>

        <section style={styles.panel}>
          <p style={styles.panelLabel}>Next backend step</p>
          <h2 style={styles.panelTitle}>API contract needed before real connection state</h2>
          <p style={styles.panelText}>
            Real tenant-scoped integration settings, OAuth state, and audit logs should be added only after the Director
            approves the backend API, RBAC, and security model.
          </p>
        </section>
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    display: "grid",
    gap: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 8px",
    fontSize: "34px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.45,
  },
  nav: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  primaryLink: {
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  secondaryLink: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  notice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
  },
  panel: {
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
  panelTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
  },
  panelText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
