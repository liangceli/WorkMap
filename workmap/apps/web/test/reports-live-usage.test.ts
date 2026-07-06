import assert from "node:assert/strict";
import test from "node:test";
import type { WorkMapApiReportLiveStatus, WorkMapApiUsageSummary } from "../lib/api/apiTypes.js";
import { mergeLiveUsage } from "../components/reports/liveUsage.js";

const today = new Date().toISOString().slice(0, 10);

test("company report includes an employee's still-open foreground Microsoft Store segment", () => {
  const summary = baseSummary("company");
  const live: WorkMapApiReportLiveStatus = {
    scope: "company",
    userId: null,
    departmentId: null,
    apps: [{ appName: "Microsoft Store", activeSeconds: 125, focusedIdleSeconds: 0 }],
    employeeUsage: [{ userId: "employee-1", displayName: "Employee", activeSeconds: 125, idleSeconds: 0 }],
    browserExtensionCoverage: [],
    activityRevision: null,
  };

  const merged = mergeLiveUsage(summary, live)!;
  assert.deepEqual(merged.apps.map((row) => [row.appName, row.activeSeconds]), [
    ["Microsoft Store", 125],
    ["Visual Studio Code", 60],
  ]);
  assert.equal(merged.employeeUsage[0]?.activeSeconds, 185);
  assert.equal(merged.daily[0]?.appActiveSeconds, 185);
  assert.equal(summary.apps.length, 1, "base persisted summary must remain unchanged between live polls");
});

test("user report merges current focused idle without adding focus active time", () => {
  const summary = baseSummary("user");
  const live: WorkMapApiReportLiveStatus = {
    scope: "user",
    userId: "employee-1",
    departmentId: null,
    agentStatus: {
      state: "online",
      currentAppName: "Visual Studio Code",
      currentAppActiveSeconds: 0,
      currentAppFocusedIdleSeconds: 45,
      todayActiveSeconds: 60,
    },
    browserExtensionCoverage: [],
    activityRevision: null,
  };

  const merged = mergeLiveUsage(summary, live)!;
  assert.equal(merged.apps[0]?.activeSeconds, 60);
  assert.equal(merged.apps[0]?.idleSeconds, 45);
  assert.equal(merged.apps[0]?.focusedIdleSeconds, 45);
});

test("user report excludes idle, minimized or background state from active totals", () => {
  const summary = baseSummary("user");
  const live: WorkMapApiReportLiveStatus = {
    scope: "user",
    userId: "employee-1",
    departmentId: null,
    agentStatus: {
      state: "online",
      currentAppName: null,
      currentAppActiveSeconds: 0,
      todayActiveSeconds: 60,
    },
    browserExtensionCoverage: [],
    activityRevision: null,
  };

  const merged = mergeLiveUsage(summary, live)!;
  assert.deepEqual(merged.apps, summary.apps);
  assert.deepEqual(merged.daily, summary.daily);
});

function baseSummary(scope: "user" | "company"): WorkMapApiUsageSummary {
  return {
    scope,
    userId: scope === "user" ? "employee-1" : null,
    departmentId: null,
    range: { from: today, to: today, timeZone: "UTC" },
    apps: [{ appName: "Visual Studio Code", category: null, productivityLabel: null, activeSeconds: 60, idleSeconds: 0, focusActiveSeconds: 60, focusedIdleSeconds: 0, openRuntimeSeconds: 60 }],
    websites: [],
    daily: [{ date: today, appActiveSeconds: 60, appIdleSeconds: 0, domainActiveSeconds: 0, domainIdleSeconds: 0 }],
    deviceCoverage: { registeredDevices: 1, activeDevices24h: 1, usersWithActivity: 1 },
    browserExtensionCoverage: [],
    agentStatus: null,
    agentSessions: [],
    appTimeline: [],
    employeeUsage: scope === "company"
      ? [{ userId: "employee-1", displayName: "Employee", activeSeconds: 60, idleSeconds: 0 }]
      : [],
    activityRevision: null,
  };
}
