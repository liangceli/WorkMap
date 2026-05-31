import { workMapApiGet } from "./apiClient";
import type { ApiClientOptions, WorkMapApiOfficeMap, WorkMapApiPlayerPosition } from "./apiTypes";

export function getVirtualOfficeMap(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiOfficeMap>("/virtual-office/map", options);
}

export function listVirtualOfficePositions(officeMapId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlayerPosition[]>(
    `/virtual-office/map/${encodeURIComponent(officeMapId)}/positions`,
    options,
  );
}
