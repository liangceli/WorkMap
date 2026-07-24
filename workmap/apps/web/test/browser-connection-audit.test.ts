import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BrowserAuditTimeline,
  buildBrowserAuditEntries,
  buildBrowserAuditGroups,
  type BrowserAuditGroup,
} from "../components/reports/ReportSummaryPanel.js";

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

test("Browser Connection Audit renders many device histories without shrinking them into blank bars", () => {
  const groups: BrowserAuditGroup[] = Array.from({ length: 16 }, (_, index) => ({
    deviceId: `device-${index}`,
    browserName: index % 2 === 0 ? "CHROME" : "EDGE",
    title: index % 2 === 0 ? `Google Chrome Extension ${index}` : `Microsoft Edge Extension ${index}`,
    detail: `Device ${index} · browser-extension-mv3/0.5.9`,
    entries: [{
      id: `event-${index}`,
      title: index % 2 === 0 ? "Browser profile started" : "Reconnected",
      detail: index % 2 === 0 ? "Google Chrome Extension - Agent Restart" : "Microsoft Edge Extension - System Unlock",
      timestamp: `2026-07-24T01:${String(index).padStart(2, "0")}:00.000Z`,
      tone: "positive",
    }],
  }));

  const html = renderToStaticMarkup(createElement(BrowserAuditTimeline, { groups }));

  assert.match(html, /16 events/);
  assert.match(html, /Google Chrome Extension 0/);
  assert.match(html, /Microsoft Edge Extension 15/);
  assert.match(html, /Google Chrome Extension - Agent Restart/);
  assert.match(html, /Microsoft Edge Extension - System Unlock/);
  assert.match(html, /display:flex;flex-direction:column/);
  assert.equal((html.match(/flex:0 0 auto/g) ?? []).length, 16);
  assert.doesNotMatch(html, /Loading connection history/);
});

test("Browser Connection Audit omits paired devices that have no historical transition", () => {
  const groups = buildBrowserAuditGroups(
    {
      browserExtensionCoverage: [{
        deviceId: "fresh-device-without-history",
        browserName: "CHROME",
        version: "browser-extension-mv3/0.5.9",
        state: "connected",
      }],
      deviceStatusHistory: [],
    } as never,
    [],
  );

  assert.deepEqual(groups, []);
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
