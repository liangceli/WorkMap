"use client";

import { MouseEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ContactTarget,
  OfficeRoomZone,
  PlayerDirection,
  PlayerState,
  UserPresenceStatus,
  VirtualOfficeRealtimePlayerState,
} from "@workmap/shared-types";
import {
  avatarLayersByType,
  getLayeredAvatarAssets,
  type AvatarLayerAsset,
  type LayeredAvatarConfig,
} from "../../lib/avatar/avatarLayerAssets";
import { getAvatarFrameIndex, layeredAvatarFrameMap } from "../../lib/avatar/avatarFrameMaps";
import { decodeLayeredAvatarId, encodeLayeredAvatarId } from "../../lib/avatar/avatarProfile";
import { getAvatarConfigForOffice, saveLayeredAvatarConfig } from "../../lib/avatar/avatarStorage";
import { saveCurrentVirtualOfficePosition } from "../../lib/api/virtualOfficeApi";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { findGridPath, type PathBounds, type PathPoint } from "../../lib/office/pathfinding";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { FloatingRoomPill } from "./FloatingRoomPill";
import { InteractionDrawer } from "./InteractionDrawer";
import { OfficeBottomDock } from "./OfficeBottomDock";
import { OfficeCommandPalette } from "./OfficeCommandPalette";
import { OfficeIcon } from "./OfficeIcons";
import { OfficeLeftRail, type OfficePanelKey } from "./OfficeLeftRail";
import { OfficeMiniMap } from "./OfficeMiniMap";
import { OfficeSidePanel } from "./OfficeSidePanel";
import { officeTilesets, roomZones, type RemoteOfficePlayer } from "./mockOfficeData";
import { RoomContextCard } from "./RoomContextCard";
import { statusColors } from "./presence";
import { useVirtualOfficeRealtime } from "./useVirtualOfficeRealtime";
import { useVirtualOfficeData } from "./useVirtualOfficeData";
import { VirtualOfficeTopBar } from "./VirtualOfficeTopBar";
import { VirtualOfficeShell } from "./VirtualOfficeShell";

type TileLayer = {
  name: string;
  width: number;
  height: number;
  tiles: number[];
};

type ParsedMap = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: TileLayer[];
};

type ChairSpot = {
  id: string;
  x: number;
  y: number;
};

type LoadedAvatar = {
  layers: Array<{
    asset: AvatarLayerAsset;
    image?: HTMLImageElement;
  }>;
};

type LoadedAvatarMap = Record<string, LoadedAvatar>;

type ViewportSize = {
  width: number;
  height: number;
  dpr?: number;
};

type PositionSnapshot = {
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
};

type InterpolatedRemotePlayer = RemoteOfficePlayer & {
  targetX: number;
  targetY: number;
  lastRealtimeAt: number;
};

const MAP_URL = "/maps/workmap2.tmx";
const MAP_DEV_POLL_MS = 1500;
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 680;
const PLAYER_RADIUS = 14;
const PLAYER_COLLISION_DISTANCE = 34;
const PLAYER_SPEED = 180;
const AUTO_WALK_SPEED = PLAYER_SPEED * 1.5;
const PROXIMITY_DISTANCE = 80;
const CHAIR_INTERACTION_DISTANCE = 46;
const POSITION_SAVE_THROTTLE_MS = 2500;
const POSITION_SAVE_MIN_DISTANCE = 8;
const REALTIME_REMOTE_INTERPOLATION_RATE = 10;
const REALTIME_REMOTE_SNAP_DISTANCE = 260;
const REALTIME_REMOTE_STALE_MS = 20000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAP_LAYER_ORDER = [
  "Floor",
  "Carpet",
  "plants",
  "WallsPaper",
  "corner",
  "Walls",
  "Tools",
  "furniture",
  "Shadows",
  "chairs",
  "some ons on table",
] as const;
const COLLISION_LAYERS = new Set(["WallsPaper", "corner", "Walls", "Tools", "furniture", "chairs", "plants", "some ons on table"]);
const remoteAvatarConfigs: Record<string, LayeredAvatarConfig> = {
  "demo-manager": createRandomRemoteAvatarConfig("demo-manager"),
  "demo-engineer": createRandomRemoteAvatarConfig("demo-engineer"),
  "demo-sales": createRandomRemoteAvatarConfig("demo-sales"),
};
const remoteProfileRouteIds: Record<string, string> = {
  "demo-manager": "mia",
  "demo-engineer": "ethan",
  "demo-sales": "sofia",
};

export function OfficeMap() {
  const router = useRouter();
  const officeData = useVirtualOfficeData();
  const officeRooms = officeData.rooms;
  const officePeople = officeData.remotePlayers;
  const officeNavigation = officeData.destinations;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const nearestChairRef = useRef<ChairSpot | null>(null);
  const seatedChairRef = useRef<ChairSpot | null>(null);
  const preSitPositionRef = useRef<{ x: number; y: number; direction: PlayerDirection } | null>(null);
  const mapXmlRef = useRef<string | null>(null);
  const zoomRef = useRef(1);
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const officePeopleRef = useRef<RemoteOfficePlayer[]>(officePeople);
  const renderedOfficePeopleRef = useRef<RemoteOfficePlayer[]>(officePeople);
  const realtimeRemotePlayersRef = useRef(new Map<string, InterpolatedRemotePlayer>());
  const realtimeAvatarSignatureRef = useRef("");
  const sendRealtimeMovementRef = useRef<(position: PositionSnapshot) => void>(() => undefined);
  const selectedRemoteIdRef = useRef<string | null>(null);
  const autoPathRef = useRef<PathPoint[]>([]);
  const autoDestinationRef = useRef<PathPoint | null>(null);
  const latestCollisionRef = useRef<boolean[]>([]);
  const latestMapRef = useRef<ParsedMap | null>(null);
  const dragRef = useRef<{ dragging: boolean; x: number; y: number; moved: boolean }>({ dragging: false, x: 0, y: 0, moved: false });
  const restoredPositionRef = useRef(false);
  const localPlayerTouchedRef = useRef(false);
  const lastPersistedPositionRef = useRef<PositionSnapshot | null>(null);
  const restorePersistGuardRef = useRef<PositionSnapshot | null>(null);
  const lastPersistAttemptAtRef = useRef(0);
  const pendingPersistTimeoutRef = useRef<number | null>(null);
  const playerRef = useRef<PlayerState>({
    userId: "local-user",
    displayName: "You",
    avatarId: "placeholder-local",
    x: 160,
    y: 545,
    direction: "down",
    isMoving: false,
    status: "available",
    roomId: "open-office-north",
    updatedAt: new Date().toISOString(),
  });

  const [map, setMap] = useState<ParsedMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [player, setPlayer] = useState(playerRef.current);
  const [activeRoom, setActiveRoom] = useState<OfficeRoomZone | undefined>(roomZones[0]);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [nearbyTarget, setNearbyTarget] = useState<ContactTarget | null>(null);
  const [dismissedContactTargetId, setDismissedContactTargetId] = useState<string | null>(null);
  const [nearestChair, setNearestChair] = useState<ChairSpot | null>(null);
  const [seatedChair, setSeatedChair] = useState<ChairSpot | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<LayeredAvatarConfig | null>(null);
  const [avatarChecked, setAvatarChecked] = useState(false);
  const [activePanel, setActivePanel] = useState<OfficePanelKey | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<OfficeDestination | null>(null);
  const [selectedRemoteId, setSelectedRemoteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draggingMap, setDraggingMap] = useState(false);
  const [realtimeAvatarSignature, setRealtimeAvatarSignature] = useState("");

  const mapPixels = useMemo(
    () => ({
      width: (map?.width ?? 50) * (map?.tileWidth ?? 32),
      height: (map?.height ?? 30) * (map?.tileHeight ?? 32),
    }),
    [map],
  );
  const remoteAvatarConfigSignature = useMemo(() => createRemoteAvatarConfigSignature(officePeople), [officePeople]);

  const handleRealtimeRemoteState = useCallback(
    (state: VirtualOfficeRealtimePlayerState) => {
      if (state.userId === officeData.currentUserId || state.userId === playerRef.current.userId) {
        return;
      }

      applyRealtimeRemoteState(realtimeRemotePlayersRef.current, officePeopleRef.current, state);
      const nextSignature = createRemoteAvatarConfigSignature(Array.from(realtimeRemotePlayersRef.current.values()));

      if (nextSignature !== realtimeAvatarSignatureRef.current) {
        realtimeAvatarSignatureRef.current = nextSignature;
        setRealtimeAvatarSignature(nextSignature);
      }
    },
    [officeData.currentUserId],
  );

  const { connectionState: realtimeConnectionState, sendMovement: sendRealtimeMovement } = useVirtualOfficeRealtime({
    officeMapId: officeData.officeMapId,
    apiOptions: officeData.apiOptions,
    currentUserId: officeData.currentUserId,
    onRemoteState: handleRealtimeRemoteState,
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info(`virtual-office realtime: ${realtimeConnectionState}`);
    }
  }, [realtimeConnectionState]);

  useEffect(() => {
    sendRealtimeMovementRef.current = sendRealtimeMovement;
  }, [sendRealtimeMovement]);

  useEffect(() => {
    officePeopleRef.current = officePeople;
    reconcileRealtimeRemotePlayers(realtimeRemotePlayersRef.current, officePeople);
    renderedOfficePeopleRef.current = mergeRenderedRemotePlayers(officePeople, realtimeRemotePlayersRef.current);
  }, [officePeople]);

  useEffect(() => {
    selectedRemoteIdRef.current = selectedRemoteId;
  }, [selectedRemoteId]);

  useEffect(() => {
    const backendAvatarConfig = decodeLayeredAvatarId(officeData.currentUserPosition?.avatarId);
    const localAvatarConfig = getAvatarConfigForOffice();
    const apiCurrentUserRequiresBackendAvatar =
      officeData.loaded && officeData.source !== "mock" && Boolean(officeData.currentUserPosition);
    const avatarConfig = backendAvatarConfig ?? (apiCurrentUserRequiresBackendAvatar ? null : localAvatarConfig);

    if (!avatarConfig && !officeData.loaded) {
      return;
    }

    if (!avatarConfig) {
      router.replace("/onboarding/avatar");
      setAvatarChecked(true);
      return;
    }

    if (backendAvatarConfig) {
      saveLayeredAvatarConfig(backendAvatarConfig);
    }

    playerRef.current = {
      ...playerRef.current,
      avatarId: encodeLayeredAvatarId(avatarConfig),
    };
    setPlayer(playerRef.current);
    setSelectedAvatar(avatarConfig);
    setAvatarChecked(true);
  }, [officeData.currentUserPosition?.avatarId, officeData.loaded, router]);

  useEffect(() => {
    if (!officeData.currentUserPosition || restoredPositionRef.current || localPlayerTouchedRef.current) {
      return;
    }

    restoredPositionRef.current = true;
    const restoredPlayer = {
      ...playerRef.current,
      displayName: officeData.currentUserPosition.displayName,
      avatarId: officeData.currentUserPosition.avatarId,
      x: officeData.currentUserPosition.x,
      y: officeData.currentUserPosition.y,
      direction: officeData.currentUserPosition.direction,
      isMoving: false,
      status: officeData.currentUserPosition.status,
      roomId: officeData.currentUserPosition.roomId,
      updatedAt: new Date().toISOString(),
    };

    playerRef.current = restoredPlayer;
    const restoredSnapshot = toPositionSnapshot(restoredPlayer);
    lastPersistedPositionRef.current = restoredSnapshot;
    restorePersistGuardRef.current = restoredSnapshot;
    setPlayer(restoredPlayer);
  }, [officeData.currentUserPosition]);

  useEffect(() => {
    if (!avatarChecked || !selectedAvatar) {
      return undefined;
    }

    let cancelled = false;

    const loadMap = () => {
      fetch(MAP_URL, { cache: "no-store" })
        .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load map: ${response.status}`);
        }
        return response.text();
      })
      .then((xml) => {
        if (!cancelled && mapXmlRef.current !== xml) {
          mapXmlRef.current = xml;
          setMap(parseTmx(xml));
          setLoadError(null);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      });
    };

    loadMap();
    const intervalId =
      process.env.NODE_ENV === "development"
        ? window.setInterval(loadMap, MAP_DEV_POLL_MS)
        : undefined;

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [avatarChecked, selectedAvatar]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (event.key === "Escape") {
        autoPathRef.current = [];
        autoDestinationRef.current = null;
        setCommandOpen(false);
        setActivePanel(null);
        setSelectedDestination(null);
        return;
      }

      if (event.repeat && event.key.toLowerCase() === "e") {
        return;
      }

      keysRef.current.add(event.key.toLowerCase());
      if (hasMovementInput(keysRef.current)) {
        localPlayerTouchedRef.current = true;
        autoPathRef.current = [];
        autoDestinationRef.current = null;
        cameraOffsetRef.current = { x: 0, y: 0 };
      }

      if (event.key.toLowerCase() === "e" && seatedChairRef.current) {
        localPlayerTouchedRef.current = true;
        standUpFromChair();
        return;
      }

      if (event.key.toLowerCase() === "e" && nearestChairRef.current) {
        localPlayerTouchedRef.current = true;
        const chair = nearestChairRef.current;
        const nextPlayer = {
          ...playerRef.current,
          x: chair.x,
          y: chair.y - 8,
          direction: "down" as PlayerDirection,
          isMoving: false,
          status: "busy" as UserPresenceStatus,
          updatedAt: new Date().toISOString(),
        };

        preSitPositionRef.current = {
          x: playerRef.current.x,
          y: playerRef.current.y,
          direction: playerRef.current.direction,
        };
        playerRef.current = nextPlayer;
        seatedChairRef.current = chair;
        setPlayer(nextPlayer);
        setSeatedChair(chair);
        return;
      }

      if (event.key.toLowerCase() === "e" && nearbyTarget) {
        setDismissedContactTargetId(null);
        setContactTarget(nearbyTarget);
      }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [nearbyTarget]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!nearbyTarget) {
      setDismissedContactTargetId(null);
    }
  }, [nearbyTarget]);

  useEffect(() => {
    if (!officeData.officeMapId || !officeData.apiOptions) {
      return undefined;
    }

    const snapshot = toPositionSnapshot(player);
    const restoredSnapshot = restorePersistGuardRef.current;

    if (restoredSnapshot) {
      if (!isSamePositionSnapshot(snapshot, restoredSnapshot)) {
        return undefined;
      }

      restorePersistGuardRef.current = null;
    }

    const lastSnapshot = lastPersistedPositionRef.current;

    if (!lastSnapshot) {
      lastPersistedPositionRef.current = snapshot;
      return undefined;
    }

    if (!isMeaningfulPositionChange(lastSnapshot, snapshot)) {
      return undefined;
    }

    const persist = () => {
      pendingPersistTimeoutRef.current = null;
      lastPersistAttemptAtRef.current = Date.now();
      lastPersistedPositionRef.current = snapshot;

      saveCurrentVirtualOfficePosition(officeData.officeMapId!, snapshot, officeData.apiOptions).then((result) => {
        if (!result.ok && process.env.NODE_ENV === "development") {
          console.info("virtual-office position save fallback", result.error);
        }
      }).catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.info("virtual-office position save fallback", error);
        }
      });
    };

    if (pendingPersistTimeoutRef.current) {
      window.clearTimeout(pendingPersistTimeoutRef.current);
    }

    const elapsed = Date.now() - lastPersistAttemptAtRef.current;
    if (elapsed >= POSITION_SAVE_THROTTLE_MS || !player.isMoving) {
      persist();
      return undefined;
    }

    pendingPersistTimeoutRef.current = window.setTimeout(persist, POSITION_SAVE_THROTTLE_MS - elapsed);

    return () => {
      if (pendingPersistTimeoutRef.current) {
        window.clearTimeout(pendingPersistTimeoutRef.current);
        pendingPersistTimeoutRef.current = null;
      }
    };
  }, [officeData.apiOptions, officeData.officeMapId, player]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    let animationFrame = 0;
    let cancelled = false;
    let previousTime = performance.now();
    const images = new Map<string, HTMLImageElement>();
    let loadedAvatars: LoadedAvatarMap = {};
    const collision = buildCollisionGrid(map);
    latestCollisionRef.current = collision;
    latestMapRef.current = map;
    const chairs = findChairSpots(map);
    const avatarConfigs: Record<string, LayeredAvatarConfig> = {
      ...remoteAvatarConfigs,
      ...readRemoteAvatarConfigs(mergeRenderedRemotePlayers(officePeopleRef.current, realtimeRemotePlayersRef.current)),
      ...(selectedAvatar ? { [playerRef.current.userId]: selectedAvatar, "local-user": selectedAvatar } : {}),
    };
    const uniqueAssets = Array.from(
      new Map(
        Object.values(avatarConfigs)
          .flatMap((config) => getLayeredAvatarAssets(config))
          .map((asset) => [asset.id, asset]),
      ).values(),
    );

    Promise.all(
      [
        ...officeTilesets.map(
          (tileset) =>
            new Promise<void>((resolve) => {
              const image = new Image();
              image.src = tileset.imagePath;
              image.onload = () => {
                images.set(tileset.imagePath, image);
                resolve();
              };
              image.onerror = () => resolve();
            }),
        ),
        Promise.all(
          uniqueAssets.map(
            (asset) =>
              new Promise<{ asset: AvatarLayerAsset; image?: HTMLImageElement }>((resolve) => {
                const image = new Image();
                image.src = asset.src;
                image.onload = () => resolve({ asset, image });
                image.onerror = () => resolve({ asset });
              }),
          ),
        ).then((loadedAssets) => {
          const imageByAssetId = new Map(loadedAssets.map((loaded) => [loaded.asset.id, loaded.image]));
          loadedAvatars = Object.fromEntries(
            Object.entries(avatarConfigs).map(([userId, config]) => [
              userId,
              {
                layers: getLayeredAvatarAssets(config).map((asset) => ({
                  asset,
                  image: imageByAssetId.get(asset.id),
                })),
              },
            ]),
          );
        }),
      ],
    ).then(() => {
      if (cancelled) {
        return;
      }

      const loop = (time: number) => {
        const deltaSeconds = Math.min((time - previousTime) / 1000, 0.04);
        previousTime = time;

        const wantsToMove = hasMovementInput(keysRef.current);

        if (seatedChairRef.current && wantsToMove) {
          standUpFromChair();
        }

        const nextPlayer = seatedChairRef.current
          ? {
              ...playerRef.current,
              x: seatedChairRef.current.x,
              y: seatedChairRef.current.y - 8,
              direction: "down" as PlayerDirection,
              isMoving: false,
              status: "busy" as UserPresenceStatus,
              updatedAt: new Date().toISOString(),
            }
          : wantsToMove
            ? movePlayer(playerRef.current, keysRef.current, deltaSeconds, map, collision)
            : moveAlongAutoPath(playerRef.current, deltaSeconds, map, collision, autoPathRef, autoDestinationRef);
        const renderedRemotePlayers = updateRenderedRemotePlayers(
          officePeopleRef.current,
          realtimeRemotePlayersRef.current,
          deltaSeconds,
        );
        renderedOfficePeopleRef.current = renderedRemotePlayers;
        const room = findRoom(nextPlayer.x, nextPlayer.y, officeRooms);
        const nearest = findNearbyPlayer(nextPlayer, renderedRemotePlayers);
        const chair = seatedChairRef.current ? null : findNearestChair(nextPlayer, chairs);

        nextPlayer.roomId = room?.id;
        nextPlayer.status = seatedChairRef.current ? "busy" : room?.status ?? "available";
        nextPlayer.updatedAt = new Date().toISOString();
        playerRef.current = nextPlayer;
        nearestChairRef.current = chair;

        setPlayer(nextPlayer);
        setActiveRoom(room);
        setNearbyTarget(nearest);
        setNearestChair(chair);
        sendRealtimeMovementRef.current(toPositionSnapshot(nextPlayer));
        drawScene(
          canvasRef.current,
          map,
          images,
          nextPlayer,
          mapPixels,
          room,
          nearest,
          chair,
          seatedChairRef.current,
          loadedAvatars,
          renderedRemotePlayers,
          selectedRemoteIdRef.current,
          autoDestinationRef.current,
          zoomRef.current,
          cameraOffsetRef.current,
        );

        animationFrame = requestAnimationFrame(loop);
      };

      animationFrame = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [map, mapPixels, officeRooms, realtimeAvatarSignature, remoteAvatarConfigSignature, selectedAvatar]);

  const standUpFromChair = useCallback(() => {
    const fallback = seatedChairRef.current
      ? { x: seatedChairRef.current.x, y: seatedChairRef.current.y + 42, direction: "down" as PlayerDirection }
      : null;
    const standPosition = preSitPositionRef.current ?? fallback;

    seatedChairRef.current = null;
    preSitPositionRef.current = null;
    setSeatedChair(null);

    if (!standPosition) {
      return;
    }

    const nextPlayer = {
      ...playerRef.current,
      x: standPosition.x,
      y: standPosition.y,
      direction: standPosition.direction,
      isMoving: false,
      status: "available" as UserPresenceStatus,
      updatedAt: new Date().toISOString(),
    };

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);
  }, []);

  const handleCanvasClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!map || dragRef.current.moved) {
        return;
      }

      const { x, y } = getWorldPointFromEvent(event, mapPixels);
      const remote = renderedOfficePeopleRef.current.find((candidate) => distance(candidate, { x, y }) <= 28);

      if (remote) {
        setDismissedContactTargetId(null);
        setSelectedRemoteId(remote.userId);
        setContactTarget({
          userId: remote.userId,
          displayName: remote.displayName,
          role: remote.role,
          status: remote.status,
        });
        return;
      }

      const destination = findDestinationAtPoint(x, y, officeNavigation);
      if (destination) {
        setSelectedDestination(destination);
      }
    },
    [map, mapPixels, officeNavigation],
  );

  const handleCanvasDoubleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!map) {
        return;
      }

      const point = getWorldPointFromEvent(event, mapPixels);
      startAutoWalk(point);
    },
    [map, mapPixels],
  );

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { dragging: true, x: event.clientX, y: event.clientY, moved: false };
    setDraggingMap(true);
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.dragging) {
      return;
    }

    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;

    if (Math.abs(dx) + Math.abs(dy) > 2) {
      dragRef.current.moved = true;
    }

    cameraOffsetRef.current = {
      x: cameraOffsetRef.current.x - dx / zoomRef.current,
      y: cameraOffsetRef.current.y - dy / zoomRef.current,
    };
    dragRef.current.x = event.clientX;
    dragRef.current.y = event.clientY;
  };

  const handleMouseUp = () => {
    dragRef.current.dragging = false;
    window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 0);
    setDraggingMap(false);
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const previousZoom = zoomRef.current;
    const nextZoom = clamp(previousZoom + (event.deltaY > 0 ? -0.1 : 0.1), 0.4, 2);
    const before = getWorldPointFromEvent(event, mapPixels);
    zoomRef.current = nextZoom;
    const after = getWorldPointFromEvent(event, mapPixels);
    cameraOffsetRef.current = {
      x: cameraOffsetRef.current.x + before.x - after.x,
      y: cameraOffsetRef.current.y + before.y - after.y,
    };
    setZoom(nextZoom);
  };

  const getWorldPointFromEvent = (event: MouseEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>, pixels = mapPixels) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const camera = getCamera(playerRef.current, pixels, zoomRef.current, cameraOffsetRef.current, {
      width: rect.width,
      height: rect.height,
    });

    return {
      x: (event.clientX - rect.left) / zoomRef.current + camera.x,
      y: (event.clientY - rect.top) / zoomRef.current + camera.y,
    };
  };

  const drawerTarget =
    contactTarget ?? (nearbyTarget && nearbyTarget.userId !== dismissedContactTargetId ? nearbyTarget : null);

  const closeInteractionDrawer = () => {
    if (nearbyTarget) {
      setDismissedContactTargetId(nearbyTarget.userId);
    }

    setContactTarget(null);
  };

  const startAutoWalk = (destination: PathPoint, options?: { endBounds?: PathBounds }) => {
    if (!latestMapRef.current) {
      return false;
    }

    localPlayerTouchedRef.current = true;

    const path = findGridPath(
      {
        width: latestMapRef.current.width,
        height: latestMapRef.current.height,
        tileWidth: latestMapRef.current.tileWidth,
        tileHeight: latestMapRef.current.tileHeight,
        blocked: latestCollisionRef.current,
      },
      playerRef.current,
      destination,
      { endBounds: options?.endBounds },
    );

    if (!path || path.length === 0) {
      setToast("No clear path");
      autoPathRef.current = [];
      autoDestinationRef.current = null;
      return false;
    }

    autoPathRef.current = path;
    autoDestinationRef.current = path[path.length - 1];
    cameraOffsetRef.current = { x: 0, y: 0 };
    return true;
  };

  const goToRemotePlayer = (remote: RemoteOfficePlayer) => {
    const latestRemote = renderedOfficePeopleRef.current.find((candidate) => candidate.userId === remote.userId) ?? remote;
    setSelectedRemoteId(remote.userId);
    startAutoWalk({ x: latestRemote.x - 48, y: latestRemote.y + 12 });
  };

  const goToDestination = (destination: OfficeDestination) => {
    setSelectedDestination(destination);
    startAutoWalk(destination.anchor, { endBounds: destination.bounds });
  };

  const handleSelectRemote = (target: ContactTarget) => {
    setDismissedContactTargetId(null);
    setSelectedRemoteId(target.userId);
    setContactTarget(target);
  };

  const recenterCamera = () => {
    cameraOffsetRef.current = { x: 0, y: 0 };
    setZoom(zoomRef.current);
  };

  const setOfficeZoom = (nextZoom: number) => {
    zoomRef.current = clamp(nextZoom, 0.4, 2);
    setZoom(zoomRef.current);
  };

  const openPanel = (panel: OfficePanelKey) => {
    if (panel === "search") {
      setCommandOpen(true);
      return;
    }
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const peopleInDestination = (destination: OfficeDestination) =>
    officePeople.filter((remote) => destination.bounds && remote.x >= destination.bounds.x && remote.x <= destination.bounds.x + destination.bounds.width && remote.y >= destination.bounds.y && remote.y <= destination.bounds.y + destination.bounds.height).length;

  if (!avatarChecked || !selectedAvatar) {
    return (
      <main style={styles.page}>
        <section style={styles.shell}>
          <div style={styles.card}>
            <p style={styles.panelLabel}>Avatar setup</p>
            <p style={styles.panelText}>Taking you to avatar selection...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <VirtualOfficeShell>
        <VirtualOfficeTopBar
          status={player.status}
          currentArea={activeRoom?.name ?? "Office"}
          onSearch={() => setCommandOpen(true)}
        />
        <OfficeLeftRail activePanel={activePanel} onSelectPanel={openPanel} />
        <OfficeSidePanel
          activePanel={activePanel}
          people={officePeople}
          currentUser={player}
          presenceSource={officeData.source}
          destinations={officeNavigation}
          onClose={() => setActivePanel(null)}
          onSelectPerson={handleSelectRemote}
          onGoToPerson={goToRemotePlayer}
          onGoToDestination={goToDestination}
          onOpenPanel={setActivePanel}
          toast={setToast}
        />

        <div style={styles.canvasPanel}>
          {loadError ? <div style={styles.error}>{loadError}</div> : null}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ ...styles.canvas, cursor: draggingMap ? "grabbing" : "grab" }}
          />
        </div>

        <div style={styles.mapControls}>
          <button type="button" onClick={() => setOfficeZoom(zoomRef.current + 0.1)} style={styles.mapControlButton} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setOfficeZoom(zoomRef.current - 0.1)} style={styles.mapControlButton} aria-label="Zoom out">-</button>
          <button type="button" onClick={recenterCamera} style={styles.mapControlButton} aria-label="Recenter map">
            <OfficeIcon name="target" size={22} />
          </button>
          <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        </div>

        <FloatingRoomPill
          room={activeRoom}
          seated={Boolean(seatedChair)}
          chairNearby={Boolean(nearestChair)}
          elevated={Boolean(drawerTarget)}
        />
        {map ? (
          <OfficeMiniMap
            map={map}
            player={player}
            tilesets={officeTilesets}
            shifted={Boolean(activePanel)}
          />
        ) : null}
        <OfficeBottomDock
          status={player.status}
          hidden={Boolean(drawerTarget)}
          onSearch={() => setCommandOpen(true)}
          onOpenChat={() => setActivePanel("chat")}
          onOpenCalendar={() => setActivePanel("calendar")}
          onWave={() => setToast("You waved to nearby teammates.")}
          onEmoji={() => setToast("Emoji options are frontend-only in this MVP.")}
          onToast={setToast}
        />
        {drawerTarget ? (
          <InteractionDrawer
            target={drawerTarget}
            onClose={closeInteractionDrawer}
            onGoTo={() => {
              const remote =
                renderedOfficePeopleRef.current.find((candidate) => candidate.userId === drawerTarget.userId) ??
                officePeople.find((candidate) => candidate.userId === drawerTarget.userId);
              if (remote) goToRemotePlayer(remote);
            }}
            onOpenChat={() => {
              setActivePanel("chat");
              setToast(`Opening quick message with ${drawerTarget.displayName}`);
            }}
            onSchedule={() => {
              setActivePanel("calendar");
              setToast(`Scheduling with ${drawerTarget.displayName}`);
            }}
            onViewProfile={() => router.push(`/employees/${remoteProfileRouteIds[drawerTarget.userId] ?? drawerTarget.userId}`)}
          />
        ) : null}
        {selectedDestination ? (
          <RoomContextCard
            destination={selectedDestination}
            peopleCount={peopleInDestination(selectedDestination)}
            onGoTo={() => goToDestination(selectedDestination)}
            onViewPeople={() => setActivePanel("people")}
            onClose={() => setSelectedDestination(null)}
          />
        ) : null}
        <OfficeCommandPalette
          open={commandOpen}
          people={officePeople}
          destinations={officeNavigation}
          onClose={() => setCommandOpen(false)}
          onSelectPerson={(target) => {
            handleSelectRemote(target);
            setCommandOpen(false);
          }}
          onGoToPerson={(remote) => {
            goToRemotePlayer(remote);
            setCommandOpen(false);
          }}
          onSelectDestination={(destination) => {
            setSelectedDestination(destination);
            setCommandOpen(false);
          }}
          onGoToDestination={(destination) => {
            goToDestination(destination);
            setCommandOpen(false);
          }}
          onNavigate={(href) => router.push(href)}
        />
        {toast ? <div style={styles.toast}>{toast}</div> : null}
      </VirtualOfficeShell>
    </main>
  );
}

function parseTmx(xml: string): ParsedMap {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const mapElement = document.querySelector("map");

  if (!mapElement) {
    throw new Error("TMX map element not found.");
  }

  const layers = Array.from(document.querySelectorAll("layer")).map((layer) => {
    const data = layer.querySelector("data")?.textContent ?? "";

    return {
      name: layer.getAttribute("name") ?? "Layer",
      width: Number(layer.getAttribute("width") ?? "0"),
      height: Number(layer.getAttribute("height") ?? "0"),
      tiles: data
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value)),
    };
  }).sort((left, right) => getLayerOrder(left.name) - getLayerOrder(right.name));

  return {
    width: Number(mapElement.getAttribute("width") ?? "0"),
    height: Number(mapElement.getAttribute("height") ?? "0"),
    tileWidth: Number(mapElement.getAttribute("tilewidth") ?? "32"),
    tileHeight: Number(mapElement.getAttribute("tileheight") ?? "32"),
    layers,
  };
}

function getLayerOrder(layerName: string) {
  const index = MAP_LAYER_ORDER.indexOf(layerName as (typeof MAP_LAYER_ORDER)[number]);
  return index === -1 ? MAP_LAYER_ORDER.length : index;
}

function drawScene(
  canvas: HTMLCanvasElement | null,
  map: ParsedMap,
  images: Map<string, HTMLImageElement>,
  player: PlayerState,
  mapPixels: { width: number; height: number },
  activeRoom?: OfficeRoomZone,
  nearbyTarget?: ContactTarget | null,
  nearestChair?: ChairSpot | null,
  seatedChair?: ChairSpot | null,
  avatars?: LoadedAvatarMap,
  remotePlayers: RemoteOfficePlayer[] = [],
  selectedRemoteId?: string | null,
  destinationMarker?: PathPoint | null,
  zoom = 1,
  cameraOffset = { x: 0, y: 0 },
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const viewport = syncCanvasViewport(canvas);
  const camera = getCamera(player, mapPixels, zoom, cameraOffset, viewport);
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.fillStyle = "#eef2f7";
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.save();
  context.imageSmoothingEnabled = false;
  const snappedCameraX = Math.round(camera.x * zoom * viewport.dpr) / (zoom * viewport.dpr);
  const snappedCameraY = Math.round(camera.y * zoom * viewport.dpr) / (zoom * viewport.dpr);
  context.scale(zoom, zoom);
  context.translate(-snappedCameraX, -snappedCameraY);

  for (const layer of map.layers) {
    drawLayer(context, layer, map, images);
  }

  if (nearestChair) {
    drawChairHint(context, nearestChair, "Press E");
  }

  if (seatedChair) {
    drawChairHint(context, seatedChair, "Seated");
  }

  if (destinationMarker) {
    drawDestinationMarker(context, destinationMarker);
  }

  const localOverRemote = isOverlappingRemotePlayer(player.x, player.y, remotePlayers);

  for (const remote of remotePlayers) {
    drawPlayer(
      context,
      remote,
      remote.displayName,
      nearbyTarget?.userId === remote.userId || selectedRemoteId === remote.userId,
      false,
      false,
      avatars?.[remote.userId],
    );
  }

  drawPlayer(context, player, "You", false, true, Boolean(seatedChair), avatars?.[player.userId], localOverRemote);
  context.restore();
}

function drawLayer(
  context: CanvasRenderingContext2D,
  layer: TileLayer,
  map: ParsedMap,
  images: Map<string, HTMLImageElement>,
) {
  for (let index = 0; index < layer.tiles.length; index += 1) {
    const rawGid = layer.tiles[index];
    const gid = rawGid & 0x1fffffff;

    if (!gid) {
      continue;
    }

    const tileset = officeTilesets.find((candidate) => gid >= candidate.firstGid);
    const image = tileset ? images.get(tileset.imagePath) : undefined;

    if (!tileset || !image) {
      continue;
    }

    const localId = gid - tileset.firstGid;
    const sourceX = (localId % tileset.columns) * map.tileWidth;
    const sourceY = Math.floor(localId / tileset.columns) * map.tileHeight;
    const targetX = (index % layer.width) * map.tileWidth;
    const targetY = Math.floor(index / layer.width) * map.tileHeight;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      map.tileWidth,
      map.tileHeight,
      targetX,
      targetY,
      map.tileWidth,
      map.tileHeight,
    );
  }
}

function syncCanvasViewport(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  return { width, height, dpr };
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  label: string,
  highlighted = false,
  local = false,
  seated = false,
  avatar?: LoadedAvatar,
  translucent = false,
) {
  context.save();
  const bob = player.isMoving && !seated ? Math.sin(Date.now() / 95) * 2 : 0;
  const drawY = player.y + bob;
  context.textAlign = "center";
  context.font = "600 12px Arial";
  context.fillStyle = "rgba(15, 23, 42, 0.18)";
  context.beginPath();
  context.ellipse(player.x, player.y + 17, player.isMoving ? 22 : 20, player.isMoving ? 8 : 7, 0, 0, Math.PI * 2);
  context.fill();
  if (translucent) {
    context.globalAlpha = 0.58;
  }

  const hasAvatarImage = Boolean(avatar?.layers.some((layer) => layer.image));

  if (hasAvatarImage && avatar) {
    context.strokeStyle = highlighted ? wm.colors.text : statusColors[player.status];
    context.lineWidth = highlighted ? 3 : 2;
    context.beginPath();
    context.ellipse(player.x, player.y + 17, highlighted ? 25 : 22, highlighted ? 10 : 8, 0, 0, Math.PI * 2);
    context.stroke();
    drawAvatarSprite(context, player, drawY, seated, avatar);
  } else {
    context.strokeStyle = highlighted ? wm.colors.text : statusColors[player.status];
    context.lineWidth = highlighted ? 4 : 3;
    context.fillStyle = local ? wm.colors.secondary : wm.colors.background;
    if (seated) {
      context.beginPath();
      context.roundRect(player.x - 18, drawY - 10, 36, 25, 7);
      context.fill();
      context.stroke();
    } else {
      context.beginPath();
      context.arc(player.x, drawY, PLAYER_RADIUS, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    context.fillStyle = local ? wm.colors.surface : wm.colors.text;
    context.font = "700 14px Arial";
    context.fillText(seated ? "SIT" : local ? "YOU" : "WM", player.x, drawY + 5);

    if (!seated) {
      drawDirectionCue(context, player.x, drawY, player.direction);
    }
  }

  context.globalAlpha = 1;
  drawNameBubble(context, player.x, hasAvatarImage ? drawY - 58 : drawY - 38, label, player.status);
  context.restore();
}

function drawNameBubble(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  status: UserPresenceStatus,
) {
  context.save();
  context.font = "600 12px Arial";
  context.textAlign = "left";
  context.textBaseline = "middle";

  const textWidth = context.measureText(label).width;
  const bubbleWidth = Math.max(54, textWidth + 34);
  const bubbleHeight = 24;
  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = y - bubbleHeight / 2;

  context.fillStyle = "rgba(15, 23, 42, 0.92)";
  context.beginPath();
  context.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 9);
  context.fill();

  context.fillStyle = statusColors[status];
  context.beginPath();
  context.arc(bubbleX + 13, y, 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = wm.colors.background;
  context.fillText(label, bubbleX + 24, y + 0.5);

  context.fillStyle = "rgba(15, 23, 42, 0.92)";
  context.beginPath();
  context.moveTo(x - 5, bubbleY + bubbleHeight - 1);
  context.lineTo(x + 5, bubbleY + bubbleHeight - 1);
  context.lineTo(x, bubbleY + bubbleHeight + 6);
  context.closePath();
  context.fill();
  context.restore();
}

function drawAvatarSprite(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  drawY: number,
  seated: boolean,
  avatar: LoadedAvatar,
) {
  if (!avatar.layers.some((layer) => layer.image)) {
    return;
  }

  const frameIndex = getAvatarFrameIndex(layeredAvatarFrameMap, player.direction, player.isMoving, seated, Date.now());
  const firstLayer = avatar.layers.find((layer) => layer.image);
  if (!firstLayer) {
    return;
  }

  const firstSourceHeight = firstLayer.asset.sourceHeight ?? firstLayer.asset.frameHeight;
  const targetWidth = firstLayer.asset.frameWidth * 1.25;
  const targetHeight = firstSourceHeight * 1.25;
  context.imageSmoothingEnabled = false;
  for (const { asset, image } of avatar.layers) {
    if (!image) {
      continue;
    }

    const sourceHeight = asset.sourceHeight ?? asset.frameHeight;
    const sourceYOffset = asset.sourceYOffset ?? 0;
    const sourceX = (frameIndex % asset.columns) * asset.frameWidth;
    const sourceY = Math.max(0, Math.floor(frameIndex / asset.columns) * asset.frameHeight + sourceYOffset);
    if (sourceX + asset.frameWidth > image.width || sourceY + sourceHeight > image.height) {
      continue;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      asset.frameWidth,
      sourceHeight,
      player.x - targetWidth / 2,
      drawY - targetHeight + 18,
      targetWidth,
      targetHeight,
    );
  }
  context.imageSmoothingEnabled = true;
}

function drawDirectionCue(context: CanvasRenderingContext2D, x: number, y: number, direction: PlayerDirection) {
  const points: Record<PlayerDirection, Array<[number, number]>> = {
    up: [
      [x, y - 20],
      [x - 5, y - 13],
      [x + 5, y - 13],
    ],
    down: [
      [x, y + 20],
      [x - 5, y + 13],
      [x + 5, y + 13],
    ],
    left: [
      [x - 20, y],
      [x - 13, y - 5],
      [x - 13, y + 5],
    ],
    right: [
      [x + 20, y],
      [x + 13, y - 5],
      [x + 13, y + 5],
    ],
  };

  context.fillStyle = "rgba(15, 23, 42, 0.65)";
  context.beginPath();
  points[direction].forEach(([pointX, pointY], index) => {
    if (index === 0) {
      context.moveTo(pointX, pointY);
      return;
    }

    context.lineTo(pointX, pointY);
  });
  context.closePath();
  context.fill();
}

function drawChairHint(context: CanvasRenderingContext2D, chair: ChairSpot, label: string) {
  context.save();
  context.strokeStyle = wm.colors.text;
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(chair.x - 20, chair.y - 20, 40, 40, 8);
  context.stroke();
  context.fillStyle = wm.colors.text;
  context.textAlign = "center";
  context.font = "700 11px Arial";
  context.fillText(label, chair.x, chair.y - 25);
  context.restore();
}

function drawDestinationMarker(context: CanvasRenderingContext2D, point: PathPoint) {
  context.save();
  context.strokeStyle = wm.colors.secondary;
  context.fillStyle = "rgba(37, 99, 235, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(point.x, point.y, 14, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = wm.colors.secondary;
  context.beginPath();
  context.arc(point.x, point.y, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function movePlayer(
  player: PlayerState,
  keys: Set<string>,
  deltaSeconds: number,
  map: ParsedMap,
  collision: boolean[],
): PlayerState {
  let dx = 0;
  let dy = 0;
  let direction = player.direction;

  if (keys.has("arrowleft") || keys.has("a")) {
    dx -= 1;
    direction = "left";
  }
  if (keys.has("arrowright") || keys.has("d")) {
    dx += 1;
    direction = "right";
  }
  if (keys.has("arrowup") || keys.has("w")) {
    dy -= 1;
    direction = "up";
  }
  if (keys.has("arrowdown") || keys.has("s")) {
    dy += 1;
    direction = "down";
  }

  const length = Math.hypot(dx, dy) || 1;
  const step = PLAYER_SPEED * deltaSeconds;
  const next = { ...player, direction, isMoving: dx !== 0 || dy !== 0 };
  const nextX = player.x + (dx / length) * step;
  const nextY = player.y + (dy / length) * step;

  if (!isBlocked(nextX, player.y, map, collision)) {
    next.x = clamp(nextX, PLAYER_RADIUS, map.width * map.tileWidth - PLAYER_RADIUS);
  }
  if (!isBlocked(next.x, nextY, map, collision)) {
    next.y = clamp(nextY, PLAYER_RADIUS, map.height * map.tileHeight - PLAYER_RADIUS);
  }

  return next;
}

function moveAlongAutoPath(
  player: PlayerState,
  deltaSeconds: number,
  map: ParsedMap,
  collision: boolean[],
  pathRef: { current: PathPoint[] },
  destinationRef: { current: PathPoint | null },
): PlayerState {
  const target = pathRef.current[0];

  if (!target) {
    destinationRef.current = null;
    return { ...player, isMoving: false };
  }

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distanceToTarget = Math.hypot(dx, dy);

  if (distanceToTarget < 5) {
    pathRef.current = pathRef.current.slice(1);
    if (pathRef.current.length === 0) {
      destinationRef.current = null;
    }
    return { ...player, x: target.x, y: target.y, isMoving: pathRef.current.length > 0 };
  }

  const step = Math.min(AUTO_WALK_SPEED * deltaSeconds, distanceToTarget);
  const nextX = player.x + (dx / distanceToTarget) * step;
  const nextY = player.y + (dy / distanceToTarget) * step;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

  if (isBlocked(nextX, nextY, map, collision)) {
    pathRef.current = [];
    destinationRef.current = null;
    return { ...player, isMoving: false };
  }

  return {
    ...player,
    x: nextX,
    y: nextY,
    direction,
    isMoving: true,
  };
}

function hasMovementInput(keys: Set<string>) {
  return (
    keys.has("arrowleft") ||
    keys.has("a") ||
    keys.has("arrowright") ||
    keys.has("d") ||
    keys.has("arrowup") ||
    keys.has("w") ||
    keys.has("arrowdown") ||
    keys.has("s")
  );
}

function buildCollisionGrid(map: ParsedMap) {
  const collision = Array.from({ length: map.width * map.height }, () => false);

  for (const layer of map.layers) {
    if (!COLLISION_LAYERS.has(layer.name)) {
      continue;
    }

    layer.tiles.forEach((rawGid, index) => {
      if ((rawGid & 0x1fffffff) !== 0) {
        collision[index] = true;
      }
    });
  }

  return collision;
}

function isBlocked(x: number, y: number, map: ParsedMap, collision: boolean[]) {
  const points = [
    [x - PLAYER_RADIUS + 4, y - PLAYER_RADIUS + 6],
    [x + PLAYER_RADIUS - 4, y - PLAYER_RADIUS + 6],
    [x - PLAYER_RADIUS + 4, y + PLAYER_RADIUS - 2],
    [x + PLAYER_RADIUS - 4, y + PLAYER_RADIUS - 2],
  ];

  return points.some(([pointX, pointY]) => {
    const tileX = Math.floor(pointX / map.tileWidth);
    const tileY = Math.floor(pointY / map.tileHeight);

    if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
      return true;
    }

    return collision[tileY * map.width + tileX];
  });
}

function isOverlappingRemotePlayer(x: number, y: number, remotePlayers: RemoteOfficePlayer[]) {
  return remotePlayers.some((remote) => distance({ x, y }, remote) < PLAYER_COLLISION_DISTANCE);
}

function findRoom(x: number, y: number, roomZones: OfficeRoomZone[]) {
  return roomZones.find((room) => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height);
}

function findNearbyPlayer(player: PlayerState, remotePlayers: RemoteOfficePlayer[]): ContactTarget | null {
  const nearby = remotePlayers.find((candidate) => distance(player, candidate) <= PROXIMITY_DISTANCE);

  if (!nearby) {
    return null;
  }

  return {
    userId: nearby.userId,
    displayName: nearby.displayName,
    role: nearby.role,
    status: nearby.status,
  };
}

function findDestinationAtPoint(x: number, y: number, destinations: OfficeDestination[]) {
  return destinations.find((destination) => {
    const bounds = destination.bounds;
    return bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  });
}

function toPositionSnapshot(player: PlayerState): PositionSnapshot {
  return {
    x: Math.round(player.x),
    y: Math.round(player.y),
    direction: player.direction,
    isMoving: player.isMoving,
    status: player.status,
    roomId: player.roomId && UUID_PATTERN.test(player.roomId) ? player.roomId : undefined,
  };
}

function isSamePositionSnapshot(previous: PositionSnapshot, next: PositionSnapshot) {
  return (
    previous.x === next.x &&
    previous.y === next.y &&
    previous.direction === next.direction &&
    previous.isMoving === next.isMoving &&
    previous.status === next.status &&
    previous.roomId === next.roomId
  );
}

function isMeaningfulPositionChange(previous: PositionSnapshot, next: PositionSnapshot) {
  return (
    Math.hypot(previous.x - next.x, previous.y - next.y) >= POSITION_SAVE_MIN_DISTANCE ||
    previous.direction !== next.direction ||
    previous.isMoving !== next.isMoving ||
    previous.status !== next.status ||
    previous.roomId !== next.roomId
  );
}

function applyRealtimeRemoteState(
  realtimePlayers: Map<string, InterpolatedRemotePlayer>,
  pollingPlayers: RemoteOfficePlayer[],
  state: VirtualOfficeRealtimePlayerState,
) {
  const now = Date.now();
  const previous = realtimePlayers.get(state.userId);
  const pollingPlayer = pollingPlayers.find((candidate) => candidate.userId === state.userId);
  const startX = previous?.x ?? pollingPlayer?.x ?? state.x;
  const startY = previous?.y ?? pollingPlayer?.y ?? state.y;
  const shouldSnap =
    !previous ||
    now - previous.lastRealtimeAt > REALTIME_REMOTE_STALE_MS ||
    Math.hypot(state.x - startX, state.y - startY) > REALTIME_REMOTE_SNAP_DISTANCE;

  realtimePlayers.set(state.userId, {
    userId: state.userId,
    displayName: state.displayName,
    avatarId: state.avatarId,
    role: state.role,
    x: shouldSnap ? state.x : startX,
    y: shouldSnap ? state.y : startY,
    targetX: state.x,
    targetY: state.y,
    direction: state.direction,
    isMoving: state.isMoving,
    status: state.status,
    roomId: state.roomId,
    updatedAt: state.updatedAt,
    lastRealtimeAt: now,
  });
}

function reconcileRealtimeRemotePlayers(
  realtimePlayers: Map<string, InterpolatedRemotePlayer>,
  pollingPlayers: RemoteOfficePlayer[],
) {
  const now = Date.now();
  const pollingById = new Map(pollingPlayers.map((player) => [player.userId, player]));

  for (const [userId, realtimePlayer] of realtimePlayers) {
    const pollingPlayer = pollingById.get(userId);

    if (now - realtimePlayer.lastRealtimeAt > REALTIME_REMOTE_STALE_MS) {
      realtimePlayers.delete(userId);
      continue;
    }

    if (pollingPlayer) {
      realtimePlayer.displayName = pollingPlayer.displayName;
      realtimePlayer.avatarId = pollingPlayer.avatarId;
      realtimePlayer.role = pollingPlayer.role;
    }
  }
}

function updateRenderedRemotePlayers(
  pollingPlayers: RemoteOfficePlayer[],
  realtimePlayers: Map<string, InterpolatedRemotePlayer>,
  deltaSeconds: number,
) {
  reconcileRealtimeRemotePlayers(realtimePlayers, pollingPlayers);

  for (const realtimePlayer of realtimePlayers.values()) {
    const dx = realtimePlayer.targetX - realtimePlayer.x;
    const dy = realtimePlayer.targetY - realtimePlayer.y;
    const distanceToTarget = Math.hypot(dx, dy);

    if (distanceToTarget > REALTIME_REMOTE_SNAP_DISTANCE) {
      realtimePlayer.x = realtimePlayer.targetX;
      realtimePlayer.y = realtimePlayer.targetY;
      continue;
    }

    if (distanceToTarget <= 1) {
      realtimePlayer.x = realtimePlayer.targetX;
      realtimePlayer.y = realtimePlayer.targetY;
      continue;
    }

    const alpha = Math.min(1, deltaSeconds * REALTIME_REMOTE_INTERPOLATION_RATE);
    realtimePlayer.x += dx * alpha;
    realtimePlayer.y += dy * alpha;
  }

  return mergeRenderedRemotePlayers(pollingPlayers, realtimePlayers);
}

function mergeRenderedRemotePlayers(
  pollingPlayers: RemoteOfficePlayer[],
  realtimePlayers: Map<string, InterpolatedRemotePlayer>,
) {
  const playersById = new Map<string, RemoteOfficePlayer>(pollingPlayers.map((player) => [player.userId, player]));

  for (const realtimePlayer of realtimePlayers.values()) {
    playersById.set(realtimePlayer.userId, {
      userId: realtimePlayer.userId,
      displayName: realtimePlayer.displayName,
      avatarId: realtimePlayer.avatarId,
      x: realtimePlayer.x,
      y: realtimePlayer.y,
      direction: realtimePlayer.direction,
      isMoving: realtimePlayer.isMoving,
      status: realtimePlayer.status,
      roomId: realtimePlayer.roomId,
      updatedAt: realtimePlayer.updatedAt,
      role: realtimePlayer.role,
    });
  }

  return Array.from(playersById.values());
}

function findChairSpots(map: ParsedMap) {
  const chairsLayer = map.layers.find((layer) => layer.name.toLowerCase() === "chairs");

  if (!chairsLayer) {
    return [];
  }

  return chairsLayer.tiles.flatMap((rawGid, index) => {
    if ((rawGid & 0x1fffffff) === 0) {
      return [];
    }

    return {
      id: `chair-${index}`,
      x: (index % chairsLayer.width) * map.tileWidth + map.tileWidth / 2,
      y: Math.floor(index / chairsLayer.width) * map.tileHeight + map.tileHeight / 2,
    };
  });
}

function findNearestChair(player: PlayerState, chairs: ChairSpot[]) {
  let nearest: ChairSpot | null = null;
  let nearestDistance = CHAIR_INTERACTION_DISTANCE;

  for (const chair of chairs) {
    const chairDistance = distance(player, chair);

    if (chairDistance <= nearestDistance) {
      nearest = chair;
      nearestDistance = chairDistance;
    }
  }

  return nearest;
}

function getCamera(
  player: PlayerState,
  mapPixels: { width: number; height: number },
  zoom = 1,
  offset = { x: 0, y: 0 },
  viewport: ViewportSize = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
) {
  void mapPixels;

  return {
    x: player.x - viewport.width / (2 * zoom) + offset.x,
    y: player.y - viewport.height / (2 * zoom) + offset.y,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createRemoteAvatarConfigSignature(remotePlayers: RemoteOfficePlayer[]) {
  return remotePlayers
    .map((remote) => `${remote.userId}:${remote.avatarId ?? ""}`)
    .sort()
    .join("|");
}

function readRemoteAvatarConfigs(remotePlayers: RemoteOfficePlayer[]): Record<string, LayeredAvatarConfig> {
  const configs: Record<string, LayeredAvatarConfig> = {};

  for (const remote of remotePlayers) {
    const avatarConfig = decodeLayeredAvatarId(remote.avatarId);

    if (avatarConfig) {
      configs[remote.userId] = avatarConfig;
    }
  }

  return configs;
}

function createRandomRemoteAvatarConfig(seed: string): LayeredAvatarConfig {
  const random = createSeededRandom(seed);
  const accessory = pickRandom(avatarLayersByType.accessory, random);
  const useAccessory = random() > 0.35;

  return {
    version: 2,
    bodyId: pickRandom(avatarLayersByType.body, random)?.id ?? "",
    eyesId: pickRandom(avatarLayersByType.eyes, random)?.id,
    hairstyleId: pickRandom(avatarLayersByType.hairstyle, random)?.id,
    outfitId: pickRandom(avatarLayersByType.outfit, random)?.id,
    accessoryIds: useAccessory && accessory ? [accessory.id] : [],
  };
}

function pickRandom<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function createSeededRandom(seed: string) {
  let state = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const styles = {
  page: {
    height: "100vh",
    minHeight: "100vh",
    overflow: "hidden",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: 0,
  },
  shell: {
    display: "grid",
    minHeight: "100vh",
    placeItems: "center",
    padding: "24px",
  },
  officeSurface: {
    position: "relative" as const,
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: wm.colors.surfaceHighest,
  },
  mapControls: {
    position: "absolute" as const,
    right: "22px",
    bottom: "72px",
    zIndex: wm.zIndex.officeControls,
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    width: "62px",
    padding: "8px 6px 12px",
    border: "1px solid rgba(216, 224, 236, 0.88)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.9)",
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(18px)",
  },
  mapControlButton: {
    display: "grid",
    placeItems: "center",
    width: "46px",
    height: "46px",
    border: "1px solid #d8e0ec",
    borderRadius: "13px",
    background: "#ffffff",
    color: "#16235a",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 900,
  },
  zoomLabel: {
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 900,
    textAlign: "center" as const,
  },
  toast: {
    position: "absolute" as const,
    left: "50%",
    top: "92px",
    zIndex: wm.zIndex.officeModal,
    transform: "translateX(-50%)",
    border: "1px solid rgba(203, 213, 225, 0.84)",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.84)",
    color: "#ffffff",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 800,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  },
  canvasPanel: {
    position: "absolute" as const,
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: wm.colors.background,
    border: 0,
    borderRadius: "8px",
    overflow: "hidden",
    minWidth: 0,
  },
  canvas: {
    display: "block",
    width: "max(100vw, calc(100vh * 1.647))",
    height: "max(100vh, calc(100vw / 1.647))",
    flex: "0 0 auto",
    background: wm.colors.background,
    imageRendering: "pixelated" as const,
  },
  card: {
    ...wmStyles.card,
    padding: "14px",
  },
  panelLabel: {
    ...wmStyles.eyebrow,
    color: wm.colors.textMuted,
  },
  panelTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "20px",
  },
  panelText: {
    margin: "0 0 6px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  error: {
    position: "absolute" as const,
    left: "24px",
    right: "24px",
    top: "92px",
    zIndex: 22,
    color: "#b91c1c",
    padding: "12px",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    background: "#fef2f2",
  },
};
