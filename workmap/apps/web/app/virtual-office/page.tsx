"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { OfficeMap } from "../../components/office/OfficeMap";
import { WorkMapLoader } from "../../components/ui/WorkMapLoader";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import { redirectToLoginForMissingCognitoSession } from "../../lib/auth/cognitoRedirect";
import { getCognitoSession } from "../../lib/auth/cognitoSession";
import { toWorkflowRole } from "../../lib/navigation/workspaceNavigation";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { getUserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";

type GateState =
  | { status: "checking" }
  | { status: "ready"; role: WorkMapRole }
  | { status: "blocked"; reason: string };

export default function VirtualOfficePage() {
  const [gate, setGate] = useState<GateState>({ status: "checking" });

  useLayoutEffect(() => {
    const setup = getUserSetupState();
    if (getCognitoSession() && setup?.hasCompany) {
      setGate({ status: "ready", role: setup.role });
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
        if (!redirectToLoginForMissingCognitoSession()) {
          setGate({ status: "blocked", reason: auth.reason });
        }
        return;
      }

      setGate({ status: "ready", role: toWorkflowRole(auth.role) });
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.status === "ready") {
    return <OfficeMap currentUserRole={gate.role} />;
  }

  if (gate.status === "blocked") {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>Virtual Office</p>
          <h1 style={styles.title}>Workspace access unavailable</h1>
          <p style={styles.text}>{gate.reason}</p>
          <a href="/" style={styles.primaryLink}>Return to WorkMap</a>
        </section>
      </main>
    );
  }

  return <WorkMapLoader fullPage label="Checking workspace access" />;
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
  eyebrow: { ...wmStyles.eyebrow, margin: 0 },
  title: { margin: 0, color: wm.colors.textHeading, fontSize: "30px", lineHeight: 1.2 },
  text: { margin: 0, color: wm.colors.textSecondary, fontSize: "14px", lineHeight: 1.5 },
  primaryLink: { ...wmStyles.primaryButton, justifySelf: "start", padding: "11px 14px" },
};
