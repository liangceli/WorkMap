"use client";

import { useEffect, useRef } from "react";
import type { PlayerState } from "@workmap/shared-types";
import type { OfficeTileset } from "./mockOfficeData";

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
};

const MINI_MAP_WIDTH = 220;
const MINI_MAP_HEIGHT = 132;

export function OfficeMiniMap({ map, player, tilesets }: OfficeMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());

  useEffect(() => {
    let cancelled = false;

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
      if (!cancelled) {
        drawMiniMap(canvasRef.current, map, player, tilesets, imagesRef.current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [map, player, tilesets]);

  useEffect(() => {
    drawMiniMap(canvasRef.current, map, player, tilesets, imagesRef.current);
  }, [map, player, tilesets]);

  return (
    <aside aria-label="Office mini map" style={styles.shell}>
      <div style={styles.header}>
        <span style={styles.title}>Office map</span>
        <span style={styles.legend}>You</span>
      </div>
      <canvas ref={canvasRef} width={MINI_MAP_WIDTH} height={MINI_MAP_HEIGHT} style={styles.canvas} />
    </aside>
  );
}

function drawMiniMap(
  canvas: HTMLCanvasElement | null,
  map: MiniMapData,
  player: PlayerState,
  tilesets: OfficeTileset[],
  images: Map<string, HTMLImageElement>,
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const mapPixelWidth = map.width * map.tileWidth;
  const mapPixelHeight = map.height * map.tileHeight;
  const scale = Math.min(MINI_MAP_WIDTH / mapPixelWidth, MINI_MAP_HEIGHT / mapPixelHeight);
  const drawnWidth = mapPixelWidth * scale;
  const drawnHeight = mapPixelHeight * scale;
  const offsetX = (MINI_MAP_WIDTH - drawnWidth) / 2;
  const offsetY = (MINI_MAP_HEIGHT - drawnHeight) / 2;

  context.clearRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT);
  context.fillStyle = "#e2e8f0";
  context.fillRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT);
  context.save();
  context.translate(offsetX, offsetY);
  context.imageSmoothingEnabled = true;

  for (const layer of map.layers) {
    for (let index = 0; index < layer.tiles.length; index += 1) {
      const rawGid = layer.tiles[index];
      const gid = rawGid & 0x1fffffff;
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

      context.drawImage(image, sourceX, sourceY, map.tileWidth, map.tileHeight, targetX, targetY, tileSize, tileSize);
    }
  }

  context.fillStyle = "#22c55e";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

const styles = {
  shell: {
    position: "absolute" as const,
    right: "24px",
    bottom: "24px",
    zIndex: 18,
    width: "244px",
    padding: "10px",
    border: "1px solid rgba(203, 213, 225, 0.82)",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.82)",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(16px)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  title: {
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  legend: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 800,
  },
  canvas: {
    display: "block",
    width: `${MINI_MAP_WIDTH}px`,
    height: `${MINI_MAP_HEIGHT}px`,
    border: "1px solid rgba(148, 163, 184, 0.45)",
    borderRadius: "10px",
    background: "#e2e8f0",
  },
};
