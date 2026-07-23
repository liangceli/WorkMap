import {
  BROWSER_V2_MAX_INTERVAL_MS,
  type BrowserActivityIntervalV2,
  type BrowserClockEpochV2,
  type BrowserNameV2,
  type BrowserOpenRuntimeCheckpointV2,
  type BrowserOpenRuntimeDomainStateV2,
  type DeviceTrackingPolicyV2,
} from "./trackingV2Types.js";

export type BrowserOpenRuntimeEngineUpdateV2 = {
  intervals: BrowserActivityIntervalV2[];
};

export class BrowserOpenRuntimeEngineV2 {
  private readonly current = new Map<
    string,
    BrowserOpenRuntimeDomainStateV2
  >();
  private nextIntervalSequence: number;
  private lastObservedAtMonotonicMs: number;

  constructor(
    private readonly clock: BrowserClockEpochV2,
    private readonly policy: DeviceTrackingPolicyV2,
    private readonly browserName: BrowserNameV2,
    checkpoint?: BrowserOpenRuntimeCheckpointV2 | null,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {
    if (!policy.policyLeaseId || !policy.collectDomainOpenRuntime) {
      throw new Error(
        "Browser Domain open/runtime tracking requires an authorised policy lease.",
      );
    }
    const restored = checkpoint?.version === 1 && validCheckpoint(checkpoint);
    this.nextIntervalSequence = restored
      ? checkpoint.nextIntervalSequence
      : 1;
    this.lastObservedAtMonotonicMs = restored
      ? checkpoint.lastObservedAtMonotonicMs
      : clock.clockEpochStartedMonotonicMs;
    if (restored) {
      for (const item of checkpoint.current) {
        this.current.set(item.subject.subjectKey, copyState(item));
      }
    }
  }

  observeOpenDomains(
    domains: readonly string[],
    atMonotonicMs: number,
  ): BrowserOpenRuntimeEngineUpdateV2 {
    if (!this.canAdvance(atMonotonicMs)) return { intervals: [] };
    const next = new Map<
      string,
      { subjectKey: string; displayName: string }
    >();
    for (const domain of domains) {
      const subjectKey = domain.trim().toLowerCase();
      if (!subjectKey) continue;
      next.set(subjectKey, {
        subjectKey,
        displayName: subjectKey,
      });
    }

    const intervals: BrowserActivityIntervalV2[] = [];
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

  settle(atMonotonicMs: number): BrowserOpenRuntimeEngineUpdateV2 {
    if (!this.canAdvance(atMonotonicMs)) return { intervals: [] };
    const intervals = [...this.current.values()]
      .sort((left, right) =>
        left.subject.subjectKey.localeCompare(right.subject.subjectKey),
      )
      .flatMap((state) => this.emitThrough(state, atMonotonicMs));
    this.lastObservedAtMonotonicMs = atMonotonicMs;
    return { intervals };
  }

  clear(atMonotonicMs: number): BrowserOpenRuntimeEngineUpdateV2 {
    const update = this.settle(atMonotonicMs);
    this.current.clear();
    return update;
  }

  checkpoint(): BrowserOpenRuntimeCheckpointV2 {
    return {
      version: 1,
      nextIntervalSequence: this.nextIntervalSequence,
      lastObservedAtMonotonicMs: this.lastObservedAtMonotonicMs,
      current: [...this.current.values()]
        .sort((left, right) =>
          left.subject.subjectKey.localeCompare(right.subject.subjectKey),
        )
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
    state: BrowserOpenRuntimeDomainStateV2,
    endedAtMonotonicMs: number,
  ) {
    const intervals: BrowserActivityIntervalV2[] = [];
    let startedAtMonotonicMs = state.confirmedThroughMonotonicMs;
    while (startedAtMonotonicMs < endedAtMonotonicMs) {
      const chunkEnd = Math.min(
        endedAtMonotonicMs,
        startedAtMonotonicMs + BROWSER_V2_MAX_INTERVAL_MS,
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
        source: "BROWSER_DOMAIN",
        stream: "OPEN_RUNTIME",
        metric: "OPEN_RUNTIME",
        subjectKey: state.subject.subjectKey,
        displayName: state.subject.displayName,
        browserName: this.browserName,
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

function validCheckpoint(checkpoint: BrowserOpenRuntimeCheckpointV2) {
  return (
    Number.isInteger(checkpoint.nextIntervalSequence) &&
    checkpoint.nextIntervalSequence >= 1 &&
    Number.isFinite(checkpoint.lastObservedAtMonotonicMs) &&
    Array.isArray(checkpoint.current)
  );
}

function copyState(
  state: BrowserOpenRuntimeDomainStateV2,
): BrowserOpenRuntimeDomainStateV2 {
  return { ...state, subject: { ...state.subject } };
}
