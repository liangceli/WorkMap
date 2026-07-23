import { workMapApiGet, workMapApiPatch, workMapApiPost } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiCompliancePolicy,
  WorkMapApiPolicyAcknowledgement,
  WorkMapApiOpenRuntimePolicyVersion,
  WorkMapApiPolicyScheduleTimeZone,
  WorkMapApiPolicyWorkHours,
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

export function updateCompliancePolicyWorkHours(
  policyId: string,
  workdayStart: string,
  workdayEnd: string,
  options?: ApiClientOptions,
) {
  return workMapApiPatch<WorkMapApiPolicyWorkHours>(
    `/compliance/policy/${encodeURIComponent(policyId)}/work-hours`,
    { workdayStart, workdayEnd },
    options,
  );
}

export function enableComplianceOpenRuntime(
  policyId: string,
  options?: ApiClientOptions,
) {
  return workMapApiPost<WorkMapApiOpenRuntimePolicyVersion>(
    `/compliance/policy/${encodeURIComponent(policyId)}/open-runtime-version`,
    undefined,
    options,
  );
}

export function enableComplianceDomainOpenRuntime(
  policyId: string,
  options?: ApiClientOptions,
) {
  return workMapApiPost<WorkMapApiOpenRuntimePolicyVersion>(
    `/compliance/policy/${encodeURIComponent(policyId)}/domain-open-runtime-version`,
    undefined,
    options,
  );
}
