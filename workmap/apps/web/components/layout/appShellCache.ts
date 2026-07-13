type AppShellCacheState = {
  apiSummary?: unknown;
  platformSummary?: unknown;
} | null;

export function hasWarmAppShellCache(cached: AppShellCacheState): boolean {
  return Boolean(cached?.apiSummary || cached?.platformSummary);
}
