"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CognitoAuthForm } from "../../../components/login/CognitoAuthForm";
import { acceptInvitation, previewInvitation } from "../../../lib/api/invitationsApi";
import type { WorkMapApiInvitationPreview } from "../../../lib/api/apiTypes";
import { decodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { getCognitoApiAuthOptions, type StoredCognitoSession } from "../../../lib/auth/cognitoSession";
import { restoreCognitoAccountSession } from "../../../lib/auth/cognitoUserPoolAuth";
import { sanitizeDisplayName } from "../../../lib/auth/displayName";
import { clearPendingInviteToken, savePendingInviteToken } from "../../../lib/auth/pendingInvite";
import { getDefaultSetupState, getNextRouteForUser, saveUserSetupState, type WorkMapRole } from "../../../lib/workflow/workflowState";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";

type CognitoAuthState = ReturnType<typeof getCognitoApiAuthOptions>;

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState("Checking invitation...");
  const [accepting, setAccepting] = useState(false);
  const [cognitoAuth, setCognitoAuth] = useState<CognitoAuthState | null>(null);
  const [invitePreview, setInvitePreview] = useState<WorkMapApiInvitationPreview | null>(null);
  const [previewRouteUnavailable, setPreviewRouteUnavailable] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const token = useMemo(() => {
    const raw = params.token;
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }, [params.token]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!token) {
        setStatus("Invitation token is missing.");
        setCognitoAuth({ available: false, reason: "Invitation token is missing." });
        setInvitePreview(null);
        setPreviewRouteUnavailable(false);
        return;
      }

      setStatus("Checking invitation...");
      setPreviewRouteUnavailable(false);
      const preview = await previewInvitation(token);

      if (cancelled) {
        return;
      }

      if (!preview.ok) {
        if (preview.status === 404) {
          setInvitePreview(null);
          setPreviewRouteUnavailable(true);
          setCognitoAuth({ available: false, reason: "Invitation preview API is unavailable." });
          savePendingInviteToken(token);
          setStatus("Invitation details are temporarily unavailable. Try this link again after the WorkMap API update completes.");
          return;
        }

        setInvitePreview(null);
        setPreviewRouteUnavailable(false);
        setCognitoAuth({ available: false, reason: preview.error });
        setStatus(formatInviteError(preview.error));
        return;
      }

      setInvitePreview(preview.data);
      setPreviewRouteUnavailable(false);

      if (preview.data.status !== "PENDING") {
        setCognitoAuth({ available: false, reason: `Invitation is ${preview.data.status.toLowerCase()}.` });
        setStatus(formatInviteError(`Invitation is ${preview.data.status.toLowerCase()}.`));
        return;
      }

      let nextAuth = getCognitoApiAuthOptions();

      if (!nextAuth.available) {
        const restoredSession = await restoreCognitoAccountSession();

        if (cancelled) {
          return;
        }

        if (restoredSession) {
          nextAuth = getCognitoApiAuthOptions();
        }
      }

      setCognitoAuth(nextAuth);

      if (!nextAuth.available) {
        savePendingInviteToken(token);
        setStatus(`Create or open the Cognito account for ${preview.data.invitedEmail} to accept this invitation.`);
        return;
      }

      const signedInEmail = nextAuth.email?.trim().toLowerCase() ?? "";
      const invitedEmail = preview.data.invitedEmail.trim().toLowerCase();

      if (signedInEmail && signedInEmail !== invitedEmail) {
        setStatus(`This invitation is locked to ${preview.data.invitedEmail}. You are currently signed in as ${nextAuth.email}.`);
        return;
      }

      setDisplayName("");
      setStatus("Ready to join this workspace. Enter the display name teammates should see.");
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const invitedEmail = invitePreview?.invitedEmail ?? "";
  const canUseInvite = Boolean(token && invitePreview?.status === "PENDING" && invitedEmail);
  const signedInEmail = cognitoAuth?.available ? cognitoAuth.email?.trim().toLowerCase() ?? "" : "";
  const emailMismatch = Boolean(canUseInvite && signedInEmail && invitedEmail && signedInEmail !== invitedEmail.toLowerCase());

  const handleAuthenticated = async (session: StoredCognitoSession) => {
    const nextAuth = getCognitoApiAuthOptions();

    if (!nextAuth.available) {
      setStatus(nextAuth.reason);
      return;
    }

    const authenticatedEmail = session.claims.email?.trim().toLowerCase() ?? "";

    if (!authenticatedEmail || authenticatedEmail !== invitedEmail.toLowerCase()) {
      setCognitoAuth(nextAuth);
      setStatus(`This invitation is locked to ${invitedEmail}. Sign in with that exact Cognito email.`);
      return;
    }

    setCognitoAuth(nextAuth);
    setDisplayName(sanitizeDisplayName(session.claims.displayName ?? "") ?? "");
    setStatus("Cognito account verified. Confirm the display name teammates should see.");
  };

  const accept = async () => {
    if (!cognitoAuth?.available || emailMismatch) {
      setStatus(`Sign in with the Cognito account for ${invitedEmail} before accepting this invitation.`);
      return;
    }

    const confirmedDisplayName = sanitizeDisplayName(displayName);

    if (!confirmedDisplayName) {
      setStatus("Display name must be between 2 and 80 characters.");
      return;
    }

    setAccepting(true);
    setStatus("Accepting invitation...");

    const result = await acceptInvitation({ token, displayName: confirmedDisplayName }, cognitoAuth.options);
    setAccepting(false);

    if (!result.ok) {
      setStatus(formatInviteError(result.error));
      return;
    }

    clearPendingInviteToken();
    const backendAvatar = decodeLayeredAvatarId(result.data.user.avatarId);

    if (backendAvatar) {
      saveLayeredAvatarConfig(backendAvatar);
    }

    const defaultState = getDefaultSetupState(toWorkflowRole(result.data.user.role));
    const nextState = { ...defaultState, hasCompany: true, hasAvatar: Boolean(backendAvatar) || defaultState.hasAvatar };
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
        <section style={styles.flowNote}>
          <strong>What happens next</strong>
          <span>Employees must use the invited Cognito email before WorkMap takes them through compliance, avatar/profile, and device setup.</span>
        </section>
        {invitePreview && cognitoAuth?.available && !emailMismatch ? (
          <section style={styles.lockPanel}>
            <span style={styles.lockLabel}>Invited account</span>
            <input value={invitePreview.invitedEmail} readOnly aria-label="Invited email" style={styles.readOnlyInput} />
            <span style={styles.lockHint}>WorkMap accepts this invitation only for this verified email address.</span>
          </section>
        ) : previewRouteUnavailable ? (
          <section style={styles.lockPanel}>
            <span style={styles.lockLabel}>Invited account</span>
            <span style={styles.lockHint}>Use the exact email address that received this invitation. The backend will reject any different verified Cognito email.</span>
          </section>
        ) : null}
        {!cognitoAuth ? (
          <button type="button" disabled style={styles.primaryButton}>
            Checking invitation...
          </button>
        ) : !canUseInvite ? (
          <button type="button" disabled style={styles.primaryButton}>
            Invitation unavailable
          </button>
        ) : cognitoAuth.available ? (
          emailMismatch ? (
            <CognitoAuthForm
              key={`invite-auth-${invitedEmail}`}
              initialMode="signin"
              lockedEmail={invitedEmail}
              accountContext="employee"
              onAuthenticated={handleAuthenticated}
            />
          ) : (
            <>
              <label style={styles.label}>
                <span>Your display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How teammates should see you"
                  style={styles.input}
                />
              </label>
              <button type="button" onClick={accept} disabled={accepting || !token || !sanitizeDisplayName(displayName)} style={styles.primaryButton}>
                {accepting ? "Joining..." : "Accept invitation"}
              </button>
            </>
          )
        ) : (
          <CognitoAuthForm
            key={`invite-auth-${invitedEmail}`}
            initialMode="signup"
            lockedEmail={invitedEmail}
            accountContext="employee"
            onAuthenticated={handleAuthenticated}
          />
        )}
        <a href="/login" style={styles.secondaryLink}>
          Back to login
        </a>
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

function formatInviteError(error: string) {
  const lower = error.toLowerCase();

  if (lower.includes("403") || lower.includes("forbidden")) {
    return "This Cognito account is not allowed to accept this invitation. Check that you signed in with the invited, verified email address.";
  }

  if (lower.includes("expired")) {
    return "This invitation has expired. Ask the workspace owner for a new invite link.";
  }

  if (lower.includes("accepted")) {
    return "This invitation has already been accepted. Sign in from /login to continue to your workspace.";
  }

  return error;
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
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 750,
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  flowNote: {
    display: "grid",
    gap: "5px",
    ...wmStyles.infoNotice,
    padding: "12px",
    color: wm.colors.infoText,
    fontSize: "13px",
    lineHeight: 1.45,
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
  lockPanel: {
    display: "grid",
    gap: "7px",
    padding: "12px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "8px",
    background: wm.colors.surfaceLow,
  },
  lockLabel: {
    color: wm.colors.textSecondary,
    fontSize: "12px",
    fontWeight: 900,
  },
  readOnlyInput: {
    height: "40px",
    ...wmStyles.input,
    padding: "0 10px",
    color: wm.colors.text,
    background: wm.colors.surface,
    fontSize: "14px",
    fontWeight: 800,
  },
  lockHint: {
    color: wm.colors.textSecondary,
    fontSize: "12px",
    lineHeight: 1.45,
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
