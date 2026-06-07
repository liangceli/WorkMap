import { workMapApiGet, workMapApiPatch } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUser } from "./apiTypes";

export function listUsers(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser[]>("/users", options);
}

export function getUser(userId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>(`/users/${encodeURIComponent(userId)}`, options);
}

export function updateCurrentUserProfile(body: { displayName?: string; avatarId?: string }, options?: ApiClientOptions) {
  return workMapApiPatch<WorkMapApiUser>("/users/me", body, options);
}
