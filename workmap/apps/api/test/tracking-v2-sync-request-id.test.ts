import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrackingSyncRequestId } from "../src/modules/devices/device-client.controller.js";

test("v2 sync preserves a valid client correlation id", () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  assert.equal(normalizeTrackingSyncRequestId(requestId), requestId);
});

test("v2 sync replaces malformed correlation ids without reflecting them", () => {
  const requestId = normalizeTrackingSyncRequestId("unsafe value with spaces");
  assert.match(
    requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
