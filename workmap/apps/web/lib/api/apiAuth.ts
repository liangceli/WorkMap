"use client";

import { getCognitoApiAuthOptions } from "../auth/cognitoSession";
import { getAuthContext } from "./authApi";
import type { ApiClientOptions } from "./apiTypes";

export type WorkMapApiAuthResult =
  | {
      available: true;
      options: ApiClientOptions;
      userId: string;
      email: string;
      companySlug: string;
      role: string;
      source: "cognito-session";
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

  return { available: false, reason: "No active Cognito session." };
}
