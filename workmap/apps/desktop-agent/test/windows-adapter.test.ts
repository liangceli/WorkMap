import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { minimizeWindowsObservation } from "../src/windowsForeground.js";

test("Windows adapter minimizes native output to process name and activity state", () => {
  const sample = minimizeWindowsObservation({
    processName: "  Code.exe  ",
    idleSeconds: 400,
    idle: true,
    locked: false,
    observedAt: "2026-06-18T00:00:00.000Z",
    windowTitle: "Sensitive document title",
  } as never);
  assert.equal(sample.appName, "Code");
  assert.equal(sample.isIdle, true);
  assert(!("windowTitle" in sample));
});

test("production PowerShell adapter uses foreground and last-input APIs without reading titles", async () => {
  const source = await readFile(new URL("../scripts/windows-foreground.ps1", import.meta.url), "utf8");
  assert.match(source, /GetForegroundWindow/);
  assert.match(source, /GetLastInputInfo/);
  assert.match(source, /OpenInputDesktop/);
  assert.doesNotMatch(source, /GetWindowText/);
});
