import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MV3 runtime listens to tab, window, idle and alarm lifecycle", async () => {
  const source = await readFile(new URL("../src/background.ts", import.meta.url), "utf8");
  for (const marker of ["tabs.onActivated", "tabs.onUpdated", "windows.onFocusChanged", "windows.getLastFocused", "idle.onStateChanged", "alarms.onAlarm", "runtime.onStartup"]) assert(source.includes(marker));
  assert(!source.includes("setInterval("));
});

test("manifest requests only tracking/runtime permissions and no content access", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "idle", "storage", "tabs"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.optional_host_permissions.sort(), ["http://127.0.0.1/*", "http://localhost/*", "https://*/*"]);
  assert.equal(manifest.host_permissions, undefined);
  for (const forbidden of ["clipboardRead", "clipboardWrite", "history", "downloads", "webRequest", "camera", "microphone"]) assert(!manifest.permissions.includes(forbidden));
});
