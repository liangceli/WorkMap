import { workMapApiGet, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiDevelopmentToken, WorkMapApiUser } from "./apiTypes";

export function getCurrentUser(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>("/users/me", options);
}

export function createDevelopmentToken(body: { email: string; companySlug?: string }, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiDevelopmentToken>("/auth/dev-token", body, options);
}
