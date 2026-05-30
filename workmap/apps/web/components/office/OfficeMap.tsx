"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactTarget, OfficeRoomZone, PlayerDirection, PlayerState, UserPresenceStatus } from "@workmap/shared-types";
import {
  avatarLayersByType,
  getLayeredAvatarAssets,
  type AvatarLayerAsset,
  type LayeredAvatarConfig,
} from "../../lib/avatar/avatarLayerAssets";
import { getAvatarFrameIndex, layeredAvatarFrameMap } from "../../lib/avatar/avatarFrameMaps";
import { getAvatarConfigForOffice } from "../../lib/avatar/avatarStorage";
import { FloatingRoomPill } from "./FloatingRoomPill";
import { InteractionDrawer } from "./InteractionDrawer";
import { MovementHint } from "./MovementHint";
import { OfficeMiniMap } from "./OfficeMiniMap";
import { officeTilesets, remotePlayers, roomZones } from "./mockOfficeData";
import { statusColors } from "./presence";
import { VirtualOfficeTopBar } from "./VirtualOfficeTopBar";

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

const MAP_URL = "/maps/workmap2.tmx";
const MAP_DEV_POLL_MS = 1500;
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 680;
const PLAYER_RADIUS = 14;
const PLAYER_COLLISION_DISTANCE = 34;
const PLAYER_SPEED = 180;
const PROXIMITY_DISTANCE = 80;
const CHAIR_INTERACTION_DISTANCE = 46;
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
const COLLISION_LAYERS = new Set(["Walls", "Tools", "furniture", "chairs", "plants", "some ons on table"]);
const remoteAvatarConfigs: Record<string, LayeredAvatarConfig> = {
  "demo-manager": createRandomRemoteAvatarConfig("demo-manager"),
  "demo-engineer": createRandomRemoteAvatarConfig("demo-engineer"),
  "demo-sales": createRandomRemoteAvatarConfig("demo-sales"),
};

export function OfficeMap() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const nearestChairRef = useRef<ChairSpot | null>(null);
  const seatedChairRef = useRef<ChairSpot | null>(null);
  const preSitPositionRef = useRef<{ x: number; y: number; direction: PlayerDirection } | null>(null);
  const mapXmlRef = useRef<string | null>(null);
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

  const mapPixels = useMemo(
    () => ({
      width: (map?.width ?? 50) * (map?.tileWidth ?? 32),
      height: (map?.height ?? 30) * (map?.tileHeight ?? 32),
    }),
    [map],
  );

  useEffect(() => {
    const avatarConfig = getAvatarConfigForOffice();

    if (!avatarConfig) {
      router.replace("/onboarding/avatar");
      setAvatarChecked(true);
      return;
    }

    playerRef.current = {
      ...playerRef.current,
      avatarId: avatarConfig.bodyId,
    };
    setPlayer(playerRef.current);
    setSelectedAvatar(avatarConfig);
    setAvatarChecked(true);
  }, [router]);

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
      if (event.repeat && event.key.toLowerCase() === "e") {
        return;
      }

      keysRef.current.add(event.key.toLowerCase());

      if (event.key.toLowerCase() === "e" && seatedChairRef.current) {
        standUpFromChair();
        return;
      }

      if (event.key.toLowerCase() === "e" && nearestChairRef.current) {
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
    if (!nearbyTarget) {
      setDismissedContactTargetId(null);
    }
  }, [nearbyTarget]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    let animationFrame = 0;
    let previousTime = performance.now();
    const images = new Map<string, HTMLImageElement>();
    let loadedAvatars: LoadedAvatarMap = {};
    const collision = buildCollisionGrid(map);
    const chairs = findChairSpots(map);
    const avatarConfigs: Record<string, LayeredAvatarConfig> = selectedAvatar
      ? {
          "local-user": selectedAvatar,
          ...remoteAvatarConfigs,
        }
      : remoteAvatarConfigs;
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
          : movePlayer(playerRef.current, keysRef.current, deltaSeconds, map, collision);
        const room = findRoom(nextPlayer.x, nextPlayer.y);
        const nearest = findNearbyPlayer(nextPlayer);
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
        );

        animationFrame = requestAnimationFrame(loop);
      };

      animationFrame = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [map, mapPixels, selectedAvatar]);

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
      if (!map) {
        return;
      }

      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const camera = getCamera(playerRef.current, mapPixels);
      const x = (event.clientX - rect.left) * scaleX + camera.x;
      const y = (event.clientY - rect.top) * scaleY + camera.y;
      const remote = remotePlayers.find((candidate) => distance(candidate, { x, y }) <= 28);

      if (remote) {
        setDismissedContactTargetId(null);
        setContactTarget({
          userId: remote.userId,
          displayName: remote.displayName,
          role: remote.role,
          status: remote.status,
        });
      }
    },
    [map, mapPixels],
  );

  const drawerTarget =
    contactTarget ?? (nearbyTarget && nearbyTarget.userId !== dismissedContactTargetId ? nearbyTarget : null);

  const closeInteractionDrawer = () => {
    if (nearbyTarget) {
      setDismissedContactTargetId(nearbyTarget.userId);
    }

    setContactTarget(null);
  };

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
      <section style={styles.officeSurface}>
        <VirtualOfficeTopBar status={player.status} />

        <div style={styles.canvasPanel}>
          {loadError ? <div style={styles.error}>{loadError}</div> : null}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            style={styles.canvas}
          />
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
          />
        ) : null}
        <MovementHint hasInteractionTarget={Boolean(drawerTarget)} />
        {drawerTarget ? <InteractionDrawer target={drawerTarget} onClose={closeInteractionDrawer} /> : null}
      </section>
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
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const camera = getCamera(player, mapPixels);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#eef2f7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(-Math.round(camera.x), -Math.round(camera.y));

  for (const layer of map.layers) {
    drawLayer(context, layer, map, images);
  }

  if (nearestChair) {
    drawChairHint(context, nearestChair, "Press E");
  }

  if (seatedChair) {
    drawChairHint(context, seatedChair, "Seated");
  }

  for (const remote of remotePlayers) {
    drawPlayer(context, remote, remote.displayName, nearbyTarget?.userId === remote.userId, false, false, avatars?.[remote.userId]);
  }

  drawPlayer(context, player, "You", false, true, Boolean(seatedChair), avatars?.[player.userId]);
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

    context.drawImage(image, sourceX, sourceY, map.tileWidth, map.tileHeight, targetX, targetY, map.tileWidth, map.tileHeight);
  }
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  label: string,
  highlighted = false,
  local = false,
  seated = false,
  avatar?: LoadedAvatar,
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

  const hasAvatarImage = Boolean(avatar?.layers.some((layer) => layer.image));

  if (hasAvatarImage && avatar) {
    context.strokeStyle = highlighted ? "#0f172a" : statusColors[player.status];
    context.lineWidth = highlighted ? 3 : 2;
    context.beginPath();
    context.ellipse(player.x, player.y + 17, highlighted ? 25 : 22, highlighted ? 10 : 8, 0, 0, Math.PI * 2);
    context.stroke();
    drawAvatarSprite(context, player, drawY, seated, avatar);
  } else {
    context.strokeStyle = highlighted ? "#0f172a" : statusColors[player.status];
    context.lineWidth = highlighted ? 4 : 3;
    context.fillStyle = local ? "#1d4ed8" : "#f8fafc";
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

    context.fillStyle = local ? "#ffffff" : "#0f172a";
    context.font = "700 14px Arial";
    context.fillText(seated ? "SIT" : local ? "YOU" : "WM", player.x, drawY + 5);

    if (!seated) {
      drawDirectionCue(context, player.x, drawY, player.direction);
    }
  }

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

  context.fillStyle = "#f8fafc";
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
  context.strokeStyle = "#0f172a";
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(chair.x - 20, chair.y - 20, 40, 40, 8);
  context.stroke();
  context.fillStyle = "#0f172a";
  context.textAlign = "center";
  context.font = "700 11px Arial";
  context.fillText(label, chair.x, chair.y - 25);
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

  if (!isBlocked(nextX, player.y, map, collision) && !isBlockedByRemotePlayer(nextX, player.y)) {
    next.x = clamp(nextX, PLAYER_RADIUS, map.width * map.tileWidth - PLAYER_RADIUS);
  }
  if (!isBlocked(next.x, nextY, map, collision) && !isBlockedByRemotePlayer(next.x, nextY)) {
    next.y = clamp(nextY, PLAYER_RADIUS, map.height * map.tileHeight - PLAYER_RADIUS);
  }

  return next;
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

function isBlockedByRemotePlayer(x: number, y: number) {
  return remotePlayers.some((remote) => distance({ x, y }, remote) < PLAYER_COLLISION_DISTANCE);
}

function findRoom(x: number, y: number) {
  return roomZones.find((room) => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height);
}

function findNearbyPlayer(player: PlayerState): ContactTarget | null {
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

function getCamera(player: PlayerState, mapPixels: { width: number; height: number }) {
  void mapPixels;

  return {
    x: player.x - CANVAS_WIDTH / 2,
    y: player.y - CANVAS_HEIGHT / 2,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
    background: "#dbe4ef",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
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
    background: "#cbd5e1",
  },
  canvasPanel: {
    position: "absolute" as const,
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
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
    background: "#f8fafc",
  },
  card: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "14px",
  },
  panelLabel: {
    margin: "0 0 6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  panelTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  panelText: {
    margin: "0 0 6px",
    color: "#334155",
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
