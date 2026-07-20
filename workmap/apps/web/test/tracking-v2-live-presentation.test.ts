import assert from "node:assert/strict";
import test from "node:test";
import type { WorkMapApiTrackingV2LiveActivity } from "../lib/api/apiTypes.js";
import {
  trackingV2ConnectionPresentation,
  trackingV2SnapshotPresentation,
} from "../components/reports/trackingV2LivePresentation.js";

test("snapshot policy rejection does not turn a fresh heartbeat into Signal interrupted", () => {
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
