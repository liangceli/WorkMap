export type AvatarLayerType = "body" | "eyes" | "hairstyle" | "outfit" | "accessory";

export type AvatarLayerAsset = {
  id: string;
  name: string;
  type: AvatarLayerType;
  src: string;
  frameWidth: number;
  frameHeight: number;
  sourceHeight?: number;
  sourceYOffset?: number;
  columns: number;
  rows: number;
  order: number;
};

export type LayeredAvatarConfig = {
  version: 2;
  bodyId: string;
  eyesId?: string;
  hairstyleId?: string;
  outfitId?: string;
  accessoryIds?: string[];
};

const FRAME_META = {
  frameWidth: 32,
  frameHeight: 32,
  sourceHeight: 48,
  sourceYOffset: -16,
  columns: 56,
  rows: 22,
};

const layerOrder: Record<AvatarLayerType, number> = {
  body: 10,
  eyes: 20,
  outfit: 30,
  hairstyle: 40,
  accessory: 50,
};

const bodyFiles = ["Body_1.png", "Body_2.png", "Body_3.png", "Body_4.png", "Body_5.png", "Body_6.png", "Body_7.png", "Body_8.png", "Body_9.png"];
const eyeFiles = ["Eyes_Blue.png", "Eyes_Brown.png", "Eyes_Gray.png", "Eyes_Green.png", "Eyes_Orange.png"];
const hairstyleFiles = [
  "Hairstyle_Balding_Blonde.png",
  "Hairstyle_Balding_Blonde_Ash.png",
  "Hairstyle_Balding_Blue.png",
  "Hairstyle_Balding_Brown_Ash.png",
  "Hairstyle_Balding_Brown_Dark.png",
  "Hairstyle_Balding_Brown_Hazel.png",
  "Hairstyle_Balding_Brown_Light.png",
  "Hairstyle_Balding_Gray.png",
  "Hairstyle_Balding_Orange.png",
  "Hairstyle_Long_Blonde.png",
  "Hairstyle_Long_Blonde_Ash.png",
  "Hairstyle_Long_Blue.png",
  "Hairstyle_Long_Brown_Ash.png",
  "Hairstyle_Long_Brown_Dark.png",
  "Hairstyle_Long_Brown_Hazel.png",
  "Hairstyle_Long_Brown_Light.png",
  "Hairstyle_Long_Gray.png",
  "Hairstyle_Long_Orange.png",
  "Hairstyle_Short_Blonde.png",
  "Hairstyle_Short_Blonde_Ash.png",
  "Hairstyle_Short_Blue.png",
  "Hairstyle_Short_Brown_Ash.png",
  "Hairstyle_Short_Brown_Dark.png",
  "Hairstyle_Short_Brown_Hazel.png",
  "Hairstyle_Short_Brown_Light.png",
  "Hairstyle_Short_Gray.png",
  "Hairstyle_Short_Orange.png",
  "Hairstyle_Tuft_Blonde.png",
  "Hairstyle_Tuft_Blonde_Ash.png",
  "Hairstyle_Tuft_Blue.png",
  "Hairstyle_Tuft_Brown_Ash.png",
  "Hairstyle_Tuft_Brown_Dark.png",
  "Hairstyle_Tuft_Brown_Hazel.png",
  "Hairstyle_Tuft_Brown_Light.png",
  "Hairstyle_Tuft_Gray.png",
  "Hairstyle_Tuft_Orange.png",
  "Hairstyle_Unkept_Blonde.png",
  "Hairstyle_Unkept_Blonde_Ash.png",
  "Hairstyle_Unkept_Blue.png",
  "Hairstyle_Unkept_Brown_Ash.png",
  "Hairstyle_Unkept_Brown_Dark.png",
  "Hairstyle_Unkept_Brown_Hazel.png",
  "Hairstyle_Unkept_Brown_Light.png",
  "Hairstyle_Unkept_Gray.png",
  "Hairstyle_Unkept_Orange.png",
];
const outfitFiles = [
  "Outfit_Braces_Brown.png",
  "Outfit_Braces_Green.png",
  "Outfit_Braces_Orange.png",
  "Outfit_Dungarees_Black.png",
  "Outfit_Dungarees_Green.png",
  "Outfit_Dungarees_Red.png",
  "Outfit_Dungarees_Violet.png",
  "Outfit_Laborer_Blue.png",
  "Outfit_Laborer_Red.png",
  "Outfit_Laborer_Violet.png",
  "Outfit_Vest_Brown.png",
  "Outfit_Vest_Brown_Light.png",
  "Outfit_Vest_Yellow.png",
];
const accessoryFiles = [
  "Accessory_Bamboo_Hat_Brown.png",
  "Accessory_Bamboo_Hat_Brown_Dull.png",
  "Accessory_Gas_Mask.png",
  "Accessory_Straw_Hat_Black.png",
  "Accessory_Straw_Hat_Cyan.png",
  "Accessory_Straw_Hat_Green.png",
  "Accessory_Straw_Hat_Red.png",
  "Accessory_Straw_Hat_Violet.png",
];

export const avatarLayerAssets = [
  ...createAssets("body", "bodies", bodyFiles),
  ...createAssets("eyes", "eyes", eyeFiles),
  ...createAssets("hairstyle", "hairstyles", hairstyleFiles),
  ...createAssets("outfit", "outfits", outfitFiles),
  ...createAssets("accessory", "accessories", accessoryFiles),
];

export const avatarLayersByType = {
  body: avatarLayerAssets.filter((asset) => asset.type === "body"),
  eyes: avatarLayerAssets.filter((asset) => asset.type === "eyes"),
  hairstyle: avatarLayerAssets.filter((asset) => asset.type === "hairstyle"),
  outfit: avatarLayerAssets.filter((asset) => asset.type === "outfit"),
  accessory: avatarLayerAssets.filter((asset) => asset.type === "accessory"),
};

export const defaultLayeredAvatarConfig: LayeredAvatarConfig = {
  version: 2,
  bodyId: avatarLayersByType.body[0]?.id ?? "",
  eyesId: avatarLayersByType.eyes[0]?.id,
  hairstyleId: avatarLayersByType.hairstyle.find((asset) => asset.id.includes("short_brown_dark"))?.id ?? avatarLayersByType.hairstyle[0]?.id,
  outfitId: avatarLayersByType.outfit[0]?.id,
  accessoryIds: [],
};

export function getLayerAsset(assetId?: string) {
  return assetId ? avatarLayerAssets.find((asset) => asset.id === assetId) : undefined;
}

export function getLayeredAvatarAssets(config: LayeredAvatarConfig) {
  const assets = [
    getLayerAsset(config.bodyId),
    getLayerAsset(config.eyesId),
    getLayerAsset(config.outfitId),
    getLayerAsset(config.hairstyleId),
    ...(config.accessoryIds ?? []).map((assetId) => getLayerAsset(assetId)),
  ].filter((asset): asset is AvatarLayerAsset => Boolean(asset));

  return assets.sort((a, b) => a.order - b.order);
}

export function isLayeredAvatarConfig(value: unknown): value is LayeredAvatarConfig {
  const candidate = value as Partial<LayeredAvatarConfig>;
  return candidate?.version === 2 && typeof candidate.bodyId === "string" && candidate.bodyId.length > 0;
}

function createAssets(type: AvatarLayerType, folder: string, files: string[]): AvatarLayerAsset[] {
  return files.map((file) => ({
    id: file.replace(/\.png$/i, "").toLowerCase(),
    name: formatLayerName(file),
    type,
    src: `/assets/avatars/layers/${folder}/${file}`,
    ...FRAME_META,
    order: layerOrder[type],
  }));
}

function formatLayerName(file: string) {
  return file.replace(/\.png$/i, "").replace(/^(Accessory|Body|Eyes|Hairstyle|Outfit)_/, "").replace(/_/g, " ");
}
