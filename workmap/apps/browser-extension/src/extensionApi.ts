import type { DomainUsageEvent } from "./domainTracking.js";
import type { ExtensionConfig } from "./extensionStorage.js";

export class ExtensionApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export function exchangePairingCode(apiBaseUrl: string, code: string, browserName: string) {
  return requestJson<{ credential: string; device: { id: string } }>(apiBaseUrl, "/device-client/pair", undefined, {
    code,
    clientType: "BROWSER_EXTENSION",
    os: "UNKNOWN",
    agentVersion: "browser-extension-mv3/0.4.2",
    hostname: browserName,
  });
}

export function sendExtensionHeartbeat(config: ExtensionConfig) {
  return requestJson(config.apiBaseUrl, "/device-client/heartbeat", config.credential, { agentVersion: "browser-extension-mv3/0.4.2" });
}

export function sendDomainUsage(config: ExtensionConfig, events: DomainUsageEvent[]) {
  return requestJson<{ accepted: number }>(config.apiBaseUrl, "/device-client/domain-usage", config.credential, { events });
}

async function requestJson<T>(baseUrl: string, path: string, credential: string | undefined, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(credential ? { Authorization: `Device ${credential}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ExtensionApiError(error instanceof Error ? error.message : "Network request failed.");
  }
  if (!response.ok) {
    const detail = await readSafeResponseMessage(response);
    throw new ExtensionApiError(`WorkMap API ${path} returned ${response.status}${detail ? `: ${detail}` : ""}.`, response.status);
  }
  return await response.json() as T;
}

async function readSafeResponseMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
    const message = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message ?? parsed.error;
    return sanitizeDetail(typeof message === "string" ? message : text);
  } catch {
    return sanitizeDetail(text);
  }
}

function sanitizeDetail(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 240);
}
