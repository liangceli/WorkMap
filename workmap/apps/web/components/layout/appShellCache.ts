type AppShellCacheState = {
  apiSummary?: unknown;
  platformSummary?: unknown;
  updatedAt?: number;
} | null;

const APP_SHELL_CACHE_MAX_AGE_MS = 5 * 60_000;

export function hasWarmAppShellCache(cached: AppShellCacheState): boolean {
  return Boolean(cached?.apiSummary || cached?.platformSummary);
}

export function hasFreshAppShellCache(cached: AppShellCacheState, now = Date.now()): boolean {
  return hasWarmAppShellCache(cached)
    && typeof cached?.updatedAt === "number"
    && cached.updatedAt + APP_SHELL_CACHE_MAX_AGE_MS > now;
}

export function hasFreshWorkspaceAppShellCache(cached: AppShellCacheState, now = Date.now()): boolean {
  return Boolean(cached?.apiSummary) && hasFreshAppShellCache(cached, now);
}

export function hasFreshPlatformAppShellCache(cached: AppShellCacheState, now = Date.now()): boolean {
  return Boolean(cached?.platformSummary) && hasFreshAppShellCache(cached, now);
}
