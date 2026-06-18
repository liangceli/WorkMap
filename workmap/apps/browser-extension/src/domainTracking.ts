export type DomainSession = {
  domain: string;
  startedAt: number;
};

export type DomainUsageEvent = {
  deviceId: string;
  domain: string;
  browserName: string;
  startedAt: string;
  endedAt: string;
  isIdle: boolean;
};

export const MIN_DOMAIN_SESSION_MS = 5000;

export function readDomainFromUrl(url: string | undefined) {
  if (!url || !url.startsWith("http")) {
    return null;
  }

  try {
    return new URL(url).hostname.toLowerCase();
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
): DomainUsageEvent | null {
  const durationMs = endedAtMs - session.startedAt;

  if (durationMs < minimumSessionMs) {
    return null;
  }

  return {
    deviceId,
    domain: session.domain,
    browserName,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    isIdle: false,
  };
}
