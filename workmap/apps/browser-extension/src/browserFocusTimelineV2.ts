import type {
  BrowserActivityIntervalV2,
  BrowserClockEpochV2,
  DeviceTrackingPolicyV2,
} from "./trackingV2Types.js";

type BrowserFocusClockInputV2 = {
  serverNowMs: number;
  processingMonotonicMs: number;
  observationMonotonicMs: number;
  protocolActivatedAt: string | null;
  focusTimelineThroughAt: string | null;
  policy: DeviceTrackingPolicyV2;
  createId?: () => string;
};

/**
 * Creates a new Focus epoch at the trusted observation's occurrence time.
 * The durable timeline watermark is a hard lower bound across worker/engine
 * epochs, so changing server-clock estimates can never create local overlap.
 */
export function createBrowserFocusClockV2(
  input: BrowserFocusClockInputV2,
): BrowserClockEpochV2 | null {
  const processingMonotonicMs = wholeMillisecond(
    input.processingMonotonicMs,
  );
  const observationMonotonicMs = wholeMillisecond(
    input.observationMonotonicMs,
  );
  if (
    !Number.isFinite(input.serverNowMs) ||
    !Number.isFinite(processingMonotonicMs) ||
    !Number.isFinite(observationMonotonicMs)
  ) {
    return null;
  }

  const observationLagMs = Math.max(
    0,
    processingMonotonicMs - observationMonotonicMs,
  );
  const occurrenceUtcMs = input.serverNowMs - observationLagMs;
  const activationUtcMs = parseBoundary(input.protocolActivatedAt);
  const timelineUtcMs = parseBoundary(input.focusTimelineThroughAt);
  const activeWindow = input.policy.allowedUtcWindows.find((window) => {
    const startsAt = Date.parse(window.startsAt);
    const endsAt = Date.parse(window.endsAt);
    return (
      Number.isFinite(startsAt) &&
      Number.isFinite(endsAt) &&
      input.serverNowMs >= startsAt &&
      input.serverNowMs < endsAt
    );
  });
  if (!activeWindow) return null;

  const windowStartsAt = Date.parse(activeWindow.startsAt);
  const windowEndsAt = Date.parse(activeWindow.endsAt);
  const anchorUtcMs = Math.max(
    occurrenceUtcMs,
    activationUtcMs,
    timelineUtcMs,
    windowStartsAt,
  );

  // A legacy/faulty interval may temporarily leave the watermark ahead of
  // current server time. Waiting is safer than fabricating future Focus or
  // re-entering an already occupied range.
  if (anchorUtcMs > input.serverNowMs || anchorUtcMs >= windowEndsAt) {
    return null;
  }

  return {
    clockEpochId: (input.createId ?? (() => crypto.randomUUID()))(),
    clockEpochStartedAt: new Date(anchorUtcMs).toISOString(),
    clockEpochStartedMonotonicMs: observationMonotonicMs,
  };
}

export function advanceBrowserFocusTimelineThroughAt(
  previous: string | null,
  intervals: readonly BrowserActivityIntervalV2[],
) {
  let latestMs = parseBoundary(previous);
  for (const interval of intervals) {
    const endedAtMs = Date.parse(interval.endedAt);
    if (Number.isFinite(endedAtMs)) latestMs = Math.max(latestMs, endedAtMs);
  }
  return latestMs === Number.NEGATIVE_INFINITY
    ? null
    : new Date(latestMs).toISOString();
}

export function calculateBrowserServerOffsetMs(
  serverTime: string,
  clientRequestStartedAtMs: number,
) {
  const serverMs = Date.parse(serverTime);
  return Number.isFinite(serverMs) && Number.isFinite(clientRequestStartedAtMs)
    ? serverMs - clientRequestStartedAtMs
    : null;
}

function parseBoundary(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function wholeMillisecond(value: number) {
  return Number.isFinite(value) ? Math.round(value) : value;
}
