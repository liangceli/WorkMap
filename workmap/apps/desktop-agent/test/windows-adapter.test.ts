import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_IDLE_THRESHOLD_SECONDS, minimizeWindowsObservation } from "../src/windowsForeground.js";

test("uses the agreed 30-second no-input threshold", async () => {
  const source = await readFile(new URL("../scripts/windows-foreground.ps1", import.meta.url), "utf8");
  const alphaSource = await readFile(new URL("../alpha-windows/scripts/windows-foreground.ps1", import.meta.url), "utf8");
  assert.equal(DEFAULT_IDLE_THRESHOLD_SECONDS, 30);
  assert.match(source, /IdleThresholdSeconds = 30/);
  assert.match(alphaSource, /IdleThresholdSeconds = 30/);
});

test("Windows adapter keeps product name and strips sensitive native fields", () => {
  const sample = minimizeWindowsObservation({
    appName: "  Visual Studio Code  ",
    openApps: ["  Visual Studio Code  ", "Outlook.exe", "Sensitive App\nName"],
    idleSeconds: 400,
    idle: true,
    locked: false,
    observedAt: "2026-06-18T00:00:00.000Z",
    windowTitle: "Sensitive document title",
  } as never);
  assert.equal(sample.appName, "Visual Studio Code");
  assert.deepEqual(sample.openAppNames, ["Visual Studio Code", "Outlook", "Sensitive App Name"]);
  assert.equal(sample.isIdle, true);
  assert(!("windowTitle" in sample));
});

test("production PowerShell adapter uses foreground and last-input APIs without reading titles", async () => {
  const source = await readFile(new URL("../scripts/windows-foreground.ps1", import.meta.url), "utf8");
  assert.match(source, /GetForegroundWindow/);
  assert.match(source, /GetLastInputInfo/);
  assert.match(source, /EnumWindows/);
  assert.match(source, /OpenInputDesktop/);
  assert.match(source, /IsIconic/);
  assert.match(source, /IsWindowVisible/);
  assert.match(source, /ProductName/);
  assert.match(source, /ApplicationFrameHost/);
  assert.match(source, /GW_CHILD/);
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
