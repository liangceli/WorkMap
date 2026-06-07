"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { acceptInvitation } from "../../../lib/api/invitationsApi";
import { getCognitoApiAuthOptions, startCognitoSignIn } from "../../../lib/auth/cognitoSession";
import { clearPendingInviteToken, savePendingInviteToken } from "../../../lib/auth/pendingInvite";
import { toWorkflowRole } from "../../../lib/auth/pilotSession";
import { getDefaultSetupState, getNextRouteForUser, saveUserSetupState } from "../../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";

type CognitoAuthState = ReturnType<typeof getCognitoApiAuthOptions>;

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("Checking invitation...");
  const [accepting, setAccepting] = useState(false);
  const [cognitoAuth, setCognitoAuth] = useState<CognitoAuthState | null>(null);
  const token = useMemo(() => {
    const raw = params.token;
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }, [params.token]);

  useEffect(() => {
    if (!token) {
      setStatus("Invitation token is missing.");
      setCognitoAuth({ available: false, reason: "Invitation token is missing." });
      return;
    }

    const nextAuth = getCognitoApiAuthOptions();
    setCognitoAuth(nextAuth);

    if (!nextAuth.available) {
      savePendingInviteToken(token);
      setStatus("Sign in with Cognito to accept this invitation.");
      return;
    }

    setStatus("Ready to join this workspace.");
  }, [token]);

  const signIn = async () => {
    if (token) {
      savePendingInviteToken(token);
    }

    setStatus("Opening Cognito sign-in...");

    try {
      await startCognitoSignIn();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cognito sign-in could not be started.");
    }
  };

  const accept = async () => {
    if (!cognitoAuth?.available) {
      await signIn();
      return;
    }

    setAccepting(true);
    setStatus("Accepting invitation...");

    const result = await acceptInvitation({ token }, cognitoAuth.options);
    setAccepting(false);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    clearPendingInviteToken();
    const nextState = { ...getDefaultSetupState(toWorkflowRole(result.data.user.role)), hasCompany: true };
    saveUserSetupState(nextState);
    setStatus("Invitation accepted. Opening onboarding...");
    router.replace(getNextRouteForUser(nextState));
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>WorkMap invitation</p>
        <h1 style={styles.title}>Join workspace</h1>
        <p style={styles.text}>{status}</p>
        {!cognitoAuth ? (
          <button type="button" disabled style={styles.primaryButton}>
            Checking invitation...
          </button>
        ) : cognitoAuth.available ? (
          <button type="button" onClick={accept} disabled={accepting || !token} style={styles.primaryButton}>
            {accepting ? "Joining..." : "Accept invitation"}
          </button>
        ) : (
          <button type="button" onClick={signIn} disabled={!token} style={styles.primaryButton}>
            Sign in with Cognito
          </button>
        )}
        <a href="/login" style={styles.secondaryLink}>
          Back to login
        </a>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "24px",
  },
  card: {
    ...wmStyles.elevatedCard,
    width: "min(480px, 100%)",
    display: "grid",
    gap: "13px",
    padding: "22px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: 0,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "32px",
    lineHeight: 1.2,
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryLink: {
    ...wmStyles.secondaryButton,
    display: "grid",
    placeItems: "center",
    padding: "11px",
    textDecoration: "none",
    fontWeight: 900,
  },
};
