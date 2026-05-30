"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  saveUserSetupState,
  type WorkMapRole,
} from "../../lib/workflow/workflowState";

export function MockLoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("manager@workmap.local");
  const [role, setRole] = useState<WorkMapRole>("MANAGER");

  const continueDemo = () => {
    const state = getDefaultSetupState(role);
    saveUserSetupState(state);
    router.push(getNextRouteForUser(state));
  };

  return (
    <section style={styles.card}>
      <p style={styles.eyebrow}>Frontend mock</p>
      <h1 style={styles.title}>Sign in to WorkMap</h1>
      <p style={styles.subtitle}>
        This is a frontend-only demo sign-in. Real authentication and RBAC are not implemented yet.
      </p>

      <label style={styles.label}>
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} style={styles.input} />
      </label>

      <label style={styles.label}>
        <span>Demo role</span>
        <select value={role} onChange={(event) => setRole(event.target.value as WorkMapRole)} style={styles.input}>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="OWNER">Owner</option>
          <option value="IT_ADMIN">IT Admin</option>
        </select>
      </label>

      <button type="button" onClick={continueDemo} style={styles.primaryAction}>Continue</button>
      <a href="/onboarding/avatar" style={styles.secondaryAction}>Create avatar first</a>

      <p style={styles.note}>
        This form does not authenticate, set cookies, create sessions, or grant permissions. Backend auth must enforce the
        real role.
      </p>
    </section>
  );
}

const styles = {
  card: {
    width: "min(430px, 100%)",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "22px",
    display: "grid",
    gap: "13px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "32px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  label: {
    display: "grid",
    gap: "6px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
  },
  input: {
    height: "40px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "0 10px",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: "14px",
  },
  primaryAction: {
    display: "flex",
    justifyContent: "center",
    border: "1px solid #0f172a",
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "11px",
    textDecoration: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryAction: {
    display: "flex",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "10px",
    textDecoration: "none",
    fontWeight: 900,
  },
  note: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.45,
  },
};
