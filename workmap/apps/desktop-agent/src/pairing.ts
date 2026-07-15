import { exchangePairingCode, waitForApiReady } from "./apiClient.js";
import { loadAgentConfig, saveAgentConfig } from "./credentialStore.js";
import { FileEventQueue, FileStatusEventQueue, writeAgentStatus, writeTrackingCheckpoint } from "./fileStore.js";

export const DESKTOP_AGENT_VERSION = "desktop-agent-windows/0.5.8";
export const DEFAULT_API_BASE_URL = "https://workmap-api.onrender.com";

export type PairingProgress = "waking" | "validating" | "securing";

export async function pairDesktopAgent(
  code: string,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  onProgress?: (progress: PairingProgress) => void,
) {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalizedCode)) {
    throw new Error("Enter the eight-character code shown in WorkMap, for example ABCD-2345.");
  }

  const normalizedApiUrl = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(normalizedApiUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedApiUrl)) {
    throw new Error("The WorkMap API must use HTTPS.");
  }

  await writeAgentStatus({ state: "pairing", queuedEvents: 0 });
  try {
    onProgress?.("waking");
    await waitForApiReady(normalizedApiUrl);
    onProgress?.("validating");
    const result = await exchangePairingCode(normalizedApiUrl, normalizedCode, DESKTOP_AGENT_VERSION);
    onProgress?.("securing");
    const previous = await loadAgentConfig();
    if (previous && previous.deviceId !== result.device.id) {
      const queue = new FileEventQueue();
      await queue.load();
      await queue.clear();
      const statusQueue = new FileStatusEventQueue();
      await statusQueue.load();
      await statusQueue.clear();
      await writeTrackingCheckpoint(null);
    }
    await saveAgentConfig({
      apiBaseUrl: normalizedApiUrl,
      credential: result.credential,
      deviceId: result.device.id,
      agentVersion: DESKTOP_AGENT_VERSION,
    });
    await writeAgentStatus({ state: "connected", deviceId: result.device.id, queuedEvents: 0 });
    return { deviceId: result.device.id };
  } catch (error) {
    await writeAgentStatus({ state: "unpaired", queuedEvents: 0, error: safePairingError(error) });
    throw new Error(safePairingError(error));
  }
}

export function safePairingError(error: unknown) {
  const message = error instanceof Error ? error.message : "Pairing could not be completed.";
  if (/returned 401|returned 403/i.test(message)) {
    return "This pairing code is invalid, expired, or already used. Generate a new code in WorkMap.";
  }
  return message.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]");
}
