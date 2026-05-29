export type AvatarPreset = {
  id: string;
  name: string;
  src: string;
  frameWidth: number;
  frameHeight: number;
  sourceHeight?: number;
  sourceYOffset?: number;
  columns?: number;
  rows?: number;
  type: "preset" | "body";
  notes?: string;
};

export type AvatarConfig = {
  presetId: string;
};

export type AvatarBaseAsset = {
  id: string;
  name: string;
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns?: number;
  rows?: number;
  type: "body";
  notes?: string;
};

export const body2AvatarPreset: AvatarPreset = {
  id: "body-2-32x32",
  name: "Body 2",
  src: "/assets/avatars/bodies/Body_2_32x32.png",
  frameWidth: 32,
  frameHeight: 32,
  sourceHeight: 48,
  sourceYOffset: -16,
  columns: 384,
  rows: 52,
  type: "body",
  notes: "Temporary MVP character source. Use only the first four rows for stand/walk/run direction frames.",
};

export const avatarPresets: AvatarPreset[] = [
  body2AvatarPreset,
  {
    id: "farmer-1-32x32",
    name: "Farmer 1",
    src: "/assets/avatars/presets/Farmer_1_32x32.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 24,
    rows: 6,
    type: "preset",
  },
  {
    id: "farmer-2-32x32",
    name: "Farmer 2",
    src: "/assets/avatars/presets/Farmer_2_32x32.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 384,
    rows: 52,
    type: "preset",
    notes: "Large preset sheet. MVP uses the same safe frame map until animation rows are calibrated.",
  },
  {
    id: "farmer-2-no-hat-32x32",
    name: "Farmer 2, No Hat",
    src: "/assets/avatars/presets/Farmer_2_No_Hat_32x32.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 24,
    rows: 6,
    type: "preset",
  },
];

export const avatarBaseAssets: AvatarBaseAsset[] = [
  {
    id: "body-2-32x32",
    name: "Body 2",
    src: "/assets/avatars/bodies/Body_2_32x32.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 384,
    rows: 52,
    type: "body",
    notes: "Registered for future layered avatar work. Currently also used as the temporary MVP character source.",
  },
];

export function findAvatarPreset(presetId: string) {
  return avatarPresets.find((preset) => preset.id === presetId);
}
