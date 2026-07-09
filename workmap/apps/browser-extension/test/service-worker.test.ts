import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MV3 runtime listens to page activity and complete tab/window lifecycle", async () => {
  const source = await readFile(new URL("../src/background.ts", import.meta.url), "utf8");
  for (const marker of [
    "runtime.onMessage",
    "tabs.onActivated",
    "tabs.onCreated",
    "tabs.onUpdated",
    "tabs.onRemoved",
    "tabs.onReplaced",
    "windows.onFocusChanged",
    "idle.onStateChanged",
    "alarms.onAlarm",
    "runtime.onStartup",
  ]) assert(source.includes(marker), `missing ${marker}`);
  assert(!source.includes("setInterval("));
});

test("local extension status does not preserve stale connected state", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const background = await readFile(new URL("../src/background.ts", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/extensionApi.ts", import.meta.url), "utf8");

  assert.equal(manifest.version, "0.4.2");
  assert.equal(packageJson.version, "0.4.2");
  assert.match(api, /browser-extension-mv3\/0\.4\.2/);
  assert.match(background, /status\?\.state \?\? "offline"/);
  assert.doesNotMatch(background, /status\?\.state \?\? "connected"/);
  assert.match(options, /deriveStatusHealth/);
  assert.match(options, /Signal stale/);
  assert.match(options, /Last server-confirmed heartbeat/);
  assert.doesNotMatch(options, /current\?\.state \?\? "connected"/);
});

test("options page shows pairing progress and times out stuck Edge permission prompts", async () => {
  const options = await readFile(new URL("../src/options.ts", import.meta.url), "utf8");

  for (const marker of [
    "Requesting Edge website tracking permission",
    "Registering WorkMap domain tracker",
    "Pairing with WorkMap API",
    "Edge did not finish the website tracking permission request",
    "setBusy(true",
    "withTimeout",
  ]) assert(options.includes(marker), `missing ${marker}`);
});

test("content script reports only trusted activity timestamps including wheel", async () => {
  const source = await readFile(new URL("../src/contentScript.ts", import.meta.url), "utf8");
  for (const marker of ["event.isTrusted", '"wheel"', '"keydown"', '"pointermove"', '"touchstart"', "activityAt", "lastInputAt"]) {
    assert(source.includes(marker), `missing ${marker}`);
  }
  for (const forbidden of ["event.key", "clientX", "clientY", "event.target", "textContent", "innerText", "document.title", "location.href"]) {
    assert(!source.includes(forbidden), `content script must not collect ${forbidden}`);
  }
});

test("manifest uses optional web host access and the minimum content injection capability", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "idle", "scripting", "storage", "tabs"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.optional_host_permissions.sort(), ["http://*/*", "https://*/*"]);
  assert.equal(manifest.host_permissions, undefined);
  for (const forbidden of ["clipboardRead", "clipboardWrite", "history", "downloads", "webRequest", "camera", "microphone"]) {
    assert(!manifest.permissions.includes(forbidden));
  }
});
