import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiHealth } from "./apiTypes";

export function getApiHealth(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiHealth>("/health", options);
}
