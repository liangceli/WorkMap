"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkMapLoader } from "../../../components/ui/WorkMapLoader";
import { createOwnerWorkspace } from "../../../lib/api/tenantOnboardingApi";
import { decodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { deriveDisplayNameFromCognito, sanitizeDisplayName } from "../../../lib/auth/displayName";
import { redirectToLoginForMissingCognitoSession } from "../../../lib/auth/cognitoRedirect";
import { getFreshCognitoApiAuthOptions } from "../../../lib/auth/cognitoUserPoolAuth";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { getDefaultSetupState, saveUserSetupState, type WorkMapRole } from "../../../lib/workflow/workflowState";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getFreshCognitoApiAuthOptions().then((cognitoAuth) => {
      if (!cognitoAuth.available && !cancelled) {
        redirectToLoginForMissingCognitoSession();
        return;
      }
      if (!cancelled && cognitoAuth.available) {
        setDisplayName(deriveDisplayNameFromCognito(cognitoAuth.session));
        setAuthResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const createWorkspace = async () => {
    const cognitoAuth = await getFreshCognitoApiAuthOptions();
    const confirmedDisplayName = sanitizeDisplayName(displayName);

    if (!cognitoAuth.available) {
      if (redirectToLoginForMissingCognitoSession()) return;
      setStatus("Owner workspace creation requires Cognito sign-up. Return to /login and create an Owner account first.");
      return;
    }

    if (!confirmedDisplayName) {
      setStatus("Display name must be between 2 and 80 characters.");
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const result = await createOwnerWorkspace({ companyName, workspaceName, displayName: confirmedDisplayName }, cognitoAuth.options);
    setSubmitting(false);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    const defaultState = getDefaultSetupState(toWorkflowRole(result.data.user.role));
    const backendAvatar = decodeLayeredAvatarId(result.data.user.avatarId);

    if (backendAvatar) {
      saveLayeredAvatarConfig(backendAvatar);
    }

    const nextState = { ...defaultState, hasCompany: true, hasAvatar: Boolean(backendAvatar) || defaultState.hasAvatar };
    saveUserSetupState(nextState);
    router.push(backendAvatar ? result.data.onboarding.nextRoute : "/onboarding/avatar");
  };

  if (!authResolved) {
    return <WorkMapLoader fullPage label="Checking account access" />;
  }

  return (
    <main className="wm-onboarding-page wm-company-onboarding" style={styles.page}>
      <section className="wm-onboarding-shell" style={styles.shell}>
        <p style={styles.eyebrow}>Owner onboarding</p>
        <h1 style={styles.title}>Create your CandidGrid workspace</h1>
        <p style={styles.subtitle}>Create the company workspace, confirm your profile, then invite employees into the same tenant.</p>

        <section className="wm-onboarding-card" style={styles.card}>
          <label style={styles.label}>
            <span>Company name</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.label}>
            <span>Workspace name</span>
            <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.label}>
            <span>Your display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How teammates should see you"
              style={styles.input}
            />
          </label>
          <section style={styles.note}>
            <strong>Monitoring notice responsibility</strong>
            <span>Before monitoring starts, your organisation must give affected workers any workplace monitoring and privacy notice required by applicable Commonwealth, state or territory law. CandidGrid&apos;s product notice does not replace that employer-specific notice. Your confirmed display name is used in the CandidGrid directory and office labels.</span>
          </section>
          <section style={styles.ownerSteps}>
            <strong>Owner path</strong>
            <span>After workspace creation you will finish avatar/profile setup, review the employee monitoring notice, create employee invites and then open the virtual office.</span>
          </section>
          <button
            type="button"
            onClick={createWorkspace}
            disabled={!companyName || !workspaceName || !sanitizeDisplayName(displayName) || submitting}
            style={styles.button}
          >
            {submitting ? "Creating workspace..." : "Create workspace"}
          </button>
          {status ? <p style={styles.status}>{status}</p> : null}
        </section>
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
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  shell: {
    width: "min(620px, 100%)",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 10px",
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 750,
    letterSpacing: 0,
  },
  subtitle: {
    margin: "0 0 18px",
    color: wm.colors.textSecondary,
    fontSize: "16px",
  },
  card: {
    display: "grid",
    gap: "14px",
    ...wmStyles.elevatedCard,
    padding: "20px",
  },
  label: {
    display: "grid",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    height: "42px",
    ...wmStyles.input,
    padding: "0 10px",
    fontSize: "14px",
  },
  note: {
    display: "grid",
    gap: "4px",
    ...wmStyles.infoNotice,
    padding: "12px",
    fontSize: "14px",
  },
  ownerSteps: {
    display: "grid",
    gap: "4px",
    border: `1px solid ${wm.colors.successBorder}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.successBg,
    color: "#14532d",
    padding: "12px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  button: {
    ...wmStyles.primaryButton,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  status: {
    margin: 0,
    color: wm.colors.errorText,
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1.4,
  },
};
