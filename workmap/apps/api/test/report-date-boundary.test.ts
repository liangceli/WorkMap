import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseReportRange } from "../src/modules/reports/reports.service.js";

test("report date boundaries use the workspace calendar in an Australian morning", () => {
  const serverNow = new Date("2026-07-13T23:30:00.000Z");
  const range = parseReportRange(
    "2026-07-14",
    "2026-07-14",
    serverNow,
    "Australia/Adelaide",
  );

  assert.equal(range.fromDate, "2026-07-14");
  assert.equal(range.toDate, "2026-07-14");
  assert.equal(range.timeZone, "Australia/Adelaide");
  assert.equal(range.startsAt.toISOString(), "2026-07-13T14:30:00.000Z");
  assert.equal(range.endsAtExclusive.toISOString(), "2026-07-14T14:30:00.000Z");
  assert.throws(
    () => parseReportRange(
      "2026-07-15",
      "2026-07-15",
      serverNow,
      "Australia/Adelaide",
    ),
    BadRequestException,
  );
});

test("report range honors Adelaide daylight-saving day lengths", () => {
  const spring = parseReportRange(
    "2026-10-04",
    "2026-10-04",
    new Date("2026-10-04T12:00:00.000Z"),
    "Australia/Adelaide",
  );
  const autumn = parseReportRange(
    "2026-04-05",
    "2026-04-05",
    new Date("2026-04-05T12:00:00.000Z"),
    "Australia/Adelaide",
  );

  assert.equal(
    spring.endsAtExclusive.getTime() - spring.startsAt.getTime(),
    23 * 60 * 60 * 1000,
  );
  assert.equal(
    autumn.endsAtExclusive.getTime() - autumn.startsAt.getTime(),
    25 * 60 * 60 * 1000,
  );
});
