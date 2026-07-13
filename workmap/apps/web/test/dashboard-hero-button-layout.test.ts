import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const dashboardSource = readFileSync(join(webRoot, "components", "dashboard", "ManagerOverviewPanel.tsx"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");
const globalStyles = readFileSync(join(webRoot, "app", "globals.css"), "utf8");
const themeSource = readFileSync(join(webRoot, "lib", "theme", "workmapTheme.ts"), "utf8");

test("dashboard hero contains only current workspace signals and responsive action classes", () => {
  assert.match(dashboardSource, /className="wm-dashboard-hero"/);
  assert.match(dashboardSource, /const heroSignals/);
  assert.match(dashboardSource, /label: "Session"/);
  assert.match(dashboardSource, /label: "Presence"/);
  assert.match(dashboardSource, /label: "Device coverage"/);
  assert.match(dashboardSource, /label: "Policy"/);
  assert.match(dashboardSource, /wm-dashboard-hero-actions/);
  assert.match(dashboardSource, /wm-dashboard-hero-signal/);
});

test("dashboard hero and shared action controls keep text inside rounded controls on narrow screens", () => {
  assert.match(redesignStyles, /\.wm-redesign-page > \.wm-dashboard-hero/);
  assert.match(redesignStyles, /\.wm-dashboard-hero-actions a[\s\S]*?max-width:\s*100%/);
  assert.match(redesignStyles, /\.wm-dashboard-hero-actions a[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(redesignStyles, /@media \(max-width: 760px\)[\s\S]*?\.wm-dashboard-hero-actions[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(redesignStyles, /@media \(max-width: 420px\)[\s\S]*?\.wm-dashboard-hero-signals[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(globalStyles, /a\[class\*="button" i\]/);
  assert.match(globalStyles, /overflow-wrap:\s*anywhere/);
  assert.match(themeSource, /button:\s*"12px"/);
  assert.match(themeSource, /borderRadius:\s*wm\.radius\.button/);
});
