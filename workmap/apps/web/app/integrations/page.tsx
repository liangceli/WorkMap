import { IntegrationButton } from "../../components/integrations/IntegrationButton";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { integrationItems } from "../../lib/mock/mockIntegrations";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export default function IntegrationsPage() {
  return (
    <AppShell>
      <section className="wm-redesign-page wm-integrations-page" style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="Admin settings"
          title="Integrations"
          subtitle="Configure lightweight contact launchers for Teams, Outlook, calendar scheduling, and 3CX."
          actions={
            <>
              <WorkMapButton href="/dashboard">Dashboard</WorkMapButton>
              <WorkMapButton href="/settings">Settings</WorkMapButton>
              <WorkMapButton href="/virtual-office" tone="primary">Open office</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title="Current MVP scope">
          These are link-based integration entry points. WorkMap does not request Microsoft Graph permissions, read message
          content, read email bodies, or record call audio.
        </WorkMapPrivacyNotice>

        <section className="wm-integrations-grid" style={styles.grid}>
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
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
