import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUsageSummary } from "./apiTypes";

export function getUsageSummary(options?: ApiClientOptions & { userId?: string; scope?: "user" | "company" }) {
  const params = new URLSearchParams();
  if (options?.userId) {
    params.set("userId", options.userId);
  }
  if (options?.scope) {
    params.set("scope", options.scope);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiUsageSummary>(`/reports/usage-summary${query}`, options);
}
