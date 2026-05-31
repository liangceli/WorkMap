import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUser } from "./apiTypes";

export function getCurrentUser(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>("/users/me", options);
}
