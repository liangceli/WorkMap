/* global window, document, setInterval */

const api = window.workmapAgent;
const pairView = document.querySelector("#pair-view");
const connectedView = document.querySelector("#connected-view");
const pairInput = document.querySelector("#pair-code");
const pairButton = document.querySelector("#pair-button");
const pairProgress = document.querySelector("#pair-progress");
const pairError = document.querySelector("#pair-error");
const progressTitle = document.querySelector("#progress-title");
const progressDetail = document.querySelector("#progress-detail");
const statusChip = document.querySelector("#status-chip");
const agentError = document.querySelector("#agent-error");
const FRESH_HEARTBEAT_MS = 30_000;
const STALE_HEARTBEAT_MS = 120_000;

const progressCopy = {
  waking: ["Connecting to WorkMap...", "The service may need up to a minute to wake securely."],
  validating: ["Validating your one-time code...", "Binding this Windows account to your WorkMap employee profile."],
  securing: ["Securing this device...", "Encrypting the device credential with Windows protection."],
};

pairInput.addEventListener("input", () => {
  const value = pairInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
  pairInput.value = value.length > 4 ? `${value.slice(0, 4)}-${value.slice(4)}` : value;
  pairError.hidden = true;
});

pairInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void pair();
});

pairButton.addEventListener("click", () => void pair());
document.querySelector("#hide-button").addEventListener("click", () => api.hide());
document.querySelector("#open-workmap-button").addEventListener("click", () => api.openWorkMap());

api.onPairProgress((stage) => {
  const copy = progressCopy[stage];
  if (!copy) return;
  progressTitle.textContent = copy[0];
  progressDetail.textContent = copy[1];
});

async function pair() {
  if (pairButton.disabled) return;
  pairButton.disabled = true;
  pairInput.disabled = true;
  pairError.hidden = true;
  pairProgress.hidden = false;
  try {
    await api.pair(pairInput.value);
    await refreshState();
  } catch (error) {
    pairError.textContent = cleanIpcError(error);
    pairError.hidden = false;
  } finally {
    pairButton.disabled = false;
    pairInput.disabled = false;
    pairProgress.hidden = true;
  }
}

async function refreshState() {
  const state = await api.getState();
  pairView.hidden = state.paired;
  connectedView.hidden = !state.paired;
  document.querySelector("#page-title").textContent = state.paired ? "This computer is protected" : "Connect this computer";
  document.querySelector("#page-subtitle").textContent = state.paired
    ? "WorkMap is recording privacy-minimized foreground app duration for your own workspace account."
    : "Enter the one-time code shown in your WorkMap device setup page.";
  document.querySelector("#device-label").textContent = state.deviceId ? `Device ${state.deviceId.slice(0, 8)}` : "Not paired";
  document.querySelector("#version-label").textContent = `Version ${state.version}`;

  const status = state.status;
  setStatusChip(status);
  document.querySelector("#current-app").textContent = status.currentActivity?.appName ?? "No active app";
  document.querySelector("#last-heartbeat").textContent = formatTime(status.lastHeartbeatAt);
  document.querySelector("#queued-events").textContent = String(status.queuedEvents ?? 0);
  document.querySelector("#auto-start").textContent = state.startsWithWindows ? "Enabled" : state.paired ? "Enabling..." : "Not enabled";
  const health = deriveStatusHealth(status);
  const errorCopy = status.error || health.detail;
  agentError.textContent = errorCopy;
  agentError.hidden = !errorCopy;
}

function setStatusChip(status) {
  const health = deriveStatusHealth(status);
  const copy = {
    connected: ["Connected", "status-connected"],
    pairing: ["Pairing", "status-warning"],
    offline: ["Offline - retrying", "status-warning"],
    auth_required: ["Pair again", "status-error"],
    error: ["Needs attention", "status-error"],
    unpaired: ["Not connected", "status-neutral"],
    stale: ["Signal stale", "status-warning"],
  }[health.state] ?? ["Checking", "status-neutral"];
  statusChip.className = `status-chip ${copy[1]}`;
  statusChip.querySelector("b").textContent = copy[0];
}

function deriveStatusHealth(status) {
  if (status.state !== "connected") {
    return { state: status.state };
  }

  const heartbeatAge = heartbeatAgeMs(status.lastHeartbeatAt);
  if (heartbeatAge === null) {
    return { state: "offline", detail: "Waiting for the first server-confirmed heartbeat." };
  }

  if (heartbeatAge <= FRESH_HEARTBEAT_MS) {
    return { state: "connected" };
  }

  const detail = `Last server-confirmed heartbeat was ${formatTime(status.lastHeartbeatAt)}. The Agent is retrying until WorkMap confirms a fresh heartbeat.`;
  return { state: heartbeatAge <= STALE_HEARTBEAT_MS ? "stale" : "offline", detail };
}

function heartbeatAgeMs(value) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Date.now() - time;
}

function formatTime(value) {
  if (!value) return "Starting...";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Starting...";
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString([], sameDay
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function cleanIpcError(error) {
  const message = error instanceof Error ? error.message : "Pairing could not be completed.";
  return message.replace(/^Error invoking remote method 'agent:pair': Error: /, "");
}

void refreshState();
setInterval(() => void refreshState(), 2_000);
