import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const loaderSource = readFileSync(join(webRoot, "components", "ui", "WorkMapLoader.tsx"), "utf8");
const globalStyles = readFileSync(join(webRoot, "app", "globals.css"), "utf8");

const loaderAvatarLayers = [
  "/assets/avatars/layers/bodies/Body_1.png",
  "/assets/avatars/layers/eyes/Eyes_Blue.png",
  "/assets/avatars/layers/outfits/Outfit_Braces_Brown.png",
  "/assets/avatars/layers/hairstyles/Hairstyle_Short_Brown_Dark.png",
];

test("WorkMapLoader renders the layered pixel walker instead of the old rotating mark", () => {
  assert.match(loaderSource, /wm-loader-walker/);
  assert.match(loaderSource, /wm-loader-walker-body/);
  assert.match(loaderSource, /wm-loader-walker-eyes/);
  assert.match(loaderSource, /wm-loader-walker-outfit/);
  assert.match(loaderSource, /wm-loader-walker-hair/);
  assert.doesNotMatch(loaderSource, /wm-loader-mark/);
});

test("loading walker uses the confirmed default layered avatar assets", () => {
  for (const assetPath of loaderAvatarLayers) {
    assert.equal(globalStyles.includes(assetPath), true);
  }
});

test("loading walker animates the six down-walk frames and respects reduced motion", () => {
  assert.match(globalStyles, /animation:\s*wm-loader-walk-down\s+840ms\s+steps\(6\)\s+infinite/);
  assert.match(globalStyles, /from\s*{\s*background-position:\s*-1728px\s+-432px;\s*}/);
  assert.match(globalStyles, /to\s*{\s*background-position:\s*-2304px\s+-432px;\s*}/);
  assert.match(globalStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(globalStyles, /\.wm-loader-walker-layer\s*{\s*animation:\s*none;\s*}/);
  assert.doesNotMatch(globalStyles, /wm-logo-spin/);
});
