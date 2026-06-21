import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiRequestContext, WorkMapApiUser } from "./apiTypes";

export function getAuthContext(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiRequestContext>("/auth/me", options);
}

export function getCurrentUser(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>("/users/me", options);
}
