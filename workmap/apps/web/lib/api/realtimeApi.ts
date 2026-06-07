import { getWorkMapApiBaseUrl } from "./apiClient";
import type { ApiClientOptions } from "./apiTypes";

const VIRTUAL_OFFICE_REALTIME_PATH = "/virtual-office/realtime";

export function getVirtualOfficeRealtimeUrl(options?: ApiClientOptions) {
  const baseUrl = options?.baseUrl ?? getWorkMapApiBaseUrl();

  if (!baseUrl || !options?.token) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = VIRTUAL_OFFICE_REALTIME_PATH;
    url.search = "";
    url.hash = "";
    url.searchParams.set("token", options.token);
    return url.toString();
  } catch {
    return null;
  }
}
