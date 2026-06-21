"use client";

import { Amplify } from "aws-amplify";
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import {
  clearCognitoSession,
  getCognitoUserPoolConfigStatus,
  storeCognitoTokenSession,
  type StoredCognitoSession,
} from "./cognitoSession";

export type CognitoSignInStep =
  | "CONFIRM_SIGN_UP"
  | "RESET_PASSWORD"
  | "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
  | "CONFIRM_SIGN_IN_WITH_SMS_CODE"
  | "CONFIRM_SIGN_IN_WITH_TOTP_CODE"
  | "CONFIRM_SIGN_IN_WITH_EMAIL_CODE"
  | "UNSUPPORTED";

export type CognitoSignInResult =
  | { signedIn: true; session: StoredCognitoSession }
  | { signedIn: false; step: CognitoSignInStep; destination?: string; rawStep: string };

export type CognitoSignUpResult = {
  complete: boolean;
  destination?: string;
};

let configuredSignature = "";

export function configureCognitoUserPoolClient() {
  const status = getCognitoUserPoolConfigStatus();

  if (!status.configured) {
    throw new Error(status.message);
  }

  const signature = `${status.config.userPoolId}:${status.config.appClientId}`;

  if (configuredSignature !== signature) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: status.config.userPoolId,
          userPoolClientId: status.config.appClientId,
          loginWith: {
            email: true,
          },
        },
      },
    });
    configuredSignature = signature;
  }

  return status.config;
}

export async function createCognitoAccount(input: { email: string; password: string; displayName: string }): Promise<CognitoSignUpResult> {
  configureCognitoUserPoolClient();
  const email = normalizeEmail(input.email);
  const result = await signUp({
    username: email,
    password: input.password,
    options: {
      userAttributes: {
        email,
        name: input.displayName.trim(),
      },
    },
  });

  return {
    complete: result.isSignUpComplete || result.nextStep.signUpStep === "DONE",
    destination: "codeDeliveryDetails" in result.nextStep ? result.nextStep.codeDeliveryDetails?.destination : undefined,
  };
}

export async function confirmCognitoAccount(email: string, confirmationCode: string) {
  configureCognitoUserPoolClient();
  return confirmSignUp({
    username: normalizeEmail(email),
    confirmationCode: confirmationCode.trim(),
  });
}

export async function resendCognitoSignUpCode(email: string) {
  configureCognitoUserPoolClient();
  const result = await resendSignUpCode({ username: normalizeEmail(email) });
  return result.destination;
}

export async function signInCognitoAccount(email: string, password: string): Promise<CognitoSignInResult> {
  configureCognitoUserPoolClient();
  clearCognitoSession();

  try {
    await signOut();
  } catch {
    // A missing Amplify session is the expected state for a fresh sign-in.
  }

  const result = await signIn({
    username: normalizeEmail(email),
    password,
  });

  return resolveSignInResult(result.isSignedIn, result.nextStep);
}

export async function confirmCognitoSignIn(challengeResponse: string): Promise<CognitoSignInResult> {
  configureCognitoUserPoolClient();
  const result = await confirmSignIn({ challengeResponse });
  return resolveSignInResult(result.isSignedIn, result.nextStep);
}

export async function requestCognitoPasswordReset(email: string) {
  configureCognitoUserPoolClient();
  const result = await resetPassword({ username: normalizeEmail(email) });

  return {
    complete: result.isPasswordReset,
    destination: result.nextStep.codeDeliveryDetails?.destination,
  };
}

export async function completeCognitoPasswordReset(email: string, confirmationCode: string, newPassword: string) {
  configureCognitoUserPoolClient();
  await confirmResetPassword({
    username: normalizeEmail(email),
    confirmationCode: confirmationCode.trim(),
    newPassword,
  });
}

export async function signOutCognitoAccount() {
  configureCognitoUserPoolClient();

  try {
    await signOut();
  } finally {
    clearCognitoSession();
  }
}

export async function restoreCognitoAccountSession() {
  try {
    configureCognitoUserPoolClient();
    return await readAmplifySession(false);
  } catch {
    clearCognitoSession();
    return null;
  }
}

async function resolveSignInResult(
  isSignedIn: boolean,
  nextStep: {
    signInStep: string;
    codeDeliveryDetails?: { destination?: string };
  },
): Promise<CognitoSignInResult> {
  if (isSignedIn || nextStep.signInStep === "DONE") {
    return { signedIn: true, session: await readAmplifySession() };
  }

  const supportedSteps = new Set<CognitoSignInStep>([
    "CONFIRM_SIGN_UP",
    "RESET_PASSWORD",
    "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED",
    "CONFIRM_SIGN_IN_WITH_SMS_CODE",
    "CONFIRM_SIGN_IN_WITH_TOTP_CODE",
    "CONFIRM_SIGN_IN_WITH_EMAIL_CODE",
  ]);
  const step = supportedSteps.has(nextStep.signInStep as CognitoSignInStep)
    ? (nextStep.signInStep as CognitoSignInStep)
    : "UNSUPPORTED";

  return {
    signedIn: false,
    step,
    rawStep: nextStep.signInStep,
    destination: nextStep.codeDeliveryDetails?.destination,
  };
}

async function readAmplifySession(forceRefresh = true) {
  const session = await fetchAuthSession({ forceRefresh });
  const accessToken = session.tokens?.accessToken?.toString();
  const idToken = session.tokens?.idToken?.toString();

  if (!accessToken || !idToken) {
    throw new Error("Cognito sign-in completed without usable tokens.");
  }

  return storeCognitoTokenSession(accessToken, idToken);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function formatCognitoAuthError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const fallback = error instanceof Error ? error.message : "Cognito could not complete this request.";

  switch (name) {
    case "UserNotFoundException":
    case "NotAuthorizedException":
      return "Email or password is incorrect.";
    case "UsernameExistsException":
      return "An account already exists for this email. Sign in instead.";
    case "UserNotConfirmedException":
      return "Confirm this email before signing in.";
    case "CodeMismatchException":
      return "The confirmation code is incorrect.";
    case "ExpiredCodeException":
      return "This confirmation code has expired. Request a new code.";
    case "InvalidPasswordException":
      return "The password does not meet the Cognito password policy.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a moment and try again.";
    case "PasswordResetRequiredException":
      return "Reset your password before signing in.";
    default:
      return fallback;
  }
}
