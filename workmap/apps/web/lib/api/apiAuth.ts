"use client";

import { getPilotApiAuthOptions } from "../auth/pilotSession";
import { getCognitoApiAuthOptions } from "../auth/cognitoSession";
import { getAuthContext } from "./authApi";
import { getDevelopmentApiAuthOptions } from "./developmentApiAuth";
import type { ApiClientOptions } from "./apiTypes";

export type WorkMapApiAuthResult =
  | {
      available: true;
      options: ApiClientOptions;
      userId: string;
      email: string;
      companySlug: string;
      role: string;
      source: "cognito-session" | "pilot-session" | "dev-token" | "dev-cache";
    }
  | { available: false; reason: string };

export async function getWorkMapApiAuthOptions(): Promise<WorkMapApiAuthResult> {
  const cognitoSession = getCognitoApiAuthOptions();

  if (cognitoSession.available) {
    const contextResult = await getAuthContext(cognitoSession.options);

    if (!contextResult.ok) {
      return {
        available: false,
        reason: `Cognito session is present, but backend WorkMap mapping failed: ${contextResult.error}`,
      };
    }

    return {
      available: true,
      options: cognitoSession.options,
      userId: contextResult.data.userId,
      email: cognitoSession.email ?? "",
      companySlug: "",
      role: contextResult.data.role,
      source: "cognito-session",
    };
  }

  const pilotSession = getPilotApiAuthOptions();

  if (pilotSession.available) {
    return {
      available: true,
      options: pilotSession.options,
      userId: pilotSession.userId,
      email: pilotSession.email,
      companySlug: pilotSession.companySlug,
      role: pilotSession.session.user.role,
      source: "pilot-session",
    };
  }

  const developmentAuth = await getDevelopmentApiAuthOptions();

  if (!developmentAuth.available) {
    return developmentAuth;
  }

  return {
    available: true,
    options: developmentAuth.options,
    userId: developmentAuth.userId,
    email: developmentAuth.email,
    companySlug: developmentAuth.companySlug,
    role: developmentAuth.role,
    source: developmentAuth.source === "cache" ? "dev-cache" : "dev-token",
  };
}
