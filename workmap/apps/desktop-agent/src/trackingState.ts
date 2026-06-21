import { randomUUID } from "node:crypto";
import type { AppUsageEvent, CurrentAppActivity, ForegroundSample, TrackingCheckpoint } from "./types.js";

type ActiveSegment = {
  appName: string;
  isIdle: boolean;
  startedAtMs: number;
  lastObservedAtMs: number;
};

export type TrackingStateOptions = {
  minimumDurationMs?: number;
  maximumSampleGapMs?: number;
  createEventId?: () => string;
};

export class AppTrackingState {
  private active: ActiveSegment | null = null;
  private readonly minimumDurationMs: number;
  private readonly maximumSampleGapMs: number;
  private readonly createEventId: () => string;

  constructor(options: TrackingStateOptions = {}) {
    this.minimumDurationMs = options.minimumDurationMs ?? 5_000;
    this.maximumSampleGapMs = options.maximumSampleGapMs ?? 15_000;
    this.createEventId = options.createEventId ?? randomUUID;
  }

  observe(sample: ForegroundSample, deviceId: string): AppUsageEvent[] {
    if (!Number.isFinite(sample.observedAtMs)) return [];
    if (this.active && sample.observedAtMs <= this.active.lastObservedAtMs) return [];

    if (sample.isLocked || !sample.appName) {
      const completed = this.finish(deviceId, sample.observedAtMs);
      return completed ? [completed] : [];
    }

    const appName = normalizeAppName(sample.appName);
    if (!appName) {
      const completed = this.finish(deviceId, sample.observedAtMs);
      return completed ? [completed] : [];
    }

    if (!this.active) {
      this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
      return [];
    }

    if (this.active.appName === appName && this.active.isIdle === sample.isIdle) {
      if (utcDateKey(this.active.startedAtMs) !== utcDateKey(sample.observedAtMs)) {
        const completed = this.finish(deviceId, sample.observedAtMs);
        this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
        return completed ? [completed] : [];
      }
      this.active.lastObservedAtMs = sample.observedAtMs;
      return [];
    }

    const completed = this.finish(deviceId, sample.observedAtMs);
    this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
    return completed ? [completed] : [];
  }

  shutdown(deviceId: string, nowMs: number): AppUsageEvent[] {
    const completed = this.finish(deviceId, nowMs);
    return completed ? [completed] : [];
  }

  currentActivity(): CurrentAppActivity | null {
    if (!this.active) return null;
    return {
      appName: this.active.appName,
      startedAt: new Date(this.active.startedAtMs).toISOString(),
      lastObservedAt: new Date(this.active.lastObservedAtMs).toISOString(),
      activeSeconds: this.active.isIdle ? 0 : Math.max(0, Math.round((this.active.lastObservedAtMs - this.active.startedAtMs) / 1000)),
      isIdle: this.active.isIdle,
    };
  }

  checkpoint(): TrackingCheckpoint | null {
    return this.active ? { ...this.active } : null;
  }

  private finish(deviceId: string, observedEndMs: number): AppUsageEvent | null {
    const segment = this.active;
    this.active = null;
    if (!segment) return null;

    const cappedEndMs = Math.min(observedEndMs, segment.lastObservedAtMs + this.maximumSampleGapMs);
    const durationMs = cappedEndMs - segment.startedAtMs;
    if (!Number.isFinite(durationMs) || durationMs < this.minimumDurationMs) return null;

    return {
      clientEventId: this.createEventId(),
      deviceId,
      appName: segment.appName,
      startedAt: new Date(segment.startedAtMs).toISOString(),
      endedAt: new Date(cappedEndMs).toISOString(),
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      isIdle: segment.isIdle,
    };
  }

  private start(appName: string, isIdle: boolean, observedAtMs: number): ActiveSegment {
    return { appName, isIdle, startedAtMs: observedAtMs, lastObservedAtMs: observedAtMs };
  }
}

export function recoverTrackingCheckpoint(
  checkpoint: TrackingCheckpoint | null,
  deviceId: string,
  options: Pick<TrackingStateOptions, "minimumDurationMs" | "createEventId"> = {},
) {
  if (!checkpoint || checkpoint.isIdle) return null;
  const appName = normalizeAppName(checkpoint.appName);
  const durationMs = checkpoint.lastObservedAtMs - checkpoint.startedAtMs;
  if (!appName || !Number.isFinite(durationMs) || durationMs < (options.minimumDurationMs ?? 5_000)) return null;
  return {
    clientEventId: (options.createEventId ?? randomUUID)(),
    deviceId,
    appName,
    startedAt: new Date(checkpoint.startedAtMs).toISOString(),
    endedAt: new Date(checkpoint.lastObservedAtMs).toISOString(),
    durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
    isIdle: false,
  } satisfies AppUsageEvent;
}

export function normalizeAppName(value: string) {
  const normalized = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  const withoutExecutableSuffix = normalized.replace(/\.exe$/i, "");
  return withoutExecutableSuffix ? withoutExecutableSuffix.slice(0, 120) : null;
}

function utcDateKey(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}
