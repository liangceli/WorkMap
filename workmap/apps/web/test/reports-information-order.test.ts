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

test("live, audit and summary revision use independent completion-scheduled polling", () => {
  assert.match(reportSource, /startCompletionPoller\(refresh, LIVE_REFRESH_MS/);
  assert.match(reportSource, /startCompletionPoller\(refreshAudit, AUDIT_REFRESH_MS/);
  assert.match(reportSource, /startCompletionPoller\(refreshSummaryRevision, SUMMARY_REVISION_CHECK_MS/);
  assert.doesNotMatch(reportSource, /setInterval\(\(\) => void refresh/);
});

test("filter refresh gives Live and confirmed summary independent lightweight feedback", () => {
  assert.doesNotMatch(reportSource, /import \{ WorkMapLoader \}/);
  assert.match(reportSource, /refreshReportSelection\(\{/);
  assert.match(reportSource, /requestLive: \(\) => requestCurrentLive/);
  assert.match(reportSource, /requestSummary: \(\) => requestSummary/);
  assert.match(reportSource, /<ReportSectionLoader section="live" \/>/);
  assert.match(reportSource, /<ReportSectionLoader section="summary" \/>/);
  assert.match(reportSource, /summary: selectionChanged \? null : current\.summary/);
  assert.match(reportSource, /disabled=\{!summary \|\| summarySelectionLoading\}/);
});

test("the cold initial report starts live and summary together after timezone resolution", () => {
  assert.match(reportSource, /const initialLivePromise = requestCurrentLive/);
  assert.match(reportSource, /const coldSummaryPromise = snapshot\?\.summary/);
  assert.match(reportSource, /Promise\.all\(\[initialLivePromise, coldSummaryPromise\]\)/);
  assert.match(reportSource, /void loadAudit\(context, initialFilters/);
  assert.match(reportSource, /void loadDirectory\(context\.options/);
  assert.match(reportSource, /if \(!auth \|\| !livePollingReady\) return;/);
  assert.match(reportSource, /includeAudit: false/);
  assert.match(reportSource, /includeLive: false/);
  assert.match(reportSource, /includeRevision,\s*\n/);
  assert.match(reportSource, /includeTimeline: false/);
});

test("report filter loader uses a compact spinner and skeleton cards", () => {
  assert.match(
    redesignStyles,
    /\.wm-report-loading-spinner \{\s*animation: wm-report-loading-spin/,
  );
  assert.match(redesignStyles, /\.wm-report-loading-card::after/);
  assert.doesNotMatch(redesignStyles, /section\[aria-label="Loading selected report"\] \.wm-loader-section/);
});

test("live signals and connection audit retain comfortable responsive section padding", () => {
  assert.equal((reportSource.match(/className="wm-report-detail-section"/g) ?? []).length, 3);
  assert.match(redesignStyles, /\.wm-report-summary > section\.wm-report-detail-section \{\s*padding: 24px !important;/);
  assert.match(redesignStyles, /@media \(max-width: 640px\) \{\s*\.wm-report-summary > section\.wm-report-detail-section \{\s*padding: 16px !important;/);
});
