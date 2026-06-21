import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getUsageSummary } from "../lib/api/reportsApi.js";

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

test("Reports navigation and page are hidden from employees", async () => {
  const source = await readFile(new URL("../components/layout/AppShell.tsx", import.meta.url), "utf8");
  const reportsItem = source.split("\n").find((line) => line.includes('label: "Reports"')) ?? "";
  const gateSource = await readFile(new URL("../components/reports/ReportsAccessGate.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(reportsItem, /EMPLOYEE/);
  assert.match(reportsItem, /IT_ADMIN/);
  assert.match(reportsItem, /OWNER/);
  assert.match(gateSource, /auth\.role === "EMPLOYEE"/);
  assert.match(gateSource, /router\.replace\("\/virtual-office"\)/);
});
