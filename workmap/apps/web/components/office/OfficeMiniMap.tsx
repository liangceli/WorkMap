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
  shifted?: boolean;
};

const MINI_MAP_WIDTH = 238;
const MINI_MAP_HEIGHT = 158;

export function OfficeMiniMap({ map, player, tilesets, shifted }: OfficeMiniMapProps) {
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
    <aside aria-label="Office mini map" style={{ ...styles.shell, ...(shifted ? styles.shellShifted : {}) }}>
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
    left: "22px",
    bottom: "52px",
    zIndex: 18,
    width: "260px",
    padding: "12px",
    border: "1px solid rgba(216, 224, 236, 0.82)",
    borderRadius: "18px",
    background: "rgba(22, 35, 90, 0.96)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
    backdropFilter: "blur(20px)",
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
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  legend: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: "12px",
    fontWeight: 800,
  },
  canvas: {
    display: "block",
    width: `${MINI_MAP_WIDTH}px`,
    height: `${MINI_MAP_HEIGHT}px`,
    border: "1px solid rgba(255, 255, 255, 0.16)",
    borderRadius: "14px",
    background: "#16235a",
  },
};
