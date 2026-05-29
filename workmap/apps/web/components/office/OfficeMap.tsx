"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContactTarget, OfficeRoomZone, PlayerDirection, PlayerState, UserPresenceStatus } from "@workmap/shared-types";
import { ContactMenu } from "./ContactMenu";
import { officeTilesets, remotePlayers, roomZones } from "./mockOfficeData";
import { labelStatus, statusColors } from "./presence";

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

const MAP_URL = "/maps/workmap2.tmx";
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 680;
const PLAYER_RADIUS = 14;
const PLAYER_SPEED = 180;
const PROXIMITY_DISTANCE = 80;
const CHAIR_INTERACTION_DISTANCE = 46;
const COLLISION_LAYERS = new Set(["Walls", "Tools", "furniture", "chairs", "plants"]);

export function OfficeMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const nearestChairRef = useRef<ChairSpot | null>(null);
  const seatedChairRef = useRef<ChairSpot | null>(null);
  const preSitPositionRef = useRef<{ x: number; y: number; direction: PlayerDirection } | null>(null);
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
  const [nearestChair, setNearestChair] = useState<ChairSpot | null>(null);
  const [seatedChair, setSeatedChair] = useState<ChairSpot | null>(null);

  const mapPixels = useMemo(
    () => ({
      width: (map?.width ?? 50) * (map?.tileWidth ?? 32),
      height: (map?.height ?? 30) * (map?.tileHeight ?? 32),
    }),
    [map],
  );

  useEffect(() => {
    let cancelled = false;

    fetch(MAP_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load map: ${response.status}`);
        }
        return response.text();
      })
      .then((xml) => {
        if (!cancelled) {
          setMap(parseTmx(xml));
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!map) {
      return undefined;
    }

    let animationFrame = 0;
    let previousTime = performance.now();
    const images = new Map<string, HTMLImageElement>();
    const collision = buildCollisionGrid(map);
    const chairs = findChairSpots(map);

    Promise.all(
      officeTilesets.map(
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
        drawScene(canvasRef.current, map, images, nextPlayer, mapPixels, room, nearest, chair, seatedChairRef.current);

        animationFrame = requestAnimationFrame(loop);
      };

      animationFrame = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [map, mapPixels]);

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

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Virtual Office MVP</p>
            <h1 style={styles.title}>WorkMap Office</h1>
          </div>
          <div style={styles.statusPill}>
            <span style={{ ...styles.statusDot, background: statusColors[player.status] }} />
            {labelStatus(player.status)}
          </div>
        </div>

        <div style={styles.workspace}>
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

          <aside style={styles.sidePanel}>
            <section>
              <p style={styles.panelLabel}>Current Room</p>
              <h2 style={styles.panelTitle}>{activeRoom?.name ?? "Open Area"}</h2>
              <p style={styles.panelText}>Position: {Math.round(player.x)}, {Math.round(player.y)}</p>
            </section>

            <section style={styles.card}>
              <p style={styles.panelLabel}>Controls</p>
              <p style={styles.panelText}>Move with WASD or arrow keys. Press E near a chair to sit. Move or press E again to stand.</p>
            </section>

            <section style={styles.card}>
              <p style={styles.panelLabel}>Interaction</p>
              <p style={styles.panelText}>
                {seatedChair
                  ? "You are seated."
                  : nearestChair
                    ? "Chair nearby. Press E to sit."
                    : nearbyTarget
                      ? `${nearbyTarget.displayName} is close enough to contact.`
                      : "No interaction nearby."}
              </p>
            </section>

            {contactTarget ? <ContactMenu target={contactTarget} onClose={() => setContactTarget(null)} /> : null}
          </aside>
        </div>
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
  });

  return {
    width: Number(mapElement.getAttribute("width") ?? "0"),
    height: Number(mapElement.getAttribute("height") ?? "0"),
    tileWidth: Number(mapElement.getAttribute("tilewidth") ?? "32"),
    tileHeight: Number(mapElement.getAttribute("tileheight") ?? "32"),
    layers,
  };
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
  context.translate(-camera.x, -camera.y);

  for (const layer of map.layers) {
    drawLayer(context, layer, map, images);
  }

  for (const room of roomZones) {
    context.strokeStyle = activeRoom?.id === room.id ? "rgba(37, 99, 235, 0.55)" : "rgba(15, 23, 42, 0.1)";
    context.lineWidth = activeRoom?.id === room.id ? 3 : 1;
    context.strokeRect(room.x, room.y, room.width, room.height);
  }

  if (nearestChair) {
    drawChairHint(context, nearestChair, "Press E");
  }

  if (seatedChair) {
    drawChairHint(context, seatedChair, "Seated");
  }

  for (const remote of remotePlayers) {
    drawPlayer(context, remote, remote.displayName, nearbyTarget?.userId === remote.userId);
  }

  drawPlayer(context, player, "You", false, true, Boolean(seatedChair));
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

  context.fillStyle = "#0f172a";
  context.font = "600 12px Arial";
  context.fillText(label, player.x, drawY - 24);

  context.fillStyle = statusColors[player.status];
  context.beginPath();
  context.arc(player.x + 16, drawY - 13, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
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

  if (!isBlocked(nextX, player.y, map, collision)) {
    next.x = clamp(nextX, PLAYER_RADIUS, map.width * map.tileWidth - PLAYER_RADIUS);
  }
  if (!isBlocked(next.x, nextY, map, collision)) {
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
  return {
    x: clamp(player.x - CANVAS_WIDTH / 2, 0, Math.max(0, mapPixels.width - CANVAS_WIDTH)),
    y: clamp(player.y - CANVAS_HEIGHT / 2, 0, Math.max(0, mapPixels.height - CANVAS_HEIGHT)),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#e5e7eb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "24px",
  },
  shell: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  eyebrow: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "4px 0 0",
    fontSize: "32px",
    lineHeight: 1.1,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "8px 12px",
    textTransform: "capitalize" as const,
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: "16px",
  },
  canvasPanel: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    overflow: "hidden",
    minWidth: 0,
  },
  canvas: {
    display: "block",
    width: "100%",
    height: "auto",
    maxHeight: "calc(100vh - 140px)",
    objectFit: "contain" as const,
    background: "#f8fafc",
  },
  sidePanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  card: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "14px",
  },
  contactCard: {
    position: "relative" as const,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "14px",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.12)",
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
  statusDot: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    marginRight: "6px",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "12px",
  },
  actionButton: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: "6px",
    padding: "8px",
    color: "#0f172a",
    cursor: "pointer",
  },
  closeButton: {
    position: "absolute" as const,
    top: "10px",
    right: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    cursor: "pointer",
  },
  error: {
    color: "#b91c1c",
    padding: "12px",
    borderBottom: "1px solid #fecaca",
    background: "#fef2f2",
  },
};
