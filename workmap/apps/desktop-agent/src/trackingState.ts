import { randomUUID } from "node:crypto";
import type { AppUsageEvent, CurrentAppActivity, ForegroundSample, TrackingCheckpoint } from "./types.js";

type FocusSegment = {
  appName: string;
  startedAtMs: number;
  lastObservedAtMs: number;
  lastInputAtMs: number;
};

type IdleSegment = {
  appName: string;
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
  focusSegmentMs?: number;
  focusGraceMs?: number;
  createEventId?: () => string;
};

const DEFAULT_FOCUS_GRACE_MS = 30_000;

export class AppTrackingState {
  private readonly focusSegments = new Map<string, FocusSegment>();
  private readonly runtimeSegments = new Map<string, RuntimeSegment>();
  private idleSegment: IdleSegment | null = null;
  private currentForegroundApp: string | null = null;
  private lastInputAtMs: number | null = null;
  private lastObservedAtMs = 0;
  private readonly minimumDurationMs: number;
  private readonly maximumSampleGapMs: number;
  private readonly runtimeSegmentMs: number;
  private readonly focusSegmentMs: number;
  private readonly focusGraceMs: number;
  private readonly createEventId: () => string;

  constructor(options: TrackingStateOptions = {}) {
    this.minimumDurationMs = options.minimumDurationMs ?? 1;
    this.maximumSampleGapMs = options.maximumSampleGapMs ?? 15_000;
    this.runtimeSegmentMs = options.runtimeSegmentMs ?? 10_000;
    this.focusSegmentMs = options.focusSegmentMs ?? this.runtimeSegmentMs;
    this.focusGraceMs = options.focusGraceMs ?? DEFAULT_FOCUS_GRACE_MS;
    this.createEventId = options.createEventId ?? randomUUID;
  }

  observe(sample: ForegroundSample, deviceId: string): AppUsageEvent[] {
    if (!Number.isFinite(sample.observedAtMs) || sample.observedAtMs <= this.lastObservedAtMs) return [];
    const nowMs = sample.observedAtMs;
    this.lastObservedAtMs = nowMs;
    const completed: AppUsageEvent[] = [];
    completed.push(...this.rollOverUtcDay(nowMs, deviceId));

    const appName = sample.appName ? normalizeAppName(sample.appName) : null;
    const hasPreciseInput = typeof sample.lastInputAtMs === "number" && Number.isFinite(sample.lastInputAtMs);
    // A Windows last-input timestamp can legitimately be much older than the
    // current sample while the user is idle. Never move it forward merely
    // because a sampler resumed late: that would turn idle time into focus.
    const inputAtMs = hasPreciseInput
      ? Math.max(0, Math.min(nowMs, sample.lastInputAtMs!))
      : nowMs;

    if (sample.isLocked || !appName) {
      const boundaryMs = sample.isLocked
        ? nowMs
        : Math.min(nowMs, sample.idleStartedAtMs ?? (this.lastInputAtMs ?? nowMs) + this.focusGraceMs);
      completed.push(...this.finishAllFocus(deviceId, boundaryMs));
      if (this.idleSegment) {
        const idle = this.finishIdle(deviceId, boundaryMs);
        if (idle) completed.push(idle);
      }
      this.currentForegroundApp = null;
      completed.push(...this.observeRuntime(sample, deviceId));
      return completed;
    }

    completed.push(...this.expireFocusSegments(deviceId, nowMs, hasPreciseInput));

    if (sample.isIdle) {
      const idleStartedAtMs = clampIdleBoundary(sample.idleStartedAtMs, this.lastInputAtMs, nowMs, this.focusGraceMs);
      completed.push(...this.finishAllFocus(deviceId, idleStartedAtMs));
      if (!this.idleSegment || this.idleSegment.appName !== appName) {
        const idle = this.finishIdle(deviceId, idleStartedAtMs);
        if (idle) completed.push(idle);
        this.idleSegment = { appName, startedAtMs: idleStartedAtMs, lastObservedAtMs: nowMs };
      } else {
        this.idleSegment.lastObservedAtMs = nowMs;
      }
      this.currentForegroundApp = appName;
      completed.push(...this.observeRuntime(sample, deviceId));
      return completed;
    }

    const hasNewInput = !hasPreciseInput || this.lastInputAtMs === null || inputAtMs > this.lastInputAtMs;
    if (hasNewInput) {
      const idle = this.finishIdle(deviceId, inputAtMs);
      if (idle) completed.push(idle);

      if (!hasPreciseInput && this.currentForegroundApp && this.currentForegroundApp !== appName) {
        const previous = this.finishFocus(this.currentForegroundApp, deviceId, inputAtMs);
        if (previous) completed.push(previous);
      }

      this.touchFocus(appName, inputAtMs, nowMs);
      this.lastInputAtMs = inputAtMs;
    } else {
      const current = this.focusSegments.get(appName);
      if (current) current.lastObservedAtMs = Math.max(current.lastObservedAtMs, nowMs);
    }

    this.currentForegroundApp = appName;
    completed.push(...this.rollOverFocusSegments(deviceId, nowMs));
    completed.push(...this.observeRuntime(sample, deviceId));
    return completed;
  }

  shutdown(deviceId: string, nowMs: number): AppUsageEvent[] {
    const completed = this.finishAllFocus(deviceId, nowMs);
    const idle = this.finishIdle(deviceId, nowMs);
    if (idle) completed.push(idle);
    return [...completed, ...this.finishAllRuntime(deviceId, nowMs)];
  }

  currentActivity(): CurrentAppActivity | null {
    if (this.idleSegment && this.currentForegroundApp === this.idleSegment.appName) {
      return {
        appName: this.idleSegment.appName,
        startedAt: new Date(this.idleSegment.startedAtMs).toISOString(),
        lastObservedAt: new Date(this.idleSegment.lastObservedAtMs).toISOString(),
        activeSeconds: 0,
        isIdle: true,
      };
    }

    const focus = this.currentForegroundApp ? this.focusSegments.get(this.currentForegroundApp) : null;
    if (!focus) return null;
    const cappedEndMs = Math.min(focus.lastObservedAtMs, focus.lastInputAtMs + this.focusGraceMs);
    return {
      appName: focus.appName,
      startedAt: new Date(focus.startedAtMs).toISOString(),
      lastObservedAt: new Date(cappedEndMs).toISOString(),
      activeSeconds: Math.max(0, Math.round((cappedEndMs - focus.startedAtMs) / 1000)),
      isIdle: false,
    };
  }

  checkpoint(): TrackingCheckpoint | null {
    const current = this.idleSegment
      ?? (this.currentForegroundApp ? this.focusSegments.get(this.currentForegroundApp) : null)
      ?? Array.from(this.focusSegments.values()).sort((left, right) => right.lastInputAtMs - left.lastInputAtMs)[0]
      ?? null;
    if (!current) return null;
    const currentIsIdle = this.idleSegment === current;
    const focus = currentIsIdle ? null : current as FocusSegment;

    return {
      appName: current.appName,
      isIdle: currentIsIdle,
      startedAtMs: current.startedAtMs,
      lastObservedAtMs: current.lastObservedAtMs,
      ...(focus ? { lastInputAtMs: focus.lastInputAtMs } : {}),
      focusSegments: Array.from(this.focusSegments.values(), (segment) => ({ ...segment })),
      currentForegroundApp: this.currentForegroundApp,
    };
  }

  private touchFocus(appName: string, inputAtMs: number, observedAtMs: number) {
    const existing = this.focusSegments.get(appName);
    if (existing) {
      existing.lastInputAtMs = Math.max(existing.lastInputAtMs, inputAtMs);
      existing.lastObservedAtMs = Math.max(existing.lastObservedAtMs, observedAtMs);
      return;
    }
    this.focusSegments.set(appName, {
      appName,
      startedAtMs: inputAtMs,
      lastInputAtMs: inputAtMs,
      lastObservedAtMs: observedAtMs,
    });
  }

  private expireFocusSegments(deviceId: string, nowMs: number, hasPreciseInput: boolean) {
    const completed: AppUsageEvent[] = [];
    for (const [appName, segment] of Array.from(this.focusSegments.entries())) {
      const expiryMs = segment.lastInputAtMs + this.focusGraceMs;
      // Legacy foreground-only samples cannot prove that a previously focused
      // app stayed observable across a delayed sample. Precise Windows input
      // samples can, because their OS timestamp lets us retain the bounded
      // grace period without fabricating new interaction.
      if (hasPreciseInput) {
        segment.lastObservedAtMs = Math.max(segment.lastObservedAtMs, nowMs);
      }
      if (nowMs < expiryMs) {
        continue;
      }
      const event = this.finishFocus(appName, deviceId, expiryMs);
      if (event) completed.push(event);
    }
    return completed;
  }

  private finishAllFocus(deviceId: string, observedEndMs: number) {
    const completed: AppUsageEvent[] = [];
    for (const appName of Array.from(this.focusSegments.keys())) {
      const event = this.finishFocus(appName, deviceId, observedEndMs);
      if (event) completed.push(event);
    }
    return completed;
  }

  private finishFocus(appName: string, deviceId: string, observedEndMs: number): AppUsageEvent | null {
    const segment = this.focusSegments.get(appName);
    if (!segment) return null;
    this.focusSegments.delete(appName);
    const safeEndMs = Math.min(
      observedEndMs,
      segment.lastInputAtMs + this.focusGraceMs,
      segment.lastObservedAtMs + this.maximumSampleGapMs,
    );
    return this.toUsageEvent(segment.appName, segment.startedAtMs, safeEndMs, false, true, deviceId);
  }

  // Persist long-running focus activity in bounded pieces. Waiting for a window
  // switch or the idle grace expiry made an actively used application appear
  // only as a transient heartbeat value in Reports.
  private rollOverFocusSegments(deviceId: string, nowMs: number) {
    const completed: AppUsageEvent[] = [];
    for (const segment of this.focusSegments.values()) {
      if (nowMs - segment.startedAtMs < this.focusSegmentMs) continue;
      const safeEndMs = Math.min(
        nowMs,
        segment.lastInputAtMs + this.focusGraceMs,
        segment.lastObservedAtMs + this.maximumSampleGapMs,
      );
      // Do not manufacture a new segment when the adapter cannot prove that
      // the existing one remained observable up to this sample.
      if (safeEndMs !== nowMs) continue;
      const event = this.toUsageEvent(segment.appName, segment.startedAtMs, safeEndMs, false, true, deviceId);
      if (!event) continue;
      completed.push(event);
      segment.startedAtMs = safeEndMs;
      segment.lastObservedAtMs = nowMs;
    }
    return completed;
  }

  private finishIdle(deviceId: string, observedEndMs: number): AppUsageEvent | null {
    const segment = this.idleSegment;
    this.idleSegment = null;
    if (!segment) return null;
    const safeEndMs = Math.min(observedEndMs, segment.lastObservedAtMs + this.maximumSampleGapMs);
    return this.toUsageEvent(segment.appName, segment.startedAtMs, safeEndMs, true, true, deviceId);
  }

  private rollOverUtcDay(nowMs: number, deviceId: string) {
    const completed: AppUsageEvent[] = [];
    for (const [appName, segment] of Array.from(this.focusSegments.entries())) {
      if (utcDateKey(segment.startedAtMs) === utcDateKey(nowMs)) continue;
      const event = this.finishFocus(appName, deviceId, nowMs);
      if (event) completed.push(event);
      if (nowMs < segment.lastInputAtMs + this.focusGraceMs) {
        this.focusSegments.set(appName, {
          appName,
          startedAtMs: nowMs,
          lastInputAtMs: segment.lastInputAtMs,
          lastObservedAtMs: nowMs,
        });
      }
    }
    if (this.idleSegment && utcDateKey(this.idleSegment.startedAtMs) !== utcDateKey(nowMs)) {
      const idle = this.finishIdle(deviceId, nowMs);
      if (idle) completed.push(idle);
      this.idleSegment = {
        appName: idle?.appName ?? this.currentForegroundApp ?? "Unknown application",
        startedAtMs: nowMs,
        lastObservedAtMs: nowMs,
      };
    }
    return completed;
  }

  private observeRuntime(sample: ForegroundSample, deviceId: string): AppUsageEvent[] {
    const completed: AppUsageEvent[] = [];
    if (sample.openAppNames === undefined) {
      if (sample.isLocked) return completed;
      const foreground = sample.appName ? normalizeAppName(sample.appName) : null;
      if (!foreground) return completed;
      const existing = this.runtimeSegments.get(foreground);
      if (existing) existing.lastObservedAtMs = sample.observedAtMs;
      else this.runtimeSegments.set(foreground, { appName: foreground, startedAtMs: sample.observedAtMs, lastObservedAtMs: sample.observedAtMs });
      return completed;
    }

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
      if (existing) existing.lastObservedAtMs = sample.observedAtMs;
      else this.runtimeSegments.set(appName, { appName, startedAtMs: sample.observedAtMs, lastObservedAtMs: sample.observedAtMs });
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
    const safeEndMs = Math.min(observedEndMs, segment.lastObservedAtMs + this.maximumSampleGapMs);
    return this.toUsageEvent(segment.appName, segment.startedAtMs, safeEndMs, false, false, deviceId);
  }

  private toUsageEvent(
    appName: string,
    startedAtMs: number,
    endedAtMs: number,
    isIdle: boolean,
    isActiveWindow: boolean,
    deviceId: string,
  ): AppUsageEvent | null {
    const durationMs = endedAtMs - startedAtMs;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs < this.minimumDurationMs) return null;
    return {
      clientEventId: this.createEventId(),
      deviceId,
      appName,
      startedAt: new Date(startedAtMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      isIdle,
      isActiveWindow,
    };
  }
}

export function recoverTrackingCheckpoints(
  checkpoint: TrackingCheckpoint | null,
  deviceId: string,
  options: Pick<TrackingStateOptions, "minimumDurationMs" | "createEventId"> = {},
) {
  if (!checkpoint) return [];
  const segments = checkpoint.focusSegments?.length
    ? checkpoint.focusSegments
    : checkpoint.isIdle
      ? []
      : [{
          appName: checkpoint.appName,
          startedAtMs: checkpoint.startedAtMs,
          lastObservedAtMs: checkpoint.lastObservedAtMs,
          lastInputAtMs: checkpoint.lastInputAtMs ?? checkpoint.lastObservedAtMs,
        }];
  const minimumDurationMs = options.minimumDurationMs ?? 1;
  const createEventId = options.createEventId ?? randomUUID;
  const recovered = new Map<string, AppUsageEvent>();
  for (const segment of segments) {
    const appName = normalizeAppName(segment.appName);
    const durationMs = segment.lastObservedAtMs - segment.startedAtMs;
    if (!appName || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs < minimumDurationMs) continue;
    const event: AppUsageEvent = {
      clientEventId: createEventId(),
      deviceId,
      appName,
      startedAt: new Date(segment.startedAtMs).toISOString(),
      endedAt: new Date(segment.lastObservedAtMs).toISOString(),
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      isIdle: false,
      isActiveWindow: true,
    };
    recovered.set(`${event.appName}:${event.startedAt}:${event.endedAt}`, event);
  }
  return Array.from(recovered.values());
}

export function recoverTrackingCheckpoint(
  checkpoint: TrackingCheckpoint | null,
  deviceId: string,
  options: Pick<TrackingStateOptions, "minimumDurationMs" | "createEventId"> = {},
) {
  return recoverTrackingCheckpoints(checkpoint, deviceId, options)[0] ?? null;
}

export function normalizeAppName(value: string) {
  const normalized = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  const withoutExecutableSuffix = normalized.replace(/\.exe$/i, "");
  return withoutExecutableSuffix ? withoutExecutableSuffix.slice(0, 120) : null;
}

function clampIdleBoundary(idleStartedAtMs: number | undefined, lastInputAtMs: number | null, nowMs: number, focusGraceMs: number) {
  const fallback = (lastInputAtMs ?? nowMs) + focusGraceMs;
  const candidate = typeof idleStartedAtMs === "number" && Number.isFinite(idleStartedAtMs) ? idleStartedAtMs : fallback;
  return Math.max(0, Math.min(nowMs, candidate));
}

function utcDateKey(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}
