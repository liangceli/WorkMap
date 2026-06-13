"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPilotSession, getAuthContext, getCurrentUser } from "../../lib/api/authApi";
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
  type StoredCognitoSession,
} from "../../lib/auth/cognitoSession";
import { getPendingInviteToken } from "../../lib/auth/pendingInvite";
import { clearPilotSession, getPilotSession, savePilotSession, toWorkflowRole, type StoredPilotSession } from "../../lib/auth/pilotSession";
import {
  getDefaultSetupState,
  getNextRouteForUser,
  resetUserSetupState,
  saveUserSetupState,
  type WorkMapRole,
} from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

const pilotUsers: Array<{ label: string; email: string; role: WorkMapRole }> = [
  { label: "Employee / Ethan Engineer", email: "engineer@workmap.demo", role: "EMPLOYEE" },
  { label: "Manager / Mia Manager", email: "manager@workmap.demo", role: "MANAGER" },
  { label: "Owner / Olivia Owner", email: "owner@workmap.demo", role: "OWNER" },
  { label: "IT Admin / Isaac IT Admin", email: "it.admin@workmap.demo", role: "IT_ADMIN" },
];

export function MockLoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("engineer@workmap.demo");
  const [password, setPassword] = useState("workmap-pilot");
  const [companySlug, setCompanySlug] = useState("workmap-demo-company");
  const [role, setRole] = useState<WorkMapRole>("MANAGER");
  const [session, setSession] = useState<StoredPilotSession | null>(null);
  const [cognitoSession, setCognitoSession] = useState<StoredCognitoSession | null>(null);
  const [cognitoConfig, setCognitoConfig] = useState<ReturnType<typeof getCognitoConfigStatus> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cognitoSubmitting, setCognitoSubmitting] = useState(false);

  useEffect(() => {
    setSession(getPilotSession());
    setCognitoSession(getCognitoSession());
    setCognitoConfig(getCognitoConfigStatus());
  }, []);

  const loginCognito = async () => {
    setCognitoSubmitting(true);
    setStatus(null);

    try {
      await startCognitoSignIn();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cognito sign-in could not be started.");
      setCognitoSubmitting(false);
    }
  };

  const loginPilot = async () => {
    setSubmitting(true);
    setStatus(null);

    const result = await createPilotSession({ email, password, companySlug });
    setSubmitting(false);

    if (!result.ok) {
      setStatus("Pilot login failed. Check the API is running and the password hash is configured.");
      return;
    }

    savePilotSession(result.data);
    setSession(result.data);
    const nextState = { ...getDefaultSetupState(toWorkflowRole(result.data.user.role)), hasCompany: true };
    router.push(getNextRouteForUser(nextState));
  };

  const continueCognito = async () => {
    const cognitoAuth = getCognitoApiAuthOptions();

    if (!cognitoAuth.available) {
      setStatus(cognitoAuth.reason);
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

  const continueDemo = () => {
    const state = getDefaultSetupState(role);
    saveUserSetupState(state);
    router.push(getNextRouteForUser(state));
  };

  const logout = () => {
    clearCognitoSession();
    clearPilotSession();
    resetUserSetupState();
    setCognitoSession(null);
    setSession(null);
    setStatus("Auth sessions cleared on this browser.");
  };

  const cognitoLogoutUrl = getCognitoLogoutUrl();
  const cognitoMissing = cognitoConfig && !cognitoConfig.configured ? cognitoConfig.missing.join(", ") : "";

  return (
    <section style={styles.card}>
      <p style={styles.eyebrow}>WorkMap sign-in</p>
      <h1 style={styles.title}>Sign in to WorkMap</h1>
      <p style={styles.subtitle}>
        Use Cognito for deployed alpha testing, or pilot auth for local fallback while the workspace is being configured.
      </p>

      <section style={styles.cognitoBox}>
        <p style={styles.demoTitle}>Cognito workspace login</p>
        {cognitoSession ? (
          <section style={styles.sessionCard}>
            <strong>{cognitoSession.claims.displayName ?? cognitoSession.claims.email ?? "Cognito user"}</strong>
            <span>{cognitoSession.claims.email ?? cognitoSession.claims.sub}</span>
            <span>expires {new Date(cognitoSession.expiresAt).toLocaleString()}</span>
            <div style={styles.sessionActions}>
              <button type="button" onClick={continueCognito} style={styles.secondaryButton}>
                Continue
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
        {cognitoConfig?.configured ? (
          <button type="button" onClick={loginCognito} disabled={cognitoSubmitting} style={styles.primaryAction}>
            {cognitoSubmitting ? "Opening Cognito..." : "Sign in with Cognito"}
          </button>
        ) : (
          <p style={styles.note}>
            Cognito is not configured in this environment. Missing public config: {cognitoMissing || "checking"}.
          </p>
        )}
        <p style={styles.note}>
          This path uses Cognito Hosted UI with PKCE and backend-verified WorkMap user or platform mapping.
        </p>
      </section>

      {session ? (
        <section style={styles.sessionCard}>
          <strong>{session.user.displayName}</strong>
          <span>{session.user.email}</span>
          <span>{session.user.role.replace("_", " ")} / expires {new Date(session.expiresAt).toLocaleString()}</span>
          <div style={styles.sessionActions}>
            <button type="button" onClick={() => router.push("/virtual-office")} style={styles.secondaryButton}>
              Open office
            </button>
            <button type="button" onClick={logout} style={styles.secondaryButton}>
              Clear session
            </button>
          </div>
        </section>
      ) : null}

      <label style={styles.label}>
        <span>Pilot user</span>
        <select
          value={email}
          onChange={(event) => {
            const nextEmail = event.target.value;
            setEmail(nextEmail);
            setRole(pilotUsers.find((user) => user.email === nextEmail)?.role ?? "EMPLOYEE");
          }}
          style={styles.input}
        >
          {pilotUsers.map((user) => (
            <option key={user.email} value={user.email}>{user.label}</option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} style={styles.input} />
      </label>

      <label style={styles.label}>
        <span>Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" style={styles.input} />
      </label>

      <label style={styles.label}>
        <span>Company slug</span>
        <input value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} style={styles.input} />
      </label>

      <button type="button" onClick={loginPilot} disabled={submitting} style={styles.primaryAction}>
        {submitting ? "Signing in..." : "Sign in with pilot auth"}
      </button>

      {status ? <p style={styles.status}>{status}</p> : null}

      <section style={styles.demoBox}>
        <p style={styles.demoTitle}>Frontend fallback</p>
        <label style={styles.label}>
          <span>Demo role</span>
        <select value={role} onChange={(event) => setRole(event.target.value as WorkMapRole)} style={styles.input}>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="OWNER">Owner</option>
          <option value="IT_ADMIN">IT Admin</option>
        </select>
      </label>
        <button type="button" onClick={continueDemo} style={styles.secondaryAction}>Continue without API session</button>
      </section>

      <p style={styles.note}>
        Pilot auth remains available during the transition. Dev-token fallback remains development-only; full enterprise account lifecycle is
        still staged work.
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
  demoBox: {
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
  demoTitle: {
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
};
