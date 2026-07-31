import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = join(import.meta.dirname, "..");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("mobile workspace navigation keeps a text-free horizontal-scroll affordance", () => {
  assert.match(redesignStyles, /@media \(max-width: 760px\) \{[\s\S]*?overflow-x: auto !important;/);
  assert.match(redesignStyles, /scroll-snap-type: x proximity;/);
  assert.doesNotMatch(redesignStyles, /content: "More >";/);
  assert.match(redesignStyles, /::-webkit-scrollbar-thumb[\s\S]*?background: rgba\(39, 224, 162, 0\.8\)/);
});

test("mobile selected navigation tab uses a pill instead of the sidebar marker", () => {
  assert.match(redesignStyles, /border-radius: 999px !important;/);
  assert.match(redesignStyles, /\.wm-app-nav-link\[aria-current="page"\][\s\S]*?background: #fffdf8 !important;/);
  assert.match(redesignStyles, /\.wm-app-nav-link\[aria-current="page"\]::before[\s\S]*?display: none !important;/);
});
