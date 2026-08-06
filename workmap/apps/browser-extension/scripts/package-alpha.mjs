import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { join } from "node:path";
import { env, platform, stdout } from "node:process";
import { promisify } from "node:util";

if (platform !== "win32") {
  throw new Error(
    "The CandidGrid browser-extension release archive is generated on Windows.",
  );
}

const execFileAsync = promisify(execFile);
const unpackedDirectory = fileURLToPath(
  new URL("../alpha-unpacked/", import.meta.url),
);
const artifactDirectory = fileURLToPath(
  new URL("../../../artifacts/browser-extension/", import.meta.url),
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const archivePath = join(
  artifactDirectory,
  `CandidGrid-Browser-Extension-${packageJson.version}.zip`,
);

await mkdir(artifactDirectory, { recursive: true });
await rm(archivePath, { force: true });
const powershellPath = join(
  env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
await execFileAsync(powershellPath, [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  `$ErrorActionPreference = 'Stop'; Compress-Archive -Path '${join(unpackedDirectory, "*")}' -DestinationPath '${archivePath}' -Force`,
]);

const archive = await stat(archivePath);
if (!archive.isFile() || archive.size === 0) {
  throw new Error(`Browser Extension archive was not created: ${archivePath}`);
}

stdout.write(`Created ${archivePath} (${archive.size} bytes).\n`);
