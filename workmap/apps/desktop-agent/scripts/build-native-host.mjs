/* global URL, clearTimeout, process, setTimeout */

import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(
  new URL(
    "../native/windows-activity-host/WorkMap.WindowsActivityHost.csproj",
    import.meta.url,
  ),
);
const output = fileURLToPath(
  new URL("../native/windows-activity-host/publish/", import.meta.url),
);
const dotnetHome = fileURLToPath(
  new URL("../native/windows-activity-host/.dotnet-cli/", import.meta.url),
);

// A stale framework-dependent apphost can otherwise survive an incremental
// publish and be packaged without its managed DLL. Always build the helper
// into a clean directory so PublishSingleFile is authoritative.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(dotnetHome, { recursive: true });

await new Promise((resolve, reject) => {
  const child = spawn(
    "dotnet",
    [
      "publish",
      project,
      "--configuration",
      "Release",
      "--runtime",
      "win-x64",
      "--self-contained",
      "true",
      "--output",
      output,
      "-p:PublishSingleFile=true",
      "-p:PublishTrimmed=false",
      "-p:DebugType=None",
      "-p:DebugSymbols=false",
    ],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        DOTNET_CLI_HOME: dotnetHome,
        DOTNET_CLI_TELEMETRY_OPTOUT: "1",
        DOTNET_NOLOGO: "1",
        DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
      },
    },
  );
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Native host publish failed with exit code ${code ?? "unknown"}.`));
  });
});

const executableName = "workmap-windows-activity-host.exe";
const outputEntries = await readdir(output, { withFileTypes: true });
if (
  outputEntries.length !== 1 ||
  !outputEntries[0]?.isFile() ||
  outputEntries[0].name !== executableName
) {
  throw new Error("Native host publish did not produce exactly one self-contained executable.");
}

const executable = resolvePath(output, executableName);
const executableStat = await stat(executable);
if (executableStat.size < 1_000_000) {
  throw new Error("Native host self-contained executable is unexpectedly small.");
}

if (process.platform === "win32") {
  await smokeTestNativeHost(executable);
}

function smokeTestNativeHost(executablePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdoutBuffer = "";
    let stderrTail = "";
    let settled = false;
    const observedEventTypes = new Set();
    const timeout = setTimeout(() => {
      finish(new Error("Native host did not report healthy during its build smoke test."));
    }, 5_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      let newline = stdoutBuffer.indexOf("\n");
      while (newline >= 0) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line) {
          try {
            const event = JSON.parse(line);
            if (typeof event?.eventType === "string") {
              observedEventTypes.add(event.eventType);
            }
            if (
              event?.eventType === "health" &&
              (event.state === "HEALTHY" || event.state === "LIMITED") &&
              observedEventTypes.has("foreground_changed") &&
              observedEventTypes.has("visible_apps_changed")
            ) {
              finish();
              return;
            }
          } catch {
            // Ignore non-protocol output here; the timeout/exit path fails the build.
          }
        }
        newline = stdoutBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-2_048);
    });
    child.once("error", (error) => finish(new Error(`Native host smoke start failed: ${error.name}.`)));
    child.once("exit", (code) => {
      if (settled) return;
      const reason = /application to execute does not exist|\.dll/iu.test(stderrTail)
        ? "managed dependency was missing"
        : `process exited with code ${code ?? "unknown"}`;
      finish(new Error(`Native host smoke test failed: ${reason}.`));
    });

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!child.killed) child.kill();
      if (error) reject(error);
      else resolve();
    }
  });
}
