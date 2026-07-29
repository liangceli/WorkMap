import assert from "node:assert/strict";
import test from "node:test";
import { BrowserExtensionRuntimeV2 } from "../src/backgroundV2.js";
import {
  createInitialBrowserTrackingV2State,
  type BrowserTrackingRuntimeStateV2,
  type DeviceTrackingPolicyV2,
  type TrackingCollectorStateV2,
  type TrackingHealthErrorCodeV2,
} from "../src/trackingV2Types.js";

type HarnessRuntime = {
  state: BrowserTrackingRuntimeStateV2 | null;
  config: { excludedHostnames: string[] } | null;
  browserName: "EDGE" | "CHROME" | null;
  collectorState: TrackingCollectorStateV2;
  errorCode: TrackingHealthErrorCodeV2;
  store: {
    hasCapacity(): Promise<boolean>;
    writeRuntimeState(state: BrowserTrackingRuntimeStateV2): Promise<void>;
  };
  ensureInitialized(): Promise<void>;
  guardLifecycleContinuity(): Promise<boolean>;
  updateVisibleStatus(): Promise<void>;
  acquireMessageFocus(
    tab: { id?: number; windowId?: number; url?: string },
    domain: string,
    at: number,
  ): Promise<void>;
  requestSync(immediate: boolean): Promise<void>;
  handleMessage(
    message: { type?: string; activityAt?: number; observedAt?: number },
    sender: {
      tab?: {
        id?: number;
        windowId?: number;
        url?: string;
        active?: boolean;
      };
      frameId?: number;
    },
  ): Promise<void>;
};

function activePolicy(nowMs = Date.now()): DeviceTrackingPolicyV2 {
  return {
    policyId: "policy",
    policyVersion: "v3",
    effectiveAt: new Date(nowMs - 60_000).toISOString(),
    policyLeaseId: "lease",
    policyLeaseIssuedAt: new Date(nowMs - 60_000).toISOString(),
    policyLeaseExpiresAt: new Date(nowMs + 60 * 60_000).toISOString(),
    serverTime: new Date(nowMs).toISOString(),
    scheduleTimeZone: "Australia/Adelaide",
    scheduleTimeZoneState: "CONFIRMED",
    allowedUtcWindows: [{
      startsAt: new Date(nowMs - 60_000).toISOString(),
      endsAt: new Date(nowMs + 60 * 60_000).toISOString(),
    }],
    allowedUtcWindowsHash: "window",
    workHoursOnly: true,
    workdayStart: "09:00",
    workdayEnd: "21:33",
    idleThresholdMs: 60_000,
    collectAppFocus: true,
    collectDomainFocus: true,
    collectOpenRuntime: false,
    collectDomainOpenRuntime: true,
    acknowledgementState: "ACKNOWLEDGED",
    acknowledgedAt: new Date(nowMs - 60_000).toISOString(),
  };
}

function state(systemIdle: boolean): BrowserTrackingRuntimeStateV2 {
  return {
    ...createInitialBrowserTrackingV2State(),
    protocolActivatedAt: new Date(Date.now() - 60_000).toISOString(),
    policy: activePolicy(),
    systemIdle,
    lastSystemState: systemIdle ? "idle" : "active",
    trackingAccess: {
      hostPermission: "GRANTED",
      contentRegistration: "REGISTERED",
      checkedAt: new Date().toISOString(),
      error: null,
    },
  };
}

function createHarness(options?: {
  failWindowQuery?: boolean;
  focusedWindow?: boolean;
}) {
  const runtimeApi: { lastError?: { message?: string } } = {};
  const tab = {
    id: 7,
    windowId: 3,
    url: "https://work.example/private-path?not-collected=true",
    active: true,
  };
  const chromeApi = {
    runtime: runtimeApi,
    windows: {
      get(
        _windowId: number,
        _query: { populate: false },
        callback: (window: Record<string, unknown>) => void,
      ) {
        runtimeApi.lastError = options?.failWindowQuery
          ? { message: "window query unavailable" }
          : undefined;
        callback({
          id: 3,
          focused: options?.focusedWindow ?? true,
          incognito: false,
          state: "normal",
          type: "normal",
        });
        runtimeApi.lastError = undefined;
      },
    },
    tabs: {
      query(
        _query: Record<string, unknown>,
        callback: (tabs: Array<typeof tab>) => void,
      ) {
        callback([tab]);
      },
    },
  };
  const runtime = new BrowserExtensionRuntimeV2(
    chromeApi as never,
  ) as unknown as HarnessRuntime;
  runtime.config = { excludedHostnames: [] };
  runtime.browserName = "EDGE";
  runtime.ensureInitialized = async () => undefined;
  runtime.guardLifecycleContinuity = async () => false;
  runtime.updateVisibleStatus = async () => undefined;
  runtime.requestSync = async () => undefined;
  runtime.store = {
    hasCapacity: async () => true,
    writeRuntimeState: async () => undefined,
  };
  return { runtime, tab };
}

test("trusted foreground activity recovers a stale idle/paused Focus lane", async () => {
  const { runtime, tab } = createHarness();
  runtime.state = state(true);
  runtime.collectorState = "PAUSED";
  runtime.errorCode = "NONE";
  const acquired: Array<[string, number]> = [];
  runtime.acquireMessageFocus = async (_tab, domain, at) => {
    acquired.push([domain, at]);
  };

  await runtime.handleMessage(
    { type: "workmap:domain-activity", activityAt: Date.now() },
    { tab, frameId: 0 },
  );

  assert.equal(runtime.state?.systemIdle, false);
  assert.equal(runtime.state?.lastSystemState, "active");
  assert.equal(runtime.state?.focusedWindowId, tab.windowId);
  assert.equal(runtime.collectorState, "HEALTHY");
  assert.equal(runtime.errorCode, "NONE");
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0]?.[0], "work.example");
});

test("trusted foreground activity recovers after a limited reconciliation cycle", async () => {
  const { runtime, tab } = createHarness();
  runtime.state = state(false);
  runtime.collectorState = "LIMITED";
  runtime.errorCode = "UNKNOWN";
  let acquired = false;
  runtime.acquireMessageFocus = async () => {
    acquired = true;
  };

  await runtime.handleMessage(
    { type: "workmap:domain-activity", activityAt: Date.now() },
    { tab, frameId: 0 },
  );

  assert.equal(acquired, true);
  assert.equal(runtime.collectorState, "HEALTHY");
  assert.equal(runtime.errorCode, "NONE");
});

test("a passive page checkpoint cannot override a real system-idle boundary", async () => {
  const { runtime, tab } = createHarness();
  runtime.state = state(true);
  runtime.collectorState = "PAUSED";
  let acquired = false;
  runtime.acquireMessageFocus = async () => {
    acquired = true;
  };

  await runtime.handleMessage(
    { type: "workmap:domain-checkpoint", observedAt: Date.now() },
    { tab, frameId: 0 },
  );

  assert.equal(acquired, false);
  assert.equal(runtime.state?.systemIdle, true);
  assert.equal(runtime.collectorState, "PAUSED");
});

test("trusted activity cannot recover Focus from a non-foreground window", async () => {
  const { runtime, tab } = createHarness({ focusedWindow: false });
  runtime.state = state(true);
  runtime.collectorState = "PAUSED";
  let acquired = false;
  runtime.acquireMessageFocus = async () => {
    acquired = true;
  };

  await runtime.handleMessage(
    { type: "workmap:domain-activity", activityAt: Date.now() },
    { tab, frameId: 0 },
  );

  assert.equal(acquired, false);
  assert.equal(runtime.state?.systemIdle, true);
  assert.equal(runtime.state?.focusedWindowId, null);
});

test("a failed foreground-window query retains a specific safe retry code", async () => {
  const { runtime, tab } = createHarness({ failWindowQuery: true });
  runtime.state = state(false);
  runtime.collectorState = "HEALTHY";
  runtime.errorCode = "NONE";
  runtime.acquireMessageFocus = async () => {
    assert.fail("Focus must not start without confirmed window ownership");
  };

  await runtime.handleMessage(
    { type: "workmap:domain-activity", activityAt: Date.now() },
    { tab, frameId: 0 },
  );

  assert.equal(runtime.collectorState, "LIMITED");
  const diagnostic = runtime.state?.diagnostics.at(-1);
  assert.equal(diagnostic?.code, "FOCUS_WINDOW_QUERY_RETRY");
  assert.equal(diagnostic?.retryable, true);
  assert.equal(diagnostic?.requestId, null);
});
