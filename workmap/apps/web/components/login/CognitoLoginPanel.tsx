"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthContext, getCurrentUser } from "../../lib/api/authApi";
import { getPlatformContext } from "../../lib/api/platformApi";
import { decodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../lib/avatar/avatarStorage";
import {
  clearCognitoSession,
  getCognitoApiAuthOptions,
  getCognitoConfigStatus,
  getCognitoLogoutUrl,
  getCognitoSession,
  startCognitoSignIn,
  startCognitoSignUp,
  type StoredCognitoSession,
} from "../../lib/auth/cognitoSession";
import { getPendingInviteToken } from "../../lib/auth/pendingInvite";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  resetUserSetupState,
  saveUserSetupState,
  type WorkMapRole,
} from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export function CognitoLoginPanel() {
  const router = useRouter();
  const [cognitoSession, setCognitoSession] = useState<StoredCognitoSession | null>(null);
  const [cognitoConfig, setCognitoConfig] = useState<ReturnType<typeof getCognitoConfigStatus> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"signin" | "signup" | "continue" | null>(null);

  useEffect(() => {
    setCognitoSession(getCognitoSession());
    setCognitoConfig(getCognitoConfigStatus());
  }, []);

  const startSignIn = async () => {
    setSubmittingAction("signin");
    setStatus(null);

    try {
      await startCognitoSignIn();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cognito sign-in could not be started.");
      setSubmittingAction(null);
    }
  };

  const startOwnerSignUp = async () => {
    setSubmittingAction("signup");
    setStatus(null);

    try {
      await startCognitoSignUp();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cognito sign-up could not be started.");
      setSubmittingAction(null);
    }
  };

  const continueCognito = async () => {
    setSubmittingAction("continue");
    const cognitoAuth = getCognitoApiAuthOptions();

    if (!cognitoAuth.available) {
      setStatus(cognitoAuth.reason);
      setSubmittingAction(null);
      return;
    }

    const inviteToken = getPendingInviteToken();
    const platformContextResult = await getPlatformContext(cognitoAuth.options);

    if (!inviteToken && platformContextResult.ok) {
      router.push("/platform-admin");
      return;
    }

    const contextResult = await getAuthContext(cognitoAuth.options);

    if (contextResult.ok) {
      const defaultState = getDefaultSetupState(toWorkflowRole(contextResult.data.role));
      const currentUserResult = await getCurrentUser(cognitoAuth.options);
      const backendAvatar = currentUserResult.ok ? decodeLayeredAvatarId(currentUserResult.data.avatarId) : null;

      if (backendAvatar) {
        saveLayeredAvatarConfig(backendAvatar);
      }

      const nextState = { ...defaultState, hasCompany: true, hasAvatar: Boolean(backendAvatar) || defaultState.hasAvatar };
      saveUserSetupState(nextState);
      router.push(contextResult.data.role === "OWNER" && !backendAvatar ? "/onboarding/avatar" : getNextRouteForUser(nextState));
      return;
    }

    router.push(inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/onboarding/company");
  };

  const logout = () => {
    clearCognitoSession();
    resetUserSetupState();
    setCognitoSession(null);
    setStatus("Cognito session cleared on this browser.");
  };

  const cognitoLogoutUrl = getCognitoLogoutUrl();
  const cognitoMissing = cognitoConfig && !cognitoConfig.configured ? cognitoConfig.missing.join(", ") : "";
  const canUseCognito = Boolean(cognitoConfig?.configured);

  return (
    <section style={styles.card}>
      <p style={styles.eyebrow}>WorkMap sign-in</p>
      <h1 style={styles.title}>Enter with Cognito</h1>
      <p style={styles.subtitle}>
        New workspaces start with an Owner account. Employees join through an Owner invitation, then return here to sign in.
      </p>

      <section style={styles.cognitoBox}>
        <p style={styles.sectionTitle}>Cognito workspace access</p>
        {cognitoSession ? (
          <section style={styles.sessionCard}>
            <strong>{cognitoSession.claims.displayName ?? cognitoSession.claims.email ?? "Cognito user"}</strong>
            <span>{cognitoSession.claims.email ?? cognitoSession.claims.sub}</span>
            <span>expires {new Date(cognitoSession.expiresAt).toLocaleString()}</span>
            <div style={styles.sessionActions}>
              <button type="button" onClick={continueCognito} style={styles.secondaryButton}>
                {submittingAction === "continue" ? "Checking..." : "Continue"}
              </button>
              {cognitoLogoutUrl ? (
                <a href={cognitoLogoutUrl} onClick={logout} style={styles.secondaryButton}>
                  Sign out
                </a>
              ) : (
                <button type="button" onClick={logout} style={styles.secondaryButton}>
                  Clear session
                </button>
              )}
            </div>
          </section>
        ) : null}
        {canUseCognito ? (
          <div style={styles.actionGrid}>
            <button type="button" onClick={startOwnerSignUp} disabled={Boolean(submittingAction)} style={styles.primaryAction}>
              {submittingAction === "signup" ? "Opening Cognito..." : "Create Owner account"}
            </button>
            <button type="button" onClick={startSignIn} disabled={Boolean(submittingAction)} style={styles.secondaryAction}>
              {submittingAction === "signin" ? "Opening Cognito..." : "Sign in"}
            </button>
          </div>
        ) : (
          <p style={styles.note}>
            Cognito must be configured before WorkMap sign-up or sign-in can run. Missing public config: {cognitoMissing || "checking"}.
          </p>
        )}
        <p style={styles.note}>
          WorkMap uses Cognito Hosted UI with PKCE. Workspace role, company, and invite state are resolved by the backend.
        </p>
      </section>

      {status ? <p style={styles.status}>{status}</p> : null}

      <section style={styles.flowBox}>
        <p style={styles.sectionTitle}>Entry rules</p>
        <ol style={styles.stepList}>
          <li>Owner creates a Cognito account first and creates the workspace.</li>
          <li>Owner invites employees from the workspace.</li>
          <li>Employees open the invite link, sign up with Cognito, accept the invite, then complete onboarding.</li>
          <li>Returning Owner or Employee users sign in here and WorkMap resolves their backend role.</li>
        </ol>
      </section>
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
  secondaryButton: {
    ...wmStyles.secondaryButton,
    display: "flex",
    justifyContent: "center",
    padding: "9px 10px",
  },
  sessionCard: {
    display: "grid",
    gap: "5px",
    border: `1px solid ${wm.colors.successBorder}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.successBg,
    color: wm.colors.compliance,
    padding: "12px",
    fontSize: "13px",
  },
  sessionActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "8px",
    marginTop: "6px",
  },
  flowBox: {
    display: "grid",
    gap: "10px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surfaceLow,
    padding: "12px",
  },
  cognitoBox: {
    display: "grid",
    gap: "10px",
    border: `1px solid ${wm.colors.infoBorder}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.infoBg,
    padding: "12px",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },
  sectionTitle: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  status: {
    margin: 0,
    color: wm.colors.errorText,
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 800,
  },
  note: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "12px",
    lineHeight: 1.45,
  },
  stepList: {
    margin: 0,
    paddingLeft: "20px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.55,
  },
};
