import type { AvatarConfig } from "./avatarAssets";
import { defaultLayeredAvatarConfig, isLayeredAvatarConfig, type LayeredAvatarConfig } from "./avatarLayerAssets";

const AVATAR_CONFIG_KEY = "workmap.avatarConfig";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAvatarConfig(): AvatarConfig | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AVATAR_CONFIG_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AvatarConfig>;
    return typeof parsed.presetId === "string" && parsed.presetId.length > 0 ? { presetId: parsed.presetId } : null;
  } catch {
    return null;
  }
}

export function getLayeredAvatarConfig(): LayeredAvatarConfig | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AVATAR_CONFIG_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isLayeredAvatarConfig(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function getAvatarConfigForOffice(): LayeredAvatarConfig | null {
  return getLayeredAvatarConfig();
}

export function saveAvatarConfig(config: AvatarConfig) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(AVATAR_CONFIG_KEY, JSON.stringify(config));
}

export function saveLayeredAvatarConfig(config: LayeredAvatarConfig) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(AVATAR_CONFIG_KEY, JSON.stringify(config));
}

export function createDefaultLayeredAvatarConfig() {
  return defaultLayeredAvatarConfig;
}

export function clearAvatarConfig() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(AVATAR_CONFIG_KEY);
}
