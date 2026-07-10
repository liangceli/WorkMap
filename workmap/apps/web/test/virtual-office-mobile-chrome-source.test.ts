import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const topBarSource = readFileSync(join(webRoot, "components", "office", "VirtualOfficeTopBar.tsx"), "utf8");
const bottomDockSource = readFileSync(join(webRoot, "components", "office", "OfficeBottomDock.tsx"), "utf8");

test("virtual office mobile chrome hides secondary overlays and stacks top controls cleanly", () => {
  assert.match(topBarSource, /@media \(max-width: 640px\)/);
  assert.match(topBarSource, /\.wm-office-sync-pill,[\s\S]*?\.wm-office-left-rail,[\s\S]*?\.wm-office-minimap/);
  assert.match(topBarSource, /\.wm-office-area-pill[\s\S]*?top:\s*calc\(max\(10px, env\(safe-area-inset-top\)\) \+ 66px\)/);
  assert.match(topBarSource, /\.wm-office-status-pill[\s\S]*?top:\s*calc\(max\(10px, env\(safe-area-inset-top\)\) \+ 118px\)/);
  assert.match(topBarSource, /className="wm-office-search-label"/);
  assert.match(topBarSource, /className="wm-office-status-divider"/);
});

test("virtual office mobile dock becomes a compact single-row action bar", () => {
  assert.match(bottomDockSource, /@media \(max-width: 640px\)/);
  assert.match(bottomDockSource, /\.wm-office-dock-identity,[\s\S]*?\.wm-office-dock-divider,[\s\S]*?\.office-dock-mobile-hidden/);
  assert.match(bottomDockSource, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(bottomDockSource, /className="office-dock-action office-dock-mobile-hidden"[\s\S]*aria-label="Search"/);
  assert.match(bottomDockSource, /className="office-dock-action office-dock-mobile-hidden"[\s\S]*aria-label="Outlook"/);
  assert.match(bottomDockSource, /className="office-dock-action office-dock-mobile-hidden"[\s\S]*aria-label="3CX coming later"/);
});

test("virtual office mobile panels use bounded bottom-sheet sizing", () => {
  assert.match(topBarSource, /\.wm-office-side-panel[\s\S]*?bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(topBarSource, /\.wm-office-room-card,[\s\S]*?\.wm-office-interaction-drawer[\s\S]*?max-height:\s*min\(56vh, 420px\)/);
  assert.match(topBarSource, /\.wm-office-command-palette[\s\S]*?max-height:\s*calc\(100vh - 24px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)/);
});
