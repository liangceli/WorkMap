import { randomUUID } from "node:crypto";
import {
  DESKTOP_V2_IDLE_THRESHOLD_MS,
  DESKTOP_V2_MAX_INTERVAL_MS,
  type ActivityIntervalV2,
  type DesktopClockEpochV2,
  type DesktopFocusCheckpointV2,
  type DesktopFocusStateV2,
  type DesktopFocusSubjectV2,
  type DeviceTrackingPolicyV2,
  type FocusEvidenceKindV2,
  type LiveFocusSnapshotV2,
  type TrackingCollectorStateV2,
} from "./trackingV2Types.js";

export type DesktopFocusEngineUpdateV2 = {
  intervals: ActivityIntervalV2[];
  snapshot: LiveFocusSnapshotV2;
};

export class DesktopFocusEngineV2 {
  private current: DesktopFocusStateV2 | null;
  private snapshotSequence: number;
  private nextIntervalSequence: number;
  private lastObservedAtMonotonicMs: number;
  private collectorState: TrackingCollectorStateV2;

  constructor(
    private readonly clock: DesktopClockEpochV2,
    private readonly policy: DeviceTrackingPolicyV2,
    checkpoint?: DesktopFocusCheckpointV2 | null,
    private readonly createId: () => string = randomUUID,
  ) {
    if (!policy.policyLeaseId) {
      throw new Error("Desktop tracking requires an active policy lease.");
    }
    const restored = checkpoint?.version === 1 && validCheckpoint(checkpoint);
    this.current = restored ? copyCurrent(checkpoint.current) : null;
    this.snapshotSequence = restored ? checkpoint.snapshotSequence : 0;
    this.nextIntervalSequence = restored ? checkpoint.nextIntervalSequence : 1;
    this.lastObservedAtMonotonicMs = restored
      ? checkpoint.lastObservedAtMonotonicMs
      : clock.clockEpochStartedMonotonicMs;
    this.collectorState = restored ? checkpoint.collectorState : "HEALTHY";
  }

  acquireFocus(
    subject: DesktopFocusSubjectV2,
    atMonotonicMs: number,
  ): DesktopFocusEngineUpdateV2 {
    validateSubject(subject);
    const intervals = this.advance(atMonotonicMs);
    if (atMonotonicMs < this.lastObservedAtMonotonicMs) return this.update(intervals);

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
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  recordSessionInput(atMonotonicMs: number): DesktopFocusEngineUpdateV2 {
    const intervals = this.advance(atMonotonicMs);
    if (!this.current || atMonotonicMs < this.lastObservedAtMonotonicMs) {
      return this.update(intervals);
    }
    if (this.current.state === "IDLE") {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.startActiveState(atMonotonicMs, "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND");
    } else if (atMonotonicMs > this.current.activeEvidenceAtMonotonicMs) {
      this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
      this.current.lastActivityEvidenceKind = "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND";
    }
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  observe(atMonotonicMs: number): DesktopFocusEngineUpdateV2 {
    return this.update(this.advance(atMonotonicMs));
  }

  settle(atMonotonicMs: number): DesktopFocusEngineUpdateV2 {
    const intervals = this.advance(atMonotonicMs);
    if (this.current && atMonotonicMs >= this.current.confirmedThroughMonotonicMs) {
      intervals.push(...this.emitThrough(atMonotonicMs));
    }
    return this.update(intervals);
  }

  clearFocus(atMonotonicMs: number): DesktopFocusEngineUpdateV2 {
    const intervals = this.advance(atMonotonicMs);
    if (this.current && atMonotonicMs >= this.current.confirmedThroughMonotonicMs) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.current = null;
    }
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  setCollectorState(
    state: TrackingCollectorStateV2,
    atMonotonicMs: number,
  ): DesktopFocusEngineUpdateV2 {
    const intervals = this.advance(atMonotonicMs);
    if (state !== "HEALTHY" && this.current) {
      intervals.push(...this.emitThrough(atMonotonicMs));
      this.current = null;
    }
    this.collectorState = state;
    this.lastObservedAtMonotonicMs = Math.max(this.lastObservedAtMonotonicMs, atMonotonicMs);
    return this.update(intervals);
  }

  checkpoint(): DesktopFocusCheckpointV2 {
    return {
      version: 1,
      snapshotSequence: this.snapshotSequence,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAtMonotonicMs: this.lastObservedAtMonotonicMs,
      collectorState: this.collectorState,
      current: copyCurrent(this.current),
    };
  }

  private advance(atMonotonicMs: number): ActivityIntervalV2[] {
    if (
      !Number.isFinite(atMonotonicMs) ||
      atMonotonicMs < this.clock.clockEpochStartedMonotonicMs ||
      atMonotonicMs < this.lastObservedAtMonotonicMs
    ) {
      return [];
    }
    const intervals: ActivityIntervalV2[] = [];
    const idleThresholdMs = this.policy.idleThresholdMs || DESKTOP_V2_IDLE_THRESHOLD_MS;
    if (
      this.current?.state === "ACTIVE" &&
      atMonotonicMs >= this.current.activeEvidenceAtMonotonicMs + idleThresholdMs
    ) {
      const boundary = this.current.activeEvidenceAtMonotonicMs + idleThresholdMs;
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
    subject: DesktopFocusSubjectV2,
    atMonotonicMs: number,
    evidence: FocusEvidenceKindV2,
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

  private startActiveState(atMonotonicMs: number, evidence: FocusEvidenceKindV2) {
    if (!this.current) return;
    this.current.state = "ACTIVE";
    this.current.currentStateId = this.createId();
    this.current.stateStartedAtMonotonicMs = atMonotonicMs;
    this.current.activeEvidenceAtMonotonicMs = atMonotonicMs;
    this.current.lastActivityEvidenceKind = evidence;
    this.current.confirmedThroughMonotonicMs = atMonotonicMs;
  }

  private emitThrough(endedAtMonotonicMs: number): ActivityIntervalV2[] {
    const current = this.current;
    if (!current || endedAtMonotonicMs <= current.confirmedThroughMonotonicMs) return [];
    const intervals: ActivityIntervalV2[] = [];
    let startedAtMonotonicMs = current.confirmedThroughMonotonicMs;
    while (startedAtMonotonicMs < endedAtMonotonicMs) {
      const chunkEnd = Math.min(
        endedAtMonotonicMs,
        startedAtMonotonicMs + DESKTOP_V2_MAX_INTERVAL_MS,
      );
      // Native Windows and Node monotonic clocks can include fractional milliseconds.
      // The Tracking v2 protocol persists integer millisecond boundaries, so derive all
      // three persisted values from the same canonical boundaries.
      const persistedStartedAtMonotonicMs = canonicalMonotonicMs(startedAtMonotonicMs);
      const persistedEndedAtMonotonicMs = canonicalMonotonicMs(chunkEnd);
      if (persistedEndedAtMonotonicMs <= persistedStartedAtMonotonicMs) {
        current.confirmedThroughMonotonicMs = chunkEnd;
        startedAtMonotonicMs = chunkEnd;
        continue;
      }
      const clientEventId = this.createId();
      const sequenceNumber = this.nextIntervalSequence++;
      intervals.push({
        clientEventId,
        activitySessionId: current.activitySessionId,
        sequenceNumber,
        source: "DESKTOP_APP",
        stream: "FOCUS",
        metric: current.state === "ACTIVE" ? "FOCUS_ACTIVE" : "FOCUS_IDLE",
        subjectKey: current.subject.subjectKey,
        displayName: current.subject.displayName,
        startedAt: this.projectUtc(persistedStartedAtMonotonicMs),
        endedAt: this.projectUtc(persistedEndedAtMonotonicMs),
        clockEpochId: this.clock.clockEpochId,
        startedMonotonicMs: persistedStartedAtMonotonicMs,
        endedMonotonicMs: persistedEndedAtMonotonicMs,
        durationMs: persistedEndedAtMonotonicMs - persistedStartedAtMonotonicMs,
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

  private update(intervals: ActivityIntervalV2[]): DesktopFocusEngineUpdateV2 {
    return { intervals, snapshot: this.liveSnapshot() };
  }

  private liveSnapshot(): LiveFocusSnapshotV2 {
    this.snapshotSequence += 1;
    const current = this.current;
    return {
      snapshotSequence: this.snapshotSequence,
      activitySessionId: current?.activitySessionId ?? null,
      currentStateId: current?.currentStateId ?? null,
      source: "DESKTOP_APP",
      stream: "FOCUS",
      clockEpochId: this.clock.clockEpochId,
      policyVersion: this.policy.policyVersion,
      policyLeaseId: this.policy.policyLeaseId!,
      subjectKey: current?.subject.subjectKey ?? null,
      displayName: current?.subject.displayName ?? null,
      state: current?.state ?? "NONE",
      sessionStartedAt: current ? this.projectUtc(current.sessionStartedAtMonotonicMs) : null,
      stateStartedAt: current ? this.projectUtc(current.stateStartedAtMonotonicMs) : null,
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

  private projectUtc(monotonicMs: number) {
    return new Date(
      Math.round(
        Date.parse(this.clock.clockEpochStartedAt) +
          (monotonicMs - this.clock.clockEpochStartedMonotonicMs),
      ),
    ).toISOString();
  }
}

function canonicalMonotonicMs(value: number) {
  return Math.round(value);
}

function validateSubject(subject: DesktopFocusSubjectV2) {
  if (!subject.subjectKey.trim() || !subject.displayName.trim()) {
    throw new Error("Desktop app identity is incomplete.");
  }
}

function validCheckpoint(checkpoint: DesktopFocusCheckpointV2) {
  return (
    Number.isInteger(checkpoint.snapshotSequence) &&
    checkpoint.snapshotSequence >= 0 &&
    Number.isInteger(checkpoint.nextIntervalSequence) &&
    checkpoint.nextIntervalSequence >= 1 &&
    Number.isFinite(checkpoint.lastObservedAtMonotonicMs)
  );
}

function copyCurrent(
  current: DesktopFocusStateV2 | null | undefined,
): DesktopFocusStateV2 | null {
  return current ? { ...current, subject: { ...current.subject } } : null;
}
