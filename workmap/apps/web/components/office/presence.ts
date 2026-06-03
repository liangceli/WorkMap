import type { UserPresenceStatus } from "@workmap/shared-types";

const PRESENCE_RECENT_MS = 30 * 1000;
const PRESENCE_STALE_MS = 5 * 60 * 1000;

export const statusColors: Record<UserPresenceStatus, string> = {
  available: "#22c55e",
  busy: "#ef4444",
  focus: "#2563eb",
  idle: "#eab308",
  break: "#f97316",
  offline: "#94a3b8",
  on_call: "#8b5cf6",
};

export function labelStatus(status: UserPresenceStatus) {
  return status.replace("_", " ");
}

export function statusFromFreshness(status: UserPresenceStatus, updatedAt: string): UserPresenceStatus {
  const updatedTime = Date.parse(updatedAt);
  if (!Number.isFinite(updatedTime)) {
    return status;
  }

  const ageMs = Math.max(0, Date.now() - updatedTime);
  if (ageMs > PRESENCE_STALE_MS) {
    return "offline";
  }

  if (ageMs > PRESENCE_RECENT_MS) {
    return status === "offline" ? "offline" : "idle";
  }

  return status;
}

export function presenceFreshnessLabel(updatedAt: string, status: UserPresenceStatus) {
  const updatedTime = Date.parse(updatedAt);
  if (!Number.isFinite(updatedTime)) {
    return {
      label: labelStatus(status),
      detail: "recently active",
    };
  }

  const ageMs = Math.max(0, Date.now() - updatedTime);
  if (ageMs > PRESENCE_STALE_MS) {
    return {
      label: "offline",
      detail: `last seen ${formatRelativeAge(ageMs)}`,
    };
  }

  if (ageMs > PRESENCE_RECENT_MS) {
    return {
      label: "idle / away",
      detail: `last seen ${formatRelativeAge(ageMs)}`,
    };
  }

  return {
    label: status === "available" ? "active now" : labelStatus(status),
    detail: "updated just now",
  };
}

function formatRelativeAge(ageMs: number) {
  const minutes = Math.max(1, Math.round(ageMs / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}
