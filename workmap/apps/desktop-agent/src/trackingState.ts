import { randomUUID } from "node:crypto";
import type { AppUsageEvent, CurrentAppActivity, ForegroundSample, TrackingCheckpoint } from "./types.js";

type ActiveSegment = {
  appName: string;
  isIdle: boolean;
  startedAtMs: number;
  lastObservedAtMs: number;
};

type RuntimeSegment = {
  appName: string;
  startedAtMs: number;
  lastObservedAtMs: number;
};

export type TrackingStateOptions = {
  minimumDurationMs?: number;
  maximumSampleGapMs?: number;
  runtimeSegmentMs?: number;
  createEventId?: () => string;
};

export class AppTrackingState {
  private active: ActiveSegment | null = null;
  private readonly runtimeSegments = new Map<string, RuntimeSegment>();
  private readonly minimumDurationMs: number;
  private readonly maximumSampleGapMs: number;
  private readonly runtimeSegmentMs: number;
  private readonly createEventId: () => string;

  constructor(options: TrackingStateOptions = {}) {
    this.minimumDurationMs = options.minimumDurationMs ?? 5_000;
    this.maximumSampleGapMs = options.maximumSampleGapMs ?? 15_000;
    this.runtimeSegmentMs = options.runtimeSegmentMs ?? 10_000;
    this.createEventId = options.createEventId ?? randomUUID;
  }

  observe(sample: ForegroundSample, deviceId: string): AppUsageEvent[] {
    if (!Number.isFinite(sample.observedAtMs)) return [];
    const lastObservedAtMs = Math.max(this.active?.lastObservedAtMs ?? 0, ...Array.from(this.runtimeSegments.values(), (segment) => segment.lastObservedAtMs));
    if (lastObservedAtMs > 0 && sample.observedAtMs <= lastObservedAtMs) return [];

    const completed: AppUsageEvent[] = [];
    if (sample.isLocked || !sample.appName) {
      const foreground = this.finish(deviceId, sample.observedAtMs);
      if (foreground) completed.push(foreground);
      completed.push(...this.observeRuntime(sample, deviceId));
      return completed;
    }

    const appName = normalizeAppName(sample.appName);
    if (!appName) {
      const foreground = this.finish(deviceId, sample.observedAtMs);
      if (foreground) completed.push(foreground);
      completed.push(...this.observeRuntime({ ...sample, appName: null }, deviceId));
      return completed;
    }

    if (!this.active) {
      this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
      completed.push(...this.observeRuntime(sample, deviceId));
      return completed;
    }

    if (this.active.appName === appName && this.active.isIdle === sample.isIdle) {
      if (utcDateKey(this.active.startedAtMs) !== utcDateKey(sample.observedAtMs)) {
        const foreground = this.finish(deviceId, sample.observedAtMs);
        this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
        if (foreground) completed.push(foreground);
        completed.push(...this.observeRuntime(sample, deviceId));
        return completed;
      }
      this.active.lastObservedAtMs = sample.observedAtMs;
      completed.push(...this.observeRuntime(sample, deviceId));
      return completed;
    }

    const foreground = this.finish(deviceId, sample.observedAtMs);
    this.active = this.start(appName, sample.isIdle, sample.observedAtMs);
    if (foreground) completed.push(foreground);
    completed.push(...this.observeRuntime(sample, deviceId));
    return completed;
  }

  shutdown(deviceId: string, nowMs: number): AppUsageEvent[] {
    const completed = this.finish(deviceId, nowMs);
    const runtime = this.finishAllRuntime(deviceId, nowMs);
    return completed ? [completed, ...runtime] : runtime;
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
      isActiveWindow: true,
    };
  }

  private start(appName: string, isIdle: boolean, observedAtMs: number): ActiveSegment {
    return { appName, isIdle, startedAtMs: observedAtMs, lastObservedAtMs: observedAtMs };
  }

  private observeRuntime(sample: ForegroundSample, deviceId: string): AppUsageEvent[] {
    const completed: AppUsageEvent[] = [];
    const openApps = new Set<string>();
    if (!sample.isLocked) {
      for (const appName of sample.openAppNames ?? []) {
        const normalized = normalizeAppName(appName);
        if (normalized) openApps.add(normalized);
      }
      const foreground = sample.appName ? normalizeAppName(sample.appName) : null;
      if (foreground) openApps.add(foreground);
    }

    for (const [appName, segment] of Array.from(this.runtimeSegments.entries())) {
      const shouldFinish = !openApps.has(appName)
        || utcDateKey(segment.startedAtMs) !== utcDateKey(sample.observedAtMs)
        || sample.observedAtMs - segment.startedAtMs >= this.runtimeSegmentMs;
      if (!shouldFinish) {
        segment.lastObservedAtMs = sample.observedAtMs;
        continue;
      }

      const event = this.finishRuntimeSegment(segment, deviceId, sample.observedAtMs);
      this.runtimeSegments.delete(appName);
      if (event) completed.push(event);
    }

    for (const appName of openApps) {
      const existing = this.runtimeSegments.get(appName);
      if (existing) {
        existing.lastObservedAtMs = sample.observedAtMs;
      } else {
        this.runtimeSegments.set(appName, { appName, startedAtMs: sample.observedAtMs, lastObservedAtMs: sample.observedAtMs });
      }
    }

    return completed;
  }

  private finishAllRuntime(deviceId: string, observedEndMs: number) {
    const completed: AppUsageEvent[] = [];
    for (const [appName, segment] of Array.from(this.runtimeSegments.entries())) {
      const event = this.finishRuntimeSegment(segment, deviceId, observedEndMs);
      this.runtimeSegments.delete(appName);
      if (event) completed.push(event);
    }
    return completed;
  }

  private finishRuntimeSegment(segment: RuntimeSegment, deviceId: string, observedEndMs: number): AppUsageEvent | null {
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
      isActiveWindow: false,
    };
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
    isActiveWindow: true,
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
