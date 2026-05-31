"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompliancePolicyPanel } from "../../components/compliance/CompliancePolicyPanel";
import { AppShell } from "../../components/layout/AppShell";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import {
  getNextRouteForUser,
  getUserSetupState,
  updateUserSetupState,
  type UserSetupState,
} from "../../lib/workflow/workflowState";

export default function CompliancePage() {
  const router = useRouter();
  const [setupState, setSetupState] = useState<UserSetupState | null>(null);

  useEffect(() => {
    setSetupState(getUserSetupState());
  }, []);

  const acknowledgeAndContinue = () => {
    const nextState = updateUserSetupState({ hasAcknowledgedPolicy: true });
    setSetupState(nextState);
    router.push(getNextRouteForUser(nextState));
  };

  const onboardingMode = Boolean(setupState?.isLoggedIn && !setupState.hasAcknowledgedPolicy);

  return (
    <AppShell>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Compliance</p>
            <h1 style={styles.title}>Monitoring policy</h1>
            <p style={styles.subtitle}>
              Make WorkMap visibility explicit, role-based, and easy for employees to understand.
            </p>
          </div>
          <nav style={styles.nav}>
            <a href="/settings" style={styles.secondaryLink}>Settings</a>
            <a href="/employees" style={styles.primaryLink}>Employees</a>
          </nav>
        </header>

        <section style={styles.notice}>
          <strong>{onboardingMode ? "First-time transparency step" : "Frontend MVP"}</strong>
          <span>
            {onboardingMode
              ? "Review what WorkMap does and does not collect before entering the workspace."
              : "This page previews policy copy and acknowledgement behavior. Real acknowledgements require backend identity, company scope, and audit logging."}
          </span>
        </section>

        <CompliancePolicyPanel />

        {onboardingMode ? (
          <section style={styles.ackCta}>
            <div>
              <h2 style={styles.ackTitle}>Ready to continue?</h2>
              <p style={styles.ackText}>
                I understand that WorkMap uses transparent, role-based visibility and does not collect private content.
              </p>
            </div>
            <button type="button" onClick={acknowledgeAndContinue} style={styles.ackButton}>
              I understand and agree
            </button>
          </section>
        ) : null}
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
  ackCta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: `1px solid ${wm.colors.successBorder}`,
    borderRadius: wm.radius.xl,
    background: wm.colors.successBg,
    color: "#14532d",
    padding: "16px",
  },
  ackTitle: {
    margin: "0 0 6px",
    fontSize: "20px",
  },
  ackText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  ackButton: {
    flex: "0 0 auto",
    border: `1px solid ${wm.colors.success}`,
    borderRadius: wm.radius.md,
    background: wm.colors.success,
    color: "#ffffff",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
