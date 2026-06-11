type WorkMapAgentConfig = {
  apiBaseUrl: string;
  token: string;
  deviceId?: string;
  hostname?: string;
  os?: string;
  agentVersion: string;
};

type WorkMapDeviceRegistration = {
  device: {
    id: string;
  };
};

type WorkMapUsageEvent = {
  deviceId: string;
  appName: string;
  startedAt: string;
  endedAt: string;
  isIdle?: boolean;
};

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  platform?: string;
  exitCode?: number;
};

const DEFAULT_AGENT_VERSION = "desktop-agent-harness/0.1.0";

export async function registerAgentDevice(config = readAgentConfig()) {
  return postJson<WorkMapDeviceRegistration>(config, "/devices/register", {
    deviceId: config.deviceId,
    os: config.os ?? normalizePlatform(process.platform),
    hostname: config.hostname,
    agentVersion: config.agentVersion,
  });
}

export async function sendHeartbeat(config: WorkMapAgentConfig, deviceId: string) {
  return postJson<WorkMapDeviceRegistration>(config, "/devices/heartbeat", {
    deviceId,
    agentVersion: config.agentVersion,
  });
}

export async function sendAppUsage(config: WorkMapAgentConfig, events: WorkMapUsageEvent[]) {
  return postJson(config, "/activity/app-usage", { events });
}

export async function runSampleAgentOnce() {
  const config = readAgentConfig();
  const registration = await registerAgentDevice(config);
  const deviceId = registration.device.id;
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - readSampleDurationMs());

  await sendHeartbeat(config, deviceId);
  await sendAppUsage(config, [
    {
      deviceId,
      appName: process.env.WORKMAP_AGENT_SAMPLE_APP?.trim() || "VS Code",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      isIdle: false,
    },
  ]);

  console.info(`WorkMap desktop-agent harness submitted one app usage event for device ${deviceId}.`);
}

function readAgentConfig(): WorkMapAgentConfig {
  const apiBaseUrl = process.env.WORKMAP_API_BASE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WORKMAP_AGENT_TOKEN?.trim();

  if (!apiBaseUrl) {
    throw new Error("WORKMAP_API_BASE_URL is required for the desktop-agent harness.");
  }

  if (!token) {
    throw new Error("WORKMAP_AGENT_TOKEN is required for the desktop-agent harness.");
  }

  return {
    apiBaseUrl,
    token,
    deviceId: process.env.WORKMAP_AGENT_DEVICE_ID?.trim() || undefined,
    hostname: process.env.WORKMAP_AGENT_HOSTNAME?.trim() || undefined,
    os: process.env.WORKMAP_AGENT_OS?.trim() || undefined,
    agentVersion: process.env.WORKMAP_AGENT_VERSION?.trim() || DEFAULT_AGENT_VERSION,
  };
}

async function postJson<T = unknown>(config: WorkMapAgentConfig, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`WorkMap API ${path} returned ${response.status}.`);
  }

  return (await response.json()) as T;
}

function readSampleDurationMs() {
  const configured = Number(process.env.WORKMAP_AGENT_SAMPLE_DURATION_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 5 * 60 * 1000;
}

function normalizePlatform(platform: string | undefined) {
  if (platform === "win32") {
    return "WINDOWS";
  }

  if (platform === "darwin") {
    return "MACOS";
  }

  if (platform === "linux") {
    return "LINUX";
  }

  return "UNKNOWN";
}

if (process.argv.includes("--sample-once")) {
  runSampleAgentOnce().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
