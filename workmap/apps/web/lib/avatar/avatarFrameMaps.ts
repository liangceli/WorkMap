import type { PlayerDirection } from "@workmap/shared-types";

export type AvatarFrameMap = {
  idle: Record<PlayerDirection, number>;
  walk: Record<PlayerDirection, number[]>;
  sit?: Partial<Record<PlayerDirection, number>>;
};

export const defaultAvatarFrameMap: AvatarFrameMap = {
  // These are safe MVP defaults for the uploaded 32x32 preset sheets.
  // The exact authored animation rows should be calibrated with the onboarding frame preview.
  idle: {
    down: 0,
    left: 24,
    right: 48,
    up: 72,
  },
  walk: {
    down: [1, 2, 3, 4],
    left: [25, 26, 27, 28],
    right: [49, 50, 51, 52],
    up: [73, 74, 75, 76],
  },
  sit: {
    down: 0,
    left: 24,
    right: 48,
    up: 72,
  },
};

export const body2FirstFourRowsFrameMap: AvatarFrameMap = {
  // Body_2_32x32.png is 384 columns wide and has transparent padding before
  // the first visible body frames. These indexes target a continuous non-empty
  // direction block on row 7. Calibrate with the debug sheets before final art.
  idle: {
    down: 2752,
    left: 2692,
    right: 2728,
    up: 2710,
  },
  walk: {
    down: [2743, 2746, 2749, 2752, 2755, 2758],
    left: [2689, 2692, 2695, 2698, 2701, 2704],
    right: [2725, 2728, 2731, 2734, 2737, 2740],
    up: [2707, 2710, 2713, 2716, 2719, 2722],
  },
  sit: {
    down: 2752,
    left: 2692,
    right: 2728,
    up: 2710,
  },
};

export const layeredAvatarFrameMap: AvatarFrameMap = {
  // The layered spritesheets are 56 columns x 22 rows. Row 3 is used for idle,
  // while row 5 has clearer leg motion for walking. Left/right are mapped to
  // match WorkMap movement input after visual calibration.
  idle: {
    left: 181,
    up: 175,
    right: 169,
    down: 187,
  },
  walk: {
    left: [292, 293, 294, 295, 296, 297],
    up: [286, 287, 288, 289, 290, 291],
    right: [280, 281, 282, 283, 284, 285],
    down: [298, 299, 300, 301, 302, 303],
  },
  sit: {
    left: 181,
    up: 175,
    right: 169,
    down: 187,
  },
};

export function getAvatarFrameIndex(frameMap: AvatarFrameMap, direction: PlayerDirection, isMoving: boolean, isSitting: boolean, time: number) {
  if (isSitting) {
    return frameMap.sit?.[direction] ?? frameMap.idle[direction];
  }

  if (!isMoving) {
    return frameMap.idle[direction];
  }

  const frames = frameMap.walk[direction];
  const frame = Math.floor(time / 140) % frames.length;
  return frames[frame] ?? frameMap.idle[direction];
}
