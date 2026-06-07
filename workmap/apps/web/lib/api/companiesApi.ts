import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiCompany } from "./apiTypes";

export function getCurrentCompany(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiCompany>("/companies/current", options);
}
