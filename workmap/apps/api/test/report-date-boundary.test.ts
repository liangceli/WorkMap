import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseReportRange } from "../src/modules/reports/reports.service.js";

test("report date boundaries use UTC, including an Australian-morning client", () => {
  const serverNow = new Date("2026-07-13T23:30:00.000Z");
  const range = parseReportRange("2026-07-13", "2026-07-13", serverNow);

  assert.equal(range.fromDate, "2026-07-13");
  assert.equal(range.toDate, "2026-07-13");
  assert.throws(
    () => parseReportRange("2026-07-14", "2026-07-14", serverNow),
    BadRequestException,
  );
});
