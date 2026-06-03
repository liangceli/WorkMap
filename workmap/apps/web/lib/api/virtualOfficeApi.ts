import { workMapApiGet, workMapApiPut } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiNavigationDestination,
  WorkMapApiOfficeMap,
  WorkMapApiPlayerPosition,
  WorkMapApiSavedPlayerPosition,
  WorkMapApiSavePlayerPositionInput,
} from "./apiTypes";

export function getVirtualOfficeMap(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiOfficeMap>("/virtual-office/map", options);
}

export function listVirtualOfficeNavigation(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiNavigationDestination[]>("/virtual-office/navigation", options);
}

export function listVirtualOfficePositions(officeMapId: string, options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiPlayerPosition[]>(
    `/virtual-office/map/${encodeURIComponent(officeMapId)}/positions`,
    options,
  );
}

export function saveCurrentVirtualOfficePosition(
  officeMapId: string,
  position: WorkMapApiSavePlayerPositionInput,
  options?: ApiClientOptions,
) {
  return workMapApiPut<WorkMapApiSavedPlayerPosition>(
    `/virtual-office/map/${encodeURIComponent(officeMapId)}/positions/me`,
    position,
    options,
  );
}
