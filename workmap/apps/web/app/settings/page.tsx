"use client";

import { AppShell } from "../../components/layout/AppShell";
import { WorkMapBadge } from "../../components/ui/WorkMapBadge";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapCard } from "../../components/ui/WorkMapCard";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

const settingsSections = [
  {
    title: "Compliance",
    description: "Review monitoring transparency, collected metadata, and acknowledgement copy.",
    href: "/compliance",
    status: "Policy",
  },
  {
    title: "Integrations",
    description: "Manage link-based Teams, Outlook, calendar, and 3CX launchers.",
    href: "/integrations",
    status: "Link-based MVP",
  },
  {
    title: "Avatar",
    description: "Open avatar onboarding to update the workspace profile avatar.",
    href: "/onboarding/avatar",
    status: "Profile",
  },
  {
    title: "Virtual office",
    description: "Open the current Canvas office map and movement MVP.",
    href: "/virtual-office",
    status: "Canvas MVP",
  },
];

export default function SettingsPage() {
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
          Owner/admin settings must continue to use backend RBAC and tenant boundaries. This page links to the currently available
          settings surfaces and does not expose local-only workflow controls.
        </WorkMapPrivacyNotice>
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
};
