import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";
import { createInitialBrowserTrackingV2State, type BrowserTrackingRuntimeStateV2, type BrowserActivityIntervalV2 } from "../src/trackingV2Types.js";

type Runtime = {
  state: BrowserTrackingRuntimeStateV2;
  config: unknown; browserName: string; collectorState: string; store: unknown;
  ensureInitialized(): Promise<void>; guardLifecycleContinuity(): Promise<boolean>;
  refreshPolicyIfDue(): Promise<void>; flushLegacyQueue(): Promise<void>;
  flushStatusQueue(): Promise<void>; updateVisibleStatus(): Promise<void>;
  closeRecoveredV2Tail(): Promise<void>; requestSync(): Promise<void>;
  handleAlarm(): Promise<void>; handleWindowFocus(id: number): Promise<void>;
  startTrackingAfterActivation(): Promise<void>;
  captureAllowed(): boolean; focusPolicyAllowsCollection(): boolean;
  openRuntimeCollectionAllowed(): boolean; refreshCollectorKeepAlive(): void;
  openRuntimeEngine: unknown;
};
type Query = "last-window" | "window" | "tabs" | "tab" | "probe" | "idle";
type Mode = "hang" | "success" | "error" | "throw";

function harness(t: TestContext, query: Query, initialMode: Mode = "hang") {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  let monotonicMs = 0;
  t.mock.method(performance, "now", () => monotonicMs);
  let mode = initialMode;
  let late: ((value: unknown) => void) | undefined;
  const apiRuntime: { lastError?: { message: string } } = {};
  const window = { id: 1, focused: true, state: "normal", type: "normal", incognito: false };
  const tab = { id: 1, windowId: 1, active: true, url: "https://example.test/", incognito: false };
  let tabs: unknown[] = [tab];
  let idleState = "active";
  let proof = { type: "workmap:domain-probe-result", visible: false, focused: false };
  let idleQueries = 0;
  const respond = (name: Query, done: (value: unknown) => void, value: unknown) => {
    if (name === "idle") idleQueries += 1;
    if (name !== query || mode === "success") { done(value); return; }
    if (mode === "hang") { late = done; return; }
    if (mode === "throw") throw new Error("browser query unavailable");
    apiRuntime.lastError = { message: "browser query unavailable" };
    done(value);
    apiRuntime.lastError = undefined;
  };
  const api = {
    runtime: apiRuntime,
    windows: {
      getLastFocused: (_: unknown, done: (v: unknown) => void) => respond("last-window", done, window),
      get: (_id: number, _: unknown, done: (v: unknown) => void) => respond("window", done, window),
    },
    tabs: {
      query: (_: unknown, done: (v: unknown) => void) => respond("tabs", done, tabs),
      get: (_: number, done: (v: unknown) => void) => respond("tab", done, tab),
      sendMessage: (_id: number, _: unknown, done: (v: unknown) => void) => respond("probe", done, proof),
    },
    idle: { queryState: (_: number, done: (v: unknown) => void) => respond("idle", done, idleState) },
  };
  const runtime = new BrowserExtensionRuntimeV2(api as never) as unknown as Runtime;
  const now = Date.now();
  const iso = (offset: number) => new Date(now + offset).toISOString();
  runtime.state = {
    ...createInitialBrowserTrackingV2State(), protocolActivatedAt: iso(-60_000),
    activeTabId: query === "tab" ? 1 : null,
    systemIdle: false, lastSystemState: "active",
    trackingAccess: { hostPermission: "GRANTED", contentRegistration: "REGISTERED", checkedAt: iso(0), error: null },
    policy: {
      policyId: "test-policy", policyVersion: "v3", effectiveAt: iso(-60_000),
      policyLeaseId: "test-lease", policyLeaseIssuedAt: iso(-60_000), policyLeaseExpiresAt: iso(3_600_000),
      serverTime: iso(0), scheduleTimeZone: "Australia/Adelaide", scheduleTimeZoneState: "CONFIRMED",
      allowedUtcWindows: [{ startsAt: iso(-60_000), endsAt: iso(3_600_000) }], allowedUtcWindowsHash: "test",
      workHoursOnly: true, workdayStart: "09:00", workdayEnd: "21:33", idleThresholdMs: 60_000,
      collectAppFocus: true, collectDomainFocus: true, collectOpenRuntime: false, collectDomainOpenRuntime: false,
      acknowledgementState: "ACKNOWLEDGED", acknowledgedAt: iso(-60_000),
    },
  };
  runtime.config = { excludedHostnames: [] };
  runtime.browserName = "EDGE";
  runtime.collectorState = "HEALTHY";
  const intervals: BrowserActivityIntervalV2[] = [];
  runtime.store = {
    hasCapacity: async () => true, writeRuntimeState: async () => undefined,
    persistEngineUpdate: async (rows: BrowserActivityIntervalV2[], state: BrowserTrackingRuntimeStateV2) => { intervals.push(...rows); return state; },
    persistOpenRuntimeUpdate: async (rows: BrowserActivityIntervalV2[], state: BrowserTrackingRuntimeStateV2) => { intervals.push(...rows); return state; },
  };
  runtime.refreshCollectorKeepAlive = () => undefined;
  runtime.guardLifecycleContinuity = async () => false;
  for (const method of ["ensureInitialized", "refreshPolicyIfDue", "flushLegacyQueue", "flushStatusQueue", "updateVisibleStatus", "closeRecoveredV2Tail"] as const) {
    runtime[method] = async () => undefined;
  }
  let healthSyncs = 0;
  runtime.requestSync = async () => { healthSyncs += 1; };
  const run = () => query === "idle" ? runtime.startTrackingAfterActivation()
    : query === "window" ? runtime.handleWindowFocus(1) : runtime.handleAlarm();
  return { runtime, run, intervals, get healthSyncs() { return healthSyncs; }, get idleQueries() { return idleQueries; },
    recover: () => { mode = "success"; },
    hang: () => { mode = "hang"; },
    setIdle: (state: string) => { idleState = state; },
    setProof: () => { proof = { type: "workmap:domain-probe-result", visible: true, focused: true }; },
    closeTabs: () => { tabs = []; },
    advance: (ms: number) => { monotonicMs += ms; t.mock.timers.tick(ms); },
    lateReply: () => late?.(query === "idle" ? "locked" : query === "tabs" ? [] : query === "probe" ? { type: "workmap:domain-probe-result", visible: true, focused: true } : window),
  };
}

const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const query of ["last-window", "window", "tabs", "tab", "probe", "idle"] as const) {
  test(`${query} callback timeout releases maintenance and permits a later healthy query`, async (t) => {
    const h = harness(t, query);
    let finished = false;
    const pending = h.run().then(() => { finished = true; });
    await drain();
    assert.equal(finished, false);
    t.mock.timers.tick(15_001);
    await drain();
    assert.equal(finished, true, "a missing browser callback must not hold the operation lane forever");
    await pending;
    assert.ok(h.healthSyncs > 0, "health sync continues after the bounded failure");
    assert.equal(h.runtime.state.latestSnapshot, null, "a timeout cannot invent Focus evidence");
    const afterTimeout = structuredClone(h.runtime.state);
    h.lateReply();
    await drain();
    assert.deepEqual(h.runtime.state, afterTimeout, "a late reply must not mutate stale state");
    h.recover();
    await h.run();
    assert.ok(h.healthSyncs > 1);
    assert.equal(h.runtime.state.latestSnapshot, null, "an unfocused content probe remains ineligible");
    if (["last-window", "window", "tabs"].includes(query)) {
      assert.ok(h.runtime.state.diagnostics.some((row) => /FOCUS_.*QUERY_RETRY/.test(row.code)));
    }
  });
}

for (const mode of ["success", "error", "throw"] as const) {
  test(`a ${mode} window callback preserves normal maintenance behavior`, async (t) => {
    const h = harness(t, "last-window", mode);
    await h.run();
    assert.ok(h.healthSyncs > 0);
    assert.equal(h.runtime.state.latestSnapshot, null);
    assert.equal(h.runtime.state.diagnostics.some((row) => row.code === "FOCUS_WINDOW_QUERY_RETRY"), mode !== "success");
  });
}

test("startup idle timeout blocks collection until a normal alarm obtains fresh locked or active state", async (t) => {
  const h = harness(t, "idle");
  h.runtime.state.policy!.collectDomainOpenRuntime = true;
  const startup = h.runtime.startTrackingAfterActivation();
  await drain();
  h.advance(15_001);
  await startup;
  assert.equal(h.runtime.captureAllowed(), false);
  assert.equal(h.runtime.focusPolicyAllowsCollection(), false);
  assert.equal(h.runtime.openRuntimeCollectionAllowed(), false);
  h.recover();
  h.setIdle("locked");
  await h.runtime.handleAlarm();
  assert.equal(h.runtime.state.lastSystemState, "locked");
  assert.equal(h.runtime.captureAllowed(), false);
  assert.equal(h.runtime.openRuntimeCollectionAllowed(), false);
  assert.equal(h.intervals.length, 0);
});

test("a normal alarm recovers startup idle failure from a fresh active result without backfilling", async (t) => {
  const h = harness(t, "idle");
  const startup = h.runtime.startTrackingAfterActivation();
  await drain();
  h.advance(15_001);
  await startup;
  h.recover();
  h.setProof();
  await h.runtime.handleAlarm();
  assert.equal(h.idleQueries, 2, "normal maintenance must obtain new OS state after the startup query failed");
  assert.equal(h.runtime.state.latestSnapshot?.subjectKey, "example.test");
  assert.equal(h.intervals.length, 0, "recovery starts a new Focus session, not missing historical time");
});

test("a timed-out page probe releases ownership and the same tab is probed afresh next alarm", async (t) => {
  const h = harness(t, "probe");
  const first = h.runtime.handleAlarm();
  await drain();
  h.advance(15_001);
  await first;
  assert.equal(h.runtime.state.activeTabId, null);
  assert.equal(h.runtime.state.activeDomain, null);
  h.lateReply();
  await drain();
  assert.equal(h.runtime.state.latestSnapshot, null);
  h.recover();
  h.setProof();
  await h.runtime.handleAlarm();
  assert.equal(h.runtime.state.latestSnapshot?.subjectKey, "example.test");
  assert.equal(h.intervals.length, 0);
});

test("open-tab inventory timeout drops stale runtime ownership and cannot accrue across the unknown gap", async (t) => {
  const h = harness(t, "tabs", "success");
  h.runtime.state.policy!.collectDomainOpenRuntime = true;
  await h.runtime.handleAlarm();
  assert.ok(h.runtime.openRuntimeEngine);
  h.advance(20_000);
  h.hang();
  const first = h.runtime.handleAlarm();
  await drain();
  h.advance(15_001);
  await first;
  assert.equal(h.runtime.openRuntimeEngine, null, "failed inventory cannot retain ownership of old tabs");
  const sealedRows = structuredClone(h.intervals);
  assert.equal(sealedRows.reduce((total, row) => total + row.durationMs, 0), 20_000);
  h.advance(10_000);
  const second = h.runtime.handleAlarm();
  await drain();
  h.advance(15_001);
  await second;
  assert.deepEqual(h.intervals, sealedRows, "no new runtime may come from the failed inventory");
  h.closeTabs();
  h.recover();
  await h.runtime.handleAlarm();
  assert.equal(h.runtime.openRuntimeEngine, null);
  assert.deepEqual(h.intervals, sealedRows);
});
