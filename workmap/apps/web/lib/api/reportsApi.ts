import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiUsageSummary } from "./apiTypes";

export function getAgentLiveStatus(options?: ApiClientOptions & { userId?: string }) {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<{
    userId: string;
    agentStatus: WorkMapApiUsageSummary["agentStatus"];
  }>(`/reports/agent-status${query}`, options);
}

export function getUsageSummary(options?: ApiClientOptions & {
  userId?: string;
  departmentId?: string;
  scope?: "user" | "company";
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (options?.userId) {
    params.set("userId", options.userId);
  }
  if (options?.scope) {
    params.set("scope", options.scope);
  }
  if (options?.departmentId) {
    params.set("departmentId", options.departmentId);
  }
  if (options?.from) {
    params.set("from", options.from);
  }
  if (options?.to) {
    params.set("to", options.to);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiUsageSummary>(`/reports/usage-summary${query}`, options);
}
