"use client";

import {
  WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST,
  type OfficeRoomZone,
  type PlayerState,
  type VirtualOfficeMapManifest,
} from "@workmap/shared-types";
import { getCognitoSession } from "../auth/cognitoSession";
import type { OfficeDestination } from "./officeNavigationConfig";
import type { VirtualOfficeMapConfigSource } from "./virtualOfficeMapAdapter";
import type { RemoteOfficePlayer } from "../../components/office/mockOfficeData";

const OFFICE_DATA_CACHE_KEY = "workmap.virtualOfficeSnapshot";
const LOCAL_POSITION_CACHE_KEY = "workmap.virtualOfficeLocalPosition";
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedVirtualOfficeData = {
  rooms: OfficeRoomZone[];
  destinations: OfficeDestination[];
  remotePlayers: RemoteOfficePlayer[];
  officeMapId?: string;
  mapManifest: VirtualOfficeMapManifest;
  currentUserId?: string;
  currentUserPosition?: PlayerState;
  mapConfigSource: VirtualOfficeMapConfigSource;
  mapValidationWarnings: string[];
  source: "api" | "partial-api";
};

export type CachedLocalOfficePosition = Pick<PlayerState, "x" | "y" | "direction" | "isMoving" | "status" | "roomId"> & {
  mapKey: string;
  savedAt: string;
};

export function readVirtualOfficeDataCache(): CachedVirtualOfficeData | null {
  const cached = readCacheEnvelope(OFFICE_DATA_CACHE_KEY);

  if (!cached || !isRecord(cached.data)) {
    return null;
  }

  const data = cached.data as Partial<CachedVirtualOfficeData>;
  if (
    !Array.isArray(data.rooms) ||
    !Array.isArray(data.destinations) ||
    !Array.isArray(data.remotePlayers) ||
    !isRecord(data.mapManifest) ||
    !isVirtualOfficeMapConfigSource(data.mapConfigSource) ||
    !Array.isArray(data.mapValidationWarnings)
  ) {
    return null;
  }

  if (
    data.mapManifest.mapKey === WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.mapKey &&
    data.mapManifest.mapVersion !== WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST.mapVersion
  ) {
    return null;
  }

  return data as CachedVirtualOfficeData;
}

function isVirtualOfficeMapConfigSource(value: unknown): value is VirtualOfficeMapConfigSource {
  return value === "api-manifest" || value === "default-manifest";
}

export function writeVirtualOfficeDataCache(data: CachedVirtualOfficeData) {
  writeCacheEnvelope(OFFICE_DATA_CACHE_KEY, data);
}

export function readLocalOfficePosition(mapKey: string): CachedLocalOfficePosition | null {
  const cached = readCacheEnvelope(LOCAL_POSITION_CACHE_KEY);

  if (!cached || !isCachedLocalPosition(cached.data) || cached.data.mapKey !== mapKey) {
    return null;
  }

  return cached.data;
}

export function writeLocalOfficePosition(mapKey: string, player: PlayerState) {
  writeCacheEnvelope(LOCAL_POSITION_CACHE_KEY, {
    mapKey,
    x: Math.round(player.x),
    y: Math.round(player.y),
    direction: player.direction,
    isMoving: false,
    status: player.status,
    roomId: player.roomId,
    savedAt: new Date().toISOString(),
  } satisfies CachedLocalOfficePosition);
}

function readCacheEnvelope(storageKey: string): { data: unknown } | null {
  const cognitoSub = getCognitoSession()?.claims.sub;

  if (!cognitoSub || typeof window === "undefined") {
    return null;
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as unknown;

    if (
      !isRecord(value) ||
      value.version !== CACHE_VERSION ||
      value.cognitoSub !== cognitoSub ||
      typeof value.savedAt !== "string" ||
      Date.now() - Date.parse(value.savedAt) > CACHE_MAX_AGE_MS
    ) {
      return null;
    }

    return { data: value.data };
  } catch {
    return null;
  }
}

function writeCacheEnvelope(storageKey: string, data: unknown) {
  const cognitoSub = getCognitoSession()?.claims.sub;

  if (!cognitoSub || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify({
    version: CACHE_VERSION,
    cognitoSub,
    savedAt: new Date().toISOString(),
    data,
  }));
}

function isCachedLocalPosition(value: unknown): value is CachedLocalOfficePosition {
  return (
    isRecord(value) &&
    typeof value.mapKey === "string" &&
    typeof value.savedAt === "string" &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    (value.direction === "up" || value.direction === "down" || value.direction === "left" || value.direction === "right") &&
    typeof value.isMoving === "boolean" &&
    (value.status === "available" || value.status === "busy" || value.status === "focus" || value.status === "idle" || value.status === "break" || value.status === "offline" || value.status === "on_call") &&
    (value.roomId === undefined || typeof value.roomId === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
