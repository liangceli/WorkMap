import { createDomainUsageEvent, type DomainSession, type DomainUsageEvent } from "./domainTracking.js";

export type DomainTrackerSnapshot = { active: DomainSession | null };

export class DomainTrackingState {
  private active: DomainSession | null;
  constructor(
    snapshot: DomainTrackerSnapshot = { active: null },
    private readonly minimumDurationMs = 5_000,
    private readonly maximumSampleGapMs = 2 * 60_000,
    private readonly createEventId: () => string = () => crypto.randomUUID(),
  ) {
    this.active = snapshot.active;
  }

  observe(domain: string | null, isActive: boolean, nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    if (this.active && nowMs <= (this.active.lastObservedAt ?? this.active.startedAt)) return [];
    if (!isActive || !domain) {
      const event = this.finish(nowMs, deviceId, browserName);
      return event ? [event] : [];
    }
    if (!this.active) {
      this.active = this.start(domain, nowMs);
      return [];
    }
    if (this.active.domain === domain) {
      this.active.lastObservedAt = nowMs;
      return [];
    }
    const event = this.finish(nowMs, deviceId, browserName);
    this.active = this.start(domain, nowMs);
    return event ? [event] : [];
  }

  checkpoint(nowMs: number, deviceId: string, browserName: string) {
    if (!this.active) return [];
    const domain = this.active.domain;
    const event = this.finish(nowMs, deviceId, browserName);
    this.active = this.start(domain, nowMs);
    return event ? [event] : [];
  }

  snapshot(): DomainTrackerSnapshot { return { active: this.active ? { ...this.active } : null }; }

  private start(domain: string, nowMs: number): DomainSession {
    return { domain, startedAt: nowMs, lastObservedAt: nowMs, clientEventId: this.createEventId() };
  }

  private finish(nowMs: number, deviceId: string, browserName: string): DomainUsageEvent | null {
    const session = this.active;
    this.active = null;
    return session ? createDomainUsageEvent(session, nowMs, deviceId, browserName, this.minimumDurationMs, this.maximumSampleGapMs) : null;
  }
}
