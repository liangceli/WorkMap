"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  group: "workspace" | "insight" | "admin" | "platform";
  roles?: WorkMapRole[];
  platformOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Office", href: "/virtual-office", group: "workspace", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Employees", href: "/employees", group: "workspace", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Dashboard", href: "/dashboard", group: "insight", roles: ["MANAGER", "OWNER"] },
  { label: "Reports", href: "/reports", group: "insight", roles: ["MANAGER", "OWNER"] },
  { label: "Compliance", href: "/compliance", group: "insight", roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"] },
  { label: "Invites", href: "/onboarding/invite", group: "admin", roles: ["OWNER"] },
  { label: "Integrations", href: "/integrations", group: "admin", roles: ["OWNER", "IT_ADMIN"] },
  { label: "Settings", href: "/settings", group: "admin", roles: ["OWNER", "IT_ADMIN"] },
  { label: "Platform Admin", href: "/platform-admin", group: "platform", platformOnly: true },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
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
      return navItems.filter((item) => item.platformOnly && isPlatformAdmin);
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

  const contextLabel = platformSummary
    ? "Platform context"
    : apiSummary?.companyName
      ? apiSummary.companyName
      : cognitoSession
        ? "Workspace mapping pending"
        : pilotSession
          ? pilotSession.user.companySlug
          : "No workspace session";

  return (
    <main className="wm-app-shell" style={styles.page}>
      <header className="wm-app-top-nav" style={styles.topNav}>
        <a href="/" className="wm-app-brand" style={styles.brand}>
          <span style={styles.logo}>WM</span>
          <span>
            <strong style={styles.brandTitle}>WorkMap</strong>
            <span style={styles.brandSub}>{contextLabel}</span>
          </span>
        </a>

        <nav className="wm-app-nav-links" style={styles.navLinks} aria-label="WorkMap navigation">
          {visibleItems.map((item) => (
            <a
              key={item.href}
              className="wm-app-nav-link"
              href={item.href}
              style={{
                ...styles.navLink,
                ...(isActiveNav(pathname, item.href) ? styles.navLinkActive : {}),
                ...(item.platformOnly ? styles.platformNavLink : {}),
              }}
            >
              <span style={styles.navGroupLabel}>{formatNavGroup(item.group)}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="wm-app-session-wrap" style={styles.sessionWrap}>
          <div style={{ ...styles.rolePill, ...(platformSummary ? styles.platformRolePill : {}) }}>
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

      <section className="wm-app-notice" style={styles.notice}>
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
              : "Sign in before using shared workspace data so API requests use the intended backend-issued user context."}
        </span>
        {!cognitoSession && !pilotSession ? (
          <a href="/login" style={styles.noticeLink}>
            Sign in
          </a>
        ) : null}
      </section>

      <section className="wm-app-content" style={styles.content}>{children}</section>
    </main>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

function isActiveNav(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function formatNavGroup(group: NavItem["group"]) {
  if (group === "insight") {
    return "Insights";
  }

  if (group === "admin") {
    return "Admin";
  }

  if (group === "platform") {
    return "Platform";
  }

  return "Workspace";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  topNav: {
    maxWidth: "1440px",
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: "16px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.xl,
    background: "rgba(255, 253, 248, 0.88)",
    padding: "12px 16px",
    boxShadow: wm.shadow.card,
    backdropFilter: "blur(18px)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: wm.colors.text,
    textDecoration: "none",
    minWidth: "190px",
    alignSelf: "center",
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
    boxShadow: "0 10px 24px rgba(16, 35, 63, 0.16)",
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
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  navLink: {
    display: "grid",
    gap: "2px",
    minWidth: "82px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: wm.radius.md,
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 800,
  },
  navLinkActive: {
    borderColor: "rgba(31, 122, 120, 0.28)",
    background: "rgba(31, 122, 120, 0.1)",
    color: wm.colors.primary,
  },
  platformNavLink: {
    borderColor: wm.colors.complianceBorder,
    background: wm.colors.complianceBg,
    color: wm.colors.compliance,
  },
  navGroupLabel: {
    color: wm.colors.textMuted,
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
    lineHeight: 1,
  },
  rolePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(244, 248, 244, 0.9)",
    color: wm.colors.textSecondary,
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 700,
    minWidth: "120px",
    justifyContent: "center",
  },
  platformRolePill: {
    borderColor: wm.colors.complianceBorder,
    background: wm.colors.complianceBg,
    color: wm.colors.compliance,
  },
  sessionWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    alignSelf: "center",
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
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
    background: wm.status.available,
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
