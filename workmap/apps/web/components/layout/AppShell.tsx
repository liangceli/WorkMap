"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getCurrentCompany } from "../../lib/api/companiesApi";
import { getCurrentUser } from "../../lib/api/authApi";
import { getWorkMapPlatformApiAuthOptions } from "../../lib/api/platformAuth";
import {
  getWorkspaceNavigationItemsForRole,
  toWorkflowRole,
  type WorkspaceNavigationItem,
} from "../../lib/navigation/workspaceNavigation";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { redirectToRootForMissingCognitoSession } from "../../lib/auth/cognitoRedirect";
import { clearCognitoSession, getCognitoSession, type StoredCognitoSession } from "../../lib/auth/cognitoSession";
import { getUserSetupState, resetUserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";
import { WorkMapLoader } from "../ui/WorkMapLoader";
import { hasWarmAppShellCache } from "./appShellCache";

type AppShellProps = {
  children: ReactNode;
  variant?: "default" | "editorial";
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

type PlatformNavigationItem = {
  label: string;
  href: string;
  group: "platform";
  platformOnly: true;
};

type NavItem = WorkspaceNavigationItem | PlatformNavigationItem;

const platformNavigationItem: PlatformNavigationItem = {
  label: "Platform Admin",
  href: "/platform-admin",
  group: "platform",
  platformOnly: true,
};

const APP_SHELL_CACHE_KEY = "workmap.appShellContext";

export function AppShell({ children, variant = "default" }: AppShellProps) {
  const pathname = usePathname();
  const [cognitoSession, setCognitoSession] = useState<StoredCognitoSession | null>(null);
  const [apiSummary, setApiSummary] = useState<ApiSessionSummary | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformSessionSummary | null>(null);
  const [cachedRole, setCachedRole] = useState<WorkMapRole | null>(null);
  const [shellLoading, setShellLoading] = useState(true);
  const activeRole = apiSummary?.role ? toWorkflowRole(apiSummary.role) : cachedRole;

  useLayoutEffect(() => {
    const session = getCognitoSession();
    const cached = readAppShellCache(session?.claims.sub);
    const setup = getUserSetupState();

    setCognitoSession(session);
    setApiSummary(cached?.apiSummary ?? null);
    setPlatformSummary(cached?.platformSummary ?? null);
    setCachedRole(cached?.apiSummary?.role ? toWorkflowRole(cached.apiSummary.role) : setup?.role ?? null);
    if (hasWarmAppShellCache(cached)) {
      setShellLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getCognitoSession();

    let cancelled = false;

    async function loadApiSummary() {
      const [platformAuth, auth] = await Promise.all([
        pathname === "/platform-admin" ? getWorkMapPlatformApiAuthOptions() : Promise.resolve(null),
        getWorkMapApiAuthOptions(),
      ]);

      if (!cancelled && platformAuth?.available) {
        const summary: PlatformSessionSummary = {
          userName: platformAuth.context.identity.displayName,
          email: platformAuth.context.identity.email,
          platformRole: platformAuth.context.platformRole,
          source: platformAuth.source,
        };
        setPlatformSummary(summary);
        updateAppShellCache(session?.claims.sub, { platformSummary: summary });
      }

      if (!auth.available) {
        if (cancelled) return;
        if (redirectToRootForMissingCognitoSession()) {
          resetUserSetupState();
          clearAppShellCache();
          return;
        }
        setShellLoading(false);
        return;
      }
      if (!cancelled) setCognitoSession(getCognitoSession());

      const [companyResult, userResult] = await Promise.all([
        getCurrentCompany(auth.options),
        getCurrentUser(auth.options),
      ]);

      if (cancelled || !companyResult.ok || !userResult.ok) {
        if (!cancelled) setShellLoading(false);
        return;
      }

      const summary: ApiSessionSummary = {
        companyName: companyResult.data.name,
        userName: userResult.data.displayName,
        role: userResult.data.role ?? auth.source,
        source: auth.source,
      };
      setApiSummary(summary);
      setCachedRole(toWorkflowRole(summary.role));
      updateAppShellCache(session?.claims.sub, { apiSummary: summary });
      setShellLoading(false);
    }

    void loadApiSummary();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const visibleItems = useMemo(() => {
    const isPlatformAdmin = platformSummary?.platformRole === "PLATFORM_ADMIN";

    if (isPlatformAdmin && !activeRole) {
      return [platformNavigationItem];
    }

    if (!activeRole) {
      return isPlatformAdmin ? [platformNavigationItem] : [];
    }

    const workspaceItems: NavItem[] = getWorkspaceNavigationItemsForRole(activeRole);
    return isPlatformAdmin ? [...workspaceItems, platformNavigationItem] : workspaceItems;
  }, [activeRole, platformSummary?.platformRole]);

  const roleLabel = platformSummary
    ? "Platform Admin"
    : apiSummary?.role
      ? formatRole(apiSummary.role)
      : activeRole
      ? formatRole(activeRole)
      : "Workspace member";
  const contextLabel = platformSummary
    ? "Platform context"
    : apiSummary?.companyName
        ? apiSummary.companyName
        : cognitoSession
          ? "Workspace mapping pending"
          : "Workspace context";

  const logout = async () => {
    try {
      const { signOutCognitoAccount } = await import("../../lib/auth/cognitoUserPoolAuth");
      await signOutCognitoAccount();
    } catch {
      clearCognitoSession();
    }

    resetUserSetupState();
    clearAppShellCache();
    setCognitoSession(null);
    setApiSummary(null);
    setPlatformSummary(null);
    redirectToRootForMissingCognitoSession();
  };

  if (shellLoading) {
    return <WorkMapLoader fullPage label="Opening your workspace" />;
  }

  return (
    <main className={`wm-app-shell${variant === "editorial" ? " wm-app-shell-editorial" : ""}`} style={styles.page}>
      <header className="wm-app-top-nav" style={styles.topNav}>
        <Link href="/" className="wm-app-brand" style={styles.brand}>
          <span style={styles.logo}>WM</span>
          <span>
            <strong style={styles.brandTitle}>WorkMap</strong>
            <span style={styles.brandSub}>{contextLabel}</span>
          </span>
        </Link>

        <nav className="wm-app-nav-links" style={styles.navLinks} aria-label="WorkMap navigation">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              className="wm-app-nav-link"
              href={item.href}
              aria-current={isActiveNav(pathname, item.href) ? "page" : undefined}
              style={{
                ...styles.navLink,
                ...(isActiveNav(pathname, item.href) ? styles.navLinkActive : {}),
                ...("platformOnly" in item ? styles.platformNavLink : {}),
              }}
            >
              <span style={styles.navGroupLabel}>{formatNavGroup(item.group)}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="wm-app-session-wrap" style={styles.sessionWrap}>
          <div style={{ ...styles.rolePill, ...(platformSummary ? styles.platformRolePill : {}) }}>
            <span style={styles.roleDot} />
            {roleLabel}
          </div>
          {cognitoSession ? (
            <button
              type="button"
              style={styles.logoutButton}
              onClick={() => void logout()}
            >
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <section className="wm-app-content" style={styles.content}>{children}</section>
    </main>
  );
}

type CachedAppShellContext = {
  cognitoSub: string;
  apiSummary?: ApiSessionSummary;
  platformSummary?: PlatformSessionSummary;
};

function readAppShellCache(cognitoSub?: string): CachedAppShellContext | null {
  if (!cognitoSub || typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(APP_SHELL_CACHE_KEY) ?? "null") as CachedAppShellContext | null;
    return parsed?.cognitoSub === cognitoSub ? parsed : null;
  } catch {
    return null;
  }
}

function updateAppShellCache(cognitoSub: string | undefined, update: Partial<Omit<CachedAppShellContext, "cognitoSub">>) {
  if (!cognitoSub || typeof window === "undefined") {
    return;
  }

  const current = readAppShellCache(cognitoSub);
  window.localStorage.setItem(APP_SHELL_CACHE_KEY, JSON.stringify({ cognitoSub, ...current, ...update }));
}

function clearAppShellCache() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(APP_SHELL_CACHE_KEY);
  }
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
