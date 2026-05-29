import type { OfficeRoomZone, PlayerState } from "@workmap/shared-types";

export type RemoteOfficePlayer = PlayerState & {
  role: string;
};

export type OfficeTileset = {
  firstGid: number;
  columns: number;
  imagePath: string;
};

export const roomZones: OfficeRoomZone[] = [
  { id: "open-office-north", name: "Open Office", status: "available", x: 32, y: 64, width: 736, height: 384 },
  { id: "focus-room", name: "Focus Room", status: "focus", x: 864, y: 64, width: 224, height: 384 },
  { id: "meeting-room", name: "Meeting Room", status: "busy", x: 1120, y: 64, width: 416, height: 384 },
  { id: "engineering-zone", name: "Engineering Zone", status: "available", x: 32, y: 640, width: 736, height: 288 },
  { id: "sales-zone", name: "Sales Zone", status: "available", x: 864, y: 640, width: 416, height: 288 },
  { id: "break-room", name: "Break Room", status: "break", x: 1344, y: 768, width: 192, height: 160 },
];

export const remotePlayers: RemoteOfficePlayer[] = [
  {
    userId: "demo-manager",
    displayName: "Mia Manager",
    avatarId: "placeholder-manager",
    x: 1010,
    y: 210,
    direction: "down",
    isMoving: false,
    status: "busy",
    roomId: "focus-room",
    updatedAt: new Date().toISOString(),
    role: "Manager",
  },
  {
    userId: "demo-engineer",
    displayName: "Ethan Engineer",
    avatarId: "placeholder-engineer",
    x: 230,
    y: 735,
    direction: "right",
    isMoving: false,
    status: "focus",
    roomId: "engineering-zone",
    updatedAt: new Date().toISOString(),
    role: "Software Engineer",
  },
  {
    userId: "demo-sales",
    displayName: "Sofia Sales",
    avatarId: "placeholder-sales",
    x: 1005,
    y: 760,
    direction: "left",
    isMoving: false,
    status: "available",
    roomId: "sales-zone",
    updatedAt: new Date().toISOString(),
    role: "Account Executive",
  },
];

export const officeTilesets: OfficeTileset[] = [
  {
    firstGid: 1297,
    columns: 16,
    imagePath: "/modern-office/Modern_Office_32x32.png",
  },
  {
    firstGid: 449,
    columns: 16,
    imagePath: "/modern-office/Modern_Office_32x32.png",
  },
  {
    firstGid: 225,
    columns: 16,
    imagePath: "/modern-office/1_Room_Builder_Office/Room_Builder_Office_32x32.png",
  },
  {
    firstGid: 1,
    columns: 16,
    imagePath: "/modern-office/1_Room_Builder_Office/Room_Builder_Office_32x32.png",
  },
];
