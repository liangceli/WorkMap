import type { DomainUsageEvent } from "./domainTracking.js";
import type { ExtensionConfig, ExtensionDeviceStatusEvent } from "./extensionStorage.js";
import {
  BROWSER_EXTENSION_VERSION,
  type BrowserTrackingSyncRequestV2,
  type BrowserTrackingSyncResponseV2,
  type DeviceTrackingPolicyV2,
  type ProtocolV2ConfirmResponse,
  type ProtocolV2PrepareResponse,
} from "./trackingV2Types.js";

export class ExtensionApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export function exchangePairingCode(apiBaseUrl: string, code: string, browserName: string) {
  return requestJson<{ credential: string; device: { id: string } }>(apiBaseUrl, "/device-client/pair", undefined, {
    code,
    clientType: "BROWSER_EXTENSION",
    os: "UNKNOWN",
    agentVersion: BROWSER_EXTENSION_VERSION,
    hostname: browserName,
    browserName,
  });
}

export function sendExtensionHeartbeat(config: ExtensionConfig) {
  return requestJson(config.apiBaseUrl, "/device-client/heartbeat", config.credential, { agentVersion: BROWSER_EXTENSION_VERSION });
}

export function sendDomainUsage(config: ExtensionConfig, events: DomainUsageEvent[]) {
  return requestJson<{ accepted: number }>(config.apiBaseUrl, "/device-client/domain-usage", config.credential, { events });
}

export function sendExtensionStatus(config: ExtensionConfig, event: ExtensionDeviceStatusEvent) {
  return requestJson(config.apiBaseUrl, "/device-client/status-event", config.credential, event);
}

export function getDeviceClientStatus(config: ExtensionConfig) {
  return requestJson<{
    paired: true;
    clientType: "BROWSER_EXTENSION";
    deviceId: string;
    workstationId: string | null;
    browserName: "CHROME" | "EDGE" | null;
    protocolActivatedAt: string | null;
  }>(config.apiBaseUrl, "/device-client/status", config.credential);
}

export function getTrackingPolicyV2(config: ExtensionConfig) {
  return requestJson<DeviceTrackingPolicyV2>(
    config.apiBaseUrl,
    "/device-client/tracking-policy",
    config.credential,
  );
}

export function prepareProtocolV2(config: ExtensionConfig) {
  return requestJson<ProtocolV2PrepareResponse>(
    config.apiBaseUrl,
    "/device-client/protocol-v2/prepare",
    config.credential,
    {},
  );
}

export function confirmProtocolV2(
  config: ExtensionConfig,
  activationId: string,
  protocolActivatedAt: string,
) {
  return requestJson<ProtocolV2ConfirmResponse>(
    config.apiBaseUrl,
    "/device-client/protocol-v2/confirm",
    config.credential,
    { activationId, protocolActivatedAt },
  );
}

export function syncTrackingV2(
  config: ExtensionConfig,
  body: BrowserTrackingSyncRequestV2,
) {
  return requestJson<BrowserTrackingSyncResponseV2>(
    config.apiBaseUrl,
    "/device-client/sync-v2",
    config.credential,
    body,
  );
}

export function isUpgradeRequiredError(error: unknown) {
  return (
    error instanceof ExtensionApiError &&
    (error.status === 426 || /UPGRADE_REQUIRED/i.test(error.message))
  );
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  credential: string | undefined,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(credential ? { Authorization: `Device ${credential}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
