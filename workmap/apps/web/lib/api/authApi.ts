import { workMapApiGet, workMapApiPost } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiDevelopmentToken,
  WorkMapApiPilotSession,
  WorkMapApiRequestContext,
  WorkMapApiUser,
} from "./apiTypes";

export function getAuthContext(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiRequestContext>("/auth/me", options);
}

export function getCurrentUser(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiUser>("/users/me", options);
}

export function createDevelopmentToken(body: { email: string; companySlug?: string }, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiDevelopmentToken>("/auth/dev-token", body, options);
}

export function createPilotSession(body: { email: string; password: string; companySlug?: string }, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiPilotSession>("/auth/pilot-login", body, options);
}
