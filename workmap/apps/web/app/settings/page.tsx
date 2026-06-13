"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { WorkMapBadge } from "../../components/ui/WorkMapBadge";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapCard } from "../../components/ui/WorkMapCard";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
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
        <WorkMapPageHeader
          eyebrow="Admin"
          title="Settings"
          subtitle="Central settings entry points for the current WorkMap frontend MVP."
          actions={<WorkMapButton href="/dashboard" tone="primary">Dashboard</WorkMapButton>}
        />

        <section style={styles.grid}>
          {settingsSections.map((section) => (
            <WorkMapCard key={section.title} as="article" style={styles.card}>
              <WorkMapBadge tone="info" style={{ justifySelf: "start" }}>{section.status}</WorkMapBadge>
              <h2 style={styles.cardTitle}>{section.title}</h2>
              <p style={styles.cardText}>{section.description}</p>
              <WorkMapButton href={section.href} tone="secondary" style={{ justifySelf: "start" }}>Open</WorkMapButton>
            </WorkMapCard>
          ))}
        </section>

        <WorkMapPrivacyNotice title="Backend boundary" tone="warning">
          These settings are frontend-only entry points. Real tenant settings, RBAC, audit logging, and API persistence
          still need Director-approved backend contracts.
        </WorkMapPrivacyNotice>

        <section style={styles.resetPanel}>
          <div>
            <p style={styles.panelLabel}>Demo tools</p>
            <h2 style={styles.panelTitle}>Reset demo workflow</h2>
            <p style={styles.panelText}>
              Clears `workmap.userSetupState` for workflow testing. You can optionally clear the local avatar config too.
            </p>
          </div>
          <WorkMapButton type="button" onClick={resetDemo}>
            Reset demo workflow
          </WorkMapButton>
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: "14px",
  },
  card: {
    display: "grid",
    gap: "10px",
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
  resetPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
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
