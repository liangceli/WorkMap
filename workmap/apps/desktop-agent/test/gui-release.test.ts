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
  const version = await readFile(new URL("../src/version.ts", import.meta.url), "utf8");
  const electronMain = await readFile(new URL("../src/electron/main.ts", import.meta.url), "utf8");

  assert.equal(packageJson.version, "0.6.12");
  assert.equal(packageJson.main, "dist/electron/main.js");
  assert.match(packageJson.scripts?.["release:windows"] ?? "", /electron-builder --win nsis --x64/);
  assert.equal(packageJson.build?.win?.target, "nsis");
  assert.equal(packageJson.build?.nsis?.oneClick, true);
  assert.equal(packageJson.build?.nsis?.perMachine, false);
  assert.match(html, /id="pair-code"/);
  assert.match(html, /id="agent-error"/);
  assert.match(html, /id="legacy-backlog"/);
  assert.match(html, /id="diagnostics-connection"/);
  assert.match(html, /id="diagnostics-snapshot"/);
  assert.match(html, /id="diagnostics-interval-upload"/);
  assert.match(html, /id="diagnostics-policy-window"/);
  assert.match(html, /Historical rejected \/ network diagnostics/);
  assert.match(html, /Never collected/);
  assert.match(renderer, /deriveStatusHealth/);
  assert.match(renderer, /heartbeatAgeMs\(status\.lastHeartbeatAt, status\.serverOffsetMs\)/);
  assert.match(renderer, /Date\.now\(\) \+ \(Number\.isFinite\(offset\) \? offset : 0\)/);
  assert.match(renderer, /Signal stale/);
  assert.match(renderer, /Last server-confirmed heartbeat/);
  assert.match(renderer, /Legacy compatibility backlog/);
  assert.match(renderer, /server-confirmed health/);
  assert.match(renderer, /intervalUpload\.accepted/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.match(version, /desktop-agent-windows\/0\.6\.12/);
  assert.match(electronMain, /DesktopAgentRuntimeV2/);
  assert.match(electronMain, /RuntimeStartupRetrier/);
  assert.match(electronMain, /activity is not collected until startup succeeds/);
  assert.match(electronMain, /runtime\?\.getUiStatus\(\)/);
  assert.match(
    JSON.stringify(packageJson),
    /native\/windows-activity-host\/publish\/workmap-windows-activity-host\.exe/,
  );
  assert.doesNotMatch(html, /nodeIntegration/);
});

test("runtime startup does not silently preserve stale connected state", async () => {
  const runtime = await readFile(new URL("../src/runtimeV2.ts", import.meta.url), "utf8");
  const electronMain = await readFile(new URL("../src/electron/main.ts", import.meta.url), "utf8");

  assert.match(runtime, /connectionState: TrackingConnectionStateV2 = "OFFLINE"/);
  assert.doesNotMatch(runtime, /connectionState: TrackingConnectionStateV2 = "ONLINE"/);
  assert.doesNotMatch(electronMain, /\.catch\(\(\) => undefined\)/);
  assert.match(electronMain, /safeRuntimeError/);
  assert.match(electronMain, /stopLegacyNodeAgents/);
  assert.match(electronMain, /Get-CimInstance Win32_Process/);
  assert.match(electronMain, /run-workmap-agent/);
  assert.match(electronMain, /\$shellPid = \$PID/);
  assert.match(runtime, /queuePending: stats\.pending/);
  assert.match(runtime, /queuedEvents: input\.queuePending/);
  assert.match(runtime, /queuedLegacyEvents: this\.legacyQueue\.size\(\)/);
  assert.match(
    runtime,
    /shouldImmediatelySyncHostEventV2\(event\.eventType\)/,
  );
});

test("pairing errors are safe and actionable", () => {
  assert.equal(
    safePairingError(new Error("WorkMap API /device-client/pair returned 401.")),
    "This pairing code is invalid, expired, or already used. Generate a new code in WorkMap.",
  );
  assert(!safePairingError(new Error("credential wmdev_secret")).includes("wmdev_secret"));
});
