import { exchangePairingCode } from "./extensionApi.js";
import { readStoredState, writeStoredState } from "./extensionStorage.js";

declare const chrome: {
  permissions: { request(permissions: { origins: string[] }, callback: (allowed: boolean) => void): void };
};

const form = document.querySelector<HTMLFormElement>("#pair-form")!;
const apiInput = document.querySelector<HTMLInputElement>("#api-url")!;
const codeInput = document.querySelector<HTMLInputElement>("#pairing-code")!;
const browserSelect = document.querySelector<HTMLSelectElement>("#browser-name")!;
const message = document.querySelector<HTMLElement>("#message")!;
const status = document.querySelector<HTMLElement>("#status")!;

void refreshStatus();
form.addEventListener("submit", (event) => { event.preventDefault(); void pair(); });

async function pair() {
  const apiBaseUrl = apiInput.value.trim().replace(/\/+$/, "");
  const code = codeInput.value.trim();
  if (!isAllowedApiUrl(apiBaseUrl)) return show("Use HTTPS, or localhost for development.", true);
  if (!code) return show("Enter the short-lived pairing code from WorkMap.", true);
  setDisabled(true);
  try {
    if (!await requestApiPermission(apiBaseUrl)) throw new Error("API origin permission was not granted.");
    await writeStoredState({ workmapStatus: { state: "pairing", queuedEvents: 0 } });
    await refreshStatus();
    const result = await exchangePairingCode(apiBaseUrl, code, browserSelect.value);
    await writeStoredState({
      workmapConfig: { apiBaseUrl, credential: result.credential, deviceId: result.device.id, browserName: browserSelect.value },
      workmapStatus: { state: "connected", queuedEvents: 0 },
      workmapTracker: { active: null },
      workmapQueue: [],
    });
    codeInput.value = "";
    show("Paired. Domain tracking will start while the browser is active.", false);
    await refreshStatus();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Pairing failed.";
    await writeStoredState({ workmapStatus: { state: "unpaired", queuedEvents: 0, error: messageText } });
    show(messageText, true);
  }
  finally { setDisabled(false); }
}

async function refreshStatus() {
  const stored = await readStoredState(["workmapConfig", "workmapStatus"]);
  apiInput.value = stored.workmapConfig?.apiBaseUrl ?? "https://workmap-api.onrender.com";
  browserSelect.value = stored.workmapConfig?.browserName ?? inferBrowser();
  const current = stored.workmapStatus;
  status.textContent = stored.workmapConfig
    ? `Paired | ${current?.state ?? "connected"} | queued ${current?.queuedEvents ?? 0} | heartbeat ${current?.lastHeartbeatAt ?? "pending"} | upload ${current?.lastUploadAt ?? "pending"}`
    : "Not paired";
}

function show(value: string, error: boolean) { message.textContent = value; message.dataset.error = String(error); }
function setDisabled(value: boolean) { for (const element of Array.from(form.elements)) (element as HTMLInputElement).disabled = value; }
function isAllowedApiUrl(value: string) { return /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value); }
function inferBrowser() { return navigator.userAgent.includes("Edg/") ? "EDGE" : "CHROME"; }

async function requestApiPermission(apiBaseUrl: string) {
  const origin = `${new URL(apiBaseUrl).origin}/*`;
  return new Promise<boolean>((resolve) => chrome.permissions.request({ origins: [origin] }, resolve));
}
