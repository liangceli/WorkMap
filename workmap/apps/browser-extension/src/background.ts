import { createDomainUsageEvent, readDomainFromUrl, type DomainSession } from "./domainTracking";

type ChromeTab = {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
};

type ChromeStorageValues = Record<string, string | undefined>;

type ChromeApi = {
  runtime: {
    onInstalled: { addListener(listener: () => void): void };
  };
  tabs: {
    onActivated: { addListener(listener: (activeInfo: { tabId: number }) => void): void };
    onUpdated: { addListener(listener: (tabId: number, changeInfo: { url?: string }, tab: ChromeTab) => void): void };
    get(tabId: number, callback: (tab: ChromeTab) => void): void;
    query(queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: ChromeTab[]) => void): void;
  };
  windows: {
    WINDOW_ID_NONE: number;
    onFocusChanged: { addListener(listener: (windowId: number) => void): void };
  };
  storage: {
    local: {
      get(keys: string[], callback: (items: ChromeStorageValues) => void): void;
      set(items: ChromeStorageValues, callback?: () => void): void;
    };
  };
};

declare const chrome: ChromeApi;

type ExtensionConfig = {
  apiBaseUrl: string;
  token: string;
  deviceId?: string;
  browserName: string;
};

const FLUSH_INTERVAL_MS = 60000;
const EXTENSION_VERSION = "browser-extension-mv3/0.1.0";
const STORAGE_KEYS = ["workmapApiBaseUrl", "workmapAuthToken", "workmapDeviceId", "workmapBrowserName"];

let currentSession: DomainSession | null = null;
let browserFocused = true;

chrome.runtime.onInstalled.addListener(() => {
  console.info("WorkMap domain tracking harness installed. Configure API URL/token in chrome.storage.local.");
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void switchToTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    void switchToTab(tabId);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  browserFocused = windowId !== chrome.windows.WINDOW_ID_NONE;

  if (!browserFocused) {
    void flushCurrentSession();
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs[0]?.id;
    if (activeTabId !== undefined) {
      void switchToTab(activeTabId);
    }
  });
});

setInterval(() => {
  void flushCurrentSession(true);
}, FLUSH_INTERVAL_MS);

async function switchToTab(tabId: number) {
  await flushCurrentSession();

  if (!browserFocused) {
    return;
  }

  chrome.tabs.get(tabId, (tab) => {
    const domain = readDomainFromUrl(tab.url);

    if (!domain) {
      currentSession = null;
      return;
    }

    currentSession = {
      domain,
      startedAt: Date.now(),
    };
  });
}

async function flushCurrentSession(continueSession = false) {
  if (!currentSession) {
    return;
  }

  const session = currentSession;
  const endedAtMs = Date.now();

  if (continueSession) {
    currentSession = {
      ...session,
      startedAt: endedAtMs,
    };
  } else {
    currentSession = null;
  }

  const config = await readConfig();
  if (!config) {
    return;
  }

  const deviceId = await ensureDevice(config);
  const event = createDomainUsageEvent(session, endedAtMs, deviceId, config.browserName);

  if (!event) {
    return;
  }

  await postJson(config, "/activity/domain-usage", event);
}

async function ensureDevice(config: ExtensionConfig) {
  if (config.deviceId) {
    return config.deviceId;
  }

  const registration = await postJson<{ device: { id: string } }>(config, "/devices/register", {
    os: "UNKNOWN",
    agentVersion: EXTENSION_VERSION,
  });

  await writeStorage({ workmapDeviceId: registration.device.id });
  return registration.device.id;
}

async function readConfig(): Promise<ExtensionConfig | null> {
  const values = await readStorage(STORAGE_KEYS);
  const apiBaseUrl = values.workmapApiBaseUrl?.trim().replace(/\/+$/, "");
  const token = values.workmapAuthToken?.trim();

  if (!apiBaseUrl || !token) {
    return null;
  }

  return {
    apiBaseUrl,
    token,
    deviceId: values.workmapDeviceId?.trim() || undefined,
    browserName: values.workmapBrowserName?.trim() || "CHROME",
  };
}

async function postJson<T = unknown>(config: ExtensionConfig, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`WorkMap API ${path} returned ${response.status}.`);
  }

  return (await response.json()) as T;
}

function readStorage(keys: string[]) {
  return new Promise<ChromeStorageValues>((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function writeStorage(values: ChromeStorageValues) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}
