import type { OfficeRoomZone, PlayerState } from "@workmap/shared-types";
import { WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST } from "@workmap/shared-types";

export type RemoteOfficePlayer = PlayerState & {
  role: string;
};

export type OfficeTileset = {
  firstGid: number;
  columns: number;
  imagePath: string;
};

export const roomZones: OfficeRoomZone[] = WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.rooms.map((room) => ({
  id: room.key,
  name: room.name,
  status: room.autoStatus,
  ...room.bounds,
}));

export const remotePlayers: RemoteOfficePlayer[] = [];

export const officeTilesets: OfficeTileset[] = [
  {
    firstGid: 121424,
    columns: 32,
    imagePath: "/maps/tilesets/complete_tileset_32x32.png",
  },
  {
    firstGid: 30960,
    columns: 176,
    imagePath: "/maps/tilesets/modern_exteriors_complete_tileset_32x32.png",
  },
  {
    firstGid: 19248,
    columns: 32,
    imagePath: "/maps/tilesets/complete_tileset_32x32.png",
  },
  {
    firstGid: 17190,
    columns: 49,
    imagePath: "/maps/tilesets/middle_lower_ground_patch_32x32.png",
  },
  {
    firstGid: 17174,
    columns: 4,
    imagePath: "/maps/tilesets/clean_dirt_path_32x32.png",
  },
  {
    firstGid: 16323,
    columns: 37,
    imagePath: "/maps/tilesets/reference_barn_market_exact_32x32.png",
  },
  {
    firstGid: 15777,
    columns: 26,
    imagePath: "/maps/tilesets/reference_cottage_exact_32x32.png",
  },
  {
    firstGid: 4065,
    columns: 32,
    imagePath: "/maps/tilesets/complete_tileset_32x32.png",
  },
  {
    firstGid: 3217,
    columns: 16,
    imagePath: "/modern-office/Modern_Office_Shadowless_32x32.png",
  },
  {
    firstGid: 2993,
    columns: 16,
    imagePath: "/modern-office/1_Room_Builder_Office/Room_Builder_Office_32x32.png",
  },
  {
    firstGid: 2145,
    columns: 16,
    imagePath: "/modern-office/Modern_Office_32x32.png",
  },
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
