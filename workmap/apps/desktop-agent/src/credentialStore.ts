import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { getAgentDataDirectory, writeJsonAtomic } from "./fileStore.js";
import type { AgentConfig } from "./types.js";

type StoredConfig = Omit<AgentConfig, "credential"> & { protectedCredential: string };

const scriptPath = resolveAgentScript("credential-protection.ps1");

export async function saveAgentConfig(config: AgentConfig, filePath = join(getAgentDataDirectory(), "config.json")) {
  const protectedCredential = await runCredentialScript("Protect", config.credential);
  await writeJsonAtomic(filePath, { ...config, credential: undefined, protectedCredential });
}

export async function loadAgentConfig(filePath = join(getAgentDataDirectory(), "config.json")): Promise<AgentConfig | null> {
  try {
    const stored = JSON.parse(await readFile(filePath, "utf8")) as StoredConfig;
    if (!stored.apiBaseUrl || !stored.deviceId || !stored.protectedCredential) return null;
    return { ...stored, credential: await runCredentialScript("Unprotect", stored.protectedCredential) };
  } catch {
    return null;
  }
}

function runCredentialScript(mode: "Protect" | "Unprotect", input: string) {
  if (process.platform !== "win32") throw new Error("DPAPI credential storage requires Windows.");
  return new Promise<string>((resolvePromise, reject) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Mode", mode],
      { windowsHide: true, timeout: 5_000 },
      (error, stdout) => error ? reject(error) : resolvePromise(stdout.trim()),
    );
    child.stdin?.end(input);
  });
}

function resolveAgentScript(name: string) {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return resourcesPath
    ? join(resourcesPath, "agent-scripts", name)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "scripts", name);
}
