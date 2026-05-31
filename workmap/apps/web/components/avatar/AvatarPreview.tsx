"use client";

import { useState } from "react";
import type { AvatarPreset } from "../../lib/avatar/avatarAssets";
import { body2FirstFourRowsFrameMap } from "../../lib/avatar/avatarFrameMaps";
import { wm } from "../../lib/theme/workmapTheme";

type AvatarPreviewProps = {
  preset: AvatarPreset;
  size?: number;
  frameIndex?: number;
  label?: string;
};

export function AvatarPreview({ preset, size = 96, frameIndex = 0, label }: AvatarPreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const columns = preset.columns ?? 1;
  const rows = preset.rows ?? 1;
  const previewFrameIndex = frameIndex === 0 && preset.id === "body-2-32x32" ? body2FirstFourRowsFrameMap.idle.down : frameIndex;
  const sourceHeight = preset.sourceHeight ?? preset.frameHeight;
  const sourceYOffset = preset.sourceYOffset ?? 0;
  const sourceX = (previewFrameIndex % columns) * preset.frameWidth;
  const sourceY = Math.max(0, Math.floor(previewFrameIndex / columns) * preset.frameHeight + sourceYOffset);
  const scale = Math.min(size / preset.frameWidth, size / sourceHeight);

  return (
    <div style={{ ...styles.frame, width: size, height: size }} aria-label={label ?? `${preset.name} avatar preview`}>
      {!failed ? (
        <>
          <img src={preset.src} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={styles.loaderImage} />
          {loaded ? (
            <div
              style={{
                width: size,
                height: size,
                backgroundColor: "transparent",
                backgroundImage: `url(${preset.src})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${columns * preset.frameWidth * scale}px ${rows * preset.frameHeight * scale}px`,
                backgroundPosition: `calc(50% - ${sourceX * scale + (preset.frameWidth * scale) / 2}px) calc(50% - ${
                  sourceY * scale + (sourceHeight * scale) / 2
                }px)`,
                imageRendering: "pixelated",
              }}
            />
          ) : null}
        </>
      ) : null}
      {!loaded || failed ? <div style={styles.fallback}>{preset.name.charAt(0).toUpperCase()}</div> : null}
    </div>
  );
}

const styles = {
  frame: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: wm.radius.md,
    border: `1px solid ${wm.colors.border}`,
    background: wm.colors.surfaceLow,
  },
  loaderImage: {
    position: "absolute" as const,
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: "none" as const,
  },
  fallback: {
    display: "grid",
    placeItems: "center",
    width: "58%",
    height: "58%",
    borderRadius: "999px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primaryContainer,
    fontWeight: 700,
    fontSize: "28px",
  },
};
