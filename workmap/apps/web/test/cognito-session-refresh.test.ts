import assert from "node:assert/strict";
import test from "node:test";
import { workMapApiGet } from "../lib/api/apiClient";
import { clearCognitoSession, getCognitoSession, storeCognitoTokenSession } from "../lib/auth/cognitoSession";

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

function restoreProperty(target: typeof globalThis, key: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function restoreEnvironment(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
