"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getCurrentCompany } from "../../lib/api/companiesApi";
import { getCurrentUser } from "../../lib/api/authApi";
import { getWorkMapPlatformApiAuthOptions } from "../../lib/api/platformAuth";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { clearCognitoSession, getCognitoSession, type StoredCognitoSession } from "../../lib/auth/cognitoSession";
import { clearPilotSession, getPilotSession, toWorkflowRole, type StoredPilotSession } from "../../lib/auth/pilotSession";
import { getUserSetupState, resetUserSetupState, type UserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";

type AppShellProps = {
  children: ReactNode;
};

type ApiSessionSummary = {
  companyName: string;
  userName: string;
  role: string;
  source: string;
};

type PlatformSessionSummary = {
  userName: string;
  email: string;
  platformRole: "PLATFORM_ADMIN";
  source: string;
};

type NavItem = {
  label: string;
  href: string;
  roles?: WorkMapRole[];
  platformOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Office", href: "/virtual-office", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Dashboard", href: "/dashboard", roles: ["MANAGER", "OWNER"] },
  { label: "Employees", href: "/employees", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Reports", href: "/reports", roles: ["MANAGER", "OWNER"] },
  { label: "Compliance", href: "/compliance", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Invites", href: "/onboarding/invite", roles: ["OWNER"] },
  { label: "Integrations", href: "/integrations", roles: ["OWNER", "IT_ADMIN"] },
  { label: "Settings", href: "/settings", roles: ["OWNER", "IT_ADMIN"] },
  { label: "Platform Admin", href: "/platform-admin", platformOnly: true },
];

export function AppShell({ children }: AppShellProps) {
  const [setupState, setSetupState] = useState<UserSetupState | null>(null);
  const [cognitoSession, setCognitoSession] = useState<StoredCognitoSession | null>(null);
  const [pilotSession, setPilotSession] = useState<StoredPilotSession | null>(null);
  const [apiSummary, setApiSummary] = useState<ApiSessionSummary | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformSessionSummary | null>(null);
  const activeRole = cognitoSession ? setupState?.role ?? null : pilotSession ? toWorkflowRole(pilotSession.user.role) : setupState?.role ?? null;

  useEffect(() => {
    setSetupState(getUserSetupState());
    setCognitoSession(getCognitoSession());
    setPilotSession(getPilotSession());

    let cancelled = false;

    async function loadApiSummary() {
      const platformAuth = await getWorkMapPlatformApiAuthOptions();

      if (!cancelled && platformAuth.available) {
        setPlatformSummary({
          userName: platformAuth.context.identity.displayName,
          email: platformAuth.context.identity.email,
          platformRole: platformAuth.context.platformRole,
          source: platformAuth.source,
        });
      }

      const auth = await getWorkMapApiAuthOptions();

      if (!auth.available) {
        return;
      }

      const [companyResult, userResult] = await Promise.all([
        getCurrentCompany(auth.options),
        getCurrentUser(auth.options),
      ]);

      if (cancelled || !companyResult.ok || !userResult.ok) {
        return;
      }

      setApiSummary({
        companyName: companyResult.data.name,
        userName: userResult.data.displayName,
        role: userResult.data.role ?? auth.source,
        source: auth.source,
      });
    }

    void loadApiSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const isPlatformAdmin = platformSummary?.platformRole === "PLATFORM_ADMIN";

    if (isPlatformAdmin && !activeRole) {
      return navItems.filter((item) => item.platformOnly);
    }

    if (!activeRole) {
      return navItems.filter(
        (item) => ["/virtual-office", "/compliance", "/settings"].includes(item.href) || (item.platformOnly && isPlatformAdmin),
      );
    }

    return navItems.filter((item) => (item.platformOnly ? isPlatformAdmin : item.roles?.includes(activeRole)));
  }, [activeRole, platformSummary?.platformRole]);

  const roleLabel = platformSummary
    ? "Platform Admin"
    : cognitoSession
    ? apiSummary?.role
      ? `Cognito / ${formatRole(apiSummary.role)}`
      : activeRole
      ? `Cognito / ${formatRole(activeRole)}`
      : "Cognito / mapping"
    : apiSummary?.role
      ? formatRole(apiSummary.role)
      : pilotSession
      ? formatRole(pilotSession.user.role)
      : activeRole
        ? formatRole(activeRole)
        : "Sign in needed";
  const sessionSource = platformSummary
    ? "Platform admin session"
    : cognitoSession
    ? "Cognito session"
    : pilotSession
    ? "Pilot session"
    : activeRole
    ? "Frontend demo fallback"
    : "No session";

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
            {roleLabel}
          </div>
          {cognitoSession || pilotSession ? (
            <button
              type="button"
              style={styles.logoutButton}
              onClick={() => {
                clearCognitoSession();
                clearPilotSession();
                resetUserSetupState();
                setCognitoSession(null);
                setPilotSession(null);
                setSetupState(null);
                setApiSummary(null);
                setPlatformSummary(null);
              }}
            >
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <section style={styles.notice}>
        <strong>{sessionSource}</strong>
        <span>
          {platformSummary
            ? `${platformSummary.userName} (${platformSummary.email}) has platform admin access via ${platformSummary.source}. Tenant data shown here is privacy-safe metadata only.`
            : cognitoSession
            ? apiSummary
              ? `${apiSummary.userName} is in ${apiSummary.companyName} as ${formatRole(apiSummary.role)} via ${apiSummary.source}.`
              : `${cognitoSession.claims.email ?? cognitoSession.claims.sub} is using a Cognito bearer token. WorkMap user/company/role mapping is resolved by the backend.`
            : pilotSession
            ? apiSummary
              ? `${apiSummary.userName} is in ${apiSummary.companyName} as ${formatRole(apiSummary.role)} via ${apiSummary.source}.`
              : `${pilotSession.user.displayName} is using a backend bearer token. Core role boundaries are enforced by the API.`
            : activeRole
              ? "Navigation visibility is for workflow testing only. Sign in on /login for a backend-issued pilot token."
              : "Sign in before QA so API requests use the intended backend-issued user context."}
        </span>
        {!cognitoSession && !pilotSession ? (
          <a href="/login" style={styles.noticeLink}>
            Sign in
          </a>
        ) : null}
      </section>

      <section style={styles.content}>{children}</section>
    </main>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, " ");
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
  noticeLink: {
    marginLeft: "auto",
    color: wm.colors.infoText,
    fontSize: "13px",
    fontWeight: 900,
    textDecoration: "underline",
    whiteSpace: "nowrap" as const,
  },
  content: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
};
