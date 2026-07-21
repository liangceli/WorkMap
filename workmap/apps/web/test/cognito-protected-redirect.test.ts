import assert from "node:assert/strict";
import test from "node:test";
import { getRequestedPostLoginPath, redirectToLoginForMissingCognitoSession } from "../lib/auth/cognitoRedirect";

test("a protected route with no Cognito session is sent to login with a safe return path", () => {
  const redirects: string[] = [];

  withBrowserPath("/reports", (location) => {
    location.replace = (path: string) => redirects.push(path);
    assert.equal(redirectToLoginForMissingCognitoSession(), true);
  });

  assert.deepEqual(redirects, ["/login?next=%2Freports"]);
});

test("public root, login and invitation routes do not redirect", () => {
  for (const pathname of ["/", "/login", "/login/callback", "/invite/example-token"]) {
    withBrowserPath(pathname, () => {
      assert.equal(redirectToLoginForMissingCognitoSession(), false);
    });
  }
});

test("post-login routing accepts only internal protected paths", () => {
  assert.equal(getRequestedPostLoginPath("?next=%2Freports"), "/reports");
  assert.equal(getRequestedPostLoginPath("?next=%2Fvirtual-office"), "/virtual-office");
  assert.equal(getRequestedPostLoginPath("?next=https%3A%2F%2Fevil.example"), null);
  assert.equal(getRequestedPostLoginPath("?next=%2F%2Fevil.example"), null);
  assert.equal(getRequestedPostLoginPath("?next=%2Flogin"), null);
});

function withBrowserPath(pathname: string, run: (location: { pathname: string; replace(path: string): void }) => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location: { pathname: string; replace(path: string): void } = { pathname, replace: () => undefined };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      location,
    },
  });

  try {
    run(location);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
