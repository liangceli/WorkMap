import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  parseWindowsActivityHostLine,
  WindowsActivityHostAdapterV2,
} from "../src/windowsActivityHost.js";

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

test("accepts a de-duplicated privacy-minimized visible App set", () => {
  const event = parseWindowsActivityHostLine(JSON.stringify({
    protocolVersion: 1,
    eventType: "visible_apps_changed",
    monotonicMs: 2_000,
    apps: [
      { subjectKey: "app:codex", displayName: "Codex" },
      { subjectKey: "app:teams", displayName: "Microsoft Teams" },
    ],
  }));
  assert.equal(event?.eventType, "visible_apps_changed");
  assert.equal(event?.eventType === "visible_apps_changed" ? event.apps.length : 0, 2);
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
  assert.match(source, /InteractionPulseMinIntervalMs = 1_000/);
  assert.match(source, /pendingInputPulseMonotonicMs/);
  assert.match(source, /monotonicMs = observedInputMonotonicMs/);
  assert.match(source, /EnumWindows/);
  assert.match(source, /IsWindowVisible/);
  assert.match(source, /IsIconic/);
  assert.match(source, /visible_apps_changed/);
  assert.doesNotMatch(source, /MainWindowTitle/);
});

test("native host exit is bounded, restarted once, and healthy recovery resets backoff", () => {
  const children: ChildProcessWithoutNullStreams[] = [];
  const scheduled: Array<{ callback: () => void; delayMs: number; timer: NodeJS.Timeout }> = [];
  const cancelled = new Set<NodeJS.Timeout>();
  const events: ReturnType<typeof parseWindowsActivityHostLine>[] = [];
  const adapter = new WindowsActivityHostAdapterV2("C:\\test\\native-host.exe", false, {
    platform: "win32",
    executableExists: () => true,
    spawnHost: () => {
      const child = fakeChildProcess();
      children.push(child);
      return child;
    },
    restartDelaysMs: [1_000, 3_000, 10_000],
    scheduleRestart: (callback, delayMs) => {
      const timer = { id: scheduled.length + 1 } as unknown as NodeJS.Timeout;
      scheduled.push({ callback, delayMs, timer });
      return timer;
    },
    cancelRestart: (timer) => {
      cancelled.add(timer);
    },
  });

  adapter.start((event) => events.push(event));
  adapter.start((event) => events.push(event));
  assert.equal(children.length, 1, "start must never create duplicate helpers");

  children[0]!.stderr.emit(
    "data",
    "The application to execute does not exist: native-host.dll",
  );
  children[0]!.emit("exit", -2_147_450_726, null);
  assert.equal(events.at(-1)?.eventType, "health");
  assert.equal(
    events.at(-1)?.eventType === "health" ? events.at(-1)?.errorCode : null,
    "HOST_PROCESS_EXITED",
  );
  assert.equal(
    events.at(-1)?.eventType === "health" ? events.at(-1)?.detail : null,
    "NativeHostDependencyMissing",
  );
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]!.delayMs, 1_000);

  scheduled.shift()!.callback();
  assert.equal(children.length, 2);
  const eventCountBeforeStaleOutput = events.length;
  children[0]!.stdout.emit("data", `${JSON.stringify({
    protocolVersion: 1,
    eventType: "health",
    monotonicMs: 1_500,
    state: "HEALTHY",
    errorCode: "NONE",
  })}\n`);
  assert.equal(
    events.length,
    eventCountBeforeStaleOutput,
    "a replaced helper cannot mutate the current timeline",
  );
  children[1]!.stdout.emit("data", `${JSON.stringify({
    protocolVersion: 1,
    eventType: "health",
    monotonicMs: 2_000,
    state: "HEALTHY",
    adapterVersion: "1.1.1",
    errorCode: "NONE",
  })}\n`);
  assert.equal(
    events.at(-1)?.eventType === "health" ? events.at(-1)?.state : null,
    "HEALTHY",
  );

  children[1]!.emit("exit", 1, null);
  assert.equal(scheduled.length, 1);
  assert.equal(
    scheduled[0]!.delayMs,
    1_000,
    "a healthy helper resets the retry backoff",
  );

  const pendingRestart = scheduled[0]!;
  adapter.stop();
  assert(cancelled.has(pendingRestart.timer));
  pendingRestart.callback();
  assert.equal(children.length, 2, "stop cancels any pending helper restart");
});

test("native host build cleans stale output and smoke-tests the single executable", async () => {
  const buildScript = await readFile(
    new URL("../scripts/build-native-host.mjs", import.meta.url),
    "utf8",
  );
  assert.match(buildScript, /rm\(output, \{ recursive: true, force: true \}\)/);
  assert.match(buildScript, /PublishSingleFile=true/);
  assert.match(buildScript, /outputEntries\.length !== 1/);
  assert.match(buildScript, /smokeTestNativeHost\(executable\)/);
  assert.match(buildScript, /event\.state === "HEALTHY"/);
  assert.match(buildScript, /observedEventTypes\.has\("foreground_changed"\)/);
  assert.match(buildScript, /observedEventTypes\.has\("visible_apps_changed"\)/);
});

function fakeChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter & { setEncoding: (encoding: string) => void };
    stderr: EventEmitter & { setEncoding: (encoding: string) => void };
    stdin: EventEmitter;
    killed: boolean;
    kill: () => boolean;
  };
  child.stdout = Object.assign(new EventEmitter(), {
    setEncoding: () => undefined,
  });
  child.stderr = Object.assign(new EventEmitter(), {
    setEncoding: () => undefined,
  });
  child.stdin = new EventEmitter();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    return true;
  };
  return child as unknown as ChildProcessWithoutNullStreams;
}
