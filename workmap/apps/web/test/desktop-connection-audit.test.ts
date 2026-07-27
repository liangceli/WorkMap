import assert from "node:assert/strict";
import test from "node:test";
import { buildDesktopAuditEntries } from "../components/reports/ReportSummaryPanel.js";

test("Desktop Connection Audit renders every stored Tracking v2 lifecycle status with Desktop wording", () => {
  const statuses = [
    ["RUNNING", "AGENT_STARTED", "Agent started", "positive"],
    ["STOPPED_BY_USER", "USER_STOP", "Stopped by user", "neutral"],
    ["NETWORK_OFFLINE", "NETWORK_UNAVAILABLE", "Network offline", "attention"],
    ["DEVICE_SHUTDOWN", "SYSTEM_SHUTDOWN", "Device shut down", "neutral"],
    ["SLEEPING", "SYSTEM_SUSPEND", "Sleeping", "neutral"],
    ["LOCKED", "SYSTEM_LOCK", "Locked", "neutral"],
    ["AGENT_CRASHED", "PROCESS_CRASH", "Agent crashed", "attention"],
    ["AGENT_TERMINATED", "PROCESS_TERMINATED", "Agent terminated", "attention"],
    ["SERVER_UNREACHABLE", "SERVER_REQUEST_FAILED", "WorkMap service unreachable", "attention"],
    ["UNKNOWN_INTERRUPTED", "UNKNOWN", "Interrupted", "attention"],
    ["RECONNECTED", "SYSTEM_UNLOCK", "Reconnected", "positive"],
    ["RESTARTED", "AGENT_RESTART", "Agent restarted", "positive"],
  ] as const;

  const entries = buildDesktopAuditEntries({
    agentSessions: [],
    deviceStatusHistory: statuses.map(([status, reason], index) => desktopStatus(String(index), status, reason)),
  });

  for (const [status, reason, title, tone] of statuses) {
    const entry = entries.find((candidate) => candidate.id.endsWith(`status-${status}`));
    assert.equal(entry?.title, title);
    assert.equal(entry?.tone, tone);
    assert.match(entry?.detail ?? "", new RegExp(titleCase(reason)));
  }
  assert.equal(entries.length, statuses.length);
  assert.doesNotMatch(entries.map((entry) => entry.title).join("\n"), /Browser profile started/);
});

test("Desktop Connection Audit prefers linked v2 status events over duplicate legacy session rows", () => {
  const sessionId = "33333333-3333-4333-8333-333333333333";
  const entries = buildDesktopAuditEntries({
    agentSessions: [{
      id: sessionId,
      startedAt: "2026-07-27T01:00:00.000Z",
      lastHeartbeatAt: "2026-07-27T02:00:00.000Z",
      endedAt: "2026-07-27T02:00:00.000Z",
      endReason: "USER_STOP",
    }],
    deviceStatusHistory: [
      desktopStatus("start", "RUNNING", "AGENT_STARTED", sessionId),
      desktopStatus("stop", "STOPPED_BY_USER", "USER_STOP", sessionId),
    ],
  });

  assert.deepEqual(entries.map((entry) => entry.title), ["Stopped by user", "Agent started"]);
  assert.equal(entries.filter((entry) => entry.title === "Agent started").length, 1);
  assert.equal(entries.filter((entry) => entry.title === "Stopped by user").length, 1);
});

test("Desktop Connection Audit keeps legacy session fallback when no linked v2 statuses exist", () => {
  const entries = buildDesktopAuditEntries({
    agentSessions: [{
      id: "33333333-3333-4333-8333-333333333333",
      startedAt: "2026-07-27T01:00:00.000Z",
      lastHeartbeatAt: "2026-07-27T02:00:00.000Z",
      endedAt: "2026-07-27T02:00:00.000Z",
      endReason: "UNKNOWN_INTERRUPTED",
    }],
    deviceStatusHistory: [],
  });

  assert.deepEqual(entries.map((entry) => entry.title), ["Interrupted", "Agent started"]);
  assert.equal(entries[0]?.tone, "attention");
});

test("Desktop Connection Audit has no rows only when no stored or legacy transitions exist", () => {
  assert.deepEqual(buildDesktopAuditEntries({ agentSessions: [], deviceStatusHistory: [] }), []);
});

function desktopStatus(
  id: string,
  status: "RUNNING" | "STOPPED_BY_USER" | "NETWORK_OFFLINE" | "DEVICE_SHUTDOWN" | "SLEEPING" | "LOCKED" | "AGENT_CRASHED" | "AGENT_TERMINATED" | "SERVER_UNREACHABLE" | "UNKNOWN_INTERRUPTED" | "RECONNECTED" | "RESTARTED",
  reason: "AGENT_STARTED" | "USER_STOP" | "SYSTEM_SHUTDOWN" | "SYSTEM_SUSPEND" | "SYSTEM_RESUME" | "SYSTEM_LOCK" | "SYSTEM_UNLOCK" | "NETWORK_UNAVAILABLE" | "SERVER_REQUEST_FAILED" | "PROCESS_CRASH" | "PROCESS_TERMINATED" | "HEARTBEAT_TIMEOUT" | "AGENT_RESTART" | "UNKNOWN",
  agentSessionId: string | null = null,
) {
  const index = Number.isFinite(Number(id)) ? Number(id) : id === "start" ? 0 : 1;
  const timestamp = new Date(Date.UTC(2026, 6, 27, 1, index)).toISOString();
  return {
    id: `status-${status}`,
    clientEventId: `event-${id}`,
    deviceId: "22222222-2222-4222-8222-222222222222",
    agentSessionId,
    status,
    reason,
    startedAt: timestamp,
    endedAt: null,
    lastHeartbeatAt: null,
    recordedAt: timestamp,
    receivedAt: timestamp,
    source: "DESKTOP_AGENT" as const,
    browserName: null,
    clientVersion: "desktop-agent-windows/0.6.8",
    timeZone: "Australia/Adelaide",
    confidence: "CONFIRMED" as const,
  };
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
