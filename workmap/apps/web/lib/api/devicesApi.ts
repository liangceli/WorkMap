import { workMapApiGet, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiDevice, WorkMapApiDeviceRegistration, WorkMapApiPairingCode } from "./apiTypes";

export type RegisterDeviceInput = {
  deviceId?: string;
  os?: string;
  hostname?: string;
  agentVersion?: string;
};

export function listDevices(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiDevice[]>("/devices", options);
}

export function registerDevice(input: RegisterDeviceInput, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiDeviceRegistration>("/devices/register", input, options);
}

export function recordDeviceHeartbeat(input: { deviceId: string; agentVersion?: string }, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiDeviceRegistration>("/devices/heartbeat", input, options);
}

export function createDevicePairingCode(clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION", options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiPairingCode>("/devices/pairing-codes", { clientType }, options);
}

export function revokeDevice(deviceId: string, options?: ApiClientOptions) {
  return workMapApiPost<{ deviceId: string; revokedAt: string }>(`/devices/${deviceId}/revoke`, undefined, options);
}
