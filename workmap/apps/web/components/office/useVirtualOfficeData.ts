"use client";

import { useEffect, useState } from "react";
import type { OfficeRoomZone, PlayerDirection, PlayerState, UserPresenceStatus } from "@workmap/shared-types";
import {
  getVirtualOfficeMap,
  listVirtualOfficeNavigation,
  listVirtualOfficePositions,
} from "../../lib/api/virtualOfficeApi";
import { getDevelopmentApiAuthOptions } from "../../lib/api/developmentApiAuth";
import type {
  ApiClientOptions,
  WorkMapApiNavigationDestination,
  WorkMapApiOfficeMap,
  WorkMapApiOfficeRoom,
  WorkMapApiPlayerPosition,
} from "../../lib/api/apiTypes";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { officeDestinations } from "../../lib/office/officeNavigationConfig";
import { remotePlayers, roomZones, type RemoteOfficePlayer } from "./mockOfficeData";

type VirtualOfficeDataSource = "mock" | "api" | "partial-api";

export type VirtualOfficeData = {
  rooms: OfficeRoomZone[];
  destinations: OfficeDestination[];
  remotePlayers: RemoteOfficePlayer[];
  officeMapId?: string;
  apiOptions?: ApiClientOptions;
  currentUserId?: string;
  currentUserPosition?: PlayerState;
  source: VirtualOfficeDataSource;
};

const MOCK_DATA: VirtualOfficeData = {
  rooms: roomZones,
  destinations: officeDestinations,
  remotePlayers,
  source: "mock",
};

const destinationTypes: OfficeDestination["type"][] = ["department", "room", "common_area", "desk_area", "support"];
const statuses: UserPresenceStatus[] = ["available", "busy", "focus", "idle", "break", "offline", "on_call"];
const directions: PlayerDirection[] = ["up", "down", "left", "right"];
const PRESENCE_POLL_VISIBLE_MS = 4000;
const PRESENCE_POLL_HIDDEN_MS = 15000;
const PRESENCE_RECENT_MS = 30 * 1000;
const PRESENCE_STALE_MS = 5 * 60 * 1000;

export function useVirtualOfficeData(): VirtualOfficeData {
  const [data, setData] = useState<VirtualOfficeData>(MOCK_DATA);

  useEffect(() => {
    let cancelled = false;

    async function loadVirtualOfficeData() {
      const auth = await getDevelopmentApiAuthOptions();

      if (process.env.NODE_ENV === "development") {
        console.info(`virtual-office API auth available: ${auth.available ? `yes (${auth.source})` : "no"}`);
      }

      const apiOptions = auth.available ? auth.options : undefined;
      const currentUserId = auth.available ? auth.userId : undefined;
      const [mapResult, navigationResult] = await Promise.all([
        getVirtualOfficeMap(apiOptions),
        listVirtualOfficeNavigation(apiOptions),
      ]);

      if (cancelled) {
        return;
      }

      let nextRooms = MOCK_DATA.rooms;
      let nextDestinations = MOCK_DATA.destinations;
      let nextRemotePlayers = MOCK_DATA.remotePlayers;
      let nextOfficeMapId: string | undefined;
      let nextCurrentUserPosition: PlayerState | undefined;
      let usedApiPart = false;
      let usedMockPart = false;

      if (mapResult.ok && isApiOfficeMap(mapResult.data)) {
        nextOfficeMapId = mapResult.data.id;
        const rooms = mapResult.data.rooms.map(toRoomZone).filter((room): room is OfficeRoomZone => Boolean(room));
        if (rooms.length > 0) {
          nextRooms = rooms;
          usedApiPart = true;
        } else {
          usedMockPart = true;
        }

        const positionsResult = await listVirtualOfficePositions(mapResult.data.id, apiOptions);
        if (cancelled) {
          return;
        }

        const positionsData = readPositionsData(positionsResult, currentUserId);
        if (positionsData.ok) {
          nextCurrentUserPosition = positionsData.currentUserPosition;
          nextRemotePlayers = positionsData.remotePlayers;
          usedApiPart = true;
        } else {
          usedMockPart = true;
        }
      } else {
        usedMockPart = true;
      }

      if (navigationResult.ok && Array.isArray(navigationResult.data)) {
        const destinations = navigationResult.data
          .map(toOfficeDestination)
          .filter((destination): destination is OfficeDestination => Boolean(destination));

        if (destinations.length > 0) {
          nextDestinations = destinations;
          usedApiPart = true;
        } else {
          usedMockPart = true;
        }
      } else {
        usedMockPart = true;
      }

      const source: VirtualOfficeDataSource = usedApiPart ? (usedMockPart ? "partial-api" : "api") : "mock";
      const nextData = {
        rooms: nextRooms,
        destinations: nextDestinations,
        remotePlayers: nextRemotePlayers,
        officeMapId: nextOfficeMapId,
        apiOptions,
        currentUserId,
        currentUserPosition: nextCurrentUserPosition,
        source,
      };

      if (process.env.NODE_ENV === "development") {
        console.info(`virtual-office data source: ${usedApiPart ? "api" : "mock fallback"}`);
      }

      setData(nextData);
    }

    loadVirtualOfficeData().catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.info("virtual-office data source: mock fallback", error);
      }
      if (!cancelled) {
        setData(MOCK_DATA);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data.officeMapId || !data.apiOptions || !data.currentUserId) {
      return undefined;
    }

    let cancelled = false;
    let inFlight = false;
    let requestCounter = 0;
    let latestAppliedRequest = 0;
    let timeoutId: number | undefined;
    const officeMapId = data.officeMapId;
    const apiOptions = data.apiOptions;
    const currentUserId = data.currentUserId;

    const getPollDelay = () => (document.visibilityState === "hidden" ? PRESENCE_POLL_HIDDEN_MS : PRESENCE_POLL_VISIBLE_MS);

    const scheduleNextPoll = (delay = getPollDelay()) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        void refreshPositions();
      }, delay);
    };

    const refreshPositions = async () => {
      if (cancelled) {
        return;
      }

      if (inFlight) {
        scheduleNextPoll();
        return;
      }

      inFlight = true;
      const requestId = ++requestCounter;
      const positionsResult = await listVirtualOfficePositions(officeMapId, apiOptions);

      if (cancelled) {
        return;
      }

      inFlight = false;
      const positionsData = readPositionsData(positionsResult, currentUserId);

      if (positionsData.ok && requestId > latestAppliedRequest) {
        latestAppliedRequest = requestId;
        setData((current) => {
          if (current.officeMapId !== officeMapId || current.currentUserId !== currentUserId) {
            return current;
          }

          return {
            ...current,
            remotePlayers: positionsData.remotePlayers,
            currentUserPosition: positionsData.currentUserPosition ?? current.currentUserPosition,
            source: current.source === "mock" ? "partial-api" : current.source,
          };
        });
      } else if (!positionsData.ok && process.env.NODE_ENV === "development") {
        console.info("virtual-office positions polling fallback", positionsData.error);
      }

      scheduleNextPoll();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        void refreshPositions();
      } else {
        scheduleNextPoll(PRESENCE_POLL_HIDDEN_MS);
      }
    };

    scheduleNextPoll();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [data.apiOptions, data.currentUserId, data.officeMapId]);

  return data;
}

function readPositionsData(
  positionsResult: Awaited<ReturnType<typeof listVirtualOfficePositions>>,
  currentUserId?: string,
):
  | { ok: true; remotePlayers: RemoteOfficePlayer[]; currentUserPosition?: PlayerState }
  | { ok: false; error: string } {
  if (!positionsResult.ok || !Array.isArray(positionsResult.data)) {
    return { ok: false, error: positionsResult.ok ? "Invalid positions response." : positionsResult.error };
  }

  const apiPlayers = positionsResult.data.map(toPlayerState).filter((player): player is PlayerState => Boolean(player));
  const currentUserPosition = currentUserId ? apiPlayers.find((position) => position.userId === currentUserId) : undefined;
  const remotePlayers = positionsResult.data
    .filter((position) => !currentUserId || position.userId !== currentUserId)
    .map(toRemoteOfficePlayer)
    .filter((player): player is RemoteOfficePlayer => Boolean(player));

  return { ok: true, remotePlayers, currentUserPosition };
}

function isApiOfficeMap(value: unknown): value is WorkMapApiOfficeMap {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.id === "string" && Array.isArray(value.rooms);
}

function toRoomZone(room: WorkMapApiOfficeRoom): OfficeRoomZone | null {
  const zone = readRect(room.zoneData);
  if (!zone) {
    return null;
  }

  return {
    id: room.id,
    name: room.name,
    status: toStatus(room.autoStatus, "available"),
    ...zone,
  };
}

function toOfficeDestination(destination: WorkMapApiNavigationDestination): OfficeDestination | null {
  const anchor = readPoint(destination.anchor);
  const bounds = readRect(destination.bounds);

  if (!anchor || !bounds || typeof destination.id !== "string" || typeof destination.name !== "string") {
    return null;
  }

  return {
    id: destination.id,
    name: destination.name,
    type: toDestinationType(destination.type),
    description: "WorkMap office area.",
    anchor,
    bounds,
    autoStatus: toStatus(destination.autoStatus, undefined),
  };
}

function toRemoteOfficePlayer(position: WorkMapApiPlayerPosition): RemoteOfficePlayer | null {
  const player = toPlayerState(position);
  if (!player) {
    return null;
  }

  return {
    ...player,
    status: toFreshnessStatus(player.status, player.updatedAt),
    role: "Team member",
  };
}

function toPlayerState(position: WorkMapApiPlayerPosition): PlayerState | null {
  if (
    typeof position.userId !== "string" ||
    typeof position.displayName !== "string" ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    return null;
  }

  return {
    userId: position.userId,
    displayName: position.displayName,
    avatarId: typeof position.avatarId === "string" ? position.avatarId : "api-avatar",
    x: position.x,
    y: position.y,
    direction: directions.includes(position.direction) ? position.direction : "down",
    isMoving: Boolean(position.isMoving),
    status: toStatus(position.status, "available"),
    roomId: typeof position.roomId === "string" ? position.roomId : undefined,
    updatedAt: typeof position.updatedAt === "string" ? position.updatedAt : new Date().toISOString(),
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

  // Assumption: backend zoneData/bounds use the same pixel coordinate space as the current TMX map.
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

function toFreshnessStatus(status: UserPresenceStatus, updatedAt: string): UserPresenceStatus {
  const updatedTime = Date.parse(updatedAt);
  if (!Number.isFinite(updatedTime)) {
    return status;
  }

  const ageMs = Math.max(0, Date.now() - updatedTime);
  if (ageMs > PRESENCE_STALE_MS) {
    return "offline";
  }

  if (ageMs > PRESENCE_RECENT_MS) {
    return status === "offline" ? "offline" : "idle";
  }

  return status;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
