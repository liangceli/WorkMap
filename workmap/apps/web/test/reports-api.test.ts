import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAgentLiveStatus, getUsageSummary } from "../lib/api/reportsApi.js";
import { getWorkspaceNavigationItemsForRole } from "../lib/navigation/workspaceNavigation.js";

test("reports API sends date, department and scope filters", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ scope: "company", userId: null, departmentId: null, range: { from: "2026-06-01", to: "2026-06-21", timeZone: "UTC" }, apps: [], websites: [], daily: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await getUsageSummary({
      baseUrl: "https://api.workmap.test",
      token: "test-token",
      scope: "company",
      departmentId: "66666666-6666-4666-8666-666666666666",
      from: "2026-06-01",
      to: "2026-06-21",
    });
    assert.equal(result.ok, true);
    assert.match(requestedUrl, /scope=company/);
    assert.match(requestedUrl, /departmentId=66666666/);
    assert.match(requestedUrl, /from=2026-06-01/);
    assert.match(requestedUrl, /to=2026-06-21/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live Agent polling sends selected employee and report range", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ userId: "11111111-1111-4111-8111-111111111111", agentStatus: { state: "online" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await getAgentLiveStatus({
      baseUrl: "https://api.workmap.test",
      token: "test-token",
      userId: "11111111-1111-4111-8111-111111111111",
      scope: "user",
      from: "2026-06-01",
      to: "2026-06-21",
    });
    assert.equal(result.ok, true);
    assert.match(requestedUrl, /\/reports\/agent-status/);
    assert.match(requestedUrl, /userId=11111111/);
    assert.match(requestedUrl, /scope=user/);
    assert.match(requestedUrl, /from=2026-06-01/);
    assert.match(requestedUrl, /to=2026-06-21/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("company live Agent polling keeps department scope", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ scope: "company", apps: [], employeeUsage: [], activityRevision: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await getAgentLiveStatus({
      baseUrl: "https://api.workmap.test",
      token: "test-token",
      scope: "company",
      departmentId: "66666666-6666-4666-8666-666666666666",
    });
    assert.equal(result.ok, true);
    assert.match(requestedUrl, /scope=company/);
    assert.match(requestedUrl, /departmentId=66666666/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports API keeps a safe backend validation detail for actionable failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Report to date cannot be in the future." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const result = await getUsageSummary({
      baseUrl: "https://api.workmap.test",
      token: "test-token",
      scope: "company",
      from: "2026-07-14",
      to: "2026-07-14",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /Report to date cannot be in the future/);
      assert(!result.error.includes("test-token"));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Reports navigation and page are hidden from employees", async () => {
  const gateSource = await readFile(new URL("../components/reports/ReportsAccessGate.tsx", import.meta.url), "utf8");
  assert.equal(getWorkspaceNavigationItemsForRole("EMPLOYEE").some((item) => item.href === "/reports"), false);
  assert.equal(getWorkspaceNavigationItemsForRole("MANAGER").some((item) => item.href === "/reports"), true);
  assert.equal(getWorkspaceNavigationItemsForRole("OWNER").some((item) => item.href === "/reports"), true);
  assert.equal(getWorkspaceNavigationItemsForRole("IT_ADMIN").some((item) => item.href === "/reports"), true);
  assert.match(gateSource, /auth\.role === "EMPLOYEE"/);
  assert.match(gateSource, /router\.replace\("\/virtual-office"\)/);
});
