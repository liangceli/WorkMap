import assert from "node:assert/strict";
import test from "node:test";
import { WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST } from "@workmap/shared-types";
import { findRoomAtPoint } from "../lib/office/roomGeometry";

const rooms = WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.rooms.map((room) => ({
  id: room.key,
  name: room.name,
  status: room.autoStatus,
  ...room.bounds,
}));

test("main horizontal and vertical corridors do not activate room focus", () => {
  assert.equal(findRoomAtPoint(960, 1345, rooms), undefined);
  assert.equal(findRoomAtPoint(1616, 1100, rooms), undefined);
});

test("each configured office activates only after crossing its wall boundary", () => {
  const points = [
    [1000, 1000, "open-office"],
    [1900, 1100, "meeting-room"],
    [1000, 1560, "focus-room"],
    [1400, 1560, "sales-zone"],
    [1840, 1560, "engineering-zone"],
    [2240, 1660, "break-room"],
  ] as const;

  for (const [x, y, roomKey] of points) {
    assert.equal(findRoomAtPoint(x, y, rooms)?.id, roomKey);
  }

  assert.equal(findRoomAtPoint(800, 1000, rooms), undefined);
  assert.equal(findRoomAtPoint(1600, 1100, rooms), undefined);
  assert.equal(findRoomAtPoint(1632, 1500, rooms), undefined);
});
