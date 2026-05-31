import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiContactLinks, WorkMapApiIntegration } from "./apiTypes";

export function listIntegrations(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiIntegration[]>("/integrations", options);
}

export function getContactLinks(targetUserId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiContactLinks>(`/integrations/contact-links/${encodeURIComponent(targetUserId)}`, options);
}
