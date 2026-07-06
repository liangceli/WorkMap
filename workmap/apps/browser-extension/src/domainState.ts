import { createDomainUsageEvent, type DomainSession, type DomainUsageEvent } from "./domainTracking.js";

export type OpenDomainTab = { tabId: number; domain: string };

export type DomainTrackerSnapshot = {
  version: 2;
  focus: DomainSession | null;
  focusTabId: number | null;
  lastInputAt: number | null;
  openTabs: Record<string, string>;
  runtimeByDomain: Record<string, DomainSession>;
  active?: DomainSession | null;
};

type LegacyDomainTrackerSnapshot = Partial<DomainTrackerSnapshot> & { active?: DomainSession | null };

const DEFAULT_IDLE_THRESHOLD_MS = 30_000;

export class DomainTrackingState {
  private focus: DomainSession | null;
  private focusTabId: number | null;
  private lastInputAt: number | null;
  private openTabs: Record<string, string>;
  private runtimeByDomain: Record<string, DomainSession>;

  constructor(
    snapshot: LegacyDomainTrackerSnapshot = {},
    private readonly minimumDurationMs = 0,
    private readonly maximumSampleGapMs = 2 * 60_000,
    private readonly createEventId: () => string = () => crypto.randomUUID(),
    private readonly idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
  ) {
    const legacyFocus = snapshot.focus ?? snapshot.active ?? null;
    this.focus = legacyFocus ? { ...legacyFocus, isActiveWindow: true } : null;
    this.focusTabId = Number.isInteger(snapshot.focusTabId) ? snapshot.focusTabId ?? null : null;
    this.lastInputAt = Number.isFinite(snapshot.lastInputAt) ? snapshot.lastInputAt ?? null : null;
    this.openTabs = { ...(snapshot.openTabs ?? {}) };
    this.runtimeByDomain = Object.fromEntries(
      Object.entries(snapshot.runtimeByDomain ?? {}).map(([domain, session]) => [domain, { ...session, isIdle: false, isActiveWindow: false }]),
    );
  }

  reconcileTabs(tabs: OpenDomainTab[], nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    const events: DomainUsageEvent[] = [];
    const nextTabs: Record<string, string> = {};
    for (const tab of tabs) {
      if (Number.isInteger(tab.tabId) && tab.tabId >= 0 && tab.domain) nextTabs[String(tab.tabId)] = tab.domain;
    }

    const previousDomains = new Set(Object.values(this.openTabs));
    const nextDomains = new Set(Object.values(nextTabs));
    for (const domain of previousDomains) {
      if (!nextDomains.has(domain)) this.finishRuntime(domain, nowMs, deviceId, browserName, events);
    }
    for (const domain of nextDomains) {
      if (!previousDomains.has(domain) || !this.runtimeByDomain[domain]) this.runtimeByDomain[domain] = this.start(domain, false, false, nowMs);
      else this.runtimeByDomain[domain]!.lastObservedAt = nowMs;
    }

    this.openTabs = nextTabs;
    if (this.focus && (this.focusTabId === null || nextTabs[String(this.focusTabId)] !== this.focus.domain)) {
      events.push(...this.stopFocus(nowMs, deviceId, browserName));
    }
    return events;
  }

  observeTab(tabId: number, domain: string | null, nowMs: number, deviceId: string, browserName: string) {
    const tabs = Object.entries(this.openTabs)
      .filter(([storedId]) => Number(storedId) !== tabId)
      .map(([storedId, storedDomain]) => ({ tabId: Number(storedId), domain: storedDomain }));
    if (domain) tabs.push({ tabId, domain });
    return this.reconcileTabs(tabs, nowMs, deviceId, browserName);
  }

  activateTab(tabId: number, nowMs: number, deviceId: string, browserName: string) {
    return this.focusTabId !== null && this.focusTabId !== tabId
      ? this.stopFocus(nowMs, deviceId, browserName)
      : [];
  }

  blurTab(tabId: number, nowMs: number, deviceId: string, browserName: string) {
    return this.focusTabId === tabId ? this.stopFocus(nowMs, deviceId, browserName) : [];
  }

  recordInteraction(tabId: number, domain: string, nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs) || !domain) return [];
    if (this.lastInputAt !== null && nowMs < this.lastInputAt) return [];
    const events = this.observeTab(tabId, domain, nowMs, deviceId, browserName);
    events.push(...this.advanceFocus(nowMs, deviceId, browserName));

    if (this.focus && this.focus.domain === domain && !this.focus.isIdle) {
      this.focusTabId = tabId;
      this.lastInputAt = nowMs;
      this.focus.lastObservedAt = nowMs;
      return events;
    }

    events.push(...this.finishFocus(nowMs, deviceId, browserName));
    this.focus = this.start(domain, false, true, nowMs);
    this.focusTabId = tabId;
    this.lastInputAt = nowMs;
    return events;
  }

  markIdle(tabId: number, lastInputAt: number, nowMs: number, deviceId: string, browserName: string) {
    if (this.focusTabId !== tabId || this.lastInputAt !== lastInputAt) return [];
    return this.advanceFocus(nowMs, deviceId, browserName);
  }

  stopFocus(nowMs: number, deviceId: string, browserName: string) {
    const events = this.advanceFocus(nowMs, deviceId, browserName);
    events.push(...this.finishFocus(nowMs, deviceId, browserName));
    this.focusTabId = null;
    this.lastInputAt = null;
    return events;
  }

  checkpoint(nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    const events = this.advanceFocus(nowMs, deviceId, browserName);
    if (this.focus) {
      const session = this.focus;
      const event = this.toEvent(session, nowMs, deviceId, browserName);
      if (event) events.push(event);
      this.focus = this.start(session.domain, session.isIdle, true, nowMs);
    }
    for (const [domain, session] of Object.entries(this.runtimeByDomain)) {
      const event = this.toEvent(session, nowMs, deviceId, browserName);
      if (event) events.push(event);
      this.runtimeByDomain[domain] = this.start(domain, false, false, nowMs);
    }
    return events;
  }

  snapshot(): DomainTrackerSnapshot {
    return {
      version: 2,
      focus: this.focus ? { ...this.focus } : null,
      focusTabId: this.focusTabId,
      lastInputAt: this.lastInputAt,
      openTabs: { ...this.openTabs },
      runtimeByDomain: Object.fromEntries(Object.entries(this.runtimeByDomain).map(([domain, session]) => [domain, { ...session }])),
    };
  }

  private advanceFocus(nowMs: number, deviceId: string, browserName: string) {
    if (!this.focus || this.focus.isIdle || this.lastInputAt === null) return [];
    const idleAt = this.lastInputAt + this.idleThresholdMs;
    if (nowMs < idleAt) {
      this.focus.lastObservedAt = Math.max(this.focus.lastObservedAt ?? this.focus.startedAt, nowMs);
      return [];
    }

    const domain = this.focus.domain;
    const events = this.finishFocus(idleAt, deviceId, browserName);
    this.focus = this.start(domain, true, true, idleAt);
    this.focus.lastObservedAt = nowMs;
    return events;
  }

  private finishFocus(nowMs: number, deviceId: string, browserName: string) {
    if (!this.focus) return [];
    const event = this.toEvent(this.focus, nowMs, deviceId, browserName);
    this.focus = null;
    if (!event) return [];
    return [event];
  }

  private finishRuntime(domain: string, nowMs: number, deviceId: string, browserName: string, events: DomainUsageEvent[]) {
    const session = this.runtimeByDomain[domain];
    delete this.runtimeByDomain[domain];
    if (!session) return;
    const event = this.toEvent(session, nowMs, deviceId, browserName);
    if (event) events.push(event);
  }

  private start(domain: string, isIdle: boolean, isActiveWindow: boolean, nowMs: number): DomainSession {
    return { domain, isIdle, isActiveWindow, startedAt: nowMs, lastObservedAt: nowMs, clientEventId: this.createEventId() };
  }

  private toEvent(session: DomainSession, nowMs: number, deviceId: string, browserName: string) {
    return createDomainUsageEvent(session, nowMs, deviceId, browserName, this.minimumDurationMs, this.maximumSampleGapMs);
  }
}
