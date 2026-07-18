import assert from "node:assert/strict";
import test from "node:test";
import {
  AppTrackingState,
  recoverTrackingCheckpoint,
  recoverTrackingCheckpointAtProtocolActivation,
  recoverTrackingCheckpoints,
} from "../src/trackingState.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const base = Date.parse("2026-06-18T00:00:00.000Z");

test("tracks app switches, stable durations, idle, resume and shutdown", () => {
  let id = 0;
  const state = new AppTrackingState({ minimumDurationMs: 1_000, createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}` });
  assert.deepEqual(state.observe({ ...sample("Code", 0), openAppNames: ["Code"] }, DEVICE_ID), []);
  assert.deepEqual(state.observe({ ...sample("Code", 5_000), openAppNames: ["Code"] }, DEVICE_ID), []);
  const switched = state.observe({ ...sample("Outlook", 10_000), openAppNames: ["Outlook"] }, DEVICE_ID);
  assert.equal(switched[0]?.appName, "Code");
  assert.equal(switched[0]?.durationSeconds, 10);
  const idleStarted = state.observe({ ...sample("Outlook", 15_000), openAppNames: ["Outlook"], isIdle: true }, DEVICE_ID);
  assert.equal(idleStarted[0]?.appName, "Outlook");
  assert.equal(idleStarted[0]?.durationSeconds, 5);
  assert.equal(idleStarted[0]?.isIdle, false);
  const runtimeRolled = state.observe({ ...sample("Outlook", 20_000), openAppNames: ["Outlook"], isIdle: true }, DEVICE_ID);
  assert.deepEqual(runtimeRolled.map((event) => [event.appName, event.isActiveWindow, event.durationSeconds]), [["Outlook", false, 10]]);
  const resumed = state.observe(sample("Outlook", 25_000), DEVICE_ID);
  assert.equal(resumed[0]?.durationSeconds, 10);
  assert.equal(resumed[0]?.isIdle, true);
  const locked = state.observe({ ...sample("Outlook", 30_000), isLocked: true }, DEVICE_ID);
  assert.equal(locked[0]?.durationSeconds, 5);
  assert.equal(locked[0]?.isIdle, false);
  assert.deepEqual(state.observe(sample("Teams", 35_000), DEVICE_ID), []);
  const shutdown = state.shutdown(DEVICE_ID, base + 40_000);
  assert.equal(shutdown[0]?.appName, "Teams");
  assert.equal(shutdown[0]?.durationSeconds, 5);
});

test("filters short/no-window segments, duplicate samples and caps delayed samples", () => {
  const state = new AppTrackingState({ minimumDurationMs: 5_000, maximumSampleGapMs: 10_000, createEventId: () => "00000000-0000-4000-8000-000000000001" });
  state.observe(sample("A", 0), DEVICE_ID);
  assert.deepEqual(state.observe(sample("B", 2_000), DEVICE_ID), []);
  assert.deepEqual(state.observe(sample("B", 2_000), DEVICE_ID), []);
  state.observe(sample("B", 7_000), DEVICE_ID);
  const delayed = state.observe(sample("C", 60_000), DEVICE_ID);
  assert.equal(delayed[0]?.durationSeconds, 15);
  assert.deepEqual(state.observe(sample(null, 61_000), DEVICE_ID), []);
});

test("exposes live foreground duration and recovers a persisted segment after an unclean stop", () => {
  const state = new AppTrackingState();
  state.observe(sample("Visual Studio Code", 0), DEVICE_ID);
  state.observe(sample("Visual Studio Code", 7_000), DEVICE_ID);
  assert.equal(state.currentActivity()?.activeSeconds, 7);
  const recovered = recoverTrackingCheckpoint(state.checkpoint(), DEVICE_ID, {
    createEventId: () => "00000000-0000-4000-8000-000000000009",
  });
  assert.equal(recovered?.appName, "Visual Studio Code");
  assert.equal(recovered?.durationSeconds, 7);
});

test("rolls a foreground segment at the UTC day boundary for complete daily reporting", () => {
  const state = new AppTrackingState({ createEventId: () => "00000000-0000-4000-8000-000000000010" });
  state.observe({ ...sample("Outlook", 0), observedAtMs: Date.parse("2026-06-18T23:59:50.000Z") }, DEVICE_ID);
  const rolled = state.observe({ ...sample("Outlook", 0), observedAtMs: Date.parse("2026-06-19T00:00:01.000Z") }, DEVICE_ID);
  assert.equal(rolled[0]?.durationSeconds, 11);
  assert.equal(state.currentActivity()?.startedAt, "2026-06-19T00:00:01.000Z");
});

test("tracks open runtime separately from focused active time", () => {
  let id = 20;
  const state = new AppTrackingState({
    minimumDurationMs: 1_000,
    runtimeSegmentMs: 10_000,
    focusSegmentMs: 60_000,
    createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  state.observe({ ...sample("App A", 0), openAppNames: ["App A", "App B"] }, DEVICE_ID);
  state.observe({ ...sample("App A", 5_000), openAppNames: ["App A", "App B"] }, DEVICE_ID);
  const events = state.observe({ ...sample("App A", 10_000), openAppNames: ["App A", "App B"] }, DEVICE_ID);
  assert.deepEqual(events.map((event) => [event.appName, event.isActiveWindow, event.durationSeconds]), [
    ["App A", false, 10],
    ["App B", false, 10],
  ]);
  assert.equal(state.currentActivity()?.activeSeconds, 10);
});

test("persists a continuing focus-active app in bounded intervals", () => {
  let id = 25;
  const state = new AppTrackingState({
    minimumDurationMs: 1_000,
    focusSegmentMs: 10_000,
    createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });

  state.observe(sample("Codex", 0), DEVICE_ID);
  const first = state.observe(sample("Codex", 10_000), DEVICE_ID);
  const second = state.observe(sample("Codex", 20_000), DEVICE_ID);
  const shutdown = state.shutdown(DEVICE_ID, base + 25_000);

  assert.deepEqual(first.filter((event) => event.isActiveWindow).map((event) => [event.appName, event.durationSeconds]), [["Codex", 10]]);
  assert.deepEqual(second.filter((event) => event.isActiveWindow).map((event) => [event.appName, event.durationSeconds]), [["Codex", 10]]);
  assert.deepEqual(shutdown.filter((event) => event.isActiveWindow).map((event) => [event.appName, event.durationSeconds]), [["Codex", 5]]);
});

test("uses the exact 30-second idle boundary and exact resume input time", () => {
  let id = 30;
  const state = new AppTrackingState({
    createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  state.observe({ ...sample("Weixin", 0), lastInputAtMs: base }, DEVICE_ID);
  const firstFocusSlice = state.observe({ ...sample("Weixin", 10_000), lastInputAtMs: base }, DEVICE_ID);
  const secondFocusSlice = state.observe({ ...sample("Weixin", 20_000), lastInputAtMs: base }, DEVICE_ID);
  state.observe({ ...sample("Weixin", 29_800), lastInputAtMs: base }, DEVICE_ID);

  const becameIdle = state.observe({
    ...sample("Weixin", 30_400),
    isIdle: true,
    lastInputAtMs: base,
    idleStartedAtMs: base + 30_000,
  }, DEVICE_ID);
  const focusedBeforeIdle = [...firstFocusSlice, ...secondFocusSlice, ...becameIdle]
    .filter((event) => event.isActiveWindow && !event.isIdle);
  assert.equal(focusedBeforeIdle.reduce((total, event) => total + event.durationSeconds, 0), 30);
  assert.equal(focusedBeforeIdle.at(-1)?.endedAt, "2026-06-18T00:00:30.000Z");
  assert.equal(state.currentActivity()?.startedAt, "2026-06-18T00:00:30.000Z");
  assert.equal(state.currentActivity()?.isIdle, true);

  const resumed = state.observe({
    ...sample("Weixin", 35_500),
    lastInputAtMs: base + 35_250,
  }, DEVICE_ID);
  assert.equal(resumed[0]?.isIdle, true);
  assert.equal(resumed[0]?.endedAt, "2026-06-18T00:00:35.250Z");
  assert.equal(state.currentActivity()?.startedAt, "2026-06-18T00:00:35.250Z");
  assert.equal(state.currentActivity()?.isIdle, false);
});

test("keeps recent cross-application collaboration bounded by the input grace period", () => {
  let id = 50;
  const state = new AppTrackingState({
    createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  state.observe({ ...sample("Visual Studio Code", 0), lastInputAtMs: base }, DEVICE_ID);
  const switched = state.observe({ ...sample("Microsoft Teams", 10_000), lastInputAtMs: base + 10_000 }, DEVICE_ID);

  const expired = state.observe({ ...sample("Microsoft Teams", 31_000), lastInputAtMs: base + 10_000 }, DEVICE_ID);
  const codeSeconds = [...switched, ...expired]
    .filter((event) => event.appName === "Visual Studio Code" && event.isActiveWindow && !event.isIdle)
    .reduce((total, event) => total + event.durationSeconds, 0);
  assert.equal(codeSeconds, 30);
  assert.equal(state.currentActivity()?.appName, "Microsoft Teams");
  assert.equal(state.currentActivity()?.activeSeconds, 0);

  const finished = state.shutdown(DEVICE_ID, base + 41_000);
  const teamsSeconds = [...switched, ...expired, ...finished]
    .filter((event) => event.appName === "Microsoft Teams" && event.isActiveWindow && !event.isIdle)
    .reduce((total, event) => total + event.durationSeconds, 0);
  assert.equal(teamsSeconds, 30);
});

test("crash recovery preserves every persisted focus-active segment without duplication", () => {
  const state = new AppTrackingState();
  state.observe({ ...sample("Code", 0), lastInputAtMs: base }, DEVICE_ID);
  const firstPersisted = state.observe({ ...sample("Teams", 10_000), lastInputAtMs: base + 10_000 }, DEVICE_ID);
  const secondPersisted = state.observe({ ...sample("Teams", 21_000), lastInputAtMs: base + 10_000 }, DEVICE_ID);

  const checkpoint = state.checkpoint();
  const recovered = recoverTrackingCheckpoints(checkpoint, DEVICE_ID, {
    createEventId: (() => {
      let id = 60;
      return () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
    })(),
  });

  const persisted = [...firstPersisted, ...secondPersisted]
    .filter((event) => event.isActiveWindow && !event.isIdle)
    .reduce<Record<string, number>>((totals, event) => ({ ...totals, [event.appName]: (totals[event.appName] ?? 0) + event.durationSeconds }), {});
  assert.deepEqual(persisted, { Code: 21, Teams: 11 });
  assert.deepEqual(recovered, []);
  assert.equal(recoverTrackingCheckpoint(checkpoint, DEVICE_ID), null);
});

test("protocol activation recovery clips every legacy tail to the server boundary", () => {
  let id = 70;
  const protocolActivatedAt = new Date(base + 60_000).toISOString();
  const recovered = recoverTrackingCheckpointAtProtocolActivation(
    {
      appName: "Code",
      isIdle: false,
      startedAtMs: base,
      lastObservedAtMs: base + 90_000,
      lastInputAtMs: base + 90_000,
      focusSegments: [
        {
          appName: "Code",
          startedAtMs: base,
          lastObservedAtMs: base + 90_000,
          lastInputAtMs: base + 90_000,
        },
        {
          appName: "Teams",
          startedAtMs: base + 45_000,
          lastObservedAtMs: base + 120_000,
          lastInputAtMs: base + 120_000,
        },
      ],
    },
    DEVICE_ID,
    protocolActivatedAt,
    {
      createEventId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    },
  );

  assert.deepEqual(
    recovered.map((event) => [event.appName, event.durationSeconds, event.endedAt]),
    [
      ["Code", 60, protocolActivatedAt],
      ["Teams", 15, protocolActivatedAt],
    ],
  );
});

test("protocol activation recovery never creates legacy time after the boundary", () => {
  const recovered = recoverTrackingCheckpointAtProtocolActivation(
    {
      appName: "Code",
      isIdle: false,
      startedAtMs: base + 61_000,
      lastObservedAtMs: base + 90_000,
      lastInputAtMs: base + 90_000,
    },
    DEVICE_ID,
    new Date(base + 60_000).toISOString(),
  );
  assert.deepEqual(recovered, []);
});

test("records detected foreground and open runtime without the old five-second delay", () => {
  const state = new AppTrackingState({
    createEventId: () => "00000000-0000-4000-8000-000000000040",
  });
  state.observe({ ...sample("App A", 0), openAppNames: ["App A"] }, DEVICE_ID);
  const events = state.observe({ ...sample("App B", 1_200), openAppNames: ["App B"] }, DEVICE_ID);
  assert.deepEqual(events.map((event) => [event.appName, event.isActiveWindow, event.durationSeconds]), [
    ["App A", true, 1],
    ["App A", false, 1],
  ]);
});

test("focus-only samples preserve background runtime until the next full open-app scan", () => {
  const state = new AppTrackingState({
    createEventId: () => "00000000-0000-4000-8000-000000000041",
  });
  state.observe({ ...sample("App A", 0), openAppNames: ["App A", "App B"] }, DEVICE_ID);
  assert.deepEqual(state.observe(sample("App A", 500), DEVICE_ID), []);
  const events = state.observe({ ...sample("App A", 1_000), openAppNames: ["App A"] }, DEVICE_ID);
  assert.deepEqual(events.map((event) => [event.appName, event.isActiveWindow, event.durationSeconds]), [
    ["App B", false, 1],
  ]);
});

function sample(appName: string | null, offset: number) {
  return { appName, isIdle: false, isLocked: false, observedAtMs: base + offset };
}
