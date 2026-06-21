export type DomainSession = {
  domain: string;
  isIdle: boolean;
  startedAt: number;
  lastObservedAt?: number;
  clientEventId?: string;
};

export type DomainUsageEvent = {
  clientEventId: string;
  deviceId: string;
  domain: string;
  browserName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  isIdle: boolean;
};

export const MIN_DOMAIN_SESSION_MS = 5000;

export function readDomainFromUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function createDomainUsageEvent(
  session: DomainSession,
  endedAtMs: number,
  deviceId: string,
  browserName: string,
  minimumSessionMs = MIN_DOMAIN_SESSION_MS,
  maximumSampleGapMs = 2 * 60 * 1000,
): DomainUsageEvent | null {
  const safeEndMs = Math.min(endedAtMs, (session.lastObservedAt ?? endedAtMs) + maximumSampleGapMs);
  const durationMs = safeEndMs - session.startedAt;

  if (durationMs < minimumSessionMs) {
    return null;
  }

  return {
    clientEventId: session.clientEventId ?? crypto.randomUUID(),
    deviceId,
    domain: session.domain,
    browserName,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(safeEndMs).toISOString(),
    durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
    isIdle: session.isIdle,
  };
}
