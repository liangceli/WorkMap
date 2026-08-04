import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MV3 runtime listens to page activity and complete tab/window lifecycle", async () => {
  const source = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  for (const marker of [
    "runtime.onMessage",
    "tabs.onActivated",
    "tabs.onCreated",
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
    "sendExtensionStatus",
    "BrowserOpenRuntimeEngineV2",
  ]) assert(source.includes(marker), `missing ${marker}`);
  assert.match(source, /COLLECTOR_KEEPALIVE_INTERVAL_MS = 20_000/);
  assert.match(source, /runCollectorKeepAliveCheckpoint/);
  assert.match(source, /stopCollectorKeepAlive/);
  assert.equal(source.match(/setInterval\(/g)?.length, 1);
  assert.equal(source.match(/clearInterval\(/g)?.length, 1);
});

test("local extension status does not preserve stale connected state", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const background = await readFile(new URL("../src/backgroundV2.ts", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/extensionApi.ts", import.meta.url), "utf8");
  const types = await readFile(new URL("../src/trackingV2Types.ts", import.meta.url), "utf8");

  assert.equal(manifest.version, "0.5.15");
  assert.equal(packageJson.version, "0.5.15");
  assert.equal(manifest.incognito, "not_allowed");
  assert.equal(manifest.background.service_worker, "dist/backgroundV2.js");
  assert.match(types, /browser-extension-mv3\/0\.5\.15/);
  assert.match(api, /BROWSER_EXTENSION_VERSION/);
  assert.match(background, /connectionState === "ONLINE"/);
  assert.match(background, /connectionState === "AUTH_REQUIRED"/);
  assert.match(background, /connectionState === "UPGRADE_REQUIRED"/);
  assert.match(background, /ensureDomainContentScriptRegistered\(true\)/);
  assert.match(background, /permissions\.onRemoved/);
  assert.match(background, /createHealth/);
  assert.match(background, /latestSnapshot/);
  assert.match(background, /resetAfterPairing/);
  assert.match(background, /stored\.workmapConfig/);
  assert.match(background, /focusTimelineThroughAt/);
  assert.match(background, /createBrowserFocusClockV2/);
  assert.match(background, /immediateSync && !hadEngine/);
  assert.match(background, /performSyncOutsideOperation/);
  assert.match(background, /syncInFlight/);
  assert.match(background, /applySyncSuccess/);
  assert.match(background, /sameBrowserSnapshot/);
  assert.match(options, /notifyBackgroundPaired/);
  assert.match(options, /await trackingStore\.close\(\)/);
  assert.match(options, /Pairing v2 initialization is still pending|Tracking v2 initialization is still pending/);
  assert.match(options, /deriveStatusHealth/);
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
    '"pointermove"',
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
