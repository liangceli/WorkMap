import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

async function smokeHarness() {
  const source = await readFile(new URL("../scripts/build-native-host.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function smokeTestNativeHost(");
  assert(start >= 0, "native smoke entry point must exist");
  const child = Object.assign(new EventEmitter(), {
    stdout: Object.assign(new EventEmitter(), { setEncoding: () => undefined }),
    stderr: Object.assign(new EventEmitter(), { setEncoding: () => undefined }),
    killed: false,
    kill() { this.killed = true; },
  });
  let expire = () => {};
  let timerCleared = false;
  const context = createContext({
    spawn: () => child,
    setTimeout: (callback: () => void, delay: number) => {
      assert.equal(delay, 5_000, "retain the bounded smoke deadline");
      expire = callback;
      return 1;
    },
    clearTimeout: () => { timerCleared = true; },
  });
  runInContext(source.slice(start), context);
  const outcome = (runInContext('smokeTestNativeHost("fixture.exe")', context) as Promise<void>)
    .then(() => "passed", (error: Error) => error.message);
  return {
    child, outcome,
    send: (event: object) => child.stdout.emit("data", `${JSON.stringify(event)}\n`),
    expire: () => expire(),
    timerCleared: () => timerCleared,
  };
}

const health = { eventType: "health", state: "HEALTHY" };
const foreground = { eventType: "foreground_changed" };
const visible = { eventType: "visible_apps_changed" };
for (const [name, events] of [
  ["health, foreground, visible", [health, foreground, visible]],
  ["health, visible, foreground", [health, visible, foreground]],
  ["foreground, health, visible", [foreground, health, visible]],
  ["visible, health, foreground", [visible, health, foreground]],
  ["foreground, visible, health", [foreground, visible, health]],
  ["visible, foreground, health", [visible, foreground, health]],
] as const) {
  test(`native build smoke accepts complete evidence in order: ${name}`, async () => {
    const h = await smokeHarness();
    for (const event of events) h.send(event);
    h.expire();
    assert.equal(await h.outcome, "passed");
    assert.equal(h.child.killed, true);
    assert.equal(h.timerCleared(), true);
  });
}

test("native build smoke retains LIMITED acceptance and handles chunked output", async () => {
  const h = await smokeHarness();
  h.child.stdout.emit("data", 'not-json\n{"eventType":"health",');
  h.child.stdout.emit("data", '"state":"LIMITED"}\n');
  h.send(foreground);
  h.send(visible);
  h.expire();
  assert.equal(await h.outcome, "passed");
});

for (const [missing, events] of [
  ["health", [foreground, visible]],
  ["foreground", [health, visible]],
  ["visible apps", [health, foreground]],
] as const) {
  test(`native build smoke still times out without ${missing} evidence`, async () => {
    const h = await smokeHarness();
    for (const event of events) h.send(event);
    h.expire();
    assert.match(await h.outcome, /did not report healthy/);
    assert.equal(h.child.killed, true);
  });
}

test("native build smoke does not reuse health superseded by an error", async () => {
  const h = await smokeHarness();
  h.send(health);
  h.send({ eventType: "health", state: "ERROR" });
  h.send(foreground);
  h.send(visible);
  h.expire();
  assert.match(await h.outcome, /did not report healthy/);
});

test("native build smoke retains early-exit and dependency failure diagnostics", async () => {
  const h = await smokeHarness();
  h.child.stderr.emit("data", "The application to execute does not exist: helper.dll");
  h.child.emit("exit", 1);
  assert.match(await h.outcome, /managed dependency was missing/);
  assert.equal(h.timerCleared(), true);
});

test("native build smoke retains spawn failure and cleans up its timer", async () => {
  const h = await smokeHarness();
  h.child.emit("error", new Error("fixture start failed"));
  assert.match(await h.outcome, /smoke start failed: Error/);
  assert.equal(h.timerCleared(), true);
});
