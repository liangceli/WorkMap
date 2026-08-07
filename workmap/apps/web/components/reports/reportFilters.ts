"use client";

export type ViewFilter = "company" | "me" | `user:${string}`;
export type ReportFilters = { view: ViewFilter; departmentId: string; from: string; to: string };

const REPORT_FILTER_STORAGE_PREFIX = "workmap.reportFilters";

export function defaultReportFilters(
  view: ViewFilter,
  today = calendarToday(new Date(), resolveViewerTimeZone()),
): ReportFilters {
  return { view, departmentId: "", from: today, to: today };
}

export function restoreReportFilters(
  userId: string,
  fallback: ReportFilters,
  options: { canViewCompany: boolean; userIds?: string[]; departmentIds?: string[] },
) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(reportFilterStorageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!isReportFilters(parsed) || parsed.from > parsed.to) return fallback;
    if (parsed.view === "company" && !options.canViewCompany) return fallback;
    // The owner directory is loaded after the core report. Until it is available,
    // retain a saved employee view and let the report API remain the authority.
    if (parsed.view.startsWith("user:") && options.userIds && !options.userIds.includes(parsed.view.slice(5))) return fallback;

    return {
      ...parsed,
      // A new Reports page always opens on the current workspace reporting day. Persisted
      // scope and department preferences remain useful, but a historical range is not.
      from: fallback.from,
      to: fallback.to,
      departmentId:
        parsed.view === "company" &&
        (!options.departmentIds || !parsed.departmentId || options.departmentIds.includes(parsed.departmentId))
          ? parsed.departmentId
          : "",
    };
  } catch {
    return fallback;
  }
}

export function persistReportFilters(userId: string, filters: ReportFilters) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(reportFilterStorageKey(userId), JSON.stringify(filters));
  } catch {
    // Reporting remains usable when browser storage is unavailable.
  }
}

export function calendarToday(
  now = new Date(),
  requestedTimeZone = resolveViewerTimeZone(),
) {
  const timeZone = normalizeTimeZone(requestedTimeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function normalizeTimeZone(value: string | null | undefined) {
  if (!value) return "UTC";
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function resolveViewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function reportFilterStorageKey(userId: string) {
  return `${REPORT_FILTER_STORAGE_PREFIX}.${userId}`;
}

function isReportFilters(value: unknown): value is ReportFilters {
  if (!isRecord(value)) return false;
  const view = value.view;
  return (
    (view === "company" || view === "me" || (typeof view === "string" && view.startsWith("user:") && view.length > 5)) &&
    typeof value.departmentId === "string" &&
    isDateInputValue(value.from) &&
    isDateInputValue(value.to)
  );
}

function isDateInputValue(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
