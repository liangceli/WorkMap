"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompliancePolicyPanel } from "../../components/compliance/CompliancePolicyPanel";
import { AppShell } from "../../components/layout/AppShell";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import {
  getNextRouteForUser,
  getUserSetupState,
  updateUserSetupState,
  type UserSetupState,
} from "../../lib/workflow/workflowState";

export default function CompliancePage() {
  const router = useRouter();
  const [setupState, setSetupState] = useState<UserSetupState | null>(null);

  useEffect(() => {
    setSetupState(getUserSetupState());
  }, []);

  const acknowledgeAndContinue = () => {
    const nextState = updateUserSetupState({ hasAcknowledgedPolicy: true });
    setSetupState(nextState);
    router.push(getNextRouteForUser(nextState));
  };

  const onboardingMode = Boolean(setupState?.isLoggedIn && !setupState.hasAcknowledgedPolicy);

  return (
    <AppShell>
      <section style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="Compliance"
          title="Transparency policy"
          subtitle="Make WorkMap activity summaries explicit, role-based, and easy for employees to understand."
          actions={
            <>
              <WorkMapButton href="/settings">Settings</WorkMapButton>
              <WorkMapButton href="/employees" tone="primary">Employees</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title={onboardingMode ? "First-time transparency step" : "Workspace transparency boundary"}>
          {onboardingMode
            ? "Review what WorkMap does and does not collect before entering the workspace."
            : "Review what is visible in WorkMap, what is not collected, and whether the current Cognito session can record acknowledgement through the backend policy API."}
        </WorkMapPrivacyNotice>

        <CompliancePolicyPanel />

        {onboardingMode ? (
          <section style={styles.ackCta}>
            <div>
              <h2 style={styles.ackTitle}>Ready to continue?</h2>
              <p style={styles.ackText}>
                I understand that WorkMap uses transparent, role-based visibility and does not collect private content.
              </p>
            </div>
            <button type="button" onClick={acknowledgeAndContinue} style={styles.ackButton}>
              I understand and agree
            </button>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
  ackCta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
    border: `1px solid ${wm.colors.successBorder}`,
    borderRadius: wm.radius.xl,
    background: wm.colors.successBg,
    color: wm.colors.compliance,
    padding: "16px",
  },
  ackTitle: {
    margin: "0 0 6px",
    fontSize: "20px",
  },
  ackText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  ackButton: {
    flex: "0 0 auto",
    border: `1px solid ${wm.colors.success}`,
    borderRadius: wm.radius.md,
    background: wm.colors.success,
    color: "#ffffff",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
