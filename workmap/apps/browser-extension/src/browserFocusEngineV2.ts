import {
  BROWSER_V2_IDLE_THRESHOLD_MS,
  BROWSER_V2_MAX_INTERVAL_MS,
  type BrowserActivityIntervalV2,
  type BrowserClockEpochV2,
  type BrowserFocusCheckpointV2,
  type BrowserFocusStateV2,
  type BrowserLiveFocusSnapshotV2,
  type BrowserNameV2,
  type DeviceTrackingPolicyV2,
  type TrackingCollectorStateV2,
} from "./trackingV2Types.js";

type FocusSubject = { subjectKey: string; displayName: string };

export type BrowserFocusEngineUpdateV2 = {
  intervals: BrowserActivityIntervalV2[];
  snapshot: BrowserLiveFocusSnapshotV2;
};

export class BrowserFocusEngineV2 {
  private readonly clock: BrowserClockEpochV2;
  private current: BrowserFocusStateV2 | null;
  private snapshotSequence: number;
  private nextIntervalSequence: number;
  private lastObservedAtMonotonicMs: number;
  private collectorState: TrackingCollectorStateV2;

  constructor(
    clock: BrowserClockEpochV2,
    private readonly policy: DeviceTrackingPolicyV2,
    private readonly browserName: BrowserNameV2,
    checkpoint?: BrowserFocusCheckpointV2 | null,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {
    if (!policy.policyLeaseId) {
      throw new Error("Browser tracking requires an active policy lease.");
    }
    // performance.now() is a floating-point value in real browsers, while the
    // tracking-v2 ledger contract stores whole milliseconds. Quantize the
    // durable epoch and all restored boundaries once so emitted intervals are
    // stable across service-worker restarts and valid for the server ledger.
    this.clock = {
      ...clock,
      clockEpochStartedMonotonicMs: wholeMillisecond(
        clock.clockEpochStartedMonotonicMs,
      ),
    };
    const restored = checkpoint?.version === 1 && validCheckpoint(checkpoint);
    this.current = restored ? normalizeCurrent(checkpoint.current) : null;
    this.snapshotSequence = restored ? checkpoint.snapshotSequence : 0;
    this.nextIntervalSequence = restored ? checkpoint.nextIntervalSequence : 1;
    this.lastObservedAtMonotonicMs = restored
      ? wholeMillisecond(checkpoint.lastObservedAtMonotonicMs)
      : this.clock.clockEpochStartedMonotonicMs;
    this.collectorState = restored ? checkpoint.collectorState : "HEALTHY";
  }

  acquireFocus(
    subject: FocusSubject,
    atMonotonicMs: number,
  ): BrowserFocusEngineUpdateV2 {
    atMonotonicMs = wholeMillisecond(atMonotonicMs);
    validateSubject(subject);
    const intervals = this.advance(atMonotonicMs);
    if (atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return this.update(intervals);
    }

    if (!this.current) {
      this.startSession(subject, atMonotonicMs, "FOCUS_ACQUIRED");
    } else if (this.current.subject.subjectKey !== subject.subjectKey) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startSession(subject, atMonotonicMs, "FOCUS_ACQUIRED");
    } else if (this.current.state === "IDLE") {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startActiveState(atMonotonicMs, "FOCUS_ACQUIRED");
      this.current.subject = { ...subject };
    } else {
      this.current.subject = { ...subject };
      this.current.activeEvidenceAtMonotonicMs = Math.max(
        this.current.activeEvidenceAtMonotonicMs,
        atMonotonicMs,
      );
      this.current.lastActivityEvidenceKind = "FOCUS_ACQUIRED";
    }
    this.lastObservedAtMonotonicMs = Math.max(
      this.lastObservedAtMonotonicMs,
      atMonotonicMs,
    );
    return this.update(intervals);
  }

  recordTrustedInteraction(
    atMonotonicMs: number,
  ): BrowserFocusEngineUpdateV2 {
    atMonotonicMs = wholeMillisecond(atMonotonicMs);
    const intervals = this.advance(atMonotonicMs);
    if (!this.current || atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return this.update(intervals);
    }
    if (this.current.state === "IDLE") {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startActiveState(atMonotonicMs, "TRUSTED_PAGE_INTERACTION");
    } else if (atMonotonicMs > this.current.activeEvidenceAtMonotonicMs) {
      this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
      this.current.lastActivityEvidenceKind = "TRUSTED_PAGE_INTERACTION";
    }
    this.lastObservedAtMonotonicMs = Math.max(
      this.lastObservedAtMonotonicMs,
      atMonotonicMs,
    );
    return this.update(intervals);
  }

  observe(atMonotonicMs: number): BrowserFocusEngineUpdateV2 {
    return this.update(this.advance(wholeMillisecond(atMonotonicMs)));
  }

  settle(atMonotonicMs: number): BrowserFocusEngineUpdateV2 {
    atMonotonicMs = wholeMillisecond(atMonotonicMs);
    const intervals = this.advance(atMonotonicMs);
    if (
      this.current &&
      atMonotonicMs >= this.current.confirmedThroughMonotonicMs
    ) {
      intervals.push(...this.emitThrough(atMonotonicMs));
    }
    return this.update(intervals);
  }

  clearFocus(atMonotonicMs: number): BrowserFocusEngineUpdateV2 {
    atMonotonicMs = wholeMillisecond(atMonotonicMs);
    const intervals = this.advance(atMonotonicMs);
    if (
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
    return this.update(intervals);
  }

  setCollectorState(
    state: TrackingCollectorStateV2,
    atMonotonicMs: number,
  ): BrowserFocusEngineUpdateV2 {
    atMonotonicMs = wholeMillisecond(atMonotonicMs);
    const intervals = this.advance(atMonotonicMs);
    if (state !== "HEALTHY" && this.current) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.current = null;
    }
    this.collectorState = state;
    this.lastObservedAtMonotonicMs = Math.max(
      this.lastObservedAtMonotonicMs,
      atMonotonicMs,
    );
    return this.update(intervals);
  }

  checkpoint(): BrowserFocusCheckpointV2 {
    return {
      version: 1,
      snapshotSequence: this.snapshotSequence,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAtMonotonicMs: this.lastObservedAtMonotonicMs,
      collectorState: this.collectorState,
      current: copyCurrent(this.current),
    };
  }

  private advance(atMonotonicMs: number): BrowserActivityIntervalV2[] {
    if (
      !Number.isFinite(atMonotonicMs) ||
      atMonotonicMs < this.clock.clockEpochStartedMonotonicMs ||
      atMonotonicMs < this.lastObservedAtMonotonicMs
    ) {
      return [];
    }
    const intervals: BrowserActivityIntervalV2[] = [];
    const idleThresholdMs =
      this.policy.idleThresholdMs || BROWSER_V2_IDLE_THRESHOLD_MS;
    if (
      this.current?.state === "ACTIVE" &&
      atMonotonicMs >=
        this.current.activeEvidenceAtMonotonicMs + idleThresholdMs
    ) {
      const boundary =
        this.current.activeEvidenceAtMonotonicMs + idleThresholdMs;
      intervals.push(...this.emitThrough(boundary));
      this.current.state = "IDLE";
      this.current.currentStateId = this.createId();
      this.current.stateStartedAtMonotonicMs = boundary;
      this.current.confirmedThroughMonotonicMs = boundary;
    }
    this.lastObservedAtMonotonicMs = atMonotonicMs;
    return intervals;
  }

  private startSession(
    subject: FocusSubject,
    atMonotonicMs: number,
    evidence: BrowserFocusStateV2["lastActivityEvidenceKind"],
  ) {
    this.current = {
      activitySessionId: this.createId(),
      currentStateId: this.createId(),
      subject: { ...subject },
      state: "ACTIVE",
      sessionStartedAtMonotonicMs: atMonotonicMs,
      stateStartedAtMonotonicMs: atMonotonicMs,
      activeEvidenceAtMonotonicMs: atMonotonicMs,
      lastActivityEvidenceKind: evidence,
      confirmedThroughMonotonicMs: atMonotonicMs,
      latestEmittedIntervalSequence: null,
      latestEmittedClientEventId: null,
    };
  }

  private startActiveState(
    atMonotonicMs: number,
    evidence: BrowserFocusStateV2["lastActivityEvidenceKind"],
  ) {
    if (!this.current) return;
    this.current.state = "ACTIVE";
    this.current.currentStateId = this.createId();
    this.current.stateStartedAtMonotonicMs = atMonotonicMs;
    this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
    this.current.lastActivityEvidenceKind = evidence;
    this.current.confirmedThroughMonotonicMs = atMonotonicMs;
  }

  private emitThrough(
    endedAtMonotonicMs: number,
  ): BrowserActivityIntervalV2[] {
    const current = this.current;
    if (
      !current ||
      endedAtMonotonicMs <= current.confirmedThroughMonotonicMs
    ) {
      return [];
    }
    const intervals: BrowserActivityIntervalV2[] = [];
    let startedAtMonotonicMs = current.confirmedThroughMonotonicMs;
    while (startedAtMonotonicMs < endedAtMonotonicMs) {
      const chunkEnd = Math.min(
        endedAtMonotonicMs,
        startedAtMonotonicMs + BROWSER_V2_MAX_INTERVAL_MS,
      );
      const clientEventId = this.createId();
      const sequenceNumber = this.nextIntervalSequence++;
      intervals.push({
        clientEventId,
        activitySessionId: current.activitySessionId,
        sequenceNumber,
        source: "BROWSER_DOMAIN",
        stream: "FOCUS",
        metric:
          current.state === "ACTIVE" ? "FOCUS_ACTIVE" : "FOCUS_IDLE",
        subjectKey: current.subject.subjectKey,
        displayName: current.subject.displayName,
        browserName: this.browserName,
        startedAt: this.projectUtc(startedAtMonotonicMs),
        endedAt: this.projectUtc(chunkEnd),
        clockEpochId: this.clock.clockEpochId,
        startedMonotonicMs: startedAtMonotonicMs,
        endedMonotonicMs: chunkEnd,
        durationMs: chunkEnd - startedAtMonotonicMs,
        policyVersion: this.policy.policyVersion,
        policyLeaseId: this.policy.policyLeaseId!,
      });
      current.latestEmittedIntervalSequence = sequenceNumber;
      current.latestEmittedClientEventId = clientEventId;
      current.confirmedThroughMonotonicMs = chunkEnd;
      startedAtMonotonicMs = chunkEnd;
    }
    return intervals;
  }

  private update(
    intervals: BrowserActivityIntervalV2[],
  ): BrowserFocusEngineUpdateV2 {
    return { intervals, snapshot: this.liveSnapshot() };
  }

  private liveSnapshot(): BrowserLiveFocusSnapshotV2 {
    this.snapshotSequence += 1;
    const current = this.current;
    return {
      snapshotSequence: this.snapshotSequence,
      activitySessionId: current?.activitySessionId ?? null,
      currentStateId: current?.currentStateId ?? null,
      source: "BROWSER_DOMAIN",
      stream: "FOCUS",
      clockEpochId: this.clock.clockEpochId,
      policyVersion: this.policy.policyVersion,
      policyLeaseId: this.policy.policyLeaseId!,
      subjectKey: current?.subject.subjectKey ?? null,
      displayName: current?.subject.displayName ?? null,
      browserName: this.browserName,
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
      activityEvidenceKind:
        current?.lastActivityEvidenceKind ?? null,
      latestEmittedIntervalSequence:
        current?.latestEmittedIntervalSequence ?? null,
      latestEmittedClientEventId:
        current?.latestEmittedClientEventId ?? null,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAt: this.projectUtc(this.lastObservedAtMonotonicMs),
      collectorState: this.collectorState,
    };
  }

  private projectUtc(monotonicMs: number) {
    return new Date(
      Date.parse(this.clock.clockEpochStartedAt) +
        (monotonicMs - this.clock.clockEpochStartedMonotonicMs),
    ).toISOString();
  }
}

function validateSubject(subject: FocusSubject) {
  if (!subject.subjectKey.trim() || !subject.displayName.trim()) {
    throw new Error("Browser domain identity is incomplete.");
  }
}

function validCheckpoint(checkpoint: BrowserFocusCheckpointV2) {
  return (
    Number.isInteger(checkpoint.snapshotSequence) &&
    checkpoint.snapshotSequence >= 0 &&
    Number.isInteger(checkpoint.nextIntervalSequence) &&
    checkpoint.nextIntervalSequence >= 1 &&
    Number.isFinite(checkpoint.lastObservedAtMonotonicMs)
  );
}

function copyCurrent(
  current: BrowserFocusStateV2 | null | undefined,
): BrowserFocusStateV2 | null {
  return current ? { ...current, subject: { ...current.subject } } : null;
}

function normalizeCurrent(
  current: BrowserFocusStateV2 | null | undefined,
): BrowserFocusStateV2 | null {
  const copied = copyCurrent(current);
  if (!copied) return null;
  return {
    ...copied,
    sessionStartedAtMonotonicMs: wholeMillisecond(
      copied.sessionStartedAtMonotonicMs,
    ),
    stateStartedAtMonotonicMs: wholeMillisecond(
      copied.stateStartedAtMonotonicMs,
    ),
    activeEvidenceAtMonotonicMs: wholeMillisecond(
      copied.activeEvidenceAtMonotonicMs,
    ),
    confirmedThroughMonotonicMs: wholeMillisecond(
      copied.confirmedThroughMonotonicMs,
    ),
  };
}

function wholeMillisecond(value: number) {
  return Number.isFinite(value) ? Math.round(value) : value;
}
