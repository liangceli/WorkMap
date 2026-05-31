"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { clearAvatarConfig } from "../../lib/avatar/avatarStorage";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { resetUserSetupState } from "../../lib/workflow/workflowState";

const settingsSections = [
  {
    title: "Compliance",
    description: "Review monitoring transparency, collected metadata, and acknowledgement copy.",
    href: "/compliance",
    status: "Mock policy preview",
  },
  {
    title: "Integrations",
    description: "Manage link-based Teams, Outlook, calendar, and 3CX launchers.",
    href: "/integrations",
    status: "Link-based MVP",
  },
  {
    title: "Avatar",
    description: "Open avatar onboarding to update your local layered avatar selection.",
    href: "/onboarding/avatar",
    status: "Stored locally",
  },
  {
    title: "Virtual office",
    description: "Open the current Canvas office map and movement MVP.",
    href: "/virtual-office",
    status: "Canvas MVP",
  },
];

export default function SettingsPage() {
  const router = useRouter();

  const resetDemo = () => {
    const clearAvatar = window.confirm("Reset demo workflow state. Also clear the local avatar config?");
    resetUserSetupState();
    if (clearAvatar) {
      clearAvatarConfig();
    }
    router.push("/");
  };

  return (
    <AppShell>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Admin</p>
            <h1 style={styles.title}>Settings</h1>
            <p style={styles.subtitle}>Central settings entry points for the current WorkMap frontend MVP.</p>
          </div>
          <a href="/dashboard" style={styles.primaryLink}>Dashboard</a>
        </header>

        <section style={styles.grid}>
          {settingsSections.map((section) => (
            <article key={section.title} style={styles.card}>
              <span style={styles.status}>{section.status}</span>
              <h2 style={styles.cardTitle}>{section.title}</h2>
              <p style={styles.cardText}>{section.description}</p>
              <a href={section.href} style={styles.cardLink}>Open</a>
            </article>
          ))}
        </section>

        <section style={styles.notice}>
          <strong>Backend boundary</strong>
          <span>
            These settings are frontend-only entry points. Real tenant settings, RBAC, audit logging, and API persistence
            still need Director-approved backend contracts.
          </span>
        </section>

        <section style={styles.resetPanel}>
          <div>
            <p style={styles.panelLabel}>Demo tools</p>
            <h2 style={styles.panelTitle}>Reset demo workflow</h2>
            <p style={styles.panelText}>
              Clears `workmap.userSetupState` for workflow testing. You can optionally clear the local avatar config too.
            </p>
          </div>
          <button type="button" onClick={resetDemo} style={styles.resetButton}>
            Reset demo workflow
          </button>
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
  primaryLink: {
    ...wmStyles.primaryButton,
    padding: "10px 14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  card: {
    ...wmStyles.card,
    padding: "16px",
    display: "grid",
    gap: "10px",
  },
  status: {
    justifySelf: "start",
    border: `1px solid ${wm.colors.infoBorder}`,
    borderRadius: "999px",
    background: wm.colors.infoBg,
    color: wm.colors.secondary,
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
  },
  cardText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  cardLink: {
    justifySelf: "start",
    ...wmStyles.secondaryButton,
    padding: "9px 12px",
    textDecoration: "none",
    fontWeight: 900,
  },
  notice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: `1px solid ${wm.colors.warningBorder}`,
    borderRadius: wm.radius.xl,
    background: wm.colors.warningBg,
    color: "#7c2d12",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  resetPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
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
  resetButton: {
    flex: "0 0 auto",
    ...wmStyles.secondaryButton,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
