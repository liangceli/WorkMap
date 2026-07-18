import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseWindowsActivityHostLine } from "../src/windowsActivityHost.js";

test("accepts privacy-minimized native activity events", () => {
  const event = parseWindowsActivityHostLine(JSON.stringify({
    protocolVersion: 1,
    eventType: "foreground_changed",
    monotonicMs: 1234,
    app: { subjectKey: "app:abc", displayName: "Code" },
  }));
  assert.deepEqual(event, {
    protocolVersion: 1,
    eventType: "foreground_changed",
    monotonicMs: 1234,
    app: { subjectKey: "app:abc", displayName: "Code" },
  });
});

test("rejects native payloads containing an invalid app identity", () => {
  assert.equal(parseWindowsActivityHostLine(JSON.stringify({
    protocolVersion: 1,
    eventType: "foreground_changed",
    monotonicMs: 1234,
    app: { subjectKey: "bad", displayName: "" },
  })), null);
});

test("compiled helper source never reads titles, keys, clipboard or screen content", async () => {
  const source = await readFile(
    new URL("../native/windows-activity-host/Program.cs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /GetWindowText|GetAsyncKeyState|clipboard|screenshot|BitBlt/i);
  assert.match(source, /SetWinEventHook/);
  assert.match(source, /GetLastInputInfo/);
  assert.match(source, /WTSRegisterSessionNotification/);
});
