import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

const workflowUrl = new URL("../../../../.github/workflows/publish-tracking-clients.yml", import.meta.url);
const desktopPackage = "workmap/apps/desktop-agent/package.json";
const browserPackage = "workmap/apps/browser-extension/package.json";

async function stepScript(name: string, source?: string) {
  const workflow = source ?? await readFile(workflowUrl, "utf8");
  const start = workflow.indexOf(`name: ${name}`);
  assert(start >= 0, `workflow step ${name} must exist`);
  const block = workflow.slice(start).match(/\n {8}run: \|\r?\n((?:(?: {10}[^\n]*|\r?)\n?)+)/)?.[1];
  assert(block, `workflow step ${name} must have an executable run block`);
  return block.replace(/^ {10}/gm, "");
}

async function fixture(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "workmap-release-test-"));
  try {
    await run(directory);
  } finally {
    const resolved = await realpath(directory);
    assert.equal(dirname(resolved).toLowerCase(), (await realpath(tmpdir())).toLowerCase());
    assert(basename(resolved).startsWith("workmap-release-test-"));
    await rm(resolved, { recursive: true, force: true });
  }
}

function git(directory: string, ...args: string[]) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], {
    cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_AUTHOR_NAME: "Release Test", GIT_COMMITTER_NAME: "Release Test",
      GIT_AUTHOR_EMAIL: "release@example.test", GIT_COMMITTER_EMAIL: "release@example.test" },
  }).trim();
}

function bashExecutable() {
  if (process.platform !== "win32") return "bash";
  const gitPath = execFileSync("where.exe", ["git.exe"], { encoding: "utf8" }).trim().split(/\r?\n/)[0]!;
  const candidate = resolve(dirname(gitPath), "../bin/bash.exe");
  assert(existsSync(candidate), "Git for Windows Bash is required for executable workflow tests");
  return candidate;
}

async function packageFile(directory: string, path: string, version: string, extra = {}) {
  await mkdir(dirname(join(directory, path)), { recursive: true });
  await writeFile(join(directory, path), JSON.stringify({ version, ...extra }));
}

for (const scenario of [
  { name: "Browser-only version bump", desktop: false, browser: true, expected: "desktop=false\nextension=true" },
  { name: "Desktop-only version bump", desktop: true, browser: false, expected: "desktop=true\nextension=false" },
  { name: "both version bumps", desktop: true, browser: true, expected: "desktop=true\nextension=true" },
  { name: "both version bumps from a Windows CRLF checkout", desktop: true, browser: true, crlf: true, expected: "desktop=true\nextension=true" },
  { name: "package edits without version bumps", desktop: false, browser: false, expected: "desktop=false\nextension=false" },
  { name: "initial push without a before commit", desktop: true, browser: true, initial: true, expected: "desktop=true\nextension=true" },
  { name: "manual Browser publication", desktop: false, browser: false, manual: "browser-extension", expected: "desktop=false\nextension=true" },
  { name: "manual Desktop publication", desktop: false, browser: false, manual: "desktop-agent", expected: "desktop=true\nextension=false" },
  { name: "manual both publication", desktop: false, browser: false, manual: "both", expected: "desktop=true\nextension=true" },
]) {
  test(`release workflow detects ${scenario.name}`, async () => fixture(async (directory) => {
    git(directory, "init", "--initial-branch=main");
    await packageFile(directory, desktopPackage, "0.6.12");
    await packageFile(directory, browserPackage, "0.5.20");
    git(directory, "add", ".");
    git(directory, "commit", "-m", "fixture baseline");
    const before = git(directory, "rev-parse", "HEAD");
    await packageFile(directory, desktopPackage, scenario.desktop ? "0.6.13" : "0.6.12", { private: true });
    await packageFile(directory, browserPackage, scenario.browser ? "0.5.21" : "0.5.20", { private: true });
    git(directory, "add", ".");
    git(directory, "commit", "-m", "fixture update");
    const output = join(directory, "output.txt");
    const source = scenario.crlf ? (await readFile(workflowUrl, "utf8")).replace(/\r?\n/g, "\r\n") : undefined;
    execFileSync(bashExecutable(), ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", await stepScript("Select changed clients", source)], {
      cwd: directory, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, EVENT_NAME: scenario.manual ? "workflow_dispatch" : "push",
        MANUAL_TARGET: scenario.manual ?? "", BEFORE_SHA: scenario.initial ? "0".repeat(40) : before,
        CURRENT_SHA: git(directory, "rev-parse", "HEAD"), GITHUB_OUTPUT: output },
    });
    assert.equal((await readFile(output, "utf8")).trim().replace(/\r/g, ""), scenario.expected);
  }));
}

test("release metadata locates the archive produced by the actual Browser packaging script", {
  skip: process.platform !== "win32" ? "Browser packaging requires Windows PowerShell" : false,
}, async () => fixture(async (directory) => {
  const packageJson = JSON.parse(await readFile(new URL("../../browser-extension/package.json", import.meta.url), "utf8"));
  await packageFile(directory, browserPackage, packageJson.version);
  const extension = join(directory, "workmap/apps/browser-extension");
  await mkdir(join(extension, "scripts"), { recursive: true });
  await mkdir(join(extension, "alpha-unpacked"), { recursive: true });
  await writeFile(join(extension, "alpha-unpacked/manifest.json"), JSON.stringify({ version: packageJson.version }));
  const script = join(extension, "scripts/package-alpha.mjs");
  await copyFile(new URL("../../browser-extension/scripts/package-alpha.mjs", import.meta.url), script);
  execFileSync(process.execPath, [script], { cwd: directory, timeout: 30_000, stdio: "pipe" });
  const output = join(directory, "release-output.txt");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", await stepScript("Read Extension release metadata")], {
    cwd: directory, timeout: 20_000, stdio: "pipe", env: { ...process.env, GITHUB_OUTPUT: output },
  });
  const outputBytes = await readFile(output);
  // Windows PowerShell appends UTF-16LE; the workflow's pwsh uses UTF-8.
  const result = outputBytes.toString(outputBytes[0] === 0xff && outputBytes[1] === 0xfe ? "utf16le" : "utf8").replace(/^\uFEFF/, "");
  const asset = result.match(/^asset=(.+)$/m)?.[1]?.trim();
  assert(asset && existsSync(asset), "the published asset must exist");
  assert.match(result, new RegExp(`^tag=browser-extension-v${packageJson.version.replaceAll(".", "\\.")}`, "m"));
}));
