import { workMapApiGet, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiCompliancePolicy } from "./apiTypes";

export function getCompliancePolicy(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiCompliancePolicy>("/compliance/policy", options);
}

export function acknowledgeCompliancePolicy(policyId: string, options?: ApiClientOptions) {
  return workMapApiPost<{ id: string; monitoringPolicyId: string; acknowledgedAt: string }>(
    `/compliance/policy/${encodeURIComponent(policyId)}/acknowledgement`,
    undefined,
    options,
  );
}
