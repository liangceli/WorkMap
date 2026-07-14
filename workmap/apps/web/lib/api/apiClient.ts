import type { ApiClientOptions, ApiResult } from "./apiTypes";
import { redirectToRootForMissingCognitoSession } from "../auth/cognitoRedirect";

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

export async function workMapApiPatch<T>(path: string, body?: unknown, options: ApiClientOptions = {}): Promise<ApiResult<T>> {
  return workMapApiRequest<T>(
    path,
    {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}

export async function workMapApiPut<T>(path: string, body?: unknown, options: ApiClientOptions = {}): Promise<ApiResult<T>> {
  return workMapApiRequest<T>(
    path,
    {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}

async function workMapApiRequest<T>(
  path: string,
  init: RequestInit,
  { token, baseUrl = getWorkMapApiBaseUrl(), authSource }: ApiClientOptions,
): Promise<ApiResult<T>> {
  if (!baseUrl) {
    return { ok: false, error: "WorkMap API URL is not configured.", source: "fallback" };
  }

  try {
    let requestToken = token;
    if (authSource === "cognito") {
      requestToken = await resolveCognitoToken(false);
      if (!requestToken) {
        redirectToRootForMissingCognitoSession();
        return { ok: false, error: "Cognito session expired. Sign in again.", status: 401, source: "fallback" };
      }
    }

    let response = await sendApiRequest(baseUrl, path, init, requestToken);
    if (response.status === 401 && authSource === "cognito") {
      const refreshedToken = await resolveCognitoToken(true);
      if (refreshedToken) response = await sendApiRequest(baseUrl, path, init, refreshedToken);
      else redirectToRootForMissingCognitoSession();
    }

    if (!response.ok) {
      const detail = await readApiErrorDetail(response);
      return {
        ok: false,
        error: detail ? `WorkMap API returned ${response.status}: ${detail}` : `WorkMap API returned ${response.status}.`,
        status: response.status,
        source: "fallback",
      };
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

function sendApiRequest(baseUrl: string, path: string, init: RequestInit, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
}

async function readApiErrorDetail(response: Response) {
  try {
    const text = await response.text();
    if (!text.trim()) return undefined;
    try {
      const parsed = JSON.parse(text) as unknown;
      const message = extractApiErrorMessage(parsed);
      if (message) return sanitizeApiErrorMessage(message);
    } catch {
      // Fall back to the text response below.
    }
    return sanitizeApiErrorMessage(text);
  } catch {
    return undefined;
  }
}

function extractApiErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (Array.isArray(body.message)) return body.message.filter((item): item is string => typeof item === "string").join(" ");
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  return undefined;
}

function sanitizeApiErrorMessage(value: string) {
  return value
    .replace(/(?:bearer|device)\s+[A-Za-z0-9._-]+/gi, "[credential]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function resolveCognitoToken(forceRefresh: boolean) {
  const { restoreCognitoAccountSession } = await import("../auth/cognitoUserPoolAuth");
  const session = await restoreCognitoAccountSession(forceRefresh);
  return session?.idToken || session?.accessToken;
}
