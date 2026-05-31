import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUser } from "./apiTypes";

export function listUsers(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser[]>("/users", options);
}

export function getUser(userId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>(`/users/${encodeURIComponent(userId)}`, options);
}
