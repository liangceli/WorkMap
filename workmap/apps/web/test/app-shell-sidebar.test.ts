import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = join(import.meta.dirname, "..");
const appShellSource = readFileSync(join(webRoot, "components", "layout", "AppShell.tsx"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("workspace sidebar can be collapsed locally without changing navigation routes", () => {
  assert.match(appShellSource, /APP_SHELL_SIDEBAR_COLLAPSED_KEY/);
  assert.match(appShellSource, /readSidebarCollapsedPreference\(\)/);
  assert.match(appShellSource, /saveSidebarCollapsedPreference\(next\)/);
  assert.match(appShellSource, /wm-app-shell-collapsed/);
  assert.match(appShellSource, /href=\{item\.href\}/);
  assert.match(appShellSource, /aria-label=\{item\.label\}/);
});

test("collapsed desktop sidebar keeps icon navigation and restores full navigation on smaller screens", () => {
  assert.match(redesignStyles, /\.wm-app-shell\.wm-app-shell-collapsed \{\s*grid-template-columns: 76px minmax\(0, 1fr\) !important;/);
  assert.match(redesignStyles, /\.wm-app-shell\.wm-app-shell-collapsed \.wm-app-nav-icon \{[\s\S]*?display: grid !important;/);
  assert.match(redesignStyles, /\.wm-app-shell\.wm-app-shell-collapsed \.wm-app-nav-link::after[\s\S]*?content: attr\(aria-label\);/);
  assert.match(redesignStyles, /@media \(max-width: 1024px\) \{[\s\S]*?\.wm-app-sidebar-toggle \{\s*display: none !important;/);
  assert.match(redesignStyles, /@media \(max-width: 760px\) \{[\s\S]*?\.wm-app-nav-link > \.wm-app-nav-copy \{\s*display: block !important;/);
});
