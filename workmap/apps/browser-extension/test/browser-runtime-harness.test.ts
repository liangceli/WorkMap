import assert from "node:assert/strict";
import test from "node:test";
import {
  eligibleDomainForTab,
  isUsableFocusedWindow,
  messageCanOwnFocus,
  type BrowserTabObservationV2,
  type BrowserWindowObservationV2,
} from "../src/browserEligibilityV2.js";
import { BrowserFocusEngineV2 } from "../src/browserFocusEngineV2.js";
import type {
  BrowserActivityIntervalV2,
  BrowserClockEpochV2,
  DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

class ChromeApiRuntimeHarness {
  readonly tabs = new Map<number, BrowserTabObservationV2>();
  readonly windows = new Map<number, BrowserWindowObservationV2>();
  readonly intervals: BrowserActivityIntervalV2[] = [];
  private engine: BrowserFocusEngineV2 | null = null;
  private focusedWindowId: number | null = null;
  private focusedTabId: number | null = null;
  private domain: string | null = null;
  private nextId = 1;

  addWindow(window: BrowserWindowObservationV2) {
    this.windows.set(window.id!, window);
  }

  addTab(tab: BrowserTabObservationV2) {
    this.tabs.set(tab.id!, tab);
  }

  focusWindow(windowId: number | null, at: number) {
    for (const window of this.windows.values()) window.focused = false;
    const window = windowId === null ? null : this.windows.get(windowId) ?? null;
    if (window) window.focused = true;
    if (!isUsableFocusedWindow(window)) {
      this.clear(at);
      this.focusedWindowId = null;
      return;
    }
    if (this.focusedWindowId !== windowId) this.clear(at);
    this.focusedWindowId = windowId;
  }

  trustedInteraction(tabId: number, at: number) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    const activeTabs = [...this.tabs.values()].filter(
      (item) => item.windowId === this.focusedWindowId && item.active,
    );
    if (!messageCanOwnFocus({ senderTab: tab, focusedWindowId: this.focusedWindowId, activeTabs })) {
      return false;
    }
    const domain = eligibleDomainForTab(tab, ["excluded.example"]);
    if (!domain) return false;
    if (this.engine && (this.focusedTabId !== tabId || this.domain !== domain)) {
      this.clear(at);
    }
    this.engine ??= new BrowserFocusEngineV2(
      clock(at),
      policy(),
      "CHROME",
      null,
      () => `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
    );
    this.focusedTabId = tabId;
    this.domain = domain;
    this.apply(this.engine.acquireFocus({ subjectKey: domain, displayName: domain }, at));
    this.apply(this.engine.recordTrustedInteraction(at));
    return true;
  }

  contentMessage(tabId: number, trusted: boolean, at: number) {
    return trusted ? this.trustedInteraction(tabId, at) : false;
  }

  navigate(tabId: number, url: string, at: number, reload = false) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    const previousDomain = eligibleDomainForTab(tab, ["excluded.example"]);
    tab.url = url;
    const nextDomain = eligibleDomainForTab(tab, ["excluded.example"]);
    if (
      tabId === this.focusedTabId &&
      (reload || previousDomain !== nextDomain || nextDomain === null)
    ) {
      this.clear(at);
    }
  }

  removeTab(tabId: number, at: number) {
    this.tabs.delete(tabId);
    if (tabId === this.focusedTabId) this.clear(at);
  }

  replaceTab(removedTabId: number, added: BrowserTabObservationV2, at: number) {
    this.removeTab(removedTabId, at);
    this.addTab(added);
  }

  observe(at: number) {
    if (this.engine) this.apply(this.engine.settle(at));
  }

  systemUnavailable(at: number) {
    this.clear(at);
  }

  currentDomain() {
    return this.domain;
  }

  private clear(at: number) {
    if (this.engine) this.apply(this.engine.clearFocus(at));
    this.engine = null;
    this.focusedTabId = null;
    this.domain = null;
  }

  private apply(update: ReturnType<BrowserFocusEngineV2["observe"]>) {
    this.intervals.push(...update.intervals);
  }
}

test("two windows on one or two displays still produce one OS-focused Domain", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 1, focused: false, state: "normal", type: "normal" });
  harness.addWindow({ id: 2, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 11, windowId: 1, active: true, url: "https://a.example/path" });
  harness.addTab({ id: 22, windowId: 2, active: true, url: "https://b.example/private" });

  harness.focusWindow(1, 0);
  assert.equal(harness.trustedInteraction(22, 1_000), false, "background-window active tab is not focus");
  assert.equal(harness.trustedInteraction(11, 1_000), true);
  harness.focusWindow(2, 6_000);
  assert.equal(harness.trustedInteraction(22, 6_000), true);
  harness.observe(11_000);

  assert.deepEqual(
    harness.intervals.map((row) => [row.subjectKey, row.startedMonotonicMs, row.endedMonotonicMs]),
    [
      ["a.example", 1_000, 6_000],
      ["b.example", 6_000, 11_000],
    ],
  );
});

test("same-host tabs remain one Domain identity without overlap or multiplied time", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 1, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 1, windowId: 1, active: true, url: "https://docs.example/a" });
  harness.addTab({ id: 2, windowId: 1, active: false, url: "https://docs.example/b" });
  harness.focusWindow(1, 0);
  assert.equal(harness.trustedInteraction(1, 1_000), true);
  harness.tabs.get(1)!.active = false;
  harness.tabs.get(2)!.active = true;
  assert.equal(harness.trustedInteraction(2, 4_000), true);
  harness.observe(9_000);

  assert.equal(harness.intervals.reduce((sum, row) => sum + row.durationMs, 0), 8_000);
  assert(harness.intervals.every((row) => row.subjectKey === "docs.example"));
  assert.equal(harness.intervals[0]!.endedAt, harness.intervals[1]!.startedAt);
});

test("Chrome 140+ Split View trusts only the peer that emits a trusted event", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 7, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 70, windowId: 7, active: true, splitViewId: 42, url: "https://left.example" });
  harness.addTab({ id: 71, windowId: 7, active: false, splitViewId: 42, url: "https://right.example" });
  harness.addTab({ id: 72, windowId: 7, active: false, url: "https://unproven.example" });
  harness.focusWindow(7, 0);

  assert.equal(harness.trustedInteraction(70, 500), true);
  assert.equal(harness.trustedInteraction(71, 1_500), true, "same splitViewId proves the visible peer");
  assert.equal(harness.currentDomain(), "right.example");
  assert.equal(harness.trustedInteraction(72, 2_000), false, "versions without splitViewId stay conservative");
});

test("WINDOW_ID_NONE, minimization, idle and lock boundaries stop Focus", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 1, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 1, windowId: 1, active: true, url: "https://work.example" });
  harness.focusWindow(1, 0);
  harness.trustedInteraction(1, 1_000);
  harness.focusWindow(null, 3_000);
  assert.equal(harness.currentDomain(), null);

  harness.windows.get(1)!.state = "minimized";
  harness.focusWindow(1, 4_000);
  assert.equal(harness.trustedInteraction(1, 4_500), false);
  harness.windows.get(1)!.state = "normal";
  harness.focusWindow(1, 5_000);
  harness.trustedInteraction(1, 5_000);
  harness.systemUnavailable(6_000);
  assert.equal(harness.currentDomain(), null);
});

test("protected, excluded and incognito pages never become Domain Focus", () => {
  const activeTabs = (tab: BrowserTabObservationV2) => [{ ...tab, active: true }];
  for (const tab of [
    { id: 1, windowId: 1, active: true, url: "chrome://extensions" },
    { id: 2, windowId: 1, active: true, url: "edge://settings" },
    { id: 3, windowId: 1, active: true, url: "file:///private.pdf" },
    { id: 4, windowId: 1, active: true, url: "https://excluded.example/path" },
    { id: 5, windowId: 1, active: true, incognito: true, url: "https://private.example" },
  ] satisfies BrowserTabObservationV2[]) {
    assert.equal(messageCanOwnFocus({ senderTab: tab, focusedWindowId: 1, activeTabs: activeTabs(tab) }), tab.incognito !== true);
    assert.equal(eligibleDomainForTab(tab, ["excluded.example"]), null);
  }
});

test("untrusted and background-frame messages are rejected while iframe input uses the top tab hostname", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 1, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 1, windowId: 1, active: true, url: "https://top.example/page" });
  harness.addTab({ id: 2, windowId: 1, active: false, url: "https://background.example" });
  harness.focusWindow(1, 0);

  assert.equal(harness.contentMessage(1, false, 1_000), false);
  assert.equal(harness.contentMessage(2, true, 1_500), false);
  assert.equal(
    harness.contentMessage(1, true, 2_000),
    true,
    "an iframe sender is attributed through sender.tab to the top-level hostname",
  );
  assert.equal(harness.currentDomain(), "top.example");
});

test("SPA, cross-host navigation, reload, replace and removal use honest boundaries", () => {
  const harness = new ChromeApiRuntimeHarness();
  harness.addWindow({ id: 1, focused: false, state: "normal", type: "normal" });
  harness.addTab({ id: 10, windowId: 1, active: true, url: "https://a.example/start" });
  harness.focusWindow(1, 0);
  harness.trustedInteraction(10, 1_000);

  harness.navigate(10, "https://a.example/spa?state=2", 3_000);
  assert.equal(harness.currentDomain(), "a.example", "same-host SPA changes keep one identity");
  harness.navigate(10, "https://b.example/next", 5_000);
  assert.equal(harness.currentDomain(), null, "cross-host navigation waits for new page proof");
  harness.trustedInteraction(10, 6_000);
  harness.navigate(10, "https://b.example/next", 7_000, true);
  assert.equal(harness.currentDomain(), null, "reload requires fresh content-script proof");
  harness.trustedInteraction(10, 8_000);
  harness.replaceTab(10, { id: 11, windowId: 1, active: true, url: "https://c.example" }, 9_000);
  assert.equal(harness.currentDomain(), null);
  harness.trustedInteraction(11, 10_000);
  harness.removeTab(11, 12_000);

  assert.deepEqual(
    harness.intervals.map((row) => [row.subjectKey, row.startedMonotonicMs, row.endedMonotonicMs]),
    [
      ["a.example", 1_000, 5_000],
      ["b.example", 6_000, 7_000],
      ["b.example", 8_000, 9_000],
      ["c.example", 10_000, 12_000],
    ],
  );
});

function clock(startedAt: number): BrowserClockEpochV2 {
  return {
    clockEpochId: `10000000-0000-4000-8000-${String(startedAt).padStart(12, "0")}`,
    clockEpochStartedAt: new Date(Date.UTC(2026, 6, 21, 0, 0, 0, startedAt)).toISOString(),
    clockEpochStartedMonotonicMs: startedAt,
  };
}

function policy(): DeviceTrackingPolicyV2 {
  return {
    policyId: "policy-1",
    policyVersion: "v1",
    effectiveAt: "2026-07-21T00:00:00.000Z",
    policyLeaseId: "lease-1",
    policyLeaseIssuedAt: "2026-07-21T00:00:00.000Z",
    policyLeaseExpiresAt: "2026-07-22T00:00:00.000Z",
    serverTime: "2026-07-21T00:00:00.000Z",
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [{ startsAt: "2026-07-21T00:00:00.000Z", endsAt: "2026-07-22T00:00:00.000Z" }],
    allowedUtcWindowsHash: "hash",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "23:00",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: "2026-07-20T00:00:00.000Z",
  };
}
