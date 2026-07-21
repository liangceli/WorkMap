import { randomUUID } from "node:crypto";
import {
  DESKTOP_V2_MAX_INTERVAL_MS,
  type ActivityIntervalV2,
  type DesktopClockEpochV2,
  type DesktopFocusSubjectV2,
  type DesktopOpenRuntimeAppStateV2,
  type DesktopOpenRuntimeCheckpointV2,
  type DeviceTrackingPolicyV2,
} from "./trackingV2Types.js";

export type DesktopOpenRuntimeEngineUpdateV2 = {
  intervals: ActivityIntervalV2[];
};

export class DesktopOpenRuntimeEngineV2 {
  private readonly current = new Map<string, DesktopOpenRuntimeAppStateV2>();
  private nextIntervalSequence: number;
  private lastObservedAtMonotonicMs: number;

  constructor(
    private readonly clock: DesktopClockEpochV2,
    private readonly policy: DeviceTrackingPolicyV2,
    checkpoint?: DesktopOpenRuntimeCheckpointV2 | null,
    private readonly createId: () => string = randomUUID,
  ) {
    if (!policy.policyLeaseId || !policy.collectOpenRuntime) {
      throw new Error("App open/runtime tracking requires an authorised policy lease.");
    }
    const restored = checkpoint?.version === 1 && validCheckpoint(checkpoint);
    this.nextIntervalSequence = restored ? checkpoint.nextIntervalSequence : 1;
    this.lastObservedAtMonotonicMs = restored
      ? checkpoint.lastObservedAtMonotonicMs
      : clock.clockEpochStartedMonotonicMs;
    if (restored) {
      for (const item of checkpoint.current) {
        this.current.set(item.subject.subjectKey, copyState(item));
      }
    }
  }

  observeVisibleApps(
    subjects: DesktopFocusSubjectV2[],
    atMonotonicMs: number,
  ): DesktopOpenRuntimeEngineUpdateV2 {
    if (!this.canAdvance(atMonotonicMs)) return { intervals: [] };
    const next = new Map<string, DesktopFocusSubjectV2>();
    for (const subject of subjects) {
      validateSubject(subject);
      next.set(subject.subjectKey, { ...subject });
    }

    const intervals: ActivityIntervalV2[] = [];
    for (const [subjectKey, state] of this.current) {
      const subject = next.get(subjectKey);
      if (!subject) {
        intervals.push(...this.emitThrough(state, atMonotonicMs));
        this.current.delete(subjectKey);
      } else {
        state.subject = { ...subject };
      }
    }
    for (const [subjectKey, subject] of next) {
      if (this.current.has(subjectKey)) continue;
      this.current.set(subjectKey, {
        activitySessionId: this.createId(),
        subject: { ...subject },
        openedAtMonotonicMs: atMonotonicMs,
        confirmedThroughMonotonicMs: atMonotonicMs,
      });
    }
    this.lastObservedAtMonotonicMs = atMonotonicMs;
    return { intervals };
  }

  settle(atMonotonicMs: number): DesktopOpenRuntimeEngineUpdateV2 {
    if (!this.canAdvance(atMonotonicMs)) return { intervals: [] };
    const intervals = [...this.current.values()]
      .sort((left, right) => left.subject.subjectKey.localeCompare(right.subject.subjectKey))
      .flatMap((state) => this.emitThrough(state, atMonotonicMs));
    this.lastObservedAtMonotonicMs = atMonotonicMs;
    return { intervals };
  }

  clear(atMonotonicMs: number): DesktopOpenRuntimeEngineUpdateV2 {
    const update = this.settle(atMonotonicMs);
    this.current.clear();
    return update;
  }

  checkpoint(): DesktopOpenRuntimeCheckpointV2 {
    return {
      version: 1,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAtMonotonicMs: this.lastObservedAtMonotonicMs,
      current: [...this.current.values()]
        .sort((left, right) => left.subject.subjectKey.localeCompare(right.subject.subjectKey))
        .map(copyState),
    };
  }

  private canAdvance(atMonotonicMs: number) {
    return (
      Number.isFinite(atMonotonicMs) &&
      atMonotonicMs >= this.clock.clockEpochStartedMonotonicMs &&
      atMonotonicMs >= this.lastObservedAtMonotonicMs
    );
  }

  private emitThrough(
    state: DesktopOpenRuntimeAppStateV2,
    endedAtMonotonicMs: number,
  ) {
    const intervals: ActivityIntervalV2[] = [];
    let startedAtMonotonicMs = state.confirmedThroughMonotonicMs;
    while (startedAtMonotonicMs < endedAtMonotonicMs) {
      const chunkEnd = Math.min(
        endedAtMonotonicMs,
        startedAtMonotonicMs + DESKTOP_V2_MAX_INTERVAL_MS,
      );
      const persistedStart = Math.round(startedAtMonotonicMs);
      const persistedEnd = Math.round(chunkEnd);
      state.confirmedThroughMonotonicMs = chunkEnd;
      startedAtMonotonicMs = chunkEnd;
      if (persistedEnd <= persistedStart) continue;
      intervals.push({
        clientEventId: this.createId(),
        activitySessionId: state.activitySessionId,
        sequenceNumber: this.nextIntervalSequence++,
        source: "DESKTOP_APP",
        stream: "OPEN_RUNTIME",
        metric: "OPEN_RUNTIME",
        subjectKey: state.subject.subjectKey,
        displayName: state.subject.displayName,
        startedAt: this.projectUtc(persistedStart),
        endedAt: this.projectUtc(persistedEnd),
        clockEpochId: this.clock.clockEpochId,
        startedMonotonicMs: persistedStart,
        endedMonotonicMs: persistedEnd,
        durationMs: persistedEnd - persistedStart,
        policyVersion: this.policy.policyVersion,
        policyLeaseId: this.policy.policyLeaseId!,
      });
    }
    return intervals;
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

function validateSubject(subject: DesktopFocusSubjectV2) {
  if (!subject.subjectKey.trim() || !subject.displayName.trim()) {
    throw new Error("Desktop App identity is incomplete.");
  }
}

function validCheckpoint(checkpoint: DesktopOpenRuntimeCheckpointV2) {
  return (
    Number.isInteger(checkpoint.nextIntervalSequence) &&
    checkpoint.nextIntervalSequence >= 1 &&
    Number.isFinite(checkpoint.lastObservedAtMonotonicMs) &&
    Array.isArray(checkpoint.current)
  );
}

function copyState(state: DesktopOpenRuntimeAppStateV2): DesktopOpenRuntimeAppStateV2 {
  return { ...state, subject: { ...state.subject } };
}
