"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { OfficeMap } from "../../components/office/OfficeMap";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { getCognitoSession } from "../../lib/auth/cognitoSession";
import { getUserSetupState } from "../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type GateState =
  | { status: "checking" }
  | { status: "ready" }
  | { status: "blocked"; reason: string };

export default function VirtualOfficePage() {
  const [gate, setGate] = useState<GateState>({ status: "checking" });

  useLayoutEffect(() => {
    if (getCognitoSession() && getUserSetupState()?.hasCompany) {
      setGate({ status: "ready" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const auth = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      if (!auth.available) {
        setGate({ status: "blocked", reason: auth.reason });
        return;
      }

      setGate({ status: "ready" });
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.status === "ready") {
    return <OfficeMap />;
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>Virtual Office</p>
        <h1 style={styles.title}>{gate.status === "checking" ? "Checking workspace access" : "Sign in required"}</h1>
        <p style={styles.text}>
          {gate.status === "checking"
            ? "WorkMap is resolving your Cognito workspace role before opening the office."
            : `The virtual office requires a Cognito-backed workspace user. ${gate.reason}`}
        </p>
        {gate.status === "blocked" ? (
          <div style={styles.actions}>
            <a href="/login" style={styles.primaryLink}>Sign in</a>
            <a href="/" style={styles.secondaryLink}>Back to start</a>
          </div>
        ) : null}
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
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  card: {
    ...wmStyles.elevatedCard,
    width: "min(520px, 100%)",
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
    color: wm.colors.textHeading,
    fontSize: "30px",
    lineHeight: 1.2,
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  primaryLink: {
    ...wmStyles.primaryButton,
    padding: "11px 14px",
  },
  secondaryLink: {
    ...wmStyles.secondaryButton,
    padding: "11px 14px",
  },
};
