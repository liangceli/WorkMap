import assert from "node:assert/strict";
import { createDomainUsageEvent, readDomainFromUrl } from "../src/domainTracking";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

assert.equal(readDomainFromUrl("https://Example.COM/path/to/page?token=private#fragment"), "example.com");
assert.equal(readDomainFromUrl("http://docs.workmap.test/alpha?form=value"), "docs.workmap.test");
assert.equal(readDomainFromUrl("chrome://extensions"), null);
assert.equal(readDomainFromUrl("file:///Users/example/report.html"), null);
assert.equal(readDomainFromUrl(undefined), null);

const event = createDomainUsageEvent(
  {
    domain: "github.com",
    startedAt: Date.parse("2026-06-17T09:00:00.000Z"),
  },
  Date.parse("2026-06-17T09:05:00.000Z"),
  DEVICE_ID,
  "CHROME",
);

assert.deepEqual(event, {
  deviceId: DEVICE_ID,
  domain: "github.com",
  browserName: "CHROME",
  startedAt: "2026-06-17T09:00:00.000Z",
  endedAt: "2026-06-17T09:05:00.000Z",
  isIdle: false,
});
assert.equal(
  createDomainUsageEvent(
    {
      domain: "github.com",
      startedAt: Date.parse("2026-06-17T09:00:00.000Z"),
    },
    Date.parse("2026-06-17T09:00:03.000Z"),
    DEVICE_ID,
    "CHROME",
  ),
  null,
);

console.info("browser-extension domain tracking test passed");
