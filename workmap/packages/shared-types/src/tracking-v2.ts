export const TRACKING_PROTOCOL_VERSION_V2 = 2 as const;
export const TRACKING_CANONICALIZATION_VERSION_V1 = 1 as const;
export const FOCUS_IDLE_THRESHOLD_MS = 60_000;
export const MAX_ACTIVITY_INTERVAL_MS = 30 * 60_000;
export const MAX_TRACKING_SYNC_INTERVALS = 50;
export const MAX_TRACKING_SYNC_BYTES = 256 * 1024;

export type TrackingSourceV2 = "DESKTOP_APP" | "BROWSER_DOMAIN";
export type TrackingStreamV2 = "FOCUS" | "OPEN_RUNTIME";
export type TrackingMetricV2 = "FOCUS_ACTIVE" | "FOCUS_IDLE" | "OPEN_RUNTIME";
export type TrackingBrowserNameV2 = "CHROME" | "EDGE";
export type TrackingCollectorStateV2 = "HEALTHY" | "LIMITED" | "PAUSED" | "ERROR";

export type ActivityIntervalV2 = {
  clientEventId: string;
  activitySessionId: string;
  sequenceNumber: number;
  source: TrackingSourceV2;
  stream: TrackingStreamV2;
  metric: TrackingMetricV2;
  subjectKey: string;
  displayName: string;
  browserName?: TrackingBrowserNameV2;
  startedAt: string;
  endedAt: string;
  clockEpochId: string;
  startedMonotonicMs?: number;
  endedMonotonicMs?: number;
  durationMs: number;
  policyVersion: string;
  policyLeaseId: string;
};

export type LiveFocusSnapshotV2 = {
  snapshotSequence: number;
  activitySessionId: string | null;
  currentStateId: string | null;
  source: TrackingSourceV2;
  stream: "FOCUS";
  clockEpochId: string;
  policyVersion: string;
  policyLeaseId: string;
  subjectKey: string | null;
  displayName: string | null;
  browserName?: TrackingBrowserNameV2;
  state: "ACTIVE" | "IDLE" | "NONE";
  sessionStartedAt: string | null;
  stateStartedAt: string | null;
  lastActivityEvidenceAt: string | null;
  activityEvidenceKind:
    | "FOCUS_ACQUIRED"
    | "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND"
    | "TRUSTED_PAGE_INTERACTION"
    | null;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
  nextIntervalSequence: number;
  lastObservedAt: string;
  collectorState: TrackingCollectorStateV2;
};

export type ClientHealthV2 = {
  clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION";
  clientVersion: string;
  platform: "WINDOWS" | "CHROME" | "EDGE";
  connectionState: "ONLINE" | "OFFLINE" | "AUTH_REQUIRED" | "UPGRADE_REQUIRED" | "ERROR";
  collectorState: TrackingCollectorStateV2;
  policyState: "ACTIVE" | "ACKNOWLEDGEMENT_REQUIRED" | "TIMEZONE_REQUIRED" | "EXPIRED";
  migrationState: "V1" | "PREPARING_V2" | "DRAINING_V1" | "V2" | "ERROR";
  queue: {
    pending: number;
    ready: number;
    deadLetter: number;
    oldestQueuedAt: string | null;
    nextRetryAt: string | null;
  };
  lastSuccessfulHeartbeatAt: string | null;
  lastSuccessfulSyncAt: string | null;
  errorCode:
    | "NONE"
    | "NATIVE_HELPER_UNAVAILABLE"
    | "INTERACTION_PERMISSION_REQUIRED"
    | "QUEUE_PRESSURE"
    | "POLICY_UNAVAILABLE"
    | "CLOCK_UNTRUSTED"
    | "UPGRADE_REQUIRED"
    | "UNKNOWN";
};

export type TrackingPolicyUtcWindowV2 = {
  startsAt: string;
  endsAt: string;
};

export type DevicePolicyLeaseV2 = {
  policyLeaseId: string;
  policyVersion: string;
  issuedAt: string;
  expiresAt: string;
  scheduleTimeZone: string;
  allowedUtcWindows: TrackingPolicyUtcWindowV2[];
};

export type TrackingSyncRequestV2 = {
  protocolVersion: typeof TRACKING_PROTOCOL_VERSION_V2;
  protocolActivatedAt: string;
  clientInstanceId: string;
  sentAt: string;
  intervals: ActivityIntervalV2[];
  focusSnapshot?: LiveFocusSnapshotV2;
  health: ClientHealthV2;
};

export type TrackingSyncItemResultV2 = {
  clientEventId: string;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  rejectionCode?:
    | "IDEMPOTENCY_CONFLICT"
    | "SEQUENCE_CONFLICT"
    | "FOCUS_OVERLAP"
    | "INVALID_INTERVAL"
    | "POLICY_REJECTED"
    | "UPGRADE_REQUIRED"
    | string;
  terminal?: boolean;
};

export type TrackingSequenceRangeV2 = {
  from: number;
  to: number;
};

export type TrackingRejectedSequenceRangeV2 = TrackingSequenceRangeV2 & {
  code: string;
};

export type TrackingSyncCursorV2 = {
  source: TrackingSourceV2;
  stream: TrackingStreamV2;
  clockEpochId: string;
  contiguousThroughSequence: number;
  latestAcceptedEndedAt: string | null;
  missingRanges: TrackingSequenceRangeV2[];
  rejectedRanges: TrackingRejectedSequenceRangeV2[];
};

export type TrackingSnapshotRejectionCodeV2 =
  | "SNAPSHOT_POLICY_LEASE_INVALID"
  | "SNAPSHOT_OBSERVATION_TIME_INVALID"
  | "SNAPSHOT_OUTSIDE_POLICY_WINDOW";

export type TrackingFocusSnapshotResultV2 =
  | {
      status: "ACCEPTED";
      acceptedSnapshotSequence: number;
    }
  | {
      status: "REJECTED";
      rejectionCode: TrackingSnapshotRejectionCodeV2;
      message: string;
    }
  | null;

export type TrackingSyncResponseV2 = {
  results: TrackingSyncItemResultV2[];
  cursors: TrackingSyncCursorV2[];
  acceptedSnapshotSequence: number | null;
  focusSnapshotResult: TrackingFocusSnapshotResultV2;
  serverTime: string;
  activePolicyVersion: string;
  activePolicyLeaseId: string | null;
  requestId: string;
};

export type TrackingValidationIssueV2 = {
  code:
    | "FORBIDDEN_FIELD"
    | "UNEXPECTED_FIELD"
    | "INVALID_IDENTITY"
    | "INVALID_SEQUENCE"
    | "INVALID_SOURCE"
    | "INVALID_STREAM_METRIC"
    | "INVALID_BROWSER_IDENTITY"
    | "INVALID_TIME"
    | "INVALID_DURATION"
    | "MONOTONIC_MISMATCH";
  field: string;
};

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const activityIntervalFields = new Set([
  "clientEventId",
  "activitySessionId",
  "sequenceNumber",
  "source",
  "stream",
  "metric",
  "subjectKey",
  "displayName",
  "browserName",
  "startedAt",
  "endedAt",
  "clockEpochId",
  "startedMonotonicMs",
  "endedMonotonicMs",
  "durationMs",
  "policyVersion",
  "policyLeaseId",
]);

const forbiddenTrackingFields = new Set([
  "authorization",
  "body",
  "clipboard",
  "commandline",
  "content",
  "documentname",
  "emailbody",
  "executablepath",
  "forminput",
  "formvalue",
  "fragment",
  "fullurl",
  "keycode",
  "keystroke",
  "keyvalue",
  "messagetext",
  "pagebody",
  "pagetitle",
  "password",
  "path",
  "query",
  "screenshot",
  "title",
  "url",
  "windowtitle",
]);

function normalizedRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseUtcMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalUtc(value: string): string {
  const parsed = parseUtcMs(value);
  if (parsed === null) {
    throw new Error("Invalid UTC timestamp.");
  }
  return new Date(parsed).toISOString();
}

function stableJsonStringify(value: CanonicalJsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key] ?? null)}`);
  return `{${entries.join(",")}}`;
}

export function normalizeActivityIntervalV2(interval: ActivityIntervalV2): ActivityIntervalV2 {
  const normalized: ActivityIntervalV2 = {
    clientEventId: interval.clientEventId.trim(),
    activitySessionId: interval.activitySessionId.trim(),
    sequenceNumber: interval.sequenceNumber,
    source: interval.source,
    stream: interval.stream,
    metric: interval.metric,
    subjectKey: interval.subjectKey.trim(),
    displayName: interval.displayName.trim(),
    startedAt: canonicalUtc(interval.startedAt),
    endedAt: canonicalUtc(interval.endedAt),
    clockEpochId: interval.clockEpochId.trim(),
    durationMs: interval.durationMs,
    policyVersion: interval.policyVersion.trim(),
    policyLeaseId: interval.policyLeaseId.trim(),
  };

  if (interval.browserName !== undefined) {
    normalized.browserName = interval.browserName;
  }
  if (interval.startedMonotonicMs !== undefined) {
    normalized.startedMonotonicMs = interval.startedMonotonicMs;
  }
  if (interval.endedMonotonicMs !== undefined) {
    normalized.endedMonotonicMs = interval.endedMonotonicMs;
  }
  return normalized;
}

export function canonicalizeActivityIntervalV2(interval: ActivityIntervalV2): string {
  const normalized = normalizeActivityIntervalV2(interval);
  return stableJsonStringify({
    canonicalizationVersion: TRACKING_CANONICALIZATION_VERSION_V1,
    interval: {
      activitySessionId: normalized.activitySessionId,
      browserName: normalized.browserName ?? null,
      clientEventId: normalized.clientEventId,
      clockEpochId: normalized.clockEpochId,
      displayName: normalized.displayName,
      durationMs: normalized.durationMs,
      endedAt: normalized.endedAt,
      endedMonotonicMs: normalized.endedMonotonicMs ?? null,
      metric: normalized.metric,
      policyLeaseId: normalized.policyLeaseId,
      policyVersion: normalized.policyVersion,
      sequenceNumber: normalized.sequenceNumber,
      source: normalized.source,
      startedAt: normalized.startedAt,
      startedMonotonicMs: normalized.startedMonotonicMs ?? null,
      stream: normalized.stream,
      subjectKey: normalized.subjectKey,
    },
  });
}

export async function hashActivityIntervalV2(interval: ActivityIntervalV2): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeActivityIntervalV2(interval));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateActivityIntervalV2(value: unknown): TrackingValidationIssueV2[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ code: "INVALID_IDENTITY", field: "$" }];
  }

  const record = value as Record<string, unknown>;
  const issues: TrackingValidationIssueV2[] = [];
  for (const field of Object.keys(record)) {
    const normalizedField = field.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (forbiddenTrackingFields.has(normalizedField)) {
      issues.push({ code: "FORBIDDEN_FIELD", field });
    } else if (!activityIntervalFields.has(field)) {
      issues.push({ code: "UNEXPECTED_FIELD", field });
    }
  }

  const requiredIdentityFields = [
    "clientEventId",
    "activitySessionId",
    "subjectKey",
    "displayName",
    "clockEpochId",
    "policyVersion",
    "policyLeaseId",
  ];
  for (const field of requiredIdentityFields) {
    if (normalizedRequiredString(record[field]).length === 0) {
      issues.push({ code: "INVALID_IDENTITY", field });
    }
  }

  if (!Number.isInteger(record.sequenceNumber) || Number(record.sequenceNumber) < 1) {
    issues.push({ code: "INVALID_SEQUENCE", field: "sequenceNumber" });
  }

  const source = record.source;
  const stream = record.stream;
  const metric = record.metric;
  if (source !== "DESKTOP_APP" && source !== "BROWSER_DOMAIN") {
    issues.push({ code: "INVALID_SOURCE", field: "source" });
  }
  const streamMetricValid =
    (stream === "FOCUS" && (metric === "FOCUS_ACTIVE" || metric === "FOCUS_IDLE")) ||
    (stream === "OPEN_RUNTIME" && metric === "OPEN_RUNTIME");
  if (!streamMetricValid) {
    issues.push({ code: "INVALID_STREAM_METRIC", field: "stream" });
  }

  if (
    (source === "BROWSER_DOMAIN" && record.browserName !== "CHROME" && record.browserName !== "EDGE") ||
    (source === "DESKTOP_APP" && record.browserName !== undefined)
  ) {
    issues.push({ code: "INVALID_BROWSER_IDENTITY", field: "browserName" });
  }

  const startedAt = typeof record.startedAt === "string" ? parseUtcMs(record.startedAt) : null;
  const endedAt = typeof record.endedAt === "string" ? parseUtcMs(record.endedAt) : null;
  if (startedAt === null || endedAt === null || endedAt <= startedAt) {
    issues.push({ code: "INVALID_TIME", field: "startedAt" });
  }

  const durationMs = Number(record.durationMs);
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > MAX_ACTIVITY_INTERVAL_MS) {
    issues.push({ code: "INVALID_DURATION", field: "durationMs" });
  }

  const startedMonotonicMs = record.startedMonotonicMs;
  const endedMonotonicMs = record.endedMonotonicMs;
  const hasOnlyOneMonotonicBound =
    (startedMonotonicMs === undefined) !== (endedMonotonicMs === undefined);
  if (hasOnlyOneMonotonicBound) {
    issues.push({ code: "MONOTONIC_MISMATCH", field: "startedMonotonicMs" });
  } else if (startedMonotonicMs !== undefined && endedMonotonicMs !== undefined) {
    const monotonicDuration = Number(endedMonotonicMs) - Number(startedMonotonicMs);
    if (
      !Number.isFinite(monotonicDuration) ||
      monotonicDuration <= 0 ||
      Math.abs(monotonicDuration - durationMs) > 1_000
    ) {
      issues.push({ code: "MONOTONIC_MISMATCH", field: "durationMs" });
    }
  } else if (
    startedAt !== null &&
    endedAt !== null &&
    Number.isInteger(durationMs) &&
    Math.abs(endedAt - startedAt - durationMs) > 1_000
  ) {
    issues.push({ code: "INVALID_DURATION", field: "durationMs" });
  }

  return issues;
}

export function trackingEventIdentityV2(deviceId: string, interval: ActivityIntervalV2): string {
  return `${deviceId.trim()}:${interval.clientEventId.trim()}`;
}

export function trackingSequenceIdentityV2(deviceId: string, interval: ActivityIntervalV2): string {
  return [
    deviceId.trim(),
    interval.source,
    interval.stream,
    interval.clockEpochId.trim(),
    interval.sequenceNumber,
  ].join(":");
}

export type TrackingSequenceDispositionV2 = {
  sequenceNumber: number;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  terminal?: boolean;
  rejectionCode?: string;
  endedAt?: string;
};

function compactNumberRanges(values: number[]): TrackingSequenceRangeV2[] {
  if (values.length === 0) {
    return [];
  }
  const ranges: TrackingSequenceRangeV2[] = [];
  let start = values[0] ?? 0;
  let end = start;
  for (const value of values.slice(1)) {
    if (value === end + 1) {
      end = value;
    } else {
      ranges.push({ from: start, to: end });
      start = value;
      end = value;
    }
  }
  ranges.push({ from: start, to: end });
  return ranges;
}

export function computeTrackingSequenceCoverageV2(dispositions: TrackingSequenceDispositionV2[]): {
  contiguousThroughSequence: number;
  latestAcceptedEndedAt: string | null;
  missingRanges: TrackingSequenceRangeV2[];
  rejectedRanges: TrackingRejectedSequenceRangeV2[];
} {
  const finalBySequence = new Map<number, TrackingSequenceDispositionV2>();
  for (const disposition of dispositions) {
    if (!Number.isInteger(disposition.sequenceNumber) || disposition.sequenceNumber < 1) {
      continue;
    }
    if (disposition.status !== "REJECTED" || disposition.terminal) {
      finalBySequence.set(disposition.sequenceNumber, disposition);
    }
  }

  const observedSequences = [...finalBySequence.keys()].sort((left, right) => left - right);
  const highest = observedSequences.at(-1) ?? 0;
  let contiguousThroughSequence = 0;
  while (finalBySequence.has(contiguousThroughSequence + 1)) {
    contiguousThroughSequence += 1;
  }

  const missing: number[] = [];
  for (let sequence = 1; sequence <= highest; sequence += 1) {
    if (!finalBySequence.has(sequence)) {
      missing.push(sequence);
    }
  }

  const rejectedRanges: TrackingRejectedSequenceRangeV2[] = [];
  for (const sequence of observedSequences) {
    const disposition = finalBySequence.get(sequence);
    if (disposition?.status !== "REJECTED" || !disposition.terminal) {
      continue;
    }
    const code = disposition.rejectionCode ?? "REJECTED";
    const previous = rejectedRanges.at(-1);
    if (previous && previous.code === code && previous.to + 1 === sequence) {
      previous.to = sequence;
    } else {
      rejectedRanges.push({ from: sequence, to: sequence, code });
    }
  }

  let latestAcceptedEndedAt: string | null = null;
  for (const disposition of finalBySequence.values()) {
    if (disposition.status !== "ACCEPTED" || !disposition.endedAt) {
      continue;
    }
    if (latestAcceptedEndedAt === null || disposition.endedAt > latestAcceptedEndedAt) {
      latestAcceptedEndedAt = disposition.endedAt;
    }
  }

  return {
    contiguousThroughSequence,
    latestAcceptedEndedAt,
    missingRanges: compactNumberRanges(missing),
    rejectedRanges,
  };
}

export function isIntervalInsidePolicyWindowsV2(
  interval: Pick<ActivityIntervalV2, "startedAt" | "endedAt">,
  windows: TrackingPolicyUtcWindowV2[],
): boolean {
  const startedAt = parseUtcMs(interval.startedAt);
  const endedAt = parseUtcMs(interval.endedAt);
  if (startedAt === null || endedAt === null || endedAt <= startedAt) {
    return false;
  }
  return windows.some((window) => {
    const windowStart = parseUtcMs(window.startsAt);
    const windowEnd = parseUtcMs(window.endsAt);
    return windowStart !== null && windowEnd !== null && startedAt >= windowStart && endedAt <= windowEnd;
  });
}

export type FirstStateProvisionalContextV2 = {
  snapshot: LiveFocusSnapshotV2;
  contiguousThroughSequence: number;
  hasAnyDisposition: boolean;
  hasMissingSequence: boolean;
  hasOverlap: boolean;
  protocolActivatedAt: string;
  clockEpochStartedAt: string;
  allowedUtcWindows: TrackingPolicyUtcWindowV2[];
  expectedBrowserName?: TrackingBrowserNameV2;
};

export function canBootstrapFirstStateProvisionalV2(context: FirstStateProvisionalContextV2): boolean {
  const { snapshot } = context;
  if (
    snapshot.state === "NONE" ||
    snapshot.activitySessionId === null ||
    snapshot.currentStateId === null ||
    snapshot.stateStartedAt === null ||
    snapshot.latestEmittedIntervalSequence !== null ||
    snapshot.latestEmittedClientEventId !== null ||
    snapshot.nextIntervalSequence !== 1 ||
    context.contiguousThroughSequence !== 0 ||
    context.hasAnyDisposition ||
    context.hasMissingSequence ||
    context.hasOverlap
  ) {
    return false;
  }

  if (
    (snapshot.source === "BROWSER_DOMAIN" && snapshot.browserName !== context.expectedBrowserName) ||
    (snapshot.source === "DESKTOP_APP" && snapshot.browserName !== undefined)
  ) {
    return false;
  }

  const stateStartedAt = parseUtcMs(snapshot.stateStartedAt);
  const lastObservedAt = parseUtcMs(snapshot.lastObservedAt);
  const activatedAt = parseUtcMs(context.protocolActivatedAt);
  const epochStartedAt = parseUtcMs(context.clockEpochStartedAt);
  if (
    stateStartedAt === null ||
    lastObservedAt === null ||
    activatedAt === null ||
    epochStartedAt === null ||
    lastObservedAt < stateStartedAt ||
    stateStartedAt < Math.max(activatedAt, epochStartedAt)
  ) {
    return false;
  }

  return isIntervalInsidePolicyWindowsV2(
    { startedAt: snapshot.stateStartedAt, endedAt: snapshot.lastObservedAt },
    context.allowedUtcWindows,
  );
}

export function mapWindowsInputTickToMonotonicMsV2(
  currentTickCount64: bigint,
  lastInputTick32: number,
  maximumAgeMs: number,
): bigint | null {
  if (currentTickCount64 < 0n || !Number.isInteger(lastInputTick32) || maximumAgeMs < 0) {
    return null;
  }
  const currentLow32 = Number(currentTickCount64 & 0xffff_ffffn) >>> 0;
  const inputLow32 = lastInputTick32 >>> 0;
  const unsignedAge = (currentLow32 - inputLow32) >>> 0;
  if (unsignedAge > maximumAgeMs || BigInt(unsignedAge) > currentTickCount64) {
    return null;
  }
  return currentTickCount64 - BigInt(unsignedAge);
}

export class FakeMonotonicClockV2 {
  private monotonicMs: number;
  private wallClockMs: number;

  constructor(options: { monotonicMs?: number; wallClockMs: number }) {
    this.monotonicMs = options.monotonicMs ?? 0;
    this.wallClockMs = options.wallClockMs;
  }

  nowMonotonicMs(): number {
    return this.monotonicMs;
  }

  nowUtc(): string {
    return new Date(this.wallClockMs).toISOString();
  }

  projectUtc(monotonicMs: number): string {
    return new Date(this.wallClockMs + (monotonicMs - this.monotonicMs)).toISOString();
  }

  advance(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error("Monotonic time cannot move backwards.");
    }
    this.monotonicMs += durationMs;
    this.wallClockMs += durationMs;
  }

  jumpWallClock(durationMs: number): void {
    if (!Number.isFinite(durationMs)) {
      throw new Error("Wall clock jump must be finite.");
    }
    this.wallClockMs += durationMs;
  }
}

export function unionTrackingDurationMsV2(
  intervals: Array<{ startedAt: string; endedAt: string }>,
): number {
  const sorted = intervals
    .map((interval) => ({
      startedAt: parseUtcMs(interval.startedAt),
      endedAt: parseUtcMs(interval.endedAt),
    }))
    .filter(
      (interval): interval is { startedAt: number; endedAt: number } =>
        interval.startedAt !== null && interval.endedAt !== null && interval.endedAt > interval.startedAt,
    )
    .sort((left, right) => left.startedAt - right.startedAt || left.endedAt - right.endedAt);

  let total = 0;
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  for (const interval of sorted) {
    if (rangeStart === null || rangeEnd === null) {
      rangeStart = interval.startedAt;
      rangeEnd = interval.endedAt;
    } else if (interval.startedAt <= rangeEnd) {
      rangeEnd = Math.max(rangeEnd, interval.endedAt);
    } else {
      total += rangeEnd - rangeStart;
      rangeStart = interval.startedAt;
      rangeEnd = interval.endedAt;
    }
  }
  return rangeStart === null || rangeEnd === null ? total : total + rangeEnd - rangeStart;
}

export function appendActivityIntervalWithoutEvictionV2(
  queue: readonly ActivityIntervalV2[],
  interval: ActivityIntervalV2,
  maximumItems: number,
): {
  queue: ActivityIntervalV2[];
  accepted: boolean;
  duplicate: boolean;
  queuePressure: boolean;
} {
  const existing = queue.find((item) => item.clientEventId === interval.clientEventId);
  if (existing) {
    return {
      queue: [...queue],
      accepted: true,
      duplicate: true,
      queuePressure: queue.length >= maximumItems,
    };
  }
  if (!Number.isInteger(maximumItems) || maximumItems < 1 || queue.length >= maximumItems) {
    return {
      queue: [...queue],
      accepted: false,
      duplicate: false,
      queuePressure: true,
    };
  }
  return {
    queue: [...queue, interval],
    accepted: true,
    duplicate: false,
    queuePressure: queue.length + 1 >= maximumItems,
  };
}
