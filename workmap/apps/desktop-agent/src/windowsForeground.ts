import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { normalizeAppName } from "./trackingState.js";
import type { ForegroundSample } from "./types.js";

const execFileAsync = promisify(execFile);

type NativeObservation = {
  appName?: unknown;
  processName?: unknown;
  openApps?: unknown;
  idleSeconds?: unknown;
  locked?: unknown;
  observedAt?: unknown;
};

export class WindowsForegroundAdapter {
  constructor(
    private readonly idleThresholdSeconds = 300,
    private readonly scriptPath = resolveAgentScript("windows-foreground.ps1"),
  ) {}

  async sample(): Promise<ForegroundSample> {
    if (process.platform !== "win32") {
      throw new Error("WorkMap Desktop Agent currently supports Windows only.");
    }
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", this.scriptPath, "-IdleThresholdSeconds", String(this.idleThresholdSeconds)],
      { timeout: 4_000, windowsHide: true, maxBuffer: 32_768 },
    );
    return minimizeWindowsObservation(JSON.parse(stdout.trim()) as NativeObservation);
  }
}

function resolveAgentScript(name: string) {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return resourcesPath
    ? resolve(resourcesPath, "agent-scripts", name)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "scripts", name);
}

export function minimizeWindowsObservation(observation: NativeObservation): ForegroundSample {
  const idleSeconds = typeof observation.idleSeconds === "number" && Number.isFinite(observation.idleSeconds)
    ? Math.max(0, observation.idleSeconds)
    : 0;
  const observedAtMs = typeof observation.observedAt === "string" ? Date.parse(observation.observedAt) : Date.now();
  return {
    appName: typeof observation.appName === "string"
      ? normalizeAppName(observation.appName)
      : typeof observation.processName === "string" ? normalizeAppName(observation.processName) : null,
    openAppNames: Array.isArray(observation.openApps)
      ? observation.openApps.flatMap((value) => typeof value === "string" ? [normalizeAppName(value)].filter(Boolean) as string[] : [])
      : [],
    isIdle: Boolean(observation.locked) || idleSeconds > 0 && Boolean((observation as { idle?: unknown }).idle),
    isLocked: Boolean(observation.locked),
    observedAtMs: Number.isFinite(observedAtMs) ? observedAtMs : Date.now(),
  };
}
