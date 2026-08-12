import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const NATIVE_HOST_RESTART_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000] as const;

type WindowsActivityHostAdapterOptionsV2 = {
  platform?: NodeJS.Platform;
  executableExists?: (path: string) => boolean;
  spawnHost?: (path: string) => ChildProcessWithoutNullStreams;
  restartDelaysMs?: readonly number[];
  scheduleRestart?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  cancelRestart?: (timer: NodeJS.Timeout) => void;
};

export type WindowsActivityAppIdentityV2 = {
  subjectKey: string;
  displayName: string;
};

export type WindowsActivityHostEventV2 =
  | {
      protocolVersion: 1;
      eventType: "foreground_changed";
      monotonicMs: number;
      app: WindowsActivityAppIdentityV2 | null;
    }
  | {
      protocolVersion: 1;
      eventType: "interaction_pulse";
      monotonicMs: number;
      evidence: "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND";
    }
  | {
      protocolVersion: 1;
      eventType: "visible_apps_changed";
      monotonicMs: number;
      apps: WindowsActivityAppIdentityV2[];
    }
  | {
      protocolVersion: 1;
      eventType:
        | "session_locked"
        | "session_unlocked"
        | "session_connected"
        | "session_disconnected"
        | "suspend"
        | "resume";
      monotonicMs: number;
      sessionLocked?: boolean;
    }
  | {
      protocolVersion: 1;
      eventType: "desktop_switched";
      monotonicMs: number;
      inputDesktopAvailable: boolean;
    }
  | {
      protocolVersion: 1;
      eventType: "health";
      monotonicMs: number;
      state: "HEALTHY" | "LIMITED" | "ERROR";
      adapterVersion?: string;
      errorCode: string;
      detail?: string;
    };

export type WindowsActivityHostListenerV2 = (event: WindowsActivityHostEventV2) => void;

export class WindowsActivityHostAdapterV2 {
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private stderrTail = "";
  private stopping = false;
  private listener: WindowsActivityHostListenerV2 | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private restartAttempt = 0;
  private readonly platform: NodeJS.Platform;
  private readonly executableExists: (path: string) => boolean;
  private readonly spawnHost: (path: string) => ChildProcessWithoutNullStreams;
  private readonly restartDelaysMs: readonly number[];
  private readonly scheduleRestart: (
    callback: () => void,
    delayMs: number,
  ) => NodeJS.Timeout;
  private readonly cancelRestart: (timer: NodeJS.Timeout) => void;

  constructor(
    private readonly executablePath = resolveActivityHostExecutable(),
    private readonly diagnosticFallbackEnabled =
      process.env.WORKMAP_AGENT_DIAGNOSTIC_POWERSHELL_FALLBACK === "1",
    options: WindowsActivityHostAdapterOptionsV2 = {},
  ) {
    this.platform = options.platform ?? process.platform;
    this.executableExists = options.executableExists ?? existsSync;
    this.spawnHost = options.spawnHost ?? ((path) => spawn(path, [], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }));
    this.restartDelaysMs = options.restartDelaysMs?.length
      ? options.restartDelaysMs
      : NATIVE_HOST_RESTART_DELAYS_MS;
    this.scheduleRestart = options.scheduleRestart ?? setTimeout;
    this.cancelRestart = options.cancelRestart ?? clearTimeout;
  }

  start(listener: WindowsActivityHostListenerV2) {
    this.listener = listener;
    if (this.process || this.restartTimer) return;
    if (this.platform !== "win32") {
      throw new Error("WorkMap Desktop Agent 0.6.12 supports Windows only.");
    }
    if (!this.executableExists(this.executablePath)) {
      throw new Error(
        this.diagnosticFallbackEnabled
          ? "The compiled Windows activity host is unavailable. Diagnostic PowerShell fallback must be run explicitly."
          : "The compiled Windows activity host is unavailable.",
      );
    }

    this.stopping = false;
    this.launchHost();
  }

  stop() {
    this.stopping = true;
    this.listener = null;
    this.restartAttempt = 0;
    if (this.restartTimer) {
      this.cancelRestart(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.process;
    this.process = null;
    if (child && !child.killed) child.kill();
  }

  private launchHost() {
    if (this.stopping || this.process || !this.listener) return;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.spawnHost(this.executablePath);
    } catch (error) {
      this.listener(hostFailure(
        "HOST_PROCESS_ERROR",
        error instanceof Error ? error.name : "SpawnFailed",
      ));
      this.scheduleHostRestart();
      return;
    }
    this.process = child;
    this.stdoutBuffer = "";
    this.stderrTail = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.consume(child, chunk));
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-2_048);
    });
    child.once("error", (error) => {
      this.handleHostFailure(child, hostFailure("HOST_PROCESS_ERROR", error.name));
    });
    child.once("exit", (code) => {
      this.handleHostFailure(child, hostFailure(
        "HOST_PROCESS_EXITED",
        nativeHostExitDetail(this.stderrTail, code),
      ));
    });
  }

  private handleHostFailure(
    child: ChildProcessWithoutNullStreams,
    event: WindowsActivityHostEventV2,
  ) {
    if (this.process !== child || this.stopping) return;
    this.process = null;
    this.listener?.(event);
    this.scheduleHostRestart();
  }

  private scheduleHostRestart() {
    if (this.stopping || this.restartTimer || !this.listener) return;
    const delay = this.restartDelaysMs[
      Math.min(this.restartAttempt, this.restartDelaysMs.length - 1)
    ] ?? 60_000;
    this.restartAttempt += 1;
    this.restartTimer = this.scheduleRestart(() => {
      this.restartTimer = null;
      this.launchHost();
    }, delay);
  }

  private consume(child: ChildProcessWithoutNullStreams, chunk: string) {
    if (this.process !== child || this.stopping) return;
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) {
        const event = parseWindowsActivityHostLine(line);
        if (
          event?.eventType === "health" &&
          (event.state === "HEALTHY" || event.state === "LIMITED")
        ) {
          this.restartAttempt = 0;
        }
        this.listener?.(event ?? hostFailure("HOST_PROTOCOL_INVALID", "InvalidJsonLine"));
      }
      newline = this.stdoutBuffer.indexOf("\n");
    }
  }
}

function nativeHostExitDetail(stderrTail: string, code: number | null) {
  if (/application to execute does not exist|\.dll/iu.test(stderrTail)) {
    return "NativeHostDependencyMissing";
  }
  return stderrTail.trim() ? "NativeHostError" : `Exit${code ?? "Unknown"}`;
}

export function parseWindowsActivityHostLine(line: string): WindowsActivityHostEventV2 | null {
  try {
    const value = JSON.parse(line) as unknown;
    if (!isRecord(value) || value.protocolVersion !== 1) return null;
    if (typeof value.eventType !== "string" || !finiteNonNegative(value.monotonicMs)) return null;
    const base = {
      protocolVersion: 1 as const,
      monotonicMs: value.monotonicMs as number,
    };
    if (value.eventType === "foreground_changed") {
      if (value.app !== null && !validApp(value.app)) return null;
      return { ...base, eventType: value.eventType, app: value.app };
    }
    if (value.eventType === "interaction_pulse") {
      if (value.evidence !== "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND") return null;
      return { ...base, eventType: value.eventType, evidence: value.evidence };
    }
    if (value.eventType === "visible_apps_changed") {
      if (
        !Array.isArray(value.apps) ||
        value.apps.length > 256 ||
        value.apps.some((app) => !validApp(app))
      ) {
        return null;
      }
      const apps = value.apps as WindowsActivityAppIdentityV2[];
      if (new Set(apps.map((app) => app.subjectKey)).size !== apps.length) {
        return null;
      }
      return { ...base, eventType: value.eventType, apps };
    }
    if (
      value.eventType === "session_locked" ||
      value.eventType === "session_unlocked" ||
      value.eventType === "session_connected" ||
      value.eventType === "session_disconnected" ||
      value.eventType === "suspend" ||
      value.eventType === "resume"
    ) {
      return {
        ...base,
        eventType: value.eventType,
        ...(typeof value.sessionLocked === "boolean" ? { sessionLocked: value.sessionLocked } : {}),
      };
    }
    if (value.eventType === "desktop_switched" && typeof value.inputDesktopAvailable === "boolean") {
      return { ...base, eventType: value.eventType, inputDesktopAvailable: value.inputDesktopAvailable };
    }
    if (
      value.eventType === "health" &&
      (value.state === "HEALTHY" || value.state === "LIMITED" || value.state === "ERROR") &&
      typeof value.errorCode === "string"
    ) {
      return {
        ...base,
        eventType: value.eventType,
        state: value.state,
        errorCode: safeDiagnostic(value.errorCode),
        ...(typeof value.adapterVersion === "string"
          ? { adapterVersion: safeDiagnostic(value.adapterVersion) }
          : {}),
        ...(typeof value.detail === "string" ? { detail: safeDiagnostic(value.detail) } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function resolveActivityHostExecutable() {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return resourcesPath
    ? resolve(resourcesPath, "native", "workmap-windows-activity-host.exe")
    : resolve(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "native",
        "windows-activity-host",
        "publish",
        "workmap-windows-activity-host.exe",
      );
}

function hostFailure(errorCode: string, detail: string): WindowsActivityHostEventV2 {
  return {
    protocolVersion: 1,
    eventType: "health",
    monotonicMs: Math.max(0, Math.round(process.uptime() * 1_000)),
    state: "ERROR",
    errorCode,
    detail: safeDiagnostic(detail),
  };
}

function validApp(value: unknown): value is WindowsActivityAppIdentityV2 {
  return (
    isRecord(value) &&
    typeof value.subjectKey === "string" &&
    value.subjectKey.startsWith("app:") &&
    value.subjectKey.length <= 128 &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0 &&
    value.displayName.length <= 160
  );
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeDiagnostic(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
}
