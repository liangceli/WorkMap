"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthContext } from "../../../lib/api/authApi";
import { completeCognitoRedirect } from "../../../lib/auth/cognitoSession";
import { toWorkflowRole } from "../../../lib/auth/pilotSession";
import { getDefaultSetupState, saveUserSetupState } from "../../../lib/workflow/workflowState";
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

      const contextResult = await getAuthContext({ token: result.session.idToken });

      if (cancelled) {
        return;
      }

      if (!contextResult.ok) {
        setStatus(
          `Cognito sign-in succeeded, but WorkMap could not map this user yet: ${contextResult.error}. Ask an admin to map the Cognito user email to an existing WorkMap user.`,
        );
        return;
      }

      saveUserSetupState(getDefaultSetupState(toWorkflowRole(contextResult.data.role)));
      setStatus("Cognito sign-in complete. Opening WorkMap...");
      router.replace("/virtual-office");
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
