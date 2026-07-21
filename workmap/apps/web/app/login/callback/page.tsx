"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthContext, getCurrentUser } from "../../../lib/api/authApi";
import { getPlatformContext } from "../../../lib/api/platformApi";
import { decodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { completeCognitoRedirect } from "../../../lib/auth/cognitoSession";
import { getPendingInviteToken } from "../../../lib/auth/pendingInvite";
import { isConfirmedWorkspaceMissing, workspaceAccessError } from "../../../lib/auth/workspaceAccess";
import { getDefaultSetupState, getNextRouteForUser, saveUserSetupState, type WorkMapRole } from "../../../lib/workflow/workflowState";
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

      const authOptions = { token: result.session.idToken, authSource: "cognito" as const };
      const contextResult = await getAuthContext(authOptions);

      if (cancelled) {
        return;
      }

      if (!contextResult.ok) {
        const platformContextResult = await getPlatformContext(authOptions);
        if (cancelled) {
          return;
        }
        if (platformContextResult.ok) {
          setStatus("Cognito sign-in complete. Opening platform admin...");
          router.replace("/platform-admin");
          return;
        }
        if (isConfirmedWorkspaceMissing(contextResult)) {
          setStatus("Cognito sign-in complete. Opening workspace setup...");
          router.replace("/onboarding/company");
          return;
        }
        setStatus(workspaceAccessError(contextResult));
        return;
      }

      const defaultState = getDefaultSetupState(toWorkflowRole(contextResult.data.role));
      const currentUserResult = await getCurrentUser(authOptions);

      if (cancelled) {
        return;
      }

      if (!currentUserResult.ok) {
        setStatus(workspaceAccessError(currentUserResult));
        return;
      }

      const backendAvatar = decodeLayeredAvatarId(currentUserResult.data.avatarId);

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
    <main className="wm-auth-callback-page" style={styles.page}>
      <section className="wm-auth-callback-card" style={styles.card}>
        <p style={styles.eyebrow}>Cognito callback</p>
        <h1 style={styles.title}>Signing in</h1>
        <p style={styles.text}>{status}</p>
        <a href="/login" style={styles.link}>Back to login</a>
      </section>
    </main>
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
