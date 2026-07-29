import assert from "node:assert/strict";
import test from "node:test";
import {
  isConnectionAuditTimestampInRange,
  resolveConnectionAuditRange,
} from "../components/reports/connectionAuditRange.js";
import { buildBrowserAuditGroups } from "../components/reports/ReportSummaryPanel.js";

test("Connection Audit resolves the Australian morning to the current local calendar day", () => {
  const resolved = resolveConnectionAuditRange(
    { from: "2026-07-28", to: "2026-07-28" },
    new Date("2026-07-28T23:45:00.000Z"),
    "Australia/Adelaide",
  );

  assert.deepEqual(resolved.calendar, {
    from: "2026-07-29",
    to: "2026-07-29",
  });
  assert.deepEqual(resolved.request, {
    from: "2026-07-28",
    to: "2026-07-28",
  });
});

test("Connection Audit resolves a western time zone behind UTC without losing its local day", () => {
  const resolved = resolveConnectionAuditRange(
    { from: "2026-07-29", to: "2026-07-29" },
    new Date("2026-07-29T02:00:00.000Z"),
    "America/Los_Angeles",
  );

  assert.deepEqual(resolved.calendar, {
    from: "2026-07-28",
    to: "2026-07-28",
  });
  assert.deepEqual(resolved.request, {
    from: "2026-07-27",
    to: "2026-07-29",
  });
});

test("historical Connection Audit ranges retain the selected dates and query adjacent UTC days", () => {
  const resolved = resolveConnectionAuditRange(
    { from: "2026-07-23", to: "2026-07-24" },
    new Date("2026-07-29T02:00:00.000Z"),
    "Australia/Adelaide",
  );

  assert.deepEqual(resolved.calendar, {
    from: "2026-07-23",
    to: "2026-07-24",
  });
  assert.deepEqual(resolved.request, {
    from: "2026-07-22",
    to: "2026-07-25",
  });
});

test("Connection Audit includes only timestamps inside the displayed local calendar day", () => {
  const range = { from: "2026-07-29", to: "2026-07-29" };

  assert.equal(
    isConnectionAuditTimestampInRange(
      "2026-07-28T14:29:59.999Z",
      range,
      "Australia/Adelaide",
    ),
    false,
  );
  assert.equal(
    isConnectionAuditTimestampInRange(
      "2026-07-28T14:30:00.000Z",
      range,
      "Australia/Adelaide",
    ),
    true,
  );
  assert.equal(
    isConnectionAuditTimestampInRange(
      "2026-07-29T14:29:59.999Z",
      range,
      "Australia/Adelaide",
    ),
    true,
  );
  assert.equal(
    isConnectionAuditTimestampInRange(
      "2026-07-29T14:30:00.000Z",
      range,
      "Australia/Adelaide",
    ),
    false,
  );
});

test("Browser audit hides an older live-heartbeat inference while retaining today's confirmed start", () => {
  const range = { from: "2026-07-29", to: "2026-07-29" };
  const includesTimestamp = (timestamp: string) =>
    isConnectionAuditTimestampInRange(
      timestamp,
      range,
      "Australia/Adelaide",
    );
  const groups = buildBrowserAuditGroups(
    {
      browserExtensionCoverage: [],
      deviceStatusHistory: [{
        id: "today-start",
        clientEventId: "today-start",
        deviceId: "edge-device",
        agentSessionId: null,
        status: "RUNNING",
        reason: "AGENT_STARTED",
        startedAt: "2026-07-28T14:31:00.000Z",
        endedAt: null,
        lastHeartbeatAt: "2026-07-28T14:31:00.000Z",
        recordedAt: "2026-07-28T14:31:00.000Z",
        receivedAt: "2026-07-28T14:31:01.000Z",
        source: "BROWSER_EXTENSION",
        browserName: "EDGE",
        clientVersion: "browser-extension-mv3/0.5.14",
        timeZone: "Australia/Adelaide",
        confidence: "CONFIRMED",
      }],
    },
    [{
      deviceId: "edge-device",
      clientType: "BROWSER_EXTENSION",
      browserName: "EDGE",
      clientVersion: "browser-extension-mv3/0.5.14",
      connectionFresh: false,
      connectionConfirmedAt: "2026-07-28T07:35:00.000Z",
      connectionFreshnessLimitMs: 90_000,
    }] as never,
    includesTimestamp,
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.entries.map((entry) => entry.title), [
    "Extension started",
  ]);
});
