import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MV3 runtime listens to page activity and complete tab/window lifecycle", async () => {
  const source = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  for (const marker of [
    "runtime.onMessage",
    "tabs.onActivated",
    "tabs.onUpdated",
    "tabs.onRemoved",
    "tabs.onReplaced",
    "windows.onFocusChanged",
    "windows.onBoundsChanged",
    "windows.onRemoved",
    "idle.onStateChanged",
    "alarms.onAlarm",
    "runtime.onStartup",
    "windows.getLastFocused",
    "idle.queryState",
    "syncTrackingV2",
  ]) assert(source.includes(marker), `missing ${marker}`);
  assert(!source.includes("setInterval("));
});

test("local extension status does not preserve stale connected state", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const background = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/extensionApi.ts", import.meta.url), "utf8");
  const types = await readFile(new URL("../src/trackingV2Types.ts", import.meta.url), "utf8");

  assert.equal(manifest.version, "0.5.4");
  assert.equal(packageJson.version, "0.5.4");
  assert.equal(manifest.incognito, "not_allowed");
  assert.equal(manifest.background.service_worker, "dist/backgroundV2.js");
  assert.match(types, /browser-extension-mv3\/0\.5\.4/);
  assert.match(api, /BROWSER_EXTENSION_VERSION/);
  assert.match(background, /connectionState === "ONLINE"/);
  assert.match(background, /connectionState === "AUTH_REQUIRED"/);
  assert.match(background, /connectionState === "UPGRADE_REQUIRED"/);
  assert.match(background, /ensureDomainContentScriptRegistered\(true\)/);
  assert.match(background, /permissions\.onRemoved/);
  assert.match(background, /createHealth/);
  assert.match(background, /latestSnapshot/);
  assert.match(options, /deriveStatusHealth/);
  assert.match(options, /label: "Online"/);
  assert.match(options, /label: "Offline"/);
  assert.match(options, /Auth required/);
  assert.match(options, /Upgrade required/);
  assert.match(options, /Last server-confirmed heartbeat/);
  assert.doesNotMatch(options, /current\?\.state \?\? "connected"/);
});

test("v2 state and intervals are persisted before sync is scheduled", async () => {
  const source = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  const mutation = source.slice(
    source.indexOf("private async persistUpdate"),
    source.indexOf("private async requestSync"),
  );
  assert(
    mutation.indexOf("await this.store.persistEngineUpdate") <
      mutation.indexOf("await this.requestSync"),
  );
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

test("content script emits only trusted transient pulses and never owns the idle deadline", async () => {
  const source = await readFile(new URL("../src/contentScript.ts", import.meta.url), "utf8");
  for (const marker of [
    "event.isTrusted",
    '"wheel"',
    '"keydown"',
    '"pointerdown"',
    '"mousedown"',
    '"touchstart"',
    '"input"',
    '"change"',
    "activityAt",
  ]) {
    assert(source.includes(marker), `missing ${marker}`);
  }
  for (const forbidden of [
    "event.key",
    "clientX",
    "clientY",
    "event.target",
    "textContent",
    "innerText",
    "document.title",
    "location.href",
    "domain-media-activity",
    "MEDIA_START_FROM_INTERACTION_MS",
    "IDLE_THRESHOLD_MS",
    "workmap:domain-idle",
    '"pointermove"',
    '"touchmove"',
    "selectionchange",
  ]) {
    assert(!source.includes(forbidden), `content script must not collect ${forbidden}`);
  }
});

test("v1 queue is retained until drain and v2 activation uses one boundary", async () => {
  const source = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  for (const marker of [
    "prepareProtocolV2",
    "confirmProtocolV2",
    "closeLegacyTrackerAt",
    "flushLegacyQueue",
    'migrationState: "PREPARING_V2"',
    '"DRAINING_V1"',
    'removeStoredState(["workmapTracker", "workmapQueue"])',
  ]) {
    assert(source.includes(marker), `missing ${marker}`);
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
