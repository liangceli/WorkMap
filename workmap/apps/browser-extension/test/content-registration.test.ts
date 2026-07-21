import assert from "node:assert/strict";
import test from "node:test";
import { ensureDomainContentScriptRegistered } from "../src/contentRegistration.js";

type GlobalWithChrome = typeof globalThis & { chrome?: unknown };

test("host permission denial prevents registration and a later grant recovers", async () => {
  const target = globalThis as GlobalWithChrome;
  const original = target.chrome;
  let granted = false;
  let registrationCalls = 0;
  const runtime: { lastError?: { message?: string } } = {};
  target.chrome = {
    runtime,
    permissions: {
      contains(
        _permissions: { origins: string[] },
        callback: (allowed: boolean) => void,
      ) {
        callback(granted);
      },
    },
    scripting: {
      getRegisteredContentScripts(
        _filter: { ids: string[] },
        callback: (scripts: unknown[]) => void,
      ) {
        callback([]);
      },
      registerContentScripts(
        scripts: Array<Record<string, unknown>>,
        callback: () => void,
      ) {
        registrationCalls += 1;
        assert.equal(scripts[0]?.allFrames, true);
        callback();
      },
      updateContentScripts(
        _scripts: Array<Record<string, unknown>>,
        callback: () => void,
      ) {
        callback();
      },
      executeScript(
        _input: Record<string, unknown>,
        callback: () => void,
      ) {
        callback();
      },
    },
    tabs: {
      query(
        _query: Record<string, unknown>,
        callback: (tabs: unknown[]) => void,
      ) {
        callback([]);
      },
    },
  };

  try {
    assert.equal(await ensureDomainContentScriptRegistered(true), false);
    assert.equal(registrationCalls, 0);
    granted = true;
    assert.equal(await ensureDomainContentScriptRegistered(true), true);
    assert.equal(registrationCalls, 1);
  } finally {
    target.chrome = original;
  }
});

test("registration failure is surfaced and a clean retry succeeds", async () => {
  const target = globalThis as GlobalWithChrome;
  const original = target.chrome;
  let failRegistration = true;
  const runtime: { lastError?: { message?: string } } = {};
  target.chrome = {
    runtime,
    permissions: {
      contains(
        _permissions: { origins: string[] },
        callback: (allowed: boolean) => void,
      ) {
        callback(true);
      },
    },
    scripting: {
      getRegisteredContentScripts(
        _filter: { ids: string[] },
        callback: (scripts: unknown[]) => void,
      ) {
        callback([]);
      },
      registerContentScripts(
        _scripts: Array<Record<string, unknown>>,
        callback: () => void,
      ) {
        runtime.lastError = failRegistration
          ? { message: "registration blocked" }
          : undefined;
        callback();
        runtime.lastError = undefined;
      },
      updateContentScripts(
        _scripts: Array<Record<string, unknown>>,
        callback: () => void,
      ) {
        callback();
      },
      executeScript(
        _input: Record<string, unknown>,
        callback: () => void,
      ) {
        callback();
      },
    },
    tabs: {
      query(
        _query: Record<string, unknown>,
        callback: (tabs: unknown[]) => void,
      ) {
        callback([]);
      },
    },
  };

  try {
    await assert.rejects(
      () => ensureDomainContentScriptRegistered(true),
      /registration blocked/,
    );
    failRegistration = false;
    assert.equal(await ensureDomainContentScriptRegistered(true), true);
  } finally {
    target.chrome = original;
  }
});
