import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = join(import.meta.dirname, "..");
const reportSource = readFileSync(join(webRoot, "components", "reports", "ReportSummaryPanel.tsx"), "utf8");
const apiTypesSource = readFileSync(join(webRoot, "lib", "api", "apiTypes.ts"), "utf8");

test("employee reports present live signals, audit, trend and API summary in that order", () => {
  const live = reportSource.indexOf('<EmployeeLiveOverview summary={summary} />');
  const audit = reportSource.indexOf('<EmployeeConnectionAudit summary={summary} />');
  const trend = reportSource.indexOf('<DailyTrend rows={summary.daily} />');
  const api = reportSource.indexOf('>API summary</p>');

  assert(live >= 0);
  assert(audit > live);
  assert(trend > audit);
  assert(api > trend);
});

test("live and audit sections use the responsive two-column grid and real current-domain fields", () => {
  assert.match(reportSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(100%, 420px\), 1fr\)\)"/);
  assert.match(reportSource, /row\.currentDomain \?\? "No active domain"/);
  assert.match(reportSource, /event\.source !== "DESKTOP_AGENT"/);
  assert.match(reportSource, /event\.source !== "BROWSER_EXTENSION"/);
  assert.match(apiTypesSource, /currentDomain: string \| null/);
  assert.match(apiTypesSource, /currentDomainObservedAt: string \| null/);
});

test("a failed summary revision is not retried on every live poll", () => {
  assert.match(reportSource, /failedSummaryRevisionRef/);
  assert.match(reportSource, /result\.data\.activityRevision !== failedSummaryRevisionRef\.current/);
  assert.match(reportSource, /failedSummaryRevisionRef\.current = result\.data\.activityRevision/);
});
