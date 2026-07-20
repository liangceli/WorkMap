import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildAllowedUtcWindows,
  leaseWindowSetMatchesPolicy,
} from "../src/modules/devices/tracking-v2-policy.service.js";
import {
  isInstantInsidePolicyWindowsV2,
  isIntervalInsidePolicyWindowsV2,
} from "@workmap/shared-types";

const policy = {
  scheduleTimeZone: "Australia/Adelaide",
  workHoursOnly: true,
  workdayStart: "09:00",
  workdayEnd: "17:00",
};

test("policy lease windows include Monday work hours in Australia/Adelaide", () => {
  const issuedAt = new Date("2026-07-19T08:12:19.000Z");
  const expiresAt = new Date("2026-07-20T08:12:19.000Z");
  const windows = buildAllowedUtcWindows({ issuedAt, expiresAt, ...policy });
  const mondayTenThirtyFive = Date.parse("2026-07-20T01:05:00.000Z");

  assert.ok(
    windows.some(
      (window) =>
        Date.parse(window.startsAt) <= mondayTenThirtyFive &&
        mondayTenThirtyFive < Date.parse(window.endsAt),
    ),
  );
});

test("stale stored lease windows are not reused", () => {
  const issuedAt = new Date("2026-07-19T08:12:19.000Z");
  const expiresAt = new Date("2026-07-20T08:12:19.000Z");
  const expectedWindows = buildAllowedUtcWindows({ issuedAt, expiresAt, ...policy });
  const validLease = {
    issuedAt,
    expiresAt,
    allowedUtcWindows: expectedWindows,
    windowSetHash: "placeholder",
  };
  const expectedHashLease = {
    ...validLease,
    windowSetHash: createWindowSetHash(expectedWindows),
  };

  assert.equal(leaseWindowSetMatchesPolicy(expectedHashLease, policy), true);
  assert.equal(
    leaseWindowSetMatchesPolicy(
      {
        ...expectedHashLease,
        allowedUtcWindows: [
          {
            startsAt: "2026-07-19T00:00:00.000Z",
            endsAt: "2026-07-19T01:00:00.000Z",
          },
        ],
      },
      policy,
    ),
    false,
  );
});

test("current live focus can recover inside a new work window without admitting pre-window duration", () => {
  const windows = [
    {
      startsAt: "2026-07-19T23:30:00.000Z",
      endsAt: "2026-07-20T07:30:00.000Z",
    },
  ];

  assert.equal(
    isInstantInsidePolicyWindowsV2("2026-07-20T01:05:00.000Z", windows),
    true,
  );
  assert.equal(
    isIntervalInsidePolicyWindowsV2(
      {
        startedAt: "2026-07-19T08:00:00.000Z",
        endedAt: "2026-07-20T01:05:00.000Z",
      },
      windows,
    ),
    false,
  );
});

function createWindowSetHash(windows: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(windows))
    .digest("hex");
}
