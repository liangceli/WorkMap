import assert from "node:assert/strict";
import test from "node:test";
import type { WorkMapApiTrackingV2LiveActivity } from "../lib/api/apiTypes.js";
import {
  selectTrackingV2LiveDevices,
  trackingV2ConnectionPresentation,
  trackingV2SnapshotPresentation,
} from "../components/reports/trackingV2LivePresentation.js";

test("connected Browser instances replace older interrupted cards for the same browser", () => {
  const desktop = liveDevice({
    connectionFresh: true,
    snapshotFresh: true,
    snapshotStatus: "NO_CURRENT_FOCUS",
    diagnosticCode: null,
  });
  desktop.health!.queue.deadLetter = 0;
  const staleChrome = browserDevice("chrome-old", false, "2026-07-22T23:00:00.000Z");
  staleChrome.health!.queue.deadLetter = 4;
  const currentChrome = browserDevice("chrome-current", true, "2026-07-23T00:40:00.000Z");
  currentChrome.health!.queue.deadLetter = 0;

  const selected = selectTrackingV2LiveDevices([desktop, staleChrome, currentChrome]);

  assert.deepEqual(selected.devices.map((device) => device.deviceId), ["device", "chrome-current"]);
  assert.equal(selected.hiddenInactiveBrowserCount, 1);
  assert.deepEqual(selected.coverage, {
    total: 2,
    connected: 2,
    freshSnapshots: 2,
    withSequenceGaps: 0,
    withDeadLetters: 0,
  });
});

test("latest interrupted Browser card remains visible when that browser has no connection", () => {
  const olderChrome = browserDevice("chrome-older", false, "2026-07-22T23:00:00.000Z");
  const latestChrome = browserDevice("chrome-latest", false, "2026-07-23T00:40:00.000Z");
  const currentEdge = browserDevice("edge-current", true, "2026-07-23T00:41:00.000Z");
  currentEdge.browserName = "EDGE";

  const selected = selectTrackingV2LiveDevices([olderChrome, latestChrome, currentEdge]);

  assert.deepEqual(selected.devices.map((device) => device.deviceId), ["chrome-latest", "edge-current"]);
  assert.equal(selected.coverage.connected, 1);
  assert.equal(selected.hiddenInactiveBrowserCount, 1);
});

test("snapshot policy rejection does not turn a fresh heartbeat into an unavailable Browser heartbeat", () => {
  const device = liveDevice({
    connectionFresh: true,
    snapshotFresh: false,
    snapshotStatus: "REJECTED",
    diagnosticCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  });

  const connection = trackingV2ConnectionPresentation(device);
  const snapshot = trackingV2SnapshotPresentation(device);

  assert.equal(connection.connected, true);
  assert.equal(connection.label, "Connected");
  assert.equal(snapshot.label, "Current activity not confirmed");
  assert.equal(snapshot.pill, "Outside collection window");
  assert.doesNotMatch(snapshot.detail, /signal interrupted/i);
});

test("a stale Browser connection states only the observable heartbeat fact", () => {
  const device = browserDevice(
    "chrome-stale",
    false,
    "2026-07-27T00:00:00.000Z",
  );

  const connection = trackingV2ConnectionPresentation(device);

  assert.equal(connection.label, "Browser heartbeat not received");
  assert.match(connection.detail, /cannot be distinguished/);
  assert.doesNotMatch(connection.detail, /user stopped|server unreachable/i);
});

test("a valid fresh snapshot presents the current App independently from connection health", () => {
  const device = liveDevice({
    connectionFresh: true,
    snapshotFresh: true,
    snapshotStatus: "CURRENT",
    diagnosticCode: null,
  });
  device.current = {
    state: "ACTIVE",
    subjectKey: "app:test",
    displayName: "Test App",
    browserName: null,
    sessionStartedAt: new Date().toISOString(),
    stateStartedAt: new Date().toISOString(),
    lastActivityEvidenceAt: new Date().toISOString(),
    activityEvidenceKind: "FOCUS_ACQUIRED",
    provisionalFromAt: new Date().toISOString(),
    provisionalDurationMs: 1_000,
  };

  assert.equal(trackingV2ConnectionPresentation(device).label, "Connected");
  assert.equal(trackingV2SnapshotPresentation(device).label, "Test App");
});

test("Browser connection stays confirmed while a Domain snapshot is policy rejected", () => {
  const device = liveDevice({
    connectionFresh: true,
    snapshotFresh: false,
    snapshotStatus: "REJECTED",
    diagnosticCode: "SNAPSHOT_OUTSIDE_POLICY_WINDOW",
  });
  device.clientType = "BROWSER_EXTENSION";
  device.source = "BROWSER_DOMAIN";
  device.browserName = "CHROME";
  device.hostname = null;
  device.health!.platform = "CHROME";
  device.intervalDiagnostics = {
    lastRejected: {
      code: "POLICY_REJECTED",
      requestId: "request-interval",
      rejectedAt: new Date().toISOString(),
      stream: "FOCUS",
      clockEpochId: "clock",
      sequenceNumber: 4,
    },
    rejectionCodeCounts: { POLICY_REJECTED: 1 },
    recent: [],
  };

  assert.equal(trackingV2ConnectionPresentation(device).label, "Connected");
  assert.match(trackingV2SnapshotPresentation(device).detail, /Domain snapshot/);
  assert.equal(device.intervalDiagnostics.lastRejected?.requestId, "request-interval");
});

function liveDevice(input: {
  connectionFresh: boolean;
  snapshotFresh: boolean;
  snapshotStatus: WorkMapApiTrackingV2LiveActivity["devices"][number]["snapshotStatus"];
  diagnosticCode:
    | "SNAPSHOT_OUTSIDE_POLICY_WINDOW"
    | null;
}): WorkMapApiTrackingV2LiveActivity["devices"][number] {
  const now = new Date().toISOString();
  return {
    deviceId: "device",
    userId: "user",
    displayName: "Employee",
    clientType: "DESKTOP_AGENT",
    source: "DESKTOP_APP",
    browserName: null,
    workstationId: "workstation",
    workstationName: "Workstation",
    hostname: "WM-TEST",
    clientVersion: "desktop-agent-windows/0.6.4",
    protocolActivatedAt: now,
    fresh: input.connectionFresh,
    freshnessAgeMs: input.connectionFresh ? 1_000 : 60_000,
    freshnessLimitMs: 30_000,
    connectionFresh: input.connectionFresh,
    connectionFreshnessAgeMs: input.connectionFresh ? 1_000 : 60_000,
    connectionFreshnessLimitMs: 30_000,
    connectionConfirmedAt: now,
    snapshotFresh: input.snapshotFresh,
    snapshotFreshnessAgeMs: input.snapshotFresh ? 1_000 : 60_000,
    snapshotFreshnessLimitMs: 30_000,
    snapshotStatus: input.snapshotStatus,
    current: null,
    snapshot: null,
    health: {
      connectionState: "ONLINE",
      collectorState: "HEALTHY",
      policyState: "ACTIVE",
      migrationState: "V2",
      platform: "WINDOWS",
      queue: {
        pending: 0,
        ready: 0,
        deadLetter: 3,
        oldestQueuedAt: null,
        nextRetryAt: null,
      },
      lastSuccessfulHeartbeatAt: now,
      lastSuccessfulSyncAt: now,
      errorCode: "NONE",
      serverDiagnosticCode: input.diagnosticCode,
      serverDiagnosticRequestId: input.diagnosticCode ? "request" : null,
      serverDiagnosticAt: input.diagnosticCode ? now : null,
      receivedAt: now,
    },
    cursor: null,
    correlation: null,
  };
}

function browserDevice(
  deviceId: string,
  connectionFresh: boolean,
  connectionConfirmedAt: string,
) {
  const device = liveDevice({
    connectionFresh,
    snapshotFresh: connectionFresh,
    snapshotStatus: connectionFresh ? "NO_CURRENT_FOCUS" : "STALE",
    diagnosticCode: null,
  });
  device.deviceId = deviceId;
  device.clientType = "BROWSER_EXTENSION";
  device.source = "BROWSER_DOMAIN";
  device.browserName = "CHROME";
  device.connectionConfirmedAt = connectionConfirmedAt;
  device.health!.platform = "CHROME";
  device.health!.receivedAt = connectionConfirmedAt;
  return device;
}
