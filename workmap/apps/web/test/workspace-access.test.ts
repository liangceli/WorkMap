import assert from "node:assert/strict";
import test from "node:test";
import { isConfirmedWorkspaceMissing, workspaceAccessError } from "../lib/auth/workspaceAccess.js";

test("only a confirmed missing WorkMap mapping enters owner workspace onboarding", () => {
  assert.equal(isConfirmedWorkspaceMissing({
    ok: false,
    status: 401,
    source: "fallback",
    error: "WorkMap API returned 401: Cognito user is not mapped to an active WorkMap user.",
  }), true);
  assert.equal(isConfirmedWorkspaceMissing({ ok: false, status: 500, source: "fallback", error: "WorkMap API returned 500: Internal server error" }), false);
  assert.equal(isConfirmedWorkspaceMissing({ ok: false, status: 401, source: "fallback", error: "WorkMap API returned 401: Token expired" }), false);
});

test("workspace access errors state that existing data was not changed", () => {
  const message = workspaceAccessError({ ok: false, status: 500, source: "fallback", error: "WorkMap API returned 500: Internal server error" });
  assert.match(message, /existing workspace was not changed/i);
});
