import { workMapApiGet } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiReportLiveStatus,
  WorkMapApiTrackingAudit,
  WorkMapApiTrackingV2LiveActivity,
  WorkMapApiUsageSummary,
} from "./apiTypes";

export function getAgentLiveStatus(options?: ApiClientOptions & {
  userId?: string;
  departmentId?: string;
  scope?: "user" | "company";
  from?: string;
  to?: string;
  includeRevision?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  if (options?.departmentId) params.set("departmentId", options.departmentId);
  if (options?.scope) params.set("scope", options.scope);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.includeRevision === false) params.set("includeRevision", "false");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiReportLiveStatus>(`/reports/agent-status${query}`, options);
}

export function getUsageSummary(options?: ApiClientOptions & {
  userId?: string;
  departmentId?: string;
  scope?: "user" | "company";
  from?: string;
  to?: string;
  includeAudit?: boolean;
  includeLive?: boolean;
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
  if (options?.includeAudit === false) {
    params.set("includeAudit", "false");
  }
  if (options?.includeLive === false) {
    params.set("includeLive", "false");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiUsageSummary>(`/reports/usage-summary${query}`, options);
}

export function getTrackingAudit(options?: ApiClientOptions & {
  userId?: string;
  departmentId?: string;
  scope?: "user" | "company";
  from?: string;
  to?: string;
  includeTimeline?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  if (options?.departmentId) params.set("departmentId", options.departmentId);
  if (options?.scope) params.set("scope", options.scope);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.includeTimeline === false) params.set("includeTimeline", "false");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiTrackingAudit>(`/reports/tracking-audit${query}`, options);
}

export function getTrackingV2LiveActivity(options?: ApiClientOptions & {
  userId?: string;
  departmentId?: string;
  scope?: "user" | "company";
}) {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  if (options?.departmentId) params.set("departmentId", options.departmentId);
  if (options?.scope) params.set("scope", options.scope);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return workMapApiGet<WorkMapApiTrackingV2LiveActivity>(`/reports/live-activity${query}`, options);
}
