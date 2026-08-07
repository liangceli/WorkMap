import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultReportFilters,
  calendarToday,
  persistReportFilters,
  restoreReportFilters,
} from "../components/reports/reportFilters";

test("new company reports default to the workspace reporting day and all departments", () => {
  assert.equal(
    calendarToday(
      new Date("2026-07-13T23:30:00.000Z"),
      "Australia/Adelaide",
    ),
    "2026-07-14",
  );
  assert.deepEqual(defaultReportFilters("company", "2026-07-07"), {
    view: "company",
    departmentId: "",
    from: "2026-07-07",
    to: "2026-07-07",
  });
});

test("report scope and department survive remounts while dates reset to the current reporting day", () => {
  withLocalStorage(() => {
    const saved = {
      view: "company" as const,
      departmentId: "department-1",
      from: "2026-06-01",
      to: "2026-06-21",
    };
    persistReportFilters("owner-1", saved);

    assert.deepEqual(
      restoreReportFilters("owner-1", defaultReportFilters("company", "2026-07-07"), {
        canViewCompany: true,
        userIds: [],
        departmentIds: ["department-1"],
      }),
      {
        ...saved,
        from: "2026-07-07",
        to: "2026-07-07",
      },
    );
    assert.deepEqual(
      restoreReportFilters("owner-2", defaultReportFilters("company", "2026-07-07"), {
        canViewCompany: true,
        userIds: [],
      }),
      defaultReportFilters("company", "2026-07-07"),
    );
  });
});

test("stored views outside the current role or directory fall back safely", () => {
  withLocalStorage(() => {
    persistReportFilters("employee-1", { view: "company", departmentId: "", from: "2026-07-07", to: "2026-07-07" });
    assert.deepEqual(
      restoreReportFilters("employee-1", defaultReportFilters("me", "2026-07-07"), {
        canViewCompany: false,
        userIds: [],
      }),
      defaultReportFilters("me", "2026-07-07"),
    );
  });
});

test("a saved employee view is retained until the Owner directory has loaded", () => {
  withLocalStorage(() => {
    const saved = { view: "user:employee-1" as const, departmentId: "", from: "2026-07-01", to: "2026-07-07" };
    persistReportFilters("owner-1", saved);

    assert.deepEqual(
      restoreReportFilters("owner-1", defaultReportFilters("company", "2026-07-14"), {
        canViewCompany: true,
      }),
      { ...saved, from: "2026-07-14", to: "2026-07-14" },
    );
  });
});

test("a historical persisted date range never carries forward to a newly opened report", () => {
  withLocalStorage(() => {
    const fallback = defaultReportFilters("company", "2026-07-14");
    persistReportFilters("owner-utc", { view: "company", departmentId: "", from: "2026-07-01", to: "2026-07-07" });

    assert.deepEqual(
      restoreReportFilters("owner-utc", fallback, {
        canViewCompany: true,
        userIds: [],
      }),
      fallback,
    );
  });
});

function withLocalStorage(run: () => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: new MemoryStorage() },
  });
  try {
    run();
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
