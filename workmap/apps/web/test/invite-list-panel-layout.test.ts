import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const invitePageSource = readFileSync(join(webRoot, "app", "onboarding", "invite", "page.tsx"), "utf8");
const redesignStyles = readFileSync(join(webRoot, "app", "workspace-redesign.css"), "utf8");

test("recent invitations uses a dedicated dark workspace-access panel", () => {
  assert.match(invitePageSource, /wm-invite-list-heading/);
  assert.match(invitePageSource, /wm-invitation-row/);
  assert.match(invitePageSource, /wm-invitation-email/);
  assert.match(invitePageSource, /wm-invitation-status/);
  assert.match(redesignStyles, /\.wm-invite-list-panel[\s\S]*?background:\s*var\(--wm-primary\)\s*!important/);
  assert.match(redesignStyles, /\.wm-invitation-row[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.055\)\s*!important/);
});

test("recent invitations protects long email and status content on narrow screens", () => {
  assert.match(redesignStyles, /\.wm-invitation-email[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(redesignStyles, /\.wm-invitation-status[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(
    redesignStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.wm-invitation-row[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});

test("recent invitations uses a decorative access marker rather than a quota indicator and keeps breathing room", () => {
  assert.match(redesignStyles, /\.wm-invite-list-panel[\s\S]*?padding:\s*clamp\(20px, 2\.2vw, 28px\)\s*!important/);
  assert.match(redesignStyles, /\.wm-invite-list-panel::before[\s\S]*?width:\s*4px[\s\S]*?height:\s*42px/);
  assert.match(redesignStyles, /\.wm-invite-list-panel::after[\s\S]*?repeating-linear-gradient/);
  assert.match(redesignStyles, /\.wm-invitation-row[\s\S]*?padding:\s*16px\s*!important/);
  assert.match(
    redesignStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.wm-invite-list-panel[\s\S]*?padding:\s*18px\s*!important/,
  );
});
