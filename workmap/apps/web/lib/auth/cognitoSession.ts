"use client";

import type { ApiClientOptions } from "../api/apiTypes";

const COGNITO_SESSION_STORAGE_KEY = "workmap.cognitoSession";
const COGNITO_TRANSACTION_STORAGE_KEY = "workmap.cognitoTransaction";
const DEFAULT_COGNITO_SCOPE = "openid email profile";

export type StoredCognitoSession = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresAt: string;
  claims: {
    sub: string;
    email?: string;
    displayName?: string;
    username?: string;
    tokenUse?: string;
  };
};

export class CognitoSessionRefreshError extends Error {
  constructor(
    message: string,
    readonly terminal: boolean,
  ) {
    super(message);
    this.name = "CognitoSessionRefreshError";
  }
}

type CognitoConfig = {
  region: string;
  userPoolId: string;
  appClientId: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
  scope: string;
};

type CognitoConfigStatus =
  | { configured: true; config: CognitoConfig }
  | { configured: false; missing: string[]; message: string };

export type CognitoUserPoolConfigStatus =
  | {
      configured: true;
      config: {
        region: string;
        userPoolId: string;
        appClientId: string;
      };
    }
  | { configured: false; missing: string[]; message: string };

type CognitoTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
};

type CognitoTokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

type CognitoIdTokenClaims = {
  sub?: string;
  email?: string;
  name?: string;
  "cognito:username"?: string;
  token_use?: string;
  exp?: number;
  nonce?: string;
};

export function getCognitoConfigStatus(): CognitoConfigStatus {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION?.trim() ?? "";
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim() ?? "";
  const appClientId = process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID?.trim() ?? "";
  const domain = normalizeUrl(process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim() ?? "");
  const redirectUri =
    process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI?.trim() ||
    (typeof window !== "undefined" ? `${window.location.origin}/login/callback` : "");
  const logoutUri =
    process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI?.trim() ||
    (typeof window !== "undefined" ? `${window.location.origin}/login` : "");
  const missing = [
    ["NEXT_PUBLIC_COGNITO_REGION", region],
    ["NEXT_PUBLIC_COGNITO_USER_POOL_ID", userPoolId],
    ["NEXT_PUBLIC_COGNITO_APP_CLIENT_ID", appClientId],
    ["NEXT_PUBLIC_COGNITO_DOMAIN", domain],
    ["NEXT_PUBLIC_COGNITO_REDIRECT_URI", redirectUri],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      message: `Cognito is not configured yet. Missing: ${missing.join(", ")}.`,
    };
  }

  return {
    configured: true,
    config: {
      region,
      userPoolId,
      appClientId,
      domain,
      redirectUri,
      logoutUri,
      scope: process.env.NEXT_PUBLIC_COGNITO_SCOPE?.trim() || DEFAULT_COGNITO_SCOPE,
    },
  };
}

export function getCognitoUserPoolConfigStatus(): CognitoUserPoolConfigStatus {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION?.trim() ?? "";
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim() ?? "";
  const appClientId = process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID?.trim() ?? "";
  const missing = [
    ["NEXT_PUBLIC_COGNITO_REGION", region],
    ["NEXT_PUBLIC_COGNITO_USER_POOL_ID", userPoolId],
    ["NEXT_PUBLIC_COGNITO_APP_CLIENT_ID", appClientId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      message: `Cognito user pool is not configured yet. Missing: ${missing.join(", ")}.`,
    };
  }

  return {
    configured: true,
    config: {
      region,
      userPoolId,
      appClientId,
    },
  };
}

export function getCognitoSession(): StoredCognitoSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(COGNITO_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isStoredCognitoSession(parsed)) {
      clearCognitoSession();
      return null;
    }

    if (isExpired(parsed.expiresAt)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function hasStoredCognitoSession() {
  return Boolean(readStoredCognitoSession());
}

export function getCognitoApiAuthOptions():
  | { available: true; options: ApiClientOptions; session: StoredCognitoSession; cognitoSub: string; email?: string }
  | { available: false; reason: string } {
  const session = getCognitoSession();

  if (!session) {
    return { available: false, reason: "No active Cognito session." };
  }

  return {
    available: true,
    options: { token: session.idToken || session.accessToken, authSource: "cognito" },
    session,
    cognitoSub: session.claims.sub,
    email: session.claims.email,
  };
}

type StartCognitoAuthOptions = {
  loginHint?: string;
};

export async function startCognitoSignIn(options: StartCognitoAuthOptions = {}) {
  await startCognitoAuth("authorize", options);
}

export async function startCognitoSignUp(options: StartCognitoAuthOptions = {}) {
  await startCognitoAuth("signup", options);
}

async function startCognitoAuth(entry: "authorize" | "signup", options: StartCognitoAuthOptions) {
  const status = getCognitoConfigStatus();

  if (!status.configured) {
    throw new Error(status.message);
  }

  const transaction = await createTransaction();
  writeTransaction(transaction);

  const params = new URLSearchParams({
    client_id: status.config.appClientId,
    code_challenge: await createCodeChallenge(transaction.codeVerifier),
    code_challenge_method: "S256",
    nonce: transaction.nonce,
    redirect_uri: status.config.redirectUri,
    response_type: "code",
    scope: status.config.scope,
    state: transaction.state,
  });
  const loginHint = options.loginHint?.trim().toLowerCase();

  if (loginHint) {
    params.set("login_hint", loginHint);
  }

  window.location.assign(`${status.config.domain}/${entry === "signup" ? "signup" : "oauth2/authorize"}?${params.toString()}`);
}

export async function completeCognitoRedirect(currentUrl?: string):
  Promise<{ ok: true; session: StoredCognitoSession } | { ok: false; error: string }> {
  const status = getCognitoConfigStatus();

  if (!status.configured) {
    return { ok: false, error: status.message };
  }

  const url = new URL(currentUrl ?? window.location.href);
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return { ok: false, error: url.searchParams.get("error_description") || providerError };
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const transaction = readTransaction();

  if (!code || !state || !transaction || transaction.state !== state) {
    return { ok: false, error: "Cognito redirect state was missing or invalid." };
  }

  const body = new URLSearchParams({
    client_id: status.config.appClientId,
    code,
    code_verifier: transaction.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: status.config.redirectUri,
  });

  const response = await fetch(`${status.config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return { ok: false, error: `Cognito token exchange failed with ${response.status}.` };
  }

  const tokenResponse = (await response.json()) as CognitoTokenResponse;

  if (!tokenResponse.access_token || !tokenResponse.id_token || tokenResponse.token_type !== "Bearer") {
    return { ok: false, error: "Cognito token response was incomplete." };
  }

  const claims = decodeJwtPayload<CognitoIdTokenClaims>(tokenResponse.id_token);

  if (!claims.sub) {
    return { ok: false, error: "Cognito ID token did not include a subject." };
  }

  if (claims.nonce && claims.nonce !== transaction.nonce) {
    return { ok: false, error: "Cognito ID token nonce did not match the sign-in request." };
  }

  const session = createStoredSession(
    tokenResponse.access_token,
    tokenResponse.id_token,
    tokenResponse.refresh_token,
    tokenResponse.expires_in,
  );

  saveCognitoSession(session);
  clearTransaction();

  return { ok: true, session };
}

export function clearCognitoSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COGNITO_SESSION_STORAGE_KEY);
  clearTransaction();
}

export function storeCognitoTokenSession(accessToken: string, idToken: string, refreshToken?: string) {
  const session = createStoredSession(accessToken, idToken, refreshToken);

  saveCognitoSession(session);
  return session;
}

export async function refreshHostedCognitoSession(forceRefresh = false) {
  const current = getCognitoSession();
  if (current && !forceRefresh) return current;

  const stored = readStoredCognitoSession();
  if (!stored?.refreshToken) return null;
  const status = getCognitoConfigStatus();
  if (!status.configured) return null;

  const body = new URLSearchParams({
    client_id: status.config.appClientId,
    grant_type: "refresh_token",
    refresh_token: stored.refreshToken,
  });
  const response = await fetch(`${status.config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const errorCode = await readCognitoRefreshErrorCode(response);
    const terminal =
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && ["invalid_grant", "invalid_client", "unauthorized_client"].includes(errorCode ?? ""));
    throw new CognitoSessionRefreshError(`Cognito session refresh failed with ${response.status}.`, terminal);
  }

  const tokenResponse = (await response.json()) as CognitoTokenResponse;
  if (!tokenResponse.access_token || !tokenResponse.id_token || tokenResponse.token_type !== "Bearer") {
    throw new Error("Cognito refresh response was incomplete.");
  }
  const claims = decodeJwtPayload<CognitoIdTokenClaims>(tokenResponse.id_token);
  if (!claims.sub || claims.sub !== stored.claims.sub) {
    throw new Error("Cognito refresh identity did not match the stored session.");
  }

  const session = createStoredSession(
    tokenResponse.access_token,
    tokenResponse.id_token,
    tokenResponse.refresh_token ?? stored.refreshToken,
    tokenResponse.expires_in,
  );
  saveCognitoSession(session);
  return session;
}

export function getCognitoLogoutUrl() {
  const status = getCognitoConfigStatus();

  if (!status.configured) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: status.config.appClientId,
    logout_uri: status.config.logoutUri,
  });

  return `${status.config.domain}/logout?${params.toString()}`;
}

function saveCognitoSession(session: StoredCognitoSession) {
  window.localStorage.setItem(COGNITO_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readStoredCognitoSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COGNITO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isStoredCognitoSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readCognitoRefreshErrorCode(response: Response) {
  try {
    const body = (await response.json()) as unknown;
    return isObject(body) && typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

function createStoredSession(accessToken: string, idToken: string, refreshToken?: string, expiresIn?: number): StoredCognitoSession {
  const claims = decodeJwtPayload<CognitoIdTokenClaims>(idToken);
  if (!claims.sub) throw new Error("Cognito ID token did not include a subject.");
  return {
    accessToken,
    idToken,
    refreshToken,
    tokenType: "Bearer",
    expiresAt: new Date((claims.exp ?? Math.floor(Date.now() / 1000) + (expiresIn ?? 3600)) * 1000).toISOString(),
    claims: {
      sub: claims.sub,
      email: claims.email,
      displayName: claims.name,
      username: claims["cognito:username"],
      tokenUse: claims.token_use,
    },
  };
}

async function createTransaction(): Promise<CognitoTransaction> {
  return {
    state: randomString(),
    nonce: randomString(),
    codeVerifier: randomString(),
    createdAt: Date.now(),
  };
}

function writeTransaction(transaction: CognitoTransaction) {
  window.sessionStorage.setItem(COGNITO_TRANSACTION_STORAGE_KEY, JSON.stringify(transaction));
}

function readTransaction(): CognitoTransaction | null {
  try {
    const raw = window.sessionStorage.getItem(COGNITO_TRANSACTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isCognitoTransaction(parsed) || parsed.createdAt < Date.now() - 10 * 60 * 1000) {
      clearTransaction();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearTransaction() {
  try {
    window.sessionStorage.removeItem(COGNITO_TRANSACTION_STORAGE_KEY);
  } catch {
    // Cognito sign-in can still be retried.
  }
}

async function createCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function randomString() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeJwtPayload<T>(token: string): T {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("JWT payload is missing.");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(window.atob(padded)) as T;
}

function normalizeUrl(value: string) {
  if (!value || !/^https?:\/\//.test(value)) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function isExpired(expiresAt: string) {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= Date.now() + 60_000;
}

function isStoredCognitoSession(value: unknown): value is StoredCognitoSession {
  return (
    isObject(value) &&
    typeof value.accessToken === "string" &&
    typeof value.idToken === "string" &&
    (value.refreshToken === undefined || typeof value.refreshToken === "string") &&
    value.tokenType === "Bearer" &&
    typeof value.expiresAt === "string" &&
    isObject(value.claims) &&
    typeof value.claims.sub === "string"
  );
}

function isCognitoTransaction(value: unknown): value is CognitoTransaction {
  return (
    isObject(value) &&
    typeof value.state === "string" &&
    typeof value.nonce === "string" &&
    typeof value.codeVerifier === "string" &&
    typeof value.createdAt === "number"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
