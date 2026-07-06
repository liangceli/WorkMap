import { workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiActivityIngestResult } from "./apiTypes";

export type AppUsageEventInput = {
  deviceId: string;
  appName: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  durationSeconds?: number;
  isIdle?: boolean;
  isActiveWindow?: boolean;
};

export type DomainUsageEventInput = {
  deviceId: string;
  domain: string;
  browserName?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  durationSeconds?: number;
  isIdle?: boolean;
  isActiveWindow?: boolean;
};

export function submitAppUsage(events: AppUsageEventInput | AppUsageEventInput[], options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiActivityIngestResult>("/activity/app-usage", toBatch(events), options);
}

export function submitDomainUsage(events: DomainUsageEventInput | DomainUsageEventInput[], options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiActivityIngestResult>("/activity/domain-usage", toBatch(events), options);
}

function toBatch<T>(events: T | T[]) {
  return Array.isArray(events) ? { events } : events;
}
