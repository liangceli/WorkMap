import { workMapApiGet } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiPlatformAuditList,
  WorkMapApiPlatformContext,
  WorkMapApiPlatformTenantDetail,
  WorkMapApiPlatformTenantHealthResponse,
  WorkMapApiPlatformTenantList,
} from "./apiTypes";

export function getPlatformContext(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlatformContext>("/platform/me", options);
}

export function listPlatformTenants(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlatformTenantList>("/platform/tenants", options);
}

export function getPlatformTenant(companyId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlatformTenantDetail>(`/platform/tenants/${encodeURIComponent(companyId)}`, options);
}

export function getPlatformTenantHealth(companyId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlatformTenantHealthResponse>(
    `/platform/tenants/${encodeURIComponent(companyId)}/health`,
    options,
  );
}

export function listPlatformAudit(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlatformAuditList>("/platform/audit", options);
}
