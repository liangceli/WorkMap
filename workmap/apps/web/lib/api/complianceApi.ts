import { workMapApiGet, workMapApiPatch, workMapApiPost } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiCompliancePolicy,
  WorkMapApiPolicyAcknowledgement,
  WorkMapApiPolicyScheduleTimeZone,
} from "./apiTypes";

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

export function confirmCompliancePolicyScheduleTimeZone(
  policyId: string,
  scheduleTimeZone: string,
  options?: ApiClientOptions,
) {
  return workMapApiPatch<WorkMapApiPolicyScheduleTimeZone>(
    `/compliance/policy/${encodeURIComponent(policyId)}/schedule-time-zone`,
    { scheduleTimeZone },
    options,
  );
}
