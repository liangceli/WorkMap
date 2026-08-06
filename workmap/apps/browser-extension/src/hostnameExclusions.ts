export function normalizeExcludedHostnames(value: string | readonly string[]) {
  const entries =
    typeof value === "string" ? value.split(/[\s,]+/) : value;
  const normalized = new Set<string>();
  for (const entry of entries) {
    const candidate = entry.trim().toLowerCase().replace(/^\*\./, "");
    if (!candidate || candidate.includes("/") || candidate.includes(":")) {
      continue;
    }
    try {
      const hostname = new URL(`https://${candidate}`).hostname.toLowerCase();
      if (hostname === candidate && hostname.includes(".")) {
        normalized.add(hostname);
      }
    } catch {
      // Invalid entries are ignored locally and are never sent to CandidGrid.
    }
  }
  return [...normalized].sort();
}

export function isExcludedHostname(
  hostname: string,
  exclusions: readonly string[] | undefined,
) {
  const normalized = hostname.toLowerCase();
  return (exclusions ?? []).some(
    (excluded) =>
      normalized === excluded || normalized.endsWith(`.${excluded}`),
  );
}
