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
  setStatusChip(status.state);
  document.querySelector("#current-app").textContent = status.currentActivity?.appName ?? "No active app";
  document.querySelector("#last-heartbeat").textContent = formatTime(status.lastHeartbeatAt);
  document.querySelector("#queued-events").textContent = String(status.queuedEvents ?? 0);
  document.querySelector("#auto-start").textContent = state.startsWithWindows ? "Enabled" : state.paired ? "Enabling..." : "Not enabled";
}

function setStatusChip(state) {
  const copy = {
    connected: ["Connected", "status-connected"],
    pairing: ["Pairing", "status-warning"],
    offline: ["Offline - retrying", "status-warning"],
    auth_required: ["Pair again", "status-error"],
    error: ["Needs attention", "status-error"],
    unpaired: ["Not connected", "status-neutral"],
  }[state] ?? ["Checking", "status-neutral"];
  statusChip.className = `status-chip ${copy[1]}`;
  statusChip.querySelector("b").textContent = copy[0];
}

function formatTime(value) {
  if (!value) return "Starting...";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Starting..." : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function cleanIpcError(error) {
  const message = error instanceof Error ? error.message : "Pairing could not be completed.";
  return message.replace(/^Error invoking remote method 'agent:pair': Error: /, "");
}

void refreshState();
setInterval(() => void refreshState(), 2_000);
