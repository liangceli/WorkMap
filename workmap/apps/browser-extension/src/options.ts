import { exchangePairingCode } from "./extensionApi.js";
import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import {
  readStoredState,
  resolveStoredConfig,
  savePairedConfig,
  writeStoredState,
} from "./extensionStorage.js";
import { normalizeExcludedHostnames } from "./hostnameExclusions.js";
import {
  collectorStatusLabel,
  deriveStatusHealth,
  type BrowserConnectionPresentation,
} from "./optionsDiagnostics.js";
import { BrowserTrackingV2Store } from "./trackingV2Store.js";
import {
  BROWSER_EXTENSION_VERSION,
  type BrowserTrackingRuntimeStateV2,
  type BrowserV2QueueStats,
} from "./trackingV2Types.js";

declare const chrome: {
  permissions: { request(permissions: { origins: string[] }, callback: (allowed: boolean) => void): void };
  runtime: {
    sendMessage(
      message: Record<string, unknown>,
      callback?: (response?: { ok?: boolean; error?: string }) => void,
    ): void;
    getManifest(): { version: string };
    lastError?: unknown;
  };
};

const form = document.querySelector<HTMLFormElement>("#pair-form")!;
const apiInput = document.querySelector<HTMLInputElement>("#api-url")!;
const codeInput = document.querySelector<HTMLInputElement>("#pairing-code")!;
const browserSelect = document.querySelector<HTMLSelectElement>("#browser-name")!;
const exclusionsInput =
  document.querySelector<HTMLTextAreaElement>("#excluded-hostnames")!;
const saveExclusionsButton =
  document.querySelector<HTMLButtonElement>("#save-exclusions")!;
const pairButton = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
const message = document.querySelector<HTMLElement>("#message")!;
const status = document.querySelector<HTMLElement>("#status")!;
const diagnostics = document.querySelector<HTMLElement>("#diagnostics")!;
const trackingStore = new BrowserTrackingV2Store();
const SIGNAL_LOST_MS = 90_000;
const PERMISSION_TIMEOUT_MS = 15_000;
const PAIRING_INITIALIZATION_TIMEOUT_MS = 60_000;
const DEFAULT_BUTTON_TEXT = pairButton.textContent ?? "Pair extension";

void refreshStatus();
setInterval(() => void refreshDiagnostics(), 5_000);
form.addEventListener("submit", (event) => { event.preventDefault(); void pair(); });
saveExclusionsButton.addEventListener("click", () => {
  void saveExclusions();
});

async function pair() {
  const apiBaseUrl = apiInput.value.trim().replace(/\/+$/, "");
  const code = codeInput.value.trim();
  if (!isAllowedApiUrl(apiBaseUrl)) return show("Use HTTPS, or localhost for development.", true);
  if (!code) return show("Enter the short-lived pairing code from WorkMap.", true);
  let paired = false;
  setBusy(true, "Requesting permission...");
  try {
    showProgress("Requesting Edge website tracking permission...");
    if (!await requestTrackingPermission(apiBaseUrl)) throw new Error("Website tracking permission was not granted.");
    setBusy(true, "Registering tracker...");
    showProgress("Registering WorkMap domain tracker in Edge...");
    if (!await ensureDomainContentScriptRegistered(true)) {
      throw new Error("Website tracking permission is required. Open edge://extensions, allow WorkMap website access, then try again.");
    }
    await writeStoredState({ workmapStatus: { state: "pairing", queuedEvents: 0, queuedStatusEvents: 0 } });
    await refreshStatus();
    setBusy(true, "Pairing with WorkMap...");
    showProgress("Pairing with WorkMap API...");
    const result = await exchangePairingCode(apiBaseUrl, code, browserSelect.value);
    await savePairedConfig({
      apiBaseUrl,
      credential: result.credential,
      deviceId: result.device.id,
      browserName: browserSelect.value,
      excludedHostnames: normalizeExcludedHostnames(
        exclusionsInput.value,
      ),
    });
    paired = true;
    await writeStoredState({
      workmapStatus: { state: "offline", queuedEvents: 0, queuedStatusEvents: 0 },
      workmapTracker: { version: 4, activeByTab: {}, openTabs: {}, runtimeByDomain: {}, focusedWindowId: null, systemIdle: false },
      workmapQueue: [],
      workmapStatusQueue: [],
    });
    await trackingStore.close();
    setBusy(true, "Starting tracker...");
    showProgress("Starting WorkMap Tracking v2...");
    await notifyBackgroundPaired();
    codeInput.value = "";
    show("Paired and initialized. Domain tracking will run while the browser is active.", false);
    await refreshStatus();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Pairing failed.";
    await writeStoredState({
      workmapStatus: {
        state: paired ? "offline" : "unpaired",
        queuedEvents: 0,
        queuedStatusEvents: 0,
        error: messageText,
      },
    });
    await refreshStatus();
    show(messageText, true);
  }
  finally { setBusy(false); }
}

function notifyBackgroundPaired() {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "workmap:extension-paired" },
        (response) => {
          const runtimeError = chrome.runtime.lastError as
            | { message?: string }
            | undefined;
          if (runtimeError) {
            reject(
              new Error(
                runtimeError.message ??
                  "The WorkMap background worker did not receive the pairing update.",
              ),
            );
          } else if (!response?.ok) {
            reject(
              new Error(
                response?.error ??
                  "The WorkMap background worker could not initialize tracking.",
              ),
            );
          } else {
            resolve();
          }
        },
      );
    }),
    "The device paired, but Tracking v2 initialization is still pending. Keep the extension enabled; it will retry automatically.",
    PAIRING_INITIALIZATION_TIMEOUT_MS,
  );
}

async function refreshStatus() {
  const stored = await readStoredState(["workmapConfig", "workmapStatus"]);
  apiInput.value = stored.workmapConfig?.apiBaseUrl ?? "https://workmap-api.onrender.com";
  browserSelect.value = stored.workmapConfig?.browserName ?? inferBrowser();
  exclusionsInput.value = (
    stored.workmapConfig?.excludedHostnames ?? []
  ).join("\n");
  saveExclusionsButton.disabled = !stored.workmapConfig;
  await renderStoredDiagnostics(stored);
}

async function refreshDiagnostics() {
  const stored = await readStoredState(["workmapConfig", "workmapStatus"]);
  await renderStoredDiagnostics(stored);
}

async function renderStoredDiagnostics(
  stored: Awaited<ReturnType<typeof readStoredState>>,
) {
  const current = stored.workmapStatus;
  const health = deriveStatusHealth(current);
  const runtime = stored.workmapConfig
    ? await trackingStore.readRuntimeState().catch(() => null)
    : null;
  const queue = runtime
    ? await trackingStore.stats().catch(() => null)
    : null;
  status.textContent = stored.workmapConfig
    ? `Paired | ${health.label} | v2 pending ${queue?.pending ?? 0} | dead-letter ${queue?.deadLetter ?? 0} | heartbeat ${formatTime(current?.lastHeartbeatAt)} | sync ${formatTime(current?.lastUploadAt)}${health.detail ? ` | ${health.detail}` : ""}${current?.error ? ` | ${current.error}` : ""}`
    : current
      ? `${health.label}${current.error ? ` | ${current.error}` : ""}`
      : "Not paired";
  renderDiagnostics(stored.workmapConfig, current, runtime, queue, health);
}

function renderDiagnostics(
  config: Awaited<ReturnType<typeof readStoredState>>["workmapConfig"],
  current: Awaited<ReturnType<typeof readStoredState>>["workmapStatus"],
  runtime: BrowserTrackingRuntimeStateV2 | null,
  queue: BrowserV2QueueStats | null,
  connection: BrowserConnectionPresentation,
) {
  const title = element("h2", "Tracking diagnostics");
  if (!config || !runtime) {
    diagnostics.replaceChildren(
      title,
      element(
        "p",
        "Pair the extension to view server-confirmed connection, Domain snapshot, interval ledger, queue, policy, and coverage status.",
      ),
    );
    return;
  }

  const policy = runtime.policy;
  const snapshot = runtime.snapshotConfirmation;
  const snapshotAge = ageMs(snapshot.observedAt ?? undefined);
  const snapshotState =
    (snapshot.state === "LOCAL_PENDING" || snapshot.state === "CONFIRMED") &&
    snapshotAge !== null &&
    snapshotAge > SIGNAL_LOST_MS
      ? "STALE"
      : snapshot.state;
  const currentDomain =
    runtime.latestSnapshot?.state !== "NONE"
      ? runtime.latestSnapshot?.displayName ?? runtime.latestSnapshot?.subjectKey
      : null;
  const interval = runtime.lastIntervalUpload;
  const cards: Array<[string, string, string?]> = [
    ["Extension / Browser", `${BROWSER_EXTENSION_VERSION} / ${config.browserName} (manifest ${chrome.runtime.getManifest().version})`],
    ["Pairing / Device", `Paired / ${config.deviceId}`],
    ["Connection", connection.label, connection.detail],
    ["Last secure heartbeat", formatTime(runtime.lastSuccessfulHeartbeatAt ?? undefined)],
    [
      "Current Domain snapshot",
      `${snapshotState}${currentDomain ? ` / ${currentDomain}` : ""}`,
      snapshot.rejectionCode
        ? `${snapshot.rejectionCode}${snapshot.requestId ? ` / request ${snapshot.requestId}` : ""}`
        : snapshot.state === "NONE"
          ? "Open and interact with a focused HTTP/HTTPS page. Extension pages and protected browser pages are intentionally not tracked."
          : undefined,
    ],
    ["Snapshot observed / confirmed", `${formatTime(snapshot.observedAt ?? undefined)} / ${formatTime(snapshot.confirmedAt ?? undefined)}`],
    [
      "Last interval upload",
      interval
        ? `${interval.status} (${interval.accepted} accepted, ${interval.duplicate} duplicate, ${interval.rejected} rejected)`
        : "No interval result",
      interval
        ? `${formatTime(interval.occurredAt)} / request ${interval.requestId}`
        : undefined,
    ],
    ["Confirmed interval through", formatTime(runtime.confirmedIntervalThrough ?? undefined)],
    ["Queue pending / ready / dead-letter", `${queue?.pending ?? 0} / ${queue?.ready ?? 0} / ${queue?.deadLetter ?? 0}`],
    ["Dead-letter codes", formatCodeCounts(queue?.deadLetterByCode ?? {})],
    ["Last confirmed sync", formatTime(runtime.lastSuccessfulSyncAt ?? undefined)],
    ["Last request ID", runtime.lastRequestId ?? "None"],
    ["Policy version", policy?.policyVersion ?? "Unavailable"],
    ["Domain Focus", policy?.collectDomainFocus ? "Enabled" : "Disabled"],
    [
      "Domain open/runtime",
      policy?.collectDomainOpenRuntime ? "Enabled" : "Disabled",
      policy?.collectDomainOpenRuntime
        ? "Counts eligible HTTP/HTTPS hostname time while at least one matching tab remains open. Same-host tabs are de-duplicated; this is context, not Focus or work time."
        : "Disabled by the Browser-specific policy. The Desktop App runtime flag is not reused.",
    ],
    ["Acknowledgement", policy?.acknowledgementState ?? "Unavailable", formatTime(policy?.acknowledgedAt ?? undefined)],
    ["Schedule", policy ? `${policy.scheduleTimeZone ?? "Timezone required"} / ${policy.workdayStart}-${policy.workdayEnd}` : "Unavailable"],
    ["Allowed UTC windows", policy?.allowedUtcWindows.length ? policy.allowedUtcWindows.map((window) => `${window.startsAt} to ${window.endsAt}`).join("; ") : "None"],
    ["Policy lease", policy?.policyLeaseId ?? "None", `${formatTime(policy?.policyLeaseIssuedAt ?? undefined)} to ${formatTime(policy?.policyLeaseExpiresAt ?? undefined)}`],
    ["Host permission", runtime.trackingAccess.hostPermission],
    ["Content-script registration", runtime.trackingAccess.contentRegistration, runtime.trackingAccess.error ?? undefined],
    ["Collector", collectorStatusLabel(current)],
  ];
  const grid = element("div");
  grid.className = "diagnostic-grid";
  for (const [label, value, detail] of cards) {
    const item = element("div");
    item.className = "diagnostic-item";
    item.append(element("small", label), element("strong", value));
    if (detail) item.append(element("span", detail));
    grid.append(item);
  }

  const historyTitle = element("h3", "Historical rejected / network diagnostics");
  const history = element("ul");
  history.className = "diagnostic-list";
  const recent = [...runtime.diagnostics].reverse().slice(0, 12);
  if (recent.length === 0) {
    history.append(element("li", "No retained diagnostics."));
  } else {
    for (const item of recent) {
      const row = element(
        "li",
        `${item.stage} / ${item.outcome} / ${item.code} x${item.count}`,
      );
      row.append(
        element(
          "small",
          `${formatTime(item.occurredAt)}${item.requestId ? ` / request ${item.requestId}` : ""} / ${item.remediation}`,
        ),
      );
      history.append(row);
    }
  }

  const limitationsTitle = element("h3", "Coverage limitations");
  const limitations = element("ul");
  limitations.className = "diagnostic-list";
  for (const limitation of runtime.coverageLimitations) {
    limitations.append(element("li", limitation));
  }
  diagnostics.replaceChildren(
    title,
    grid,
    historyTitle,
    history,
    limitationsTitle,
    limitations,
  );
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatCodeCounts(value: Record<string, number>) {
  const entries = Object.entries(value).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  return entries.length
    ? entries.map(([code, count]) => `${code} ${count}`).join(", ")
    : "None";
}

async function saveExclusions() {
  const stored = await readStoredState(["workmapConfig"]);
  const config = await resolveStoredConfig(stored.workmapConfig);
  if (!config) {
    show("Pair the extension before saving exclusions.", true);
    return;
  }
  await savePairedConfig({
    ...config,
    excludedHostnames: normalizeExcludedHostnames(
      exclusionsInput.value,
    ),
  });
  chrome.runtime.sendMessage(
    { type: "workmap:exclusions-updated" },
    () => void chrome.runtime.lastError,
  );
  show("Sensitive hostname exclusions saved on this device.", false);
}

function ageMs(value: string | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Date.now() - time;
}

function formatTime(value: string | undefined) {
  if (!value) return "pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "pending";
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString([], sameDay
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function show(value: string, error: boolean) { message.textContent = value; message.dataset.error = String(error); }
function showProgress(value: string) {
  status.textContent = value;
  show(value, false);
}
function setBusy(value: boolean, label = DEFAULT_BUTTON_TEXT) {
  for (const element of Array.from(form.elements)) (element as HTMLInputElement).disabled = value;
  pairButton.textContent = value ? label : DEFAULT_BUTTON_TEXT;
}
function isAllowedApiUrl(value: string) { return /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value); }
function inferBrowser() { return navigator.userAgent.includes("Edg/") ? "EDGE" : "CHROME"; }

async function requestTrackingPermission(apiBaseUrl: string) {
  const origin = `${new URL(apiBaseUrl).origin}/*`;
  return withTimeout(
    new Promise<boolean>((resolve, reject) => {
      chrome.permissions.request({ origins: Array.from(new Set([origin, "https://*/*", "http://*/*"])) }, (allowed) => {
        const error = chrome.runtime.lastError as { message?: string } | undefined;
        if (error) reject(new Error(error.message ?? "Website tracking permission request failed."));
        else resolve(allowed);
      });
    }),
    "Edge did not finish the website tracking permission request. Open edge://extensions, keep WorkMap enabled, allow website access, reload this Options page, and try again.",
    PERMISSION_TIMEOUT_MS,
  );
}

function withTimeout<T>(promise: Promise<T>, messageText: string, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(messageText)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
