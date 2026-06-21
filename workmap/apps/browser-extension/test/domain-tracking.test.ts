import assert from "node:assert/strict";
import test from "node:test";
import { createDomainUsageEvent, readDomainFromUrl } from "../src/domainTracking";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

test("extracts hostname only and ignores non-web schemes", () => {
  assert.equal(readDomainFromUrl("https://Example.COM/path/to/page?token=private#fragment"), "example.com");
  assert.equal(readDomainFromUrl("http://docs.workmap.test/alpha?form=value"), "docs.workmap.test");
  assert.equal(readDomainFromUrl("chrome://extensions"), null);
  assert.equal(readDomainFromUrl("edge://settings"), null);
  assert.equal(readDomainFromUrl("file:///Users/example/report.html"), null);
  assert.equal(readDomainFromUrl(undefined), null);
});

test("creates minimized stable event and filters short slices", () => {
  const event = createDomainUsageEvent(
    {
      domain: "github.com",
      isIdle: true,
      startedAt: Date.parse("2026-06-17T09:00:00.000Z"),
      lastObservedAt: Date.parse("2026-06-17T09:05:00.000Z"),
      clientEventId: "00000000-0000-4000-8000-000000000001",
    },
    Date.parse("2026-06-17T09:05:00.000Z"),
    DEVICE_ID,
    "CHROME",
  );
  assert.deepEqual(event, {
    clientEventId: "00000000-0000-4000-8000-000000000001",
    deviceId: DEVICE_ID,
    domain: "github.com",
    browserName: "CHROME",
    startedAt: "2026-06-17T09:00:00.000Z",
    endedAt: "2026-06-17T09:05:00.000Z",
    durationSeconds: 300,
    isIdle: true,
  });
  const serialized = JSON.stringify(event);
  for (const forbidden of ["url", "title", "content", "query", "fragment"]) assert(!serialized.toLowerCase().includes(`"${forbidden}`));
  assert.equal(createDomainUsageEvent({ domain: "github.com", isIdle: false, startedAt: 0 }, 3_000, DEVICE_ID, "CHROME"), null);
});
