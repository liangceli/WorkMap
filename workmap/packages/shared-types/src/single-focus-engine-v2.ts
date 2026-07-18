import {
  FOCUS_IDLE_THRESHOLD_MS,
  MAX_ACTIVITY_INTERVAL_MS,
  type ActivityIntervalV2,
  type LiveFocusSnapshotV2,
  type TrackingBrowserNameV2,
  type TrackingCollectorStateV2,
  type TrackingSourceV2,
} from "./tracking-v2.js";

export type FocusSubjectV2 = {
  subjectKey: string;
  displayName: string;
  browserName?: TrackingBrowserNameV2;
};

export type FocusEvidenceKindV2 =
  | "FOCUS_ACQUIRED"
  | "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND"
  | "TRUSTED_PAGE_INTERACTION";

export type SingleFocusEngineConfigV2 = {
  source: TrackingSourceV2;
  clockEpochId: string;
  clockEpochStartedAt: string;
  clockEpochStartedMonotonicMs: number;
  policyVersion: string;
  policyLeaseId: string;
  browserName?: TrackingBrowserNameV2;
  idleThresholdMs?: number;
  maximumIntervalMs?: number;
  createId: () => string;
};

type CurrentFocusStateV2 = {
  activitySessionId: string;
  currentStateId: string;
  subject: FocusSubjectV2;
  state: "ACTIVE" | "IDLE";
  sessionStartedAtMonotonicMs: number;
  stateStartedAtMonotonicMs: number;
  activeEvidenceAtMonotonicMs: number;
  lastActivityEvidenceKind: FocusEvidenceKindV2;
  confirmedThroughMonotonicMs: number;
  latestEmittedIntervalSequence: number | null;
  latestEmittedClientEventId: string | null;
};

export type SingleFocusEngineCheckpointV2 = {
  version: 1;
  snapshotSequence: number;
  nextIntervalSequence: number;
  lastObservedAtMonotonicMs: number;
  collectorState: TrackingCollectorStateV2;
  current: CurrentFocusStateV2 | null;
};

export type FocusEngineUpdateV2 = {
  intervals: ActivityIntervalV2[];
  snapshot: LiveFocusSnapshotV2;
};

export class SingleFocusSessionEngineV2 {
  private current: CurrentFocusStateV2 | null;
  private snapshotSequence: number;
  private nextIntervalSequence: number;
  private lastObservedAtMonotonicMs: number;
  private collectorState: TrackingCollectorStateV2;
  private readonly idleThresholdMs: number;
  private readonly maximumIntervalMs: number;

  constructor(
    private readonly config: SingleFocusEngineConfigV2,
    checkpoint?: SingleFocusEngineCheckpointV2,
  ) {
    validateConfig(config);
    this.idleThresholdMs = config.idleThresholdMs ?? FOCUS_IDLE_THRESHOLD_MS;
    this.maximumIntervalMs = config.maximumIntervalMs ?? MAX_ACTIVITY_INTERVAL_MS;
    this.current = checkpoint?.version === 1 && validCheckpoint(checkpoint) ? copyCurrent(checkpoint.current) : null;
    this.snapshotSequence = checkpoint?.version === 1 && validCheckpoint(checkpoint) ? checkpoint.snapshotSequence : 0;
    this.nextIntervalSequence = checkpoint?.version === 1 && validCheckpoint(checkpoint)
      ? checkpoint.nextIntervalSequence
      : 1;
    this.lastObservedAtMonotonicMs = checkpoint?.version === 1 && validCheckpoint(checkpoint)
      ? checkpoint.lastObservedAtMonotonicMs
      : config.clockEpochStartedMonotonicMs;
    this.collectorState = checkpoint?.version === 1 && validCheckpoint(checkpoint)
      ? checkpoint.collectorState
      : "HEALTHY";
  }

  acquireFocus(subject: FocusSubjectV2, atMonotonicMs: number): FocusEngineUpdateV2 {
    validateSubject(this.config, subject);
    const intervals = this.advanceInternal(atMonotonicMs);
    if (atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return this.update(intervals);
    }

    if (!this.current) {
      this.startSession(subject, atMonotonicMs, "FOCUS_ACQUIRED");
    } else if (this.current.subject.subjectKey === subject.subjectKey) {
      if (this.current.state === "IDLE") {
        intervals.push(...this.emitThrough(atMonotonicMs));
        this.startActiveState(atMonotonicMs, "FOCUS_ACQUIRED");
      } else {
        this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
        this.current.lastActivityEvidenceKind = "FOCUS_ACQUIRED";
        this.current.subject = { ...subject };
      }
    } else {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startSession(subject, atMonotonicMs, "FOCUS_ACQUIRED");
    }
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  recordActivityEvidence(
    atMonotonicMs: number,
    kind: Exclude<FocusEvidenceKindV2, "FOCUS_ACQUIRED">,
  ): FocusEngineUpdateV2 {
    const intervals = this.advanceInternal(atMonotonicMs);
    if (!this.current || atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return this.update(intervals);
    }

    if (this.current.state === "IDLE") {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startActiveState(atMonotonicMs, kind);
    } else if (atMonotonicMs > this.current.activeEvidenceAtMonotonicMs) {
      this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
      this.current.lastActivityEvidenceKind = kind;
    }
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  observe(atMonotonicMs: number): FocusEngineUpdateV2 {
    const intervals = this.advanceInternal(atMonotonicMs);
    return this.update(intervals);
  }

  settle(atMonotonicMs: number): FocusEngineUpdateV2 {
    const intervals = this.advanceInternal(atMonotonicMs);
    if (this.current && atMonotonicMs >= this.current.confirmedThroughMonotonicMs) {
      intervals.push(...this.emitThrough(atMonotonicMs));
    }
    return this.update(intervals);
  }

  clearFocus(atMonotonicMs: number): FocusEngineUpdateV2 {
    const intervals = this.advanceInternal(atMonotonicMs);
    if (this.current && atMonotonicMs >= this.current.confirmedThroughMonotonicMs) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.current = null;
    }
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  setCollectorState(state: TrackingCollectorStateV2, atMonotonicMs: number): FocusEngineUpdateV2 {
    const intervals = this.advanceInternal(atMonotonicMs);
    if (
      state !== "HEALTHY" &&
      this.current &&
      atMonotonicMs >= this.current.confirmedThroughMonotonicMs
    ) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.current = null;
    }
    this.lastObservedAtMonotonicMs = Math.max(
      this.lastObservedAtMonotonicMs,
      atMonotonicMs,
    );
    this.collectorState = state;
    return this.update(intervals);
  }

  liveSnapshot(): LiveFocusSnapshotV2 {
    this.snapshotSequence += 1;
    const current = this.current;
    return {
      snapshotSequence: this.snapshotSequence,
      activitySessionId: current?.activitySessionId ?? null,
      currentStateId: current?.currentStateId ?? null,
      source: this.config.source,
      stream: "FOCUS",
      clockEpochId: this.config.clockEpochId,
      policyVersion: this.config.policyVersion,
      policyLeaseId: this.config.policyLeaseId,
      subjectKey: current?.subject.subjectKey ?? null,
      displayName: current?.subject.displayName ?? null,
      ...(this.config.source === "BROWSER_DOMAIN" ? { browserName: this.config.browserName } : {}),
      state: current?.state ?? "NONE",
      sessionStartedAt: current
        ? this.projectUtc(current.sessionStartedAtMonotonicMs)
        : null,
      stateStartedAt: current
        ? this.projectUtc(current.stateStartedAtMonotonicMs)
        : null,
      lastActivityEvidenceAt: current
        ? this.projectUtc(current.activeEvidenceAtMonotonicMs)
        : null,
      activityEvidenceKind: current?.lastActivityEvidenceKind ?? null,
      latestEmittedIntervalSequence: current?.latestEmittedIntervalSequence ?? null,
      latestEmittedClientEventId: current?.latestEmittedClientEventId ?? null,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAt: this.projectUtc(this.lastObservedAtMonotonicMs),
      collectorState: this.collectorState,
    };
  }

  checkpoint(): SingleFocusEngineCheckpointV2 {
    return {
      version: 1,
      snapshotSequence: this.snapshotSequence,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAtMonotonicMs: this.lastObservedAtMonotonicMs,
      collectorState: this.collectorState,
      current: copyCurrent(this.current),
    };
  }

  private advanceInternal(atMonotonicMs: number): ActivityIntervalV2[] {
    if (!Number.isFinite(atMonotonicMs) || atMonotonicMs < this.config.clockEpochStartedMonotonicMs) {
      return [];
    }
    if (atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return [];
    }

    const intervals: ActivityIntervalV2[] = [];
    if (
      this.current?.state === "ACTIVE" &&
      atMonotonicMs >= this.current.activeEvidenceAtMonotonicMs + this.idleThresholdMs
    ) {
      const idleBoundary = this.current.activeEvidenceAtMonotonicMs + this.idleThresholdMs;
      intervals.push(...this.emitThrough(idleBoundary));
      this.current.state = "IDLE";
      this.current.currentStateId = this.config.createId();
      this.current.stateStartedAtMonotonicMs = idleBoundary;
      this.current.confirmedThroughMonotonicMs = idleBoundary;
    }
    this.lastObservedAtMonotonicMs = atMonotonicMs;
    return intervals;
  }

  private startSession(
    subject: FocusSubjectV2,
    atMonotonicMs: number,
    kind: FocusEvidenceKindV2,
  ): void {
    this.current = {
      activitySessionId: this.config.createId(),
      currentStateId: this.config.createId(),
      subject: { ...subject },
      state: "ACTIVE",
      sessionStartedAtMonotonicMs: atMonotonicMs,
      stateStartedAtMonotonicMs: atMonotonicMs,
      activeEvidenceAtMonotonicMs: atMonotonicMs,
      lastActivityEvidenceKind: kind,
      confirmedThroughMonotonicMs: atMonotonicMs,
      latestEmittedIntervalSequence: null,
      latestEmittedClientEventId: null,
    };
  }

  private startActiveState(atMonotonicMs: number, kind: FocusEvidenceKindV2): void {
    if (!this.current) {
      return;
    }
    this.current.state = "ACTIVE";
    this.current.currentStateId = this.config.createId();
    this.current.stateStartedAtMonotonicMs = atMonotonicMs;
    this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
    this.current.lastActivityEvidenceKind = kind;
    this.current.confirmedThroughMonotonicMs = atMonotonicMs;
  }

  private emitThrough(endedAtMonotonicMs: number): ActivityIntervalV2[] {
    const current = this.current;
    if (!current || endedAtMonotonicMs <= current.confirmedThroughMonotonicMs) {
      return [];
    }

    const intervals: ActivityIntervalV2[] = [];
    let startedAtMonotonicMs = current.confirmedThroughMonotonicMs;
    while (startedAtMonotonicMs < endedAtMonotonicMs) {
      const chunkEnd = Math.min(endedAtMonotonicMs, startedAtMonotonicMs + this.maximumIntervalMs);
      const clientEventId = this.config.createId();
      const sequenceNumber = this.nextIntervalSequence;
      const interval: ActivityIntervalV2 = {
        clientEventId,
        activitySessionId: current.activitySessionId,
        sequenceNumber,
        source: this.config.source,
        stream: "FOCUS",
        metric: current.state === "ACTIVE" ? "FOCUS_ACTIVE" : "FOCUS_IDLE",
        subjectKey: current.subject.subjectKey,
        displayName: current.subject.displayName,
        ...(this.config.source === "BROWSER_DOMAIN" ? { browserName: this.config.browserName } : {}),
        startedAt: this.projectUtc(startedAtMonotonicMs),
        endedAt: this.projectUtc(chunkEnd),
        clockEpochId: this.config.clockEpochId,
        startedMonotonicMs: startedAtMonotonicMs,
        endedMonotonicMs: chunkEnd,
        durationMs: chunkEnd - startedAtMonotonicMs,
        policyVersion: this.config.policyVersion,
        policyLeaseId: this.config.policyLeaseId,
      };
      intervals.push(interval);
      this.nextIntervalSequence += 1;
      current.latestEmittedIntervalSequence = sequenceNumber;
      current.latestEmittedClientEventId = clientEventId;
      current.confirmedThroughMonotonicMs = chunkEnd;
      startedAtMonotonicMs = chunkEnd;
    }
    return intervals;
  }

  private projectUtc(monotonicMs: number): string {
    const epochUtcMs = Date.parse(this.config.clockEpochStartedAt);
    return new Date(
      epochUtcMs + (monotonicMs - this.config.clockEpochStartedMonotonicMs),
    ).toISOString();
  }

  private update(intervals: ActivityIntervalV2[]): FocusEngineUpdateV2 {
    return {
      intervals,
      snapshot: this.liveSnapshot(),
    };
  }
}

export type LegacyProtocolActivationPlanV2<T> = {
  legacyQueue: T[];
  legacyCloseAt: string | null;
  protocolActivatedAt: string;
  coverageGap: { startsAt: string; endsAt: string } | null;
  requiresFreshFocusProof: true;
};

export function planLegacyProtocolActivationV2<T>(
  legacyQueue: readonly T[],
  protocolActivatedAt: string,
  lastConfirmedObservationAt: string | null,
): LegacyProtocolActivationPlanV2<T> {
  const activatedAtMs = Date.parse(protocolActivatedAt);
  if (!Number.isFinite(activatedAtMs)) {
    throw new Error("protocolActivatedAt must be a valid UTC timestamp.");
  }
  const canonicalActivation = new Date(activatedAtMs).toISOString();
  if (lastConfirmedObservationAt === null) {
    return {
      legacyQueue: [...legacyQueue],
      legacyCloseAt: null,
      protocolActivatedAt: canonicalActivation,
      coverageGap: null,
      requiresFreshFocusProof: true,
    };
  }

  const observedAtMs = Date.parse(lastConfirmedObservationAt);
  if (!Number.isFinite(observedAtMs)) {
    throw new Error("lastConfirmedObservationAt must be a valid UTC timestamp.");
  }
  const closeAtMs = Math.min(observedAtMs, activatedAtMs);
  return {
    legacyQueue: [...legacyQueue],
    legacyCloseAt: new Date(closeAtMs).toISOString(),
    protocolActivatedAt: canonicalActivation,
    coverageGap: closeAtMs < activatedAtMs
      ? {
          startsAt: new Date(closeAtMs).toISOString(),
          endsAt: canonicalActivation,
        }
      : null,
    requiresFreshFocusProof: true,
  };
}

function validateConfig(config: SingleFocusEngineConfigV2): void {
  if (!config.clockEpochId.trim() || !config.policyVersion.trim() || !config.policyLeaseId.trim()) {
    throw new Error("Tracking engine identity is incomplete.");
  }
  if (!Number.isFinite(config.clockEpochStartedMonotonicMs) || !Number.isFinite(Date.parse(config.clockEpochStartedAt))) {
    throw new Error("Tracking engine clock epoch is invalid.");
  }
  if (
    (config.source === "BROWSER_DOMAIN" && config.browserName !== "CHROME" && config.browserName !== "EDGE") ||
    (config.source === "DESKTOP_APP" && config.browserName !== undefined)
  ) {
    throw new Error("Tracking engine browser identity does not match its source.");
  }
  if ((config.idleThresholdMs ?? FOCUS_IDLE_THRESHOLD_MS) <= 0) {
    throw new Error("Idle threshold must be positive.");
  }
  if ((config.maximumIntervalMs ?? MAX_ACTIVITY_INTERVAL_MS) <= 0) {
    throw new Error("Maximum interval duration must be positive.");
  }
}

function validateSubject(config: SingleFocusEngineConfigV2, subject: FocusSubjectV2): void {
  if (!subject.subjectKey.trim() || !subject.displayName.trim()) {
    throw new Error("Focus subject identity is incomplete.");
  }
  if (
    (config.source === "BROWSER_DOMAIN" && subject.browserName !== config.browserName) ||
    (config.source === "DESKTOP_APP" && subject.browserName !== undefined)
  ) {
    throw new Error("Focus subject browser identity does not match the collector.");
  }
}

function validCheckpoint(checkpoint: SingleFocusEngineCheckpointV2): boolean {
  return (
    Number.isInteger(checkpoint.snapshotSequence) &&
    checkpoint.snapshotSequence >= 0 &&
    Number.isInteger(checkpoint.nextIntervalSequence) &&
    checkpoint.nextIntervalSequence >= 1 &&
    Number.isFinite(checkpoint.lastObservedAtMonotonicMs)
  );
}

function copyCurrent(current: CurrentFocusStateV2 | null | undefined): CurrentFocusStateV2 | null {
  return current
    ? {
        ...current,
        subject: { ...current.subject },
      }
    : null;
}
