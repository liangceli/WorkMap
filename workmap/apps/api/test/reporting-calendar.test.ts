import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDateForInstant,
  splitIntervalByReportingDay,
} from "../src/modules/common/reporting-calendar.js";

test("an interval crossing Adelaide midnight is split into truthful local report dates", () => {
  const fragments = splitIntervalByReportingDay(
    new Date("2026-08-07T14:29:50.000Z"),
    new Date("2026-08-07T14:30:10.000Z"),
    "Australia/Adelaide",
  );

  assert.deepEqual(
    fragments.map((fragment) => ({
      date: fragment.reportDate.toISOString().slice(0, 10),
      startedAt: fragment.startedAt.toISOString(),
      endedAt: fragment.endedAt.toISOString(),
      durationMs: fragment.durationMs,
    })),
    [
      {
        date: "2026-08-07",
        startedAt: "2026-08-07T14:29:50.000Z",
        endedAt: "2026-08-07T14:30:00.000Z",
        durationMs: 10_000n,
      },
      {
        date: "2026-08-08",
        startedAt: "2026-08-07T14:30:00.000Z",
        endedAt: "2026-08-07T14:30:10.000Z",
        durationMs: 10_000n,
      },
    ],
  );
});

test("Adelaide morning UTC instants map to the current workspace calendar day", () => {
  assert.equal(
    calendarDateForInstant(
      new Date("2026-08-06T23:30:00.000Z"),
      "Australia/Adelaide",
    ),
    "2026-08-07",
  );
});
