import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = join(import.meta.dirname, "..");
const reportSource = readFileSync(join(webRoot, "components", "reports", "ReportSummaryPanel.tsx"), "utf8");
const apiTypesSource = readFileSync(join(webRoot, "lib", "api", "apiTypes.ts"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("employee reports present live signals, audit, trend and API summary in that order", () => {
  const live = reportSource.indexOf("<EmployeeLiveOverview");
  const audit = reportSource.indexOf("<EmployeeConnectionAudit");
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
  assert.match(reportSource, /result\.data\.revision !== failedSummaryRevisionRef\.current/);
  assert.match(reportSource, /failedSummaryRevisionRef\.current = result\.data\.revision/);
});

test("filter refresh replaces previous report content with the WorkMap pixel loader", () => {
  assert.match(reportSource, /import \{ WorkMapLoader \} from "\.\.\/ui\/WorkMapLoader"/);
  assert.match(reportSource, /\{reportState\.loading \? \(/);
  assert.match(reportSource, /<section style=\{styles\.loadingPanel\} aria-label="Loading selected report">/);
  assert.match(reportSource, /<WorkMapLoader label="Loading selected report" \/>/);
  assert.match(reportSource, /!reportState\.loading && summary\?\.scope === "user"/);
  assert.match(reportSource, /disabled=\{!summary \|\| reportState\.loading\}/);
});

test("the initial report loads current status first, then summary and non-blocking audit", () => {
  assert.match(reportSource, /const initialLiveResult = await requestCurrentLive\(context, initialFilters, summaryRevisionDue\);/);
  assert.match(reportSource, /const result = await requestSummary\(context, initialFilters\);/);
  assert.match(reportSource, /applyResult\(result, setReportState\);\s*\n\s*loadedSummary = result\.data/);
  assert.match(reportSource, /void loadAudit\(context, initialFilters/);
  assert.match(reportSource, /void loadDirectory\(context\.options/);
  assert.match(reportSource, /if \(!auth \|\| !livePollingReady\) return;/);
  assert.match(reportSource, /includeAudit: false/);
  assert.match(reportSource, /includeLive: false/);
  assert.match(reportSource, /includeRevision,\s*\n/);
  assert.match(reportSource, /const revisionDue = Date\.now\(\) >= nextRevisionCheckAtRef\.current/);
});

test("report filter loader leaves the pixel avatar unframed", () => {
  assert.match(
    redesignStyles,
    /\.wm-report-summary > section\[aria-label="Loading selected report"\] \.wm-loader-section \{\s*min-height: 0;\s*border: 0;\s*border-radius: 0;\s*background: transparent;/,
  );
});

test("live signals and connection audit retain comfortable responsive section padding", () => {
  assert.equal((reportSource.match(/className="wm-report-detail-section"/g) ?? []).length, 3);
  assert.match(redesignStyles, /\.wm-report-summary > section\.wm-report-detail-section \{\s*padding: 24px !important;/);
  assert.match(redesignStyles, /@media \(max-width: 640px\) \{\s*\.wm-report-summary > section\.wm-report-detail-section \{\s*padding: 16px !important;/);
});
