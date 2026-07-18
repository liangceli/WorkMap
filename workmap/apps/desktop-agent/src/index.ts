import { loadAgentConfig } from "./credentialStore.js";
import { readJson, getAgentDataDirectory } from "./fileStore.js";
import { pairDesktopAgent } from "./pairing.js";
import { DesktopAgentRuntimeV2 } from "./runtimeV2.js";
import type { AgentStatus } from "./types.js";
import { DESKTOP_AGENT_VERSION } from "./version.js";
import { join } from "node:path";

export * from "./apiClient.js";
export * from "./fileStore.js";
export * from "./trackingState.js";
export * from "./trackingV2Store.js";
export * from "./trackingV2Types.js";
export * from "./types.js";
export * from "./windowsActivityHost.js";
export * from "./windowsForeground.js";

async function main() {
  const [command = "run"] = process.argv.slice(2);
  if (command === "pair") return pair();
  if (command === "status") return showStatus();
  if (command !== "run") throw new Error("Usage: run-workmap-agent.cmd [run|pair|status]");

  const config = await loadAgentConfig();
  if (!config) throw new Error("Desktop Agent is not paired. Run: run-workmap-agent.cmd pair --code XXXX-XXXX --api https://api.example.com");
  const runtime = new DesktopAgentRuntimeV2({
    ...config,
    agentVersion: DESKTOP_AGENT_VERSION,
  });
  let stopping = false;
  const stop = (reason: "USER_STOP" | undefined) => {
    if (stopping) return;
    stopping = true;
    void runtime.shutdown(reason);
  };
  process.once("SIGINT", () => stop("USER_STOP"));
  process.once("SIGTERM", () => stop(undefined));
  console.info(`WorkMap Desktop Agent running for device ${config.deviceId}.`);
  await runtime.run();
}

async function pair() {
  const code = readArgument("--code");
  const apiBaseUrl = readArgument("--api");
  const result = await pairDesktopAgent(code, apiBaseUrl);
  console.info(`Desktop Agent paired for device ${result.deviceId}. Credential stored with Windows DPAPI.`);
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
