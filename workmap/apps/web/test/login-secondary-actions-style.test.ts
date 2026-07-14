import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const authFormSource = readFileSync(join(webRoot, "components", "login", "CognitoAuthForm.tsx"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("authentication secondary actions use the muted underlined text-link treatment", () => {
  assert.match(authFormSource, /className="wm-auth-text-link"[\s\S]*?Forgot password\?/);
  assert.match(authFormSource, /className="wm-auth-text-link"[\s\S]*?Resend confirmation code/);
  assert.match(authFormSource, /className="wm-auth-text-link"[\s\S]*?Back to sign in/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-text-link[\s\S]*?background:\s*transparent\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-text-link[\s\S]*?border-bottom:\s*1px solid #8a92a0\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-text-link[\s\S]*?color:\s*#687184\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-text-link[\s\S]*?min-height:\s*auto\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-text-link:focus-visible/);
});

test("password visibility toggle remains centered inside the 44px password input", () => {
  assert.match(authFormSource, /className="wm-auth-password-toggle"[\s\S]*?aria-label=\{visible \? "Hide password" : "Show password"\}/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-password-toggle[\s\S]*?top:\s*2px\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-password-toggle[\s\S]*?right:\s*2px\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-password-toggle[\s\S]*?width:\s*40px\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-password-toggle[\s\S]*?height:\s*40px\s*!important/);
  assert.match(redesignStyles, /\.wm-auth-form \.wm-auth-password-toggle[\s\S]*?min-height:\s*40px\s*!important/);
});
