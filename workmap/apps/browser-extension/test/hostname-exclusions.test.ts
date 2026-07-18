import assert from "node:assert/strict";
import test from "node:test";
import {
  isExcludedHostname,
  normalizeExcludedHostnames,
} from "../src/hostnameExclusions.js";

test("sensitive hostname exclusions normalize locally without accepting URLs", () => {
  assert.deepEqual(
    normalizeExcludedHostnames(
      "Payroll.Example.com\n*.health.example.com\nhttps://private.example.com/path\ninvalid",
    ),
    ["health.example.com", "payroll.example.com"],
  );
});

test("sensitive hostname exclusions cover exact hosts and subdomains", () => {
  const exclusions = ["health.example.com"];
  assert.equal(isExcludedHostname("health.example.com", exclusions), true);
  assert.equal(isExcludedHostname("portal.health.example.com", exclusions), true);
  assert.equal(isExcludedHostname("nothealth.example.com", exclusions), false);
});
