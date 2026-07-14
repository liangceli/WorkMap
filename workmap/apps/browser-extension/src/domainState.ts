import { createDomainUsageEvent, type DomainSession, type DomainUsageEvent } from "./domainTracking.js";

export type OpenDomainTab = { tabId: number; domain: string; windowId?: number };

type OpenDomainTabSnapshot = { domain: string; windowId?: number };
type ActiveDomainTab = DomainSession & { tabId: number; windowId?: number; lastInputAt: number };

export type DomainTrackerSnapshot = {
  version: 3;
  activeByTab: Record<string, ActiveDomainTab>;
  openTabs: Record<string, OpenDomainTabSnapshot>;
  runtimeByDomain: Record<string, DomainSession>;
  focusedWindowId: number | null;
};

type LegacyDomainTrackerSnapshot = Partial<DomainTrackerSnapshot> & {
  version?: number;
  focus?: DomainSession | null;
  focusTabId?: number | null;
  lastInputAt?: number | null;
  active?: DomainSession | null;
  openTabs?: Record<string, string | OpenDomainTabSnapshot>;
};

const DEFAULT_IDLE_THRESHOLD_MS = 30_000;

export class DomainTrackingState {
  private activeByTab: Record<string, ActiveDomainTab>;
  private openTabs: Record<string, OpenDomainTabSnapshot>;
  private runtimeByDomain: Record<string, DomainSession>;
  private focusedWindowId: number | null;

  constructor(
    snapshot: LegacyDomainTrackerSnapshot = {},
    private readonly minimumDurationMs = 0,
    private readonly maximumSampleGapMs = 2 * 60_000,
    private readonly createEventId: () => string = () => crypto.randomUUID(),
    private readonly idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
  ) {
    this.activeByTab = readActiveTabs(snapshot);
    this.openTabs = readOpenTabs(snapshot.openTabs ?? {});
    this.runtimeByDomain = Object.fromEntries(
      Object.entries(snapshot.runtimeByDomain ?? {}).map(([domain, session]) => [domain, { ...session, isIdle: false, isActiveWindow: false }]),
    );
    this.focusedWindowId = Number.isInteger(snapshot.focusedWindowId) ? snapshot.focusedWindowId ?? null : null;
  }

  reconcileTabs(tabs: OpenDomainTab[], nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    const events: DomainUsageEvent[] = [];
    const nextTabs: Record<string, OpenDomainTabSnapshot> = {};
    for (const tab of tabs) {
      if (Number.isInteger(tab.tabId) && tab.tabId >= 0 && tab.domain) {
        nextTabs[String(tab.tabId)] = { domain: tab.domain, ...(Number.isInteger(tab.windowId) ? { windowId: tab.windowId } : {}) };
      }
    }

    for (const [tabId, session] of Object.entries(this.activeByTab)) {
      const next = nextTabs[tabId];
      if (!next || next.domain !== session.domain) {
        events.push(...this.finishActiveTab(Number(tabId), nowMs, deviceId, browserName));
      }
    }

    const previousDomains = new Set(Object.values(this.openTabs).map((tab) => tab.domain));
    const nextDomains = new Set(Object.values(nextTabs).map((tab) => tab.domain));
    for (const domain of previousDomains) {
      if (!nextDomains.has(domain)) this.finishRuntime(domain, nowMs, deviceId, browserName, events);
    }
    for (const domain of nextDomains) {
      if (!previousDomains.has(domain) || !this.runtimeByDomain[domain]) this.runtimeByDomain[domain] = this.start(domain, false, false, nowMs);
      else this.runtimeByDomain[domain]!.lastObservedAt = nowMs;
    }

    this.openTabs = nextTabs;
    return events;
  }

  observeTab(tabId: number, domain: string | null, nowMs: number, deviceId: string, browserName: string, windowId?: number) {
    const tabs = Object.entries(this.openTabs)
      .filter(([storedId]) => Number(storedId) !== tabId)
      .map(([storedId, stored]) => ({ tabId: Number(storedId), domain: stored.domain, windowId: stored.windowId }));
    if (domain) tabs.push({ tabId, domain, windowId });
    return this.reconcileTabs(tabs, nowMs, deviceId, browserName);
  }

  activateTab(tabId: number, nowMs: number, deviceId: string, browserName: string, windowId?: number) {
    if (Number.isInteger(windowId)) this.focusedWindowId = windowId ?? null;
    const active = this.activeByTab[String(tabId)];
    if (active && Number.isInteger(windowId)) active.windowId = windowId;
    return this.advanceActiveSessions(nowMs, deviceId, browserName);
  }

  setFocusedWindow(windowId: number | null, nowMs: number, deviceId: string, browserName: string) {
    if (windowId === null) return this.stopAllFocus(nowMs, deviceId, browserName);
    this.focusedWindowId = windowId;
    return this.advanceActiveSessions(nowMs, deviceId, browserName);
  }

  blurTab(tabId: number, nowMs: number, deviceId: string, browserName: string) {
    return this.advanceActiveTab(tabId, nowMs, deviceId, browserName);
  }

  recordInteraction(tabId: number, domain: string, nowMs: number, deviceId: string, browserName: string, windowId?: number) {
    if (!Number.isFinite(nowMs) || !domain) return [];
    const events = this.observeTab(tabId, domain, nowMs, deviceId, browserName, windowId);
    events.push(...this.advanceActiveSessions(nowMs, deviceId, browserName));

    const key = String(tabId);
    const active = this.activeByTab[key];
    if (active && active.domain === domain && !active.isIdle) {
      active.lastInputAt = nowMs;
      active.lastObservedAt = nowMs;
      if (Number.isInteger(windowId)) active.windowId = windowId;
      return events;
    }

    if (active) events.push(...this.finishActiveTab(tabId, nowMs, deviceId, browserName));
    this.activeByTab[key] = this.startActive(tabId, domain, nowMs, windowId);
    return events;
  }

  markIdle(tabId: number, lastInputAt: number, nowMs: number, deviceId: string, browserName: string) {
    const active = this.activeByTab[String(tabId)];
    if (!active || active.lastInputAt !== lastInputAt) return [];
    return this.advanceActiveTab(tabId, nowMs, deviceId, browserName);
  }

  stopFocus(nowMs: number, deviceId: string, browserName: string) {
    return this.stopAllFocus(nowMs, deviceId, browserName);
  }

  stopAllFocus(nowMs: number, deviceId: string, browserName: string) {
    const events: DomainUsageEvent[] = [];
    for (const tabId of Object.keys(this.activeByTab).map(Number)) {
      events.push(...this.finishActiveTab(tabId, nowMs, deviceId, browserName));
    }
    this.focusedWindowId = null;
    return events;
  }

  checkpoint(nowMs: number, deviceId: string, browserName: string) {
    if (!Number.isFinite(nowMs)) return [];
    const events = this.advanceActiveSessions(nowMs, deviceId, browserName);
    for (const [tabId, session] of Object.entries(this.activeByTab)) {
      const event = this.toEvent(session, nowMs, deviceId, browserName);
      if (event) {
        events.push(event);
        this.activeByTab[tabId] = this.restartActive(session, nowMs);
      } else {
        session.lastObservedAt = nowMs;
      }
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
      version: 3,
      activeByTab: Object.fromEntries(Object.entries(this.activeByTab).map(([tabId, session]) => [tabId, { ...session }])),
      openTabs: Object.fromEntries(Object.entries(this.openTabs).map(([tabId, tab]) => [tabId, { ...tab }])),
      runtimeByDomain: Object.fromEntries(Object.entries(this.runtimeByDomain).map(([domain, session]) => [domain, { ...session }])),
      focusedWindowId: this.focusedWindowId,
    };
  }

  private advanceActiveSessions(nowMs: number, deviceId: string, browserName: string) {
    const events: DomainUsageEvent[] = [];
    for (const tabId of Object.keys(this.activeByTab).map(Number)) {
      events.push(...this.advanceActiveTab(tabId, nowMs, deviceId, browserName));
    }
    return events;
  }

  private advanceActiveTab(tabId: number, nowMs: number, deviceId: string, browserName: string) {
    const key = String(tabId);
    const active = this.activeByTab[key];
    if (!active) return [];
    if (active.isIdle) {
      active.lastObservedAt = Math.max(active.lastObservedAt ?? active.startedAt, nowMs);
      return [];
    }

    const idleAt = active.lastInputAt + this.idleThresholdMs;
    if (nowMs < idleAt) {
      active.lastObservedAt = Math.max(active.lastObservedAt ?? active.startedAt, nowMs);
      return [];
    }

    const event = this.toEvent(active, idleAt, deviceId, browserName);
    this.activeByTab[key] = {
      ...this.startActive(tabId, active.domain, idleAt, active.windowId),
      isIdle: true,
      lastInputAt: active.lastInputAt,
      lastObservedAt: nowMs,
    };
    return event ? [event] : [];
  }

  private finishActiveTab(tabId: number, nowMs: number, deviceId: string, browserName: string) {
    const key = String(tabId);
    const events = this.advanceActiveTab(tabId, nowMs, deviceId, browserName);
    const active = this.activeByTab[key];
    if (!active) return events;
    const event = this.toEvent(active, nowMs, deviceId, browserName);
    delete this.activeByTab[key];
    if (event) events.push(event);
    return events;
  }

  private finishRuntime(domain: string, nowMs: number, deviceId: string, browserName: string, events: DomainUsageEvent[]) {
    const session = this.runtimeByDomain[domain];
    delete this.runtimeByDomain[domain];
    if (!session) return;
    const event = this.toEvent(session, nowMs, deviceId, browserName);
    if (event) events.push(event);
  }

  private startActive(tabId: number, domain: string, nowMs: number, windowId?: number): ActiveDomainTab {
    return {
      ...this.start(domain, false, true, nowMs),
      tabId,
      ...(Number.isInteger(windowId) ? { windowId } : {}),
      lastInputAt: nowMs,
    };
  }

  private restartActive(session: ActiveDomainTab, nowMs: number): ActiveDomainTab {
    return {
      ...this.startActive(session.tabId, session.domain, nowMs, session.windowId),
      isIdle: session.isIdle,
      lastInputAt: session.lastInputAt,
    };
  }

  private start(domain: string, isIdle: boolean, isActiveWindow: boolean, nowMs: number): DomainSession {
    return { domain, isIdle, isActiveWindow, startedAt: nowMs, lastObservedAt: nowMs, clientEventId: this.createEventId() };
  }

  private toEvent(session: DomainSession, nowMs: number, deviceId: string, browserName: string) {
    return createDomainUsageEvent(session, nowMs, deviceId, browserName, this.minimumDurationMs, this.maximumSampleGapMs);
  }
}

function readActiveTabs(snapshot: LegacyDomainTrackerSnapshot) {
  if (snapshot.activeByTab) {
    return Object.fromEntries(
      Object.entries(snapshot.activeByTab)
        .filter(([tabId, session]) => Number.isInteger(Number(tabId)) && validSession(session))
        .map(([tabId, session]) => [tabId, { ...session, isActiveWindow: true }]),
    );
  }
  const legacyFocus = snapshot.focus ?? snapshot.active ?? null;
  if (!legacyFocus || !validSession(legacyFocus) || !Number.isInteger(snapshot.focusTabId)) return {};
  return {
    [String(snapshot.focusTabId)]: {
      ...legacyFocus,
      tabId: snapshot.focusTabId!,
      isActiveWindow: true,
      lastInputAt: Number.isFinite(snapshot.lastInputAt) ? snapshot.lastInputAt! : legacyFocus.lastObservedAt ?? legacyFocus.startedAt,
    },
  };
}

function readOpenTabs(tabs: Record<string, string | OpenDomainTabSnapshot>) {
  return Object.fromEntries(
    Object.entries(tabs)
      .filter(([tabId, tab]) => Number.isInteger(Number(tabId)) && Boolean(typeof tab === "string" ? tab : tab.domain))
      .map(([tabId, tab]) => [tabId, typeof tab === "string" ? { domain: tab } : { ...tab }]),
  );
}

function validSession(session: DomainSession | ActiveDomainTab): session is DomainSession {
  return Boolean(session.domain) && Number.isFinite(session.startedAt) && session.startedAt >= 0;
}
