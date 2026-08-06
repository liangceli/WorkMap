const CONTENT_SCRIPT_ID = "workmap-domain-activity";
const CONTENT_SCRIPT_FILE = "dist/contentScript.js";
const TRACKED_ORIGINS = ["https://*/*", "http://*/*"];
const EXTENSION_API_TIMEOUT_MS = 15_000;
const TAB_INJECTION_TIMEOUT_MS = 5_000;

type RegisteredContentScript = { id: string };

declare const chrome: {
  runtime: { lastError?: { message?: string } };
  permissions: { contains(permissions: { origins: string[] }, callback: (allowed: boolean) => void): void };
  scripting: {
    getRegisteredContentScripts(filter: { ids: string[] }, callback: (scripts: RegisteredContentScript[]) => void): void;
    registerContentScripts(scripts: Array<Record<string, unknown>>, callback: () => void): void;
    updateContentScripts(scripts: Array<Record<string, unknown>>, callback: () => void): void;
    executeScript(injection: { target: { tabId: number; allFrames: boolean }; files: string[] }, callback: () => void): void;
  };
  tabs: { query(query: Record<string, unknown>, callback: (tabs: Array<{ id?: number; url?: string }>) => void): void };
};

export async function ensureDomainContentScriptRegistered(injectExistingTabs = false) {
  if (!await hasTrackingOrigins()) return false;
  const definition = {
    id: CONTENT_SCRIPT_ID,
    js: [CONTENT_SCRIPT_FILE],
    matches: TRACKED_ORIGINS,
    allFrames: true,
    runAt: "document_start",
    persistAcrossSessions: true,
  };
  const registered = await getRegisteredScripts();
  await callbackPromise((done) => registered.length > 0
    ? chrome.scripting.updateContentScripts([definition], done)
    : chrome.scripting.registerContentScripts([definition], done));
  if (injectExistingTabs) await injectCurrentWebTabs();
  return true;
}

function hasTrackingOrigins() {
  return callbackWithTimeout<boolean>(
    (resolve) => chrome.permissions.contains({ origins: TRACKED_ORIGINS }, resolve),
    "Timed out checking CandidGrid website tracking permission.",
  );
}

function getRegisteredScripts() {
  return callbackWithTimeout<RegisteredContentScript[]>((resolve, reject) => {
    chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] }, (scripts) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Unable to inspect registered content scripts."));
      else resolve(scripts);
    });
  }, "Timed out checking registered CandidGrid content scripts.");
}

function callbackPromise(invoke: (done: () => void) => void) {
  return callbackWithTimeout<void>((resolve, reject) => invoke(() => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message ?? "Unable to register the CandidGrid content script."));
    else resolve();
  }), "Timed out registering the CandidGrid content script.");
}

async function injectCurrentWebTabs() {
  const tabs = await callbackWithTimeout<Array<{ id?: number; url?: string }>>(
    (resolve) => chrome.tabs.query({}, resolve),
    "Timed out reading current browser tabs.",
  );
  await Promise.allSettled(tabs.flatMap((tab) => {
    if (tab.id === undefined || !/^https?:\/\//i.test(tab.url ?? "")) return [];
    return [callbackWithTimeout<void>((resolve) => {
      chrome.scripting.executeScript({ target: { tabId: tab.id!, allFrames: true }, files: [CONTENT_SCRIPT_FILE] }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    }, "Timed out injecting CandidGrid into an existing tab.", TAB_INJECTION_TIMEOUT_MS)];
  }));
}

function callbackWithTimeout<T>(
  invoke: (resolve: (value: T) => void, reject: (error: Error) => void) => void,
  timeoutMessage: string,
  timeoutMs = EXTENSION_API_TIMEOUT_MS,
) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback();
    };
    try {
      invoke(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error("CandidGrid browser extension API call failed.")));
    }
  });
}
