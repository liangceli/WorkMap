import type { AgentConfig, AppUsageEvent, CurrentAppActivity, DeviceStatusEvent } from "./types.js";
import type {
  DeviceTrackingPolicyV2,
  ProtocolV2ConfirmResponse,
  ProtocolV2PrepareResponse,
  TrackingSyncRequestV2,
  TrackingSyncResponseV2,
} from "./trackingV2Types.js";

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseMessage?: string,
    readonly responseCode?: string,
    readonly retryAfterMs?: number,
    readonly requestId?: string,
    readonly responseStage?: "parse" | "policy" | "transaction" | "response",
  ) {
    super(message);
  }
}

export async function waitForApiReady(apiBaseUrl: string) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(75_000),
    });
  } catch (error) {
    throw new AgentApiError(friendlyNetworkError(error, "WorkMap could not reach the pairing service."));
  }
  if (!response.ok) throw new AgentApiError(`WorkMap pairing service returned ${response.status}.`, response.status);
}

export async function exchangePairingCode(apiBaseUrl: string, code: string, agentVersion: string) {
  return requestJson<{
    credential: string;
    device: { id: string };
  }>(apiBaseUrl, "/device-client/pair", undefined, {
    code,
    clientType: "DESKTOP_AGENT",
    os: "WINDOWS",
    hostname: process.env.COMPUTERNAME,
    agentVersion,
  }, 30_000);
}

export function startAgentSession(config: AgentConfig, clientSessionId?: string, timeZone?: string) {
  return requestJson<{ sessionId: string; startedAt: string }>(config.apiBaseUrl, "/device-client/session/start", config.credential, {
    agentVersion: config.agentVersion,
    ...(clientSessionId ? { clientSessionId } : {}),
    ...(timeZone ? { timeZone } : {}),
  }, 10_000, { retries: 2 });
}

export function stopAgentSession(config: AgentConfig, sessionId: string, reason?: string, timeZone?: string) {
  return requestJson(config.apiBaseUrl, "/device-client/session/stop", config.credential, {
    sessionId,
    ...(reason ? { reason } : {}),
    ...(timeZone ? { timeZone } : {}),
  }, 10_000, { retries: 1 });
}

export function sendHeartbeat(
  config: AgentConfig,
  sessionId?: string,
  currentActivity?: CurrentAppActivity | null,
  sequenceNumber?: number,
  timeZone?: string,
) {
  return requestJson(config.apiBaseUrl, "/device-client/heartbeat", config.credential, {
    agentVersion: config.agentVersion,
    ...(sessionId ? { sessionId, currentActivity: currentActivity ?? null } : {}),
    ...(sequenceNumber !== undefined ? { sequenceNumber } : {}),
    ...(timeZone ? { timeZone } : {}),
  }, 10_000, { retries: 2 });
}

export function sendAppUsage(config: AgentConfig, events: AppUsageEvent[]) {
  return requestJson<{ accepted: number }>(config.apiBaseUrl, "/device-client/app-usage", config.credential, { events }, 10_000, { retries: 2 });
}

export function sendDeviceStatus(config: AgentConfig, event: DeviceStatusEvent) {
  return requestJson(config.apiBaseUrl, "/device-client/status-event", config.credential, event, 10_000, { retries: 1 });
}

export function getDeviceClientStatus(config: AgentConfig) {
  return requestJson<{
    paired: true;
    clientType: "DESKTOP_AGENT";
    deviceId: string;
    workstationId: string | null;
    browserName: null;
    protocolActivatedAt: string | null;
  }>(
    config.apiBaseUrl,
    "/device-client/status",
    config.credential,
    undefined,
    10_000,
    { retries: 2, method: "GET" },
  );
}

export function getTrackingPolicyV2(config: AgentConfig) {
  return requestJson<DeviceTrackingPolicyV2>(
    config.apiBaseUrl,
    "/device-client/tracking-policy",
    config.credential,
    undefined,
    10_000,
    { retries: 2, method: "GET" },
  );
}

export function prepareProtocolV2(config: AgentConfig) {
  return requestJson<ProtocolV2PrepareResponse>(
    config.apiBaseUrl,
    "/device-client/protocol-v2/prepare",
    config.credential,
    {},
    10_000,
    { retries: 2 },
  );
}

export function confirmProtocolV2(
  config: AgentConfig,
  activationId: string,
  protocolActivatedAt: string,
) {
  return requestJson<ProtocolV2ConfirmResponse>(
    config.apiBaseUrl,
    "/device-client/protocol-v2/confirm",
    config.credential,
    { activationId, protocolActivatedAt },
    10_000,
    { retries: 2 },
  );
}

export function syncTrackingV2(
  config: AgentConfig,
  request: TrackingSyncRequestV2,
  requestId: string,
) {
  return requestJson<TrackingSyncResponseV2>(
    config.apiBaseUrl,
    "/device-client/sync-v2",
    config.credential,
    request,
    15_000,
    { requestId },
  );
}

export function isUpgradeRequiredError(error: unknown) {
  return (
    error instanceof AgentApiError &&
    (error.status === 426 ||
      error.responseCode === "UPGRADE_REQUIRED" ||
      /UPGRADE_REQUIRED/i.test(error.responseMessage ?? ""))
  );
}

export function isInactiveAgentSessionError(error: unknown) {
  return error instanceof AgentApiError
    && error.status === 403
    && /agent session is not active/i.test(error.responseMessage ?? error.message);
}

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  credential: string | undefined,
  body: unknown,
  timeoutMs = 10_000,
  options: { retries?: number; method?: "GET" | "POST"; requestId?: string } = {},
): Promise<T> {
  const retries = Math.max(0, Math.floor(options.retries ?? 0));
  let attempt = 0;
  while (attempt <= retries) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}${path}`, {
        method: options.method ?? "POST",
        headers: {
          Accept: "application/json",
          ...(options.method === "GET" ? {} : { "Content-Type": "application/json" }),
          ...(credential ? { Authorization: `Device ${credential}` } : {}),
          ...(options.requestId ? { "X-WorkMap-Request-Id": options.requestId } : {}),
        },
        ...(options.method === "GET" ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const apiError = new AgentApiError(friendlyNetworkError(error, "Network request failed."));
      if (attempt < retries) {
        await retryDelay(attempt);
        attempt += 1;
        continue;
      }
      throw apiError;
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      const message = detail.message
        ? `WorkMap API ${path} returned ${response.status}: ${detail.message}`
        : `WorkMap API ${path} returned ${response.status}.`;
      const apiError = new AgentApiError(
        message,
        response.status,
        detail.message,
        detail.code,
        readRetryAfterMs(response),
        detail.requestId ?? options.requestId,
        detail.stage,
      );
      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        await retryDelay(attempt);
        attempt += 1;
        continue;
      }
      throw apiError;
    }

    return await response.json() as T;
  }

  throw new AgentApiError("Network request failed.");
}

async function readErrorDetail(response: Response) {
  try {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text) as unknown;
      const message = extractErrorMessage(parsed);
      const code = extractErrorCode(parsed);
      const requestId = extractRequestId(parsed);
      const stage = extractTrackingStage(parsed);
      return {
        ...(message ? { message: sanitizeErrorDetail(message) } : {}),
        ...(code ? { code: sanitizeErrorCode(code) } : {}),
        ...(requestId ? { requestId } : {}),
        ...(stage ? { stage } : {}),
      };
    } catch {
      // Fall back to the raw text below.
    }
    return { message: sanitizeErrorDetail(text) };
  } catch {
    return {};
  }
}

function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (Array.isArray(body.message)) return body.message.filter((item): item is string => typeof item === "string").join(" ");
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  return undefined;
}

function extractErrorCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  return typeof body.code === "string" ? body.code : undefined;
}

function extractRequestId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ? requestId.toLowerCase()
    : undefined;
}

function extractTrackingStage(value: unknown):
  | "parse"
  | "policy"
  | "transaction"
  | "response"
  | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const stage = (value as Record<string, unknown>).stage;
  return stage === "parse" || stage === "policy" || stage === "transaction" || stage === "response"
    ? stage
    : undefined;
}

function sanitizeErrorDetail(value: string) {
  return value.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]").replace(/\s+/g, " ").trim().slice(0, 240);
}

function sanitizeErrorCode(value: string) {
  return value.replace(/[^A-Z0-9_-]/gi, "_").slice(0, 80);
}

function readRetryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function friendlyNetworkError(error: unknown, fallback: string) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The WorkMap service took too long to respond. Check the internet connection and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 250 * 2 ** Math.min(attempt, 3)));
}
