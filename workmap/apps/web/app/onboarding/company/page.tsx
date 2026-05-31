"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { updateUserSetupState } from "../../../lib/workflow/workflowState";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("Acme Operations");
  const [workspaceName, setWorkspaceName] = useState("Acme HQ");

  const continueToCompliance = () => {
    updateUserSetupState({ hasCompany: true }, "OWNER");
    router.push("/compliance");
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <p style={styles.eyebrow}>Owner onboarding</p>
        <h1 style={styles.title}>Create your WorkMap workspace</h1>
        <p style={styles.subtitle}>WorkMap creates a transparent virtual office for your team.</p>

        <section style={styles.card}>
          <label style={styles.label}>
            <span>Company name</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.label}>
            <span>Workspace name</span>
            <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} style={styles.input} />
          </label>
          <section style={styles.note}>
            <strong>Privacy-forward setup</strong>
            <span>Tracking rules are configured before employees join.</span>
          </section>
          <button type="button" onClick={continueToCompliance} disabled={!companyName || !workspaceName} style={styles.button}>
            Continue to compliance setup
          </button>
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "24px",
  },
  shell: {
    width: "min(620px, 100%)",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 10px",
    fontSize: "32px",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "0 0 18px",
    color: wm.colors.textSecondary,
    fontSize: "16px",
  },
  card: {
    display: "grid",
    gap: "14px",
    ...wmStyles.elevatedCard,
    padding: "20px",
  },
  label: {
    display: "grid",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    height: "42px",
    ...wmStyles.input,
    padding: "0 10px",
    fontSize: "14px",
  },
  note: {
    display: "grid",
    gap: "4px",
    ...wmStyles.infoNotice,
    padding: "12px",
    fontSize: "14px",
  },
  button: {
    ...wmStyles.primaryButton,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
