import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const appUsageTableSource = readFileSync(join(webRoot, "components", "dashboard", "AppUsageTable.tsx"), "utf8");
const websiteUsageTableSource = readFileSync(join(webRoot, "components", "dashboard", "WebsiteUsageTable.tsx"), "utf8");
const usageTableSource = readFileSync(join(webRoot, "components", "dashboard", "UsageTable.tsx"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("top apps and top domains use the same six-row collapsed view", () => {
  assert.match(appUsageTableSource, /initialVisibleRows=\{6\}/);
  assert.match(websiteUsageTableSource, /initialVisibleRows=\{6\}/);
  assert.match(usageTableSource, /rows\.slice\(0, initialVisibleRows\)/);
  assert.match(usageTableSource, /rows\.length > initialVisibleRows/);
  assert.match(usageTableSource, /Show more/);
  assert.match(usageTableSource, /Show less/);
  assert.match(usageTableSource, /aria-expanded=\{isExpanded\}/);
});

test("usage rows preserve a readable narrow-screen layout", () => {
  assert.match(redesignStyles, /@media \(max-width: 420px\)[\s\S]*?\.wm-usage-table-row[\s\S]*?grid-template-areas:/);
  assert.match(redesignStyles, /\.wm-usage-table-toggle button[\s\S]*?max-width:\s*100%/);
});
