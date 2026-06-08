"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthContext, getCurrentUser } from "../../../lib/api/authApi";
import { getPlatformContext } from "../../../lib/api/platformApi";
import { decodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { completeCognitoRedirect } from "../../../lib/auth/cognitoSession";
import { getPendingInviteToken } from "../../../lib/auth/pendingInvite";
import { toWorkflowRole } from "../../../lib/auth/pilotSession";
import { getDefaultSetupState, getNextRouteForUser, saveUserSetupState } from "../../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";

export default function CognitoCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing Cognito sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const result = await completeCognitoRedirect();

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      const inviteToken = getPendingInviteToken();

      if (inviteToken) {
        setStatus("Cognito sign-in complete. Opening your invitation...");
        router.replace(`/invite/${encodeURIComponent(inviteToken)}`);
        return;
      }

      const platformContextResult = await getPlatformContext({ token: result.session.idToken });

      if (cancelled) {
        return;
      }

      if (platformContextResult.ok) {
        setStatus("Cognito sign-in complete. Opening platform admin...");
        router.replace("/platform-admin");
        return;
      }

      const contextResult = await getAuthContext({ token: result.session.idToken });

      if (cancelled) {
        return;
      }

      if (!contextResult.ok) {
        setStatus("Cognito sign-in complete. Opening workspace setup...");
        router.replace("/onboarding/company");
        return;
      }

      const defaultState = getDefaultSetupState(toWorkflowRole(contextResult.data.role));
      const currentUserResult = await getCurrentUser({ token: result.session.idToken });

      if (cancelled) {
        return;
      }

      const backendAvatar = currentUserResult.ok ? decodeLayeredAvatarId(currentUserResult.data.avatarId) : null;

      if (backendAvatar) {
        saveLayeredAvatarConfig(backendAvatar);
      }

      const nextState = {
        ...defaultState,
        hasCompany: true,
        hasAvatar: Boolean(backendAvatar) || defaultState.hasAvatar,
      };
      saveUserSetupState(nextState);
      setStatus("Cognito sign-in complete. Opening WorkMap...");
      router.replace(contextResult.data.role === "OWNER" && !backendAvatar ? "/onboarding/avatar" : getNextRouteForUser(nextState));
    }

    void finishSignIn();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>Cognito callback</p>
        <h1 style={styles.title}>Signing in</h1>
        <p style={styles.text}>{status}</p>
        <a href="/login" style={styles.link}>Back to login</a>
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
    width: "min(460px, 100%)",
    display: "grid",
    gap: "12px",
    padding: "22px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: 0,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "30px",
    lineHeight: 1.2,
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  link: {
    ...wmStyles.secondaryButton,
    justifySelf: "start",
    padding: "10px 12px",
  },
};
