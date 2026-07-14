import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, shell, Tray } from "electron";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadAgentConfig } from "../credentialStore.js";
import { getAgentDataDirectory, readJson, writeAgentStatus } from "../fileStore.js";
import { pairDesktopAgent, safePairingError, type PairingProgress } from "../pairing.js";
import { DesktopAgentRuntime } from "../runtime.js";
import type { AgentStatus } from "../types.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rendererDirectory = resolve(currentDirectory, "..", "..", "renderer");
const isBackgroundLaunch = process.argv.includes("--background");
const icon = nativeImage.createFromPath(join(rendererDirectory, "workmap-mark.svg"));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let runtime: DesktopAgentRuntime | null = null;
let runtimePromise: Promise<void> | null = null;
let paired = false;
let allowQuit = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
  void app.whenReady().then(startApplication);
}

async function startApplication() {
  if (process.env.WORKMAP_AGENT_SKIP_LEGACY_MIGRATION !== "1") await removeLegacyAutoStart();
  paired = Boolean(await loadAgentConfig());
  createWindow();
  createTray();
  registerIpc();
  registerPowerEvents();

  if (paired) {
    configureAutoStart();
    await startRuntime();
  }

  if (!isBackgroundLaunch || !paired) showWindow();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 690,
    minWidth: 760,
    minHeight: 600,
    show: false,
    backgroundColor: "#f3f7f5",
    icon,
    title: "WorkMap Desktop Agent",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(rendererDirectory, "preload.cjs"),
    },
  });

  void mainWindow.loadFile(join(rendererDirectory, "index.html"));
  mainWindow.on("close", (event) => {
    if (allowQuit || !paired) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip("WorkMap Desktop Agent");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open WorkMap Agent", click: showWindow },
    { type: "separator" },
    { label: "Quit Agent", click: () => void quitAgent() },
  ]));
  tray.on("double-click", showWindow);
}

function registerIpc() {
  ipcMain.handle("agent:get-state", getUiState);
  ipcMain.handle("agent:pair", async (event, code: unknown) => {
    if (typeof code !== "string") throw new Error("Enter a WorkMap pairing code.");
    const progress = (stage: PairingProgress) => event.sender.send("agent:pair-progress", stage);
    try {
      const result = await pairDesktopAgent(code, undefined, progress);
      paired = true;
      configureAutoStart();
      await startRuntime();
      return result;
    } catch (error) {
      throw new Error(safePairingError(error));
    }
  });
  ipcMain.handle("agent:hide", () => mainWindow?.hide());
  ipcMain.handle("agent:open-workmap", () => shell.openExternal("https://work-map-teal.vercel.app"));
  ipcMain.handle("agent:quit", quitAgent);
}

async function getUiState() {
  const status = await readJson<AgentStatus>(join(getAgentDataDirectory(), "status.json"), {
    state: paired ? "offline" : "unpaired",
    queuedEvents: 0,
  });
  const config = await loadAgentConfig();
  paired = Boolean(config);
  return {
    paired,
    status,
    deviceId: config?.deviceId ?? null,
    startsWithWindows: app.getLoginItemSettings().openAtLogin,
    version: app.getVersion(),
  };
}

async function startRuntime() {
  if (runtimePromise) return;
  const config = await loadAgentConfig();
  if (!config) return;
  runtime = new DesktopAgentRuntime(config);
  runtimePromise = runtime.run()
    .catch(async (error) => {
      await writeAgentStatus({
        state: "error",
        deviceId: config.deviceId,
        queuedEvents: 0,
        error: safeRuntimeError(error),
      });
    })
    .finally(() => {
      runtime = null;
      runtimePromise = null;
    });
}

function configureAutoStart() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true, args: ["--background"] });
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

async function quitAgent() {
  if (runtime) await runtime.shutdown("USER_STOP");
  allowQuit = true;
  app.quit();
}

function registerPowerEvents() {
  powerMonitor.on("suspend", () => void reportPowerStatus("SLEEPING", "SYSTEM_SUSPEND"));
  powerMonitor.on("resume", () => void reportPowerStatus("RECONNECTED", "SYSTEM_RESUME"));
  powerMonitor.on("lock-screen", () => void reportPowerStatus("LOCKED", "SYSTEM_LOCK"));
  powerMonitor.on("unlock-screen", () => void reportPowerStatus("RECONNECTED", "SYSTEM_UNLOCK"));
}

async function reportPowerStatus(
  status: "SLEEPING" | "LOCKED" | "RECONNECTED",
  reason: "SYSTEM_SUSPEND" | "SYSTEM_RESUME" | "SYSTEM_LOCK" | "SYSTEM_UNLOCK",
) {
  try {
    await runtime?.reportDeviceStatus(status, reason, { operation: "electron-power-monitor" });
  } catch {
    // The runtime durable status queue retains a best-effort lifecycle signal when the API is unavailable.
  }
}

function removeLegacyAutoStart() {
  if (process.platform !== "win32") return Promise.resolve();
  return Promise.allSettled([removeLegacyRunKey(), stopLegacyNodeAgents()]).then(() => undefined);
}

function removeLegacyRunKey() {
  return new Promise<void>((resolvePromise) => {
    execFile(
      "reg.exe",
      ["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "WorkMapDesktopAgent", "/f"],
      { windowsHide: true },
      () => resolvePromise(),
    );
  });
}

function stopLegacyNodeAgents() {
  const script = `
$ErrorActionPreference = "SilentlyContinue"
$ownPid = ${process.pid}
$shellPid = $PID
Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -notin @($ownPid, $shellPid) -and
  @("node.exe", "cmd.exe", "powershell.exe", "pwsh.exe") -contains $_.Name -and
  $_.CommandLine -and
  (
    $_.CommandLine -match "WorkMap Desktop Agent" -or
    $_.CommandLine -match "run-workmap-agent" -or
    $_.CommandLine -match "apps[\\\\/]desktop-agent" -or
    $_.CommandLine -match "DesktopAgent"
  ) -and
  (
    $_.CommandLine -match "dist[\\\\/]index\\.js\\s+run" -or
    $_.CommandLine -match "run-workmap-agent"
  )
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
`;

  return new Promise<void>((resolvePromise) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 5_000 },
      () => resolvePromise(),
    );
  });
}

app.on("before-quit", () => { allowQuit = true; });
app.on("window-all-closed", () => undefined);

function safeRuntimeError(error: unknown) {
  return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown runtime failure";
}
