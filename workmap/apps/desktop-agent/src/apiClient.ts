import type { AgentConfig, AppUsageEvent, CurrentAppActivity } from "./types.js";

export class AgentApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
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
  });
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

async function requestJson<T>(apiBaseUrl: string, path: string, credential: string | undefined, body: unknown): Promise<T> {
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
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new AgentApiError(error instanceof Error ? error.message : "Network request failed.");
  }
  if (!response.ok) throw new AgentApiError(`WorkMap API ${path} returned ${response.status}.`, response.status);
  return await response.json() as T;
}
