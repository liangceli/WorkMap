import type { ExtensionStatus } from "./extensionStorage.js";

export const BROWSER_CONNECTION_FRESH_MS = 90_000;

export type BrowserConnectionPresentation = {
  label:
    | "Online"
    | "Offline"
    | "Auth required"
    | "Upgrade required"
    | "Pairing"
    | "Not paired";
  detail?: string;
};

export function deriveStatusHealth(
  current: ExtensionStatus | undefined,
  nowMs = Date.now(),
): BrowserConnectionPresentation {
  if (!current) {
    return {
      label: "Offline",
      detail: "Waiting for the first server-confirmed heartbeat.",
    };
  }
  if (current.state === "auth_required") return { label: "Auth required" };
  if (current.state === "upgrade_required") {
    return { label: "Upgrade required" };
  }
  if (current.state === "pairing") return { label: "Pairing" };
  if (current.state === "unpaired") return { label: "Not paired" };

  const heartbeatMs = current.lastHeartbeatAt
    ? Date.parse(current.lastHeartbeatAt)
    : Number.NaN;
  if (!Number.isFinite(heartbeatMs)) {
    return {
      label: "Offline",
      detail: "Waiting for the first server-confirmed heartbeat.",
    };
  }
  if (Math.max(0, nowMs - heartbeatMs) <= BROWSER_CONNECTION_FRESH_MS) {
    return { label: "Online" };
  }
  return {
    label: "Offline",
    detail:
      "The last server-confirmed heartbeat is older than 90 seconds. The extension is retrying until WorkMap confirms a fresh heartbeat.",
  };
}

export function collectorStatusLabel(current: ExtensionStatus | undefined) {
  return current?.collectorState ?? "UNKNOWN";
}
