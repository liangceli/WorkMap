import { workMapApiGet, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiCompliancePolicy, WorkMapApiPolicyAcknowledgement } from "./apiTypes";

export function getCompliancePolicy(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiCompliancePolicy>("/compliance/policy", options);
}

export function acknowledgeCompliancePolicy(policyId: string, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiPolicyAcknowledgement>(
    `/compliance/policy/${encodeURIComponent(policyId)}/acknowledgement`,
    undefined,
    options,
  );
}
