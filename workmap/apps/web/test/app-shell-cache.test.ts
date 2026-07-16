import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFreshAppShellCache,
  hasFreshPlatformAppShellCache,
  hasFreshWorkspaceAppShellCache,
  hasWarmAppShellCache,
} from "../components/layout/appShellCache.js";

test("app shell keeps the loader for a first visit without a cached summary", () => {
  assert.equal(hasWarmAppShellCache(null), false);
  assert.equal(hasWarmAppShellCache({}), false);
});

test("app shell can render immediately when the current user has a cached summary", () => {
  assert.equal(hasWarmAppShellCache({ apiSummary: { role: "OWNER" } }), true);
  assert.equal(hasWarmAppShellCache({ platformSummary: { platformRole: "PLATFORM_ADMIN" } }), true);
});

test("app shell only reuses an identity summary within its short freshness window", () => {
  const now = 1_000_000;
  assert.equal(hasFreshAppShellCache({ apiSummary: { role: "OWNER" }, updatedAt: now - 299_999 }, now), true);
  assert.equal(hasFreshAppShellCache({ apiSummary: { role: "OWNER" }, updatedAt: now - 300_000 }, now), false);
  assert.equal(hasFreshAppShellCache({ apiSummary: { role: "OWNER" } }, now), false);
});

test("platform and tenant summaries are never reused across their separate navigation contexts", () => {
  const now = 1_000_000;
  const workspaceOnly = { apiSummary: { role: "OWNER" }, updatedAt: now };
  const platformOnly = { platformSummary: { platformRole: "PLATFORM_ADMIN" }, updatedAt: now };

  assert.equal(hasFreshWorkspaceAppShellCache(workspaceOnly, now), true);
  assert.equal(hasFreshPlatformAppShellCache(workspaceOnly, now), false);
  assert.equal(hasFreshWorkspaceAppShellCache(platformOnly, now), false);
  assert.equal(hasFreshPlatformAppShellCache(platformOnly, now), true);
});
