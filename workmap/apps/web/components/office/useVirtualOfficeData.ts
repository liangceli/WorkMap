"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type {
  OfficeRoomZone,
  PlayerDirection,
  PlayerState,
  UserPresenceStatus,
  VirtualOfficeMapManifest,
} from "@workmap/shared-types";
import {
  getVirtualOfficeMap,
  listVirtualOfficeNavigation,
  listVirtualOfficePositions,
} from "../../lib/api/virtualOfficeApi";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";
import type {
  ApiClientOptions,
  WorkMapApiOfficeMap,
  WorkMapApiPlayerPosition,
} from "../../lib/api/apiTypes";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import {
  getDefaultOfficeDestinations,
  readApiNavigationDestinations,
  readApiOfficeRooms,
  resolveVirtualOfficeMapConfig,
  isPlayerPositionValidForMap,
  type VirtualOfficeMapConfigSource,
} from "../../lib/office/virtualOfficeMapAdapter";
import { readVirtualOfficeDataCache, writeVirtualOfficeDataCache } from "../../lib/office/virtualOfficeCache";
import { remotePlayers, roomZones, type RemoteOfficePlayer } from "./mockOfficeData";
import { canAnimatePresenceMovement, statusFromFreshness } from "./presence";

type VirtualOfficeDataSource = "mock" | "api" | "partial-api";

export type VirtualOfficeData = {
  rooms: OfficeRoomZone[];
  destinations: OfficeDestination[];
  remotePlayers: RemoteOfficePlayer[];
  officeMapId?: string;
  mapManifest: VirtualOfficeMapManifest;
  mapConfigSource: VirtualOfficeMapConfigSource;
  mapValidationWarnings: string[];
  apiOptions?: ApiClientOptions;
  currentUserId?: string;
  currentUserPosition?: PlayerState;
  source: VirtualOfficeDataSource;
  loaded: boolean;
};

const MOCK_DATA: VirtualOfficeData = {
  rooms: roomZones,
  destinations: getDefaultOfficeDestinations(),
  remotePlayers,
  mapManifest: resolveVirtualOfficeMapConfig().manifest,
  mapConfigSource: "default-manifest",
  mapValidationWarnings: [],
  source: "mock",
  loaded: false,
};

const statuses: UserPresenceStatus[] = ["available", "busy", "focus", "idle", "break", "offline", "on_call"];
const directions: PlayerDirection[] = ["up", "down", "left", "right"];
const PRESENCE_POLL_VISIBLE_MS = 4000;
const PRESENCE_POLL_HIDDEN_MS = 15000;

export function useVirtualOfficeData(): VirtualOfficeData {
  const [data, setData] = useState<VirtualOfficeData>(MOCK_DATA);

  useLayoutEffect(() => {
    const cached = readVirtualOfficeDataCache();

    if (cached) {
      setData({
        ...cached,
        remotePlayers: cached.remotePlayers.map((player) => ({
          ...player,
          status: statusFromFreshness(player.status, player.updatedAt),
          isMoving: false,
        })),
        loaded: true,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVirtualOfficeData() {
      const auth = await getWorkMapApiAuthOptions();

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
      let nextMapManifest = MOCK_DATA.mapManifest;
      let nextMapConfigSource = MOCK_DATA.mapConfigSource;
      let nextMapValidationWarnings: string[] = [];
      let usedApiPart = false;
      let usedMockPart = false;

      if (mapResult.ok && isApiOfficeMap(mapResult.data)) {
        const mapConfig = resolveVirtualOfficeMapConfig(mapResult.data);
        nextOfficeMapId = mapResult.data.id;
        nextMapManifest = mapConfig.manifest;
        nextMapConfigSource = mapConfig.source;
        nextMapValidationWarnings = mapConfig.warnings;
        const rooms = readApiOfficeRooms(mapResult.data.rooms, mapConfig.manifest);

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

        const positionsData = readPositionsData(positionsResult, currentUserId, mapConfig.manifest);
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
        const destinations = readApiNavigationDestinations(navigationResult.data, nextMapManifest);

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
        mapManifest: nextMapManifest,
        mapConfigSource: nextMapConfigSource,
        mapValidationWarnings: nextMapValidationWarnings,
        apiOptions,
        currentUserId,
        currentUserPosition: nextCurrentUserPosition,
        source,
        loaded: true,
      };

      if (process.env.NODE_ENV === "development") {
        console.info(`virtual-office data source: ${usedApiPart ? "api" : "mock fallback"}`);
        if (nextMapValidationWarnings.length > 0) {
          console.info("virtual-office map manifest fallback", nextMapValidationWarnings);
        }
      }

      setData(nextData);
    }

    loadVirtualOfficeData().catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.info("virtual-office data source: mock fallback", error);
      }
      if (!cancelled) {
        setData({ ...MOCK_DATA, loaded: true });
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
      const positionsData = readPositionsData(positionsResult, currentUserId, data.mapManifest);

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
            loaded: true,
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
  }, [data.apiOptions, data.currentUserId, data.mapManifest, data.officeMapId]);

  useEffect(() => {
    if (!data.loaded || data.source === "mock") {
      return;
    }

    writeVirtualOfficeDataCache({
      rooms: data.rooms,
      destinations: data.destinations,
      remotePlayers: data.remotePlayers,
      officeMapId: data.officeMapId,
      mapManifest: data.mapManifest,
      currentUserId: data.currentUserId,
      currentUserPosition: data.currentUserPosition,
      mapConfigSource: data.mapConfigSource,
      mapValidationWarnings: data.mapValidationWarnings,
      source: data.source,
    });
  }, [data.currentUserId, data.currentUserPosition, data.destinations, data.loaded, data.mapConfigSource, data.mapManifest, data.mapValidationWarnings, data.officeMapId, data.remotePlayers, data.rooms, data.source]);

  return data;
}

function readPositionsData(
  positionsResult: Awaited<ReturnType<typeof listVirtualOfficePositions>>,
  currentUserId?: string,
  mapManifest: VirtualOfficeMapManifest = MOCK_DATA.mapManifest,
):
  | { ok: true; remotePlayers: RemoteOfficePlayer[]; currentUserPosition?: PlayerState }
  | { ok: false; error: string } {
  if (!positionsResult.ok || !Array.isArray(positionsResult.data)) {
    return { ok: false, error: positionsResult.ok ? "Invalid positions response." : positionsResult.error };
  }

  const apiPlayers = positionsResult.data
    .map((position) => toPlayerState(position, mapManifest))
    .filter((player): player is PlayerState => Boolean(player));
  const currentUserPosition = currentUserId ? apiPlayers.find((position) => position.userId === currentUserId) : undefined;
  const remotePlayers = positionsResult.data
    .filter((position) => !currentUserId || position.userId !== currentUserId)
    .map((position) => toRemoteOfficePlayer(position, mapManifest))
    .filter((player): player is RemoteOfficePlayer => Boolean(player));

  return { ok: true, remotePlayers, currentUserPosition };
}

function isApiOfficeMap(value: unknown): value is WorkMapApiOfficeMap {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.id === "string" && Array.isArray(value.rooms);
}

function toRemoteOfficePlayer(position: WorkMapApiPlayerPosition, mapManifest: VirtualOfficeMapManifest): RemoteOfficePlayer | null {
  const player = toPlayerState(position, mapManifest);
  if (!player) {
    return null;
  }

  const status = statusFromFreshness(player.status, player.updatedAt);

  return {
    ...player,
    isMoving: canAnimatePresenceMovement(status) && player.isMoving,
    status,
    role: "Team member",
  };
}

function toPlayerState(position: WorkMapApiPlayerPosition, mapManifest: VirtualOfficeMapManifest): PlayerState | null {
  if (
    typeof position.userId !== "string" ||
    typeof position.displayName !== "string" ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    return null;
  }

  if (!isPlayerPositionValidForMap(position, mapManifest)) {
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

function toStatus<TFallback extends UserPresenceStatus | undefined>(
  value: UserPresenceStatus | null | undefined,
  fallback: TFallback,
): UserPresenceStatus | TFallback {
  return value && statuses.includes(value) ? value : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
