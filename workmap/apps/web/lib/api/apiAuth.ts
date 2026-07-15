"use client";

import { getFreshCognitoApiAuthOptions } from "../auth/cognitoUserPoolAuth";
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

const AUTH_CONTEXT_CACHE_MS = 8_000;

export function createSingleFlightTtlCache<T>(
  ttlMs: number,
  now = () => Date.now(),
  shouldCache: (value: T) => boolean = () => true,
) {
  let cached: { key: string; expiresAt: number; value: T } | null = null;
  let inFlight: { key: string; promise: Promise<T> } | null = null;

  return {
    clear() {
      cached = null;
      inFlight = null;
    },
    async get(key: string, load: () => Promise<T>) {
      if (cached?.key === key && cached.expiresAt > now()) return cached.value;
      if (inFlight?.key === key) return inFlight.promise;

      const promise = load();
      inFlight = { key, promise };
      try {
        const value = await promise;
        if (shouldCache(value)) {
          cached = { key, expiresAt: now() + ttlMs, value };
        }
        return value;
      } finally {
        if (inFlight?.promise === promise) inFlight = null;
      }
    },
  };
}

const authContextCache = createSingleFlightTtlCache<WorkMapApiAuthResult>(
  AUTH_CONTEXT_CACHE_MS,
  () => Date.now(),
  (result) => result.available,
);

export async function getWorkMapApiAuthOptions(): Promise<WorkMapApiAuthResult> {
  const cognitoSession = await getFreshCognitoApiAuthOptions();

  if (!cognitoSession.available) {
    authContextCache.clear();
    return { available: false, reason: "No active Cognito session." };
  }

  return authContextCache.get(cognitoSession.cognitoSub, () => resolveAuthContext(cognitoSession));
}

async function resolveAuthContext(cognitoSession: Extract<Awaited<ReturnType<typeof getFreshCognitoApiAuthOptions>>, { available: true }>): Promise<WorkMapApiAuthResult> {
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
