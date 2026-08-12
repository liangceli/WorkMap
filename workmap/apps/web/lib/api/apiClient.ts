import type { ApiClientOptions, ApiResult } from "./apiTypes";
import { redirectToHomeForEndedCognitoSession } from "../auth/cognitoRedirect";
import { clearCognitoSession } from "../auth/cognitoSession";

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
  { token, baseUrl = getWorkMapApiBaseUrl(), authSource, signal, timeoutMs }: ApiClientOptions,
): Promise<ApiResult<T>> {
  if (!baseUrl) {
    return { ok: false, error: "WorkMap API URL is not configured.", source: "fallback" };
  }

  const requestControl = createRequestControl(signal, timeoutMs);
  try {
    let requestToken = token;
    if (authSource === "cognito") {
      const tokenResult = await resolveCognitoToken(false);
      if (!tokenResult.available) {
        return {
          ok: false,
          error: tokenResult.reason,
          status: tokenResult.retryable ? undefined : 401,
          source: "fallback",
        };
      }
      requestToken = tokenResult.token;
    }

    let response = await sendApiRequest(baseUrl, path, init, requestToken, requestControl.signal);
    if (response.status === 401 && authSource === "cognito") {
      const refreshedToken = await resolveCognitoToken(true);
      if (!refreshedToken.available) {
        return {
          ok: false,
          error: refreshedToken.reason,
          status: refreshedToken.retryable ? undefined : 401,
          source: "fallback",
        };
      }
      response = await sendApiRequest(baseUrl, path, init, refreshedToken.token, requestControl.signal);
      if (response.status === 401) {
        clearCognitoSession();
        redirectToHomeForEndedCognitoSession();
        return {
          ok: false,
          error: "WorkMap authentication ended.",
          status: 401,
          source: "fallback",
        };
      }
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
      error: requestControl.timedOut()
        ? "CandidGrid API request timed out. Please try again."
        : signal?.aborted
          ? "CandidGrid reports request was cancelled."
          : error instanceof Error ? error.message : "WorkMap API request failed.",
      source: "fallback",
    };
  } finally {
    requestControl.dispose();
  }
}

function sendApiRequest(baseUrl: string, path: string, init: RequestInit, token?: string, signal?: AbortSignal) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal,
  });
}

function createRequestControl(signal?: AbortSignal, timeoutMs?: number) {
  if (!signal && (!timeoutMs || timeoutMs <= 0)) {
    return { signal: undefined, timedOut: () => false, dispose: () => undefined };
  }
  const controller = new AbortController();
  let didTimeOut = false;
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = timeoutMs && timeoutMs > 0
    ? setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, timeoutMs)
    : null;
  return {
    signal: controller.signal,
    timedOut: () => didTimeOut,
    dispose: () => {
      if (timeout !== null) clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    },
  };
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
  const { getFreshCognitoApiAuthOptions } = await import("../auth/cognitoUserPoolAuth");
  const auth = await getFreshCognitoApiAuthOptions(forceRefresh);
  if (!auth.available) return auth;
  return { available: true as const, token: auth.session.idToken || auth.session.accessToken };
}
