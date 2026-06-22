import type { AgentConfig, AppUsageEvent, CurrentAppActivity } from "./types.js";

export class AgentApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
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

export function startAgentSession(config: AgentConfig) {
  return requestJson<{ sessionId: string; startedAt: string }>(config.apiBaseUrl, "/device-client/session/start", config.credential, {
    agentVersion: config.agentVersion,
  });
}

export function stopAgentSession(config: AgentConfig, sessionId: string) {
  return requestJson(config.apiBaseUrl, "/device-client/session/stop", config.credential, { sessionId });
}

export function sendHeartbeat(config: AgentConfig, sessionId?: string, currentActivity?: CurrentAppActivity | null) {
  return requestJson(config.apiBaseUrl, "/device-client/heartbeat", config.credential, {
    agentVersion: config.agentVersion,
    ...(sessionId ? { sessionId, currentActivity: currentActivity ?? null } : {}),
  });
}

export function sendAppUsage(config: AgentConfig, events: AppUsageEvent[]) {
  return requestJson<{ accepted: number }>(config.apiBaseUrl, "/device-client/app-usage", config.credential, { events });
}

async function requestJson<T>(
  apiBaseUrl: string,
  path: string,
  credential: string | undefined,
  body: unknown,
  timeoutMs = 10_000,
): Promise<T> {
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
    throw new AgentApiError(friendlyNetworkError(error, "Network request failed."));
  }
  if (!response.ok) throw new AgentApiError(`WorkMap API ${path} returned ${response.status}.`, response.status);
  return await response.json() as T;
}

function friendlyNetworkError(error: unknown, fallback: string) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The WorkMap service took too long to respond. Check the internet connection and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}
