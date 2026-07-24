import assert from "node:assert/strict";
import test from "node:test";
import { buildBrowserAuditEntries, buildBrowserAuditGroups } from "../components/reports/ReportSummaryPanel.js";

test("Browser Connection Audit separates confirmed transitions from inferred heartbeat loss", () => {
  const base = "2026-07-23T01:00:00.000Z";
  const entries = buildBrowserAuditEntries(
    {
      browserExtensionCoverage: [],
      deviceStatusHistory: [
        status("1", "RESTARTED", "AGENT_RESTART", base),
        status("2", "LOCKED", "SYSTEM_LOCK", "2026-07-23T01:01:00.000Z"),
        status(
          "3",
          "UNKNOWN_INTERRUPTED",
          "HEARTBEAT_TIMEOUT",
          "2026-07-23T01:02:30.000Z",
          "INFERRED",
        ),
        status("4", "RECONNECTED", "SYSTEM_UNLOCK", "2026-07-23T01:03:00.000Z"),
      ],
    } as never,
    [],
  );

  assert.deepEqual(
    entries.map((entry) => entry.title),
    [
      "Reconnected",
      "Signal interrupted",
      "Locked",
      "Browser profile started",
    ],
  );
  assert.match(entries[1]!.detail, /inferred/);
  assert.match(entries[2]!.detail, /System Lock/);
});

test("a stale confirmed Browser heartbeat becomes an honest current interruption", () => {
  const entries = buildBrowserAuditEntries(
    {
      browserExtensionCoverage: [],
      deviceStatusHistory: [],
    },
    [
      {
        deviceId: "device-id",
        clientType: "BROWSER_EXTENSION",
        browserName: "CHROME",
        connectionFresh: false,
        connectionConfirmedAt: "2026-07-23T01:00:00.000Z",
        connectionFreshnessLimitMs: 90_000,
      },
    ] as never,
  );

  assert.equal(entries[0]?.title, "Signal interrupted");
  assert.equal(entries[0]?.timestamp, "2026-07-23T01:01:30.000Z");
  assert.match(entries[0]?.detail ?? "", /cause is not confirmed/);
});

test("coverage and live-heartbeat views do not duplicate the same inferred interruption", () => {
  const entries = buildBrowserAuditEntries(
    {
      browserExtensionCoverage: [
        {
          deviceId: "device-id",
          browserName: "CHROME",
          state: "signal_lost",
          coverageLostDetectedAt: "2026-07-23T01:01:30.000Z",
        },
      ],
      deviceStatusHistory: [],
    } as never,
    [
      {
        deviceId: "device-id",
        clientType: "BROWSER_EXTENSION",
        browserName: "CHROME",
        connectionFresh: false,
        connectionConfirmedAt: "2026-07-23T01:00:00.000Z",
        connectionFreshnessLimitMs: 90_000,
      },
    ] as never,
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.title, "Signal interrupted");
});

test("Browser Connection Audit keeps Chrome, Edge and same-browser profiles strictly separate", () => {
  const chrome = status("chrome-event", "LOCKED", "SYSTEM_LOCK", "2026-07-23T01:00:00.000Z");
  const chromeProfile = {
    ...status("chrome-profile-event", "RECONNECTED", "SYSTEM_UNLOCK", "2026-07-23T01:00:30.000Z"),
    deviceId: "chrome-profile-device",
  };
  const edge = {
    ...status("edge-event", "RESTARTED", "AGENT_RESTART", "2026-07-23T01:01:00.000Z"),
    deviceId: "edge-device",
    browserName: "EDGE",
  };
  const groups = buildBrowserAuditGroups(
    {
      browserExtensionCoverage: [],
      deviceStatusHistory: [chrome, chromeProfile, edge],
    } as never,
    [],
  );

  assert.equal(groups.length, 3);
  const chromeGroup = groups.find((group) => group.deviceId === "device-id");
  const chromeProfileGroup = groups.find((group) => group.deviceId === "chrome-profile-device");
  const edgeGroup = groups.find((group) => group.deviceId === "edge-device");
  assert.equal(chromeGroup?.title, "Google Chrome Extension");
  assert.deepEqual(chromeGroup?.entries.map((entry) => entry.id), ["device-id:status:chrome-event"]);
  assert.equal(chromeProfileGroup?.title, "Google Chrome Extension");
  assert.deepEqual(chromeProfileGroup?.entries.map((entry) => entry.id), ["chrome-profile-device:status:chrome-profile-event"]);
  assert.equal(edgeGroup?.title, "Microsoft Edge Extension");
  assert.deepEqual(edgeGroup?.entries.map((entry) => entry.id), ["edge-device:status:edge-event"]);
});

function status(
  id: string,
  state: string,
  reason: string,
  startedAt: string,
  confidence = "CONFIRMED",
) {
  return {
    id,
    deviceId: "device-id",
    agentSessionId: null,
    status: state,
    reason,
    startedAt,
    endedAt: null,
    lastHeartbeatAt: null,
    recordedAt: startedAt,
    receivedAt: startedAt,
    source: "BROWSER_EXTENSION",
    timeZone: "Australia/Adelaide",
    confidence,
    browserName: "CHROME",
    clientVersion: "browser-extension-mv3/0.5.8",
  };
}
