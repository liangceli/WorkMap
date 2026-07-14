import { exchangePairingCode } from "./extensionApi.js";
import { ensureDomainContentScriptRegistered } from "./contentRegistration.js";
import { readStoredState, savePairedConfig, writeStoredState } from "./extensionStorage.js";

declare const chrome: {
  permissions: { request(permissions: { origins: string[] }, callback: (allowed: boolean) => void): void };
  runtime: { sendMessage(message: Record<string, unknown>, callback?: () => void): void; lastError?: unknown };
};

const form = document.querySelector<HTMLFormElement>("#pair-form")!;
const apiInput = document.querySelector<HTMLInputElement>("#api-url")!;
const codeInput = document.querySelector<HTMLInputElement>("#pairing-code")!;
const browserSelect = document.querySelector<HTMLSelectElement>("#browser-name")!;
const pairButton = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
const message = document.querySelector<HTMLElement>("#message")!;
const status = document.querySelector<HTMLElement>("#status")!;
const FRESH_HEARTBEAT_MS = 30_000;
const SIGNAL_LOST_MS = 90_000;
const PERMISSION_TIMEOUT_MS = 15_000;
const DEFAULT_BUTTON_TEXT = pairButton.textContent ?? "Pair extension";

void refreshStatus();
form.addEventListener("submit", (event) => { event.preventDefault(); void pair(); });

async function pair() {
  const apiBaseUrl = apiInput.value.trim().replace(/\/+$/, "");
  const code = codeInput.value.trim();
  if (!isAllowedApiUrl(apiBaseUrl)) return show("Use HTTPS, or localhost for development.", true);
  if (!code) return show("Enter the short-lived pairing code from WorkMap.", true);
  setBusy(true, "Requesting permission...");
  try {
    showProgress("Requesting Edge website tracking permission...");
    if (!await requestTrackingPermission(apiBaseUrl)) throw new Error("Website tracking permission was not granted.");
    setBusy(true, "Registering tracker...");
    showProgress("Registering WorkMap domain tracker in Edge...");
    await ensureDomainContentScriptRegistered(true);
    await writeStoredState({ workmapStatus: { state: "pairing", queuedEvents: 0, queuedStatusEvents: 0 } });
    await refreshStatus();
    setBusy(true, "Pairing with WorkMap...");
    showProgress("Pairing with WorkMap API...");
    const result = await exchangePairingCode(apiBaseUrl, code, browserSelect.value);
    await savePairedConfig({ apiBaseUrl, credential: result.credential, deviceId: result.device.id, browserName: browserSelect.value });
    await writeStoredState({
      workmapStatus: { state: "offline", queuedEvents: 0, queuedStatusEvents: 0 },
      workmapTracker: { version: 3, activeByTab: {}, openTabs: {}, runtimeByDomain: {}, focusedWindowId: null },
      workmapQueue: [],
      workmapStatusQueue: [],
    });
    chrome.runtime.sendMessage({ type: "workmap:extension-paired" }, () => void chrome.runtime.lastError);
    codeInput.value = "";
    show("Paired. Domain tracking will start while the browser is active.", false);
    await refreshStatus();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Pairing failed.";
    await writeStoredState({ workmapStatus: { state: "unpaired", queuedEvents: 0, queuedStatusEvents: 0, error: messageText } });
    await refreshStatus();
    show(messageText, true);
  }
  finally { setBusy(false); }
}

async function refreshStatus() {
  const stored = await readStoredState(["workmapConfig", "workmapStatus"]);
  apiInput.value = stored.workmapConfig?.apiBaseUrl ?? "https://workmap-api.onrender.com";
  browserSelect.value = stored.workmapConfig?.browserName ?? inferBrowser();
  const current = stored.workmapStatus;
  const health = deriveStatusHealth(current);
  status.textContent = stored.workmapConfig
    ? `Paired | ${health.label} | activity queued ${current?.queuedEvents ?? 0} | status queued ${current?.queuedStatusEvents ?? 0} | heartbeat ${formatTime(current?.lastHeartbeatAt)} | upload ${formatTime(current?.lastUploadAt)}${health.detail ? ` | ${health.detail}` : ""}${current?.error ? ` | ${current.error}` : ""}`
    : current
      ? `${health.label}${current.error ? ` | ${current.error}` : ""}`
      : "Not paired";
}

function deriveStatusHealth(current: Awaited<ReturnType<typeof readStoredState>>["workmapStatus"]) {
  if (!current) return { label: "Not connected", detail: "Waiting for the first server-confirmed heartbeat." };
  if (current.state === "auth_required") return { label: "Pair again" };
  if (current.state === "error") return { label: "Needs attention" };
  if (current.state === "pairing") return { label: "Pairing" };
  if (current.state === "unpaired") return { label: "Not paired" };
  if (current.state !== "connected") return { label: "Not connected" };

  const heartbeatAge = ageMs(current.lastHeartbeatAt);
  if (heartbeatAge === null) return { label: "Not connected", detail: "Waiting for the first server-confirmed heartbeat." };
  if (heartbeatAge <= FRESH_HEARTBEAT_MS) return { label: "Connected" };
  const detail = `Last server-confirmed heartbeat was ${formatTime(current.lastHeartbeatAt)}. The extension is retrying until WorkMap confirms a fresh heartbeat.`;
  return { label: heartbeatAge <= SIGNAL_LOST_MS ? "Signal stale" : "Not connected", detail };
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
