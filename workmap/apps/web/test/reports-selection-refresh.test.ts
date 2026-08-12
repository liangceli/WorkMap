import assert from "node:assert/strict";
import test from "node:test";
import { refreshReportSelection } from "../components/reports/reportSelectionRefresh.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("filter refresh starts Live and Summary together and applies each independently", async () => {
  const live = deferred<string>();
  const summary = deferred<string>();
  const started: string[] = [];
  const applied: string[] = [];

  const refresh = refreshReportSelection({
    requestLive: () => {
      started.push("live");
      return live.promise;
    },
    requestSummary: () => {
      started.push("summary");
      return summary.promise;
    },
    applyLive: (result) => applied.push(result),
    applySummary: (result) => applied.push(result),
  });

  assert.deepEqual(started, ["live", "summary"]);

  summary.resolve("summary-ready");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied, ["summary-ready"]);

  live.resolve("live-ready");
  await refresh;
  assert.deepEqual(applied, ["summary-ready", "live-ready"]);
});
