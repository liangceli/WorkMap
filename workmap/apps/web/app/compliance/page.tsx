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
    <AppShell variant="editorial">
      <section className="wm-redesign-page wm-compliance-page" style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="Employee privacy"
          title="Employee monitoring and privacy notice"
          subtitle="Review CandidGrid's technical data boundary and the current workspace policy before pairing or using tracking clients."
          actions={
            <>
              <WorkMapButton href="/settings">Settings</WorkMapButton>
              <WorkMapButton href="/employees" tone="primary">Employees</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title={onboardingMode ? "Before CandidGrid monitoring starts" : "Product notice and employer notice"}>
          {onboardingMode
            ? "Review what CandidGrid does and does not collect, who can view reports, and your organisation's own workplace monitoring or privacy notice before pairing a client."
            : "Review CandidGrid's technical data boundary, current collection schedule and notice-confirmation status. Your organisation must separately provide the employer-specific information required by applicable law."}
        </WorkMapPrivacyNotice>

        <CompliancePolicyPanel />

        {onboardingMode ? (
          <section style={styles.ackCta}>
            <div>
              <h2 style={styles.ackTitle}>Finished reviewing?</h2>
              <p style={styles.ackText}>
                Continue only after reading this notice together with your organisation&apos;s workplace monitoring or privacy notice. The official receipt confirmation is recorded separately above; continuing here is not consent or a waiver of rights.
              </p>
            </div>
            <button type="button" onClick={acknowledgeAndContinue} style={styles.ackButton}>
              Continue after review
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
