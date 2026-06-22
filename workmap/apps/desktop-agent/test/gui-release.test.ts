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
  const preload = await readFile(new URL("../renderer/preload.cjs", import.meta.url), "utf8");

  assert.equal(packageJson.main, "dist/electron/main.js");
  assert.match(packageJson.scripts?.["release:windows"] ?? "", /electron-builder --win nsis --x64/);
  assert.equal(packageJson.build?.win?.target, "nsis");
  assert.equal(packageJson.build?.nsis?.oneClick, true);
  assert.equal(packageJson.build?.nsis?.perMachine, false);
  assert.match(html, /id="pair-code"/);
  assert.match(html, /Never collected/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(html, /nodeIntegration/);
});

test("pairing errors are safe and actionable", () => {
  assert.equal(
    safePairingError(new Error("WorkMap API /device-client/pair returned 401.")),
    "This pairing code is invalid, expired, or already used. Generate a new code in WorkMap.",
  );
  assert(!safePairingError(new Error("credential wmdev_secret")).includes("wmdev_secret"));
});
