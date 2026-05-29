import type { UserPresenceStatus } from "@workmap/shared-types";

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
