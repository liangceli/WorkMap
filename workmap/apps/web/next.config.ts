import { existsSync, readFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import type { NextConfig } from "next";

loadWorkspaceRootEnv();

const nextConfig: NextConfig = {};

export default nextConfig;

function loadWorkspaceRootEnv() {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const rootEnvPath = workspaceRoot ? resolve(workspaceRoot, ".env") : null;

  if (!rootEnvPath || !existsSync(rootEnvPath)) {
    return;
  }

  const envFile = readFileSync(rootEnvPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function findWorkspaceRoot(startDir: string) {
  let currentDir = startDir;
  const root = parse(startDir).root;

  while (true) {
    if (existsSync(resolve(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    if (currentDir === root) {
      return null;
    }

    currentDir = dirname(currentDir);
  }
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
