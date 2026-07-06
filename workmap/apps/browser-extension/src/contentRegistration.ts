const CONTENT_SCRIPT_ID = "workmap-domain-activity";
const CONTENT_SCRIPT_FILE = "dist/contentScript.js";
const TRACKED_ORIGINS = ["https://*/*", "http://*/*"];

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
  return new Promise<boolean>((resolve) => chrome.permissions.contains({ origins: TRACKED_ORIGINS }, resolve));
}

function getRegisteredScripts() {
  return new Promise<RegisteredContentScript[]>((resolve, reject) => {
    chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] }, (scripts) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message ?? "Unable to inspect registered content scripts."));
      else resolve(scripts);
    });
  });
}

function callbackPromise(invoke: (done: () => void) => void) {
  return new Promise<void>((resolve, reject) => invoke(() => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message ?? "Unable to register the WorkMap content script."));
    else resolve();
  }));
}

async function injectCurrentWebTabs() {
  const tabs = await new Promise<Array<{ id?: number; url?: string }>>((resolve) => chrome.tabs.query({}, resolve));
  await Promise.all(tabs.flatMap((tab) => {
    if (tab.id === undefined || !/^https?:\/\//i.test(tab.url ?? "")) return [];
    return [new Promise<void>((resolve) => {
      chrome.scripting.executeScript({ target: { tabId: tab.id!, allFrames: true }, files: [CONTENT_SCRIPT_FILE] }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    })];
  }));
}
