"use client";

import type { ApiClientOptions, WorkMapApiAuthUser } from "../api/apiTypes";
import { getDefaultSetupState, saveUserSetupState, type WorkMapRole } from "../workflow/workflowState";

const PILOT_SESSION_STORAGE_KEY = "workmap.pilotSession";

export type StoredPilotSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: WorkMapApiAuthUser;
};

export type PilotSessionResult =
  | { available: true; options: ApiClientOptions; userId: string; email: string; companySlug: string; session: StoredPilotSession }
  | { available: false; reason: string };

export function savePilotSession(session: StoredPilotSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PILOT_SESSION_STORAGE_KEY, JSON.stringify(session));
  const role = toWorkflowRole(session.user.role);
  saveUserSetupState({ ...getDefaultSetupState(role), hasCompany: true });
}

export function getPilotSession(): StoredPilotSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PILOT_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isStoredPilotSession(parsed) || isExpired(parsed.expiresAt)) {
      clearPilotSession();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getPilotApiAuthOptions(): PilotSessionResult {
  const session = getPilotSession();

  if (!session) {
    return { available: false, reason: "No active pilot session." };
  }

  return {
    available: true,
    options: { token: session.accessToken },
    userId: session.user.id,
    email: session.user.email,
    companySlug: session.user.companySlug,
    session,
  };
}

export function clearPilotSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PILOT_SESSION_STORAGE_KEY);
}

export function toWorkflowRole(role: string | undefined): WorkMapRole {
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

function isStoredPilotSession(value: unknown): value is StoredPilotSession {
  return (
    isObject(value) &&
    typeof value.accessToken === "string" &&
    value.tokenType === "Bearer" &&
    typeof value.expiresAt === "string" &&
    isObject(value.user) &&
    typeof value.user.id === "string" &&
    typeof value.user.email === "string" &&
    typeof value.user.displayName === "string" &&
    typeof value.user.role === "string" &&
    typeof value.user.companyId === "string" &&
    typeof value.user.companySlug === "string"
  );
}

function isExpired(expiresAt: string) {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= Date.now() + 60_000;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
