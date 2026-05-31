"use client";

import { useEffect, useRef } from "react";
import type { PlayerDirection } from "@workmap/shared-types";
import { getLayeredAvatarAssets, type LayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";
import { getAvatarFrameIndex, layeredAvatarFrameMap } from "../../lib/avatar/avatarFrameMaps";
import { wm } from "../../lib/theme/workmapTheme";

type LayeredAvatarPreviewProps = {
  config: LayeredAvatarConfig;
  size?: number;
  direction?: PlayerDirection;
  isMoving?: boolean;
  frameIndex?: number;
};

export function LayeredAvatarPreview({ config, size = 128, direction = "down", isMoving = false, frameIndex }: LayeredAvatarPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const assets = getLayeredAvatarAssets(config);

    if (!canvas || assets.length === 0) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    Promise.all(
      assets.map(
        (asset) =>
          new Promise<{ asset: (typeof assets)[number]; image?: HTMLImageElement }>((resolve) => {
            const image = new Image();
            image.src = asset.src;
            image.onload = () => resolve({ asset, image });
            image.onerror = () => resolve({ asset });
          }),
      ),
    ).then((loadedAssets) => {
      if (cancelled) {
        return;
      }

      const selectedFrame = frameIndex ?? getAvatarFrameIndex(layeredAvatarFrameMap, direction, isMoving, false, performance.now());
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;

      for (const { asset, image } of loadedAssets) {
        if (!image) {
          continue;
        }

        const sourceHeight = asset.sourceHeight ?? asset.frameHeight;
        const sourceYOffset = asset.sourceYOffset ?? 0;
        const sourceX = (selectedFrame % asset.columns) * asset.frameWidth;
        const sourceY = Math.max(0, Math.floor(selectedFrame / asset.columns) * asset.frameHeight + sourceYOffset);
        const scale = Math.min((size - 16) / asset.frameWidth, (size - 16) / sourceHeight);
        const targetWidth = asset.frameWidth * scale;
        const targetHeight = sourceHeight * scale;
        context.drawImage(
          image,
          sourceX,
          sourceY,
          asset.frameWidth,
          sourceHeight,
          (canvas.width - targetWidth) / 2,
          (canvas.height - targetHeight) / 2,
          targetWidth,
          targetHeight,
        );
      }
      context.imageSmoothingEnabled = true;
    });

    return () => {
      cancelled = true;
    };
  }, [config, direction, frameIndex, isMoving, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ ...styles.canvas, width: size, height: size }} />;
}

const styles = {
  canvas: {
    display: "block",
    borderRadius: wm.radius.md,
    border: `1px solid ${wm.colors.border}`,
    background: wm.colors.surfaceLow,
  },
};
