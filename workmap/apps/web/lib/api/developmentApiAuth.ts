"use client";

import { createDevelopmentToken } from "./authApi";
import type { ApiClientOptions, WorkMapApiDevelopmentToken } from "./apiTypes";
import { getUserSetupState, type WorkMapRole } from "../workflow/workflowState";

const DEV_AUTH_STORAGE_KEY = "workmap.devApiAuth";
const DEFAULT_COMPANY_SLUG = "workmap-demo-company";
const DEFAULT_EMAIL_BY_ROLE: Record<WorkMapRole, string> = {
  EMPLOYEE: "engineer@workmap.demo",
  MANAGER: "manager@workmap.demo",
  OWNER: "owner@workmap.demo",
  IT_ADMIN: "it.admin@workmap.demo",
};

type StoredDevelopmentAuth = {
  accessToken: string;
  expiresAt: string;
  email: string;
  companySlug: string;
};

export type DevelopmentApiAuthResult =
  | { available: true; options: ApiClientOptions; email: string; companySlug: string; source: "cache" | "dev-token" }
  | { available: false; reason: string };

export async function getDevelopmentApiAuthOptions(): Promise<DevelopmentApiAuthResult> {
  if (process.env.NODE_ENV !== "development") {
    return { available: false, reason: "Development API auth is disabled outside development." };
  }

  if (typeof window === "undefined") {
    return { available: false, reason: "Development API auth requires browser localStorage." };
  }

  const identity = getDevelopmentIdentity();
  const cached = readStoredDevelopmentAuth();

  if (cached && cached.email === identity.email && cached.companySlug === identity.companySlug && !isExpired(cached.expiresAt)) {
    return {
      available: true,
      options: { token: cached.accessToken },
      email: cached.email,
      companySlug: cached.companySlug,
      source: "cache",
    };
  }

  const tokenResult = await createDevelopmentToken(identity);

  if (!tokenResult.ok || !isDevelopmentToken(tokenResult.data)) {
    clearStoredDevelopmentAuth();
    return {
      available: false,
      reason: tokenResult.ok ? "Development token response was invalid." : tokenResult.error,
    };
  }

  const stored = {
    accessToken: tokenResult.data.accessToken,
    expiresAt: tokenResult.data.expiresAt,
    email: tokenResult.data.user.email,
    companySlug: tokenResult.data.user.companySlug,
  };
  writeStoredDevelopmentAuth(stored);

  return {
    available: true,
    options: { token: stored.accessToken },
    email: stored.email,
    companySlug: stored.companySlug,
    source: "dev-token",
  };
}

function getDevelopmentIdentity() {
  const setupState = getUserSetupState();
  const role = setupState?.role ?? "EMPLOYEE";
  const configuredEmail = process.env.NEXT_PUBLIC_WORKMAP_DEV_AUTH_EMAIL?.trim().toLowerCase();
  const configuredCompanySlug = process.env.NEXT_PUBLIC_WORKMAP_DEV_AUTH_COMPANY_SLUG?.trim();

  return {
    email: configuredEmail || DEFAULT_EMAIL_BY_ROLE[role] || DEFAULT_EMAIL_BY_ROLE.EMPLOYEE,
    companySlug: configuredCompanySlug || DEFAULT_COMPANY_SLUG,
  };
}

function readStoredDevelopmentAuth(): StoredDevelopmentAuth | null {
  try {
    const raw = window.localStorage.getItem(DEV_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isStoredDevelopmentAuth(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDevelopmentAuth(auth: StoredDevelopmentAuth) {
  try {
    window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Local development auth is optional; API calls still have mock fallback.
  }
}

function clearStoredDevelopmentAuth() {
  try {
    window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
  } catch {
    // Local development auth is optional; API calls still have mock fallback.
  }
}

function isExpired(expiresAt: string) {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= Date.now() + 60_000;
}

function isStoredDevelopmentAuth(value: unknown): value is StoredDevelopmentAuth {
  return (
    isObject(value) &&
    typeof value.accessToken === "string" &&
    typeof value.expiresAt === "string" &&
    typeof value.email === "string" &&
    typeof value.companySlug === "string"
  );
}

function isDevelopmentToken(value: unknown): value is WorkMapApiDevelopmentToken {
  return (
    isObject(value) &&
    typeof value.accessToken === "string" &&
    typeof value.expiresAt === "string" &&
    isObject(value.user) &&
    typeof value.user.email === "string" &&
    typeof value.user.companySlug === "string"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
