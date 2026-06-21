import { createDomainUsageEvent, type DomainSession, type DomainUsageEvent } from "./domainTracking.js";

export type DomainTrackerSnapshot = { active: DomainSession | null };
export type DomainActivityState = "active" | "idle" | "stopped";

export class DomainTrackingState {
  private active: DomainSession | null;
  constructor(
    snapshot: DomainTrackerSnapshot = { active: null },
    private readonly minimumDurationMs = 5_000,
    private readonly maximumSampleGapMs = 2 * 60_000,
    private readonly createEventId: () => string = () => crypto.randomUUID(),
  ) {
    this.active = snapshot.active ? { ...snapshot.active, isIdle: snapshot.active.isIdle ?? false } : null;
  }

  observe(domain: string | null, state: DomainActivityState, nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    if (this.active && nowMs <= (this.active.lastObservedAt ?? this.active.startedAt)) return [];
    if (state === "stopped" || !domain) {
      const event = this.finish(nowMs, deviceId, browserName);
      return event ? [event] : [];
    }
    const isIdle = state === "idle";
    if (!this.active) {
      this.active = this.start(domain, isIdle, nowMs);
      return [];
    }
    if (this.active.domain === domain && this.active.isIdle === isIdle) {
      this.active.lastObservedAt = nowMs;
      return [];
    }
    const event = this.finish(nowMs, deviceId, browserName);
    this.active = this.start(domain, isIdle, nowMs);
    return event ? [event] : [];
  }

  checkpoint(nowMs: number, deviceId: string, browserName: string) {
    if (!this.active) return [];
    const domain = this.active.domain;
    const isIdle = this.active.isIdle;
    const event = this.finish(nowMs, deviceId, browserName);
    this.active = this.start(domain, isIdle, nowMs);
    return event ? [event] : [];
  }

  snapshot(): DomainTrackerSnapshot { return { active: this.active ? { ...this.active } : null }; }

  private start(domain: string, isIdle: boolean, nowMs: number): DomainSession {
    return { domain, isIdle, startedAt: nowMs, lastObservedAt: nowMs, clientEventId: this.createEventId() };
  }

  private finish(nowMs: number, deviceId: string, browserName: string): DomainUsageEvent | null {
    const session = this.active;
    this.active = null;
    return session ? createDomainUsageEvent(session, nowMs, deviceId, browserName, this.minimumDurationMs, this.maximumSampleGapMs) : null;
  }
}
