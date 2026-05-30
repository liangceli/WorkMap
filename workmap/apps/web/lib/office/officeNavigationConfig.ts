import type { UserPresenceStatus } from "@workmap/shared-types";

export type OfficeDestination = {
  id: string;
  name: string;
  type: "department" | "room" | "common_area" | "desk_area" | "support";
  description?: string;
  anchor: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
  autoStatus?: UserPresenceStatus;
};

// Frontend-only navigation anchors for the current TMX map. Do not persist to database until map APIs are approved.
export const officeDestinations: OfficeDestination[] = [
  {
    id: "open-office",
    name: "Open Office",
    type: "desk_area",
    description: "Shared desk area for everyday presence and quick collaboration.",
    anchor: { x: 500, y: 500 },
    bounds: { x: 32, y: 64, width: 736, height: 512 },
    autoStatus: "available",
  },
  {
    id: "engineering-zone",
    name: "Engineering Zone",
    type: "department",
    description: "Engineering desks and focused project work.",
    anchor: { x: 250, y: 760 },
    bounds: { x: 32, y: 640, width: 736, height: 288 },
    autoStatus: "available",
  },
  {
    id: "manager-office",
    name: "Manager Office",
    type: "room",
    description: "Private office for manager check-ins.",
    anchor: { x: 1010, y: 250 },
    bounds: { x: 864, y: 64, width: 224, height: 384 },
    autoStatus: "busy",
  },
  {
    id: "meeting-room",
    name: "Main Meeting Room",
    type: "room",
    description: "Collaborative meeting area with presentation space.",
    anchor: { x: 1235, y: 360 },
    bounds: { x: 1120, y: 64, width: 416, height: 384 },
    autoStatus: "busy",
  },
  {
    id: "sales-zone",
    name: "Sales Zone",
    type: "department",
    description: "Sales team workspace and customer follow-up area.",
    anchor: { x: 1010, y: 770 },
    bounds: { x: 864, y: 640, width: 416, height: 288 },
    autoStatus: "available",
  },
  {
    id: "break-room",
    name: "Break Room",
    type: "common_area",
    description: "Informal break area for short pauses.",
    anchor: { x: 1410, y: 835 },
    bounds: { x: 1344, y: 768, width: 192, height: 160 },
    autoStatus: "break",
  },
  {
    id: "focus-room",
    name: "Focus Room",
    type: "room",
    description: "Quiet area for focus work.",
    anchor: { x: 930, y: 210 },
    bounds: { x: 864, y: 64, width: 224, height: 384 },
    autoStatus: "focus",
  },
  {
    id: "it-support",
    name: "IT Support",
    type: "support",
    description: "Support area for setup, devices, and integrations.",
    anchor: { x: 1250, y: 790 },
    bounds: { x: 1120, y: 640, width: 416, height: 288 },
    autoStatus: "available",
  },
];

export function findDestinationAtPoint(x: number, y: number) {
  return officeDestinations.find((destination) => {
    const bounds = destination.bounds;
    return bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  });
}
