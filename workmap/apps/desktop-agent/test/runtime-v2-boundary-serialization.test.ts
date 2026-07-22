import assert from "node:assert/strict";
import test from "node:test";
import { DesktopAgentRuntimeV2 } from "../src/runtimeV2.js";
import { createInitialDesktopTrackingV2State } from "../src/trackingV2Store.js";

test("0.6.7 runtime state upgrades with empty non-regressing watermarks", () => {
  const legacyState = createInitialDesktopTrackingV2State() as Partial<
    ReturnType<typeof createInitialDesktopTrackingV2State>
  >;
  delete legacyState.focusTimelineThroughAt;
  delete legacyState.openRuntimeTimelineThroughAt;
  const runtime = new DesktopAgentRuntimeV2(
    {
      apiBaseUrl: "https://workmap.invalid",
      credential: "test-only-credential",
      deviceId: "device-1",
      agentVersion: "desktop-agent-windows/test",
    },
    {
      store: {
        readRuntimeState: () => legacyState,
      } as never,
    },
  );
  const state = (runtime as unknown as {
    state: ReturnType<typeof createInitialDesktopTrackingV2State>;
  }).state;

  assert.equal(state.focusTimelineThroughAt, null);
  assert.equal(state.openRuntimeTimelineThroughAt, null);
});

test("Electron power boundaries wait for the existing native mutation lane", async () => {
  const runtime = new DesktopAgentRuntimeV2(
    {
      apiBaseUrl: "https://workmap.invalid",
      credential: "test-only-credential",
      deviceId: "device-1",
      agentVersion: "desktop-agent-windows/test",
    },
    {
      store: {
        readRuntimeState: () => null,
      } as never,
    },
  );
  const events: string[] = [];
  let releaseNativeMutation!: () => void;
  const nativeMutation = new Promise<void>((resolve) => {
    releaseNativeMutation = resolve;
  }).then(() => {
    events.push("native-finished");
  });
  const internals = runtime as unknown as {
    eventChain: Promise<void>;
    enqueueHostBoundary: () => Promise<void>;
    enqueueLifecycle: () => Promise<void>;
    flushStatusQueue: () => Promise<void>;
  };
  internals.eventChain = nativeMutation;
  internals.enqueueHostBoundary = async () => {
    events.push("electron-boundary");
  };
  internals.enqueueLifecycle = async () => {
    events.push("lifecycle");
  };
  internals.flushStatusQueue = async () => {
    events.push("status-flush");
  };

  const report = runtime.reportDeviceStatus("LOCKED", "SYSTEM_LOCK");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, []);

  releaseNativeMutation();
  await report;
  assert.deepEqual(events, [
    "native-finished",
    "electron-boundary",
    "lifecycle",
    "status-flush",
  ]);
});
