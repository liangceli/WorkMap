import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { minimizeWindowsObservation } from "../src/windowsForeground.js";

test("Windows adapter keeps product name and strips sensitive native fields", () => {
  const sample = minimizeWindowsObservation({
    appName: "  Visual Studio Code  ",
    idleSeconds: 400,
    idle: true,
    locked: false,
    observedAt: "2026-06-18T00:00:00.000Z",
    windowTitle: "Sensitive document title",
  } as never);
  assert.equal(sample.appName, "Visual Studio Code");
  assert.equal(sample.isIdle, true);
  assert(!("windowTitle" in sample));
});

test("production PowerShell adapter uses foreground and last-input APIs without reading titles", async () => {
  const source = await readFile(new URL("../scripts/windows-foreground.ps1", import.meta.url), "utf8");
  assert.match(source, /GetForegroundWindow/);
  assert.match(source, /GetLastInputInfo/);
  assert.match(source, /OpenInputDesktop/);
  assert.match(source, /IsIconic/);
  assert.match(source, /IsWindowVisible/);
  assert.match(source, /ProductName/);
  assert.doesNotMatch(source, /GetWindowText/);
});

test("Windows Alpha package provides current-user install and uninstall scripts", async () => {
  const install = await readFile(new URL("../scripts/install-workmap-agent.ps1", import.meta.url), "utf8");
  const uninstall = await readFile(new URL("../scripts/uninstall-workmap-agent.ps1", import.meta.url), "utf8");
  const setup = await readFile(new URL("../scripts/setup-workmap-agent.ps1", import.meta.url), "utf8");
  const release = await readFile(new URL("../scripts/build-windows-release.ps1", import.meta.url), "utf8");
  assert.match(install, /WorkMapDesktopAgent/);
  assert.match(install, /CurrentVersion\\Run/);
  assert.match(install, /Resolve-Path \$PSScriptRoot/);
  assert.match(uninstall, /RemoveLocalData/);
  assert.match(uninstall, /WorkMap Desktop Agent\*dist\*index\.js\*run/);
  assert.match(setup, /install-workmap-agent\.ps1/);
  assert.match(release, /runtime/);
  assert.doesNotMatch(install, /LocalMachine/);
});
