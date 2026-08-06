"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuthContext, getCurrentUser } from "../../lib/api/authApi";
import { getPlatformContext } from "../../lib/api/platformApi";
import { decodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../lib/avatar/avatarStorage";
import { restoreCognitoAccountSession, signOutCognitoAccount } from "../../lib/auth/cognitoUserPoolAuth";
import {
  clearCognitoSession,
  getCognitoSession,
  getCognitoUserPoolConfigStatus,
  type StoredCognitoSession,
} from "../../lib/auth/cognitoSession";
import { getPendingInviteToken } from "../../lib/auth/pendingInvite";
import { getRequestedPostLoginPath } from "../../lib/auth/cognitoRedirect";
import { isConfirmedWorkspaceMissing, workspaceAccessError } from "../../lib/auth/workspaceAccess";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  resetUserSetupState,
  saveUserSetupState,
  type WorkMapRole,
} from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { CognitoAuthForm } from "./CognitoAuthForm";

export function CognitoLoginPanel() {
  const router = useRouter();
  const [cognitoSession, setCognitoSession] = useState<StoredCognitoSession | null>(null);
  const [cognitoConfig, setCognitoConfig] = useState<ReturnType<typeof getCognitoUserPoolConfigStatus> | null>(null);
  const [initialMode, setInitialMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    const storedSession = getCognitoSession();
    setCognitoSession(storedSession);
    setCognitoConfig(getCognitoUserPoolConfigStatus());
    setInitialMode(new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin");

    if (!storedSession) {
      void restoreCognitoAccountSession().then((restoredSession) => {
        if (restoredSession) {
          setCognitoSession(restoredSession);
        }
      });
    }
  }, []);

  const continueCognito = async (session: StoredCognitoSession) => {
    setContinuing(true);
    setStatus("Checking your CandidGrid access...");
    const options = { token: session.idToken || session.accessToken, authSource: "cognito" as const };
    const inviteToken = getPendingInviteToken();
    const requestedPath = getRequestedPostLoginPath();
    const contextResult = await getAuthContext(options);

    if (contextResult.ok) {
      const defaultState = getDefaultSetupState(toWorkflowRole(contextResult.data.role));
      const currentUserResult = await getCurrentUser(options);
      if (!currentUserResult.ok) {
        setStatus(workspaceAccessError(currentUserResult));
        setContinuing(false);
        return;
      }
      const backendAvatar = decodeLayeredAvatarId(currentUserResult.data.avatarId);

      if (backendAvatar) {
        saveLayeredAvatarConfig(backendAvatar);
      }

      const nextState = { ...defaultState, hasCompany: true, hasAvatar: Boolean(backendAvatar) || defaultState.hasAvatar };
      saveUserSetupState(nextState);
      router.push(
        contextResult.data.role === "OWNER" && !backendAvatar
          ? "/onboarding/avatar"
          : requestedPath ?? getNextRouteForUser(nextState),
      );
      return;
    }

    if (inviteToken) {
      router.push(`/invite/${encodeURIComponent(inviteToken)}`);
      return;
    }

    const platformContextResult = await getPlatformContext(options);
    if (platformContextResult.ok) {
      router.push("/platform-admin");
      return;
    }

    if (isConfirmedWorkspaceMissing(contextResult)) {
      router.push("/onboarding/company");
      return;
    }

    setStatus(workspaceAccessError(contextResult));
    setContinuing(false);
  };

  const handleAuthenticated = async (session: StoredCognitoSession) => {
    setCognitoSession(session);
    await continueCognito(session);
  };

  const logout = async () => {
    setContinuing(true);

    try {
      await signOutCognitoAccount();
    } catch {
      clearCognitoSession();
    }

    resetUserSetupState();
    setCognitoSession(null);
    setContinuing(false);
    setStatus("Signed out on this browser.");
  };

  const cognitoMissing = cognitoConfig && !cognitoConfig.configured ? cognitoConfig.missing.join(", ") : "";
  const canUseCognito = Boolean(cognitoConfig?.configured);

  return (
    <section className="wm-login-card" style={styles.card}>
      {cognitoSession ? (
        <section style={styles.sessionPanel}>
          <div style={styles.sessionHeading}>
            <div>
              <p style={styles.eyebrow}>Active Cognito session</p>
              <h1 style={styles.title}>{cognitoSession.claims.displayName ?? cognitoSession.claims.email ?? "Cognito user"}</h1>
            </div>
            <button type="button" onClick={logout} disabled={continuing} aria-label="Sign out" title="Sign out" style={styles.iconButton}>
              <LogOut size={18} />
            </button>
          </div>
          <p style={styles.subtitle}>{cognitoSession.claims.email ?? cognitoSession.claims.sub}</p>
          <button type="button" onClick={() => continueCognito(cognitoSession)} disabled={continuing} style={styles.primaryAction}>
            {continuing ? "Checking access..." : "Continue to CandidGrid"}
          </button>
        </section>
      ) : canUseCognito ? (
        <CognitoAuthForm initialMode={initialMode} accountContext="owner" onAuthenticated={handleAuthenticated} />
      ) : (
        <section style={styles.missingPanel}>
          <p style={styles.eyebrow}>Cognito setup required</p>
          <h1 style={styles.title}>Authentication is unavailable</h1>
          <p style={styles.subtitle}>Missing public config: {cognitoMissing || "checking"}.</p>
        </section>
      )}

      {status ? <p aria-live="polite" style={styles.status}>{status}</p> : null}

      <p style={styles.note}>
        CandidGrid uses Cognito for account creation, email confirmation, password recovery, and sign-in. Workspace role and company access are resolved by the backend.
      </p>
    </section>
  );
}

function toWorkflowRole(role: string | undefined): WorkMapRole {
  if (role === "OWNER") {
    return "OWNER";
  }

  if (role === "MANAGER" || role === "TEAM_LEAD" || role === "HR_ADMIN") {
    return "MANAGER";
  }

  if (role === "IT_ADMIN") {
    return "IT_ADMIN";
  }

  return "EMPLOYEE";
}

const styles = {
  card: {
    ...wmStyles.elevatedCard,
    width: "min(450px, 100%)",
    minWidth: 0,
    boxSizing: "border-box" as const,
    padding: "24px",
    display: "grid",
    gap: "16px",
  },
  sessionPanel: {
    display: "grid",
    gap: "12px",
  },
  sessionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "12px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: "0 0 5px",
  },
  title: {
    margin: 0,
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "26px",
    lineHeight: 1.2,
    fontWeight: 750,
  },
  subtitle: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.5,
    overflowWrap: "anywhere" as const,
  },
  primaryAction: {
    ...wmStyles.primaryButton,
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
  },
  iconButton: {
    width: "40px",
    height: "40px",
    flex: "0 0 40px",
    display: "grid",
    placeItems: "center",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surface,
    color: wm.colors.textSecondary,
    cursor: "pointer",
  },
  missingPanel: {
    display: "grid",
    gap: "8px",
  },
  status: {
    margin: 0,
    border: `1px solid ${wm.colors.infoBorder}`,
    borderRadius: wm.radius.md,
    background: wm.colors.infoBg,
    color: wm.colors.infoText,
    padding: "10px 11px",
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 650,
  },
  note: {
    margin: 0,
    paddingTop: "12px",
    borderTop: `1px solid ${wm.colors.borderSubtle}`,
    color: wm.colors.textMuted,
    fontSize: "11px",
    lineHeight: 1.5,
  },
};
