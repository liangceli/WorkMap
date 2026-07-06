import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { normalizeAppName } from "./trackingState.js";
import type { ForegroundSample } from "./types.js";

export const DEFAULT_IDLE_THRESHOLD_SECONDS = 30;
export const DEFAULT_OPEN_APP_SCAN_INTERVAL_MS = 1_000;

type PendingSample = {
  resolve: (sample: ForegroundSample) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type NativeObservation = {
  appName?: unknown;
  processName?: unknown;
  openApps?: unknown;
  idleSeconds?: unknown;
  locked?: unknown;
  observedAt?: unknown;
};

export class WindowsForegroundAdapter {
  private sampler: ChildProcessWithoutNullStreams | null = null;
  private pending: PendingSample | null = null;
  private stdoutBuffer = "";
  private stderrTail = "";
  private nextOpenAppScanAtMs = 0;

  constructor(
    private readonly idleThresholdSeconds = DEFAULT_IDLE_THRESHOLD_SECONDS,
    private readonly scriptPath = resolveAgentScript("windows-foreground.ps1"),
    private readonly openAppScanIntervalMs = DEFAULT_OPEN_APP_SCAN_INTERVAL_MS,
  ) {}

  async sample(): Promise<ForegroundSample> {
    if (process.platform !== "win32") {
      throw new Error("WorkMap Desktop Agent currently supports Windows only.");
    }
    if (this.pending) throw new Error("Windows foreground sampling request is already in progress.");

    const sampler = this.ensureSampler();
    return new Promise<ForegroundSample>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.rejectPending(new Error("Windows foreground sampling timed out."));
        this.stopSampler();
      }, 4_000);
      this.pending = { resolve, reject, timeout };
      const now = Date.now();
      const includeOpenApps = now >= this.nextOpenAppScanAtMs;
      if (includeOpenApps) this.nextOpenAppScanAtMs = now + this.openAppScanIntervalMs;
      sampler.stdin.write(includeOpenApps ? "full\n" : "focus\n", (error) => {
        if (!error) return;
        this.rejectPending(new Error("Windows foreground sampler could not accept a request."));
        this.stopSampler();
      });
    });
  }

  stop() {
    this.rejectPending(new Error("Windows foreground sampling stopped."));
    this.stopSampler();
  }

  private ensureSampler() {
    if (this.sampler && !this.sampler.killed) return this.sampler;
    const sampler = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", this.scriptPath, "-IdleThresholdSeconds", String(this.idleThresholdSeconds), "-Interactive"],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.sampler = sampler;
    this.stdoutBuffer = "";
    this.stderrTail = "";
    this.nextOpenAppScanAtMs = 0;
    sampler.stdout.setEncoding("utf8");
    sampler.stderr.setEncoding("utf8");
    sampler.stdout.on("data", (chunk: string) => this.consumeStdout(chunk));
    sampler.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-2_048);
    });
    sampler.once("error", () => {
      if (this.sampler !== sampler) return;
      this.rejectPending(new Error("Windows foreground sampler failed to start."));
      this.sampler = null;
    });
    sampler.once("exit", () => {
      if (this.sampler !== sampler) return;
      const detail = this.stderrTail.trim();
      this.rejectPending(new Error(detail ? `Windows foreground sampler stopped: ${detail}` : "Windows foreground sampler stopped unexpectedly."));
      this.sampler = null;
    });
    return sampler;
  }

  private consumeStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line) this.resolvePending(line);
      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private resolvePending(line: string) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timeout);
    try {
      pending.resolve(minimizeWindowsObservation(JSON.parse(line) as NativeObservation, this.idleThresholdSeconds));
    } catch {
      pending.reject(new Error("Windows foreground sampler returned invalid data."));
      this.stopSampler();
    }
  }

  private rejectPending(error: Error) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private stopSampler() {
    const sampler = this.sampler;
    this.sampler = null;
    this.nextOpenAppScanAtMs = 0;
    if (sampler && !sampler.killed) sampler.kill();
  }
}

function resolveAgentScript(name: string) {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return resourcesPath
    ? resolve(resourcesPath, "agent-scripts", name)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "scripts", name);
}

export function minimizeWindowsObservation(
  observation: NativeObservation,
  idleThresholdSeconds = DEFAULT_IDLE_THRESHOLD_SECONDS,
): ForegroundSample {
  const idleSeconds = typeof observation.idleSeconds === "number" && Number.isFinite(observation.idleSeconds)
    ? Math.max(0, observation.idleSeconds)
    : 0;
  const observedAtMs = typeof observation.observedAt === "string" ? Date.parse(observation.observedAt) : Date.now();
  const safeObservedAtMs = Number.isFinite(observedAtMs) ? observedAtMs : Date.now();
  const isLocked = Boolean(observation.locked);
  const isIdle = isLocked || idleSeconds >= idleThresholdSeconds;
  const lastInputAtMs = Math.min(safeObservedAtMs, safeObservedAtMs - idleSeconds * 1_000);
  return {
    appName: typeof observation.appName === "string"
      ? normalizeAppName(observation.appName)
      : typeof observation.processName === "string" ? normalizeAppName(observation.processName) : null,
    openAppNames: Array.isArray(observation.openApps)
      ? observation.openApps.flatMap((value) => typeof value === "string" ? [normalizeAppName(value)].filter(Boolean) as string[] : [])
      : undefined,
    isIdle,
    isLocked,
    observedAtMs: safeObservedAtMs,
    lastInputAtMs,
    idleStartedAtMs: isIdle && !isLocked ? lastInputAtMs + idleThresholdSeconds * 1_000 : undefined,
  };
}
