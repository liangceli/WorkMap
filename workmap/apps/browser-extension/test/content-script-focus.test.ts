import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

type Listener = { callback: () => void; capture: boolean };

async function createPage(isTopFrame = true) {
  const source = await readFile(new URL("../src/contentScript.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const messages: Record<string, unknown>[] = [];
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, () => void>();
  let focused = true;
  const document = {
    visibilityState: "visible",
    hasFocus: () => focused,
    addEventListener(name: string, callback: () => void) {
      documentListeners.set(name, callback);
    },
  };
  const window: Record<string, unknown> = {
    addEventListener(
      name: string,
      callback: () => void,
      options?: boolean | { capture?: boolean },
    ) {
      const capture = typeof options === "boolean" ? options : options?.capture === true;
      windowListeners.set(name, [...(windowListeners.get(name) ?? []), { callback, capture }]);
    },
    clearTimeout() {},
    setTimeout() { return 1; },
  };
  window.top = isTopFrame ? window : {};
  vm.runInContext(compiled, vm.createContext({
    window,
    document,
    Date,
    queueMicrotask(callback: () => void) { callback(); },
    chrome: { runtime: {
      sendMessage(message: Record<string, unknown>, callback?: () => void) {
        messages.push(message);
        callback?.();
      },
      onMessage: { addListener() {} },
    } },
  }));
  messages.length = 0;
  return {
    messages,
    setFocused(value: boolean) { focused = value; },
    visibility(value: string) {
      document.visibilityState = value;
      documentListeners.get("visibilitychange")?.();
    },
    dispatchFocusEvent(name: "blur" | "focus", target: "window" | "control") {
      // Native focus/blur do not bubble: descendant events reach Window only
      // through capturing listeners, while Window's own events reach both.
      for (const listener of windowListeners.get(name) ?? []) {
        if (target === "window" || listener.capture) listener.callback();
      }
    },
  };
}

test("switching between page controls does not end page focus", async () => {
  const page = await createPage();
  page.dispatchFocusEvent("blur", "control");
  page.dispatchFocusEvent("focus", "control");
  assert.equal(page.messages.filter((message) => message.type === "workmap:domain-blur").length, 0);
  assert.equal(page.messages.at(-1)?.type, "workmap:domain-checkpoint");
});

test("leaving a control for nonfocusable page content does not end page focus", async () => {
  const page = await createPage();
  page.dispatchFocusEvent("blur", "control");
  assert.equal(page.messages.length, 0);
});

test("real window blur still ends focus and returning focus checkpoints it", async () => {
  const page = await createPage();
  page.setFocused(false);
  page.dispatchFocusEvent("blur", "window");
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].type, "workmap:domain-blur");
  assert.deepEqual(Object.keys(page.messages[0]).sort(), ["observedAt", "type"]);
  page.setFocused(true);
  page.dispatchFocusEvent("focus", "window");
  assert.equal(page.messages.at(-1)?.type, "workmap:domain-checkpoint");
});

test("hiding a page still ends focus and visibility alone cannot confirm focus", async () => {
  const page = await createPage();
  page.visibility("hidden");
  assert.equal(page.messages.at(-1)?.type, "workmap:domain-blur");
  page.setFocused(false);
  page.visibility("visible");
  assert.equal(page.messages.length, 1);
  page.setFocused(true);
  page.visibility("visible");
  assert.equal(page.messages.at(-1)?.type, "workmap:domain-checkpoint");
});

test("subframe focus changes cannot send a top-level page blur", async () => {
  const page = await createPage(false);
  page.dispatchFocusEvent("blur", "control");
  page.dispatchFocusEvent("blur", "window");
  page.visibility("hidden");
  assert.equal(page.messages.length, 0);
});
