"use client";

import { getFreshCognitoApiAuthOptions } from "../auth/cognitoUserPoolAuth";
import type { ApiClientOptions, WorkMapApiPlatformContext } from "./apiTypes";
import { getPlatformContext } from "./platformApi";

export type WorkMapPlatformApiAuthResult =
  | {
      available: true;
      options: ApiClientOptions;
      context: WorkMapApiPlatformContext;
      source: "cognito-session";
    }
  | { available: false; reason: string };

export async function getWorkMapPlatformApiAuthOptions(): Promise<WorkMapPlatformApiAuthResult> {
  const cognitoSession = await getFreshCognitoApiAuthOptions();

  if (!cognitoSession.available) {
    return { available: false, reason: cognitoSession.reason };
  }

  const contextResult = await getPlatformContext(cognitoSession.options);

  if (!contextResult.ok) {
    return {
      available: false,
      reason: `Cognito session is present, but platform admin access failed: ${contextResult.error}`,
    };
  }

  return {
    available: true,
    options: cognitoSession.options,
    context: contextResult.data,
    source: "cognito-session",
  };
}
