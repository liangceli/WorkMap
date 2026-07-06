import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AppUsageMetricCard, DomainUsageMetricCard } from "../components/reports/ReportSummaryPanel.js";

test("app card emphasizes focus active and keeps secondary metrics collapsed by default", () => {
  const html = renderToStaticMarkup(createElement(AppUsageMetricCard, { row }));

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Focus active/);
  assert.match(html, /4m 1s/);
  assert.doesNotMatch(html, /Focused idle/);
  assert.doesNotMatch(html, /Open\/runtime/);
});

test("expanded app card reveals focused idle and open runtime", () => {
  const html = renderToStaticMarkup(createElement(AppUsageMetricCard, { row, initiallyExpanded: true }));
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Focused idle/);
  assert.match(html, /1m 30s/);
  assert.match(html, /Open\/runtime/);
  assert.match(html, /8m 16s/);
});

test("domain card uses the same focus-first collapsed presentation", () => {
  const html = renderToStaticMarkup(createElement(DomainUsageMetricCard, { row: domainRow }));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Focus active/);
  assert.match(html, /3m 20s/);
  assert.doesNotMatch(html, /Focused idle/);
  assert.doesNotMatch(html, /Open\/runtime/);
});

test("expanded domain card reveals de-duplicated focused idle and runtime", () => {
  const html = renderToStaticMarkup(createElement(DomainUsageMetricCard, { row: domainRow, initiallyExpanded: true }));
  assert.match(html, /Focused idle/);
  assert.match(html, /45s/);
  assert.match(html, /Open\/runtime/);
  assert.match(html, /10m 0s/);
  assert.match(html, /duplicate tabs are counted once/);
});

const row = {
  name: "Weixin",
  category: null,
  productivityLabel: null,
  activeSeconds: 241,
  idleSeconds: 90,
  focusActiveSeconds: 241,
  focusedIdleSeconds: 90,
  openRuntimeSeconds: 496,
};

const domainRow = {
  name: "github.com",
  category: null,
  productivityLabel: null,
  activeSeconds: 200,
  idleSeconds: 45,
  focusActiveSeconds: 200,
  focusedIdleSeconds: 45,
  openRuntimeSeconds: 600,
};
