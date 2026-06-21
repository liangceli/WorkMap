import { exchangePairingCode } from "./apiClient.js";
import { loadAgentConfig, saveAgentConfig } from "./credentialStore.js";
import { readJson, getAgentDataDirectory, writeAgentStatus } from "./fileStore.js";
import { DesktopAgentRuntime } from "./runtime.js";
import type { AgentStatus } from "./types.js";
import { join } from "node:path";

export * from "./apiClient.js";
export * from "./fileStore.js";
export * from "./trackingState.js";
export * from "./types.js";
export * from "./windowsForeground.js";

const AGENT_VERSION = "desktop-agent-windows-alpha/0.3.0";

async function main() {
  const [command = "run"] = process.argv.slice(2);
  if (command === "pair") return pair();
  if (command === "status") return showStatus();
  if (command !== "run") throw new Error("Usage: run-workmap-agent.cmd [run|pair|status]");

  const config = await loadAgentConfig();
  if (!config) throw new Error("Desktop Agent is not paired. Run: run-workmap-agent.cmd pair --code XXXX-XXXX --api https://api.example.com");
  const runtime = new DesktopAgentRuntime(config);
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void runtime.shutdown();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.info(`WorkMap Desktop Agent running for device ${config.deviceId}.`);
  await runtime.run();
}

async function pair() {
  const code = readArgument("--code");
  const apiBaseUrl = readArgument("--api").replace(/\/+$/, "");
  if (!/^https:\/\//i.test(apiBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiBaseUrl)) {
    throw new Error("API URL must use HTTPS, except localhost development.");
  }
  await writeAgentStatus({ state: "pairing", queuedEvents: 0 });
  try {
    const result = await exchangePairingCode(apiBaseUrl, code, AGENT_VERSION);
    await saveAgentConfig({ apiBaseUrl, credential: result.credential, deviceId: result.device.id, agentVersion: AGENT_VERSION });
    await writeAgentStatus({ state: "connected", deviceId: result.device.id, queuedEvents: 0 });
    console.info(`Desktop Agent paired for device ${result.device.id}. Credential stored with Windows DPAPI.`);
  } catch (error) {
    await writeAgentStatus({ state: "unpaired", queuedEvents: 0, error: safeError(error) });
    throw error;
  }
}

async function showStatus() {
  const status = await readJson<AgentStatus>(join(getAgentDataDirectory(), "status.json"), { state: "unpaired", queuedEvents: 0 });
  console.info(JSON.stringify(status, null, 2));
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().catch((error: unknown) => {
  console.error(safeError(error));
  process.exitCode = 1;
});

function safeError(error: unknown) {
  return error instanceof Error ? error.message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]") : "Unknown error";
}
