import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const homeSource = readFileSync(join(webRoot, "app", "page.tsx"), "utf8");
const homeStyles = readFileSync(join(webRoot, "app", "home.module.css"), "utf8");

test("home mobile menu includes the mobile account actions inside the opened menu", () => {
  assert.match(homeSource, /headerMenuOpen/);
  assert.match(homeSource, /home-mobile-navigation/);
  assert.match(homeSource, /mobileMenuActions/);
  assert.match(homeSource, />Login</);
  assert.match(homeSource, />Get started</);
});

test("home mobile menu uses a left-aligned card layout instead of the centered narrow link stack", () => {
  assert.match(homeStyles, /\.headerMenuOpen \.nav/);
  assert.match(homeStyles, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(homeStyles, /justify-content:\s*stretch/);
  assert.match(homeStyles, /justify-items:\s*stretch/);
  assert.match(homeStyles, /\.mobileMenuActions/);
  assert.match(homeStyles, /\.mobilePrimaryButton/);
});

test("home hero proof items remain horizontal on small screens", () => {
  assert.match(homeStyles, /\.heroProof\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*8px;\s*\}/);
  assert.match(homeStyles, /\.heroProof div\s*\{\s*grid-template-columns:\s*22px minmax\(0,\s*1fr\);/);
  assert.doesNotMatch(homeStyles, /@media \(max-width: 820px\)[\s\S]*?\.heroProof\s*\{\s*grid-template-columns:\s*1fr/);
});
