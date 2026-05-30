"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompliancePolicyPanel } from "../../components/compliance/CompliancePolicyPanel";
import { AppShell } from "../../components/layout/AppShell";
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
  ackCta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    background: "#f0fdf4",
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
    border: "1px solid #166534",
    borderRadius: "8px",
    background: "#166534",
    color: "#ffffff",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
