import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AuditTimeline, mergeAuditState } from "../components/reports/ReportSummaryPanel.js";

test("Connection Audit never replaces its list with a periodic loading message", () => {
  const html = renderToStaticMarkup(createElement(AuditTimeline, {
    title: "Desktop Agent",
    icon: null,
    entries: [{
      id: "event-1",
      title: "Locked",
      detail: "Desktop Agent - System Lock",
      timestamp: "2026-07-24T00:00:00.000Z",
      tone: "neutral" as const,
    }],
  }));

  assert.match(html, /Locked/);
  assert.doesNotMatch(html, /Loading connection history/);
});

test("silent audit refresh preserves identical state and adds only new transitions", () => {
  const firstAudit = audit([status("event-1", "LOCKED")]);
  const initial = { audit: firstAudit };
  const unchanged = mergeAuditState(initial, audit([status("event-1", "LOCKED")]));
  assert.equal(unchanged, initial);

  const refreshed = mergeAuditState(unchanged, audit([
    status("event-2", "RECONNECTED"),
    status("event-1", "LOCKED"),
  ]));
  assert.notEqual(refreshed, unchanged);
  assert.deepEqual(refreshed.audit?.deviceStatusHistory.map((event) => event.id), ["event-2", "event-1"]);
});

function audit(deviceStatusHistory: ReturnType<typeof status>[]) {
  return {
    scope: "user" as const,
    userId: "11111111-1111-4111-8111-111111111111",
    agentSessions: [],
    deviceStatusHistory,
    appTimeline: [],
  };
}

function status(id: string, state: "LOCKED" | "RECONNECTED") {
  return {
    id,
    clientEventId: id,
    deviceId: "22222222-2222-4222-8222-222222222222",
    agentSessionId: null,
    status: state,
    reason: state === "LOCKED" ? "SYSTEM_LOCK" as const : "SYSTEM_UNLOCK" as const,
    startedAt: "2026-07-24T00:00:00.000Z",
    endedAt: null,
    lastHeartbeatAt: null,
    recordedAt: "2026-07-24T00:00:00.000Z",
    receivedAt: "2026-07-24T00:00:00.000Z",
    source: "DESKTOP_AGENT" as const,
    browserName: null,
    clientVersion: "desktop-agent-windows/0.6.8",
    timeZone: "Australia/Adelaide",
    confidence: "CONFIRMED" as const,
  };
}
