import assert from "node:assert/strict";
import test from "node:test";
import { CORS_PREFLIGHT_MAX_AGE_SECONDS } from "../src/config/allowed-origins.js";

test("browser CORS preflight decisions are cached for ten minutes", () => {
  assert.equal(CORS_PREFLIGHT_MAX_AGE_SECONDS, 600);
});
