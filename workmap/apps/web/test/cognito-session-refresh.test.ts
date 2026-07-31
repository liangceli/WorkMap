import assert from "node:assert/strict";
import test from "node:test";
import { workMapApiGet } from "../lib/api/apiClient";
import {
  clearCognitoSession,
  getCognitoSession,
  hasStoredCognitoSession,
  storeCognitoTokenSession,
} from "../lib/auth/cognitoSession";

const ENV_KEYS = [
  "NEXT_PUBLIC_COGNITO_REGION",
  "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
  "NEXT_PUBLIC_COGNITO_APP_CLIENT_ID",
  "NEXT_PUBLIC_COGNITO_DOMAIN",
  "NEXT_PUBLIC_COGNITO_REDIRECT_URI",
] as const;

test("an expired hosted Cognito session refreshes before a cached API client token is used", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  let refreshRequests = 0;
  let apiRequests = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      localStorage,
      sessionStorage,
      location: { origin: "https://app.workmap.test" },
    },
  });

  process.env.NEXT_PUBLIC_COGNITO_REGION = "ap-southeast-2";
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-southeast-2_test";
  process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID = "workmap-web-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "https://auth.workmap.test";
  process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI = "https://app.workmap.test/login/callback";

  const expiredIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) - 120 });
  const refreshedIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 3600 });
  storeCognitoTokenSession("expired-access-token", expiredIdToken, "stored-refresh-token");

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url === "https://auth.workmap.test/oauth2/token") {
      refreshRequests += 1;
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("refresh_token"), "stored-refresh-token");
      return Response.json({
        access_token: "refreshed-access-token",
        id_token: refreshedIdToken,
        token_type: "Bearer",
        expires_in: 3600,
      });
    }

    if (url === "https://api.workmap.test/protected") {
      apiRequests += 1;
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${refreshedIdToken}`);
      return Response.json({ refreshed: true });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    assert.equal(getCognitoSession(), null);

    const result = await workMapApiGet<{ refreshed: boolean }>("/protected", {
      baseUrl: "https://api.workmap.test",
      token: expiredIdToken,
      authSource: "cognito",
    });

    assert.deepEqual(result, { ok: true, data: { refreshed: true }, source: "api" });
    assert.equal(refreshRequests, 1);
    assert.equal(apiRequests, 1);
    assert.equal(getCognitoSession()?.refreshToken, "stored-refresh-token");
  } finally {
    clearCognitoSession();
    globalThis.fetch = previousFetch;
    restoreProperty(globalThis, "window", previousWindow);
    for (const key of ENV_KEYS) restoreEnvironment(key, previousEnvironment[key]);
  }
});

test("a Cognito API 401 forces one refresh and retries the original request", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const redirects: string[] = [];
  let refreshRequests = 0;
  let apiRequests = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      localStorage,
      sessionStorage,
      location: {
        origin: "https://app.workmap.test",
        pathname: "/reports",
        search: "",
        replace: (path: string) => redirects.push(path),
      },
    },
  });

  configureTestEnvironment();
  const currentIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 3600 });
  const refreshedIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 7200 });
  storeCognitoTokenSession("current-access-token", currentIdToken, "stored-refresh-token");

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://auth.workmap.test/oauth2/token") {
      refreshRequests += 1;
      return Response.json({
        access_token: "refreshed-access-token",
        id_token: refreshedIdToken,
        token_type: "Bearer",
        expires_in: 7200,
      });
    }
    if (url === "https://api.workmap.test/protected") {
      apiRequests += 1;
      const authorization = new Headers(init?.headers).get("Authorization");
      if (apiRequests === 1) {
        assert.equal(authorization, `Bearer ${currentIdToken}`);
        return Response.json({ message: "expired" }, { status: 401 });
      }
      assert.equal(authorization, `Bearer ${refreshedIdToken}`);
      return Response.json({ refreshed: true });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await workMapApiGet<{ refreshed: boolean }>("/protected", {
      baseUrl: "https://api.workmap.test",
      token: currentIdToken,
      authSource: "cognito",
    });
    assert.deepEqual(result, { ok: true, data: { refreshed: true }, source: "api" });
    assert.equal(refreshRequests, 1);
    assert.equal(apiRequests, 2);
    assert.deepEqual(redirects, []);
  } finally {
    clearCognitoSession();
    globalThis.fetch = previousFetch;
    restoreProperty(globalThis, "window", previousWindow);
    for (const key of ENV_KEYS) restoreEnvironment(key, previousEnvironment[key]);
  }
});

test("a temporary Cognito refresh failure keeps the session and succeeds on retry", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const redirects: string[] = [];
  let refreshRequests = 0;
  let apiRequests = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      localStorage,
      sessionStorage,
      location: {
        origin: "https://app.workmap.test",
        pathname: "/reports",
        search: "",
        replace: (path: string) => redirects.push(path),
      },
    },
  });

  configureTestEnvironment();
  const expiredIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) - 120 });
  const refreshedIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 3600 });
  storeCognitoTokenSession("expired-access-token", expiredIdToken, "stored-refresh-token");

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://auth.workmap.test/oauth2/token") {
      refreshRequests += 1;
      if (refreshRequests <= 2) throw new TypeError("Temporary network failure");
      return Response.json({
        access_token: "refreshed-access-token",
        id_token: refreshedIdToken,
        token_type: "Bearer",
        expires_in: 3600,
      });
    }
    if (url === "https://api.workmap.test/protected") {
      apiRequests += 1;
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${refreshedIdToken}`);
      return Response.json({ refreshed: true });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const first = await workMapApiGet<{ refreshed: boolean }>("/protected", {
      baseUrl: "https://api.workmap.test",
      token: expiredIdToken,
      authSource: "cognito",
    });
    assert.equal(first.ok, false);
    if (!first.ok) {
      assert.equal(first.status, undefined);
      assert.match(first.error, /session was kept/i);
    }
    assert.equal(hasStoredCognitoSession(), true);
    assert.deepEqual(redirects, []);
    assert.equal(refreshRequests, 2, "the first request performs one bounded automatic retry");

    const second = await workMapApiGet<{ refreshed: boolean }>("/protected", {
      baseUrl: "https://api.workmap.test",
      token: expiredIdToken,
      authSource: "cognito",
    });
    assert.deepEqual(second, { ok: true, data: { refreshed: true }, source: "api" });
    assert.equal(refreshRequests, 3);
    assert.equal(apiRequests, 1);
    assert.deepEqual(redirects, []);
  } finally {
    clearCognitoSession();
    globalThis.fetch = previousFetch;
    restoreProperty(globalThis, "window", previousWindow);
    for (const key of ENV_KEYS) restoreEnvironment(key, previousEnvironment[key]);
  }
});

test("an explicitly invalid refresh token clears the session and redirects to the public home page", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const redirects: string[] = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      localStorage,
      sessionStorage,
      location: {
        origin: "https://app.workmap.test",
        pathname: "/reports",
        search: "",
        replace: (path: string) => redirects.push(path),
      },
    },
  });

  configureTestEnvironment();
  const expiredIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) - 120 });
  storeCognitoTokenSession("expired-access-token", expiredIdToken, "invalid-refresh-token");
  globalThis.fetch = async (input) => {
    if (String(input) === "https://auth.workmap.test/oauth2/token") {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };

  try {
    const result = await workMapApiGet("/protected", {
      baseUrl: "https://api.workmap.test",
      token: expiredIdToken,
      authSource: "cognito",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.match(result.error, /authentication ended/i);
    }
    assert.equal(hasStoredCognitoSession(), false);
    assert.deepEqual(redirects, ["/"]);
  } finally {
    clearCognitoSession();
    globalThis.fetch = previousFetch;
    restoreProperty(globalThis, "window", previousWindow);
    for (const key of ENV_KEYS) restoreEnvironment(key, previousEnvironment[key]);
  }
});

test("a Cognito API 401 after one successful forced refresh ends the session and redirects home", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousEnvironment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const redirects: string[] = [];
  let refreshRequests = 0;
  let apiRequests = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
      localStorage,
      sessionStorage,
      location: {
        origin: "https://app.workmap.test",
        pathname: "/reports",
        search: "",
        replace: (path: string) => redirects.push(path),
      },
    },
  });

  configureTestEnvironment();
  const currentIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 3600 });
  const refreshedIdToken = createIdToken({ sub: "owner-1", exp: Math.floor(Date.now() / 1000) + 7200 });
  storeCognitoTokenSession("current-access-token", currentIdToken, "stored-refresh-token");

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://auth.workmap.test/oauth2/token") {
      refreshRequests += 1;
      return Response.json({
        access_token: "refreshed-access-token",
        id_token: refreshedIdToken,
        token_type: "Bearer",
        expires_in: 7200,
      });
    }
    if (url === "https://api.workmap.test/protected") {
      apiRequests += 1;
      return Response.json({ message: "unauthorized" }, { status: 401 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await workMapApiGet("/protected", {
      baseUrl: "https://api.workmap.test",
      token: currentIdToken,
      authSource: "cognito",
    });
    assert.deepEqual(result, {
      ok: false,
      error: "WorkMap authentication ended.",
      status: 401,
      source: "fallback",
    });
    assert.equal(refreshRequests, 1);
    assert.equal(apiRequests, 2);
    assert.equal(hasStoredCognitoSession(), false);
    assert.deepEqual(redirects, ["/"]);
  } finally {
    clearCognitoSession();
    globalThis.fetch = previousFetch;
    restoreProperty(globalThis, "window", previousWindow);
    for (const key of ENV_KEYS) restoreEnvironment(key, previousEnvironment[key]);
  }
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function createIdToken(payload: { sub: string; exp: number }) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

function configureTestEnvironment() {
  process.env.NEXT_PUBLIC_COGNITO_REGION = "ap-southeast-2";
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-southeast-2_test";
  process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID = "workmap-web-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "https://auth.workmap.test";
  process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI = "https://app.workmap.test/login/callback";
}

function restoreProperty(target: typeof globalThis, key: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function restoreEnvironment(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
