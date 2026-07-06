import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AppUsageMetricCard } from "../components/reports/ReportSummaryPanel.js";

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
