import { workMapApiGet, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiTenantStatus, WorkMapApiWorkspaceContext } from "./apiTypes";

export function getTenantOnboardingStatus(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiTenantStatus>("/tenant-onboarding/status", options);
}

export function createOwnerWorkspace(
  body: {
    companyName: string;
    workspaceName: string;
  },
  options?: ApiClientOptions,
) {
  return workMapApiPost<WorkMapApiWorkspaceContext>("/tenant-onboarding/workspace", body, options);
}
