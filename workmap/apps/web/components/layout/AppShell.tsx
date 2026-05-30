"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getUserSetupState, type UserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";

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

  useEffect(() => {
    setSetupState(getUserSetupState());
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

        <div style={styles.rolePill}>
          <span style={styles.roleDot} />
          {setupState ? setupState.role.replace("_", " ") : "Dev access"}
        </div>
      </header>

      <section style={styles.notice}>
        <strong>Frontend-only demo</strong>
        <span>
          Navigation visibility is for workflow testing only. Real authentication, RBAC, and tenant permissions must be enforced by the backend.
        </span>
      </section>

      <section style={styles.content}>{children}</section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f7fb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "18px 24px 24px",
  },
  topNav: {
    maxWidth: "1440px",
    margin: "0 auto 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    border: "1px solid #dbe3ef",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "12px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#0f172a",
    textDecoration: "none",
    minWidth: "190px",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    background: "#25346f",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 900,
  },
  brandTitle: {
    display: "block",
    fontSize: "15px",
  },
  brandSub: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },
  navLinks: {
    display: "flex",
    justifyContent: "center",
    flex: 1,
    gap: "6px",
    flexWrap: "wrap" as const,
  },
  navLink: {
    borderRadius: "8px",
    color: "#334155",
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 850,
  },
  rolePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    background: "#f8fafc",
    color: "#334155",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 900,
    minWidth: "120px",
    justifyContent: "center",
  },
  roleDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#22c55e",
  },
  notice: {
    maxWidth: "1440px",
    margin: "0 auto 14px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "10px 12px",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  content: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
};
