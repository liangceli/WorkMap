import assert from "node:assert/strict";
import test from "node:test";
import { hasWarmAppShellCache } from "../components/layout/appShellCache.js";

test("app shell keeps the loader for a first visit without a cached summary", () => {
  assert.equal(hasWarmAppShellCache(null), false);
  assert.equal(hasWarmAppShellCache({}), false);
});

test("app shell can render immediately when the current user has a cached summary", () => {
  assert.equal(hasWarmAppShellCache({ apiSummary: { role: "OWNER" } }), true);
  assert.equal(hasWarmAppShellCache({ platformSummary: { platformRole: "PLATFORM_ADMIN" } }), true);
});
