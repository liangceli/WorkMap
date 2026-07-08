"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerState } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";
import type { OfficeTileset } from "./mockOfficeData";
import { drawTiledTile, getTiledTileGid } from "./tiledTiles";

type MiniMapLayer = {
  name: string;
  width: number;
  height: number;
  tiles: number[];
};

type MiniMapData = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: MiniMapLayer[];
};

type OfficeMiniMapProps = {
  map: MiniMapData;
  player: PlayerState;
  tilesets: OfficeTileset[];
  shifted?: boolean;
  onReady?: () => void;
};

const MINI_MAP_WIDTH = 238;
const MINI_MAP_HEIGHT = 158;

type MiniMapStaticCache = {
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function OfficeMiniMap({ map, player, tilesets, shifted, onReady }: OfficeMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const staticCacheRef = useRef<MiniMapStaticCache | null>(null);
  const readyNotifiedRef = useRef(false);
  const [staticCacheVersion, setStaticCacheVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readyNotifiedRef.current = false;
    staticCacheRef.current = null;

    Promise.all(
      tilesets.map(
        (tileset) =>
          new Promise<void>((resolve) => {
            const cached = imagesRef.current.get(tileset.imagePath);
            if (cached?.complete) {
              resolve();
              return;
            }

            const image = new Image();
            image.src = tileset.imagePath;
            image.onload = () => {
              if (!cancelled) {
                imagesRef.current.set(tileset.imagePath, image);
              }
              resolve();
            };
            image.onerror = () => resolve();
          }),
      ),
    ).then(() => {
      if (cancelled) {
        return;
      }

      staticCacheRef.current = createMiniMapStaticCache(map, tilesets, imagesRef.current);
      setStaticCacheVersion((current) => current + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [map, tilesets]);

  useEffect(() => {
    const didDraw = drawMiniMap(canvasRef.current, player, staticCacheRef.current);
    if (didDraw && !readyNotifiedRef.current) {
      readyNotifiedRef.current = true;
      onReady?.();
    }
  }, [onReady, player, staticCacheVersion]);

  return (
    <aside className="wm-office-minimap" aria-label="Office mini map" style={{ ...styles.shell, ...(shifted ? styles.shellShifted : {}) }}>
      <div style={styles.header}>
        <span style={styles.title}>Office map</span>
        <span style={styles.legend}>You</span>
      </div>
      <canvas ref={canvasRef} width={MINI_MAP_WIDTH} height={MINI_MAP_HEIGHT} style={styles.canvas} />
    </aside>
  );
}

function createMiniMapStaticCache(
  map: MiniMapData,
  tilesets: OfficeTileset[],
  images: Map<string, HTMLImageElement>,
): MiniMapStaticCache | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = MINI_MAP_WIDTH;
  canvas.height = MINI_MAP_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const mapPixelWidth = map.width * map.tileWidth;
  const mapPixelHeight = map.height * map.tileHeight;
  const scale = Math.min(MINI_MAP_WIDTH / mapPixelWidth, MINI_MAP_HEIGHT / mapPixelHeight);
  const drawnWidth = mapPixelWidth * scale;
  const drawnHeight = mapPixelHeight * scale;
  const offsetX = (MINI_MAP_WIDTH - drawnWidth) / 2;
  const offsetY = (MINI_MAP_HEIGHT - drawnHeight) / 2;

  context.fillStyle = "#e8f1ed";
  context.fillRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT);
  context.save();
  context.translate(offsetX, offsetY);
  context.imageSmoothingEnabled = true;

  for (const layer of map.layers) {
    for (let index = 0; index < layer.tiles.length; index += 1) {
      const rawGid = layer.tiles[index];
      const { gid, flags } = getTiledTileGid(rawGid);
      if (!gid) {
        continue;
      }

      const tileset = tilesets.find((candidate) => gid >= candidate.firstGid);
      const image = tileset ? images.get(tileset.imagePath) : undefined;
      if (!tileset || !image) {
        continue;
      }

      const localId = gid - tileset.firstGid;
      const sourceX = (localId % tileset.columns) * map.tileWidth;
      const sourceY = Math.floor(localId / tileset.columns) * map.tileHeight;
      const targetX = (index % layer.width) * map.tileWidth * scale;
      const targetY = Math.floor(index / layer.width) * map.tileHeight * scale;
      const tileSize = map.tileWidth * scale;

      drawTiledTile(
        context,
        image,
        sourceX,
        sourceY,
        map.tileWidth,
        map.tileHeight,
        targetX,
        targetY,
        tileSize,
        tileSize,
        flags,
      );
    }
  }

  context.restore();

  return { canvas, offsetX, offsetY, scale };
}

function drawMiniMap(canvas: HTMLCanvasElement | null, player: PlayerState, staticCache: MiniMapStaticCache | null) {
  if (!canvas || !staticCache) {
    return false;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }

  context.clearRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT);
  context.drawImage(staticCache.canvas, 0, 0);
  context.fillStyle = wm.status.available;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(staticCache.offsetX + player.x * staticCache.scale, staticCache.offsetY + player.y * staticCache.scale, 4, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  return true;
}

const styles = {
  shell: {
    position: "absolute" as const,
    left: "22px",
    bottom: "52px",
    zIndex: wm.zIndex.officeChrome,
    width: "260px",
    padding: "12px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius["2xl"],
    background: "rgba(255, 253, 248, 0.9)",
    boxShadow: wm.shadow.elevated,
    backdropFilter: "blur(18px)",
  },
  shellShifted: {
    opacity: 0,
    pointerEvents: "none" as const,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  title: {
    color: wm.colors.text,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  legend: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 800,
  },
  canvas: {
    display: "block",
    width: `${MINI_MAP_WIDTH}px`,
    height: `${MINI_MAP_HEIGHT}px`,
    border: `1px solid ${wm.colors.borderSubtle}`,
    borderRadius: "14px",
    background: wm.colors.surfaceLow,
  },
};
