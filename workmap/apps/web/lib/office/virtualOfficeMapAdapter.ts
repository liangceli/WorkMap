import type { OfficeRoomZone, PlayerState, UserPresenceStatus, VirtualOfficeMapManifest } from "@workmap/shared-types";
import {
  WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST,
  isVirtualOfficePointInBounds,
  isVirtualOfficeRectInBounds,
  validateVirtualOfficeMapManifest,
} from "@workmap/shared-types";
import type {
  WorkMapApiNavigationDestination,
  WorkMapApiOfficeMap,
  WorkMapApiOfficeRoom,
  WorkMapApiPlayerPosition,
} from "../api/apiTypes";
import type { OfficeDestination } from "./officeNavigationConfig";

export type VirtualOfficeMapConfigSource = "api-manifest" | "default-manifest";

export type VirtualOfficeMapConfig = {
  manifest: VirtualOfficeMapManifest;
  source: VirtualOfficeMapConfigSource;
  warnings: string[];
};

const destinationTypes: OfficeDestination["type"][] = ["department", "room", "common_area", "desk_area", "support"];
const statuses: UserPresenceStatus[] = ["available", "busy", "focus", "idle", "break", "offline", "on_call"];

export function resolveVirtualOfficeMapConfig(apiMap?: WorkMapApiOfficeMap): VirtualOfficeMapConfig {
  const validation = apiMap ? validateVirtualOfficeMapManifest(apiMap.mapData) : null;

  if (validation?.ok) {
    return {
      manifest: validation.manifest,
      source: "api-manifest",
      warnings: validation.warnings,
    };
  }

  return {
    manifest: WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST,
    source: "default-manifest",
    warnings: validation ? [...validation.errors, ...validation.warnings] : [],
  };
}

export function getDefaultOfficeRoomZones() {
  return WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.rooms.map((room) => ({
    id: room.key,
    name: room.name,
    status: room.autoStatus,
    ...room.bounds,
  }));
}

export function getDefaultOfficeDestinations() {
  return WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.navigation.map(toDestinationFromManifest);
}

export function readApiOfficeRooms(rooms: WorkMapApiOfficeRoom[], manifest: VirtualOfficeMapManifest) {
  return rooms.map((room) => toRoomZone(room, manifest)).filter((room): room is OfficeRoomZone => Boolean(room));
}

export function readApiNavigationDestinations(
  destinations: WorkMapApiNavigationDestination[],
  manifest: VirtualOfficeMapManifest,
) {
  return destinations
    .map((destination) => toOfficeDestination(destination, manifest))
    .filter((destination): destination is OfficeDestination => Boolean(destination));
}

export function isPlayerPositionValidForMap(position: WorkMapApiPlayerPosition | PlayerState, manifest: VirtualOfficeMapManifest) {
  return isVirtualOfficePointInBounds({ x: position.x, y: position.y }, manifest);
}

export function getSpawnPlayerPatch(manifest: VirtualOfficeMapManifest) {
  return {
    x: manifest.safeFallbackSpawn.x,
    y: manifest.safeFallbackSpawn.y,
    direction: manifest.safeFallbackSpawn.direction,
  };
}

export function validateParsedTmxAgainstManifest(
  parsedMap: { width: number; height: number; tileWidth: number; tileHeight: number },
  manifest: VirtualOfficeMapManifest,
) {
  const pixelWidth = parsedMap.width * parsedMap.tileWidth;
  const pixelHeight = parsedMap.height * parsedMap.tileHeight;
  const warnings: string[] = [];

  if (pixelWidth !== manifest.dimensions.width || pixelHeight !== manifest.dimensions.height) {
    warnings.push(
      `TMX pixel size ${pixelWidth}x${pixelHeight} does not match manifest ${manifest.dimensions.width}x${manifest.dimensions.height}.`,
    );
  }

  if (parsedMap.tileWidth !== manifest.dimensions.tileSize || parsedMap.tileHeight !== manifest.dimensions.tileSize) {
    warnings.push(`TMX tile size ${parsedMap.tileWidth}x${parsedMap.tileHeight} does not match manifest tile size.`);
  }

  return warnings;
}

function toDestinationFromManifest(destination: VirtualOfficeMapManifest["navigation"][number]): OfficeDestination {
  return {
    id: destination.key,
    roomId: destination.roomKey,
    name: destination.name,
    type: destination.type,
    description: destination.description,
    anchor: destination.anchor,
    bounds: destination.bounds,
    autoStatus: destination.autoStatus,
  };
}

function toRoomZone(room: WorkMapApiOfficeRoom, manifest: VirtualOfficeMapManifest): OfficeRoomZone | null {
  const zone = readRect(room.zoneData);

  if (!zone || !isVirtualOfficeRectInBounds(zone, manifest) || typeof room.id !== "string" || typeof room.name !== "string") {
    return null;
  }

  return {
    id: room.id,
    name: room.name,
    status: toStatus(room.autoStatus, "available"),
    ...zone,
  };
}

function toOfficeDestination(destination: WorkMapApiNavigationDestination, manifest: VirtualOfficeMapManifest): OfficeDestination | null {
  const anchor = readPoint(destination.anchor);
  const bounds = readRect(destination.bounds);

  if (
    !anchor ||
    !bounds ||
    !isVirtualOfficePointInBounds(anchor, manifest) ||
    !isVirtualOfficeRectInBounds(bounds, manifest) ||
    typeof destination.id !== "string" ||
    typeof destination.name !== "string"
  ) {
    return null;
  }

  return {
    id: destination.id,
    roomId: typeof destination.roomId === "string" ? destination.roomId : undefined,
    name: destination.name,
    type: toDestinationType(destination.type),
    description: typeof destination.description === "string" ? destination.description : "WorkMap office area.",
    anchor,
    bounds,
    autoStatus: toStatus(destination.autoStatus, undefined),
  };
}

function readPoint(value: unknown): { x: number; y: number } | null {
  if (!isObject(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null;
  }

  return { x: value.x, y: value.y };
}

function readRect(value: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!isObject(value)) {
    return null;
  }

  const rect = isObject(value.bounds) ? value.bounds : value;
  if (!isFiniteNumber(rect.x) || !isFiniteNumber(rect.y) || !isFiniteNumber(rect.width) || !isFiniteNumber(rect.height)) {
    return null;
  }

  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function toDestinationType(value: string): OfficeDestination["type"] {
  return destinationTypes.includes(value as OfficeDestination["type"]) ? (value as OfficeDestination["type"]) : "room";
}

function toStatus<TFallback extends UserPresenceStatus | undefined>(
  value: UserPresenceStatus | null | undefined,
  fallback: TFallback,
): UserPresenceStatus | TFallback {
  return value && statuses.includes(value) ? value : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
