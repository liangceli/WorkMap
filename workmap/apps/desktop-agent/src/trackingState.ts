import { randomUUID } from "node:crypto";
import type { AppUsageEvent, ForegroundSample } from "./types.js";

type ActiveSegment = {
  appName: string;
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

    if (sample.isIdle || sample.isLocked || !sample.appName) {
      const completed = this.finish(deviceId, sample.observedAtMs);
      return completed ? [completed] : [];
    }

    const appName = normalizeAppName(sample.appName);
    if (!appName) {
      const completed = this.finish(deviceId, sample.observedAtMs);
      return completed ? [completed] : [];
    }

    if (!this.active) {
      this.active = { appName, startedAtMs: sample.observedAtMs, lastObservedAtMs: sample.observedAtMs };
      return [];
    }

    if (this.active.appName === appName) {
      this.active.lastObservedAtMs = sample.observedAtMs;
      return [];
    }

    const completed = this.finish(deviceId, sample.observedAtMs);
    this.active = { appName, startedAtMs: sample.observedAtMs, lastObservedAtMs: sample.observedAtMs };
    return completed ? [completed] : [];
  }

  shutdown(deviceId: string, nowMs: number): AppUsageEvent[] {
    const completed = this.finish(deviceId, nowMs);
    return completed ? [completed] : [];
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
      isIdle: false,
    };
  }
}

export function normalizeAppName(value: string) {
  const normalized = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  const withoutExecutableSuffix = normalized.replace(/\.exe$/i, "");
  return withoutExecutableSuffix ? withoutExecutableSuffix.slice(0, 120) : null;
}
