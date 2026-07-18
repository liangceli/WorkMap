import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { join } from "node:path";
import { platform } from "node:process";
import { promisify } from "node:util";

if (platform !== "win32") {
  throw new Error("The WorkMap browser-extension release archive is generated on Windows.");
}

const execFileAsync = promisify(execFile);
const unpackedDirectory = fileURLToPath(new URL("../alpha-unpacked/", import.meta.url));
const artifactDirectory = fileURLToPath(new URL("../../../artifacts/browser-extension/", import.meta.url));
const archivePath = join(artifactDirectory, "WorkMap-Browser-Extension-0.5.0.zip");

await mkdir(artifactDirectory, { recursive: true });
await rm(archivePath, { force: true });
await execFileAsync("powershell.exe", [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  `Compress-Archive -Path '${join(unpackedDirectory, "*")}' -DestinationPath '${archivePath}' -Force`,
]);
