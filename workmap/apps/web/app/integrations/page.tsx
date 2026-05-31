import { IntegrationButton } from "../../components/integrations/IntegrationButton";
import { integrationItems } from "../../components/integrations/mockIntegrationsData";
import { AppShell } from "../../components/layout/AppShell";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

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
    ...wmStyles.pageStack,
  },
  header: {
    ...wmStyles.pageHeader,
  },
  eyebrow: {
    ...wmStyles.eyebrow,
  },
  title: {
    ...wmStyles.pageTitle,
  },
  subtitle: {
    ...wmStyles.pageSubtitle,
  },
  nav: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  primaryLink: {
    ...wmStyles.primaryButton,
    padding: "10px 14px",
  },
  secondaryLink: {
    ...wmStyles.secondaryButton,
    padding: "10px 14px",
  },
  notice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    ...wmStyles.infoNotice,
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
    ...wmStyles.card,
    padding: "16px",
  },
  panelLabel: {
    margin: "0 0 8px",
    color: wm.colors.textMuted,
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
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
