import assert from "node:assert/strict";
import test from "node:test";
import { redirectToRootForMissingCognitoSession } from "../lib/auth/cognitoRedirect";

test("a protected route with no Cognito session is replaced by the root route", () => {
  const redirects: string[] = [];

  withBrowserPath("/reports", (location) => {
    location.replace = (path: string) => redirects.push(path);
    assert.equal(redirectToRootForMissingCognitoSession(), true);
  });

  assert.deepEqual(redirects, ["/"]);
});

test("public root, login and invitation routes do not redirect", () => {
  for (const pathname of ["/", "/login", "/login/callback", "/invite/example-token"]) {
    withBrowserPath(pathname, () => {
      assert.equal(redirectToRootForMissingCognitoSession(), false);
    });
  }
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
