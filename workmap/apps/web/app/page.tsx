"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  getUserSetupState,
  saveUserSetupState,
  type UserSetupState,
  type WorkMapRole,
} from "../lib/workflow/workflowState";

const roles: Array<{ role: WorkMapRole; title: string; description: string }> = [
  { role: "EMPLOYEE", title: "Employee", description: "Create an avatar, acknowledge the policy, and enter the virtual office." },
  { role: "MANAGER", title: "Manager", description: "Review team visibility, reports, and employee contact workflows." },
  { role: "OWNER", title: "Owner", description: "Create a workspace before reviewing compliance and dashboard flows." },
  { role: "IT_ADMIN", title: "IT Admin", description: "Explore operational setup, integrations, and admin-facing entry points." },
];

const quickLinks = [
  ["/virtual-office", "Office"],
  ["/dashboard", "Dashboard"],
  ["/employees", "Employees"],
  ["/reports", "Reports"],
  ["/compliance", "Compliance"],
  ["/integrations", "Integrations"],
  ["/settings", "Settings"],
  ["/login", "Login"],
] as const;

export default function HomePage() {
  const router = useRouter();
  const [setupState, setSetupState] = useState<UserSetupState | null>(null);
  const [selectedRole, setSelectedRole] = useState<WorkMapRole>("EMPLOYEE");

  useEffect(() => {
    setSetupState(getUserSetupState());
  }, []);

  const startDemoFlow = () => {
    const nextState = getDefaultSetupState(selectedRole);
    saveUserSetupState(nextState);
    router.push(getNextRouteForUser(nextState));
  };

  const continueToWorkMap = () => {
    router.push(getNextRouteForUser(setupState));
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <p style={styles.eyebrow}>WorkMap</p>
          <h1 style={styles.title}>A virtual office for presence, collaboration, and transparent work visibility.</h1>
          <p style={styles.subtitle}>
            Walk the office as an avatar, contact teammates quickly, and review role-based work patterns without private content collection.
          </p>
          <section style={styles.privacyBox}>
            <strong>Transparent by design</strong>
            <span>No keystrokes, screenshots, camera, microphone, message content, email body, passwords, or full URLs by default.</span>
          </section>
        </div>

        <section style={styles.card}>
          {setupState ? (
            <>
              <p style={styles.cardLabel}>Resume demo</p>
              <h2 style={styles.cardTitle}>Continue to WorkMap</h2>
              <p style={styles.cardText}>
                Current demo role: <strong>{setupState.role.replace("_", " ")}</strong>. The next step is{" "}
                <strong>{getNextRouteForUser(setupState)}</strong>.
              </p>
              <button type="button" onClick={continueToWorkMap} style={styles.primaryButton}>
                Continue to WorkMap
              </button>
              <a href="/login" style={styles.secondaryLink}>Change demo role</a>
            </>
          ) : (
            <>
              <p style={styles.cardLabel}>Choose a demo role</p>
              <h2 style={styles.cardTitle}>Start demo flow</h2>
              <div style={styles.roleGrid}>
                {roles.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => setSelectedRole(item.role)}
                    style={{
                      ...styles.roleButton,
                      borderColor: selectedRole === item.role ? "#2563eb" : "#dbe3ef",
                      background: selectedRole === item.role ? "#eff6ff" : "#ffffff",
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={startDemoFlow} style={styles.primaryButton}>
                Start demo flow
              </button>
            </>
          )}
        </section>

        <section style={styles.devLinks}>
          <p style={styles.devTitle}>Developer quick links</p>
          <div style={styles.linkRow}>
            {quickLinks.map(([href, label]) => (
              <a key={href} href={href} style={styles.quickLink}>
                {label}
              </a>
            ))}
          </div>
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
    padding: "28px",
  },
  shell: {
    width: "min(1120px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 420px",
    gap: "24px",
    alignItems: "center",
  },
  hero: {
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    fontSize: "46px",
    lineHeight: 1.04,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "17px",
    lineHeight: 1.55,
  },
  privacyBox: {
    display: "grid",
    gap: "6px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  card: {
    border: "1px solid #dbe3ef",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "20px",
    display: "grid",
    gap: "14px",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  },
  cardLabel: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  cardTitle: {
    margin: 0,
    fontSize: "26px",
  },
  cardText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  roleGrid: {
    display: "grid",
    gap: "10px",
  },
  roleButton: {
    display: "grid",
    gap: "5px",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    color: "#0f172a",
    padding: "12px",
    textAlign: "left" as const,
    cursor: "pointer",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryLink: {
    display: "grid",
    placeItems: "center",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "11px",
    textDecoration: "none",
    fontWeight: 900,
  },
  devLinks: {
    gridColumn: "1 / -1",
    borderTop: "1px solid #dbe3ef",
    paddingTop: "14px",
  },
  devTitle: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  linkRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  quickLink: {
    border: "1px solid #dbe3ef",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#334155",
    padding: "7px 10px",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 800,
  },
};
