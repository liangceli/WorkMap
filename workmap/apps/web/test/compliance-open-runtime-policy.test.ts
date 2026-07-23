import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  enableComplianceDomainOpenRuntime,
  enableComplianceOpenRuntime,
} from "../lib/api/complianceApi.js";

test("open/runtime enablement creates a new policy version through the compliance API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      id: "policy-v2",
      name: "WorkMap visibility",
      collectAppUsage: true,
      collectOpenRuntime: true,
      collectDomainOpenRuntime: false,
      collectWebsiteDomain: true,
      collectFullUrl: false,
      collectScreenshots: false,
      collectKeystrokes: false,
      workHoursOnly: true,
      workdayStart: "09:00",
      workdayEnd: "23:00",
      scheduleTimeZone: "Australia/Adelaide",
      retentionDays: 90,
      employeeCanViewOwnData: true,
      policyVersion: "v2",
      activeFrom: "2026-07-21T03:00:00.000Z",
      acknowledgementRequired: true,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await enableComplianceOpenRuntime("policy-v1", {
      baseUrl: "https://api.workmap.test",
      token: "test-token",
    });
    assert.equal(result.ok, true);
    assert.match(requestedUrl, /\/compliance\/policy\/policy-v1\/open-runtime-version$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Browser Domain runtime uses its separate compliance policy route", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      id: "policy-v3",
      collectOpenRuntime: false,
      collectDomainOpenRuntime: true,
      acknowledgementRequired: true,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await enableComplianceDomainOpenRuntime("policy-v2", {
      baseUrl: "https://api.workmap.test",
      token: "test-token",
    });
    assert.equal(result.ok, true);
    assert.match(
      requestedUrl,
      /\/compliance\/policy\/policy-v2\/domain-open-runtime-version$/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the new policy acknowledgement explicitly discloses open/runtime semantics", async () => {
  const source = await readFile(
    new URL("../components/compliance/PolicyAcknowledgementModal.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /App open\/runtime for user-visible Windows windows/);
  assert.match(source, /separate from Focus active time/);
  assert.match(source, /collectOpenRuntime/);
  assert.match(source, /Browser Domain open\/runtime/);
  assert.match(source, /collectDomainOpenRuntime/);
});
