import type { OfficeRoomZone } from "@workmap/shared-types";

const ROOM_WALL_INSET_PX = 32;

export function findRoomAtPoint(x: number, y: number, rooms: OfficeRoomZone[]) {
  return rooms.find((room) => isPointInsideRoom(x, y, room));
}

export function isPointInsideRoom(x: number, y: number, room: OfficeRoomZone) {
  const insetX = Math.min(ROOM_WALL_INSET_PX, room.width / 3);
  const insetY = Math.min(ROOM_WALL_INSET_PX, room.height / 3);

  return (
    x > room.x + insetX &&
    x < room.x + room.width - insetX &&
    y > room.y + insetY &&
    y < room.y + room.height - insetY
  );
}
