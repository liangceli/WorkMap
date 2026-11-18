import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";
import {
  createInitialBrowserTrackingV2State,
  type BrowserTrackingRuntimeStateV2,
  type DeviceTrackingPolicyV2,
} from "../src/trackingV2Types.js";

type HarnessRuntime = {
  state: BrowserTrackingRuntimeStateV2;
  config: unknown;
  collectorState: string;
  errorCode: string;
  connectionState: string;
  browserName: string;
  lastPolicyRefreshAtMs: number;
  store: unknown;
  handleAlarm(): Promise<void>;
  restoreCollectorIfAllowed(): Promise<void>;
  refreshPolicyIfDue(): Promise<void>;
  startTrackingAfterActivation(): Promise<void>;
  closeRecoveredV2Tail(): Promise<void>;
  focusPolicyAllowsCollection(): boolean;
  captureAllowed(): boolean;
  openRuntimeCollectionAllowed(): boolean;
  applySyncSuccess(prepared: unknown, response: unknown, startedAt: number): Promise<void>;
  createHealth(): Promise<{ errorCode: string; connectionState: string }>;
  ensureInitialized(): Promise<void>;
  guardLifecycleContinuity(): Promise<boolean>;
  closeAtPolicyBoundary(): Promise<void>;
  reconcileOpenRuntime(): Promise<void>;
  reconcileBrowserReality(): Promise<void>;
  flushLegacyQueue(): Promise<void>;
  flushStatusQueue(): Promise<void>;
  requestSync(): Promise<void>;
  updateVisibleStatus(): Promise<void>;
};

function harness(t: TestContext) {
  const now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const policy: DeviceTrackingPolicyV2 = {
    policyId: "test-policy", policyVersion: "v3", effectiveAt: new Date(now).toISOString(),
    policyLeaseId: "test-lease", policyLeaseIssuedAt: new Date(now).toISOString(),
    policyLeaseExpiresAt: new Date(now + 3_600_000).toISOString(),
    serverTime: new Date(now).toISOString(), scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED", allowedUtcWindows: [{
      startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
    }], allowedUtcWindowsHash: "test-window", workHoursOnly: true,
    workdayStart: "09:00", workdayEnd: "21:33", idleThresholdMs: 60_000,
    collectAppFocus: true, collectDomainFocus: true, collectOpenRuntime: false,
    collectDomainOpenRuntime: true, acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: new Date(now).toISOString(),
  };
  const runtime = new BrowserExtensionRuntimeV2({
    runtime: {}, idle: { queryState: (_: number, done: (state: string) => void) => done("active") },
  } as never) as unknown as HarnessRuntime;
  runtime.config = { apiBaseUrl: "https://api.example.test", deviceId: "test-device", credential: "test-only", browserName: "EDGE" };
  runtime.state = {
    ...createInitialBrowserTrackingV2State(), policy, protocolActivatedAt: new Date(now).toISOString(),
    confirmedIntervalThrough: new Date(now - 60_000).toISOString(),
    systemIdle: false, lastSystemState: "active", trackingAccess: {
      hostPermission: "GRANTED", contentRegistration: "FAILED",
      checkedAt: new Date(now - 60_000).toISOString(), error: "registration unavailable",
    },
  };
  runtime.collectorState = "PAUSED";
  runtime.errorCode = "INTERACTION_PERMISSION_REQUIRED";
  runtime.lastPolicyRefreshAtMs = now;
  runtime.store = {
    hasCapacity: async () => true,
    writeRuntimeState: async () => undefined,
    readRuntimeState: async () => runtime.state,
    applySyncResults: async () => undefined,
    stats: async () => ({ pending: 1, ready: 1, deadLetter: 0, oldestQueuedAt: null, nextRetryAt: null }),
    reset: async () => { throw new Error("Recovery must not reset tracking stores"); },
  };
  runtime.ensureInitialized = async () => undefined;
  runtime.guardLifecycleContinuity = async () => false;
  for (const name of ["closeAtPolicyBoundary", "closeRecoveredV2Tail", "reconcileOpenRuntime", "reconcileBrowserReality", "flushLegacyQueue", "flushStatusQueue", "updateVisibleStatus"] as const) {
    runtime[name] = async () => undefined;
  }
  let heartbeats = 0;
  runtime.requestSync = async () => { heartbeats += 1; };
  let fail = true;
  let permission = true;
  let registrations = 0;
  let injections = 0;
  const apiRuntime: { lastError?: { message: string } } = {};
  const globalChrome = globalThis as typeof globalThis & { chrome?: unknown };
  const oldChrome = globalChrome.chrome;
  const stored: Record<string, unknown> = {};
  globalChrome.chrome = {
    runtime: apiRuntime,
    storage: { local: {
      get: (_keys: unknown, done: (value: unknown) => void) => done(stored),
      set: (value: Record<string, unknown>, done: () => void) => { Object.assign(stored, value); done(); },
    } },
    permissions: { contains: (_: unknown, done: (granted: boolean) => void) => done(permission) },
    scripting: {
      getRegisteredContentScripts: (_: unknown, done: (scripts: unknown[]) => void) => done([]),
      registerContentScripts: (_: unknown, done: () => void) => {
        registrations += 1;
        apiRuntime.lastError = fail ? { message: "temporary registration failure" } : undefined;
        done();
        apiRuntime.lastError = undefined;
      },
      executeScript: (_: unknown, done: () => void) => { injections += 1; done(); },
    },
    tabs: { query: (_: unknown, done: (tabs: unknown[]) => void) => done([{ id: 1, url: "https://example.test/" }]) },
  };
  t.after(() => { globalChrome.chrome = oldChrome; });
  return { runtime, stored, get heartbeats() { return heartbeats; },
    get registrations() { return registrations; }, get injections() { return injections; },
    recover: () => { fail = false; }, deny: () => { permission = false; },
    advance: (ms: number) => t.mock.timers.tick(ms), policy };
}

test("an alarm retries failed registration, stays paused on failure, then recovers without resetting data", async (t) => {
  const h = harness(t);
  const confirmedThrough = h.runtime.state.confirmedIntervalThrough;
  const clientInstanceId = h.runtime.state.clientInstanceId;
  await h.runtime.handleAlarm();
  assert.equal(h.registrations, 1, "maintenance must retry the failed registration");
  assert.equal(h.runtime.collectorState, "PAUSED");
  assert.equal(h.runtime.errorCode, "INTERACTION_PERMISSION_REQUIRED");
  assert.equal(h.runtime.focusPolicyAllowsCollection(), false);
  assert.equal(h.runtime.captureAllowed(), false);
  assert.equal(h.runtime.openRuntimeCollectionAllowed(), false);
  assert.equal(h.heartbeats, 1, "a failed collector retry must not suppress health sync");
  h.recover();
  await h.runtime.handleAlarm();
  assert.equal(h.registrations, 1, "duplicate alarms must not spin registration retries");
  h.advance(30_000);
  await h.runtime.handleAlarm();
  assert.equal(h.registrations, 2);
  assert.equal(h.runtime.state.trackingAccess.contentRegistration, "REGISTERED");
  assert.equal(h.runtime.collectorState, "HEALTHY");
  assert.equal(h.runtime.focusPolicyAllowsCollection(), true);
  assert.equal(h.injections, 1);
  h.advance(30_000);
  await h.runtime.handleAlarm();
  assert.equal(h.registrations, 2, "successful registration must not be repeated every alarm");
  assert.equal(h.runtime.state.confirmedIntervalThrough, confirmedThrough);
  assert.equal(h.runtime.state.clientInstanceId, clientInstanceId);
});

test("health restoration never hides failed or missing content registration", async (t) => {
  const h = harness(t);
  for (const registration of ["FAILED", "UNKNOWN"] as const) {
    h.runtime.state.trackingAccess.contentRegistration = registration;
    await h.runtime.restoreCollectorIfAllowed();
    assert.equal(h.runtime.collectorState, "PAUSED");
    assert.equal(h.runtime.errorCode, "INTERACTION_PERMISSION_REQUIRED");
  }
});

test("a successful policy refresh cannot overwrite a registration failure with healthy", async (t) => {
  const h = harness(t);
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(h.policy), { status: 200 }));
  h.runtime.lastPolicyRefreshAtMs = 0;
  await h.runtime.refreshPolicyIfDue();
  assert.equal(h.runtime.collectorState, "PAUSED");
  assert.equal(h.runtime.errorCode, "INTERACTION_PERMISSION_REQUIRED");
});

test("post-activation startup preserves the failed-registration gate", async (t) => {
  const h = harness(t);
  h.runtime.collectorState = "HEALTHY";
  h.runtime.errorCode = "NONE";
  await h.runtime.startTrackingAfterActivation();
  assert.equal(h.runtime.collectorState, "PAUSED");
  assert.equal(h.runtime.errorCode, "INTERACTION_PERMISSION_REQUIRED");
  assert.equal(h.heartbeats, 1);
});

test("a denied permission remains gated without requesting access or retrying registration", async (t) => {
  const h = harness(t);
  h.deny();
  await h.runtime.handleAlarm();
  assert.equal(h.runtime.state.trackingAccess.hostPermission, "REQUIRED");
  assert.equal(h.runtime.collectorState, "PAUSED");
  h.advance(60_000);
  await h.runtime.handleAlarm();
  assert.equal(h.registrations, 0);
  assert.equal(h.runtime.focusPolicyAllowsCollection(), false);
  assert.equal(h.heartbeats, 2);
});

for (const access of ["FAILED", "REQUIRED"] as const) {
  test(`successful sync retains the ${access} collection error while connection becomes online`, async (t) => {
    const h = harness(t);
    const runtime = h.runtime;
    runtime.connectionState = "ONLINE";
    runtime.browserName = "EDGE";
    if (access === "REQUIRED") runtime.state.trackingAccess = {
      hostPermission: "REQUIRED", contentRegistration: "UNKNOWN", checkedAt: null, error: null,
    };
    runtime.updateVisibleStatus = (BrowserExtensionRuntimeV2.prototype as unknown as HarnessRuntime).updateVisibleStatus;
    await runtime.applySyncSuccess({
      generation: 0, deviceId: "test-device", clientInstanceId: runtime.state.clientInstanceId,
      requestId: "11111111-1111-4111-8111-111111111111", sentSnapshot: null,
    }, {
      requestId: "11111111-1111-4111-8111-111111111111", serverTime: new Date().toISOString(),
      results: [], cursors: [], focusSnapshotResult: null,
    }, Date.now());
    const health = await runtime.createHealth();
    assert.equal(health.connectionState, "ONLINE");
    assert.equal(health.errorCode, "INTERACTION_PERMISSION_REQUIRED");
    assert.equal(runtime.state.lastErrorCode, "INTERACTION_PERMISSION_REQUIRED");
    assert.equal((h.stored.workmapStatus as { trackingState: string }).trackingState,
      access === "FAILED" ? "registration_failed" : "permission_required");
  });
}
