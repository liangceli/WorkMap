"use client";

export type ViewFilter = "company" | "me" | `user:${string}`;
export type ReportFilters = { view: ViewFilter; departmentId: string; from: string; to: string };

const REPORT_FILTER_STORAGE_PREFIX = "workmap.reportFilters";

export function defaultReportFilters(view: ViewFilter, today = utcToday()): ReportFilters {
  return { view, departmentId: "", from: today, to: today };
}

export function restoreReportFilters(
  userId: string,
  fallback: ReportFilters,
  options: { canViewCompany: boolean; userIds: string[]; departmentIds?: string[]; reportingDate?: string },
) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(reportFilterStorageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    const reportingDate = options.reportingDate ?? utcToday();
    if (!isReportFilters(parsed) || parsed.from > parsed.to || parsed.to > reportingDate) return fallback;
    if (parsed.view === "company" && !options.canViewCompany) return fallback;
    if (parsed.view.startsWith("user:") && !options.userIds.includes(parsed.view.slice(5))) return fallback;

    return {
      ...parsed,
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

export function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
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
