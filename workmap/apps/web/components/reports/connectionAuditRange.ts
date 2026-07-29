import type { ReportFilters } from "./reportFilters";

export type ConnectionAuditCalendarRange = Pick<ReportFilters, "from" | "to">;

export type ConnectionAuditRangeResolution = {
  calendar: ConnectionAuditCalendarRange;
  request: ConnectionAuditCalendarRange;
  timeZone: string;
};

export function resolveConnectionAuditRange(
  filters: ConnectionAuditCalendarRange,
  now = new Date(),
  requestedTimeZone = resolveViewerTimeZone(),
): ConnectionAuditRangeResolution {
  const timeZone = normalizeTimeZone(requestedTimeZone);
  const utcDate = now.toISOString().slice(0, 10);
  const localDate = calendarDateForInstant(now, timeZone);
  const calendar = filters.from === utcDate && filters.to === utcDate
    ? { from: localDate, to: localDate }
    : { from: filters.from, to: filters.to };
  const requestFrom = addCalendarDays(calendar.from, -1);
  const expandedTo = addCalendarDays(calendar.to, 1);

  return {
    calendar,
    request: {
      from: requestFrom,
      // The existing Reports API rejects future UTC dates. One adjacent UTC
      // day on either side is sufficient for every IANA time-zone offset.
      to: expandedTo > utcDate ? utcDate : expandedTo,
    },
    timeZone,
  };
}

export function isConnectionAuditTimestampInRange(
  timestamp: string,
  range: ConnectionAuditCalendarRange,
  requestedTimeZone: string,
) {
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) return false;
  const calendarDate = calendarDateForInstant(
    instant,
    normalizeTimeZone(requestedTimeZone),
  );
  return calendarDate >= range.from && calendarDate <= range.to;
}

export function resolveViewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function normalizeTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

function calendarDateForInstant(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
