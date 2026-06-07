import { isLayeredAvatarConfig, type LayeredAvatarConfig } from "./avatarLayerAssets";

export const LAYERED_AVATAR_ID_PREFIX = "layered:v2:";
const MAX_LAYERED_AVATAR_ID_LENGTH = 2048;

export function encodeLayeredAvatarId(config: LayeredAvatarConfig) {
  const compactConfig: LayeredAvatarConfig = {
    version: 2,
    bodyId: config.bodyId,
    eyesId: config.eyesId,
    hairstyleId: config.hairstyleId,
    outfitId: config.outfitId,
    accessoryIds: config.accessoryIds?.filter(Boolean) ?? [],
  };

  return `${LAYERED_AVATAR_ID_PREFIX}${encodeURIComponent(JSON.stringify(compactConfig))}`;
}

export function decodeLayeredAvatarId(value: string | null | undefined): LayeredAvatarConfig | null {
  if (typeof value !== "string" || !value.startsWith(LAYERED_AVATAR_ID_PREFIX) || value.length > MAX_LAYERED_AVATAR_ID_LENGTH) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(LAYERED_AVATAR_ID_PREFIX.length))) as unknown;
    return isLayeredAvatarConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasBackendAvatarProfile(value: string | null | undefined) {
  return Boolean(decodeLayeredAvatarId(value));
}
