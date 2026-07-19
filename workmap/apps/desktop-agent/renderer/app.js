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
const diagnosticsPanel = document.querySelector("#diagnostics-panel");
const diagnosticsResult = document.querySelector("#diagnostics-result");
const FRESH_HEARTBEAT_MS = 30_000;
const STALE_HEARTBEAT_MS = 120_000;
let lastDiagnosticsRefreshAt = 0;

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
diagnosticsPanel.addEventListener("toggle", () => {
  if (diagnosticsPanel.open) void refreshDiagnostics(true);
});
document.querySelector("#open-diagnostics-folder").addEventListener("click", async () => {
  diagnosticsResult.textContent = "";
  const error = await api.openDiagnosticsFolder();
  diagnosticsResult.textContent = error || "Opened the local diagnostics folder.";
});
document.querySelector("#export-diagnostics").addEventListener("click", async () => {
  diagnosticsResult.textContent = "Preparing redacted diagnostics...";
  try {
    const result = await api.exportDiagnostics();
    diagnosticsResult.textContent = result.canceled
      ? "Export cancelled."
      : `Saved redacted diagnostics to ${result.path}`;
  } catch (error) {
    diagnosticsResult.textContent = cleanIpcError(error, "Diagnostics could not be exported.");
  }
});

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
  setAgentHealthCopy(status);
  document.querySelector("#current-app").textContent = status.currentActivity?.appName ?? "No active app";
  document.querySelector("#last-heartbeat").textContent = formatTime(status.lastHeartbeatAt);
  document.querySelector("#queued-events").textContent = String((status.queuedEvents ?? 0) + (status.queuedStatusEvents ?? 0));
  setLegacyBacklog(status);
  document.querySelector("#auto-start").textContent = state.startsWithWindows ? "Enabled" : state.paired ? "Enabling..." : "Not enabled";
  const health = deriveStatusHealth(status);
  const errorCopy = status.error || health.detail;
  agentError.textContent = errorCopy;
  agentError.hidden = !errorCopy;
  if (diagnosticsPanel.open) await refreshDiagnostics(false);
}

async function refreshDiagnostics(force) {
  const now = Date.now();
  if (!force && now - lastDiagnosticsRefreshAt < 5_000) return;
  const diagnostics = await api.getDiagnostics();
  if (!diagnostics) return;
  lastDiagnosticsRefreshAt = now;
  document.querySelector("#diagnostics-last-sync").textContent = formatTime(diagnostics.lastSuccessfulSyncAt);
  document.querySelector("#diagnostics-request-id").textContent = diagnostics.lastSyncDiagnostic?.requestId ?? "Not available";
  document.querySelector("#diagnostics-queue").textContent = `${diagnostics.queue.pending} pending / ${diagnostics.queue.deadLetter} rejected`;
  document.querySelector("#diagnostics-policy").textContent = diagnostics.policy.leasePresent
    ? `${diagnostics.policy.version ?? "Unknown version"} - expires ${formatDateTime(diagnostics.policy.leaseExpiresAt)}`
    : "No active lease";
  document.querySelector("#diagnostics-log-path").textContent = diagnostics.logDirectory;

  const list = document.querySelector("#diagnostics-error-list");
  list.replaceChildren();
  const failures = diagnostics.recentSyncFailures.slice(0, 10);
  if (failures.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No recent sync errors.";
    list.append(item);
    return;
  }
  for (const failure of failures) {
    const item = document.createElement("li");
    item.className = "diagnostic-error";
    const heading = document.createElement("strong");
    const code = failure.errorCode || failure.failureStage || "SYNC_FAILED";
    const status = failure.httpStatus ? `HTTP ${failure.httpStatus}` : "No HTTP response";
    const stage = failure.failureStage ? ` / ${failure.failureStage}` : "";
    heading.textContent = `${formatDateTime(failure.completedAt ?? failure.attemptedAt)} - ${status} / ${code}${stage}`;
    const reason = document.createElement("span");
    reason.className = "diagnostic-error-reason";
    reason.textContent = failure.errorMessage
      ?? "Historical rejection: the Agent version that recorded this request did not save a detailed server reason.";
    const request = document.createElement("code");
    request.textContent = `Request ID: ${failure.requestId ?? "Not available"}`;
    item.append(heading, reason, request);
    if (failure.remediation) {
      const remediation = document.createElement("span");
      remediation.className = "diagnostic-error-remediation";
      remediation.textContent = `What happens next: ${failure.remediation}`;
      item.append(remediation);
    }
    if (failure.retryable !== null && failure.retryable !== undefined) {
      const retry = document.createElement("span");
      retry.className = "diagnostic-error-retry";
      retry.textContent = failure.retryable ? "Automatic retry: yes" : "Automatic retry: no";
      item.append(retry);
    }
    list.append(item);
  }
}

function setLegacyBacklog(status) {
  const element = document.querySelector("#legacy-backlog");
  const count = Number(status.queuedLegacyEvents ?? 0);
  if (!Number.isFinite(count) || count <= 0) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const migration = status.trackingMigrationState === "DRAINING_V1"
    ? "WorkMap is preserving and retrying these historical records through the v1 compatibility path."
    : "WorkMap is retaining these historical records until their compatibility migration is complete.";
  element.textContent = `Legacy compatibility backlog: ${count.toLocaleString()} historical record${count === 1 ? "" : "s"}. ${migration}`;
  element.hidden = false;
}

function setStatusChip(status) {
  const health = deriveStatusHealth(status);
  const copy = {
    connected: ["Connected", "status-connected"],
    policy_required: ["Waiting for policy", "status-warning"],
    pairing: ["Pairing", "status-warning"],
    offline: ["Offline - retrying", "status-warning"],
    server_unreachable: ["Server unavailable - retrying", "status-warning"],
    auth_required: ["Pair again", "status-error"],
    error: ["Needs attention", "status-error"],
    unpaired: ["Not connected", "status-neutral"],
    stale: ["Signal stale", "status-warning"],
  }[health.state] ?? ["Checking", "status-neutral"];
  statusChip.className = `status-chip ${copy[1]}`;
  statusChip.querySelector("b").textContent = copy[0];
}

function setAgentHealthCopy(status) {
  const health = deriveStatusHealth(status);
  const copy = {
    connected: ["Agent connected", "Foreground app activity is being summarized securely."],
    policy_required: ["Waiting for policy setup", "This paired device will begin tracking automatically after the workspace policy is ready."],
    stale: ["Recording locally", "The server signal is delayed. Activity remains on this computer and will sync automatically."],
    offline: ["Recording locally", "WorkMap cannot confirm the server connection. Activity is queued safely and will retry."],
    server_unreachable: ["Recording locally", "The WorkMap service is unavailable. Activity is queued safely and will retry."],
    auth_required: ["Pairing required", "The device credential is no longer accepted. Pair this computer again to resume sync."],
    error: ["Sync needs attention", "Local tracking is still visible below. Review the sync message before continuing."],
  }[health.state] ?? ["Agent starting", "Preparing privacy-minimized activity tracking."];
  document.querySelector("#agent-health-title").textContent = copy[0];
  document.querySelector("#agent-health-detail").textContent = copy[1];
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

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function cleanIpcError(error, fallback = "Pairing could not be completed.") {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

void refreshState();
setInterval(() => void refreshState(), 2_000);
