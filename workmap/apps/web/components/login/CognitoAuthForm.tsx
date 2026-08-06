"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { sanitizeDisplayName } from "../../lib/auth/displayName";
import {
  completeCognitoPasswordReset,
  confirmCognitoAccount,
  confirmCognitoSignIn,
  formatCognitoAuthError,
  requestCognitoPasswordReset,
  resendCognitoSignUpCode,
  type CognitoAuthOperation,
  type CognitoSignInResult,
} from "../../lib/auth/cognitoUserPoolAuth";
import { runCognitoPrimaryAction } from "../../lib/auth/cognitoPrimaryAction";
import type { StoredCognitoSession } from "../../lib/auth/cognitoSession";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type AuthScreen =
  | "sign_in"
  | "sign_up"
  | "confirm_sign_up"
  | "forgot_password"
  | "confirm_reset_password"
  | "sign_in_challenge";

type MessageState = {
  tone: "error" | "success" | "info";
  text: string;
} | null;

type CognitoAuthFormProps = {
  initialMode?: "signin" | "signup";
  lockedEmail?: string;
  accountContext?: "owner" | "employee";
  onAuthenticated: (session: StoredCognitoSession) => void | Promise<void>;
};

export function CognitoAuthForm({
  initialMode = "signin",
  lockedEmail,
  accountContext = "owner",
  onAuthenticated,
}: CognitoAuthFormProps) {
  const [screen, setScreen] = useState<AuthScreen>(initialMode === "signup" ? "sign_up" : "sign_in");
  const [email, setEmail] = useState(lockedEmail?.trim().toLowerCase() ?? "");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [challengeKind, setChallengeKind] = useState<"code" | "new_password">("code");
  const [challengeResponse, setChallengeResponse] = useState("");
  const [deliveryDestination, setDeliveryDestination] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    if (lockedEmail) {
      setEmail(lockedEmail.trim().toLowerCase());
    }
  }, [lockedEmail]);

  const accountEmail = lockedEmail?.trim().toLowerCase() || email.trim().toLowerCase();
  const isEmailLocked = Boolean(lockedEmail);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!isValidEmail(accountEmail)) {
      setMessage({ tone: "error", text: "Enter a valid email address." });
      return;
    }

    setBusy(true);

    try {
      if (screen === "sign_in") {
        const submission = await runCognitoPrimaryAction("sign_in", { email: accountEmail, password });
        await handleSignInResult(submission.result);
      } else if (screen === "sign_up") {
        const safeDisplayName = sanitizeDisplayName(displayName);

        if (!safeDisplayName) {
          throw new Error("Display name must be between 2 and 80 characters.");
        }

        validatePasswordPair(password, confirmPassword);
        const submission = await runCognitoPrimaryAction("sign_up", {
          email: accountEmail,
          password,
          displayName: safeDisplayName,
        });
        const result = submission.result;

        if (result.complete) {
          setScreen("sign_in");
          setMessage({ tone: "success", text: "Account created. Sign in to continue to CandidGrid." });
        } else {
          setDeliveryDestination(result.destination);
          setScreen("confirm_sign_up");
          setMessage({ tone: "success", text: deliveryMessage("Confirmation code sent", result.destination) });
        }
      } else if (screen === "confirm_sign_up") {
        if (!confirmationCode.trim()) {
          throw new Error("Enter the confirmation code from your email.");
        }

        await confirmCognitoAccount(accountEmail, confirmationCode);
        setConfirmationCode("");
        setScreen("sign_in");
        setMessage({ tone: "success", text: "Email confirmed. Sign in to continue to CandidGrid." });
      } else if (screen === "forgot_password") {
        const result = await requestCognitoPasswordReset(accountEmail);

        if (result.complete) {
          setScreen("sign_in");
          setMessage({ tone: "info", text: "This account does not require a password reset." });
        } else {
          setDeliveryDestination(result.destination);
          setScreen("confirm_reset_password");
          setMessage({ tone: "success", text: deliveryMessage("Password reset code sent", result.destination) });
        }
      } else if (screen === "confirm_reset_password") {
        validatePasswordPair(newPassword, confirmNewPassword);

        if (!confirmationCode.trim()) {
          throw new Error("Enter the password reset code from your email.");
        }

        await completeCognitoPasswordReset(accountEmail, confirmationCode, newPassword);
        setPassword(newPassword);
        setNewPassword("");
        setConfirmNewPassword("");
        setConfirmationCode("");
        setScreen("sign_in");
        setMessage({ tone: "success", text: "Password updated. Sign in with your new password." });
      } else if (screen === "sign_in_challenge") {
        if (!challengeResponse.trim()) {
          throw new Error(challengeKind === "new_password" ? "Enter a new password." : "Enter the authentication code.");
        }

        const result = await confirmCognitoSignIn(challengeResponse);
        await handleSignInResult(result);
      }
    } catch (error) {
      const text = formatCognitoAuthError(error, operationForScreen(screen));
      setMessage({ tone: "error", text });

      if (error instanceof Error && error.name === "UserNotConfirmedException") {
        setScreen("confirm_sign_up");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignInResult = async (result: CognitoSignInResult) => {
    if (result.signedIn) {
      setMessage({ tone: "success", text: "Cognito sign-in complete. Opening CandidGrid..." });
      await onAuthenticated(result.session);
      return;
    }

    if (result.step === "CONFIRM_SIGN_UP") {
      setScreen("confirm_sign_up");
      setMessage({ tone: "info", text: "Confirm this email before signing in." });
      return;
    }

    if (result.step === "RESET_PASSWORD") {
      const reset = await requestCognitoPasswordReset(accountEmail);
      setDeliveryDestination(reset.destination);
      setScreen(reset.complete ? "sign_in" : "confirm_reset_password");
      setMessage({ tone: "info", text: deliveryMessage("Password reset code sent", reset.destination) });
      return;
    }

    if (result.step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      setChallengeKind("new_password");
      setChallengeResponse("");
      setScreen("sign_in_challenge");
      setMessage({ tone: "info", text: "Choose a new password to finish signing in." });
      return;
    }

    if (
      result.step === "CONFIRM_SIGN_IN_WITH_SMS_CODE" ||
      result.step === "CONFIRM_SIGN_IN_WITH_TOTP_CODE" ||
      result.step === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE"
    ) {
      setChallengeKind("code");
      setChallengeResponse("");
      setDeliveryDestination(result.destination);
      setScreen("sign_in_challenge");
      setMessage({ tone: "info", text: deliveryMessage("Authentication code required", result.destination) });
      return;
    }

    throw new Error(`This Cognito sign-in step is not supported yet: ${result.rawStep}.`);
  };

  const resendConfirmation = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const destination = await resendCognitoSignUpCode(accountEmail);
      setDeliveryDestination(destination);
      setMessage({ tone: "success", text: deliveryMessage("A new confirmation code was sent", destination) });
    } catch (error) {
      setMessage({ tone: "error", text: formatCognitoAuthError(error, "confirm_sign_up") });
    } finally {
      setBusy(false);
    }
  };

  const switchScreen = (next: AuthScreen) => {
    setScreen(next);
    setMessage(null);
    setConfirmationCode("");
    setChallengeResponse("");
  };

  const title = screenTitle(screen, accountContext);
  const description = screenDescription(screen, accountContext, deliveryDestination);
  const submitLabel = screenSubmitLabel(screen);

  return (
    <section style={styles.shell}>
      <div style={styles.heading}>
        <p style={styles.eyebrow}>{accountContext === "employee" ? "Employee account" : "Secure workspace access"}</p>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.description}>{description}</p>
      </div>

      {(screen === "sign_in" || screen === "sign_up") ? (
        <div style={styles.segmented} role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={screen === "sign_in"}
            onClick={() => switchScreen("sign_in")}
            style={{ ...styles.segment, ...(screen === "sign_in" ? styles.segmentActive : {}) }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === "sign_up"}
            onClick={() => switchScreen("sign_up")}
            style={{ ...styles.segment, ...(screen === "sign_up" ? styles.segmentActive : {}) }}
          >
            {accountContext === "employee" ? "Create account" : "Create Owner"}
          </button>
        </div>
      ) : null}

      <form className="wm-auth-form" onSubmit={submit} style={styles.form}>
        <AuthField
          label="Email address"
          icon={<Mail size={17} />}
          type="email"
          value={accountEmail}
          onChange={setEmail}
          readOnly={isEmailLocked}
          autoComplete="email"
          hint={isEmailLocked ? "Locked to the email selected by the workspace Owner." : undefined}
        />

        {screen === "sign_up" ? (
          <AuthField
            label="Display name"
            icon={<UserRound size={17} />}
            value={displayName}
            onChange={setDisplayName}
            autoComplete="name"
            placeholder="How teammates should see you"
          />
        ) : null}

        {(screen === "sign_in" || screen === "sign_up") ? (
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            autoComplete={screen === "sign_up" ? "new-password" : "current-password"}
          />
        ) : null}

        {screen === "sign_up" ? (
          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            autoComplete="new-password"
          />
        ) : null}

        {(screen === "confirm_sign_up" || screen === "confirm_reset_password") ? (
          <AuthField
            label={screen === "confirm_sign_up" ? "Email confirmation code" : "Password reset code"}
            icon={<ShieldCheck size={17} />}
            value={confirmationCode}
            onChange={setConfirmationCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter the code"
          />
        ) : null}

        {screen === "confirm_reset_password" ? (
          <>
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              autoComplete="new-password"
            />
          </>
        ) : null}

        {screen === "sign_in_challenge" ? (
          challengeKind === "new_password" ? (
            <PasswordField
              label="New password"
              value={challengeResponse}
              onChange={setChallengeResponse}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              autoComplete="new-password"
            />
          ) : (
            <AuthField
              label="Authentication code"
              icon={<KeyRound size={17} />}
              value={challengeResponse}
              onChange={setChallengeResponse}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter the code"
            />
          )
        ) : null}

        {message ? (
          <p aria-live="polite" style={{ ...styles.message, ...messageToneStyles[message.tone] }}>
            {message.text}
          </p>
        ) : null}

        <button type="submit" disabled={busy} style={{ ...styles.submitButton, ...(busy ? styles.disabledButton : {}) }}>
          {busy ? <RefreshCw size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {busy ? "Please wait..." : submitLabel}
        </button>

        <div style={styles.secondaryActions}>
          {screen === "sign_in" ? (
            <button type="button" className="wm-auth-text-link" onClick={() => switchScreen("forgot_password")} style={styles.textButton}>
              Forgot password?
            </button>
          ) : null}
          {screen === "confirm_sign_up" ? (
            <button type="button" className="wm-auth-text-link" onClick={resendConfirmation} disabled={busy} style={styles.textButton}>
              Resend confirmation code
            </button>
          ) : null}
          {screen !== "sign_in" && screen !== "sign_up" ? (
            <button type="button" className="wm-auth-text-link" onClick={() => switchScreen("sign_in")} style={styles.textButton}>
              Back to sign in
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

type AuthFieldProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "email" | "text";
  placeholder?: string;
  hint?: string;
};

function AuthField({
  label,
  icon,
  value,
  onChange,
  type = "text",
  readOnly = false,
  autoComplete,
  inputMode,
  placeholder,
  hint,
}: AuthFieldProps) {
  return (
    <label style={styles.label}>
      <span>{label}</span>
      <span style={styles.inputWrap}>
        <span style={styles.inputIcon}>{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          required
          style={{ ...styles.input, ...(readOnly ? styles.readOnlyInput : {}) }}
        />
      </span>
      {hint ? <span style={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <label style={styles.label}>
      <span>{label}</span>
      <span style={styles.inputWrap}>
        <span style={styles.inputIcon}><LockKeyhole size={17} /></span>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={8}
          required
          style={{ ...styles.input, paddingRight: "44px" }}
        />
        <button type="button" className="wm-auth-password-toggle" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} style={styles.visibilityButton}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      <span style={styles.fieldHint}>Use at least 8 characters and follow your Cognito password policy.</span>
    </label>
  );
}

function validatePasswordPair(password: string, confirmation: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }
}

function operationForScreen(screen: AuthScreen): CognitoAuthOperation {
  switch (screen) {
    case "sign_up":
      return "sign_up";
    case "sign_in":
      return "sign_in";
    case "confirm_sign_up":
      return "confirm_sign_up";
    case "forgot_password":
      return "reset_password";
    case "confirm_reset_password":
      return "confirm_reset_password";
    case "sign_in_challenge":
      return "confirm_sign_in";
  }
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function deliveryMessage(prefix: string, destination?: string) {
  return destination ? `${prefix} to ${destination}.` : `${prefix}.`;
}

function screenTitle(screen: AuthScreen, context: CognitoAuthFormProps["accountContext"]) {
  switch (screen) {
    case "sign_up":
      return context === "employee" ? "Create your employee account" : "Create an Owner account";
    case "confirm_sign_up":
      return "Confirm your email";
    case "forgot_password":
      return "Reset your password";
    case "confirm_reset_password":
      return "Choose a new password";
    case "sign_in_challenge":
      return "Complete secure sign-in";
    default:
      return "Sign in to CandidGrid";
  }
}

function screenDescription(screen: AuthScreen, context: CognitoAuthFormProps["accountContext"], destination?: string) {
  switch (screen) {
    case "sign_up":
      return context === "employee"
        ? "Your account stays bound to the email selected by the workspace Owner."
        : "Your first account becomes the Owner of the workspace you create next.";
    case "confirm_sign_up":
      return destination ? `Enter the code sent to ${destination}.` : "Enter the confirmation code sent by Cognito.";
    case "forgot_password":
      return "Cognito will send a secure reset code to this account.";
    case "confirm_reset_password":
      return destination ? `Use the code sent to ${destination}.` : "Enter the reset code and choose a new password.";
    case "sign_in_challenge":
      return "Cognito requires one more security step before CandidGrid can continue.";
    default:
      return context === "employee" ? "Use the Cognito account connected to your invitation." : "Use your Cognito account to open the correct workspace.";
  }
}

function screenSubmitLabel(screen: AuthScreen) {
  switch (screen) {
    case "sign_up":
      return "Create account";
    case "confirm_sign_up":
      return "Confirm and continue";
    case "forgot_password":
      return "Send reset code";
    case "confirm_reset_password":
      return "Update password";
    case "sign_in_challenge":
      return "Complete sign-in";
    default:
      return "Sign in";
  }
}

const messageToneStyles = {
  error: {
    borderColor: wm.colors.error,
    background: wm.colors.errorBg,
    color: wm.colors.errorText,
  },
  success: {
    borderColor: wm.colors.successBorder,
    background: wm.colors.successBg,
    color: wm.colors.compliance,
  },
  info: {
    borderColor: wm.colors.infoBorder,
    background: wm.colors.infoBg,
    color: wm.colors.infoText,
  },
} as const;

const styles = {
  shell: {
    display: "grid",
    gap: "14px",
    minWidth: 0,
  },
  heading: {
    display: "grid",
    gap: "5px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: 0,
  },
  title: {
    margin: 0,
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "24px",
    lineHeight: 1.2,
    fontWeight: 750,
  },
  description: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "4px",
    padding: "4px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surfaceContainer,
  },
  segment: {
    minHeight: "38px",
    border: 0,
    borderRadius: wm.radius.sm,
    background: "transparent",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 750,
    cursor: "pointer",
  },
  segmentActive: {
    background: wm.colors.surface,
    color: wm.colors.textHeading,
    boxShadow: wm.shadow.card,
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    color: wm.colors.textHeading,
    fontSize: "13px",
    fontWeight: 750,
  },
  inputWrap: {
    position: "relative" as const,
    display: "block",
    minWidth: 0,
  },
  inputIcon: {
    position: "absolute" as const,
    left: "12px",
    top: "50%",
    zIndex: 1,
    display: "grid",
    placeItems: "center",
    color: wm.colors.textMuted,
    transform: "translateY(-50%)",
    pointerEvents: "none" as const,
  },
  input: {
    ...wmStyles.input,
    width: "100%",
    minWidth: 0,
    height: "44px",
    boxSizing: "border-box" as const,
    padding: "0 12px 0 40px",
    outline: "none",
  },
  readOnlyInput: {
    background: wm.colors.surfaceLow,
    color: wm.colors.text,
    fontWeight: 750,
    cursor: "not-allowed",
  },
  visibilityButton: {
    position: "absolute" as const,
    top: "2px",
    right: "2px",
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: wm.radius.sm,
    background: "transparent",
    color: wm.colors.textMuted,
    cursor: "pointer",
  },
  fieldHint: {
    color: wm.colors.textMuted,
    fontSize: "11px",
    lineHeight: 1.4,
    fontWeight: 500,
  },
  message: {
    margin: 0,
    border: "1px solid",
    borderRadius: wm.radius.md,
    padding: "10px 11px",
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 650,
  },
  submitButton: {
    ...wmStyles.primaryButton,
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 14px",
  },
  disabledButton: {
    cursor: "wait",
    opacity: 0.65,
  },
  secondaryActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  textButton: {
    border: 0,
    padding: "4px 0",
    background: "transparent",
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  },
};
