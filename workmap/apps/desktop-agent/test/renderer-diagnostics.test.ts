import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

test("the UI recognizes the same background login item that the Agent registers", async () => {
  const source = await readFile(new URL("../src/electron/main.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) &&
    ["getUiState", "configureAutoStart"].includes(node.name?.text ?? "")).map((node) => node.getText(ast)).join("\n");
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let registeredArgs: string[] = [];
  let enabled = false;
  const context = createContext({
    app: {
      isPackaged: true,
      setLoginItemSettings: (options: { openAtLogin: boolean; args: string[] }) => {
        enabled = options.openAtLogin;
        registeredArgs = options.args;
      },
      getLoginItemSettings: (options?: { args: string[] }) => ({
        openAtLogin: enabled && JSON.stringify(options?.args ?? []) === JSON.stringify(registeredArgs),
      }),
      getVersion: () => "test",
    },
    safelyLoadAgentConfig: async () => ({ deviceId: "test-device" }),
    paired: true,
    runtime: { getUiStatus: () => ({ state: "connected", queuedEvents: 0 }) },
    runtimePromise: null,
  });
  runInContext(compiled, context);
  runInContext("configureAutoStart()", context);
  const state = await runInContext("getUiState()", context);
  assert.equal(state.startsWithWindows, true, "an installed --background login item must display Enabled");
  enabled = false;
  assert.equal((await runInContext("getUiState()", context)).startsWithWindows, false);
});

class Element {
  textContent = "";
  hidden = false;
  open = false;
  children: Element[] = [];
  addEventListener() {}
  querySelector() { return new Element(); }
  replaceChildren() { this.children = []; }
  append(...children: Element[]) { this.children.push(...children); }
}

async function renderFailure(failure: Record<string, unknown>) {
  const source = await readFile(new URL("../renderer/app.js", import.meta.url), "utf8");
  const elements = new Map<string, Element>();
  const document = {
    querySelector(selector: string) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector)!;
    },
    createElement: () => new Element(),
  };
  const context = createContext({
    document, setInterval: () => 0,
    window: { workmapAgent: {
      onPairProgress: () => undefined,
      getState: async () => ({ paired: true, startsWithWindows: true, deviceId: "test-device", version: "test", status: { state: "offline", queuedEvents: 0 } }),
      getDiagnostics: async () => ({
        connection: { state: "OFFLINE", lastSuccessfulHeartbeatAt: null },
        snapshot: null, intervalUpload: null, lastSuccessfulSyncAt: null, lastSyncDiagnostic: null,
        queue: { pending: 1, deadLetter: 0, deadLetterByCode: [] },
        policy: { leasePresent: false, allowedUtcWindows: [] }, logDirectory: "test-log-directory",
        recentSyncFailures: [{ attemptedAt: "2026-01-01T00:00:00Z", completedAt: null, requestId: null,
          httpStatus: null, errorCode: null, failureStage: null, errorMessage: null, remediation: null, retryable: null, ...failure }],
      }),
    } },
  });
  runInContext(source, context);
  await runInContext("refreshDiagnostics(true)", context);
  return elements.get("#diagnostics-error-list")!.children[0]!.children;
}

test("a network failure without server text is not presented as a historical rejection", async () => {
  const rows = await renderFailure({ errorCode: "NETWORK_ERROR", retryable: true });
  assert.match(rows[1]!.textContent, /network|connection|HTTP response/i);
  assert.doesNotMatch(rows[1]!.textContent, /historical rejection/i);
  assert.equal(rows.at(-1)!.textContent, "Automatic retry: yes");
});

test("an older failure without an HTTP response does not invent a server rejection", async () => {
  const rows = await renderFailure({});
  assert.match(rows[1]!.textContent, /HTTP response|connection/i);
  assert.doesNotMatch(rows[1]!.textContent, /historical rejection/i);
});

test("an explicit server message and retry instructions remain unchanged", async () => {
  const rows = await renderFailure({ httpStatus: 503, errorCode: "SERVER_UNAVAILABLE", errorMessage: "Service temporarily unavailable.", remediation: "The Agent will retry.", retryable: true });
  assert.equal(rows[1]!.textContent, "Service temporarily unavailable.");
  assert.equal(rows[3]!.textContent, "What happens next: The Agent will retry.");
});

test("a retained HTTP rejection still explains missing legacy detail", async () => {
  const rows = await renderFailure({ httpStatus: 400, errorCode: "POLICY_REJECTED", retryable: false });
  assert.match(rows[1]!.textContent, /Historical rejection/);
  assert.equal(rows.at(-1)!.textContent, "Automatic retry: no");
});
