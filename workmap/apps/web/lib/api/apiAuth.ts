"use client";

import { getPilotApiAuthOptions } from "../auth/pilotSession";
import { getDevelopmentApiAuthOptions } from "./developmentApiAuth";
import type { ApiClientOptions } from "./apiTypes";

export type WorkMapApiAuthResult =
  | {
      available: true;
      options: ApiClientOptions;
      userId: string;
      email: string;
      companySlug: string;
      source: "pilot-session" | "dev-token" | "dev-cache";
    }
  | { available: false; reason: string };

export async function getWorkMapApiAuthOptions(): Promise<WorkMapApiAuthResult> {
  const pilotSession = getPilotApiAuthOptions();

  if (pilotSession.available) {
    return {
      available: true,
      options: pilotSession.options,
      userId: pilotSession.userId,
      email: pilotSession.email,
      companySlug: pilotSession.companySlug,
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
    source: developmentAuth.source === "cache" ? "dev-cache" : "dev-token",
  };
}
