export type WorkMapRole = "EMPLOYEE" | "MANAGER" | "OWNER" | "IT_ADMIN";

export type UserSetupState = {
  isLoggedIn: boolean;
  role: WorkMapRole;
  hasCompany: boolean;
  hasAcknowledgedPolicy: boolean;
  hasAvatar: boolean;
  hasCompletedDeviceSetup: boolean;
};

export const USER_SETUP_STORAGE_KEY = "workmap.userSetupState";

// Frontend-only demo workflow state. This is not authentication, authorization, or backend RBAC.
export function getUserSetupState(): UserSetupState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(USER_SETUP_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeSetupState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveUserSetupState(state: UserSetupState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_SETUP_STORAGE_KEY, JSON.stringify(state));
}

export function resetUserSetupState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_SETUP_STORAGE_KEY);
}

export function getDefaultSetupState(role: WorkMapRole): UserSetupState {
  if (role === "EMPLOYEE") {
    return {
      isLoggedIn: true,
      role,
      hasCompany: true,
      hasAcknowledgedPolicy: false,
      hasAvatar: false,
      hasCompletedDeviceSetup: false,
    };
  }

  if (role === "OWNER") {
    return {
      isLoggedIn: true,
      role,
      hasCompany: false,
      hasAcknowledgedPolicy: false,
      hasAvatar: true,
      hasCompletedDeviceSetup: true,
    };
  }

  return {
    isLoggedIn: true,
    role,
    hasCompany: true,
    hasAcknowledgedPolicy: true,
    hasAvatar: true,
    hasCompletedDeviceSetup: true,
  };
}

export function getNextRouteForUser(state: UserSetupState | null) {
  if (!state?.isLoggedIn) {
    return "/login";
  }

  if (!state.hasCompany) {
    return "/onboarding/company";
  }

  if (!state.hasAcknowledgedPolicy) {
    return "/compliance";
  }

  if (!state.hasAvatar) {
    return "/onboarding/avatar";
  }

  if (!state.hasCompletedDeviceSetup) {
    return "/onboarding/device-setup";
  }

  if (state.role === "EMPLOYEE") {
    return "/virtual-office";
  }

  return "/dashboard";
}

export function updateUserSetupState(updates: Partial<UserSetupState>, fallbackRole: WorkMapRole = "EMPLOYEE") {
  const current = getUserSetupState() ?? getDefaultSetupState(fallbackRole);
  const next = { ...current, ...updates };
  saveUserSetupState(next);
  return next;
}

function normalizeSetupState(value: unknown): UserSetupState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<UserSetupState>;
  const role = isWorkMapRole(candidate.role) ? candidate.role : "EMPLOYEE";

  return {
    isLoggedIn: Boolean(candidate.isLoggedIn),
    role,
    hasCompany: Boolean(candidate.hasCompany),
    hasAcknowledgedPolicy: Boolean(candidate.hasAcknowledgedPolicy),
    hasAvatar: Boolean(candidate.hasAvatar),
    hasCompletedDeviceSetup: Boolean(candidate.hasCompletedDeviceSetup),
  };
}

function isWorkMapRole(value: unknown): value is WorkMapRole {
  return value === "EMPLOYEE" || value === "MANAGER" || value === "OWNER" || value === "IT_ADMIN";
}
