"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { clearPilotSession, getPilotSession, type StoredPilotSession } from "../../lib/auth/pilotSession";
import { getUserSetupState, resetUserSetupState, type UserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";

type AppShellProps = {
  children: ReactNode;
};

const navItems: Array<{ label: string; href: string; roles: WorkMapRole[] }> = [
  { label: "Office", href: "/virtual-office", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Dashboard", href: "/dashboard", roles: ["MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Employees", href: "/employees", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Reports", href: "/reports", roles: ["MANAGER", "OWNER"] },
  { label: "Compliance", href: "/compliance", roles: ["EMPLOYEE", "MANAGER", "OWNER"] },
  { label: "Integrations", href: "/integrations", roles: ["OWNER", "IT_ADMIN"] },
  { label: "Settings", href: "/settings", roles: ["EMPLOYEE", "OWNER", "IT_ADMIN"] },
];

export function AppShell({ children }: AppShellProps) {
  const [setupState, setSetupState] = useState<UserSetupState | null>(null);
  const [pilotSession, setPilotSession] = useState<StoredPilotSession | null>(null);

  useEffect(() => {
    setSetupState(getUserSetupState());
    setPilotSession(getPilotSession());
  }, []);

  const visibleItems = useMemo(() => {
    if (!setupState) {
      return navItems;
    }

    return navItems.filter((item) => item.roles.includes(setupState.role));
  }, [setupState]);

  return (
    <main style={styles.page}>
      <header style={styles.topNav}>
        <a href="/" style={styles.brand}>
          <span style={styles.logo}>WM</span>
          <span>
            <strong style={styles.brandTitle}>WorkMap</strong>
            <span style={styles.brandSub}>Demo workflow</span>
          </span>
        </a>

        <nav style={styles.navLinks} aria-label="WorkMap navigation">
          {visibleItems.map((item) => (
            <a key={item.href} href={item.href} style={styles.navLink}>
              {item.label}
            </a>
          ))}
        </nav>

        <div style={styles.sessionWrap}>
          <div style={styles.rolePill}>
          <span style={styles.roleDot} />
            {pilotSession ? pilotSession.user.role.replace("_", " ") : setupState ? setupState.role.replace("_", " ") : "Dev access"}
          </div>
          {pilotSession ? (
            <button
              type="button"
              style={styles.logoutButton}
              onClick={() => {
                clearPilotSession();
                resetUserSetupState();
                setPilotSession(null);
                setSetupState(null);
              }}
            >
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <section style={styles.notice}>
        <strong>{pilotSession ? "Pilot session" : "Frontend demo fallback"}</strong>
        <span>
          {pilotSession
            ? `${pilotSession.user.displayName} is using a backend bearer token. Role boundaries are enforced by API guards where implemented.`
            : "Navigation visibility is for workflow testing only. Sign in on /login for a backend-issued pilot token."}
        </span>
      </section>

      <section style={styles.content}>{children}</section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "24px",
  },
  topNav: {
    maxWidth: "1440px",
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.xl,
    background: wm.colors.surface,
    padding: "12px 16px",
    boxShadow: wm.shadow.card,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: wm.colors.text,
    textDecoration: "none",
    minWidth: "190px",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    background: wm.colors.primary,
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 900,
  },
  brandTitle: {
    display: "block",
    fontSize: "15px",
    color: wm.colors.text,
  },
  brandSub: {
    display: "block",
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 600,
  },
  navLinks: {
    display: "flex",
    justifyContent: "center",
    flex: 1,
    gap: "6px",
    flexWrap: "wrap" as const,
  },
  navLink: {
    borderRadius: wm.radius.md,
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 650,
  },
  rolePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: wm.colors.surfaceLow,
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    minWidth: "120px",
    justifyContent: "center",
  },
  sessionWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  logoutButton: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: wm.colors.surface,
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
  },
  roleDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#22c55e",
  },
  notice: {
    maxWidth: "1440px",
    margin: "0 auto 16px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    ...wmStyles.infoNotice,
    padding: "12px 16px",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  content: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
};
