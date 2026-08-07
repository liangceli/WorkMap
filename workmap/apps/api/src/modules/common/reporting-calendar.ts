export type ReportingDayFragment = {
  reportDate: Date;
  fragmentIndex: number;
  startedAt: Date;
  endedAt: Date;
  durationMs: bigint;
};

type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number };

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeReportingTimeZone(
  value: string | null | undefined,
) {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function calendarDateForInstant(value: Date, timeZone: string) {
  const parts = localPartsForInstant(
    value,
    normalizeReportingTimeZone(timeZone),
  );
  return formatLocalDate(parts);
}

export function addCalendarDays(value: string, days: number) {
  const parsed = parseCalendarDate(value);
  return formatLocalDate(addLocalDays(parsed, days));
}

export function calendarDateToken(value: string) {
  const parsed = parseCalendarDate(value);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

export function reportingDayStart(value: string, timeZone: string) {
  const parsed = parseCalendarDate(value);
  return new Date(
    zonedLocalToUtcMs(
      { ...parsed, hour: 0, minute: 0 },
      normalizeReportingTimeZone(timeZone),
    ),
  );
}

export function splitIntervalByReportingDay(
  startedAt: Date,
  endedAt: Date,
  timeZone: string,
): ReportingDayFragment[] {
  if (endedAt <= startedAt) return [];
  const normalizedTimeZone = normalizeReportingTimeZone(timeZone);
  const fragments: ReportingDayFragment[] = [];
  let cursor = startedAt;
  let fragmentIndex = 0;

  while (cursor < endedAt) {
    const reportDate = calendarDateForInstant(cursor, normalizedTimeZone);
    const nextDayStart = reportingDayStart(
      addCalendarDays(reportDate, 1),
      normalizedTimeZone,
    );
    const fragmentEnd = endedAt < nextDayStart ? endedAt : nextDayStart;
    // IANA zones can have unusual historical transitions. This guard keeps a
    // malformed/non-advancing boundary from trapping ingestion in a loop.
    if (fragmentEnd <= cursor) break;
    fragments.push({
      reportDate: calendarDateToken(reportDate),
      fragmentIndex,
      startedAt: cursor,
      endedAt: fragmentEnd,
      durationMs: BigInt(fragmentEnd.getTime() - cursor.getTime()),
    });
    cursor = fragmentEnd;
    fragmentIndex += 1;
  }
  return fragments;
}

function parseCalendarDate(value: string): LocalDate {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError("Calendar date must use YYYY-MM-DD.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Calendar date is not valid.");
  }
  return { year, month, day };
}

function formatLocalDate(value: LocalDate) {
  return [
    String(value.year).padStart(4, "0"),
    String(value.month).padStart(2, "0"),
    String(value.day).padStart(2, "0"),
  ].join("-");
}

function localPartsForInstant(
  value: Date,
  timeZone: string,
): LocalDateTime & { second: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function addLocalDays(value: LocalDate, days: number): LocalDate {
  const shifted = new Date(
    Date.UTC(value.year, value.month - 1, value.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedLocalToUtcMs(value: LocalDateTime, timeZone: string) {
  const targetLocalMs = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
  );
  let candidateMs = targetLocalMs;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = localPartsForInstant(new Date(candidateMs), timeZone);
    const actualLocalMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = targetLocalMs - actualLocalMs;
    if (adjustment === 0) break;
    candidateMs += adjustment;
  }
  return candidateMs;
}
