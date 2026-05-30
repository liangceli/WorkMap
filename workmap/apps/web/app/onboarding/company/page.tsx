"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    background: "#f3f7fb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "24px",
  },
  shell: {
    width: "min(620px, 100%)",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 10px",
    fontSize: "38px",
    lineHeight: 1.08,
  },
  subtitle: {
    margin: "0 0 18px",
    color: "#475569",
    fontSize: "16px",
  },
  card: {
    display: "grid",
    gap: "14px",
    border: "1px solid #dbe3ef",
    borderRadius: "10px",
    background: "#ffffff",
    padding: "20px",
  },
  label: {
    display: "grid",
    gap: "6px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    height: "42px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "0 10px",
    color: "#0f172a",
    fontSize: "14px",
  },
  note: {
    display: "grid",
    gap: "4px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px",
    fontSize: "14px",
  },
  button: {
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
