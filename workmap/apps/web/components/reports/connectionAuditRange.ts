import {
  normalizeTimeZone,
  resolveViewerTimeZone,
  type ReportFilters,
} from "./reportFilters";

export type ConnectionAuditCalendarRange = Pick<ReportFilters, "from" | "to">;

export type ConnectionAuditRangeResolution = {
  calendar: ConnectionAuditCalendarRange;
  request: ConnectionAuditCalendarRange;
  timeZone: string;
};

export function resolveConnectionAuditRange(
  filters: ConnectionAuditCalendarRange,
  requestedTimeZone = resolveViewerTimeZone(),
): ConnectionAuditRangeResolution {
  const timeZone = normalizeTimeZone(requestedTimeZone);
  const calendar = { from: filters.from, to: filters.to };

  return {
    calendar,
    request: calendar,
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
