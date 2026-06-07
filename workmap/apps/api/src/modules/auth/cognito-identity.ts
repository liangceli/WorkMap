import { UnauthorizedException } from "@nestjs/common";
import type { CognitoJwtPayload } from "@workmap/auth";

export type VerifiedCognitoIdentity = {
  sub: string;
  email: string;
  displayName: string;
};

export function getVerifiedCognitoIdentity(payload: CognitoJwtPayload): VerifiedCognitoIdentity {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const localPart = email.split("@")[0];
  const displayName = firstNonEmptyString(payload.name, payload.username, payload["cognito:username"]) ?? (localPart || "WorkMap user");

  if (!payload.sub) {
    throw new UnauthorizedException("Cognito token is missing subject.");
  }

  if (!isVerifiedEmailClaim(payload.email_verified)) {
    throw new UnauthorizedException("Cognito email must be verified before WorkMap onboarding.");
  }

  if (!isValidEmail(email)) {
    throw new UnauthorizedException("Cognito token must include a valid verified email.");
  }

  return {
    sub: payload.sub,
    email,
    displayName,
  };
}

export function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isVerifiedEmailClaim(value: CognitoJwtPayload["email_verified"]) {
  return value === true || value === "true";
}

function firstNonEmptyString(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}
