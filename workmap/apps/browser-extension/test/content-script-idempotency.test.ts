import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("the content script can execute twice in one document without duplicate listeners", async () => {
  const source = await readFile(new URL("../src/contentScript.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const windowListeners: string[] = [];
  const documentListeners: string[] = [];
  const runtimeListeners: unknown[] = [];
  const sentMessages: unknown[] = [];
  const fakeWindow: Record<string, unknown> = {
    addEventListener(eventName: string) {
      windowListeners.push(eventName);
    },
    clearTimeout() {},
    setTimeout() {
      return 1;
    },
  };
  fakeWindow.top = fakeWindow;

  const context = vm.createContext({
    chrome: {
      runtime: {
        addListener() {},
        onMessage: {
          addListener(listener: unknown) {
            runtimeListeners.push(listener);
          },
        },
        sendMessage(message: unknown, callback?: () => void) {
          sentMessages.push(message);
          callback?.();
        },
      },
    },
    Date,
    document: {
      visibilityState: "visible",
      hasFocus: () => true,
      addEventListener(eventName: string) {
        documentListeners.push(eventName);
      },
    },
    queueMicrotask(callback: () => void) {
      callback();
    },
    window: fakeWindow,
  });

  assert.doesNotThrow(() => vm.runInContext(compiled, context));
  const firstCounts = {
    window: windowListeners.length,
    document: documentListeners.length,
    runtime: runtimeListeners.length,
    messages: sentMessages.length,
  };
  assert.ok(firstCounts.window > 0);
  assert.ok(firstCounts.document > 0);
  assert.ok(firstCounts.runtime > 0);

  assert.doesNotThrow(() => vm.runInContext(compiled, context));
  assert.deepEqual(
    {
      window: windowListeners.length,
      document: documentListeners.length,
      runtime: runtimeListeners.length,
      messages: sentMessages.length,
    },
    firstCounts,
  );
});
