"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  saveUserSetupState,
  type WorkMapRole,
} from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

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
    ...wmStyles.elevatedCard,
    width: "min(430px, 100%)",
    padding: "22px",
    display: "grid",
    gap: "13px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: 0,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "32px",
    lineHeight: 1.1,
    fontWeight: 700,
  },
  subtitle: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  label: {
    display: "grid",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 700,
  },
  input: {
    ...wmStyles.input,
    height: "40px",
    padding: "0 10px",
  },
  primaryAction: {
    ...wmStyles.primaryButton,
    display: "flex",
    justifyContent: "center",
    padding: "11px",
  },
  secondaryAction: {
    ...wmStyles.secondaryButton,
    display: "flex",
    justifyContent: "center",
    padding: "10px",
  },
  note: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "12px",
    lineHeight: 1.45,
  },
};
