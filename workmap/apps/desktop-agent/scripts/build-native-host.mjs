/* global URL, process */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
