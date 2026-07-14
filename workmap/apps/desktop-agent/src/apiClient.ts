import type { AgentConfig, AppUsageEvent, CurrentAppActivity, DeviceStatusEvent } from "./types.js";

export class AgentApiError extends Error {
  constructor(message: string, readonly status?: number, readonly responseMessage?: string) { super(message); }
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
  options: { retries?: number } = {},
): Promise<T> {
  const retries = Math.max(0, Math.floor(options.retries ?? 0));
  let attempt = 0;
  while (attempt <= retries) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(credential ? { Authorization: `Device ${credential}` } : {}),
        },
        body: JSON.stringify(body),
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
      const responseMessage = await readErrorDetail(response);
      const message = responseMessage
        ? `WorkMap API ${path} returned ${response.status}: ${responseMessage}`
        : `WorkMap API ${path} returned ${response.status}.`;
      const apiError = new AgentApiError(message, response.status, responseMessage);
      if (response.status >= 500 && attempt < retries) {
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
    if (!text.trim()) return undefined;
    try {
      const parsed = JSON.parse(text) as unknown;
      const message = extractErrorMessage(parsed);
      if (message) return sanitizeErrorDetail(message);
    } catch {
      // Fall back to the raw text below.
    }
    return sanitizeErrorDetail(text);
  } catch {
    return undefined;
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

function sanitizeErrorDetail(value: string) {
  return value.replace(/wmdev_[A-Za-z0-9_-]+/g, "[credential]").replace(/\s+/g, " ").trim().slice(0, 240);
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
