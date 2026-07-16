import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safePairingError } from "../src/pairing.js";

test("Windows release is a visual NSIS installer", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    main?: string;
    scripts?: Record<string, string>;
    build?: { win?: { target?: string }; nsis?: { oneClick?: boolean; perMachine?: boolean } };
  };
  const html = await readFile(new URL("../renderer/index.html", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../renderer/app.js", import.meta.url), "utf8");
  const preload = await readFile(new URL("../renderer/preload.cjs", import.meta.url), "utf8");
  const pairing = await readFile(new URL("../src/pairing.ts", import.meta.url), "utf8");

  assert.equal(packageJson.version, "0.5.10");
  assert.equal(packageJson.main, "dist/electron/main.js");
  assert.match(packageJson.scripts?.["release:windows"] ?? "", /electron-builder --win nsis --x64/);
  assert.equal(packageJson.build?.win?.target, "nsis");
  assert.equal(packageJson.build?.nsis?.oneClick, true);
  assert.equal(packageJson.build?.nsis?.perMachine, false);
  assert.match(html, /id="pair-code"/);
  assert.match(html, /id="agent-error"/);
  assert.match(html, /Never collected/);
  assert.match(renderer, /deriveStatusHealth/);
  assert.match(renderer, /Signal stale/);
  assert.match(renderer, /Last server-confirmed heartbeat/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.match(pairing, /desktop-agent-windows\/0\.5\.10/);
  assert.doesNotMatch(html, /nodeIntegration/);
});

test("runtime startup does not silently preserve stale connected state", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const electronMain = await readFile(new URL("../src/electron/main.ts", import.meta.url), "utf8");

  assert.match(runtime, /state: "offline"/);
  assert.doesNotMatch(runtime, /this\.status = \{ state: "connected"/);
  assert.doesNotMatch(electronMain, /\.catch\(\(\) => undefined\)/);
  assert.match(electronMain, /safeRuntimeError/);
  assert.match(electronMain, /stopLegacyNodeAgents/);
  assert.match(electronMain, /Get-CimInstance Win32_Process/);
  assert.match(electronMain, /run-workmap-agent/);
  assert.match(electronMain, /\$shellPid = \$PID/);
});

test("pairing errors are safe and actionable", () => {
  assert.equal(
    safePairingError(new Error("WorkMap API /device-client/pair returned 401.")),
    "This pairing code is invalid, expired, or already used. Generate a new code in WorkMap.",
  );
  assert(!safePairingError(new Error("credential wmdev_secret")).includes("wmdev_secret"));
});
