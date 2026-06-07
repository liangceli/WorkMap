"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOwnerWorkspace } from "../../../lib/api/tenantOnboardingApi";
import { decodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { deriveDisplayNameFromCognito, sanitizeDisplayName } from "../../../lib/auth/displayName";
import { getCognitoApiAuthOptions } from "../../../lib/auth/cognitoSession";
import { toWorkflowRole } from "../../../lib/auth/pilotSession";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { getDefaultSetupState, saveUserSetupState, updateUserSetupState } from "../../../lib/workflow/workflowState";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("Acme Operations");
  const [workspaceName, setWorkspaceName] = useState("Acme HQ");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cognitoAuth = getCognitoApiAuthOptions();

    if (cognitoAuth.available) {
      setDisplayName(deriveDisplayNameFromCognito(cognitoAuth.session));
    }
  }, []);

  const createWorkspace = async () => {
    const cognitoAuth = getCognitoApiAuthOptions();
    const confirmedDisplayName = sanitizeDisplayName(displayName);

    if (!cognitoAuth.available) {
      continueWithDemoFallback();
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

  const continueWithDemoFallback = () => {
    updateUserSetupState({ hasCompany: true }, "OWNER");
    router.push("/compliance");
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <p style={styles.eyebrow}>Owner onboarding</p>
        <h1 style={styles.title}>Create your WorkMap workspace</h1>
        <p style={styles.subtitle}>WorkMap creates a transparent virtual office for your team.</p>

        <section style={styles.card}>
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
            <strong>Privacy-forward setup</strong>
            <span>Tracking rules are configured before employees join. Your confirmed display name is used in WorkMap directory and office labels.</span>
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
    fontSize: "32px",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.02em",
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
