import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompletionPollerScheduler,
  startCompletionPoller,
} from "../components/reports/completionPoller.js";

test("browser timer methods retain their required host binding", async () => {
  const callbacks: Array<() => void> = [];
  const handles = new Set<ReturnType<typeof setTimeout>>();
  type StrictTimerHost = {
    setTimeout(
      this: StrictTimerHost,
      callback: () => void,
      delayMs: number,
    ): ReturnType<typeof setTimeout>;
    clearTimeout(this: StrictTimerHost, handle: ReturnType<typeof setTimeout>): void;
  };
  const timerHost: StrictTimerHost = {
    setTimeout(this: StrictTimerHost, callback: () => void) {
      assert.equal(this, timerHost);
      callbacks.push(callback);
      const handle = callbacks.length as unknown as ReturnType<typeof setTimeout>;
      handles.add(handle);
      return handle;
    },
    clearTimeout(this: StrictTimerHost, handle: ReturnType<typeof setTimeout>) {
      assert.equal(this, timerHost);
      handles.delete(handle);
    },
  };
  const poller = startCompletionPoller(
    async () => undefined,
    15_000,
    createCompletionPollerScheduler(timerHost),
    false,
  );

  assert.equal(callbacks.length, 1);
  callbacks.shift()?.();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(callbacks.length, 1);
  poller.stop();
  assert.equal(handles.size, 0);
});

test("slow report polls never overlap and schedule only after completion", async () => {
  const timers: Array<() => void> = [];
  const scheduler = {
    setTimeout(callback: () => void) {
      timers.push(callback);
      return timers.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout() {},
  };
  let calls = 0;
  let finishFirst: (() => void) | undefined;
  const firstRequest = new Promise<void>((resolve) => { finishFirst = resolve; });
  const poller = startCompletionPoller(async () => {
    calls += 1;
    if (calls === 1) await firstRequest;
  }, 15_000, scheduler);

  assert.equal(calls, 1);
  assert.equal(timers.length, 0);
  poller.trigger();
  assert.equal(calls, 1);

  finishFirst?.();
  await firstRequest;
  await Promise.resolve();
  assert.equal(timers.length, 1);

  timers.shift()?.();
  await Promise.resolve();
  assert.equal(calls, 2);
  poller.stop();
});

test("independent report pollers do not block each other", async () => {
  let finishLive: (() => void) | undefined;
  const liveRequest = new Promise<void>((resolve) => { finishLive = resolve; });
  let auditCalls = 0;
  const scheduler = {
    setTimeout() { return 1 as unknown as ReturnType<typeof setTimeout>; },
    clearTimeout() {},
  };
  const live = startCompletionPoller(() => liveRequest, 15_000, scheduler);
  const audit = startCompletionPoller(async () => { auditCalls += 1; }, 60_000, scheduler);

  await Promise.resolve();
  assert.equal(auditCalls, 1);
  finishLive?.();
  live.stop();
  audit.stop();
});
