import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultReportFilters,
  localToday,
  persistReportFilters,
  restoreReportFilters,
} from "../components/reports/reportFilters";

test("new company reports default to the employee's local current day and all departments", () => {
  assert.equal(localToday(new Date(2026, 6, 7, 23, 30)), "2026-07-07");
  assert.deepEqual(defaultReportFilters("company", "2026-07-07"), {
    view: "company",
    departmentId: "",
    from: "2026-07-07",
    to: "2026-07-07",
  });
});

test("report filters survive remounts and stay isolated per signed-in user", () => {
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
      saved,
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
