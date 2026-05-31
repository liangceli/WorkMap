import type { ApiClientOptions, ApiResult } from "./apiTypes";

const DEFAULT_DEV_API_URL = "http://localhost:3001";

export function getWorkMapApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_WORKMAP_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development" ? DEFAULT_DEV_API_URL : "";
}

export async function workMapApiGet<T>(path: string, options: ApiClientOptions = {}): Promise<ApiResult<T>> {
  return workMapApiRequest<T>(path, { method: "GET" }, options);
}

export async function workMapApiPost<T>(path: string, body?: unknown, options: ApiClientOptions = {}): Promise<ApiResult<T>> {
  return workMapApiRequest<T>(
    path,
    {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}

async function workMapApiRequest<T>(
  path: string,
  init: RequestInit,
  { token, baseUrl = getWorkMapApiBaseUrl() }: ApiClientOptions,
): Promise<ApiResult<T>> {
  if (!baseUrl) {
    return { ok: false, error: "WorkMap API URL is not configured.", source: "fallback" };
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, error: `WorkMap API returned ${response.status}.`, status: response.status, source: "fallback" };
    }

    return { ok: true, data: (await response.json()) as T, source: "api" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WorkMap API request failed.",
      source: "fallback",
    };
  }
}
