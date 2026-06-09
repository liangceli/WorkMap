import type { UserPresenceStatus } from "@workmap/shared-types";
import { WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST } from "@workmap/shared-types";

export type OfficeDestination = {
  id: string;
  roomId?: string;
  name: string;
  type: "department" | "room" | "common_area" | "desk_area" | "support";
  description?: string;
  anchor: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
  autoStatus?: UserPresenceStatus;
};

export const officeDestinations: OfficeDestination[] = WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.navigation.map((destination) => ({
  id: destination.key,
  roomId: "roomKey" in destination ? destination.roomKey : undefined,
  name: destination.name,
  type: destination.type,
  description: destination.description,
  anchor: destination.anchor,
  bounds: destination.bounds,
  autoStatus: destination.autoStatus,
}));

export function findDestinationAtPoint(x: number, y: number) {
  return officeDestinations.find((destination) => {
    const bounds = destination.bounds;
    return bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  });
}
