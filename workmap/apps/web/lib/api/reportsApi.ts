import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUsageSummary } from "./apiTypes";

export function getUsageSummary(options?: ApiClientOptions & { userId?: string }) {
  const query = options?.userId ? `?userId=${encodeURIComponent(options.userId)}` : "";
  return workMapApiGet<WorkMapApiUsageSummary>(`/reports/usage-summary${query}`, options);
}
